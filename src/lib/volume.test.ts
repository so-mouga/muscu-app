import { MUSCLES } from '../data/exercices'
import { cibleDuNiveau, cibleLue, ciblesEnVigueur, ciblesLues, etatVolume, niveauDe, phraseNiveau, ligneMuscles, zone } from './volume'

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
  it('ligne de la page Programme : une seule réponse, la Priorité d’abord, puis les légers, puis ceux au-dessus', () => {
    const texte = (l: { t: string }[]) => l.map((x) => x.t).join('')
    const base = Object.fromEntries(MUSCLES.map((m) => [m.id, 0])) as Record<(typeof MUSCLES)[number]['id'], number>
    const dansLaZone = { ...base, pecs: 12, dos: 12, epaule_laterale: 10, epaule_arriere: 8, biceps: 8, triceps: 8, quadriceps: 12, ischios: 10, mollets: 8 }
    const normal = ciblesEnVigueur({})
    const avec = (v: typeof base, perso = normal) => texte(ligneMuscles(v, { cibles: ciblesLues(perso, 2), perso, seances: 2 }))
    const prio = ciblesEnVigueur({ pecs: 16 })
    expect(avec({ ...dansLaZone, pecs: 7 }, prio)).toBe('Pecs en priorité : il t’en manque 5')
    expect(avec({ ...dansLaZone, pecs: 9.5 }, prio)).toBe('Pecs en priorité : il t’en manque 3')
    expect(avec({ ...dansLaZone, pecs: 13, biceps: 2 }, prio)).toBe('Pecs en priorité : c’est atteint')
    expect(avec({ ...dansLaZone, biceps: 3 })).toBe('Biceps un peu léger')
    expect(avec({ ...dansLaZone, biceps: 3, mollets: 2 })).toBe('Mollets et biceps un peu légers')
    expect(avec({ ...dansLaZone, biceps: 3, mollets: 2, dos: 4 })).toBe('3 muscles un peu légers')
    expect(avec({ ...dansLaZone, triceps: 20 })).toBe('Triceps au-dessus du conseil')
    expect(avec({ ...dansLaZone, triceps: 20, biceps: 3 })).toBe('Biceps un peu léger')
    expect(avec(dansLaZone)).toBe('Tous tes muscles sont dans le conseil')
    expect(texte(ligneMuscles(dansLaZone))).toBe('Tes séries, muscle par muscle')
    expect(ligneMuscles({ ...dansLaZone, biceps: 3, mollets: 2 }, { cibles: normal, perso: normal, seances: 2 }).filter((x) => x.fort).map((x) => x.t)).toEqual(['Mollets', 'biceps'])
  })
})
