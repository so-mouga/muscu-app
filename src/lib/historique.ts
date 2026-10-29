import type { Exercice, Seance, Serie } from '../types'
import { e1rm, estDure, lundi } from './calc'

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
 * Nombre d'exercices qui battent leur record d'e1RM, par séance. Le premier passage sur un
 * exercice ne compte pas : il n'y a encore rien à battre.
 */
export function recordsParSeance(seances: Seance[], exo: (id: string) => Exercice): Record<string, number> {
  const meilleur: Record<string, number> = {}
  const res: Record<string, number> = {}
  for (const s of [...seances].sort((a, b) => a.debut - b.debut)) {
    const duJour: Record<string, number> = {}
    for (const x of s.series) {
      const e = e1rm(exo(x.exoId), x, s.poidsCorps)
      if (e) duJour[x.exoId] = Math.max(duJour[x.exoId] ?? 0, e)
    }
    res[s.id] = 0
    for (const [id, e] of Object.entries(duJour)) {
      if (meilleur[id] !== undefined && e > meilleur[id]) res[s.id]++
      meilleur[id] = Math.max(meilleur[id] ?? 0, e)
    }
  }
  return res
}

export function bilan(seances: Seance[], records: Record<string, number>): Bilan {
  return {
    seances: seances.length,
    temps: seances.reduce((a, s) => a + dureeReelle(s), 0),
    dures: seances.reduce((a, s) => a + s.series.filter(estDure).length, 0),
    tonnage: seances.reduce((a, s) => a + s.series.reduce((b, x) => b + x.charge * x.reps, 0), 0),
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
