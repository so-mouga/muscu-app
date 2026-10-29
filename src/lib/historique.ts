import type { Exercice, Seance, Serie } from '../types'
import { e1rm, enTemps, estDure, kgSouleves, lundi } from './calc'

export interface Bilan {
  seances: number
  /** ms */
  temps: number
  dures: number
  tonnage: number
  records: number
}

/** Durée d'une séance terminée (sans heure de fin : jusqu'à sa dernière série). */
export const dureeReelle = (s: Seance) => (s.fin ?? s.series.reduce((a, x) => Math.max(a, x.heure), s.debut)) - s.debut

/** Lundi (AAAA-MM-JJ) de la semaine d'une date AAAA-MM-JJ. */
export const semaineDe = (date: string) => lundi(new Date(date + 'T12:00:00'))

/**
 * Score de performance d'une série, pour comparer un exercice avec lui-même : le 1RM estimé quand
 * il existe, sinon le temps tenu (exercice en temps), sinon la charge puis les reps.
 */
export function scoreSerie(exo: Exercice, x: Serie, poidsCorps?: number): number {
  if (enTemps(exo)) return x.reps
  return e1rm(exo, x, poidsCorps) ?? x.charge * 1000 + x.reps
}

/**
 * Nombre d'exercices qui battent leur record par séance (voir `scoreSerie`). Le premier passage sur
 * un exercice ne compte pas : il n'y a encore rien à battre. Les déloads ne comptent jamais.
 */
export function recordsParSeance(seances: Seance[], exo: (id: string) => Exercice): Record<string, number> {
  const meilleur: Record<string, number> = {}
  const res: Record<string, number> = {}
  for (const s of [...seances].sort((a, b) => a.debut - b.debut)) {
    const duJour: Record<string, number> = {}
    res[s.id] = 0
    if (s.deload) continue
    for (const x of s.series) {
      if (x.reps <= 0) continue
      duJour[x.exoId] = Math.max(duJour[x.exoId] ?? 0, scoreSerie(exo(x.exoId), x, s.poidsCorps))
    }
    for (const [id, e] of Object.entries(duJour)) {
      if (meilleur[id] !== undefined && e > meilleur[id]) res[s.id]++
      meilleur[id] = Math.max(meilleur[id] ?? 0, e)
    }
  }
  return res
}

export function bilan(seances: Seance[], records: Record<string, number>, exo?: (id: string) => Exercice): Bilan {
  return {
    seances: seances.length,
    temps: seances.reduce((a, s) => a + dureeReelle(s), 0),
    dures: seances.reduce((a, s) => a + s.series.filter(estDure).length, 0),
    tonnage: seances.reduce((a, s) => a + s.series.reduce((b, x) => b + kgSouleves(x, exo?.(x.exoId)), 0), 0),
    records: seances.reduce((a, s) => a + (records[s.id] ?? 0), 0),
  }
}

/** Séances regroupées par semaine (lundi), de la plus récente à la plus ancienne. */
export function parSemaine(seances: Seance[]): { lundi: string; seances: Seance[] }[] {
  const groupes = new Map<string, Seance[]>()
  for (const s of [...seances].sort((a, b) => b.debut - a.debut)) {
    const l = semaineDe(s.date)
    groupes.set(l, [...(groupes.get(l) ?? []), s])
  }
  return [...groupes].map(([l, x]) => ({ lundi: l, seances: x }))
}

/** Meilleure série d'un exercice dans une séance : la plus lourde, puis le plus de reps. */
export function meilleureSerie(series: Serie[]): Serie | undefined {
  return series.reduce<Serie | undefined>((a, s) => (!a || s.charge > a.charge || (s.charge === a.charge && s.reps > a.reps) ? s : a), undefined)
}

/**
 * Créneaux du planning faits cette semaine (indices dans `planning`). Une séance faite coche le
 * créneau de la même séance le plus proche avant son jour, sinon le prochain : faite jeudi, elle
 * coche le créneau du jeudi, pas celui du lundi.
 */
export function creneauxFaits(planning: { id: string; jour: number }[], faites: { id: string; jour: number }[]): Set<number> {
  const pris = new Set<number>()
  for (const f of [...faites].sort((a, b) => a.jour - b.jour)) {
    const libres = planning.map((p, i) => ({ ...p, i })).filter((p) => p.id === f.id && !pris.has(p.i))
    const avant = libres.filter((p) => p.jour <= f.jour).sort((a, b) => b.jour - a.jour)[0]
    const apres = libres.filter((p) => p.jour > f.jour).sort((a, b) => a.jour - b.jour)[0]
    const c = avant ?? apres
    if (c) pris.add(c.i)
  }
  return pris
}
