import type { Exercice, ExoPlan, Seance, Serie } from '../types'
import { chargeQte, chargeTexte, ecartQte, enTemps, kg } from './calc'
import { historiqueDe, recordDuJour, recordsParSeance, serieComptee, suiviProgres } from './historique'
import { conseil } from './progression'

/**
 * Les crans : un cran = un record battu sur un exercice (`suiviProgres` : une charge jamais faite aussi dure, ou plus de
 * reps que jamais à une charge déjà faite). Au plus un par exercice et par séance, aucun en séance allégée, jamais
 * retiré, aussi en sèche. Rien n'est stocké : tout se recalcule depuis les séances.
 */

/** Les crans se comptent depuis les vraies séances ; celles d'avant servent seulement de référence. */
export const DEBUT_CRANS = '2026-11-09'
export const CRANS_PAR_DISQUE = 12

/** Crans gagnés par séance terminée. */
export function cransParSeance(seances: Seance[], exo: (id: string) => Exercice): Record<string, number> {
  const records = recordsParSeance(seances, exo)
  for (const s of seances) if (s.date < DEBUT_CRANS) records[s.id] = 0
  return records
}

export const totalCrans = (seances: Seance[], exo: (id: string) => Exercice) => Object.values(cransParSeance(seances, exo)).reduce((a, n) => a + n, 0)

/** Où en est le disque : les disques pleins, les crans du disque en cours (12 quand il vient d'être rempli) et ce qu'il reste. */
export function etatDisque(total: number) {
  const pleins = Math.floor(total / CRANS_PAR_DISQUE)
  const crans = total % CRANS_PAR_DISQUE
  return { total, pleins, crans, reste: CRANS_PAR_DISQUE - crans, numero: pleins + 1 }
}

export interface CranGagne {
  exo: Exercice
  /** La série qui a battu le record. */
  serie: Serie
  genre: 'charge' | 'reps'
  /** L'ancien record : les reps à cette charge, ou la charge la plus dure jamais faite. */
  ancien: number
}

/**
 * La série du jour qui gagne le cran de l'exercice : la première à partir de laquelle les séries faites battent le
 * record. `avant` : séries de l'exercice par séance, hors allégées. Rien sans historique.
 */
export function cranDuJour(exo: Exercice, avant: Serie[][], series: Serie[]): CranGagne | null {
  const k = series.findIndex((_, i) => recordDuJour(exo, avant, series.slice(0, i + 1)))
  if (k < 0) return null
  const suivi = suiviProgres(exo)
  for (const h of avant.map((x) => x.filter(serieComptee)).filter((x) => x.length)) suivi.juger(h)
  const serie = series[k]
  const genre = recordDuJour(exo, avant, series.slice(0, k + 1))!
  return { exo, serie, genre, ancien: genre === 'charge' ? (exo.assistance ? -1 : 1) * suivi.plusDur() : (suivi.meilleur(serie.charge) ?? 0) }
}

/** Crans d'une séance (en cours ou finie), dans l'ordre des exercices faits. `avant` : les séances terminées d'avant. */
export function cransDeSeance(seance: Seance, avant: Seance[], exo: (id: string) => Exercice): CranGagne[] {
  if (seance.deload || seance.date < DEBUT_CRANS) return []
  const passees = avant.filter((s) => s.id !== seance.id && !s.enCours && s.debut < seance.debut)
  const ids = [...new Set(seance.series.map((x) => x.exoId))]
  return ids.flatMap((id) => cranDuJour(exo(id), historiqueDe(passees, id), seance.series.filter((x) => x.exoId === id)) ?? [])
}

/** « 60 kg × 11, +1 rep », « 35 kg, +5 kg ». */
export function texteCran(c: CranGagne, long = false): string {
  if (c.genre === 'reps') return `${chargeQte(c.exo, c.serie.charge, c.serie.reps, long)}, ${ecartQte(c.exo, c.serie.reps - c.ancien)}`
  const d = Math.round((c.serie.charge - c.ancien) * 100) / 100
  const ecart = c.exo.mode === 'elastique' ? '' : `, ${d > 0 ? '+' : '−'}${kg(Math.abs(d))} kg${c.exo.assistance ? ' d’assistance' : ''}`
  return chargeTexte(c.exo, c.serie.charge, long) + ecart
}

/** Sous le chrono, juste après la série : « ton record était 10 ». Court : la série faite est écrite juste dessous, et le cercle est étroit. */
export function pourquoiCran(c: CranGagne): string {
  if (c.genre === 'reps') return `ton record était ${c.ancien}${enTemps(c.exo) ? ' s' : ''}`
  return c.exo.assistance ? 'jamais fait avec si peu d’aide' : 'charge jamais faite'
}

/**
 * Ce qu'il faut faire à cette charge pour gagner le cran de l'exercice aujourd'hui : `reps` à atteindre, et le record
 * à cette charge quand elle a déjà été faite. Rien sans historique, si le cran du jour est déjà gagné, ou à une
 * charge plus légère jamais faite (aucun record possible).
 */
export function seuilCran(exo: Exercice, avant: Serie[][], faites: Serie[], charge: number): { reps: number; record?: number } | null {
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
