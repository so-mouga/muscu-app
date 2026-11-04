import { ciblesEnVigueur, etatVolume, zone } from './volume'

describe('volume par muscle en jauge', () => {
  it('zone conseillée : léger, optimal, beaucoup', () => {
    expect(zone('pecs', 10)).toEqual({ bas: 10, haut: 20 })
    expect(etatVolume('pecs', 6, 10)).toBe('leger')
    expect(etatVolume('pecs', 14, 10)).toBe('optimal')
    expect(etatVolume('pecs', 24, 10)).toBe('beaucoup')
  })
  it('sans zone : suivi seulement', () => {
    expect(etatVolume('trapezes', 6, 0)).toBe('suivi')
    expect(zone('trapezes', 0)).toBeNull()
  })
  it('cible ajustée : la zone part de la cible, beaucoup au-delà de +25 % ou du haut habituel', () => {
    expect(zone('dos', 18)).toEqual({ bas: 18, haut: 23 })
    expect(etatVolume('dos', 16, 18)).toBe('leger')
    expect(zone('biceps', 8)).toEqual({ bas: 8, haut: 16 })
  })
  it('plus de cible en chiffres : le conseil général, ou coupé', () => {
    const v = ciblesEnVigueur({ quadriceps: 5, pecs: 16, ischios: 0, abdos: 3 })
    expect(v.quadriceps).toBe(10)
    expect(v.pecs).toBe(10)
    expect(v.ischios).toBe(0)
    expect(v.abdos).toBe(0)
    expect(v.dos).toBe(0)
  })
})
