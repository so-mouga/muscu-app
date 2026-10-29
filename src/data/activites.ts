import { POIDS_DEFAUT } from '../lib/calc'
import type { Activite } from '../types'

/** Sports proposés, avec leur dépense moyenne (MET, Compendium of Physical Activities). */
export const TYPES_ACTIVITE: { id: string; nom: string; emoji: string; met: number }[] = [
  { id: 'padel', nom: 'Padel', emoji: '🎾', met: 6 },
  { id: 'course', nom: 'Course', emoji: '🏃', met: 9 },
  { id: 'velo', nom: 'Vélo', emoji: '🚴', met: 7 },
  { id: 'natation', nom: 'Natation', emoji: '🏊', met: 7 },
  { id: 'foot', nom: 'Foot', emoji: '⚽', met: 7 },
  { id: 'basket', nom: 'Basket', emoji: '🏀', met: 6.5 },
  { id: 'rando', nom: 'Rando', emoji: '🥾', met: 6 },
  { id: 'marche', nom: 'Marche', emoji: '🚶', met: 3.5 },
  { id: 'combat', nom: 'Sport de combat', emoji: '🥊', met: 9 },
  { id: 'yoga', nom: 'Yoga / mobilité', emoji: '🧘', met: 2.5 },
  { id: 'autre', nom: 'Autre', emoji: '⚡', met: 5 },
]

export const typeActivite = (id: string) => TYPES_ACTIVITE.find((t) => t.id === id) ?? TYPES_ACTIVITE[TYPES_ACTIVITE.length - 1]

/** Calories estimées : MET du sport, ajusté par l'intensité ressentie (5/10 = moyenne), × poids × durée. */
export function kcalActivite(a: Pick<Activite, 'type' | 'duree' | 'intensite'>, poids?: number): number {
  const facteur = 0.7 + 0.06 * a.intensite
  return Math.round(typeActivite(a.type).met * facteur * (poids ?? POIDS_DEFAUT) * (a.duree / 60))
}

export const INTENSITES: Record<number, string> = {
  1: 'très facile',
  2: 'facile',
  3: 'facile',
  4: 'modéré',
  5: 'modéré',
  6: 'soutenu',
  7: 'dur',
  8: 'très dur',
  9: 'très dur',
  10: 'maximal',
}
