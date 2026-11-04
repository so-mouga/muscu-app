import { EXERCICES } from '../data/exercices'
import type { Seance } from '../types'
import { blocage, deloadConseille, diagnostic, pistes, texteBlocage } from './blocages'
import { historiqueDe } from './historique'
import { conseil, suggestionPour } from './progression'

type S = [exoId: string, charge: number, reps: number, rpe: number]
const seance = (date: string, series: S[], extra: Partial<Seance> = {}): Seance =>
  ({
    id: date,
    date,
    nom: 'Haut A',
    debut: Date.parse(date + 'T10:00:00'),
    enCours: false,
    exercices: [],
    chauffes: {},
    notes: {},
    ajustSeries: {},
    series: series.map(([exoId, charge, reps, rpe], i) => ({ id: date + i, exoId, type: 'normale' as const, charge, reps, rpe, heure: 0 })),
    ...extra,
  }) as Seance
const DATES = ['2026-10-01', '2026-10-08', '2026-10-15', '2026-10-22', '2026-10-29']
const FIN = '2026-10-31'
const smith = EXERCICES.smith_incline
const butterfly = EXERCICES.butterfly
const exo = (id: string) => EXERCICES[id]

const semaines = (n: number, depart = '2026-09-07') => Array.from({ length: n }, (_, i) => new Date(Date.parse(depart + 'T12:00:00') + i * 7 * 86400000).toISOString().slice(0, 10))
const finDe = (d: string[]) => d[d.length - 1]

describe('blocage', () => {
  it('mêmes charge et reps sur 6 semaines d’entraînement : bloqué ; sur 5 : pas encore', () => {
    const d = semaines(7)
    const l = d.map((x) => seance(x, [['smith_incline', 52.5, 8, 8]]))
    expect(blocage(smith, l, finDe(d))).toEqual({ semaines: 6, seances: 6, depuis: d[0] })
    expect(blocage(smith, l.slice(0, 6), d[5])).toBeNull()
  })
  it('monter la charge est un progrès, même si les reps repartent au bas', () => {
    const d = semaines(7)
    const l = d.map((x, i) => seance(x, [['smith_incline', i < 6 ? 50 : 52.5, i < 6 ? 12 : 8, 8]]))
    expect(blocage(smith, l, finDe(d))).toBeNull()
  })
  it('une rep de plus sur une seule série, comme le conseille l’appli, est un progrès', () => {
    const d = semaines(7)
    const l = d.map((x, i) => seance(x, [['smith_incline', 50, 10, 8], ['smith_incline', 50, 9, 8], ['smith_incline', 50, i < 6 ? 8 : 9, 8]]))
    expect(blocage(smith, l, finDe(d))).toBeNull()
  })
  it('une note d’effort ne compte ni comme un progrès ni comme une référence à battre', () => {
    const d = semaines(7)
    const l = d.map((x, i) => seance(x, [['smith_incline', 52.5, 8, i === 2 ? 6 : 8]]))
    expect(blocage(smith, l, finDe(d))?.depuis).toBe(d[0])
  })
  it('isolation et poids du corps : même règle, avec ou sans pesée', () => {
    const d = semaines(7)
    expect(blocage(butterfly, d.map((x) => seance(x, [['butterfly', 30, 12, 8]])), finDe(d))?.semaines).toBe(6)
    const tractions = d.map((x, i) => seance(x, [['tractions', 5 + i * 2.5, 6, 8]], i >= 3 ? { poidsCorps: 80 } : {}))
    expect(blocage(EXERCICES.tractions, tractions, finDe(d))).toBeNull()
  })
  it('exercice assisté : moins d’assistance est un progrès', () => {
    const d = semaines(7)
    const l = d.map((x, i) => seance(x, [['tractions_assistees', i < 6 ? 30 : 25, 8, 8]]))
    expect(blocage(EXERCICES.tractions_assistees, l, finDe(d))).toBeNull()
  })
  it('baisser la charge n’est pas un progrès', () => {
    const d = semaines(8)
    const l = d.map((x, i) => seance(x, [['smith_incline', i === 1 ? 50 : 52.5, 8, 8]]))
    expect(blocage(smith, l, finDe(d))?.depuis).toBe(d[0])
  })
  it('à la charge maximale du matériel : pas de blocage', () => {
    const d = semaines(7)
    const l = d.map((x) => seance(x, [['elevation_machine', 35, 15, 8]]))
    expect(blocage(EXERCICES.elevation_machine, l, finDe(d))).not.toBeNull()
    expect(blocage({ ...EXERCICES.elevation_machine, chargeMax: 35 }, l, finDe(d))).toBeNull()
  })
  it('trop peu de séances ou exercice abandonné : rien', () => {
    const d = semaines(3)
    expect(blocage(smith, d.map((x) => seance(x, [['smith_incline', 52.5, 8, 8]])), finDe(d))).toBeNull()
    const e = semaines(7)
    expect(blocage(smith, e.map((x) => seance(x, [['smith_incline', 52.5, 8, 8]])), '2026-12-20')).toBeNull()
  })
  it('les semaines de déload ne comptent pas', () => {
    const d = semaines(7)
    const l = d.map((x, i) => seance(x, [['smith_incline', i === 3 ? 47.5 : 52.5, 8, 8]], { deload: i === 3 }))
    expect(blocage(smith, l, finDe(d))).toBeNull()
    expect(blocage(smith, [...l, seance('2026-10-26', [['smith_incline', 52.5, 8, 8]])], '2026-10-26')?.semaines).toBe(6)
  })
  it('un arrêt de 3 semaines ne compte pas, et on repart de zéro', () => {
    const avant = semaines(5)
    const apres = semaines(4, '2026-11-02')
    const l = [...avant, ...apres].map((x, i) => seance(x, [['smith_incline', 52.5, i < 5 ? 10 : 8, 8]]))
    expect(blocage(smith, l, finDe(apres))).toBeNull()
    const longue = semaines(7, '2026-11-02')
    const m = [...avant, ...longue].map((x, i) => seance(x, [['smith_incline', 52.5, i < 5 ? 10 : 8, 8]]))
    expect(blocage(smith, m, finDe(longue))?.depuis).toBe('2026-11-02')
  })
  it('en sèche, garder ses charges n’est pas un blocage', () => {
    const d = semaines(7)
    const l = d.map((x) => seance(x, [['smith_incline', 52.5, 8, 8]]))
    expect(diagnostic(smith, { seances: l, phase: 'seche' }, finDe(d))).toBeNull()
    expect(diagnostic(smith, { seances: l, phase: 'prise' }, finDe(d))).not.toBeNull()
  })
  it('le 1er jour après une sèche : rien, ses semaines ne comptent pas', () => {
    const avant = semaines(8)
    const apres = semaines(4, '2026-11-02')
    const frise = [
      { depuis: '2026-09-07', phase: 'seche' as const, volume: {} },
      { depuis: '2026-11-02', phase: 'maintien' as const, volume: {} },
    ]
    const l = [...avant, ...apres].map((x) => seance(x, [['smith_incline', 52.5, 8, 8]]))
    expect(blocage(smith, l, '2026-11-02', frise)).toBeNull()
    // 8 semaines stables avant la sèche, puis la sèche : au 1er matin d'après, aucune séance encore, le compte d'avant ne revient pas.
    const avantSeche = semaines(8, '2026-07-13').map((x) => seance(x, [['smith_incline', 52.5, 8, 8]]))
    const frise2 = [
      { depuis: '2026-07-13', phase: 'prise' as const, volume: {} },
      { depuis: '2026-09-07', phase: 'seche' as const, volume: {} },
      { depuis: '2026-11-02', phase: 'maintien' as const, volume: {} },
    ]
    expect(blocage(smith, [...avantSeche, ...avant.map((x) => seance(x, [['smith_incline', 52.5, 8, 8]]))], '2026-11-02', frise2)).toBeNull()
    expect(blocage(smith, l, finDe(apres), frise)).toBeNull()
    expect(blocage(smith, l, finDe(apres))).not.toBeNull()
  })
  it('suivre les conseils de l’appli, avec une force qui monte, n’est jamais « bloqué »', () => {
    for (const parSemaine of [0.005, 0.01, 0.02]) {
      const plan = { exoId: 'smith_incline', repos: 90, series: [1, 2, 3].map(() => ({ repsMin: 8, repsMax: 12, rpe: 8 })), charge: 50, chauffes: [], finisseur: false }
      const faites: Seance[] = []
      for (const d of semaines(52, '2026-01-05')) {
        const force = 70 * (1 + parSemaine * faites.length)
        const avant = [...faites].reverse()
        const obj = suggestionPour(smith, plan, avant)
        const series: S[] = plan.series.map((_, i) => {
          const c = obj.charges[i] ?? 50
          const max = Math.max(1, Math.floor(30 * ((force * (1 - 0.02 * i)) / c - 1)))
          const reps = Math.min(obj.reps[i], max)
          return ['smith_incline', c, reps, Math.min(10, Math.max(6, 10 - (max - reps)))]
        })
        const s = seance(d, series, { exercices: [plan] })
        const k = conseil(smith, plan, historiqueDe([s, ...avant], smith.id))
        if (k) s.objectifs = { [smith.id]: { charges: k.charges, reps: k.reps } }
        faites.push(s)
        expect(blocage(smith, faites, d)).toBeNull()
      }
    }
  })
})

describe('pistes', () => {
  const l = DATES.map((d) => seance(d, [['smith_incline', 52.5, 8, 9.5]]))
  it('sommeil, calories, poids et RPE, chiffres à l’appui', () => {
    const journal = ['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14'].map((date, i) => ({ date, sommeil: 5, calories: i < 3 ? ('pasAssez' as const) : ('ok' as const) }))
    const pesees = [
      { date: '2026-10-02', poids: 75 },
      { date: '2026-10-30', poids: 75.1 },
    ]
    const p = pistes(smith, '2026-10-01', FIN, { seances: l, journal, pesees, phase: 'prise' })
    expect(p).toEqual(['sommeil moyen 5 h 00', 'calories sous l’objectif 3 jours sur 5', 'poids qui ne monte pas (+0,03 kg par semaine)', 'séries déjà très dures (effort moyen 9,5/10)'])
    expect(texteBlocage({ semaines: 4, seances: 4, depuis: '2026-10-01', pistes: p })).toMatch(/^Pas de progrès depuis 4 semaines \(4 séances\)\. Pistes : sommeil moyen 5 h 00/)
  })
  it('rien quand la donnée manque ; pas de déload depuis plus de 6 semaines', () => {
    expect(pistes(smith, '2026-10-01', FIN, { seances: l.map((s) => ({ ...s, series: s.series.map((x) => ({ ...x, rpe: 8 })) })) })).toEqual([])
    const long = [...semaines(4, '2026-09-01'), ...l.map((s) => s.date)].map((d) => seance(d, [['smith_incline', 50, 8, 8]]))
    expect(pistes(smith, '2026-10-01', FIN, { seances: long })).toContain('pas de semaine allégée depuis 8 semaines')
  })
  it('un arrêt de 3 semaines vaut un repos : pas de « pas de déload depuis 16 semaines » à la reprise', () => {
    const l = [...semaines(10, '2026-06-01'), ...semaines(3, '2026-09-14')].map((d) => seance(d, [['smith_incline', 50, 8, 8]]))
    expect(pistes(smith, '2026-09-14', '2026-10-01', { seances: l }).join()).not.toContain('déload')
  })
})

describe('déload conseillé', () => {
  const dates = ['2026-10-20', '2026-10-24', '2026-10-28']
  const l = (energie?: number) =>
    dates.map((d, i) =>
      seance(
        d,
        [
          ['smith_incline', i === 2 ? 47.5 : 52.5, 8, 8],
          ['tirage_large', i === 2 ? 55 : 60, 10, 8],
        ],
        i > 0 && energie ? { energie } : {}
      )
    )
  it('force en baisse sur 2 exercices et énergie basse', () => {
    const r = deloadConseille(l(2), exo, FIN)
    expect(r?.baisses.map((e) => e.id)).toEqual(['smith_incline', 'tirage_large'])
    expect(r?.energieBasse).toBe(true)
  })
  it('sans énergie basse, 2 exercices ne suffisent pas ; jamais juste après un déload', () => {
    expect(deloadConseille(l(4), exo, FIN)).toBeNull()
    expect(deloadConseille([seance('2026-10-15', [], { deload: true }), ...l(2)], exo, FIN)).toBeNull()
    // Une séance allégée pour un seul jour n'est pas une récupération : le conseil reste actif.
    expect(deloadConseille([seance('2026-10-15', [], { deload: true, allegeeSeule: true }), ...l(2)], exo, FIN)).not.toBeNull()
  })
})

describe('déload conseillé : pas de fausse alerte', () => {
  const trois = (id: string, series: [number, number, number][]) => series.map(([c, r, e]) => [id, c, r, e] as S)
  const dates = ['2026-10-20', '2026-10-24', '2026-10-28']
  const avec = (f: (i: number) => [number, number, number]) =>
    dates.map((d, i) => seance(d, ['smith_incline', 'tirage_large', 'tirage_horizontal'].flatMap((id) => trois(id, [f(i)]))))
  it('monter la charge avec les reps qui repartent au bas n’est pas une baisse', () => {
    expect(deloadConseille(avec((i) => (i < 2 ? [50, 12, 8] : [52.5, 8, 8])), exo, FIN)).toBeNull()
  })
  it('mêmes charge et reps avec un effort noté plus haut n’est pas une baisse', () => {
    expect(deloadConseille(avec((i) => [50, 10, i < 2 ? 7 : 9]), exo, FIN)).toBeNull()
  })
  it('moins de reps à la même charge reste une baisse', () => {
    expect(deloadConseille(avec((i) => [50, i < 2 ? 10 : 8, 8]), exo, FIN)?.baisses).toHaveLength(3)
  })
  it('à la reprise après un arrêt : jamais, puis la règle revient après 3 semaines', () => {
    const avant = ['2026-09-21', '2026-09-25'].map((d) => seance(d, ['smith_incline', 'tirage_large', 'tirage_horizontal'].flatMap((id) => trois(id, [[50, 10, 8]]))))
    const reprise = ['2026-10-26', '2026-10-28'].map((d) => seance(d, ['smith_incline', 'tirage_large', 'tirage_horizontal'].flatMap((id) => trois(id, [[50, 8, 8]]))))
    expect(deloadConseille([...avant, ...reprise], exo, '2026-10-30')).toBeNull()
    const plusTard = ['2026-11-08', '2026-11-16', '2026-11-20'].map((d, i) => seance(d, ['smith_incline', 'tirage_large', 'tirage_horizontal'].flatMap((id) => trois(id, [[50, i < 2 ? 10 : 8, 8]]))))
    expect(deloadConseille([...avant, ...reprise, ...plusTard], exo, '2026-11-20')?.baisses).toHaveLength(3)
  })
})

describe('audit blocages', () => {
  it('petits progrès réguliers (+0,6 % par séance, +2,4 % en tout) : pas bloqué', () => {
    const l = DATES.map((d, i) => seance(d, [['smith_incline', 50 * (1 + 0.006 * i), 8, 8]]))
    expect(blocage(smith, l, FIN)).toBeNull()
  })

  it('sommeil moyen juste sous 6 h : arrondi à « 6 h 00 », jamais « 5 h 60 »', () => {
    const journal = Array.from({ length: 121 }, (_, i) => ({ date: new Date(Date.parse('2026-06-30T12:00:00') + i * 86400000).toISOString().slice(0, 10), sommeil: i ? 6 : 5 }))
    const p = pistes(smith, '2026-06-29', '2026-10-31', { seances: [], journal })
    expect(p[0]).toBe('sommeil moyen 6 h 00')
  })
})

describe('audit déload conseillé', () => {
  it('énergie basse lue sur les 10 derniers jours seulement, pas sur des séances anciennes', () => {
    const recentes = ['2026-10-24', '2026-10-26', '2026-10-28'].map((d, i) =>
      seance(d, [
        ['smith_incline', i === 2 ? 47.5 : 52.5, 8, 8],
        ['tirage_large', i === 2 ? 55 : 60, 10, 8],
      ])
    )
    const anciennes = ['2026-10-05', '2026-10-08'].map((d) => seance(d, [], { energie: 1 }))
    expect(deloadConseille([...anciennes, ...recentes], exo, FIN)).toBeNull()
  })
})

describe('sensations à 3 choix (Difficile = 1, Bien = 3, Au top = 5)', () => {
  it('« Difficile » compte comme énergie basse pour avancer le déload, « Bien » non', () => {
    const l = (energie: number) =>
      ['2026-10-24', '2026-10-26', '2026-10-28'].map((d, i) =>
        seance(d, [['smith_incline', i === 2 ? 47.5 : 52.5, 8, 8], ['tirage_large', i === 2 ? 55 : 60, 10, 8]], i > 0 ? { energie } : {})
      )
    expect(deloadConseille(l(1), exo, FIN)?.energieBasse).toBe(true)
    expect(deloadConseille(l(3), exo, FIN)).toBeNull()
    expect(deloadConseille(l(5), exo, FIN)).toBeNull()
  })
})

describe('piste du poids en prise', () => {
  const smith = (date: string) => ({ id: date, date, debut: Date.parse(date + 'T10:00:00'), enCours: false, series: [{ id: date, exoId: 'smith_incline', type: 'normale', charge: 50, reps: 10, rpe: 8, heure: 0 }] }) as unknown as Parameters<typeof pistes>[3]['seances'][number]
  // Sèche jusqu'au 27 juil. (82 → 80 kg), puis prise à +0,2 kg par semaine.
  const pesees = [
    { date: '2026-06-01', poids: 82 },
    { date: '2026-07-27', poids: 80 },
    { date: '2026-08-31', poids: 81 },
  ]
  const c = { seances: [smith('2026-06-01')], pesees, phase: 'prise' as const }

  it('sans le début de phase, la sèche d’avant écrase le rythme', () => {
    expect(pistes(EXERCICES.smith_incline, '2026-06-01', '2026-08-31', c).join()).toContain('poids qui ne monte pas')
  })
  it('avec le début de phase, seule la prise compte : pas de piste', () => {
    expect(pistes(EXERCICES.smith_incline, '2026-06-01', '2026-08-31', { ...c, debutPhase: '2026-07-27' }).join()).not.toContain('poids qui ne monte pas')
  })
})

describe('piste « pas de semaine allégée » et séance allégée pour un seul jour', () => {
  const seances = ['2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28'].map((d) => seance(d, [['smith_incline', 50, 8, 8]]))
  const c = (s: ReturnType<typeof seance>[]) => ({ seances: s, journal: [], pesees: [] })
  it('une séance seule ne la fait pas repartir à zéro, une vraie semaine allégée si', () => {
    const exercice = exo('smith_incline')
    const seule = pistes(exercice, '2026-08-03', '2026-09-28', c([...seances, seance('2026-09-25', [['smith_incline', 45, 8, 6]], { deload: true, allegeeSeule: true })]))
    const vraie = pistes(exercice, '2026-08-03', '2026-09-28', c([...seances, seance('2026-09-25', [['smith_incline', 45, 8, 6]], { deload: true })]))
    expect(seule.some((p) => p.includes('pas de semaine allégée'))).toBe(true)
    expect(vraie.some((p) => p.includes('pas de semaine allégée'))).toBe(false)
  })
})
