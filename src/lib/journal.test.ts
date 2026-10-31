import { EXERCICES } from '../data/exercices'
import type { Seance } from '../types'
import { conseilRepas, meilleureProgression } from './journal'

const s = (id: string, date: string, exoId: string, charge: number, reps: number, deload = false): Seance =>
  ({ id, date, debut: Date.parse(date + 'T10:00:00'), series: [{ id, exoId, type: 'normale', charge, reps, rpe: 8, heure: 0 }], exercices: [], chauffes: {}, notes: {}, ajustSeries: {}, enCours: false, nom: id, deload }) as Seance

describe('journal du matin', () => {
  const exo = (id: string) => EXERCICES[id]
  it('progression depuis le début de la phase, face à la dernière séance d’avant', () => {
    const l = [s('a', '2026-10-20', 'butterfly', 30, 12), s('b', '2026-11-03', 'butterfly', 30, 13), s('c', '2026-11-10', 'butterfly', 32.5, 12), s('d', '2026-11-12', 'butterfly', 20, 12, true)]
    const r = meilleureProgression(l, exo, '2026-11-01')
    expect(r?.exo.id).toBe('butterfly')
    expect(r!.pct).toBeGreaterThan(5)
    expect(meilleureProgression(l, exo, '2026-11-20')).toBeNull()
  })
  it('conseil d’assiette selon la phase', () => {
    expect(conseilRepas('prise', true)).toMatch(/un peu plus/)
    expect(conseilRepas(undefined, true)).toBeNull()
  })
})
