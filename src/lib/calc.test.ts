import { PROGRAMME } from '../data/programme'
import type { Seance } from '../types'
import { e1rm, volumeParMuscle } from './calc'
import { EXERCICES } from '../data/exercices'

describe('volume hebdomadaire', () => {
  it('le programme préchargé correspond au tableau 5.7', () => {
    const semaine: Seance[] = PROGRAMME.filter((m) => m.jour).map((m) => ({
      id: m.id,
      date: '2026-11-02',
      nom: m.nom,
      debut: 0,
      enCours: false,
      chauffes: {},
      notes: {},
      ajustSeries: {},
      exercices: m.exercices,
      series: m.exercices.flatMap((p) =>
        p.series.map((s, i) => ({
          id: `${p.exoId}${i}`,
          exoId: p.exoId,
          type: p.finisseur && i === p.series.length - 1 ? ('serie_longue' as const) : ('normale' as const),
          charge: 10,
          reps: s.repsMin,
          rpe: s.rpe,
          heure: 0,
        }))
      ),
    }))
    expect(volumeParMuscle(semaine)).toEqual({
      pecs: 16,
      dos: 18,
      epaule_arriere: 5,
      epaule_laterale: 6,
      triceps: 9.5,
      biceps: 6,
      quadriceps: 5,
      ischios: 6,
      mollets: 3,
      abdos: 3,
    })
  })
})

describe('e1RM', () => {
  const serie = { id: '', exoId: '', type: 'normale' as const, heure: 0 }
  it('Epley corrigé par le RPE', () => {
    // 52,5 × 8 @8 → 10 reps jusqu'à l'échec → 52,5 × (1 + 10/30) = 70
    expect(e1rm(EXERCICES.smith_incline, { ...serie, charge: 52.5, reps: 8, rpe: 8 })).toBe(70)
  })
  it('pas d’e1RM sur l’isolation', () => {
    expect(e1rm(EXERCICES.butterfly, { ...serie, charge: 30, reps: 12, rpe: 8 })).toBeNull()
  })
  it('poids du corps : poids du jour + lest', () => {
    expect(e1rm(EXERCICES.tractions, { ...serie, charge: 0, reps: 10, rpe: 10 }, 70)).toBe(93.3)
  })
})
