import type { Exercice, ExoPlan, Seance, Serie } from '../types'
import { enTemps } from './calc'
import { historiqueDe, recordDuJour, serieComptee, suiviProgres } from './historique'
import { conseil } from './progression'

/**
 * Les records : une charge jamais faite aussi dure, ou plus de reps que jamais à une charge déjà faite (`suiviProgres`,
 * séries normales). Au plus un par exercice et par séance, aucun en séance allégée, aussi en sèche. Rien n'est stocké :
 * tout se recalcule depuis les séances. (Ils valaient des « crans » comptés dans un disque de 12, retirés le 19 nov. 2026.)
 */

/** Les records se comptent depuis les vraies séances ; celles d'avant (des essais) servent seulement de référence. */
export const DEBUT_RECORDS = '2026-11-09'

export interface RecordGagne {
  exo: Exercice
  /** La série qui a battu le record. */
  serie: Serie
  genre: 'charge' | 'reps'
  /** L'ancien record : les reps à cette charge, ou la charge la plus dure jamais faite. */
  ancien: number
}

/**
 * La série du jour qui bat le record de l'exercice : la première à partir de laquelle les séries faites battent le
 * record. `avant` : séries de l'exercice par séance, hors allégées. Rien sans historique.
 */
export function recordGagne(exo: Exercice, avant: Serie[][], series: Serie[]): RecordGagne | null {
  const k = series.findIndex((_, i) => recordDuJour(exo, avant, series.slice(0, i + 1)))
  if (k < 0) return null
  const suivi = suiviProgres(exo)
  for (const h of avant.map((x) => x.filter(serieComptee)).filter((x) => x.length)) suivi.juger(h)
  const serie = series[k]
  const genre = recordDuJour(exo, avant, series.slice(0, k + 1))!
  return { exo, serie, genre, ancien: genre === 'charge' ? (exo.assistance ? -1 : 1) * suivi.plusDur() : (suivi.meilleur(serie.charge) ?? 0) }
}

/** Records d'une séance (en cours ou finie), un par exercice, dans l'ordre des exercices faits. `avant` : les séances terminées d'avant. */
export function recordsDeSeance(seance: Seance, avant: Seance[], exo: (id: string) => Exercice): RecordGagne[] {
  if (seance.deload || seance.date < DEBUT_RECORDS) return []
  const passees = avant.filter((s) => s.id !== seance.id && !s.enCours && s.debut < seance.debut)
  const ids = [...new Set(seance.series.map((x) => x.exoId))]
  return ids.flatMap((id) => recordGagne(exo(id), historiqueDe(passees, id), seance.series.filter((x) => x.exoId === id)) ?? [])
}

/** Sous le chrono, juste après la série : « ton record était 10 ». Court : la série faite est écrite juste dessous, et le cercle est étroit. */
export function pourquoiRecord(c: RecordGagne): string {
  if (c.genre === 'reps') return `ton record était ${c.ancien}${enTemps(c.exo) ? ' s' : ''}`
  return c.exo.assistance ? 'jamais fait avec si peu d’aide' : 'charge jamais faite'
}

/**
 * Ce qu'il faut faire à cette charge pour battre le record de l'exercice aujourd'hui : `reps` à atteindre, et le record
 * à cette charge quand elle a déjà été faite. Rien sans historique, si le record du jour est déjà battu, ou à une
 * charge plus légère jamais faite (aucun record possible).
 */
export function seuilRecord(exo: Exercice, avant: Serie[][], faites: Serie[], charge: number): { reps: number; record?: number } | null {
  const histo = avant.map((h) => h.filter(serieComptee)).filter((h) => h.length)
  if (!histo.length || recordDuJour(exo, avant, faites)) return null
  const suivi = suiviProgres(exo)
  for (const h of histo) suivi.juger(h)
  if ((exo.assistance ? -charge : charge) > suivi.plusDur()) return { reps: 1 }
  const record = suivi.meilleur(charge)
  return record === undefined ? null : { reps: record + 1, record }
}

/**
 * Record « à ta portée » avant une séance : le conseil est « Tu peux viser plus » (une rep de plus), et la meilleure
 * série de la dernière fois est déjà au record de sa charge : une rep de plus le bat. Sans ce 2e point, on promettrait
 * un record que l'objectif conseillé ne donne pas.
 */
export function aPortee(exo: Exercice, plan: ExoPlan, avant: Serie[][]): { charge: number; reps: number } | null {
  if (conseil(exo, plan, avant)?.decision !== 'plus_une_rep') return null
  const histo = avant.map((h) => h.filter(serieComptee)).filter((h) => h.length)
  if (!histo.length) return null
  const suivi = suiviProgres(exo)
  for (const h of [...histo].reverse()) suivi.juger(h)
  const dur = (c: number) => (exo.assistance ? -c : c)
  const charges = [...new Set(histo[0].map((x) => x.charge))].sort((a, b) => dur(b) - dur(a))
  for (const charge of charges) {
    const record = suivi.meilleur(charge)!
    if (Math.max(...histo[0].filter((x) => x.charge === charge).map((x) => x.reps)) === record) return { charge, reps: record }
  }
  return null
}
