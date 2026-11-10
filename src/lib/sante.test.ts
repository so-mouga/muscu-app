import { describe, expect, it } from 'vitest'
import { majJour, nuitsParJour } from './sante'

const h = (iso: string) => new Date(iso).getTime()

describe('nuits de la montre rangées par jour', () => {
  it('une nuit compte pour le jour du réveil, éveils déjà retirés', () => {
    expect(nuitsParJour([{ debut: h('2026-11-08T23:40:00'), fin: h('2026-11-09T07:10:00'), minutes: 430 }])).toEqual({ '2026-11-09': 7.17 })
  })

  it('une nuit coupée en deux s’additionne, une sieste l’après-midi ne compte pas', () => {
    const nuits = [
      { debut: h('2026-11-09T23:00:00'), fin: h('2026-11-10T03:00:00'), minutes: 240 },
      { debut: h('2026-11-10T03:30:00'), fin: h('2026-11-10T07:00:00'), minutes: 200 },
      { debut: h('2026-11-10T15:00:00'), fin: h('2026-11-10T15:40:00'), minutes: 40 },
    ]
    expect(nuitsParJour(nuits)).toEqual({ '2026-11-10': 7.33 })
  })
})

describe('ce que la montre change dans le journal', () => {
  it('les pas sont toujours mis à jour', () => {
    expect(majJour({ date: 'x', pas: 4000 }, 9000, undefined)).toEqual({ pas: 9000 })
    expect(majJour({ date: 'x', pas: 9000 }, 9000, undefined)).toBeNull()
  })

  it('le sommeil de la montre remplit une case vide et se met à jour', () => {
    expect(majJour(undefined, undefined, 7.2)).toEqual({ sommeil: 7.2, sommeilMontre: true })
    expect(majJour({ date: 'x', sommeil: 6.5, sommeilMontre: true }, undefined, 7.2)).toEqual({ sommeil: 7.2, sommeilMontre: true })
  })

  it('le sommeil noté ou corrigé à la main n’est jamais remplacé', () => {
    expect(majJour({ date: 'x', sommeil: 6 }, undefined, 7.2)).toBeNull()
    expect(majJour({ date: 'x', sommeil: 6, sommeilMontre: false }, 12000, 7.2)).toEqual({ pas: 12000 })
  })
})
