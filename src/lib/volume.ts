import { MUSCLES } from '../data/exercices'
import type { Muscle } from '../types'

/**
 * Volume par muscle lu comme une jauge : sous la zone utile = « Léger », dedans = « Optimal »,
 * au-dessus = « Beaucoup ». Zone par défaut : celle de l'appli (`MUSCLES`). Cible ajustée par
 * l'utilisateur : la zone part de sa cible, et « Beaucoup » au-delà de +25 % (ou du haut habituel).
 */
export type EtatVolume = 'suivi' | 'leger' | 'optimal' | 'beaucoup'

export const LIBELLE_VOLUME: Record<EtatVolume, string> = { suivi: 'suivi', leger: 'Léger', optimal: 'Optimal', beaucoup: 'Beaucoup' }

const def = (m: Muscle) => MUSCLES.find((x) => x.id === m)!

/** Cible de l'appli (bas de la zone utile), 0 = suivi seulement. */
export const cibleConseillee = (m: Muscle) => def(m).cible

/** La cible diffère de celle de l'appli : réglée à la main (ou par le coach). */
export const ajustee = (m: Muscle, cible: number) => cible !== cibleConseillee(m)

/** Zone utile [bas, haut] pour cette cible, ou null sans cible. */
export function zone(m: Muscle, cible: number): { bas: number; haut: number } | null {
  if (cible <= 0) return null
  return { bas: cible, haut: Math.max(def(m).haut, Math.round(cible * 1.25)) }
}

export function etatVolume(m: Muscle, v: number, cible: number): EtatVolume {
  const z = zone(m, cible)
  if (!z) return 'suivi'
  return v < z.bas ? 'leger' : v > z.haut ? 'beaucoup' : 'optimal'
}

/** Priorité : +4 séries dures par semaine au-dessus de la cible conseillée. */
export const BONUS_PRIORITE_MUSCLE = 4
export const prioritaire = (m: Muscle, cible: number) => cibleConseillee(m) > 0 && cible >= cibleConseillee(m) + BONUS_PRIORITE_MUSCLE

/** Les cibles conseillées par l'appli, pour tous les muscles (0 = suivi). */
export const ciblesConseillees = () => Object.fromEntries(MUSCLES.map((m) => [m.id, m.cible])) as Record<Muscle, number>
