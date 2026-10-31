import { ajustee, ciblesConseillees, etatVolume, prioritaire, zone } from './volume'

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
    expect(ajustee('dos', 18)).toBe(true)
    expect(ajustee('dos', 10)).toBe(false)
    expect(zone('dos', 18)).toEqual({ bas: 18, haut: 23 })
    expect(etatVolume('dos', 16, 18)).toBe('leger')
    expect(zone('biceps', 8)).toEqual({ bas: 8, haut: 16 })
  })
  it('priorité = +4 au-dessus de la cible conseillée', () => {
    expect(prioritaire('pecs', 14)).toBe(true)
    expect(prioritaire('pecs', 12)).toBe(false)
    expect(prioritaire('trapezes', 4)).toBe(false)
    expect(ciblesConseillees().pecs).toBe(10)
  })
})
