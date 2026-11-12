import { EXERCICES } from '../data/exercices'
import type { ExoPlan, Seance, Serie } from '../types'
import { capAPortee, capFranchiDans, capMin, capPropose, capsEnCours, dureeCap, etatCap, genreCap, lireCaps, niveau, niveauSeance, regleCap, regleEnClair, texteCap, texteReste, type Cap } from './caps'

const exo = { ...Object.values(EXERCICES).find((e) => e.mode === 'machine' && !e.assistance && e.type === 'compose')!, pas: 2.5, chargeMax: undefined }
const corps = Object.values(EXERCICES).find((e) => e.mode === 'poids_corps' && e.mesure !== 'temps' && !e.assistance)!
let n = 0
const serie = (charge: number, reps: number, type: Serie['type'] = 'normale', exoId = exo.id): Serie => ({ id: `s${n++}`, exoId, type, charge, reps, rpe: 8, heure: 0 })
const seance = (id: string, date: string, series: Serie[], plus: Partial<Seance> = {}): Seance =>
  ({ id, date, debut: Date.parse(date + 'T10:00:00'), fin: Date.parse(date + 'T11:00:00'), series, exercices: [], chauffes: {}, notes: {}, ajustSeries: {}, enCours: false, nom: id, ...plus }) as Seance
const plan = (nb = 3, plus: Partial<ExoPlan> = {}): ExoPlan => ({ exoId: exo.id, series: Array.from({ length: nb }, () => ({ repsMin: 8, repsMax: 12, rpe: 8 })), repos: 120, chauffes: [], finisseur: false, charge: null, ...plus })
const regle = { genre: 'charge' as const, series: 3, reps: 8 }
const cap: Cap = { ...regle, exoId: exo.id, cible: 60, depart: 50, depuis: '2026-11-12' }

describe('caps', () => {
  it('la règle vient du programme : ses séries sans le finisseur, le bas de la fourchette', () => {
    expect(regleCap(exo, plan())).toEqual(regle)
    expect(regleCap(exo, plan(4, { finisseur: true }))).toEqual(regle)
    expect(regleCap(exo, undefined, [serie(50, 10), serie(50, 9)])).toEqual({ genre: 'charge', series: 2, reps: 8 })
    expect(regleCap(corps, undefined)?.genre).toBe('reps')
  })

  it('pas de cap sur un exercice assisté, en temps ou à l’élastique', () => {
    expect(genreCap({ ...exo, assistance: true })).toBeNull()
    expect(genreCap({ ...exo, mesure: 'temps' })).toBeNull()
    expect(genreCap({ ...exo, mode: 'elastique' })).toBeNull()
  })

  it('où on en est : la charge tenue sur toutes les séries, au bas de la fourchette ou plus', () => {
    expect(niveauSeance(regle, [serie(50, 10), serie(50, 9), serie(50, 8)])).toBe(50)
    // Deux séries à 55 kg seulement : c'est encore 50 kg.
    expect(niveauSeance(regle, [serie(55, 8), serie(55, 8), serie(50, 10)])).toBe(50)
    // Une série sous 8 reps ne compte pas, une série à l'échec non plus.
    expect(niveauSeance(regle, [serie(55, 8), serie(55, 8), serie(55, 7)])).toBeNull()
    expect(niveauSeance(regle, [serie(55, 8), serie(55, 8), serie(55, 9, 'echec')])).toBeNull()
  })

  it('une séance allégée ne compte jamais', () => {
    const a = seance('a', '2026-11-09', [serie(50, 10), serie(50, 9), serie(50, 8)])
    const b = seance('b', '2026-11-16', [serie(60, 8), serie(60, 8), serie(60, 8)], { deload: true })
    expect(niveau(regle, exo.id, [a, b])).toBe(50)
    expect(etatCap(cap, [a, b]).franchi).toBeUndefined()
    expect(capFranchiDans(cap, b, [a])).toBe(false)
  })

  it('le cap proposé : quatre paliers plus haut, à un chiffre rond, sans dépasser le matériel', () => {
    expect(capPropose(exo, regle, 50)).toBe(60)
    expect(capPropose(exo, regle, 52.5)).toBe(65)
    expect(capPropose({ ...exo, pas: 2 }, regle, 20)).toBe(30)
    expect(capPropose({ ...exo, chargeMax: 55 }, regle, 50)).toBe(55)
    expect(capPropose({ ...exo, chargeMax: 50 }, regle, 50)).toBeNull()
    expect(capPropose(exo, regle, null)).toBeNull()
    expect(capPropose(corps, { genre: 'reps', series: 3, reps: 8 }, 8)).toBe(10)
    expect(capMin(exo, regle, 50)).toBe(52.5)
  })

  it('l’avancée, puis le jour où il tombe', () => {
    const a = seance('a', '2026-11-16', [serie(52.5, 9), serie(52.5, 8), serie(52.5, 8)])
    const b = seance('b', '2026-12-14', [serie(55, 10), serie(55, 9), serie(55, 8)])
    expect(etatCap(cap, [])).toMatchObject({ niveau: 50, reste: 10, part: 0 })
    expect(etatCap(cap, [b, a])).toMatchObject({ niveau: 55, reste: 5, part: 0.5 })
    const c = seance('c', '2027-03-25', [serie(60, 9), serie(60, 8), serie(60, 8)])
    expect(etatCap(cap, [a, b, c]).franchi).toEqual({ date: '2027-03-25', seanceId: 'c' })
    expect(capFranchiDans(cap, c, [a, b])).toBe(true)
    // Déjà tombé avant : la séance suivante ne le fête pas une 2e fois.
    const d = seance('d', '2027-04-01', [serie(60, 10), serie(60, 9), serie(60, 8)])
    expect(capFranchiDans(cap, d, [a, b, c])).toBe(false)
    expect(capsEnCours([cap], [a, b])).toHaveLength(1)
    expect(capsEnCours([cap], [a, b, c])).toHaveLength(0)
  })

  it('60 kg × 8, 7, 7 : pas encore ; il faut toutes les séries', () => {
    const c = seance('c', '2027-03-25', [serie(60, 8), serie(60, 7), serie(60, 7)])
    expect(capFranchiDans(cap, c, [])).toBe(false)
    expect(etatCap(cap, [c]).niveau).toBe(50)
  })

  it('au poids du corps, le cap est un nombre de reps sur toutes les séries', () => {
    const r: Cap = { genre: 'reps', series: 3, reps: 8, exoId: corps.id, cible: 10, depart: 8, depuis: '2026-11-12' }
    const a = seance('a', '2026-11-20', [serie(0, 10, 'normale', corps.id), serie(0, 9, 'normale', corps.id), serie(0, 9, 'normale', corps.id)])
    expect(etatCap(r, [a])).toMatchObject({ niveau: 9, reste: 1, part: 0.5 })
    expect(texteCap(corps, r, 10)).toBe('3 × 10')
    expect(texteReste(r, 1)).toBe('Encore 1 rep.')
    expect(capAPortee(r, { charges: [0, 0, 0], reps: [9, 9, 9] }, 9)).toBe(true)
  })

  it('à ta portée : les charges prévues aujourd’hui sont celles du cap, sur toutes les séries', () => {
    expect(capAPortee(cap, { charges: [60, 60, 60], reps: [8, 8, 8] }, 57.5)).toBe(true)
    expect(capAPortee(cap, { charges: [60, 57.5, 57.5], reps: [8, 8, 8] }, 57.5)).toBe(false)
    expect(capAPortee(cap, { charges: [null, null, null], reps: [8, 8, 8] }, 50)).toBe(false)
  })

  it('les textes', () => {
    expect(texteCap(exo, regle, 60)).toBe('60 kg')
    expect(texteReste(regle, 7.5)).toBe('Encore 7,5 kg.')
    expect(regleEnClair(exo, regle, 60)).toBe('Franchi le jour où tu fais tes 3 séries à 60 kg, à 8 reps ou plus.')
    expect(dureeCap('2026-11-12', '2027-03-25')).toBe('en 19 semaines')
    expect(dureeCap('2026-11-12', '2026-11-21')).toBe('en 9 jours')
  })

  it('un réglage abîmé ne casse rien', () => {
    expect(lireCaps(undefined)).toEqual([])
    expect(lireCaps([{ exoId: 'x' }, cap])).toEqual([cap])
  })
})
