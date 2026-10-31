import { ajouterApres, avancePoids, avisRythme, dureePhase, ecartPhase, finApres, lireFrise, modifier, objectifsA, periodes, phaseA, phaseAffichee, poidsDepart, poidsSemaine, supprimerPhase, terminerPhase, textePhase, typePhase } from './objectifs'

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

  it('objectif de poids : gardé pendant la phase, oublié à la suivante', () => {
    const g = modifier(modifier(f, '2026-11-12', { ecartVise: -2 }), '2026-11-20', { volume: { pecs: 14 } })
    expect(phaseA(g, '2026-11-25')).toMatchObject({ phase: 'seche', ecartVise: -2 })
    expect(textePhase(g, '2026-11-25', (d) => d)).toContain('objectif −2 kg')
    expect(objectifsA(modifier(g, '2026-12-01', { phase: 'maintien' }), '2026-12-02')?.ecartVise).toBeUndefined()
  })

  it('avance vers le poids visé : reste, rythme, atteint selon le sens de la phase', () => {
    expect(avancePoids('prise', 75, 77, '2026-11-01', '2026-12-27')).toEqual({ reste: 2, atteint: false, parSemaine: 0.25 })
    expect(avancePoids('prise', 77.05, 77, '2026-11-01')).toMatchObject({ atteint: true, parSemaine: null })
    expect(avancePoids('seche', 80, 76, '2026-11-01')).toMatchObject({ reste: -4, atteint: false, parSemaine: null })
    expect(avancePoids('seche', 75.5, 76, '2026-11-01').atteint).toBe(true)
  })

  it('reprend les anciens réglages', () => {
    expect(lireFrise(undefined, [{ phase: 'seche', depuis: '2026-10-31' }], { pecs: 12 })).toEqual([{ depuis: '2026-10-31', phase: 'seche', volume: { pecs: 12 } }])
    expect(lireFrise(undefined, undefined, { pecs: 12 })).toEqual([{ depuis: '2000-01-01', volume: { pecs: 12 } }])
    expect(lireFrise(undefined, undefined, undefined)).toEqual([])
  })
})

describe('phases en blocs', () => {
  const auj = '2026-11-04'
  const f = ajouterApres(ajouterApres(modifier([], '2026-11-02', { phase: 'prise', finPrevue: finApres('2026-11-02', 8) }), 'maintien', 2), 'prise', 12)
  const debuts = (g: typeof f) => periodes(g).map((p) => `${p.phase} ${p.debut}`)

  it('chaque phase ajoutée commence à la fin de la précédente', () => {
    expect(debuts(f)).toEqual(['prise 2026-11-02', 'maintien 2026-12-28', 'prise 2027-01-11'])
  })
  it('allonger la phase en cours décale les suivantes, sans réécrire le passé', () => {
    const g = dureePhase(f, '2026-11-02', 10, auj)
    expect(debuts(g)).toEqual(['prise 2026-11-02', 'maintien 2027-01-11', 'prise 2027-01-25'])
    expect(objectifsA(g, '2026-11-03')?.finPrevue).toBe('2026-12-28')
    expect(objectifsA(g, auj)?.finPrevue).toBe('2027-01-11')
  })
  it('phase à venir : durée, type et objectif modifiés sur place ; suppression', () => {
    const g = dureePhase(f, '2026-12-28', 4, auj)
    expect(debuts(g)).toEqual(['prise 2026-11-02', 'maintien 2026-12-28', 'prise 2027-01-25'])
    expect(periodes(typePhase(f, '2026-12-28', 'seche'))[1].phase).toBe('seche')
    expect(periodes(ecartPhase(f, '2027-01-11', 2, auj))[2].ecartVise).toBe(2)
    expect(debuts(supprimerPhase(f, '2027-01-11'))).toEqual(['prise 2026-11-02', 'maintien 2026-12-28'])
    // Sans le maintien du milieu, les deux prises se suivent : elles n'en font plus qu'une.
    expect(debuts(supprimerPhase(f, '2026-12-28'))).toEqual(['prise 2026-11-02'])
  })
  it('terminer la phase en cours : la suivante commence aujourd’hui', () => {
    expect(debuts(terminerPhase(f, '2026-11-02', auj))).toEqual(['prise 2026-11-02', 'maintien 2026-11-04', 'prise 2026-11-18'])
    expect(periodes(terminerPhase(f.slice(0, 1), '2026-11-02', auj))[0].fin).toBe('2026-11-03')
  })
  it('poids de départ, de la semaine, et rythme visé', () => {
    const p = [
      { date: '2026-10-28', poids: 74.6 },
      { date: '2026-11-02', poids: 75 },
      { date: '2026-11-04', poids: 75.2 },
    ]
    expect(poidsDepart(p, '2026-11-02')).toBe(75.1)
    expect(poidsDepart(p, '2026-10-24')).toBe(74.6)
    expect(poidsDepart(p, '2026-10-20')).toBeNull()
    expect(poidsSemaine(p, '2026-11-04')).toBe(75.1)
    expect(avisRythme('prise', 1, 8)).toMatch(/un peu lent/)
    expect(avisRythme('prise', 2, 8)).toBeNull()
    expect(avisRythme('seche', -6, 4)).toMatch(/trop rapide/)
  })
})
