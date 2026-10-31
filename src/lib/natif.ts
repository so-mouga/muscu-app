import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

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
