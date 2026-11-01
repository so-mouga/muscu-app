import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { plusRecente, versionDeTag } from './versions'

/**
 * Appli Android (Capacitor) : la séance est aussi tenue par Android, avec une notification affichée
 * du début à la fin (écran verrouillé, volet) : chrono de séance, décompte du repos ou repos en
 * pause, avec Pause / Reprendre / +30 s / Passer, et une alarme qui sonne à la fin du repos même
 * écran éteint. Dans le navigateur, rien de tout ça : `natif` est faux et ces fonctions ne font rien.
 */
export interface EtatNatif {
  mode: '' | 'seance' | 'repos' | 'pause'
  /** Fin du repos (horodatage), en mode repos. */
  fin: number
  /** Temps restant figé (ms), en pause. */
  reste: number
}

interface Commun {
  nom: string
  debut: number
  texte: string
}

interface PluginMinuteur {
  seance(o: Commun): Promise<void>
  demarrer(o: Commun & { fin: number }): Promise<void>
  pause(o: Commun & { reste: number }): Promise<void>
  arreter(): Promise<void>
  etat(): Promise<EtatNatif>
  version(): Promise<{ versionName: string }>
  rappel(o: { actif: boolean; heure: string; jours: Record<string, string> }): Promise<{ autorise: boolean }>
  seanceDuJour(o: { date: string }): Promise<void>
  addListener(evenement: 'action', f: (e: EtatNatif) => void): Promise<PluginListenerHandle>
}

export const natif = Capacitor.isNativePlatform()
const MinuteurRepos = registerPlugin<PluginMinuteur>('MinuteurRepos')

const silencieux = <T,>(p: () => Promise<T>) => (natif ? p().catch(() => undefined) : Promise.resolve(undefined))

/** Pas de repos en cours : « séance en cours » avec son chrono. Demande l'autorisation des notifications la 1re fois. */
export const seanceNatif = (c: Commun) => silencieux(() => MinuteurRepos.seance(c))
export const reposNatif = (c: Commun, fin: number) => silencieux(() => MinuteurRepos.demarrer({ ...c, fin }))
export const pauseNatif = (c: Commun, reste: number) => silencieux(() => MinuteurRepos.pause({ ...c, reste }))
/** Fin de la séance (enregistrée ou supprimée) : la notification disparaît. */
export const arreterSeanceNatif = () => silencieux(() => MinuteurRepos.arreter())

/**
 * Boutons de la notification : l'état choisi est transmis tout de suite si l'appli tourne, sinon au
 * retour à l'écran d'après l'état gardé par Android.
 */
export function suivreNatif(sur: (e: EtatNatif) => void): () => void {
  if (!natif) return () => {}
  const ecoute = MinuteurRepos.addListener('action', sur)
  const auRetour = () => {
    if (document.visibilityState !== 'visible') return
    void silencieux(() => MinuteurRepos.etat()).then((e) => e && e.mode && sur(e))
  }
  document.addEventListener('visibilitychange', auRetour)
  return () => {
    void ecoute.then((h) => h.remove())
    document.removeEventListener('visibilitychange', auRetour)
  }
}

/** Rappel de séance (Réglages), gardé dans le réglage `rappel`. */
export interface Rappel {
  actif: boolean
  /** « 18:30 » */
  heure: string
}
export const CLE_RAPPEL = 'rappel'
export const RAPPEL_DEFAUT: Rappel = { actif: false, heure: '18:00' }

/** L'APK installé sait faire le rappel de séance (1.6 et plus). */
export const rappelDisponible = async () => {
  const v = await versionInstallee()
  return !!v && !plusRecente('1.6', v)
}

/**
 * Envoie à Android le rappel et le planning (nom de la séance de chaque jour prévu, 1 = lundi). Android
 * le garde et replanifie seul. `autorise` : faux si les notifications sont refusées.
 */
export const reglerRappel = (r: Rappel, jours: Record<string, string>) => silencieux(() => MinuteurRepos.rappel({ ...r, jours }))

/** Nom de la séance de chaque jour prévu (« 1 » = lundi), deux séances le même jour réunies. */
export function joursRappel(planning: { modele: { nom: string }; jour: number }[]): Record<string, string> {
  const jours: Record<string, string> = {}
  for (const e of planning) jours[e.jour] = jours[e.jour] ? `${jours[e.jour]} et ${e.modele.nom}` : e.modele.nom
  return jours
}

/** Une séance démarrée ce jour-là : pas de rappel. */
export const seanceDuJourNatif = (date: string) => silencieux(() => MinuteurRepos.seanceDuJour({ date }))

/** Version de l'appli Android installée ; la 1.1 ne savait pas encore la donner. */
async function versionInstallee(): Promise<string | null> {
  if (!natif) return null
  try {
    return (await MinuteurRepos.version()).versionName
  } catch {
    return '1.1'
  }
}

/**
 * Un APK plus récent est publié sur GitHub (publication « android-vX.Y » avec muscu.apk) : sa
 * version et le lien de téléchargement. Rien dans le navigateur, hors ligne, ou si c'est à jour.
 */
export async function nouvelleVersionAndroid(): Promise<{ version: string; url: string } | null> {
  const installee = await versionInstallee()
  if (!installee) return null
  try {
    const r = await fetch('https://api.github.com/repos/so-mouga/muscu-app/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
    if (!r.ok) return null
    const d = (await r.json()) as { tag_name: string; assets?: { name: string; browser_download_url: string }[] }
    const v = versionDeTag(d.tag_name)
    const apk = d.assets?.find((a) => a.name.endsWith('.apk'))
    return v && apk && plusRecente(v, installee) ? { version: v, url: apk.browser_download_url } : null
  } catch {
    return null
  }
}
