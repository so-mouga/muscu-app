import { EXERCICES } from '../data/exercices'
import type { Seance } from '../types'
import { analyser, analyserDates, aRetenir, ceQuiMonte, erreurDates, essentiel, lecturePhase, libelleMesure, semaineOuverte, semainesEntieres, semainesFinies, type Analyse } from './analyse'
import { cibles } from './cycle'

const seance = (id: string, date: string, smith: number[], extra: Partial<Seance> = {}): Seance =>
  ({
    id,
    date,
    nom: 'Haut A',
    debut: Date.parse(date + 'T10:00:00'),
    fin: Date.parse(date + 'T11:00:00'),
    enCours: false,
    exercices: [],
    chauffes: {},
    notes: {},
    ajustSeries: {},
    series: [
      ...smith.map((c, i) => ({ id: id + 's' + i, exoId: 'smith_incline', type: 'normale' as const, charge: c, reps: 10, rpe: 8, heure: 0 })),
      { id: id + 't', exoId: 'tirage_large', type: 'normale' as const, charge: 60, reps: 10, rpe: 8, heure: 0 },
    ],
    ...extra,
  }) as Seance

const donnees = (seances: Seance[]) => ({
  seances,
  pesees: [
    { date: '2026-10-05', poids: 74 },
    { date: '2026-10-26', poids: 73.5 },
  ],
  mesures: [
    { date: '2026-10-05', valeurs: { taille: 85 } },
    { date: '2026-10-26', valeurs: { taille: 84 } },
  ],
  exo: (id: string) => EXERCICES[id],
  exercices: EXERCICES,
  cibles: cibles(),
})

const seances = [
  seance('a', '2026-10-05', [50, 50]),
  seance('b', '2026-10-12', [52.5, 52.5]),
  seance('c', '2026-10-19', [55, 55]),
  seance('d', '2026-10-26', [57.5, 57.5]),
]

describe('force du Bilan : ce qui a vraiment été soulevé', () => {
  const serie = (id: string, charge: number, reps: number, rpe = 8) => ({ id, exoId: 'smith_incline', type: 'normale' as const, charge, reps, rpe, heure: 0 })
  const avec = (id: string, date: string, s: ReturnType<typeof serie>) => ({ ...seance(id, date, []), series: [s] })
  const pctDe = (l: Seance[]) => analyser(donnees(l), '2026-10-05', '2026-11-01', 2).progressions.find((p) => p.exo.id === 'smith_incline')!.pct
  it('monter la charge alors que les reps repartent au bas : hausse, jamais une baisse de force', () => {
    expect(pctDe([avec('a', '2026-10-05', serie('a', 50, 12)), avec('b', '2026-10-26', serie('b', 52.5, 8))])).toBeCloseTo(5)
  })
  it('mêmes charge et reps : l’effort noté ne compte jamais, ni un point ni deux', () => {
    expect(pctDe([avec('a', '2026-10-05', serie('a', 50, 10, 8)), avec('b', '2026-10-26', serie('b', 50, 10, 9))])).toBe(0)
    expect(pctDe([avec('a', '2026-10-05', serie('a', 50, 10, 7)), avec('b', '2026-10-26', serie('b', 50, 10, 9))])).toBe(0)
    expect(pctDe([avec('a', '2026-10-05', serie('a', 50, 10, 9)), avec('b', '2026-10-26', serie('b', 50, 10, 6))])).toBe(0)
  })
  it('moins de reps à la même charge reste une baisse', () => {
    expect(pctDe([avec('a', '2026-10-05', serie('a', 50, 10)), avec('b', '2026-10-26', serie('b', 50, 8))])).toBeLessThan(0)
  })
  it('en prise, une charge montée ne fait plus dire « tes charges ne montent pas »', () => {
    const deux = (id: string, date: string, c: number, reps: number) => ({ ...seance(id, date, []), series: [serie(id, c, reps), { ...serie(id + 't', c + 10, reps), exoId: 'tirage_large' }] })
    const a = analyser(donnees([deux('a', '2026-10-05', 50, 12), deux('b', '2026-10-12', 50, 12), deux('c', '2026-10-19', 52.5, 8), deux('d', '2026-10-26', 52.5, 8)]), '2026-10-05', '2026-11-01', 2, 'prise')
    expect(a.progressions).toHaveLength(2)
    expect(a.progressions.every((p) => p.pct > 0)).toBe(true)
    expect(lecturePhase(a, 'prise').join()).not.toContain('ne montent pas')
  })
})

describe('régularité après un changement de programme', () => {
  it('chaque semaine est jugée sur ce qui était prévu à ce moment-là, sans reproche', () => {
    const l = ['2026-10-05', '2026-10-08', '2026-10-12', '2026-10-15', '2026-10-19', '2026-10-22', '2026-10-26'].map((d, i) => seance(`r${i}`, d, [50]))
    const a = analyser(donnees(l), '2026-10-05', '2026-11-01', (lundi) => (lundi >= '2026-11-02' ? 4 : 2))
    expect([a.faites, a.prevues]).toEqual([7, 8])
    expect(essentiel(a, null).map((x) => x.texte).join()).not.toContain('prévues')
    const b = analyser(donnees(l), '2026-10-05', '2026-11-01', 4)
    expect([b.faites, b.prevues]).toEqual([7, 16])
  })
})

describe('analyse d’une période', () => {
  const a = analyser(donnees(seances), '2026-10-05', '2026-11-01', 2)
  it('assiduité, volume, records, progressions, stagnations', () => {
    expect(a.seances).toBe(4)
    expect(a.prevues).toBe(8)
    expect(a.enchainees).toBe(4)
    expect(a.volume.pecs).toBe(2)
    expect(a.records.map((r) => r.exo.id)).toEqual(['smith_incline', 'smith_incline', 'smith_incline'])
    expect(a.progressions[0].exo.id).toBe('smith_incline')
    expect(a.stagnations).toEqual([])
    expect(a.poids).toEqual({ debut: 74, fin: 73.5, semaines: 3 })
  })
  it('stagnation : tirage identique pendant 6 semaines d’entraînement, le smith qui monte n’y est pas', () => {
    const l = Array.from({ length: 7 }, (_, i) => seance(`s${i}`, new Date(Date.parse('2026-09-21T12:00:00') + i * 7 * 86400000).toISOString().slice(0, 10), [50 + i * 2.5]))
    const b = analyser(donnees(l), '2026-10-05', '2026-11-08', 2)
    expect(b.stagnations.map((s) => s.exo.id)).toEqual(['tirage_large'])
    expect(aRetenir(b, null, cibles()).join('\n')).toContain('Tirage vertical prise large : pas de progrès depuis 6 semaines')
  })
  it('à retenir : assiduité, muscles, stagnation, recompo, records', () => {
    const t = aRetenir(a, null, cibles()).join('\n')
    expect(t).toContain('4 séances sur 8 prévues')
    expect(t).toContain('aucune série dure')
    expect(t).toContain('Dos un peu léger : 1 série dure par semaine, le conseil est à 10')
    expect(t).toContain('et 3 autres : aucune série dure')
    // 5 phrases au plus : la recompo et les records passent après
    expect(aRetenir(a, null, cibles()).length).toBeLessThanOrEqual(5)
  })
  it('peu de données : le dit au lieu d’inventer', () => {
    expect(aRetenir(analyser(donnees(seances.slice(0, 1)), '2026-10-05', '2026-10-11'), null, cibles())[0]).toContain('Pas encore assez')
  })
  it('cale le début sur la 1re séance quand l’historique est plus court que la période', () => {
    const court = analyser(donnees(seances.slice(1)), '2026-10-05', '2026-11-01', 4)
    expect(court.debut).toBe('2026-10-12')
    expect(court.semaines).toHaveLength(3)
    expect(court.prevues).toBe(12)
  })
  it('assiduité par semaine : les séances en plus ne rattrapent pas une semaine sautée', () => {
    const charge = [seance('a', '2026-10-05', [50]), seance('b', '2026-10-06', [50]), seance('c', '2026-10-07', [50]), seance('d', '2026-10-19', [50])]
    const x = analyser(donnees(charge), '2026-10-05', '2026-10-25', 2)
    expect([x.faites, x.enPlus, x.prevues]).toEqual([3, 1, 6])
    expect(aRetenir(x, null, cibles()).join('\n')).toContain('3 séances sur 6 prévues (+1 en plus)')
  })
  it('compare à la dernière séance avant la période sur 1 semaine et signale les douleurs', () => {
    const avecDouleur = [
      ...seances.slice(0, 3),
      seance('d', '2026-10-26', [57.5, 57.5], {
        series: [
          { id: 'ds0', exoId: 'smith_incline', type: 'normale', charge: 57.5, reps: 10, rpe: 8, heure: 0, douleur: true },
          { id: 'dt', exoId: 'elevation_poulie', type: 'normale', charge: 12, reps: 12, rpe: 8, heure: 0 },
        ],
      }),
      seance('e', '2026-10-28', [57.5], {
        series: [{ id: 'et', exoId: 'elevation_poulie', type: 'normale', charge: 14, reps: 12, rpe: 8, heure: 0 }],
      }),
    ]
    const sem = analyser(donnees(avecDouleur), '2026-10-26', '2026-10-31', 4)
    expect(sem.progressions.map((p) => p.exo.id)).toContain('smith_incline')
    expect(sem.progressions.find((p) => p.exo.id === 'elevation_poulie')?.detail).toBe('12 kg × 12 → 14 kg × 12')
    expect(sem.douleurs).toHaveLength(1)
    const r = aRetenir(sem, null, cibles(), true).join('\n')
    expect(r).toContain('⚠️ Douleur signalée')
    expect(r).not.toContain('sur 4 prévues')
    expect(r).not.toContain('aucune série dure')
    expect(libelleMesure('bras_g')).toBe('Bras gauche')
  })
})

describe('lecture selon la phase', () => {
  const base = (pcts: number[], poids: [number, number, number] | null) =>
    ({ seances: 8, progressions: pcts.map((pct) => ({ pct })), poids: poids && { debut: poids[0], fin: poids[1], semaines: poids[2] } }) as unknown as Analyse

  it('sèche : force en baisse et perte trop rapide signalées', () => {
    const t = lecturePhase(base([-6, -8], [80, 76, 4]), 'seche').join('\n')
    expect(t).toMatch(/charges baissent/)
    expect(t).toMatch(/Tu perds vite \(−1 kg par semaine/)
  })
  it('sèche : charges en baisse et poids immobile, jamais deux conseils opposés', () => {
    const t = lecturePhase(base([-6, -8], [80, 80.3, 4]), 'seche')
    expect(t).toHaveLength(1)
    expect(t[0]).toMatch(/le déficit n’explique pas/)
    expect(t[0]).not.toMatch(/Mange un peu plus|réduis/)
  })
  it('sèche réussie : poids qui baisse, charges tenues', () => {
    expect(lecturePhase(base([1, -1], [80, 78.4, 4]), 'seche')[0]).toMatch(/Sèche qui marche : −0,4 kg par semaine/)
  })
  it('prise : poids qui ne monte pas, charges qui stagnent', () => {
    const t = lecturePhase(base([0, -1], [75, 74.8, 3]), 'prise').join('\n')
    expect(t).toMatch(/ton poids ne monte pas/)
    expect(t).toMatch(/charges ne montent pas/)
  })
  it('prise : poids qui monte trop peu ou trop vite, corrigé de 100 kcal', () => {
    expect(lecturePhase(base([4, 6], [75, 75.2, 4]), 'prise')[0]).toMatch(/ton poids monte trop peu \(\+0,05 kg par semaine\)/)
    expect(lecturePhase(base([4, 6], [75, 77, 4]), 'prise')[0]).toMatch(/Tu prends vite .* baisse de 100 kcal/)
  })
  it('prise qui marche ; maintien : rien de spécial ; trop peu de données : rien', () => {
    expect(lecturePhase(base([4, 6], [75, 76, 4]), 'prise')[0]).toMatch(/Prise qui marche : \+0,25 kg par semaine/)
    expect(lecturePhase(base([4, 6], [75, 76, 4]), 'maintien')).toEqual([])
    expect(lecturePhase(base([4], [75, 76, 1]), 'prise')).toEqual([])
  })
})

describe('calories et sommeil dans la lecture', () => {
  const base = (cal: { ok: number; trop: number; pasAssez: number }) =>
    ({ seances: 8, progressions: [{ pct: 1 }, { pct: 2 }], poids: { debut: 80, fin: 80.2, semaines: 4 }, calories: cal }) as unknown as Analyse

  it('sèche, poids immobile mais calories tenues : l’objectif est trop haut', () => {
    expect(lecturePhase(base({ ok: 6, trop: 1, pasAssez: 0 }), 'seche')[0]).toMatch(/objectif est peut-être trop haut/)
    expect(lecturePhase(base({ ok: 2, trop: 3, pasAssez: 0 }), 'seche')[0]).toMatch(/3 jours notés au-dessus/)
  })
  it('phase commencée en cours de période : jugée seulement depuis son début', () => {
    const a = { ...base({ ok: 0, trop: 0, pasAssez: 0 }), douleurs: [], prevues: null, volume: {}, stagnations: [], mesures: [], records: [], rpe: null, energie: null, sommeil: null } as unknown as Analyse
    const debutPhase = { ...a, progressions: [], poids: { debut: 80, fin: 80.2, semaines: 1 } } as Analyse
    const t = aRetenir(a, null, cibles(), true, 'seche', debutPhase).join('\n')
    expect(t).not.toMatch(/ne baisse pas/)
    expect(t).toMatch(/pas encore assez de données depuis le début de la phase/)
  })
  it('sommeil court signalé dans « À retenir »', () => {
    const a = { ...base({ ok: 0, trop: 0, pasAssez: 0 }), douleurs: [], prevues: null, volume: {}, stagnations: [], mesures: [], records: [], rpe: null, energie: null, sommeil: { moyenne: 6, nuits: 5 } } as unknown as Analyse
    expect(aRetenir(a, null, cibles(), true).join('\n')).toMatch(/Sommeil moyen 6 h 00 sur 5 nuits/)
  })
})

describe('force du Bilan mesurée comme les blocages', () => {
  const avec = (id: string, date: string, smith: number[], finisseur?: [number, number]) => {
    const s = seance(id, date, smith)
    if (finisseur) s.series.push({ id: id + 'f', exoId: 'smith_incline', type: 'echec', charge: finisseur[0], reps: finisseur[1], rpe: 10, heure: 0 })
    return s
  }
  const smithDe = (a: Analyse) => a.progressions.find((p) => p.exo.id === 'smith_incline')

  it('une série d’échec, un drop ou un rest-pause ne compte pas dans la force', () => {
    // Mêmes séries de travail ; seule la 2e séance a un finisseur à 15 reps (1RM estimé plus haut).
    const a = analyser(donnees([avec('a', '2026-10-05', [60]), avec('b', '2026-10-12', [60], [60, 15])]), '2026-10-05', '2026-10-18')
    expect(smithDe(a)?.pct).toBe(0)
  })

  it('meilleure des 2 premières séances face à la meilleure des 2 dernières', () => {
    // 55 → 60 → 62 → 60 : +3,3 % (60 → 62), pas +9 % (55 → 60).
    const a = analyser(donnees(['a', 'b', 'c', 'd'].map((id, i) => seance(id, `2026-10-${String(5 + 7 * i).padStart(2, '0')}`, [[55, 60, 62, 60][i]]))), '2026-10-05', '2026-11-01')
    expect(smithDe(a)?.pct).toBeCloseTo((62 / 60 - 1) * 100, 5)
  })

  it('sommeil court : le message dit le même seuil que l’alerte (6 h 30)', () => {
    const a = analyser({ ...donnees(seances), journal: ['2026-10-06', '2026-10-07', '2026-10-08'].map((date) => ({ date, sommeil: 6 })) }, '2026-10-05', '2026-11-01', 2)
    const msg = aRetenir(a, null, cibles()).find((t) => t.startsWith('Sommeil'))
    expect(msg).toMatch(/sous 6 h 30/)
    expect(msg).not.toMatch(/7 h/)
  })

  it('À retenir à l’écran : 3 lignes au plus, la douleur d’abord, les blocages résumés en une ligne', () => {
    const exo = (id: string) => ({ id, nom: id }) as never
    const base = analyser(donnees(seances), '2026-10-05', '2026-10-18')
    const a = { ...base, seances: 8, prevues: null, faites: 8, sommeil: null, douleurs: [{ exo: exo('smith'), date: '2026-10-18', n: 2 }], stagnations: [{ exo: exo('butterfly'), semaines: 5, seances: 4, pistes: ['pas de déload depuis 9 semaines'] }, { exo: exo('face'), semaines: 4, seances: 3, pistes: ['pas de déload depuis 9 semaines', 'séries très dures'] }] }
    const l = essentiel(a, null)
    expect(l.length).toBeLessThanOrEqual(3)
    expect(l[0]).toMatchObject({ exoId: 'smith' })
    expect(l.find((x) => x.blocages)?.texte).toBe('2 exercices sans progrès. Piste commune : pas de déload depuis 9 semaines.')
  })
})

describe('force du Bilan : les exercices d’isolation comptent aussi', () => {
  const avec = (id: string, date: string, parExo: Record<string, number>) =>
    seance(id, date, [], { series: Object.entries(parExo).map(([exoId, charge], i) => ({ id: id + i, exoId, type: 'normale', charge, reps: 10, rpe: 8, heure: 0 })) } as Partial<Seance>)
  const stables = { smith_incline: 50, tirage_large: 60 }
  const l = [
    avec('a', '2026-10-05', { ...stables, butterfly: 30, curl_jambe_assis: 40 }),
    avec('b', '2026-10-12', { ...stables, butterfly: 30, curl_jambe_assis: 40 }),
    avec('c', '2026-10-19', { ...stables, butterfly: 21, curl_jambe_assis: 28 }),
    avec('d', '2026-10-26', { ...stables, butterfly: 21, curl_jambe_assis: 28 }),
  ]

  it('une isolation qui baisse entre dans la moyenne : (0 + 0 − 30 − 30) / 4 = −15 %', () => {
    const a = analyser(donnees(l), '2026-10-05', '2026-11-01')
    expect(a.progressions.map((p) => Math.round(p.pct))).toEqual([0, 0, -30, -30])
    expect(lecturePhase({ ...a, poids: null }, 'seche')[0]).toContain('tes charges baissent (−15 % en moyenne)')
  })

  it('une force qui ne bouge pas s’écrit ±0 %, pas −0 %', () => {
    const plat = [avec('a', '2026-10-05', stables), avec('b', '2026-10-12', stables)]
    const a = analyser(donnees(plat), '2026-10-05', '2026-11-01')
    const lignes = lecturePhase({ ...a, seances: 4, poids: { debut: 80, fin: 80.1, semaines: 3 } }, 'prise')
    expect(lignes.join(' ')).toContain('(±0 %)')
    expect(lignes.join(' ')).not.toContain('−0')
  })
})

describe('semaine en pause dans le Bilan', () => {
  const l = ['2026-10-05', '2026-10-07', '2026-10-19', '2026-10-21', '2026-10-26'].map((d) => seance(d, d, [50, 50, 50]))
  const cycles = [{ pauses: ['2026-10-12'] }] as never
  const a = analyser({ ...donnees(l), cycles }, '2026-10-05', '2026-11-01', 2)

  it('elle ne compte pas dans le prévu : 5 séances sur 6, pas sur 8', () => {
    expect(a.prevues).toBe(6)
    expect(a.faites).toBe(5)
    expect(essentiel(a, null).some((x) => x.texte.includes('prévues'))).toBe(false)
  })

  it('le volume est la moyenne des 3 semaines réelles', () => {
    expect(a.volume.pecs).toBe(5)
  })

  it('une séance faite pendant la pause compte en plus, pas dans le prévu', () => {
    const b = analyser({ ...donnees([...l, seance('p', '2026-10-13', [50])]), cycles }, '2026-10-05', '2026-11-01', 2)
    expect([b.prevues, b.faites, b.enPlus]).toEqual([6, 5, 1])
  })
})

describe('semaines finies pour les jauges de muscles', () => {
  it('compte depuis la semaine de la première séance, la semaine en cours n’en fait pas partie', () => {
    // Première séance le vendredi 30 oct., semaine du lundi 26 oct.
    expect(semainesFinies(['2026-11-03', '2026-10-30'], '2026-11-02')).toBe(1)
    expect(semainesFinies(['2026-10-30'], '2026-11-09')).toBe(2)
    expect(semainesFinies(['2026-11-03'], '2026-11-02')).toBe(0)
  })
  it('sans séance : zéro', () => {
    expect(semainesFinies([], '2026-11-02')).toBe(0)
  })
})

describe('Bilan sur des dates au choix', () => {
  it('refuse moins de 7 jours, des dates inversées ou manquantes, et une fin à venir', () => {
    expect(erreurDates('2026-11-01', '2026-11-04', '2026-11-04')).toMatch(/au moins 7 jours/)
    expect(erreurDates('2026-10-29', '2026-11-04', '2026-11-04')).toBeNull()
    expect(erreurDates('2026-11-04', '2026-10-01', '2026-11-04')).toMatch(/avant la date de fin/)
    expect(erreurDates('', '2026-11-04', '2026-11-04')).toMatch(/deux dates/)
    expect(erreurDates('2026-10-01', '2026-11-05', '2026-11-04')).toMatch(/passée/)
  })

  it('trouve les semaines entières, du premier lundi au dernier dimanche', () => {
    // Mardi 1er sept. → mercredi 4 nov. : du lundi 7 sept. au dimanche 1er nov.
    expect(semainesEntieres('2026-09-01', '2026-11-04')).toEqual({ debut: '2026-09-07', fin: '2026-11-01', n: 8 })
    expect(semainesEntieres('2026-10-05', '2026-11-01')).toEqual({ debut: '2026-10-05', fin: '2026-11-01', n: 4 })
    // Mercredi → mardi : 7 jours, mais aucune semaine entière.
    expect(semainesEntieres('2026-10-07', '2026-10-13')).toBeNull()
  })

  it('une semaine coupée ne fait croire ni à des séances manquées, ni à un volume trop bas', () => {
    const lundis = ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']
    const tout = lundis.flatMap((l) => [seance(l, l, [50, 50])])
    const entieres = analyser(donnees(tout), '2026-10-05', '2026-11-01', 1)
    // Mêmes séances, avec un mercredi avant et un début de semaine après, sans séance.
    const r = analyserDates(donnees(tout), '2026-09-30', '2026-11-04', 1)
    expect(r.coupees).toBe(true)
    expect(r.entieres).toBe(4)
    expect(r.analyse.prevues).toBe(4)
    expect(r.analyse.faites).toBe(4)
    expect(r.analyse.volume.dos).toBeCloseTo(entieres.volume.dos)
    expect(analyser(donnees(tout), '2026-09-30', '2026-11-04', 1).volume.dos).toBeLessThan(entieres.volume.dos)
  })

  it('des semaines entières ne changent rien', () => {
    const r = analyserDates(donnees(seances), '2026-10-05', '2026-11-01', 1)
    expect(r.coupees).toBe(false)
    expect(r.analyse.volume).toEqual(analyser(donnees(seances), '2026-10-05', '2026-11-01', 1).volume)
  })

  it('sans semaine entière : pas de prévu, et le volume suit la durée réelle', () => {
    const r = analyserDates(donnees([seance('a', '2026-10-08', [50, 50])]), '2026-10-07', '2026-10-13', 3)
    expect(r.entieres).toBe(0)
    expect(r.analyse.prevues).toBeNull()
    // Une séance sur exactement 7 jours : tout son volume compte pour la semaine.
    expect(r.analyse.volume.dos).toBeCloseTo(analyser(donnees([seance('a', '2026-10-08', [50, 50])]), '2026-10-05', '2026-10-11', 3).volume.dos)
  })
})

describe('séance allégée pour un seul jour', () => {
  const lundis = ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']
  const normales = lundis.map((l) => seance(l, l, [50, 50]))
  const legere = (extra: Partial<Seance>) => seance('l', '2026-10-14', [45, 45], { deload: true, ...extra })
  it('ne gonfle pas le volume : sa semaine reste comptée, et ses séries aussi', () => {
    const sans = analyser(donnees(normales), '2026-10-05', '2026-11-01', 1)
    const avec = analyser(donnees([...normales, legere({ allegeeSeule: true })]), '2026-10-05', '2026-11-01', 1)
    expect(avec.volume.dos).toBeCloseTo(sans.volume.dos + 1 / 4)
    expect(avec.seances).toBe(sans.seances + 1)
  })
  it('une vraie semaine allégée reste écartée du volume', () => {
    const r = analyser(donnees([...normales.filter((s) => s.date !== '2026-10-12'), seance('l', '2026-10-12', [45, 45], { deload: true })]), '2026-10-05', '2026-11-01', 1)
    expect(r.volume.dos).toBeCloseTo(1)
  })
  it('ne compte ni pour les records, ni pour les progrès', () => {
    const forte = seance('f', '2026-10-14', [90, 90], { deload: true, allegeeSeule: true })
    const r = analyser(donnees([...normales, forte]), '2026-10-05', '2026-11-01', 1)
    expect(r.records.filter((x) => x.date === '2026-10-14')).toEqual([])
  })
})

describe('semaine que le Bilan ne lit pas encore', () => {
  it('en semaine, la semaine en cours ; le dimanche, la suivante', () => {
    expect(semaineOuverte(new Date('2026-11-09T09:00:00'))).toBe('2026-11-09')
    expect(semaineOuverte(new Date('2026-11-14T22:00:00'))).toBe('2026-11-09')
    expect(semaineOuverte(new Date('2026-11-15T08:00:00'))).toBe('2026-11-16')
    expect(semaineOuverte(new Date('2026-11-16T07:00:00'))).toBe('2026-11-16')
  })

  it('le dimanche, une première semaine compte déjà', () => {
    expect(semainesFinies(['2026-11-09', '2026-11-11'], semaineOuverte(new Date('2026-11-15T10:00:00')))).toBe(1)
    expect(semainesFinies(['2026-11-09', '2026-11-11'], semaineOuverte(new Date('2026-11-14T10:00:00')))).toBe(0)
  })
})

describe('Bilan : « Ce qui monte » et « Ce qui bloque » ne se contredisent pas', () => {
  const smith = (id: string, date: string, charge: number, reps: number, rpe = 8) => ({ ...seance(id, date, []), series: [{ id, exoId: 'smith_incline', type: 'normale' as const, charge, reps, rpe, heure: 0 }] })
  it('8 semaines identiques, les deux dernières notées plus faciles : bloqué, et pas dans « ce qui monte »', () => {
    const l = Array.from({ length: 8 }, (_, k) => smith(`s${k}`, new Date(Date.parse('2026-09-07T12:00:00') + k * 7 * 86400000).toISOString().slice(0, 10), 60, 10, k >= 6 ? 6 : 8))
    const a = analyser(donnees(l), '2026-10-05', '2026-11-01', 1)
    const r = ceQuiMonte(a)
    expect(r.bloques.map((x) => x.id)).toEqual(['smith_incline'])
    expect(r.montent).toEqual([])
    expect(a.progressions.find((p) => p.exo.id === 'smith_incline')).toMatchObject({ sens: 0, pct: 0 })
    expect(a.records).toEqual([])
  })
  it('charge montée et reps reparties au bas : dans « ce qui monte », avec le gain en kilos et jamais un pourcentage de force', () => {
    const a = analyser(donnees([smith('a', '2026-10-05', 60, 12), smith('b', '2026-10-26', 62.5, 8, 9)]), '2026-10-05', '2026-11-01', 1)
    expect(ceQuiMonte(a).montent).toEqual([{ id: 'smith_incline', nom: EXERCICES.smith_incline.nom, detail: '60 kg × 12 → 62,5 kg × 8 · record', valeur: '+2,5 kg' }])
  })
})
