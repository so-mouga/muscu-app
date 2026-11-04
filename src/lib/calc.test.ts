import { PROGRAMME } from '../data/programme'
import type { Seance, Serie } from '../types'
import { chauffeTropLourde, lirePoids, poidsDecale, calories, seanceOubliee, dureeEstimee, dureeHabituelle, dureeTexte, e1rm, ecartSerie, lireDuree, detailVolume, reposApres, schemaPlan, semaineType, serieTexte, volumeParMuscle, volumePrevu, tempsParExo } from './calc'
import { EXERCICES } from '../data/exercices'

describe('volume hebdomadaire', () => {
  it('le programme préchargé correspond au tableau 5.7', () => {
    const semaine: Seance[] = PROGRAMME.filter((m) => m.jour).map((m) => ({
      id: m.id,
      date: '2026-11-02',
      nom: m.nom,
      debut: 0,
      enCours: false,
      chauffes: {},
      notes: {},
      ajustSeries: {},
      exercices: m.exercices,
      series: m.exercices.flatMap((p) =>
        p.series.map((s, i) => ({
          id: `${p.exoId}${i}`,
          exoId: p.exoId,
          type: p.finisseur && i === p.series.length - 1 ? ('serie_longue' as const) : ('normale' as const),
          charge: 10,
          reps: s.repsMin,
          rpe: s.rpe,
          heure: 0,
        }))
      ),
    }))
    expect(volumeParMuscle(semaine)).toEqual({
      pecs: 16,
      dos: 18,
      epaule_arriere: 5,
      epaule_laterale: 6,
      triceps: 9.5,
      biceps: 6,
      quadriceps: 5,
      ischios: 6,
      mollets: 3,
      abdos: 3,
      // Muscles sans objectif, comptés en secondaire
      epaule_avant: 4.5,
      fessiers: 3,
      lombaires: 1.5,
      trapezes: 1.5,
      avant_bras: 1.5,
      adducteurs: 0,
    })
  })
})

describe('e1RM', () => {
  const serie = { id: '', exoId: '', type: 'normale' as const, heure: 0 }
  it('Epley corrigé par le RPE', () => {
    // 52,5 × 8 @8 → 10 reps jusqu'à l'échec → 52,5 × (1 + 10/30) = 70
    expect(e1rm(EXERCICES.smith_incline, { ...serie, charge: 52.5, reps: 8, rpe: 8 })).toBe(70)
  })
  it('pas d’e1RM sur l’isolation', () => {
    expect(e1rm(EXERCICES.butterfly, { ...serie, charge: 30, reps: 12, rpe: 8 })).toBeNull()
  })
  it('poids du corps : poids du jour + lest', () => {
    expect(e1rm(EXERCICES.tractions, { ...serie, charge: 0, reps: 10, rpe: 10 }, 70)).toBe(93.3)
  })
})

describe('repos', () => {
  const plan = {
    exoId: 'x',
    repos: 150,
    series: [
      { repsMin: 8, repsMax: 10, rpe: 8, repos: 180 },
      { repsMin: 8, repsMax: 10, rpe: 8 },
      { repsMin: 8, repsMax: 10, rpe: 8 },
    ],
    chauffes: [],
    finisseur: false,
    charge: 50,
  }
  it('repos propre à la série, sinon repos par défaut', () => {
    expect(reposApres(plan, 0, 3)).toBe(180)
    expect(reposApres(plan, 1, 3)).toBe(150)
  })
  it('repos après l’exercice sur la dernière série (et les séries ajoutées)', () => {
    expect(reposApres({ ...plan, reposApres: 240 }, 2, 3)).toBe(240)
    expect(reposApres({ ...plan, reposApres: 240 }, 3, 4)).toBe(240)
    expect(reposApres(plan, 2, 3)).toBe(150)
  })
  it('lecture des durées saisies', () => {
    expect(lireDuree('2:30')).toBe(150)
    expect(lireDuree('2,30')).toBe(150)
    expect(lireDuree('3')).toBe(180)
    expect(lireDuree('90')).toBe(90)
    expect(lireDuree('abc')).toBeNull()
  })
})

describe('temps par exercice', () => {
  const serie = (exoId: string, min: number) => ({ id: exoId + min, exoId, type: 'normale' as const, charge: 50, reps: 10, rpe: 8, heure: min * 60000 })

  it('compte chaque intervalle pour l’exercice de la série validée', () => {
    const t = tempsParExo({ debut: 0, series: [serie('a', 4), serie('a', 7), serie('b', 12), serie('b', 15)] })
    expect(t).toEqual({ a: 7 * 60000, b: 8 * 60000 })
  })

  it('exercices entrecoupés : les intervalles s’additionnent', () => {
    const t = tempsParExo({ debut: 0, series: [serie('b', 9), serie('a', 3), serie('a', 6)] })
    expect(t).toEqual({ a: 6 * 60000, b: 3 * 60000 })
  })
})

describe('durée habituelle et calories', () => {
  const s = (debut: number, min: number, modeleId = 'a') =>
    ({ id: String(debut), modeleId, debut, fin: debut + min * 60000, series: [{}] }) as unknown as Seance
  it('médiane des 3 dernières séances du même modèle', () => {
    expect(dureeHabituelle('a', [s(1, 50), s(2, 70), s(3, 62), s(4, 120, 'b'), s(0, 300)])).toBe(60)
    expect(dureeHabituelle('z', [s(1, 50)])).toBeNull()
  })
  it('durée prévue : jamais 0 min, échauffement compris', () => {
    const plan = { exoId: 'presse', repos: 120, series: [{ repsMin: 8, repsMax: 12, rpe: 8 }], chauffes: [], finisseur: false, charge: null }
    expect(dureeEstimee({ id: 'a', nom: 'A', sousTitre: '', exercices: [plan] })).toBe(5)
    expect(dureeEstimee({ id: 'a', nom: 'A', sousTitre: '', exercices: [] })).toBe(0)
    const longue = { id: 'a', nom: 'A', sousTitre: '', exercices: Array.from({ length: 4 }, () => ({ ...plan, series: [...plan.series, ...plan.series, ...plan.series] })) }
    expect(dureeEstimee({ ...longue, echauffement: ['cardio', 'jumping', 'moulinets', 'balances_jambes', 'chevilles', 'hanches_9090'] })).toBeGreaterThan(dureeEstimee(longue))
  })
  it('séance oubliée : plus de 4 h et plus rien depuis 2 h, pas une longue séance encore active', () => {
    const h = 3600000
    const avec = (heure: number) => ({ debut: 0, series: [{ heure }] as Serie[] })
    expect(seanceOubliee(avec(h), 3 * h)).toBe(false)
    expect(seanceOubliee(avec(h), 15 * h)).toBe(true)
    expect(seanceOubliee(avec(4.5 * h), 5 * h)).toBe(false)
    expect(seanceOubliee({ debut: 0, series: [] }, 5 * h)).toBe(true)
  })
  it('une séance au plafond de 4 h ne compte pas dans la durée habituelle', () => {
    expect(dureeHabituelle('a', [s(1, 300)])).toBeNull()
    expect(dureeHabituelle('a', [s(1, 300), s(2, 50)])).toBe(50)
  })
  it('la durée habituelle est dite comme telle, une séance vide n’affiche aucune durée', () => {
    const plan = { exoId: 'presse', repos: 120, series: [{ repsMin: 8, repsMax: 12, rpe: 8 }], chauffes: [], finisseur: false, charge: null }
    const m = { id: 'a', nom: 'A', sousTitre: '', exercices: [plan] }
    expect(dureeTexte(m, [s(1, 45)])).toBe('≈ 45 min d’habitude')
    expect(dureeTexte({ ...m, id: 'z' }, [s(1, 45)])).toMatch(/^≈ \d+ min$/)
    expect(dureeTexte({ ...m, exercices: [] }, [s(1, 45)])).toBe('')
  })
  it('5 MET × poids × heures', () => {
    expect(calories(3600000, 80)).toBe(400)
    expect(calories(1800000)).toBe(188)
  })
})

describe('volume prévu', () => {
  it('compte les séries dures prévues et les muscles secondaires', () => {
    const plan = (exoId: string, rpes: number[]) => ({ exoId, repos: 120, series: rpes.map((rpe) => ({ repsMin: 8, repsMax: 12, rpe })), chauffes: [], finisseur: false, charge: null })
    const m = { id: 'm', nom: 'm', sousTitre: '', exercices: [plan('smith_incline', [8, 8, 6]), plan('butterfly', [9, 9])] }
    const v = volumePrevu([m, m])
    expect(v.pecs).toBe(8)
    expect(v.triceps).toBe(2)
  })
  it('détail par muscle : le total retombe sur le volume, le plus gros d’abord, les exercices qui aident marqués', () => {
    const plan = (exoId: string, rpes: number[]) => ({ exoId, repos: 120, series: rpes.map((rpe) => ({ repsMin: 8, repsMax: 12, rpe })), chauffes: [], finisseur: false, charge: null })
    const a = { id: 'a', nom: 'A', sousTitre: '', exercices: [plan('smith_incline', [8, 8, 6]), plan('butterfly', [9, 9, 9])] }
    const b = { id: 'b', nom: 'B', sousTitre: '', exercices: [plan('butterfly', [6, 6])] }
    const d = detailVolume([a, b])
    expect(d.pecs.map((l) => [l.seance, l.series])).toEqual([['A', 3], ['A', 2]])
    expect(d.triceps).toEqual([expect.objectContaining({ exoId: 'smith_incline', seance: 'A', series: 1, aide: true })])
    const v = volumePrevu([a, b])
    for (const m of Object.keys(d) as (keyof typeof d)[]) expect(d[m].reduce((s, l) => s + l.series, 0)).toBe(v[m])
  })
  it('détail : une séance prévue deux fois fait une seule ligne', () => {
    const plan = { exoId: 'butterfly', repos: 120, series: [{ repsMin: 8, repsMax: 12, rpe: 8 }, { repsMin: 8, repsMax: 12, rpe: 8 }], chauffes: [], finisseur: false, charge: null }
    const m = { id: 'm', nom: 'M', sousTitre: '', exercices: [plan] }
    expect(detailVolume([m, m]).pecs).toEqual([expect.objectContaining({ seance: 'M', series: 4 })])
    expect(volumePrevu([m, m]).pecs).toBe(4)
  })
  it('semaine type : seulement les séances planifiées', () => {
    expect(semaineType({ id: 'p', nom: 'p', seances: [{ modeleId: 'a', jour: 1 }, { modeleId: 'b' }] }).map((e) => e.modeleId)).toEqual(['a'])
    expect(semaineType({ id: 'p', nom: 'p', seances: [{ modeleId: 'a' }, { modeleId: 'b' }] })).toHaveLength(2)
  })
})

describe('exercices en temps', () => {
  const gainage = EXERCICES.gainage
  const serie = (charge: number, reps: number) => ({ id: 'a', exoId: 'gainage', type: 'normale' as const, charge, reps, rpe: 8, heure: 0 })
  it('affichage en secondes', () => {
    expect(serieTexte(gainage, serie(0, 45))).toBe('45 s @8')
    expect(serieTexte(gainage, serie(10, 30))).toBe('PDC +10 kg × 30 s @8')
    expect(schemaPlan(gainage, { exoId: 'gainage', repos: 60, series: [0, 1, 2].map(() => ({ repsMin: 30, repsMax: 45, rpe: 8 })), chauffes: [], finisseur: false, charge: 0 })).toBe('3 × 30–45 s')
  })
  it('écart en secondes, pas de 1RM', () => {
    expect(ecartSerie(serie(0, 50), serie(0, 45), gainage)?.texte).toBe('+5 s')
    expect(e1rm(gainage, serie(0, 45))).toBeNull()
  })
})

describe('schéma du plan', () => {
  const plan = (reps: [number, number][]) => ({ exoId: 'x', repos: 90, series: reps.map(([repsMin, repsMax]) => ({ repsMin, repsMax, rpe: 8 })), chauffes: [], finisseur: false, charge: null })
  it('identiques : 3 × 8–12', () => expect(schemaPlan(EXERCICES.butterfly, plan([[8, 12], [8, 12], [8, 12]]))).toBe('3 × 8–12'))
  it('différentes : série par série', () => expect(schemaPlan(EXERCICES.butterfly, plan([[12, 12], [10, 10], [8, 8]]))).toBe('12 / 10 / 8'))
})

describe('textes en clair', () => {
  const tractions = EXERCICES.tractions
  const s = (charge: number, reps: number, rpe: number): Serie => ({ id: 'a', exoId: 'tractions', type: 'normale', charge, reps, rpe, heure: 0 })
  it('détail de séance : « poids du corps » en toutes lettres, sans « @8 »', () => {
    expect(serieTexte(tractions, s(10, 8, 8), true)).toBe('poids du corps +10 kg × 8')
    expect(serieTexte(tractions, s(0, 8, 8), true)).toBe('poids du corps × 8')
    expect(serieTexte(tractions, s(10, 8, 8))).toBe('PDC +10 kg × 8 @8')
  })
  it('mêmes charge et reps mais RPE différent : pas « identique »', () => {
    expect(ecartSerie(s(10, 8, 9), s(10, 8, 7))).toEqual({ sens: 'egal', texte: 'mêmes reps, effort plus dur' })
    expect(ecartSerie(s(10, 8, 7), s(10, 8, 9))?.texte).toBe('mêmes reps, effort plus facile')
    expect(ecartSerie(s(10, 8, 8), s(10, 8, 8))?.texte).toBe('identique')
  })
})

describe('poids tapé', () => {
  it('garde les 2 chiffres après la virgule, sans arrondir', () => {
    expect(lirePoids('70,65')).toBe(70.65)
    expect(lirePoids('70.65')).toBe(70.65)
    expect(lirePoids(' 72,3 ')).toBe(72.3)
    expect(lirePoids('80')).toBe(80)
  })
  it('refuse ce qui n’est pas un poids', () => {
    for (const t of ['', 'abc', '70,655', '25', '300', '-70']) expect(lirePoids(t)).toBeNull()
  })
  it('− et + gardent les centièmes', () => {
    expect(poidsDecale(70.65, 0.1)).toBe(70.75)
    expect(poidsDecale(70.65, -0.1)).toBe(70.55)
    expect(poidsDecale(70.1, 0.2)).toBe(70.3)
  })
})

describe('échauffement en séance allégée', () => {
  const machine = EXERCICES.presse
  it('écarte un échauffement à 90 % ou plus de la charge du jour', () => {
    expect(chauffeTropLourde(machine, '45×2', 45)).toBe(true)
    expect(chauffeTropLourde(machine, '41×2', 45)).toBe(true)
    expect(chauffeTropLourde(machine, '35×4', 45)).toBe(false)
  })
  it('garde une consigne libre, une charge inconnue et un exercice assisté', () => {
    expect(chauffeTropLourde(machine, '1 série facile de 4–5 reps', 45)).toBe(false)
    expect(chauffeTropLourde(machine, '45×2', null)).toBe(false)
    expect(chauffeTropLourde({ ...machine, assistance: true }, '45×2', 45)).toBe(false)
  })
})
