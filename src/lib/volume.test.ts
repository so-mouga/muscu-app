import { MUSCLES } from '../data/exercices'
import { cibleDuNiveau, cibleLue, ciblesEnVigueur, ciblesLues, etatVolume, niveauDe, phraseNiveau, resumeMuscles, zone } from './volume'

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
  it('Priorité avec 2 séances par semaine : 12 à 14 séries, pas 16 à 20', () => {
    expect(cibleLue('pecs', 16, 2)).toBe(12)
    expect(zone('pecs', 12, 2)).toEqual({ bas: 12, haut: 14 })
    expect(etatVolume('pecs', 10, 12, 2)).toBe('leger')
    expect(etatVolume('pecs', 13, 12, 2)).toBe('optimal')
    expect(etatVolume('pecs', 15, 12, 2)).toBe('beaucoup')
    expect(phraseNiveau('pecs', 'priorite', 2)).toContain('Avec 2 séances par semaine, vise 12 à 14 séries.')
  })
  it('Priorité à partir de 3 séances, ou sans nombre de séances : rien ne change', () => {
    for (const n of [undefined, 0, 3, 4, 6]) {
      expect(cibleLue('pecs', 16, n)).toBe(16)
      expect(zone('pecs', 16, n)).toEqual({ bas: 16, haut: 20 })
    }
    expect(phraseNiveau('pecs', 'priorite', 3)).toBe(phraseNiveau('pecs', 'priorite'))
  })
  it('Priorité avec 1 séance : jamais sous le conseil général du muscle', () => {
    expect(cibleLue('pecs', 16, 1)).toBe(10)
    expect(cibleLue('biceps', 16, 1)).toBe(6)
    expect(zone('pecs', 10, 1)).toEqual({ bas: 10, haut: 16 })
  })
  it('le nombre de séances ne touche ni Normal, ni Entretien, ni Sans conseil', () => {
    const v = ciblesLues(ciblesEnVigueur({ pecs: 16, quadriceps: 4, mollets: 0 }), 2)
    expect(v).toMatchObject({ pecs: 12, dos: 10, quadriceps: 4, mollets: 0, biceps: 6, abdos: 0 })
    expect(zone('dos', 10, 2)).toEqual({ bas: 10, haut: 16 })
    expect(zone('quadriceps', 4, 2)).toEqual({ bas: 4, haut: 8 })
    expect(zone('biceps', 6, 1)).toEqual({ bas: 6, haut: 16 })
  })
  it('ligne de la page Programme : le muscle en Priorité d’abord, puis les plus travaillés', () => {
    const volume = { ...Object.fromEntries(MUSCLES.map((m) => [m.id, 0])), pecs: 10, dos: 7, quadriceps: 7, ischios: 5, abdos: 9 } as Record<(typeof MUSCLES)[number]['id'], number>
    const perso = ciblesEnVigueur({ pecs: 16 })
    expect(resumeMuscles(volume, { cibles: ciblesLues(perso, 2), perso, seances: 2 })).toEqual(['Pecs 10, en priorité : vise 12 à 14', 'Dos 7 · Quadriceps 7 · Ischios 5'])
    const normal = ciblesEnVigueur({})
    expect(resumeMuscles(volume, { cibles: normal, perso: normal, seances: 2 })).toEqual(['Pecs 10 séries · Dos 7 · Quadriceps 7'])
    expect(resumeMuscles(volume)).toEqual(['Pecs 10 séries · Dos 7 · Quadriceps 7'])
  })
})
