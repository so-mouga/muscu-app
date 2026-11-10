import { describe, expect, it } from 'vitest'
import { moyenneRepas, texteRepas } from './nutrition'

const frise = [{ depuis: '2026-11-01', phase: 'prise' as const, volume: {}, calories: 3000 }]

describe('repas dans les textes partagés', () => {
  it('moyenne des jours lus dans l’appli de repas, avec l’objectif et les macros', () => {
    const r = moyenneRepas(
      [
        { date: '2026-11-09', kcal: 2900, proteines: 150, glucides: 350, lipides: 80, kcalAppli: true },
        { date: '2026-11-10', kcal: 3000, proteines: 160, glucides: 370, lipides: 90, kcalAppli: true },
        { date: '2026-11-11', calories: 'ok' },
      ],
      frise
    )
    expect(r).toEqual({ jours: 2, kcal: 2950, objectif: 3000, proteines: 155, glucides: 360, lipides: 85 })
    expect(texteRepas(r!)).toBe('2 950 kcal pour 3 000 visées · protéines 155 g · glucides 360 g · lipides 85 g')
  })

  it('rien sans jour lu, et pas d’objectif inventé', () => {
    expect(moyenneRepas([{ date: '2026-11-09', calories: 'ok' }], frise)).toBeNull()
    expect(texteRepas({ kcal: 2100 })).toBe('2 100 kcal')
  })
})
