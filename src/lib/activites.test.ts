import { describe, expect, it } from 'vitest'
import { activitesDuJour, dureeActivite, effortActivite, resumeActivites, texteActivite } from './activites'
import type { Activite } from '../types'

const act = (id: string, date: string, type: string, duree: number, intensite: number): Activite => ({ id, date, type, duree, intensite })

describe('activités hors muscu', () => {
  it('durée et effort en clair, anciennes intensités sur 10 comprises', () => {
    expect(dureeActivite(90)).toBe('1 h 30')
    expect(dureeActivite(60)).toBe('1 h')
    expect(dureeActivite(45)).toBe('45 min')
    expect([1, 3, 4, 5, 6, 7, 8, 9, 10].map(effortActivite)).toEqual(['facile', 'facile', 'facile', 'moyen', 'moyen', 'moyen', 'dur', 'dur', 'dur'])
  })

  it('« padel 1 h 30, dur » ; un type écrit à la main garde sa casse', () => {
    expect(texteActivite(act('a', '2026-11-18', 'Padel', 90, 9))).toBe('padel 1 h 30, dur')
    expect(texteActivite(act('a', '2026-11-18', 'CrossFit', 45, 6))).toBe('CrossFit 45 min, moyen')
  })

  it('les activités d’un jour sur une ligne, rien un autre jour', () => {
    const l = [act('a', '2026-11-18', 'Padel', 90, 9), act('b', '2026-11-18', 'Course', 30, 6), act('c', '2026-11-19', 'Vélo', 60, 3)]
    expect(activitesDuJour(l, '2026-11-18')).toBe('padel 1 h 30, dur + course 30 min, moyen')
    expect(activitesDuJour(l, '2026-11-20')).toBe('')
  })

  it('le résumé d’une période : le plus fréquent d’abord, l’effort de la plupart des fois', () => {
    const l = [
      act('a', '2026-11-03', 'Padel', 90, 9),
      act('b', '2026-11-10', 'Padel', 90, 9),
      act('c', '2026-11-17', 'Padel', 90, 6),
      act('d', '2026-11-05', 'Course', 60, 6),
      act('e', '2026-11-12', 'Course', 45, 6),
      act('f', '2026-10-01', 'Vélo', 60, 3),
    ]
    expect(resumeActivites(l, '2026-11-01', '2026-11-30')).toBe('5 activités, 6 h 15 en tout · padel 3 fois (4 h 30, dur), course 2 fois (1 h 45, moyen)')
    expect(resumeActivites(l, '2026-12-01', '2026-12-31')).toBeNull()
  })
})
