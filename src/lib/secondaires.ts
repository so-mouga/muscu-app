import { EXERCICES } from '../data/exercices'
import type { Exercice, Muscle } from '../types'

/**
 * Muscles secondaires proposés pour un exercice créé : ceux qu'ont le plus souvent les exercices de base
 * de même muscle principal et de même type (poussée pecs → triceps et avant d'épaule ; tirage dos → rien,
 * pour ne pas fausser le biceps ; isolation → rien). Ils comptent pour une demi-série dans le volume.
 */
export function secondairesProposes(muscle: Muscle, type: Exercice['type'], base: Exercice[] = Object.values(EXERCICES)): NonNullable<Exercice['secondaires']> {
  const compte = new Map<string, { n: number; l: NonNullable<Exercice['secondaires']> }>()
  for (const e of base) {
    if (e.muscle !== muscle || e.type !== type) continue
    const l = e.secondaires ?? []
    const cle = l.map((s) => `${s.muscle}:${s.coef}`).sort().join(',')
    compte.set(cle, { n: (compte.get(cle)?.n ?? 0) + 1, l })
  }
  let meilleur: { n: number; l: NonNullable<Exercice['secondaires']> } | undefined
  for (const c of compte.values()) if (!meilleur || c.n > meilleur.n) meilleur = c
  return (meilleur?.l ?? []).map((s) => ({ ...s }))
}
