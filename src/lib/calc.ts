import { EXERCICES, MUSCLES } from '../data/exercices'
import type { Exercice, Muscle, Seance, Serie } from '../types'

export const RIR: Record<number, string> = {
  10: 'échec',
  9: '1 en réserve',
  8: '2 en réserve',
  7: '3 en réserve',
  6: '4 en réserve',
}

export const kg = (x: number | null | undefined) =>
  x === null || x === undefined ? '—' : x.toLocaleString('fr-FR', { maximumFractionDigits: 2 })

export function chargeTexte(exo: Exercice, charge: number | null | undefined): string {
  if (charge === null || charge === undefined) return 'à calibrer'
  if (exo.mode === 'poids_corps') return charge === 0 ? 'PDC' : `PDC ${charge > 0 ? '+' : '−'}${kg(Math.abs(charge))} kg`
  if (exo.mode === 'elastique') return `niveau ${charge}`
  if (exo.mode === 'par_main') return `${kg(charge)} kg/main`
  return `${kg(charge)} kg`
}

export function serieTexte(exo: Exercice, s: Serie): string {
  let t = `${chargeTexte(exo, s.charge)} × ${s.reps} @${kg(s.rpe)}`
  if (s.demiReps) t += ` + ${s.demiReps} demi-reps`
  return t
}

/** Epley corrigé par le RPE. Les demi-reps ne comptent jamais. */
export function e1rm(exo: Exercice, s: Serie, poidsCorps?: number): number | null {
  if (!exo.suivreE1rm || s.reps <= 0) return null
  let charge = s.charge
  if (exo.mode === 'poids_corps') {
    if (!poidsCorps) return null
    charge = poidsCorps + s.charge
  }
  const rtf = s.reps + (10 - s.rpe)
  return Math.round(charge * (1 + rtf / 30) * 10) / 10
}

export const estDure = (s: Serie) => s.rpe >= 7 || s.type === 'echec' || s.type === 'serie_longue'

export function dateISO(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const j = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${j}`
}

/** 1 = lundi … 7 = dimanche */
export const jourSemaine = (d = new Date()) => ((d.getDay() + 6) % 7) + 1

export function lundi(d = new Date()): string {
  const x = new Date(d)
  x.setDate(x.getDate() - (jourSemaine(d) - 1))
  return dateISO(x)
}

export function volumeParMuscle(seances: Seance[]): Record<Muscle, number> {
  const v = Object.fromEntries(MUSCLES.map((m) => [m.id, 0])) as Record<Muscle, number>
  for (const seance of seances)
    for (const s of seance.series) {
      const exo = EXERCICES[s.exoId]
      if (!exo || !estDure(s)) continue
      v[exo.muscle] += 1
      for (const sec of exo.secondaires ?? []) v[sec.muscle] += sec.coef
    }
  return v
}

export function duree(ms: number): string {
  const min = Math.round(ms / 60000)
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`
}

export function chrono(s: number): string {
  const a = Math.abs(Math.round(s))
  return `${s < 0 ? '+' : ''}${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}`
}

export const dateCourte = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
