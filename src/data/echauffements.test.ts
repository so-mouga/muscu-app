import { describe, expect, it } from 'vitest'
import { echauffementDe, MOUVEMENTS } from './echauffements'
import type { SeanceModele } from '../types'

describe('échauffement', () => {
  it('respecte le réglage de la séance', () => {
    const m: SeanceModele = { id: 'm', nom: 'm', sousTitre: '', exercices: [{ exoId: 'a' } as SeanceModele['exercices'][number]] }
    expect(echauffementDe({ ...m, echauffement: 'aucun' })).toEqual([])
    expect(echauffementDe({ ...m, echauffement: ['pont_fessier'] })).toEqual(['pont_fessier'])
    // Rien par défaut : pas d'échauffement tant qu'on n'en a pas choisi.
    expect(echauffementDe(m)).toEqual([])
    expect(new Set(MOUVEMENTS.map((x) => x.id)).size).toBe(MOUVEMENTS.length)
  })
})
