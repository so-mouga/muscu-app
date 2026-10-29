import { EXERCICES } from '../data/exercices'
import type { Cycle } from '../types'
import { deloadMaintenant, etatCycle, lundiDe, mettreEnPause, planDeload, suggestionDeload } from './cycle'

const cycle = (x: Partial<Cycle> = {}): Cycle => ({
  id: 'c',
  programmeId: 'p',
  programme: { id: 'p', nom: 'P', seances: [] },
  modeles: [],
  debut: '2026-11-02',
  semaines: 6,
  deloads: [6],
  pauses: [],
  volume: {},
  ...x,
})

describe('semaine du cycle', () => {
  it('compte les semaines depuis le lundi de départ', () => {
    expect(etatCycle(cycle(), '2026-11-02').n).toBe(1)
    expect(etatCycle(cycle(), '2026-11-08').n).toBe(1)
    expect(etatCycle(cycle(), '2026-11-09').n).toBe(2)
    expect(etatCycle(cycle(), '2026-12-07')).toMatchObject({ n: 6, deload: true, fini: false })
    expect(etatCycle(cycle(), '2026-12-14').fini).toBe(true)
    expect(etatCycle(cycle(), '2026-10-30').n).toBe(0)
  })
  it('une semaine en pause décale la suite', () => {
    const c = mettreEnPause(cycle(), '2026-11-18')
    expect(etatCycle(c, '2026-11-18')).toMatchObject({ pause: true, deload: false })
    expect(etatCycle(c, '2026-11-23').n).toBe(3)
    expect(lundiDe(c, 3)).toBe('2026-11-23')
    expect(etatCycle(c, '2026-12-14')).toMatchObject({ n: 6, deload: true })
  })
  it('déload maintenant : la semaine devient un déload et la suite glisse', () => {
    const c = deloadMaintenant(cycle(), '2026-11-16')
    expect(c.semaines).toBe(7)
    expect(c.deloads).toEqual([3, 7])
    expect(etatCycle(c, '2026-11-16').deload).toBe(true)
  })
})

describe('déload', () => {
  it('moitié des séries, RPE 6-7, sans finisseur', () => {
    const p = planDeload({ exoId: 'x', repos: 120, series: [9, 9, 9, 10].map((rpe) => ({ repsMin: 8, repsMax: 12, rpe })), chauffes: [], finisseur: true, charge: 40 })
    expect(p.series.map((s) => s.rpe)).toEqual([7, 7])
    expect(p.finisseur).toBe(false)
  })
  it('charges −10 % arrondies au pas', () => {
    const s = suggestionDeload(EXERCICES.butterfly, { decision: 'pareil', charges: [50, 32.5, null], reps: [10, 10, 10], message: '' })
    expect(s.charges).toEqual([45, 30, null])
  })
})
