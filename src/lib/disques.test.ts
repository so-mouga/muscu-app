import { describe, expect, it } from 'vitest'
import { EXERCICES } from '../data/exercices'
import { repartirDisques } from './disques'

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

describe('calculateur de disques des exercices de base', () => {
  it('réglé exercice par exercice : barre 20 kg, Smith 10 kg, rien ailleurs', () => {
    expect(EXERCICES.dev_couche_barre.barre).toBe(20)
    expect(EXERCICES.souleve_terre.barre).toBe(20)
    expect(EXERCICES.squat_barre.barre).toBe(20)
    expect(EXERCICES.smith_incline.barre).toBe(10)
    expect(EXERCICES.squat_smith.barre).toBe(10)
    // Dépend de la salle (à plaques ou à pile, barre fixe ou chargée) : pas par défaut.
    for (const id of ['presse', 'hack_squat', 'curl_barre_ez', 'rowing_t']) expect(EXERCICES[id].barre).toBeUndefined()
    // Haltères, poulies, machines à pile : jamais.
    for (const id of ['dev_couche_halteres', 'butterfly', 'tirage_large', 'dev_couche_machine']) expect(EXERCICES[id].barre).toBeUndefined()
  })
  it('seulement sur des exercices chargés en kg (mode machine / barre)', () => {
    for (const e of Object.values(EXERCICES)) if (e.barre !== undefined) expect(e.mode).toBe('machine')
  })
})
