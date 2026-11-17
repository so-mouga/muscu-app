import { describe, expect, it } from 'vitest'
import type { CircuitPlan, Seance } from '../types'
import { circuitAFaire, circuitsRestants, dureeCircuit, dureeCircuits, faitCircuit, minuteDe, nomCircuitLibre, recordTours, resumeCircuit, toursAvant } from './circuits'

const c1: CircuitPlan = { id: 'a', nom: 'Circuit 1', type: 'duree', minutes: 12, tours: 1, mouvements: [{ nom: '12 thrusters' }, { nom: '12 sit-ups' }, { nom: '12 swings' }] }
const c3: CircuitPlan = { id: 'c', nom: 'Circuit 3', type: 'minute', minutes: 0, tours: 3, mouvements: [{ nom: 'Machine' }, { nom: '12 sit-ups' }, { nom: 'Machine' }, { nom: '10 genoux' }] }

describe('circuits', () => {
  it('durées : sur une durée, minute par minute, et le total de la séance', () => {
    expect(dureeCircuit(c1)).toBe(720)
    expect(dureeCircuit(c3)).toBe(720)
    expect(dureeCircuits({ circuits: [c1, c3] })).toBe(1560)
    expect(dureeCircuits({})).toBe(0)
  })

  it('résumé en clair', () => {
    expect(resumeCircuit(c1)).toBe('12 min · 3 mouvements')
    expect(resumeCircuit(c3)).toBe('minute par minute · 3 fois 4 min')
  })

  it('le circuit à faire est le premier ni fini ni sauté', () => {
    expect(circuitAFaire({ circuits: [c1, c3] })?.id).toBe('a')
    expect(circuitAFaire({ circuits: [c1, c3], circuitsFaits: { a: { debut: 1, fin: 2, tours: 4 } } })?.id).toBe('c')
    expect(circuitsRestants({ circuits: [c1, c3], circuitsFaits: { a: { debut: 1, fin: 2, passe: true } } })).toBe(1)
    expect(circuitAFaire({})).toBeUndefined()
  })

  it('minute par minute : le mouvement de la minute, le passage, la fin', () => {
    expect(minuteDe(c3, 0)).toMatchObject({ minute: 0, passage: 0, rang: 0, fini: false })
    expect(minuteDe(c3, 61)).toMatchObject({ minute: 1, rang: 1, reste: 59 })
    expect(minuteDe(c3, 4 * 60 + 5)).toMatchObject({ passage: 1, rang: 0 })
    expect(minuteDe(c3, 720).fini).toBe(true)
  })

  it('ce qui a été fait, en clair', () => {
    expect(faitCircuit({}, c1)).toBe('')
    expect(faitCircuit({ circuitsFaits: { a: { debut: 1, fin: 2, tours: 4 } } }, c1)).toBe('4 tours')
    expect(faitCircuit({ circuitsFaits: { a: { debut: 1, fin: 2, tours: 1 } } }, c1)).toBe('1 tour')
    expect(faitCircuit({ circuitsFaits: { a: { debut: 1, fin: 2, tours: 2, passe: true } } }, c1)).toBe('2 tours (arrêté avant la fin)')
    expect(faitCircuit({ circuitsFaits: { a: { debut: 1, fin: 2, passe: true } } }, c1)).toBe('sauté')
    expect(faitCircuit({ circuitsFaits: { c: { debut: 1, fin: 2 } } }, c3)).toBe('fait')
  })

  it('la dernière fois et le record : même nom et même durée, faits jusqu’au bout', () => {
    const avant: Pick<Seance, 'circuits' | 'circuitsFaits'>[] = [
      { circuits: [{ ...c1, id: 'x' }], circuitsFaits: { x: { debut: 1, fin: 2, tours: 2, passe: true } } },
      { circuits: [{ ...c1, id: 'y' }], circuitsFaits: { y: { debut: 1, fin: 2, tours: 4 } } },
      { circuits: [{ ...c1, id: 'z' }], circuitsFaits: { z: { debut: 1, fin: 2, tours: 5 } } },
      { circuits: [{ ...c1, id: 'w', minutes: 8 }], circuitsFaits: { w: { debut: 1, fin: 2, tours: 9 } } },
    ]
    expect(toursAvant(avant, c1)).toBe(4)
    expect(recordTours(avant, c1)).toBe(5)
    expect(toursAvant([], c1)).toBeUndefined()
    expect(toursAvant(avant, c3)).toBeUndefined()
  })

  it('le nom proposé n’est jamais déjà pris', () => {
    expect(nomCircuitLibre([])).toBe('Circuit 1')
    expect(nomCircuitLibre([{ ...c1, nom: 'Circuit 2' }])).toBe('Circuit 3')
  })
})
