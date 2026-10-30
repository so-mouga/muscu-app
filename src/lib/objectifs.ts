import { setReglage } from '../db'
import type { Muscle } from '../types'

/** Réglage des objectifs de volume personnels (séries dures par semaine, par muscle). */
export const CLE_VOLUME = 'objectifsVolume'
/** Réglage de l'historique des phases. */
export const CLE_PHASES = 'phases'

export type Phase = 'seche' | 'maintien' | 'prise'

/** Une phase à partir d'une date : l'historique garde les précédentes pour le Bilan. */
export interface PeriodePhase {
  phase: Phase
  /** AAAA-MM-JJ */
  depuis: string
}

export const PHASES: { id: Phase; nom: string; court: string; explication: string }[] = [
  { id: 'seche', nom: 'Sèche', court: 'Sèche', explication: 'Tu manges un peu moins pour perdre du gras. Garder tes charges, c’est déjà réussir : une baisse de force est le signal à surveiller.' },
  { id: 'maintien', nom: 'Maintien', court: 'Maintien', explication: 'Poids stable : tu progresses tranquillement, sans viser de prise ni de perte.' },
  { id: 'prise', nom: 'Prise de muscle', court: 'Prise', explication: 'Tu manges un peu plus pour construire : il faut monter régulièrement en reps ou en charge, et le poids doit monter doucement.' },
]

/** Phase en cours à une date (null si jamais réglée ou si la date est avant la première). */
export function phaseA(periodes: PeriodePhase[], date: string): PeriodePhase | null {
  return [...periodes].sort((a, b) => b.depuis.localeCompare(a.depuis)).find((p) => p.depuis <= date) ?? null
}

/** Nouvelle phase à partir d'une date : remplace celle qui commençait le même jour, garde les autres. */
export function changerPhase(periodes: PeriodePhase[], phase: Phase, depuis: string): PeriodePhase[] {
  return [...periodes.filter((p) => p.depuis !== depuis), { phase, depuis }].sort((a, b) => a.depuis.localeCompare(b.depuis))
}

export const enregistrerVolume = (volume: Partial<Record<Muscle, number>>) => setReglage(CLE_VOLUME, volume)
