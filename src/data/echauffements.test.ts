import { describe, expect, it } from 'vitest'
import { echauffementAuto, echauffementDe, mouvement, MOUVEMENTS } from './echauffements'
import type { Exercice, Muscle, SeanceModele } from '../types'

describe('échauffement', () => {
  it('choisit selon le haut, le bas ou les deux', () => {
    expect(echauffementAuto(['pecs', 'dos', 'triceps', 'abdos'])).toContain('passages')
    expect(echauffementAuto(['pecs', 'dos', 'triceps'])).not.toContain('squat_tenu')
    expect(echauffementAuto(['quadriceps', 'ischios', 'mollets'])).toContain('hanches_9090')
    expect(echauffementAuto(['quadriceps', 'pecs'])).toEqual(expect.arrayContaining(['moulinets', 'squat_tenu']))
    for (const m of [[], ['pecs'], ['quadriceps'], ['pecs', 'quadriceps']] as Muscle[][]) expect(echauffementAuto(m).every((id) => mouvement(id))).toBe(true)
  })

  it('respecte le réglage de la séance', () => {
    const exo = (id: string) => ({ id, muscle: 'pecs' }) as Exercice
    const m: SeanceModele = { id: 'm', nom: 'm', sousTitre: '', exercices: [{ exoId: 'a' } as SeanceModele['exercices'][number]] }
    expect(echauffementDe({ ...m, echauffement: 'aucun' }, exo)).toEqual([])
    expect(echauffementDe({ ...m, echauffement: ['pont_fessier'] }, exo)).toEqual(['pont_fessier'])
    expect(echauffementDe(m, exo)[0]).toBe('cardio')
    expect(new Set(MOUVEMENTS.map((x) => x.id)).size).toBe(MOUVEMENTS.length)
  })
})
