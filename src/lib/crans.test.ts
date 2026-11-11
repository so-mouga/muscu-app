import { EXERCICES } from '../data/exercices'
import type { ExoPlan, Seance, Serie } from '../types'
import { aPortee, cranDuJour, cransDeSeance, cransParSeance, etatDisque, pourquoiCran, seuilCran, texteCran, totalCrans } from './crans'

const exo = Object.values(EXERCICES).find((e) => e.suivreE1rm && e.mode === 'machine' && !e.assistance)!
const exoDe = (id: string) => EXERCICES[id]
let n = 0
const serie = (charge: number, reps: number, rpe = 8, type: Serie['type'] = 'normale'): Serie => ({ id: `s${n++}`, exoId: exo.id, type, charge, reps, rpe, heure: 0 })
const seance = (id: string, date: string, series: Serie[], plus: Partial<Seance> = {}): Seance =>
  ({ id, date, debut: Date.parse(date + 'T10:00:00'), fin: Date.parse(date + 'T11:00:00'), series, exercices: [], chauffes: {}, notes: {}, ajustSeries: {}, enCours: false, nom: id, ...plus }) as Seance
const plan: ExoPlan = { exoId: exo.id, series: [1, 2, 3].map(() => ({ repsMin: 8, repsMax: 12, rpe: 8 })), repos: 120 } as ExoPlan

describe('crans', () => {
  const a = seance('a', '2026-11-09', [serie(60, 10), serie(60, 9), serie(60, 9)])

  it('un record = un cran, un seul par exercice et par séance, rien à la première séance', () => {
    const b = seance('b', '2026-11-11', [serie(60, 11), serie(60, 12), serie(65, 6)])
    expect(cransParSeance([a, b], exoDe)).toEqual({ a: 0, b: 1 })
    expect(totalCrans([a, b], exoDe)).toBe(1)
  })

  it('aucun cran en séance allégée, ni pour une séance allégée un seul jour', () => {
    const b = seance('b', '2026-11-11', [serie(70, 10)], { deload: true })
    const c = seance('c', '2026-11-12', [serie(70, 10)], { deload: true, allegeeSeule: true })
    expect(cransParSeance([a, b, c], exoDe)).toEqual({ a: 0, b: 0, c: 0 })
    expect(cransDeSeance(b, [a], exoDe)).toEqual([])
  })

  it('les séances d’avant le départ servent de référence mais ne donnent pas de cran', () => {
    const avant = seance('z', '2026-11-02', [serie(55, 10)])
    const essai = seance('y', '2026-11-04', [serie(60, 8)])
    const vraie = seance('v', '2026-11-10', [serie(60, 9)])
    expect(cransParSeance([avant, essai, vraie], exoDe)).toEqual({ z: 0, y: 0, v: 1 })
  })

  it('un cran gagné ne se perd pas : une séance moins bonne ensuite ne retire rien', () => {
    const b = seance('b', '2026-11-11', [serie(60, 11)])
    const c = seance('c', '2026-11-13', [serie(60, 7)])
    expect(totalCrans([a, b], exoDe)).toBe(1)
    expect(totalCrans([a, b, c], exoDe)).toBe(1)
  })

  it('la série qui gagne le cran : la première qui bat le record, avec l’ancien record', () => {
    const jour = [serie(60, 10), serie(60, 11), serie(60, 12)]
    const c = cranDuJour(exo, [a.series], jour)!
    expect(c.serie).toBe(jour[1])
    expect(c.genre).toBe('reps')
    expect(c.ancien).toBe(10)
    expect(texteCran(c)).toBe('60 kg × 11, +1 rep')
    expect(pourquoiCran(c)).toBe('ton record était 10')
  })

  it('record de charge : « 65 kg, +5 kg »', () => {
    const c = cranDuJour(exo, [a.series], [serie(65, 6)])!
    expect(c.genre).toBe('charge')
    expect(texteCran(c)).toBe('65 kg, +5 kg')
    expect(pourquoiCran(c)).toBe('charge jamais faite')
  })

  it('une charge plus légère jamais faite ne donne pas de cran, même si la 2e série fait plus de reps', () => {
    expect(cranDuJour(exo, [a.series], [serie(50, 12), serie(50, 15)])).toBeNull()
  })

  it('une série à l’échec ou dégressive ne gagne pas de cran', () => {
    expect(cranDuJour(exo, [a.series], [serie(60, 14, 10, 'echec')])).toBeNull()
  })

  it('seuil à la saisie : une rep de plus que le record à cette charge', () => {
    expect(seuilCran(exo, [a.series], [], 60)).toEqual({ reps: 11, record: 10 })
    expect(seuilCran(exo, [a.series], [], 65)).toEqual({ reps: 1 })
    expect(seuilCran(exo, [a.series], [], 50)).toBeNull()
    expect(seuilCran(exo, [], [], 60)).toBeNull()
  })

  it('seuil : plus rien une fois le cran du jour gagné', () => {
    expect(seuilCran(exo, [a.series], [serie(60, 11)], 60)).toBeNull()
    expect(seuilCran(exo, [a.series], [serie(60, 10)], 60)).toEqual({ reps: 11, record: 10 })
  })

  it('à portée : conseil « Tu peux viser plus » et meilleure série de la dernière fois au record', () => {
    expect(aPortee(exo, plan, [a.series])).toEqual({ charge: 60, reps: 10 })
  })

  it('pas à portée : la dernière fois était sous le record', () => {
    const mieux = [serie(60, 12), serie(60, 11), serie(60, 10)]
    expect(aPortee(exo, plan, [a.series, mieux])).toBeNull()
  })

  it('pas à portée sans historique, ni quand le conseil est de monter la charge', () => {
    expect(aPortee(exo, plan, [])).toBeNull()
    expect(aPortee(exo, plan, [[serie(60, 12), serie(60, 12), serie(60, 12)]])).toBeNull()
  })

  it('crans d’une séance : un par exercice, dans l’ordre', () => {
    const b = seance('b', '2026-11-11', [serie(60, 11), serie(60, 12)])
    const r = cransDeSeance(b, [a], exoDe)
    expect(r).toHaveLength(1)
    expect(r[0].serie).toBe(b.series[0])
  })

  it('disque : 12 crans le remplissent, le suivant commence', () => {
    expect(etatDisque(7)).toMatchObject({ pleins: 0, crans: 7, reste: 5, numero: 1 })
    expect(etatDisque(12)).toMatchObject({ pleins: 1, crans: 0, reste: 12, numero: 2 })
    expect(etatDisque(15)).toMatchObject({ pleins: 1, crans: 3, reste: 9, numero: 2 })
  })
})
