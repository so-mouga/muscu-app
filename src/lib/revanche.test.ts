import { EXERCICES } from '../data/exercices'
import type { ExoPlan, Serie } from '../types'
import { revanche, revanchePrise } from './revanche'

const exo = Object.values(EXERCICES).find((e) => e.mode === 'machine' && !e.assistance && e.mesure !== 'temps')!
let k = 0
const s = (charge: number, reps: number, type: Serie['type'] = 'normale'): Serie => ({ id: `s${k++}`, exoId: exo.id, type, charge, reps, rpe: 8, heure: 0 })
const plan = { exoId: exo.id, repos: 120, series: [1, 2, 3].map(() => ({ repsMin: 8, repsMax: 12, rpe: 8 })), charge: null, chauffes: [], finisseur: false } as ExoPlan

describe('revanche', () => {
  it('reps : la série ratée la dernière fois, à la même charge, vise le bas', () => {
    const histo = [[s(50, 9), s(50, 8), s(50, 6)]]
    expect(revanche(exo, plan, histo, 2, 50)).toEqual({ genre: 'reps', avant: 6, vise: 8 })
    expect(revanche(exo, plan, histo, 0, 50)).toBeNull()
  })
  it('reps : rien si la charge du jour a changé, ni sans historique, ni sans charge connue', () => {
    const histo = [[s(50, 6)]]
    expect(revanche(exo, plan, histo, 0, 47.5)).toBeNull()
    expect(revanche(exo, plan, [], 0, 50)).toBeNull()
    expect(revanche(exo, plan, histo, 0, null)).toBeNull()
  })
  it('charge : on remonte à une charge ratée, après une séance plus légère', () => {
    const histo = [[s(57.5, 10), s(57.5, 9)], [s(60, 6), s(60, 5)]]
    expect(revanche(exo, plan, histo, 0, 60)).toEqual({ genre: 'charge', avant: 57.5, vise: 60 })
    expect(revanche(exo, plan, histo, 1, 60)).toBeNull()
  })
  it('charge : un programme qui alterne lourd et léger sans rater n’est pas une revanche', () => {
    const histo = [[s(50, 12)], [s(60, 9)]]
    expect(revanche(exo, plan, histo, 0, 60)).toBeNull()
  })
  it('charge jamais faite : pas une revanche (c’est un record)', () => {
    expect(revanche(exo, plan, [[s(57.5, 10)]], 0, 60)).toBeNull()
  })
  it('jamais sur un finisseur', () => {
    const fin = { ...plan, finisseur: true } as ExoPlan
    expect(revanche(exo, fin, [[s(50, 9), s(50, 8), s(50, 6)]], 2, 50)).toBeNull()
  })
  it('revanche prise : le bas atteint ; pour une charge, la charge retrouvée avec au moins le bas', () => {
    expect(revanchePrise({ genre: 'reps', avant: 6, vise: 8 }, plan, 2, s(50, 8))).toBe(true)
    expect(revanchePrise({ genre: 'reps', avant: 6, vise: 8 }, plan, 2, s(50, 7))).toBe(false)
    expect(revanchePrise({ genre: 'charge', avant: 57.5, vise: 60 }, plan, 0, s(60, 8))).toBe(true)
    expect(revanchePrise({ genre: 'charge', avant: 57.5, vise: 60 }, plan, 0, s(60, 6))).toBe(false)
  })
})
