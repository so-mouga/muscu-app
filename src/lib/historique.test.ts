import { EXERCICES } from '../data/exercices'
import type { Seance, Serie } from '../types'
import { delies, relies, repere } from './equivalents'
import { bilan, creneauxFaits, creneauxRates, historiqueDe, meilleureSerie, mieuxParSeance, parSemaine, recordsParSeance, seanceSemaineAllegee } from './historique'

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

  it('records sans poids de corps : dips plus lourds = record ; déload ignoré', () => {
    const dip = (id: string, date: string, charge: number, reps: number, deload = false) =>
      ({ ...seance(id, date, [{ ...serie(charge, reps), exoId: 'dips' }]), deload }) as Seance
    const r = recordsParSeance([dip('a', '2026-10-26', 0, 9), dip('d', '2026-10-27', 10, 12, true), dip('b', '2026-10-28', 2, 10)], (id) => EXERCICES[id])
    expect(r).toEqual({ a: 0, d: 0, b: 1 })
  })

  it('en progrès : mieux que la fois d’avant, même sans record', () => {
    const d = seance('d', '2026-11-04', [serie(61, 8)])
    expect(mieuxParSeance([a, b, c, d], (id) => EXERCICES[id])).toEqual({ a: 0, b: 1, c: 0, d: 1 })
  })

  it('kg soulevés : les deux haltères, le lest seul au poids du corps', () => {
    const halteres = Object.values(EXERCICES).find((e) => e.mode === 'par_main')!
    const s = { ...seance('h', '2026-10-26', [{ ...serie(22.5, 8), exoId: halteres.id }, { ...serie(2, 10), exoId: 'dips' }]) }
    expect(bilan([s], {}, (id) => EXERCICES[id]).tonnage).toBe(22.5 * 8 * 2 + 2 * 10)
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

describe('équivalents', () => {
  it('lien dans les deux sens, retiré dans les deux sens', () => {
    const eq = relies({}, 'a', 'b')
    expect(eq).toEqual({ a: ['b'], b: ['a'] })
    expect(delies(eq, 'b', 'a')).toEqual({ a: [], b: [] })
  })
  it('repère : la meilleure série la plus récente d’un équivalent', () => {
    const s1 = seance('s1', '2026-10-20', [serie(55, 10)])
    const s2 = seance('s2', '2026-10-27', [serie(60, 8), serie(57.5, 10)])
    expect(repere('autre', relies({}, 'autre', exoId), [s2, s1])).toMatchObject({ exoId, charge: 60, reps: 8 })
    expect(repere('autre', {}, [s2])).toBeNull()
  })
})

describe('créneaux de la semaine', () => {
  const planning = [
    { id: 'A', jour: 1 },
    { id: 'B', jour: 2 },
    { id: 'A', jour: 4 },
  ]
  it('faite jeudi : coche le jeudi, pas le lundi', () => {
    expect([...creneauxFaits(planning, [{ id: 'A', jour: 4 }])]).toEqual([2])
  })
  it('faite en avance (dimanche → lundi suivant impossible) : le prochain créneau', () => {
    expect([...creneauxFaits(planning, [{ id: 'B', jour: 1 }])]).toEqual([1])
  })
  it('deux fois : les deux créneaux', () => {
    expect([...creneauxFaits(planning, [{ id: 'A', jour: 1 }, { id: 'A', jour: 3 }])].sort()).toEqual([0, 2])
  })
})

describe('audit historique', () => {
  it('records d’un exercice assisté sans poids noté : moins d’assistance = record', () => {
    const t = (charge: number): Serie => ({ id: String(charge), exoId: 'tractions', type: 'normale', charge, reps: 8, rpe: 8, heure: 0 })
    const s1 = seance('s1', '2026-10-01', [t(-20)])
    const s2 = seance('s2', '2026-10-08', [t(-15)])
    expect(recordsParSeance([s1, s2], (id) => EXERCICES[id])).toEqual({ s1: 0, s2: 1 })
  })

  it('poids du corps : le premier poids noté ne fait ni faux record ni référence impossible à battre', () => {
    const t = (id: string, charge: number, reps: number): Serie => ({ id, exoId: 'tractions', type: 'normale', charge, reps, rpe: 8, heure: 0 })
    const sans = seance('sans', '2026-10-01', [t('a', 5, 8)])
    const avec = { ...seance('avec', '2026-10-08', [t('b', 5, 8)]), poidsCorps: 80 }
    const plus = { ...seance('plus', '2026-10-15', [t('c', 5, 9)]), poidsCorps: 80 }
    expect(recordsParSeance([sans, avec, plus], (id) => EXERCICES[id])).toEqual({ sans: 0, avec: 0, plus: 1 })
  })

  it('« la dernière fois » ne prend jamais une séance de déload', () => {
    const normale = seance('n', '2026-10-01', [serie(60, 8)])
    const deload = { ...seance('d', '2026-10-08', [serie(52.5, 6, 6)]), deload: true }
    expect(historiqueDe([deload, normale], exoId)).toEqual([[serie(60, 8)]])
  })
})

describe('séances ratées de la semaine', () => {
  const planning = [{ jour: 1 }, { jour: 3 }, { jour: 5 }]
  const o = { jour: 3, lundi: '2026-11-02', premiere: '2026-10-01' }
  it('un créneau passé sans séance, ni celui du jour ni ceux à venir', () => {
    expect([...creneauxRates(planning, new Set(), o)]).toEqual([0])
    expect([...creneauxRates(planning, new Set(), { ...o, jour: 5 })]).toEqual([0, 1])
    expect([...creneauxRates(planning, new Set([0]), o)]).toEqual([])
    expect([...creneauxRates(planning, new Set(), { ...o, jour: 1 })]).toEqual([])
  })
  it('pas de faux « Pas faite » : programme tout neuf, lancé en milieu de semaine, ou semaine en pause', () => {
    expect([...creneauxRates(planning, new Set(), { ...o, premiere: undefined })]).toEqual([])
    // Lancé mercredi, 1re séance ce jour-là : lundi n'existait pas encore ; vendredi, mercredi non plus n'est pas ratée s'il a été fait.
    expect([...creneauxRates(planning, new Set([1]), { ...o, jour: 5, premiere: '2026-11-04' })]).toEqual([])
    expect([...creneauxRates(planning, new Set(), { ...o, pause: true })]).toEqual([])
  })
})

describe('semaine allégée ou séance seule', () => {
  it('distingue les deux', () => {
    expect(seanceSemaineAllegee({ deload: true })).toBe(true)
    expect(seanceSemaineAllegee({ deload: true, allegeeSeule: true })).toBe(false)
    expect(seanceSemaineAllegee({})).toBe(false)
  })
})
