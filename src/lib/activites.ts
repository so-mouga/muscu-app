import type { Activite } from '../types'

/**
 * Activités hors muscu (padel, course…), remises le 20 nov. 2026 à la demande de l'utilisateur : pour que son IA les voie dans
 * les textes partagés. Elles n'entrent dans aucun calcul (ni muscles, ni semaines tenues, ni calories brûlées) : elles
 * expliquent, elles ne notent pas.
 */
export const TYPES_ACTIVITE = ['Padel', 'Course', 'Vélo', 'Foot', 'Natation', 'Marche, rando'] as const

/** L'effort en trois choix, rangé sur 10 dans `intensite` (comme les activités notées avant le 2 nov. 2026). */
export const EFFORTS_ACTIVITE = [
  { val: 3, nom: 'Facile', aide: 'en parlant' },
  { val: 6, nom: 'Moyen', aide: 'essoufflé' },
  { val: 9, nom: 'Dur', aide: 'à fond' },
] as const

/** « facile », « moyen » ou « dur », y compris pour une ancienne intensité notée de 1 à 10. */
export function effortActivite(intensite: number): string {
  return intensite <= 4 ? 'facile' : intensite <= 7 ? 'moyen' : 'dur'
}

/** « 1 h 30 », « 45 min ». */
export function dureeActivite(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? `${h} h${m ? ` ${String(m).padStart(2, '0')}` : ''}` : `${m} min`
}

/** « padel 1 h 30, dur » : le type en minuscule, sauf s'il a été écrit à la main avec une majuscule voulue (« CrossFit »). */
export function texteActivite(a: Activite): string {
  const type = (TYPES_ACTIVITE as readonly string[]).includes(a.type) ? a.type.toLowerCase() : a.type
  return `${type} ${dureeActivite(a.duree)}, ${effortActivite(a.intensite)}`
}

/** Les activités d'un jour, en une ligne pour un tableau : « padel 1 h 30, dur + course 30 min, moyen ». */
export function activitesDuJour(activites: Activite[], date: string): string {
  return activites
    .filter((a) => a.date === date)
    .map(texteActivite)
    .join(' + ')
}

/**
 * Le résumé d'une période pour le texte partagé : « 5 activités, 6 h 15 en tout · padel 3 fois (4 h 30, dur), course 2 fois
 * (1 h 45, moyen) ». L'effort d'un type est celui de la plupart de ses séances. Rien s'il n'y en a pas.
 */
export function resumeActivites(activites: Activite[], debut: string, fin: string): string | null {
  const l = activites.filter((a) => a.date >= debut && a.date <= fin)
  if (!l.length) return null
  const parType = new Map<string, Activite[]>()
  for (const a of l) parType.set(a.type, [...(parType.get(a.type) ?? []), a])
  const total = l.reduce((t, a) => t + a.duree, 0)
  const types = [...parType]
    .sort((a, b) => b[1].length - a[1].length || b[1].reduce((t, x) => t + x.duree, 0) - a[1].reduce((t, x) => t + x.duree, 0))
    .map(([type, as]) => {
      const efforts = new Map<string, number>()
      for (const a of as) efforts.set(effortActivite(a.intensite), (efforts.get(effortActivite(a.intensite)) ?? 0) + 1)
      const effort = [...efforts].sort((a, b) => b[1] - a[1])[0][0]
      const nom = (TYPES_ACTIVITE as readonly string[]).includes(type) ? type.toLowerCase() : type
      return `${nom} ${as.length} fois (${dureeActivite(as.reduce((t, x) => t + x.duree, 0))}, ${effort})`
    })
  return `${l.length} activité${l.length > 1 ? 's' : ''}, ${dureeActivite(total)} en tout · ${types.join(', ')}`
}
