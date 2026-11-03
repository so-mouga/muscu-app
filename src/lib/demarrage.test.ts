import { describe, expect, it } from 'vitest'
import { estSansProgramme } from './demarrage'

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
