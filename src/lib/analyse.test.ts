import { EXERCICES } from '../data/exercices'
import type { Seance } from '../types'
import { analyser, aRetenir } from './analyse'
import { cibles } from './cycle'

const seance = (id: string, date: string, smith: number[], extra: Partial<Seance> = {}): Seance =>
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
    series: [
      ...smith.map((c, i) => ({ id: id + 's' + i, exoId: 'smith_incline', type: 'normale' as const, charge: c, reps: 10, rpe: 8, heure: 0 })),
      { id: id + 't', exoId: 'tirage_large', type: 'normale' as const, charge: 60, reps: 10, rpe: 8, heure: 0 },
    ],
    ...extra,
  }) as Seance

const donnees = (seances: Seance[]) => ({
  seances,
  pesees: [
    { date: '2026-10-05', poids: 74 },
    { date: '2026-10-26', poids: 73.5 },
  ],
  mesures: [
    { date: '2026-10-05', valeurs: { taille: 85 } },
    { date: '2026-10-26', valeurs: { taille: 84 } },
  ],
  activites: [],
  exo: (id: string) => EXERCICES[id],
  exercices: EXERCICES,
  cibles: cibles(),
})

const seances = [
  seance('a', '2026-10-05', [50, 50]),
  seance('b', '2026-10-12', [52.5, 52.5]),
  seance('c', '2026-10-19', [55, 55]),
  seance('d', '2026-10-26', [57.5, 57.5]),
]

describe('analyse d’une période', () => {
  const a = analyser(donnees(seances), '2026-10-05', '2026-11-01', 2)
  it('assiduité, volume, records, progressions, stagnations', () => {
    expect(a.seances).toBe(4)
    expect(a.prevues).toBe(8)
    expect(a.enchainees).toBe(4)
    expect(a.volume.pecs).toBe(2)
    expect(a.records.map((r) => r.exo.id)).toEqual(['smith_incline', 'smith_incline', 'smith_incline'])
    expect(a.progressions[0].exo.id).toBe('smith_incline')
    expect(a.stagnations.map((s) => s.exo.id)).toEqual(['tirage_large'])
    expect(a.poids).toEqual({ debut: 74, fin: 73.5 })
  })
  it('à retenir : assiduité, muscles, stagnation, recompo, records', () => {
    const t = aRetenir(a, null, cibles()).join('\n')
    expect(t).toContain('4 séances sur 8 prévues')
    expect(t).toContain('aucune série dure')
    expect(t).toContain('Dos en retard : 1 série dure par semaine sur 18')
    expect(t).toContain('et 4 autres : aucune série dure')
    expect(t).toContain('Tirage poitrine prise large : mêmes charges')
    // 5 phrases au plus : la recompo et les records passent après
    expect(aRetenir(a, null, cibles()).length).toBeLessThanOrEqual(5)
  })
  it('peu de données : le dit au lieu d’inventer', () => {
    expect(aRetenir(analyser(donnees(seances.slice(0, 1)), '2026-10-05', '2026-10-11'), null, cibles())[0]).toContain('Pas encore assez')
  })
})
