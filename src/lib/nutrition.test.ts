import { metabolismeBase, objectifCalories, objectifDuJour, profilComplet } from './nutrition'

describe('objectif calories', () => {
  const p = { taille: 180, naissance: 1990, sexe: 'h' as const, activite: 'assis' as const }

  it('dépense au repos (Mifflin-St Jeor)', () => {
    expect(metabolismeBase(80, p, 2026)).toBe(800 + 1125 - 180 + 5)
  })

  it('maintien × activité et séances, puis ajusté selon la phase', () => {
    // 1750 × (1,2 + 0,2) = 2450
    expect(objectifCalories(80, p, 'maintien', 4, 2026)).toEqual({ kcal: 2450, maintien: 2450, proteines: 160 })
    expect(objectifCalories(80, p, 'seche', 4, 2026)).toEqual({ kcal: 2100, maintien: 2450, proteines: 176 })
    expect(objectifCalories(80, p, 'prise', 4, 2026).kcal).toBe(2700)
  })

  it('profil incomplet : pas de calcul', () => {
    expect(profilComplet({ taille: 180 })).toBe(false)
    expect(profilComplet(p)).toBe(true)
  })
})

describe('objectif du jour', () => {
  const p = { taille: 180, naissance: 1990, sexe: 'h' as const, activite: 'assis' as const }
  const frise = [{ depuis: '2026-11-02', phase: 'prise' as const, volume: {} }]
  it('calculé selon la phase du jour, ou fixé à la main', () => {
    expect(objectifDuJour(frise, '2026-11-05', p, 80, 4)).toMatchObject({ kcal: 2700, manuel: false, phase: 'prise' })
    expect(objectifDuJour([{ ...frise[0], calories: 3000 }], '2026-11-05', p, 80, 4)).toMatchObject({ kcal: 3000, manuel: true, proteines: 160 })
    expect(objectifDuJour(frise, '2026-11-05', undefined, 80, 4)).toBeNull()
  })
})
