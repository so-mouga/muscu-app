import { describe, expect, it } from 'vitest'
import type { Exercice, Seance } from '../types'
import { gain, lectureExo, marquesSeances } from './constat'

const machine: Exercice = { id: 'x', nom: 'X', muscle: 'pecs', type: 'compose', mode: 'machine', pas: 2.5, suivreE1rm: true }
const assiste: Exercice = { ...machine, assistance: true, suivreE1rm: false }
const pdc: Exercice = { ...machine, mode: 'poids_corps', suivreE1rm: false }
const JOUR = '2026-11-05'
const avant = (n: number) => new Date(Date.parse(JOUR + 'T12:00:00') - n * 86400000).toISOString().slice(0, 10)

let k = 0
function seance(joursAvant: number, charge: number, reps: number[], deload = false): Seance {
  const date = avant(joursAvant)
  const id = `s${k++}`
  return {
    id,
    date,
    nom: 'Test',
    debut: Date.parse(date + 'T18:00:00'),
    enCours: false,
    exercices: [],
    chauffes: {},
    notes: {},
    ajustSeries: {},
    series: reps.map((r, i) => ({ id: `${id}-${i}`, exoId: 'x', type: 'normale' as const, charge, reps: r, rpe: 8, heure: i })),
    deload,
  } as Seance
}
const lire = (exo: Exercice, l: Seance[]) => lectureExo(exo, l, false, [], JOUR)

describe('constat d’un exercice', () => {
  it('une séance, puis deux : on ne juge pas encore', () => {
    expect(lire(machine, [seance(2, 50, [10])])?.texte).toBe('Première fois')
    expect(lire(machine, [seance(9, 50, [10]), seance(2, 50, [11])])?.texte).toBe('Trop tôt pour dire')
  })

  it('exercice arrêté depuis 4 semaines : ni « ça monte », ni bloqué', () => {
    expect(lire(machine, [seance(100, 40, [10]), seance(93, 42.5, [10]), seance(90, 45, [10])])?.texte).toBe('Pas fait depuis 3 mois')
    expect(lire(machine, [seance(44, 40, [10]), seance(37, 42.5, [10]), seance(28, 45, [10])])?.texte).toBe('Pas fait depuis 4 semaines')
  })

  it('un progrès dans les 4 dernières semaines : ça monte, avec le gain en vrais kilos', () => {
    const c = lire(machine, [seance(56, 50, [10]), seance(42, 55, [10]), seance(28, 55, [10]), seance(14, 60, [10]), seance(2, 60, [10])])
    expect(c?.texte).toBe('Ça monte')
    expect(c?.detail).toBe('+10 kg en 8 semaines')
  })

  it('monté il y a longtemps puis plat depuis 5 semaines : stable, plus « ça monte »', () => {
    const c = lire(machine, [seance(56, 50, [10]), seance(49, 55, [10]), seance(35, 60, [10]), seance(28, 60, [10]), seance(14, 60, [10]), seance(0, 60, [10])])
    expect(c?.texte).toBe('Stable depuis 5 semaines')
    expect(c?.detail).toMatch(/^Dernier progrès le /)
  })

  it('exercice assisté : moins d’aide, ça monte', () => {
    const c = lire(assiste, [seance(42, 40, [8]), seance(21, 35, [8]), seance(7, 30, [8])])
    expect(c?.texte).toBe('Ça monte')
    expect(c?.detail).toBe('10 kg d’aide en moins en 5 semaines')
  })

  it('poids du corps : les reps comptent', () => {
    const c = lire(pdc, [seance(42, 0, [10]), seance(21, 0, [12]), seance(7, 0, [13])])
    expect(c?.texte).toBe('Ça monte')
    expect(c?.detail).toBe('+3 reps en 5 semaines')
  })

  it('bloqué : la règle des blocages ne change pas, et jamais en sèche', () => {
    const l = [63, 56, 49, 42, 35, 28, 21, 14, 7].map((j) => seance(j, 60, [10]))
    expect(lire(machine, l)?.texte).toBe('Bloqué depuis 8 semaines')
    expect(lectureExo(machine, l, true, [], JOUR)?.texte).toMatch(/^Stable/)
  })

  it('les semaines allégées ne font ni chute, ni progrès', () => {
    const c = lire(machine, [seance(21, 60, [10]), seance(14, 40, [10], true), seance(7, 60, [10]), seance(0, 60, [11])])
    expect(c?.texte).toBe('Ça monte')
    expect(c?.detail).toBe('+1 rep en 3 semaines')
  })
})

describe('marques du carnet', () => {
  it('gain en vert, « = » si tout est pareil, rien si c’est moins bien, « allégée » à part', () => {
    const a = seance(28, 60, [10, 9])
    const b = seance(21, 62.5, [10, 9])
    const c = seance(14, 62.5, [10, 9])
    const d = seance(10, 40, [10, 9], true)
    const e = seance(7, 62.5, [9, 9])
    const f = seance(0, 62.5, [10, 10])
    const m = marquesSeances(machine, [a, b, c, d, e, f])
    expect(m.get(a.id)).toBeUndefined()
    expect(m.get(b.id)?.texte).toBe('+2,5 kg')
    expect(m.get(c.id)?.texte).toBe('=')
    expect(m.get(d.id)?.texte).toBe('allégée')
    expect(m.get(e.id)).toBeUndefined()
    expect(m.get(f.id)?.texte).toBe('+1 rep')
  })

  it('reps : la meilleure série d’abord, sinon ce qui a été gagné ailleurs', () => {
    expect(gain(machine, seance(7, 60, [13, 12, 11]).series, seance(0, 60, [16, 15, 14]).series)?.court).toBe('+3 reps')
    expect(gain(machine, seance(7, 60, [10, 9]).series, seance(0, 60, [10, 10]).series)?.court).toBe('+1 rep')
  })

  it('assisté : moins de kg, et un gain écrit comme une baisse d’aide', () => {
    expect(gain(assiste, seance(7, 40, [8]).series, seance(0, 35, [8]).series)?.court).toBe('−5 kg')
  })
})
