import { db, setReglage } from '../db'
import type { Reglage, Seance } from '../types'
import { dateCourte } from './calc'
import { meilleureSerie } from './historique'

/**
 * Exercices équivalents (ex. développé Smith ↔ développé haltères), liés dans les deux sens.
 * Chacun garde sa propre progression : le lien sert à proposer l'un quand l'autre est pris et à
 * donner un repère la première fois. Stocké dans les réglages (donc dans l'export).
 */
export type Equivalents = Record<string, string[]>

export const lireEquivalents = (reglages: Reglage[]): Equivalents => (reglages.find((r) => r.cle === 'equivalents')?.valeur as Equivalents | undefined) ?? {}

export function relies(eq: Equivalents, a: string, b: string): Equivalents {
  const ajout = (x: string, y: string) => [...new Set([...(eq[x] ?? []), y])]
  return { ...eq, [a]: ajout(a, b), [b]: ajout(b, a) }
}

export function delies(eq: Equivalents, a: string, b: string): Equivalents {
  const retrait = (x: string, y: string) => (eq[x] ?? []).filter((z) => z !== y)
  return { ...eq, [a]: retrait(a, b), [b]: retrait(b, a) }
}

/** Écrit en partant de la valeur en base, pour ne pas écraser un lien fait ailleurs entre-temps. */
export async function modifierEquivalents(f: (eq: Equivalents) => Equivalents) {
  const actuel = ((await db.reglages.get('equivalents'))?.valeur as Equivalents | undefined) ?? {}
  await setReglage('equivalents', f(actuel))
}

/**
 * Repère pour un exercice jamais fait : la dernière meilleure série d'un équivalent.
 * `seances` de la plus récente à la plus ancienne (la séance en cours peut être en tête).
 */
export function repere(exoId: string, eq: Equivalents, seances: Seance[]): { exoId: string; charge: number; reps: number; rpe: number; date: string } | null {
  const liste = eq[exoId] ?? []
  if (!liste.length) return null
  for (const s of seances) {
    for (const id of liste) {
      const m = meilleureSerie(s.series.filter((x) => x.exoId === id))
      if (m) return { exoId: id, charge: m.charge, reps: m.reps, rpe: m.rpe, date: dateCourte(s.date) }
    }
  }
  return null
}
