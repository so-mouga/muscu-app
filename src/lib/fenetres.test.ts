import { describe, expect, it } from 'vitest'
import { fermerAuRelache } from './fenetres'

describe('fermerAuRelache', () => {
  it('ferme quand la fenêtre est tirée assez loin, même lentement', () => {
    expect(fermerAuRelache(120, 0, 700)).toBe(true)
    // Petite fenêtre : un quart de sa hauteur suffit.
    expect(fermerAuRelache(50, 0, 200)).toBe(true)
  })
  it('ferme sur un petit coup de doigt rapide', () => {
    expect(fermerAuRelache(40, 0.5, 700)).toBe(true)
  })
  it('ne ferme pas sur un petit mouvement, même rapide', () => {
    expect(fermerAuRelache(39, 3, 700)).toBe(false)
    expect(fermerAuRelache(100, 0.1, 700)).toBe(false)
  })
})
