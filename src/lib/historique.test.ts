import { EXERCICES } from '../data/exercices'
import type { Seance, Serie } from '../types'
import { bilan, meilleureSerie, parSemaine, recordsParSeance } from './historique'

const exoId = Object.values(EXERCICES).find((e) => e.suivreE1rm && e.mode !== 'poids_corps')!.id
const serie = (charge: number, reps: number, rpe = 8): Serie => ({ id: `${charge}-${reps}`, exoId, type: 'normale', charge, reps, rpe, heure: 0 })
const seance = (id: string, date: string, series: Serie[]): Seance =>
  ({ id, date, debut: Date.parse(date + 'T10:00:00'), fin: Date.parse(date + 'T11:00:00'), series, exercices: [], chauffes: {}, notes: {}, ajustSeries: {}, enCours: false, nom: id }) as Seance

describe('historique', () => {
  const a = seance('a', '2026-10-26', [serie(60, 8)])
  const b = seance('b', '2026-10-28', [serie(62.5, 8), serie(60, 6, 6)])
  const c = seance('c', '2026-11-02', [serie(60, 8)])

  it('records : le premier passage ne compte pas, un e1RM battu compte une fois', () => {
    expect(recordsParSeance([c, a, b], (id) => EXERCICES[id])).toEqual({ a: 0, b: 1, c: 0 })
  })

  it('bilan de semaine', () => {
    const r = recordsParSeance([a, b], (id) => EXERCICES[id])
    expect(bilan([a, b], r)).toEqual({ seances: 2, temps: 7200000, dures: 2, tonnage: 60 * 8 + 62.5 * 8 + 60 * 6, records: 1 })
  })

  it('regroupe par semaine, la plus récente en premier', () => {
    expect(parSemaine([a, c, b]).map((g) => [g.lundi, g.seances.map((s) => s.id)])).toEqual([
      ['2026-11-02', ['c']],
      ['2026-10-26', ['b', 'a']],
    ])
  })

  it('meilleure série : la plus lourde', () => {
    expect(meilleureSerie(b.series)?.charge).toBe(62.5)
  })
})
