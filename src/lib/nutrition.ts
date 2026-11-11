import type { JourJournal } from '../types'
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

/** « 2 950 » : milliers séparés par une espace, pour les textes partagés. */
const nombre = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

/**
 * Repas lus dans l'appli de repas, sur des jours finis : moyenne des calories, de l'objectif de chaque jour et des
 * macros. Null sans aucun jour lu. Pour les textes partagés : à une IA, le vrai chiffre sert plus qu'un verdict.
 */
export function moyenneRepas(jours: JourJournal[], frise: EtapeObjectifs[] = []) {
  const lus = jours.filter((j) => j.kcalAppli && j.kcal !== undefined)
  if (!lus.length) return null
  const moy = (xs: (number | undefined)[]) => {
    const v = xs.filter((x): x is number => x !== undefined)
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : undefined
  }
  return {
    jours: lus.length,
    kcal: moy(lus.map((j) => j.kcal))!,
    objectif: moy(lus.map((j) => objectifDuJour(frise, j.date)?.kcal)),
    proteines: moy(lus.map((j) => j.proteines)),
    glucides: moy(lus.map((j) => j.glucides)),
    lipides: moy(lus.map((j) => j.lipides)),
    sodium: moy(lus.map((j) => j.sodium)),
  }
}

/** « 2 950 kcal pour 3 000 visées · protéines 150 g · glucides 360 g · lipides 85 g ». */
export function texteRepas(r: { kcal: number; objectif?: number; proteines?: number; glucides?: number; lipides?: number; sodium?: number }): string {
  return [
    `${nombre(r.kcal)} kcal${r.objectif ? ` pour ${nombre(r.objectif)} visées` : ''}`,
    r.proteines !== undefined && `protéines ${r.proteines} g`,
    r.glucides !== undefined && `glucides ${r.glucides} g`,
    r.lipides !== undefined && `lipides ${r.lipides} g`,
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * Ligne « Moyenne » de l'accueil, sur les jours finis de la semaine (`jours` déjà filtrés) : pas par jour, et jours
 * tenus face à l'objectif calories parmi ceux qui ont un verdict. Null sans rien à dire (le lundi, par exemple).
 */
export function moyenneSemaine(jours: JourJournal[]): { pas?: number; tenus?: number; notes?: number } | null {
  const pas = jours.filter((j) => j.pas !== undefined).map((j) => j.pas!)
  const notes = jours.filter((j) => j.calories)
  if (!pas.length && !notes.length) return null
  return {
    pas: pas.length ? Math.round(pas.reduce((a, b) => a + b, 0) / pas.length) : undefined,
    tenus: notes.length ? notes.filter((j) => j.calories === 'ok').length : undefined,
    notes: notes.length || undefined,
  }
}
