import { finAffichee, phasesPassees, derniereSemainePhase, phaseDuMois, finNouvellePhase, ecartPesees, dureeProlongee, phaseA as phaseDuJour, ajouterApres, avancePoids, avisRythme, caloriesPhase, dureePhase, ecartPhase, finApres, lireFrise, modifier, nomCourtPhase, nomPhase, objectifsA, periodes, phaseA, phaseAffichee, poidsDepart, poidsSemaine, supprimerPhase, terminerPhase, textePhase, typePhase, type EtapeObjectifs } from './objectifs'

describe('dernière semaine d’une phase', () => {
  it('les 7 derniers jours, pas avant, pas après', () => {
    const p = { finPrevue: '2026-11-09' }
    expect(derniereSemainePhase(p, '2026-11-01')).toBe(false)
    expect(derniereSemainePhase(p, '2026-11-02')).toBe(true)
    expect(derniereSemainePhase(p, '2026-11-08')).toBe(true)
    expect(derniereSemainePhase(p, '2026-11-09')).toBe(false)
    expect(derniereSemainePhase({}, '2026-11-08')).toBe(false)
  })
})

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
    expect(phaseAffichee(h, '2026-12-01')).toMatchObject({ phase: 'seche', aVenir: false })
    // Sans phase en cours, c'est la prochaine qu'on annonce.
    expect(phaseAffichee(modifier(g, '2026-12-20', { phase: 'prise' }), '2026-12-05')).toMatchObject({ phase: 'prise', aVenir: true })
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

describe('audit objectifs', () => {
  it('calories fixées à la main : gardées quand on change le volume, la fin ou le poids visé ; oubliées au changement de phase', () => {
    let f = modifier([], '2026-09-01', { phase: 'seche', calories: 2000 })
    f = modifier(f, '2026-09-10', { finPrevue: '2026-12-01' })
    f = modifier(f, '2026-09-20', { volume: { pecs: 14 } })
    f = modifier(f, '2026-09-25', { ecartVise: -4 })
    expect(objectifsA(f, '2026-09-26')?.calories).toBe(2000)
    f = modifier(f, '2026-10-01', { phase: 'prise' })
    expect(objectifsA(f, '2026-10-02')?.calories).toBeUndefined()
  })
})

describe('audit rythme visé', () => {
  it('le texte donne la zone exacte où il n’y a plus de message', () => {
    // Prise : rien entre +0,15 et +0,4 kg par semaine, donc c'est cette zone que le texte conseille.
    expect(avisRythme('prise', 0.3 * 8, 8)).toBeNull()
    expect(avisRythme('prise', 0.1 * 8, 8)).toMatch(/\+0,15 à \+0,4 kg par semaine/)
    expect(avisRythme('prise', 0.5 * 8, 8)).toMatch(/\+0,15 à \+0,4 kg par semaine/)
    // Sèche : rien entre −0,2 et −1 kg par semaine.
    expect(avisRythme('seche', -0.25 * 8, 8)).toBeNull()
    expect(avisRythme('seche', -0.1 * 8, 8)).toMatch(/−0,2 à −1 kg par semaine/)
    expect(avisRythme('seche', -1.2 * 8, 8)).toMatch(/−0,2 à −1 kg par semaine/)
  })
})

describe('fin de phase affichée', () => {
  it('le texte donne le dernier jour de la phase, comme Objectifs (12 semaines du 1 nov. : jusqu’au 23 janv.)', () => {
    const f = modifier([], '2026-11-01', { phase: 'prise', finPrevue: finApres('2026-11-01', 12) })
    expect(textePhase(f, '2026-11-01', (iso) => iso)).toMatch(/fin prévue le 2027-01-23/)
  })
})

describe('objectifs propres à chaque phase', () => {
  const base: EtapeObjectifs[] = [
    { depuis: '2026-10-01', phase: 'prise', finPrevue: '2026-12-01', volume: {}, calories: 3000 },
    { depuis: '2026-12-01', phase: 'seche', finPrevue: '2027-02-01', volume: {} },
  ]

  it('chaque phase garde ses calories, et le jour du changement elles prennent le relais', () => {
    const f = caloriesPhase(base, '2026-12-01', 2500, '2026-11-03')
    expect(periodes(f).map((p) => p.calories)).toEqual([3000, 2500])
    expect(objectifsA(f, '2026-11-30')?.calories).toBe(3000)
    expect(objectifsA(f, '2026-12-01')?.calories).toBe(2500)
  })

  it('changer les calories de la phase en cours ne réécrit pas le passé', () => {
    const f = caloriesPhase(base, '2026-10-01', 2800, '2026-11-03')
    expect(objectifsA(f, '2026-11-02')?.calories).toBe(3000)
    expect(objectifsA(f, '2026-11-03')?.calories).toBe(2800)
    expect(periodes(f)[0].calories).toBe(2800)
  })

  it('changer le type d’une phase à venir oublie son poids et ses calories', () => {
    const f = caloriesPhase(ecartPhase(base, '2026-12-01', -4, '2026-11-03'), '2026-12-01', 2500, '2026-11-03')
    const p = periodes(typePhase(f, '2026-12-01', 'maintien'))[1]
    expect(p.ecartVise).toBeUndefined()
    expect(p.calories).toBeUndefined()
  })

  it('un maintien n’a jamais de poids visé, même dans une ancienne frise', () => {
    expect(periodes([{ depuis: '2026-10-01', phase: 'maintien', ecartVise: 2, volume: {} }])[0].ecartVise).toBeUndefined()
  })

  it('la prise s’appelle « Prise de muscle », « Prise » quand la place manque', () => {
    expect(nomPhase('prise')).toBe('Prise de muscle')
    expect(nomCourtPhase('prise')).toBe('Prise')
  })
})

describe('phase dont la fin prévue est passée', () => {
  const f = [{ depuis: '2026-07-27', phase: 'prise' as const, finPrevue: '2026-11-16', volume: {} }]

  it('dépassée à partir de sa fin prévue, pas la veille', () => {
    expect(phaseDuJour(f, '2026-11-15')?.depassee).toBe(false)
    expect(phaseDuJour(f, '2026-11-16')?.depassee).toBe(true)
  })

  it('prolonger part d’aujourd’hui : la nouvelle fin est dans le futur, même après un long retard', () => {
    // 15 févr. = 29 semaines après le début (203 jours) : 29 + 4 = 33 semaines.
    const n = dureeProlongee('2026-07-27', '2026-11-16', '2027-02-15')
    expect(n).toBe(33)
    expect(finApres('2026-07-27', n) > '2027-02-15').toBe(true)
  })
})

describe('évolution du poids sur la courbe', () => {
  it('moyenne des 7 derniers jours face aux 7 premiers : une pesée isolée ne fausse rien', () => {
    const l = [
      { date: '2026-10-01', poids: 80 },
      { date: '2026-10-03', poids: 81 },
      { date: '2026-10-20', poids: 81 },
      { date: '2026-10-29', poids: 82 },
      { date: '2026-10-31', poids: 83 },
    ]
    expect(ecartPesees(l)).toBeCloseTo(82.5 - 80.5)
  })
  it('moins de 2 semaines : première face à dernière ; une seule pesée : rien', () => {
    expect(ecartPesees([{ date: '2026-10-01', poids: 80 }, { date: '2026-10-05', poids: 80.5 }])).toBeCloseTo(0.5)
    expect(ecartPesees([{ date: '2026-10-01', poids: 80 }])).toBeNull()
  })
})

describe('nouvelle phase quand une autre est déjà prévue', () => {
  const f = [{ depuis: '2026-11-20', phase: 'seche' as const, volume: {} }]
  it('elle s’arrête où commence la suivante', () => {
    expect(finNouvellePhase(f, '2026-11-03', 12)).toBe('2026-11-20')
  })
  it('sans chevauchement, sa durée normale', () => {
    expect(finNouvellePhase(f, '2026-11-03', 1)).toBe('2026-11-10')
    expect(finNouvellePhase([], '2026-11-03', 12)).toBe('2027-01-26')
  })
})

describe('phase écrite sur un mois du calendrier', () => {
  const f = [
    { depuis: '2026-07-27', phase: 'prise' as const, finPrevue: '2026-11-16', volume: {} },
    { depuis: '2026-11-16', phase: 'seche' as const, finPrevue: '2027-01-11', volume: {} },
  ]
  it('un mois d’avant la première phase n’en affiche aucune', () => {
    expect(phaseDuMois(f, '2026-05-01', '2026-05-31', '2026-11-03')).toBeUndefined()
  })
  it('un mois où la phase commence en cours de route l’affiche', () => {
    expect(phaseDuMois(f, '2026-07-01', '2026-07-31', '2026-11-03')).toBe('prise')
  })
  it('dans le mois en cours, la phase d’aujourd’hui', () => {
    expect(phaseDuMois(f, '2026-11-01', '2026-11-30', '2026-11-03')).toBe('prise')
    expect(phaseDuMois(f, '2026-11-01', '2026-11-30', '2026-11-25')).toBe('seche')
  })
})

describe('phases passées', () => {
  const frise = [
    { depuis: '2026-01-05', phase: 'seche', finPrevue: '2026-03-02' },
    { depuis: '2026-03-02', phase: 'maintien', finPrevue: '2026-04-06' },
    { depuis: '2026-04-06', phase: 'prise', finPrevue: '2026-12-01' },
    { depuis: '2026-12-01', phase: 'seche', finPrevue: '2027-02-01' },
  ] as EtapeObjectifs[]
  it('de la plus récente à la plus ancienne, sans celle en cours ni celles à venir', () => {
    expect(phasesPassees(frise, '2026-11-04').map((p) => p.phase)).toEqual(['maintien', 'seche'])
  })
  it('aucune tant que la première phase est en cours', () => {
    expect(phasesPassees(frise, '2026-02-01')).toEqual([])
    expect(phasesPassees([], '2026-02-01')).toEqual([])
  })
})

describe('calendrier : le dernier jour d’une phase est la veille de sa fin prévue', () => {
  it('fin prévue le 26 janv. (1er jour de la suite) : le 25 est le dernier jour colorié, pas le 26', () => {
    const [p] = periodes([{ depuis: '2026-11-03', phase: 'prise', finPrevue: '2027-01-26', volume: {} }] as never)
    expect(finAffichee(p, '2026-11-11')).toBe('2027-01-25')
  })
  it('une phase qui finit le 31 janv. n’étiquette pas février', () => {
    const f = [{ depuis: '2026-11-03', phase: 'prise', finPrevue: '2027-02-01', volume: {} }] as never
    expect(phaseDuMois(f, '2027-01-01', '2027-01-31', '2026-11-11')).toBe('prise')
    expect(phaseDuMois(f, '2027-02-01', '2027-02-28', '2026-11-11')).toBeUndefined()
  })
  it('fin dépassée : la phase court jusqu’à aujourd’hui', () => {
    const [p] = periodes([{ depuis: '2026-09-01', phase: 'seche', finPrevue: '2026-10-01', volume: {} }] as never)
    expect(finAffichee(p, '2026-11-11')).toBe('2026-11-11')
  })
})
