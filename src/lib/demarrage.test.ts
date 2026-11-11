import { describe, expect, it } from 'vitest'
import { estSansProgramme, joursRepartis, ordreDesJours, pourObjectif, quand, recommande, seSuivent } from './demarrage'

describe('sans programme', () => {
  it('appli vide : sans programme', () => expect(estSansProgramme(0, 0, 0, false, false)).toBe(true))
  it('une séance libre après le démarrage ne ramène pas Recompo', () => expect(estSansProgramme(0, 0, 1, true, false)).toBe(true))
  it('ancienne version avec des séances : garde le programme de départ', () => expect(estSansProgramme(0, 0, 3, false, false)).toBe(false))
  it('un programme, un cycle ou une séance de base modifiée : programme de départ', () => {
    expect(estSansProgramme(1, 0, 0, true, false)).toBe(false)
    expect(estSansProgramme(0, 1, 0, false, false)).toBe(false)
    expect(estSansProgramme(0, 0, 0, false, true)).toBe(false)
  })
})

describe('programme proposé', () => {
  it('selon les jours et l’expérience', () => {
    expect(recommande(2, 'regulier')).toBe('full_body_2')
    expect(recommande(3, 'regulier')).toBe('full_body_3')
    expect(recommande(5, 'debut')).toBe('full_body_3')
    expect(recommande(4, 'regulier')).toBe('haut_bas_4')
    expect(recommande(7, 'regulier')).toBe('haut_bas_4')
  })
})

describe('jours du programme', () => {
  it('garde les jours les mieux répartis parmi ceux choisis', () => {
    expect(joursRepartis([1, 2, 3, 4, 5], 3, [1, 3, 5])).toEqual([1, 3, 5])
    expect(joursRepartis([1, 2, 3, 4, 5], 4, [1, 2, 4, 5])).toEqual([1, 2, 4, 5])
    expect(joursRepartis([1, 2, 3, 4, 5, 6, 7], 4, [1, 2, 4, 5])).toEqual([1, 2, 4, 6])
  })
  it('complète s’il en manque, sans changer ceux choisis', () => {
    const j = joursRepartis([1, 4], 4, [1, 2, 4, 5])
    expect(j).toHaveLength(4)
    expect(j).toEqual(expect.arrayContaining([1, 4]))
  })
  it('sans choix : les jours du programme', () => expect(joursRepartis([], 3, [5, 1, 3])).toEqual([1, 3, 5]))
  it('la 1re séance tombe sur le prochain jour, aujourd’hui compris', () => {
    expect(ordreDesJours([1, 3, 5], 2).map((x) => x.jour)).toEqual([3, 5, 1])
    expect(ordreDesJours([1, 3, 5], 3).map((x) => x.jour)).toEqual([3, 5, 1])
    expect(ordreDesJours([1, 3, 5], 6)[0]).toEqual({ jour: 1, dans: 2 })
  })
  it('dit quand', () => {
    expect(quand(0, 3)).toBe('aujourd’hui')
    expect(quand(1, 3)).toBe('demain')
    expect(quand(2, 3)).toBe('mercredi')
  })
  it('repère les jours qui se suivent, dimanche et lundi aussi', () => {
    expect(seSuivent([1, 3, 5])).toBe(false)
    expect(seSuivent([1, 2, 5])).toBe(true)
    expect(seSuivent([1, 4, 7])).toBe(true)
  })
})

describe('la proposition répond à l’objectif', () => {
  it('une phrase par objectif, rien sans objectif', () => {
    expect(pourObjectif('seche')).toMatch(/^Tu veux perdre du gras/)
    expect(pourObjectif('prise')).toMatch(/^Tu veux prendre du muscle/)
    expect(pourObjectif('maintien')).toMatch(/poids stable/)
    expect(pourObjectif('aucun')).toBeNull()
    expect(pourObjectif(undefined)).toBeNull()
  })
})
