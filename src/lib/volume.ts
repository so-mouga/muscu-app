import { MUSCLES } from '../data/exercices'
import type { Muscle } from '../types'

/**
 * Volume par muscle lu comme une jauge : sous la zone utile = « Léger », dedans = « Optimal »,
 * au-dessus = « Beaucoup ». Chaque muscle a un niveau : Normal (la zone de `MUSCLES`), Entretien
 * (4 à 8), Priorité (16 à 20) ou Sans conseil (0). Il s'enregistre en chiffre, ce qui relit aussi les anciennes cibles.
 */
export type EtatVolume = 'suivi' | 'leger' | 'optimal' | 'beaucoup'

export const LIBELLE_VOLUME: Record<EtatVolume, string> = { suivi: 'suivi', leger: 'Léger', optimal: 'Optimal', beaucoup: 'Beaucoup' }

const def = (m: Muscle) => MUSCLES.find((x) => x.id === m)!

/** Cible de l'appli (bas de la zone utile), 0 = suivi seulement. */
export const cibleConseillee = (m: Muscle) => def(m).cible

/** Zone utile [bas, haut] pour cette cible, ou null sans cible. */
export function zone(m: Muscle, cible: number): { bas: number; haut: number } | null {
  if (cible <= 0) return null
  return { bas: cible, haut: Math.max(niveauDe(m, cible) === 'entretien' ? HAUT_ENTRETIEN : def(m).haut, Math.round(cible * 1.25)) }
}

export function etatVolume(m: Muscle, v: number, cible: number): EtatVolume {
  const z = zone(m, cible)
  if (!z) return 'suivi'
  return v < z.bas ? 'leger' : v > z.haut ? 'beaucoup' : 'optimal'
}

export type NiveauVolume = 'entretien' | 'normal' | 'priorite' | 'sans'

const CIBLE_ENTRETIEN = 4
const HAUT_ENTRETIEN = 8
const CIBLE_PRIORITE = 16

/** Le niveau que dit une cible : 0 = Sans conseil ; 16 ou plus = Priorité ; 8 ou moins, et sous le bas du muscle = Entretien ; sinon Normal. Rien de noté = Normal. */
export function niveauDe(m: Muscle, cible: number | undefined): NiveauVolume {
  if (cible === undefined) return 'normal'
  if (cible <= 0) return 'sans'
  if (cible >= CIBLE_PRIORITE) return 'priorite'
  return cible <= HAUT_ENTRETIEN && cible < def(m).cible ? 'entretien' : 'normal'
}

export const cibleDuNiveau = (m: Muscle, n: NiveauVolume) => (n === 'sans' ? 0 : n === 'entretien' ? CIBLE_ENTRETIEN : n === 'priorite' ? CIBLE_PRIORITE : def(m).cible)

/** La phrase du choix, chiffres du muscle compris. */
export function phraseNiveau(m: Muscle, n: NiveauVolume) {
  const z = zone(m, cibleDuNiveau(m, n))
  if (!z) return 'Ses séries restent affichées, sans barre ni remarque.'
  if (n === 'entretien') return `Le garder sans chercher à le faire grossir : ${z.bas} à ${z.haut} séries.`
  if (n === 'priorite') return `Un point faible, sur 4 à 8 semaines : ${z.bas} à ${z.haut} séries.`
  return `Le conseil général : ${z.bas} à ${z.haut} séries.`
}

/** Aujourd'hui et après : le niveau de chaque muscle ; les anciennes cibles en chiffres y sont ramenées. Muscle sans conseil général : rien. */
export const ciblesEnVigueur = (v: Partial<Record<Muscle, number>>) => Object.fromEntries(MUSCLES.map((m) => [m.id, m.cible > 0 ? cibleDuNiveau(m.id, niveauDe(m.id, v[m.id])) : 0])) as Record<Muscle, number>
