import { EXERCICES } from '../data/exercices'
import type { Cycle } from '../types'
import { cibles, deloadMaintenant, prevuLe, etatCycle, lundiDe, mettreEnPause, nouveauCycle, planDeload, suggestionDeload } from './cycle'

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

describe('objectifs de volume', () => {
  it('personnels ; avant tout réglage, ceux du cycle ou du programme actif', () => {
    const p = { id: 'p', nom: 'P', seances: [], volume: { pecs: 12, dos: 14 } }
    const c = nouveauCycle('c', p, () => undefined, '2026-11-02')
    expect(cibles({ pecs: 10 }, c, p)).toMatchObject({ pecs: 10, dos: 0 })
    expect(cibles(undefined, c).pecs).toBe(12)
    expect(cibles(undefined, undefined, p).biceps).toBe(0)
    // Rien de réglé nulle part : valeurs par défaut de l'appli
    expect(cibles(undefined, undefined, { id: 'q', nom: 'Q', seances: [] }).pecs).toBe(16)
  })
})

describe('prévu un jour donné', () => {
  const m = { id: 'a', nom: 'Haut A', sousTitre: '', exercices: [] }
  const planning = [{ modele: m, jour: 1 }]
  const c = nouveauCycle('c', { id: 'p', nom: 'P', seances: [] }, () => undefined, '2026-11-02', 6, [6])

  it('séance du lundi, semaine du cycle et déload', () => {
    expect(prevuLe(planning, c, '2026-11-02')).toMatchObject({ seances: [m], semaine: 1, total: 6, deload: false })
    expect(prevuLe(planning, c, '2026-12-07')).toMatchObject({ seances: [m], semaine: 6, deload: true })
    expect(prevuLe(planning, c, '2026-11-03').seances).toEqual([])
  })

  it('rien avant ni après le cycle ; sans cycle, le planning du programme', () => {
    expect(prevuLe(planning, c, '2026-10-26').seances).toEqual([])
    expect(prevuLe(planning, c, '2026-12-14').seances).toEqual([])
    expect(prevuLe(planning, undefined, '2027-03-01').seances).toEqual([m])
  })
})
