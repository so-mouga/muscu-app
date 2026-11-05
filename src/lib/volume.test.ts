import { MUSCLES } from '../data/exercices'
import { cibleDuNiveau, ciblesEnVigueur, etatVolume, niveauDe, zone } from './volume'

describe('volume par muscle en jauge', () => {
  it('zone conseillée : léger, optimal, beaucoup', () => {
    expect(zone('pecs', 10)).toEqual({ bas: 10, haut: 16 })
    expect(etatVolume('pecs', 6, 10)).toBe('leger')
    expect(etatVolume('pecs', 14, 10)).toBe('optimal')
    expect(etatVolume('pecs', 17, 10)).toBe('beaucoup')
  })
  it('sans zone : suivi seulement', () => {
    expect(etatVolume('trapezes', 6, 0)).toBe('suivi')
    expect(zone('trapezes', 0)).toBeNull()
  })
  it('les trois niveaux : leurs zones et leurs états', () => {
    expect(zone('quadriceps', cibleDuNiveau('quadriceps', 'normal'))).toEqual({ bas: 10, haut: 16 })
    expect(zone('epaule_laterale', cibleDuNiveau('epaule_laterale', 'normal'))).toEqual({ bas: 8, haut: 16 })
    expect(zone('biceps', cibleDuNiveau('biceps', 'normal'))).toEqual({ bas: 6, haut: 16 })
    for (const m of ['pecs', 'biceps'] as const) {
      expect(zone(m, cibleDuNiveau(m, 'entretien'))).toEqual({ bas: 4, haut: 8 })
      expect(zone(m, cibleDuNiveau(m, 'priorite'))).toEqual({ bas: 16, haut: 20 })
    }
    expect(etatVolume('dos', 18, cibleDuNiveau('dos', 'normal'))).toBe('beaucoup')
    expect(etatVolume('dos', 18, cibleDuNiveau('dos', 'priorite'))).toBe('optimal')
    expect(etatVolume('quadriceps', 6, cibleDuNiveau('quadriceps', 'entretien'))).toBe('optimal')
    expect(etatVolume('quadriceps', 9, cibleDuNiveau('quadriceps', 'entretien'))).toBe('beaucoup')
  })
  it('un niveau enregistré se relit tel quel', () => {
    for (const m of MUSCLES.filter((x) => x.cible > 0)) for (const n of ['entretien', 'normal', 'priorite', 'sans'] as const) expect(niveauDe(m.id, cibleDuNiveau(m.id, n)), `${m.id} ${n}`).toBe(n)
  })
  it('anciennes cibles : le plancher de chaque muscle reste Normal', () => {
    expect(niveauDe('epaule_laterale', 8)).toBe('normal')
    expect(niveauDe('ischios', 8)).toBe('normal')
    expect(niveauDe('biceps', 6)).toBe('normal')
    expect(niveauDe('triceps', 6)).toBe('normal')
    expect(niveauDe('pecs', undefined)).toBe('normal')
  })
  it('anciennes cibles : le reste de la conversion', () => {
    expect(niveauDe('quadriceps', 5)).toBe('entretien')
    expect(niveauDe('quadriceps', 8)).toBe('entretien')
    expect(niveauDe('quadriceps', 9.5)).toBe('normal')
    expect(niveauDe('ischios', 6)).toBe('entretien')
    expect(niveauDe('biceps', 5)).toBe('entretien')
    expect(niveauDe('biceps', 8)).toBe('normal')
    expect(niveauDe('dos', 14)).toBe('normal')
    expect(niveauDe('pecs', 16)).toBe('priorite')
    expect(niveauDe('biceps', 18)).toBe('priorite')
    expect(niveauDe('mollets', 0)).toBe('sans')
    expect(niveauDe('quadriceps', 0)).toBe('sans')
  })
  it('à partir d’aujourd’hui : le niveau, rien pour un muscle sans conseil, rien de noté = Normal', () => {
    const v = ciblesEnVigueur({ quadriceps: 5, pecs: 18, ischios: 8, abdos: 3, mollets: 0 })
    expect(v).toMatchObject({ quadriceps: 4, pecs: 16, ischios: 8, abdos: 0, dos: 10, mollets: 0 })
    expect(etatVolume('mollets', 5, v.mollets)).toBe('suivi')
  })
})
