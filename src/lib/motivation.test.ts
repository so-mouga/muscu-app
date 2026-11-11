import { EXERCICES } from '../data/exercices'
import type { Cycle, Seance } from '../types'
import { depuisDebut, exercicesDuBloc, faitesSurPrevues, gainsDeSeance, joursSansSeance, resumeSeance, seuilSemaine, semainesTenues, suiviCycle, tenuesSurPeriode } from './motivation'
import { nouveauCycle } from './cycle'

type S = [exoId: string, charge: number, reps: number, rpe?: number]
const seance = (id: string, date: string, series: S[], extra: Partial<Seance> = {}): Seance =>
  ({
    id,
    date,
    nom: 'Haut A',
    debut: Date.parse(date + 'T18:00:00'),
    enCours: false,
    exercices: [],
    chauffes: {},
    notes: {},
    ajustSeries: {},
    series: series.map(([exoId, charge, reps, rpe = 8], i) => ({ id: id + i, exoId, type: 'normale' as const, charge, reps, rpe, heure: 0 })),
    ...extra,
  }) as Seance
const exo = (id: string) => EXERCICES[id]

describe('semaines tenues après un changement de programme', () => {
  const s = (date: string) => ({ id: date, date, enCours: false, series: [] }) as unknown as Seance
  it('passer de 2 à 4 séances ne casse pas la série : chaque semaine garde son prévu', () => {
    const faites = ['2026-10-05', '2026-10-08', '2026-10-12', '2026-10-15', '2026-10-19', '2026-10-22'].map(s)
    expect(semainesTenues(faites, 4, [], '2026-10-26')).toBe(0)
    expect(semainesTenues(faites, (l) => (l >= '2026-10-26' ? 4 : 2), [], '2026-10-26')).toBe(3)
  })
})

describe('semaines tenues de suite', () => {
  // Semaines du lundi 5 oct. au lundi 26 oct. 2026 ; 4 séances prévues par semaine, tenue à 3.
  const semaine = (lundi: number, n: number) => Array.from({ length: n }, (_, i) => seance(`s${lundi}-${i}`, `2026-10-${String(lundi + i).padStart(2, '0')}`, []))
  const auj = '2026-10-28' // mercredi de la semaine du 26

  it('compte les semaines à 3 séances sur 4 ou plus, jusqu’à la première qui manque', () => {
    const l = [...semaine(5, 4), ...semaine(12, 2), ...semaine(19, 3)]
    // Semaine en cours (26 oct.) pas encore tenue : elle ne casse pas la série.
    expect(semainesTenues(l, 4, [], auj)).toBe(1)
    expect(semainesTenues([...l, ...semaine(26, 3)], 4, [], auj)).toBe(2)
  })
  it('une semaine de déload ou en pause ne casse pas la série', () => {
    const l = [...semaine(5, 4), ...semaine(19, 3)]
    const cycle = { id: 'c', debut: '2026-10-05', semaines: 6, deloads: [2], pauses: [], programme: { nom: 'P' } } as unknown as Cycle
    expect(semainesTenues(l, 4, [cycle], auj)).toBe(2)
    expect(semainesTenues(l, 4, [{ ...cycle, deloads: [], pauses: ['2026-10-12'] }], auj)).toBe(2)
    expect(semainesTenues(l, 4, [], auj)).toBe(1)
  })
  it('3 séances prévues : 2 suffisent (une séance manquée ne casse pas la série)', () => {
    expect(semainesTenues([...semaine(5, 2), ...semaine(12, 2), ...semaine(19, 2)], 3, [], auj)).toBe(3)
    expect(seuilSemaine(3)).toBe(2)
    expect(seuilSemaine(4)).toBe(3)
    expect(seuilSemaine(2)).toBe(2)
  })
  it('sans planning ni séance : 0', () => {
    expect(semainesTenues(semaine(19, 3), 0, [], auj)).toBe(0)
    expect(semainesTenues([], 4, [], auj)).toBe(0)
  })
})

describe('depuis le début du bloc', () => {
  const l = [
    seance('a', '2026-09-28', [['smith_incline', 40, 10]]), // avant le bloc
    seance('b', '2026-10-05', [['smith_incline', 45, 10], ['tirage_large', 60, 10], ['butterfly', 30, 12]]),
    seance('c', '2026-10-12', [['smith_incline', 50, 9], ['tirage_large', 60, 10]]),
    seance('d', '2026-10-19', [['smith_incline', 52.5, 8], ['tirage_large', 57.5, 10], ['butterfly', 35, 12]], { deload: false }),
    seance('e', '2026-10-26', [['smith_incline', 30, 10]], { deload: true }),
  ]
  const r = depuisDebut(l, exo, '2026-10-05')

  it('meilleure série de la 1re séance du bloc face à la dernière, déloads exclus', () => {
    expect(r[0]).toMatchObject({ exo: { id: 'smith_incline' }, avant: { charge: 45, reps: 10 }, apres: { charge: 52.5, reps: 8 } })
  })
  it('mêmes charge et reps avec un effort plus facile : pas un progrès du bloc', () => {
    expect(depuisDebut([seance('a', '2026-09-28', [['smith_incline', 75, 10, 8]]), seance('b', '2026-10-05', [['smith_incline', 75, 10, 6]])], exo, '2026-09-28')).toEqual([])
  })
  it('charge montée, reps reparties au bas et effort plus dur : un progrès du bloc', () => {
    const [p] = depuisDebut([seance('a', '2026-09-28', [['smith_incline', 60, 12, 8]]), seance('b', '2026-10-05', [['smith_incline', 62.5, 8, 9]])], exo, '2026-09-28')
    expect([p.avant.charge, p.apres.charge]).toEqual([60, 62.5])
  })
  it('seulement les exercices composés qui ont progressé, 3 au plus', () => {
    // Tirage en baisse : rien ; butterfly (isolation) : pas un exercice principal.
    expect(r.map((x) => x.exo.id)).toEqual(['smith_incline'])
  })
  it('il faut deux séances dans le bloc', () => {
    expect(depuisDebut(l, exo, '2026-10-19')).toEqual([])
  })
})

describe('résumé de fin de séance', () => {
  it('exercices mieux que la dernière fois, et records', () => {
    const avant = [seance('a', '2026-10-05', [['smith_incline', 50, 8], ['tirage_large', 60, 10]]), seance('b', '2026-10-12', [['smith_incline', 52.5, 8], ['tirage_large', 62.5, 10]])]
    const auj = seance('c', '2026-10-19', [['smith_incline', 52.5, 9], ['tirage_large', 60, 10]])
    // Smith : mieux que la dernière fois et record ; tirage : moins bien.
    expect(resumeSeance(auj, avant, exo)).toEqual({ mieux: 1, records: 1 })
  })
})

describe('retour après une pause', () => {
  it('jours depuis la dernière séance terminée', () => {
    const l = [seance('a', '2026-10-05', []), seance('b', '2026-10-17', []), seance('c', '2026-10-28', [], { enCours: true })]
    expect(joursSansSeance(l, '2026-10-29')).toBe(12)
    expect(joursSansSeance([], '2026-10-29')).toBeNull()
  })
})

describe('suivi du cycle', () => {
  const m = (id: string) => ({ id, nom: id, sousTitre: '', exercices: [] })
  const prog = { id: 'p', nom: 'P', seances: ['a', 'b', 'c', 'd'].map((modeleId, i) => ({ modeleId, jour: i + 1 })) }
  const faite = (id: string, date: string, cycleId = 'c') => ({ id, date, nom: id, debut: Date.parse(date + 'T18:00:00'), enCours: false, exercices: [], chauffes: {}, notes: {}, ajustSeries: {}, series: [], cycleId })

  it('tenue dès les trois quarts, manquée sinon, déload tenu avec une séance, pause et semaines à venir', () => {
    const c = { ...nouveauCycle('c', prog, m, '2026-10-05', 6, [2, 6]), pauses: ['2026-10-26'] }
    const seances = [faite('1', '2026-10-05'), faite('2', '2026-10-06'), faite('3', '2026-10-07'), faite('4', '2026-10-12'), faite('5', '2026-10-19'), faite('6', '2026-11-03'), faite('x', '2026-11-03', 'autre')]
    const r = suiviCycle(c, seances as never, '2026-11-04')
    expect(r.semaines.map((x) => x.etat)).toEqual(['tenue', 'tenue', 'manquee', 'pause', 'courante', 'avenir', 'allegee'])
    expect(r).toMatchObject({ prevues: 4, faites: 6, tenues: 2, cetteSemaine: 1 })
  })

  it('ajouter une séance au programme en cours de cycle ne rend pas « manquées » les semaines passées', () => {
    const c = nouveauCycle('c', prog, m, '2026-10-05', 6, [])
    const seances = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-12', '2026-10-13', '2026-10-14'].map((d, i) => faite(String(i), d))
    // Le cycle suit le programme aussitôt : sa copie a maintenant 5 séances par semaine, depuis le 20 oct.
    const a5 = { ...c, programme: { ...c.programme, seances: [...c.programme.seances, { modeleId: 'e', jour: 5 }] } }
    const prevus = [{ depuis: '2026-10-05', n: 4 }, { depuis: '2026-10-20', n: 5 }]
    const r = suiviCycle(a5, seances as never, '2026-11-04', prevus)
    expect(r.semaines.slice(0, 3).map((x) => [x.etat, x.prevues])).toEqual([['tenue', 4], ['tenue', 4], ['manquee', 5]])
    expect(r.prevues).toBe(5)
    // Même réponse que l'Accueil.
    expect(semainesTenues(seances as never, (l) => (l >= '2026-10-19' ? 5 : 4), [a5], '2026-10-18')).toBe(2)
  })

  it('une semaine allégée est jugée pareil partout : tenue avec une séance, ni tenue ni manquée sans', () => {
    const c = nouveauCycle('c', prog, m, '2026-10-05', 3, [3])
    const deux = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-12', '2026-10-13', '2026-10-14'].map((d, i) => faite(String(i), d))
    const sans = suiviCycle(c, deux as never, '2026-10-27')
    expect(sans.semaines.map((x) => x.etat)).toEqual(['tenue', 'tenue', 'allegee'])
    expect(semainesTenues(deux as never, 4, [c], '2026-10-27')).toBe(sans.tenues)
    expect(tenuesSurPeriode(deux as never, 4, [c], '2026-10-05', '2026-10-25')).toEqual({ n: 2, sur: 2 })
    const avec = [...deux, faite('d', '2026-10-20')]
    const r = suiviCycle(c, avec as never, '2026-10-27')
    expect(r.semaines.map((x) => x.etat)).toEqual(['tenue', 'tenue', 'tenue'])
    expect(semainesTenues(avec as never, 4, [c], '2026-10-27')).toBe(r.tenues)
    expect(tenuesSurPeriode(avec as never, 4, [c], '2026-10-05', '2026-10-25')).toEqual({ n: 3, sur: 3 })
  })

  it('« 3 sur 4 » : les séances libres comptent, sans dépasser le prévu', () => {
    expect(faitesSurPrevues(3, 4)).toBe(3)
    expect(faitesSurPrevues(6, 4)).toBe(4)
  })
})

describe('exercices du bloc', () => {
  const ids = Object.keys(EXERCICES).slice(0, 4)
  const exo = (id: string) => EXERCICES[id]
  it('classe chaque exercice, ce qui baisse compris ; un déload ne compte pas', () => {
    const r = exercicesDuBloc(
      [
        seance('1', '2026-10-05', [[ids[0], 40, 10], [ids[1], 30, 10], [ids[2], 20, 10], [ids[3], 15, 10]]),
        seance('2', '2026-10-12', [[ids[0], 50, 10], [ids[1], 27.5, 10], [ids[2], 20, 10]]),
        seance('3', '2026-10-19', [[ids[0], 10, 10]], { deload: true }),
      ],
      exo
    )
    expect(r.monte.map((l) => l.exo.id)).toEqual([ids[0]])
    expect(r.monte[0].apres.charge).toBe(50)
    expect(r.baisse.map((l) => l.exo.id)).toEqual([ids[1]])
    expect(r.stable.map((l) => l.exo.id)).toEqual([ids[2]])
    expect(r.uneFois.map((l) => l.exo.id)).toEqual([ids[3]])
  })
})

describe('semaines tenues sur une période', () => {
  const s = (date: string) => ({ id: date, date, enCours: false, series: [] }) as unknown as Seance
  const seances = ['2026-10-05', '2026-10-07', '2026-10-12', '2026-10-19', '2026-10-21', '2026-10-26', '2026-10-28'].map(s)
  it('compte les semaines entières tenues, avec son prévu', () => {
    expect(tenuesSurPeriode(seances, 2, [], '2026-10-05', '2026-11-01')).toEqual({ n: 3, sur: 4 })
  })
  it('laisse de côté les semaines coupées et celles sans rien de prévu', () => {
    expect(tenuesSurPeriode(seances, 2, [], '2026-10-07', '2026-10-29')).toEqual({ n: 1, sur: 2 })
    expect(tenuesSurPeriode(seances, 0, [], '2026-10-05', '2026-11-01')).toEqual({ n: 0, sur: 0 })
  })
  it('ne compte pas les semaines avant la toute première séance', () => {
    expect(tenuesSurPeriode(seances, 2, [], '2026-09-07', '2026-10-11')).toEqual({ n: 1, sur: 1 })
  })
})

describe('accueil, séance faite : le gain de chaque exercice', () => {
  const avant = seance('a', '2026-11-04', [
    ['dev_couche_barre', 60, 10], ['dev_couche_barre', 60, 10],
    ['rowing_haltere', 30, 10], ['rowing_haltere', 30, 9],
    ['curl_barre', 30, 10],
    ['dev_militaire', 30, 10],
  ])
  const jour = seance('j', '2026-11-11', [
    ['curl_barre', 30, 10],
    ['dev_couche_barre', 62.5, 8], ['dev_couche_barre', 62.5, 8],
    ['rowing_haltere', 30, 10], ['rowing_haltere', 30, 10],
    ['dev_militaire', 30, 8],
    ['elevation_laterale_halteres', 8, 15],
  ])
  const g = gainsDeSeance(jour, [avant], exo)

  it('dans l’ordre fait : le gain en charge ou en reps, « = » si pareil, rien si moins bien ou première fois', () => {
    expect(g).toEqual([
      { exoId: 'curl_barre', gain: '=' },
      { exoId: 'dev_couche_barre', gain: '+2,5 kg' },
      { exoId: 'rowing_haltere', gain: '+1 rep' },
      { exoId: 'dev_militaire' },
      { exoId: 'elevation_laterale_halteres' },
    ])
  })

  it('autant de gains que « n exercices mieux que la dernière fois »', () => {
    expect(g.filter((x) => x.gain && x.gain !== '=').length).toBe(resumeSeance(jour, [avant], exo).mieux)
  })

  it('séance allégée, ou séance allégée d’avant : jamais de comparaison avec elle', () => {
    expect(gainsDeSeance({ ...jour, deload: true }, [avant], exo).every((x) => !x.gain)).toBe(true)
    expect(gainsDeSeance(jour, [{ ...avant, deload: true }], exo).every((x) => !x.gain)).toBe(true)
  })
})
