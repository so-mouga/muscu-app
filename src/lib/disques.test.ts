import { describe, expect, it } from 'vitest'
import { estBarreOuSmith, repartirDisques } from './disques'

describe('repartirDisques', () => {
  it('calcule correctement pour 72.5 kg avec barre de 20 kg', () => {
    // 72.5 - 20 = 52.5 kg -> 26.25 kg par côté
    // 26.25 = 1x20 + 1x5 + 1x1.25
    const res = repartirDisques(72.5, 20)
    expect(res.chargeParCote).toBe(26.25)
    expect(res.reste).toBe(0)
    expect(res.disques).toEqual([
      { poids: 20, quantite: 1 },
      { poids: 5, quantite: 1 },
      { poids: 1.25, quantite: 1 },
    ])
  })

  it('calcule correctement pour 67.5 kg avec barre smith de 10 kg', () => {
    // 67.5 - 10 = 57.5 kg -> 28.75 kg par côté
    // 28.75 = 1x20 + 1x5 + 1x2.5 + 1x1.25
    const res = repartirDisques(67.5, 10)
    expect(res.chargeParCote).toBe(28.75)
    expect(res.reste).toBe(0)
    expect(res.disques).toEqual([
      { poids: 20, quantite: 1 },
      { poids: 5, quantite: 1 },
      { poids: 2.5, quantite: 1 },
      { poids: 1.25, quantite: 1 },
    ])
  })

  it('gère une barre de 0 kg (poids des disques ajoutés)', () => {
    // 50 kg disques seuls -> 25 kg par côté = 1x20 + 1x5
    const res = repartirDisques(50, 0)
    expect(res.chargeParCote).toBe(25)
    expect(res.disques).toEqual([
      { poids: 20, quantite: 1 },
      { poids: 5, quantite: 1 },
    ])
  })

  it('gère le cas où la charge est inférieure ou égale à la barre', () => {
    const res = repartirDisques(20, 20)
    expect(res.chargeParCote).toBe(0)
    expect(res.disques).toEqual([])
    expect(res.reste).toBe(0)
  })
})

describe('estBarreOuSmith', () => {
  it('détecte les exercices barre et smith', () => {
    expect(estBarreOuSmith('Développé incliné Smith')).toBe(true)
    expect(estBarreOuSmith('smith_incline')).toBe(true)
    expect(estBarreOuSmith('Squat barre')).toBe(true)
    expect(estBarreOuSmith('Soulevé de terre')).toBe(true)
    expect(estBarreOuSmith('Curl haltère')).toBe(false)
    expect(estBarreOuSmith('Poulie vis-à-vis')).toBe(false)
  })
})
