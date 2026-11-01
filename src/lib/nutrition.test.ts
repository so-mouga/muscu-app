import { objectifDuJour } from './nutrition'

describe('objectif calories du jour', () => {
  const frise = [{ depuis: '2026-11-02', phase: 'prise' as const, volume: {}, calories: 2500 }]

  it('renvoie les calories fixées dans les objectifs', () => {
    expect(objectifDuJour(frise, '2026-11-05')).toEqual({ kcal: 2500 })
  })

  it('renvoie null si pas de calories définies', () => {
    const sansCal = [{ depuis: '2026-11-02', phase: 'prise' as const, volume: {} }]
    expect(objectifDuJour(sansCal, '2026-11-05')).toBeNull()
  })
})
