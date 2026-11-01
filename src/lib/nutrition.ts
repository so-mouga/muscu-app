import { objectifsA, type EtapeObjectifs } from './objectifs'

export interface ObjectifNutrition {
  kcal: number
}

/**
 * Objectif calories d'une date : celui fixé dans les objectifs, sinon null.
 */
export function objectifDuJour(frise: EtapeObjectifs[], date: string): ObjectifNutrition | null {
  const manuel = objectifsA(frise, date)?.calories
  if (manuel) return { kcal: manuel }
  return null
}
