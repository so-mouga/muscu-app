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

/** Plus de cible en chiffres : le conseil général de chaque muscle, ou rien si la personne l'a coupé. */
export const ciblesEnVigueur = (v: Partial<Record<Muscle, number>>) => Object.fromEntries(MUSCLES.map((m) => [m.id, (v[m.id] ?? 0) > 0 ? m.cible : 0])) as Record<Muscle, number>
