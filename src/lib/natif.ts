import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

/**
 * Appli Android (Capacitor) : le repos est aussi tenu par Android, avec une notification qui
 * décompte (écran verrouillé, volet) et une alarme qui sonne à l'heure même écran éteint.
 * Dans le navigateur, rien de tout ça : `natif` est faux et ces fonctions ne font rien.
 */
interface PluginMinuteur {
  demarrer(o: { fin: number; titre: string; texte: string }): Promise<void>
  arreter(): Promise<void>
  etat(): Promise<{ fin: number; passe: boolean }>
  addListener(evenement: 'action', f: (e: { type: 'plus' | 'passer'; fin: number }) => void): Promise<PluginListenerHandle>
}

export const natif = Capacitor.isNativePlatform()
const MinuteurRepos = registerPlugin<PluginMinuteur>('MinuteurRepos')

const silencieux = <T,>(p: () => Promise<T>) => (natif ? p().catch(() => undefined) : Promise.resolve(undefined))

/** Repos jusqu'à `fin` (horodatage), avec ce qui vient après. Demande l'autorisation des notifications la 1re fois. */
export const reposNatif = (fin: number, ensuite: string) => silencieux(() => MinuteurRepos.demarrer({ fin, titre: '⏱ Repos', texte: `Ensuite : ${ensuite}` }))
export const arreterReposNatif = () => silencieux(() => MinuteurRepos.arreter())

/**
 * Boutons de la notification (+30 s, Passer) : appelés tout de suite si l'appli tourne, sinon au
 * retour à l'écran d'après l'état gardé par Android.
 */
export function suivreReposNatif(sur: (e: { type: 'plus' | 'passer'; fin: number }) => void): () => void {
  if (!natif) return () => {}
  const ecoute = MinuteurRepos.addListener('action', sur)
  const auRetour = () => {
    if (document.visibilityState !== 'visible') return
    void silencieux(() => MinuteurRepos.etat()).then((e) => {
      if (e?.passe) sur({ type: 'passer', fin: 0 })
      else if (e && e.fin > 0) sur({ type: 'plus', fin: e.fin })
    })
  }
  document.addEventListener('visibilitychange', auRetour)
  return () => {
    void ecoute.then((h) => h.remove())
    document.removeEventListener('visibilitychange', auRetour)
  }
}
