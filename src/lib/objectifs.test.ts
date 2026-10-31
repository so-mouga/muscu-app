import { lireFrise, modifier, objectifsA, periodes, phaseA, textePhase } from './objectifs'

describe('objectifs dans le temps', () => {
  let f = modifier([], '2026-09-01', { phase: 'prise', finPrevue: '2026-11-24' }, { pecs: 16 })
  f = modifier(f, '2026-10-01', { volume: { pecs: 20 } })
  f = modifier(f, '2026-11-10', { phase: 'seche' })

  it('chaque changement est une étape datée qui reprend le reste', () => {
    expect(objectifsA(f, '2026-09-15')).toMatchObject({ phase: 'prise', volume: { pecs: 16 }, finPrevue: '2026-11-24' })
    expect(objectifsA(f, '2026-10-15')).toMatchObject({ phase: 'prise', volume: { pecs: 20 }, finPrevue: '2026-11-24' })
    // Nouvelle phase : le volume suit, la fin prévue de l'ancienne non.
    expect(objectifsA(f, '2026-11-12')).toEqual({ depuis: '2026-11-10', phase: 'seche', volume: { pecs: 20 } })
    expect(objectifsA(f, '2026-08-01')).toBeNull()
  })

  it('phases d’un seul tenant, avec leur vraie fin', () => {
    expect(periodes(f)).toEqual([
      { phase: 'prise', debut: '2026-09-01', fin: '2026-11-09', finPrevue: '2026-11-24' },
      { phase: 'seche', debut: '2026-11-10' },
    ])
    expect(phaseA(f, '2026-09-20')).toMatchObject({ phase: 'prise', semaine: 3, total: 12 })
    expect(textePhase(f, '2026-11-20', (d) => d)).toBe('Sèche depuis le 2026-11-10 (semaine 2)')
  })

  it('deux changements le même jour : une seule étape', () => {
    expect(modifier(f, '2026-11-10', { phase: 'maintien' }).filter((e) => e.depuis === '2026-11-10')).toHaveLength(1)
  })

  it('reprend les anciens réglages', () => {
    expect(lireFrise(undefined, [{ phase: 'seche', depuis: '2026-10-31' }], { pecs: 12 })).toEqual([{ depuis: '2026-10-31', phase: 'seche', volume: { pecs: 12 } }])
    expect(lireFrise(undefined, undefined, { pecs: 12 })).toEqual([{ depuis: '2000-01-01', volume: { pecs: 12 } }])
    expect(lireFrise(undefined, undefined, undefined)).toEqual([])
  })
})
