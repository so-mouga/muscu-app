import { EXERCICES, MUSCLES } from './exercices'
import { PROGRAMMES_TYPES } from './programmesTypes'
import { volumePrevu } from '../lib/calc'
import { etatVolume } from '../lib/volume'

describe('programmes tout prêts', () => {
  it('exercices existants, un jour par séance, charges à calibrer', () => {
    for (const t of PROGRAMMES_TYPES.filter((x) => !x.deBase))
      for (const m of t.seances) {
        expect(m.jour).toBeGreaterThan(0)
        for (const e of m.exercices) {
          expect(EXERCICES[e.exoId], `${t.id} : ${e.exoId}`).toBeDefined()
          expect(e.charge).toBeNull()
        }
      }
  })
  it('gros muscles dans la zone utile, aucun muscle à « Beaucoup »', () => {
    // À 2 séances par semaine, tout reste sous la zone utile : on vérifie seulement qu'aucun muscle n'est oublié (plus bas).
    for (const t of PROGRAMMES_TYPES.filter((x) => !x.deBase && x.seances.length > 2)) {
      const v = volumePrevu(t.seances, EXERCICES)
      for (const m of ['pecs', 'dos', 'quadriceps', 'ischios', 'epaule_laterale'] as const) expect(etatVolume(m, v[m], MUSCLES.find((x) => x.id === m)!.cible), `${t.id} : ${m} = ${v[m]}`).toBe('optimal')
      for (const m of MUSCLES) expect(etatVolume(m.id, v[m.id], m.cible), `${t.id} : ${m.id} = ${v[m.id]}`).not.toBe('beaucoup')
    }
  })
  it('Full body 2 jours : aucun muscle suivi à zéro', () => {
    const v = volumePrevu(PROGRAMMES_TYPES.find((t) => t.id === 'full_body_2')!.seances, EXERCICES)
    for (const m of MUSCLES.filter((x) => x.cible > 0)) expect(v[m.id], m.id).toBeGreaterThan(0)
  })
})
