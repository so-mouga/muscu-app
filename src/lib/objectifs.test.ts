import { lireFrise, modifier, objectifsA, periodes, phaseA, phaseAffichee, textePhase } from './objectifs'

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

  it('« Aucune » arrête la phase ; une phase peut être prévue à l’avance', () => {
    const g = modifier(f, '2026-12-01', { phase: undefined })
    expect(periodes(g).at(-1)).toEqual({ phase: 'seche', debut: '2026-11-10', fin: '2026-11-30' })
    expect(phaseA(g, '2026-12-05')).toBeNull()
    // Prise prévue le 7 déc., vue le 1er : à venir, la sèche reste en cours jusque-là.
    const h = modifier(f, '2026-12-07', { phase: 'prise' })
    expect(phaseAffichee(h, '2026-12-01')).toMatchObject({ phase: 'prise', aVenir: true, enCours: { phase: 'seche' } })
    expect(phaseA(h, '2026-12-01')?.phase).toBe('seche')
    // Volume changé aujourd'hui : il vaut aussi pour la phase déjà prévue.
    expect(objectifsA(modifier(h, '2026-12-01', { volume: { pecs: 12 } }), '2026-12-08')?.volume).toEqual({ pecs: 12 })
  })

  it('reprend les anciens réglages', () => {
    expect(lireFrise(undefined, [{ phase: 'seche', depuis: '2026-10-31' }], { pecs: 12 })).toEqual([{ depuis: '2026-10-31', phase: 'seche', volume: { pecs: 12 } }])
    expect(lireFrise(undefined, undefined, { pecs: 12 })).toEqual([{ depuis: '2000-01-01', volume: { pecs: 12 } }])
    expect(lireFrise(undefined, undefined, undefined)).toEqual([])
  })
})
