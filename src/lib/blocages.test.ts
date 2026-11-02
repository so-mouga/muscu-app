import { EXERCICES } from '../data/exercices'
import type { Seance } from '../types'
import { blocage, deloadConseille, diagnostic, pistes, texteBlocage } from './blocages'

type S = [exoId: string, charge: number, reps: number, rpe: number]
const seance = (date: string, series: S[], extra: Partial<Seance> = {}): Seance =>
  ({
    id: date,
    date,
    nom: 'Haut A',
    debut: Date.parse(date + 'T10:00:00'),
    enCours: false,
    exercices: [],
    chauffes: {},
    notes: {},
    ajustSeries: {},
    series: series.map(([exoId, charge, reps, rpe], i) => ({ id: date + i, exoId, type: 'normale' as const, charge, reps, rpe, heure: 0 })),
    ...extra,
  }) as Seance
const DATES = ['2026-10-01', '2026-10-08', '2026-10-15', '2026-10-22', '2026-10-29']
const FIN = '2026-10-31'
const smith = EXERCICES.smith_incline
const butterfly = EXERCICES.butterfly
const exo = (id: string) => EXERCICES[id]

describe('blocage', () => {
  it('mêmes perfs depuis 4 semaines : bloqué', () => {
    const l = DATES.map((d) => seance(d, [['smith_incline', 52.5, 8, 8]]))
    expect(blocage(smith, l, FIN)).toEqual({ semaines: 4, seances: 4, depuis: '2026-10-01' })
  })
  it('même charge mais RPE qui baisse : c’est un progrès', () => {
    const l = DATES.map((d, i) => seance(d, [['smith_incline', 52.5, 8, [9, 9, 9, 8, 7][i]]]))
    expect(blocage(smith, l, FIN)).toBeNull()
  })
  it('isolation : une rep de plus compte', () => {
    const l = DATES.map((d, i) => seance(d, [['butterfly', 30, [12, 12, 13, 13, 13][i], 8]]))
    expect(blocage(butterfly, l, FIN)).toBeNull()
    expect(blocage(butterfly, DATES.map((d) => seance(d, [['butterfly', 30, 12, 8]])), FIN)?.semaines).toBe(4)
  })
  it('trop peu de séances, exercice abandonné ou déloads : rien', () => {
    expect(blocage(smith, DATES.slice(0, 3).map((d) => seance(d, [['smith_incline', 52.5, 8, 8]])), FIN)).toBeNull()
    expect(blocage(smith, DATES.map((d) => seance(d, [['smith_incline', 52.5, 8, 8]])), '2026-11-20')).toBeNull()
    const avecDeloads = DATES.map((d, i) => seance(d, [['smith_incline', i >= 3 ? 47.5 : 52.5, 8, 8]], { deload: i >= 3 }))
    expect(blocage(smith, avecDeloads, FIN)).toBeNull()
  })
  it('en sèche, garder ses charges n’est pas un blocage', () => {
    const l = DATES.map((d) => seance(d, [['smith_incline', 52.5, 8, 8]]))
    expect(diagnostic(smith, { seances: l, phase: 'seche' }, FIN)).toBeNull()
    expect(diagnostic(smith, { seances: l, phase: 'prise' }, FIN)).not.toBeNull()
  })
})

describe('pistes', () => {
  const l = DATES.map((d) => seance(d, [['smith_incline', 52.5, 8, 9.5]]))
  it('sommeil, calories, poids et RPE, chiffres à l’appui', () => {
    const journal = ['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14'].map((date, i) => ({ date, sommeil: 5, calories: i < 3 ? ('pasAssez' as const) : ('ok' as const) }))
    const pesees = [
      { date: '2026-10-02', poids: 75 },
      { date: '2026-10-30', poids: 75.1 },
    ]
    const p = pistes(smith, '2026-10-01', FIN, { seances: l, journal, pesees, phase: 'prise' })
    expect(p).toEqual(['sommeil moyen 5 h 00', 'calories sous l’objectif 3 jours sur 5', 'poids qui ne monte pas (+0,03 kg par semaine)', 'séries déjà très dures (RPE moyen 9,5)'])
    expect(texteBlocage({ semaines: 4, seances: 4, depuis: '2026-10-01', pistes: p })).toMatch(/^Pas de progrès depuis 4 semaines \(4 séances\)\. Pistes : sommeil moyen 5 h 00/)
  })
  it('rien quand la donnée manque ; pas de déload depuis plus de 6 semaines', () => {
    expect(pistes(smith, '2026-10-01', FIN, { seances: l.map((s) => ({ ...s, series: s.series.map((x) => ({ ...x, rpe: 8 })) })) })).toEqual([])
    const long = [seance('2026-09-01', [['smith_incline', 50, 8, 8]]), ...l]
    expect(pistes(smith, '2026-10-01', FIN, { seances: long })).toContain('pas de déload depuis 8 semaines')
  })
})

describe('déload conseillé', () => {
  const dates = ['2026-10-20', '2026-10-24', '2026-10-28']
  const l = (energie?: number) =>
    dates.map((d, i) =>
      seance(
        d,
        [
          ['smith_incline', i === 2 ? 47.5 : 52.5, 8, 8],
          ['tirage_large', i === 2 ? 55 : 60, 10, 8],
        ],
        i > 0 && energie ? { energie } : {}
      )
    )
  it('force en baisse sur 2 exercices et énergie basse', () => {
    const r = deloadConseille(l(2), exo, FIN)
    expect(r?.baisses.map((e) => e.id)).toEqual(['smith_incline', 'tirage_large'])
    expect(r?.energieBasse).toBe(true)
  })
  it('sans énergie basse, 2 exercices ne suffisent pas ; jamais juste après un déload', () => {
    expect(deloadConseille(l(4), exo, FIN)).toBeNull()
    expect(deloadConseille([seance('2026-10-15', [], { deload: true }), ...l(2)], exo, FIN)).toBeNull()
  })
})

describe('audit blocages', () => {
  it('petits progrès réguliers (+0,6 % par séance, +2,4 % en tout) : pas bloqué', () => {
    const l = DATES.map((d, i) => seance(d, [['smith_incline', 50 * (1 + 0.006 * i), 8, 8]]))
    expect(blocage(smith, l, FIN)).toBeNull()
  })

  it('sommeil moyen juste sous 6 h : arrondi à « 6 h 00 », jamais « 5 h 60 »', () => {
    const journal = Array.from({ length: 121 }, (_, i) => ({ date: new Date(Date.parse('2026-06-30T12:00:00') + i * 86400000).toISOString().slice(0, 10), sommeil: i ? 6 : 5 }))
    const p = pistes(smith, '2026-06-29', '2026-10-31', { seances: [], journal })
    expect(p[0]).toBe('sommeil moyen 6 h 00')
  })
})

describe('audit déload conseillé', () => {
  it('énergie basse lue sur les 10 derniers jours seulement, pas sur des séances anciennes', () => {
    const recentes = ['2026-10-24', '2026-10-26', '2026-10-28'].map((d, i) =>
      seance(d, [
        ['smith_incline', i === 2 ? 47.5 : 52.5, 8, 8],
        ['tirage_large', i === 2 ? 55 : 60, 10, 8],
      ])
    )
    const anciennes = ['2026-10-05', '2026-10-08'].map((d) => seance(d, [], { energie: 1 }))
    expect(deloadConseille([...anciennes, ...recentes], exo, FIN)).toBeNull()
  })
})

describe('sensations à 3 choix (Difficile = 1, Bien = 3, Au top = 5)', () => {
  it('« Difficile » compte comme énergie basse pour avancer le déload, « Bien » non', () => {
    const l = (energie: number) =>
      ['2026-10-24', '2026-10-26', '2026-10-28'].map((d, i) =>
        seance(d, [['smith_incline', i === 2 ? 47.5 : 52.5, 8, 8], ['tirage_large', i === 2 ? 55 : 60, 10, 8]], i > 0 ? { energie } : {})
      )
    expect(deloadConseille(l(1), exo, FIN)?.energieBasse).toBe(true)
    expect(deloadConseille(l(3), exo, FIN)).toBeNull()
    expect(deloadConseille(l(5), exo, FIN)).toBeNull()
  })
})
