import { MODELES } from '../data/programme'
import { dureeEstimee, dureeSeanceEffective } from '../lib/calc'

describe('durée estimée', () => {
  it('cohérente avec le cahier des charges', () => {
    const d = (id: string) => dureeEstimee(MODELES[id])
    console.log('durées :', ['haut_a', 'bas', 'haut_b', 'haut_c'].map((id) => `${id} ${d(id)} min`).join(', '))
    expect(d('haut_a')).toBeGreaterThanOrEqual(60)
    expect(d('haut_a')).toBeLessThanOrEqual(80)
    expect(d('bas')).toBeGreaterThanOrEqual(45)
    expect(d('bas')).toBeLessThanOrEqual(65)
  })
})

describe('durée réelle d’une séance', () => {
  const H = 3600000
  const debut = Date.parse('2026-10-31T18:00:00')
  const s = (heures: number[], fin?: number) => ({ id: 's', date: '2026-10-31', nom: 'Haut A', debut, fin, enCours: false, exercices: [], chauffes: {}, notes: {}, ajustSeries: {}, series: heures.map((h, i) => ({ id: String(i), exoId: 'x', type: 'normale' as const, charge: 50, reps: 8, rpe: 8, heure: debut + h * H })) })

  it('de la 1re à la dernière série', () => {
    expect(dureeSeanceEffective(s([0.1, 0.5, 1.1], debut + 15 * H))).toBe(1 * H)
  })
  it('jamais plus de 4 h, même séance laissée ouverte la nuit', () => {
    expect(dureeSeanceEffective(s([0.1, 13.9], debut + 14 * H))).toBe(4 * H)
    expect(dureeSeanceEffective(s([13.8], debut + 14 * H))).toBe(4 * H)
  })
})
