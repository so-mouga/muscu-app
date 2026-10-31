import { EXERCICES } from '../data/exercices'
import type { Seance } from '../types'
import { debutPeriode, genererBilan } from './bilan'
import { cibles } from './cycle'

const seance = (id: string, date: string, charges: number[], extra: Partial<Seance> = {}): Seance =>
  ({
    id,
    date,
    nom: 'Haut A',
    debut: Date.parse(date + 'T10:00:00'),
    fin: Date.parse(date + 'T11:00:00'),
    enCours: false,
    exercices: [],
    chauffes: {},
    notes: {},
    ajustSeries: {},
    series: charges.map((c, i) => ({ id: id + i, exoId: 'smith_incline', type: 'normale', charge: c, reps: 10, rpe: 8, heure: 0 })),
    ...extra,
  }) as Seance

const donnees = (seances: Seance[]) => ({
  seances,
  pesees: [
    { date: '2026-10-20', poids: 74 },
    { date: '2026-10-27', poids: 73.4 },
  ],
  mesures: [],
  activites: [{ id: 'a', date: '2026-10-22', type: 'padel', duree: 90, intensite: 7 }],
  exo: (id: string) => EXERCICES[id],
  exercices: EXERCICES,
  cibles: cibles(),
  programme: 'Recompo 4 jours',
})

describe('bilan à partager', () => {
  it('période : les N dernières semaines, semaine en cours comprise', () => {
    expect(debutPeriode(2, '2026-10-29')).toBe('2026-10-19')
  })
  it('contient vue d’ensemble, volume par muscle, exercices, corps et autres sports', () => {
    const t = genererBilan(donnees([seance('s1', '2026-10-20', [50, 50, 50], { ressenti: 4, notes: { smith_incline: 'Siège cran 4' } }), seance('s2', '2026-10-27', [52.5, 52.5, 52.5])]), '2026-10-19', '2026-10-29')
    expect(t).toContain('2 séances')
    expect(t).toContain('Pecs : 3/sem. (objectif 10) · RPE moyen 8 · par semaine : 3 / 3')
    expect(t).toContain('Développé incliné Smith (pecs)')
    expect(t).toContain('50 kg × 10 @8')
    expect(t).toContain('1RM estimé : 70 → 73,5 kg (+5 %)')
    expect(t).toContain('(2 semaines)')
    expect(t).toContain('Poids moyen par semaine : 74 / 73,4 kg (−0,6 kg)')
    expect(t).toContain('Padel, 1 h 30, intensité 7/10')
    expect(t).toContain('Siège cran 4')
  })
  it('sans séance : le dit simplement', () => {
    expect(genererBilan(donnees([]), '2026-10-19', '2026-10-29')).toContain('Aucune séance sur la période.')
  })

  it('donne la phase de la période, pour qu’on sache comment lire les perfs', () => {
    const objectifs = [
      { depuis: '2026-09-01', phase: 'prise' as const, volume: {} },
      { depuis: '2026-10-22', phase: 'seche' as const, finPrevue: '2027-01-14', volume: {} },
    ]
    const t = genererBilan({ ...donnees([seance('s1', '2026-10-20', [50, 50, 50])]), objectifs }, '2026-10-19', '2026-10-29')
    expect(t).toMatch(/Phase : Sèche depuis le .*22 oct.* \(semaine 2 sur 12, fin prévue/)
    expect(t).toMatch(/Phase précédente pendant la période : prise de muscle du .* au .*21 oct/)
  })
})
