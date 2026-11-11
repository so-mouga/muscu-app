import { EXERCICES } from '../data/exercices'
import type { Seance } from '../types'
import { debutPeriode, genererBilan } from './bilan'
import { cibles } from './cycle'

const seance = (id: string, date: string, charges: number[], extra: Partial<Seance> = {}): Seance =>
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
    series: charges.map((c, i) => ({ id: id + i, exoId: 'smith_incline', type: 'normale', charge: c, reps: 10, rpe: 8, heure: 0 })),
    ...extra,
  }) as Seance

const donnees = (seances: Seance[]) => ({
  seances,
  pesees: [
    { date: '2026-10-20', poids: 74 },
    { date: '2026-10-27', poids: 73.4 },
  ],
  mesures: [],
  exo: (id: string) => EXERCICES[id],
  exercices: EXERCICES,
  cibles: cibles(),
  programme: 'Recompo 4 jours',
})

describe('bilan à partager', () => {
  it('période : les N dernières semaines, semaine en cours comprise', () => {
    expect(debutPeriode(2, '2026-10-29')).toBe('2026-10-19')
  })
  it('contient vue d’ensemble, volume par muscle, exercices, corps et autres sports', () => {
    const t = genererBilan(donnees([seance('s1', '2026-10-20', [50, 50, 50], { ressenti: 4, notes: { smith_incline: 'Siège cran 4' } }), seance('s2', '2026-10-27', [52.5, 52.5, 52.5])]), '2026-10-19', '2026-10-29')
    expect(t).toContain('2 séances')
    expect(t).toContain('Pecs : 3/sem. (objectif 10) · effort moyen 8/10 · par semaine : 3 / 3')
    expect(t).toContain('Développé incliné Smith (pecs)')
    expect(t).toContain('Développé incliné Smith (pecs) · 1re (20 oct. : 50 kg × 10, 10, 10 · effort 8, 8, 8/10) · dernière (27 oct. : 52,5 kg × 10, 10, 10 · effort 8, 8, 8/10)')
    expect(t).not.toContain('@8')
    expect(t).toContain('Évolution : 50 kg × 10 → 52,5 kg × 10 (ça monte, +2,5 kg)')
    expect(t).not.toMatch(/RPE|Force estimée/)
    expect(t).toContain('(2 semaines)')
    expect(t).toContain('Poids moyen par semaine : sem. du 19 oct. 74 kg (1/7 pesée) · sem. du 26 oct. 73,4 kg (1/4 pesée)')
    expect(t).toContain('Rythme : −0,6 kg/semaine (−0,6 kg en 1 semaine)')
    expect(t).toContain('Siège cran 4')
  })
  it('sans séance : le dit simplement', () => {
    expect(genererBilan(donnees([]), '2026-10-19', '2026-10-29')).toContain('Aucune séance sur la période.')
  })

  it('donne la phase de la période, pour qu’on sache comment lire les perfs', () => {
    const objectifs = [
      { depuis: '2026-09-01', phase: 'prise' as const, volume: {} },
      { depuis: '2026-10-22', phase: 'seche' as const, finPrevue: '2027-01-14', volume: {} },
    ]
    const t = genererBilan({ ...donnees([seance('s1', '2026-10-20', [50, 50, 50])]), objectifs }, '2026-10-19', '2026-10-29')
    expect(t).toMatch(/Phase : Sèche depuis le .*22 oct.* \(semaine 2 sur 12, fin prévue/)
    expect(t).toMatch(/Phase précédente pendant la période : prise de muscle du .* au .*21 oct/)
  })

  it('une phase encore en cours n’est pas une phase précédente, même si la suivante est déjà prévue', () => {
    const objectifs = [
      { depuis: '2026-07-27', phase: 'prise' as const, finPrevue: '2026-11-16', volume: {} },
      { depuis: '2026-11-16', phase: 'seche' as const, volume: {} },
    ]
    const t = genererBilan({ ...donnees([seance('s1', '2026-10-20', [50, 50, 50])]), objectifs }, '2026-10-19', '2026-10-29')
    expect(t).toContain('Phase : Prise de muscle')
    expect(t).not.toContain('Phase précédente')
  })

  it('reprend « À retenir » en tête', () => {
    const t = genererBilan(donnees([seance('s1', '2026-10-20', [50, 50, 50])]), '2026-10-19', '2026-10-29', ['Prise qui marche.'])
    expect(t.indexOf('== À retenir ==')).toBeLessThan(t.indexOf('== Vue d’ensemble =='))
    expect(t).toContain('Prise qui marche.')
  })
})

describe('texte du bilan sur des dates au choix', () => {
  const d = { seances: [seance('a', '2026-10-05', [50, 50]), seance('b', '2026-10-14', [50, 50])], pesees: [], mesures: [], exo: (id: string) => EXERCICES[id], exercices: EXERCICES, cibles: cibles() }
  it('écrit la vraie date de début, pas le lundi de sa semaine', () => {
    expect(genererBilan(d, '2026-10-07', '2026-10-20').split('\n')[0]).toMatch(/du .*7 oct/)
    expect(genererBilan(d, '2026-10-05', '2026-10-18').split('\n')[0]).toMatch(/du .*5 oct/)
  })
  it('ne compte pas le volume des semaines coupées quand on le demande', () => {
    const ligne = (t: string) => t.split('\n').find((l) => /Pectoraux|Pecs/.test(l))
    const entier = genererBilan(d, '2026-10-12', '2026-10-18')
    const coupe = genererBilan(d, '2026-10-07', '2026-10-21', [], true)
    expect(ligne(coupe)).toBe(ligne(entier))
  })
})

describe('texte du bilan et séance allégée pour un seul jour', () => {
  const d = { seances: [seance('a', '2026-10-05', [50, 50]), seance('b', '2026-10-07', [45], { deload: true, allegeeSeule: true })], pesees: [], mesures: [], exo: (id: string) => EXERCICES[id], exercices: EXERCICES, cibles: cibles() }
  it('la nomme, et ne parle pas de déload', () => {
    const t = genererBilan(d, '2026-10-05', '2026-10-11')
    expect(t).toMatch(/séance allégée/)
    expect(t).not.toMatch(/· déload/)
    expect(t).not.toMatch(/\(déload\)/)
  })

  it('ce qui est visé à côté de l’exercice, et les types de série en mots', () => {
    const plan = { exoId: 'smith_incline', repos: 120, charge: 50, chauffes: [], finisseur: false, series: [0, 1, 2].map(() => ({ repsMin: 8, repsMax: 12, rpe: 8 })) }
    const s2 = seance('s2', '2026-10-27', [52.5, 52.5], { exercices: [plan] })
    s2.series.push({ id: 'd', exoId: 'smith_incline', type: 'drop', charge: 52.5, reps: 8, rpe: 10, heure: 0, suite: [{ charge: 40, reps: 6 }] })
    const t = genererBilan(donnees([seance('s1', '2026-10-20', [50, 50, 50]), s2]), '2026-10-19', '2026-10-29')
    expect(t).toContain('Développé incliné Smith (pecs) · 3 × 8–12, effort 8, 8, 8/10 · 1re')
    expect(t).toContain('dégressive : 52,5 kg × 8, puis 40 kg × 6')
    expect(t).toContain('Effort sur 10 : 10 = échec')
  })

  it('question de la semaine en tête, tour de taille, et jour par jour sur 7 jours', () => {
    const d = {
      ...donnees([seance('s0', '2026-10-20', [50, 50, 50]), seance('s1', '2026-10-27', [50, 50, 50])]),
      mesures: [{ date: '2026-10-26', valeurs: { taille: 83 } }],
      journal: [{ date: '2026-10-27', kcal: 2232, proteines: 141, sodium: 2900, kcalAppli: true, pas: 10778, sommeil: 6.75, note: 'resto, 4 bières' }],
      objectifs: [{ depuis: '2026-10-01', phase: 'prise' as const, volume: {}, calories: 2300 }],
    }
    const t = genererBilan(d, '2026-10-19', '2026-10-29', [], false, ' j’ai mal au coude ')
    expect(t.startsWith('Ma question cette semaine : j’ai mal au coude\n\nBILAN')).toBe(true)
    expect(t).toContain('Dernier tour de taille : 83 cm (26 oct.)')
    expect(t).toContain('== Jour par jour, 7 derniers jours (objectif 2 300 kcal) ==')
    expect(t).toContain('jour | poids | kcal | protéines | pas | nuit d’avant | séance | notes')
    expect(t).toContain('mar. 27 oct. | 73,4 kg | 2 232 | 141 g | 10 778 | 6 h 45 | Haut A | resto, 4 bières')
    // Les 7 lignes, même un jour vide.
    expect(t).toContain('ven. 23 oct. | — | — | — | — | — | — | ')
    expect(t.split('\n').filter((l) => / \| /.test(l))).toHaveLength(8)
    // Sodium : MyFitnessPal l'envoie incomplet, il n'est plus écrit nulle part (11 nov. 2026).
    expect(t).not.toContain('sodium')
    expect(t).toContain('Moyenne (repas sur les jours finis) : 2 232 kcal pour 2 300 visées · protéines 141 g · poids moyen 73,4 kg (1/7 pesée)')
    expect(t).toContain('zone conseillée en prise : +0,15 à +0,4 kg/semaine')
    expect(genererBilan(d, '2026-10-19', '2026-10-29')).not.toContain('Ma question')
  })

  it('rythme visé par la phase quand elle a un poids visé et une fin', () => {
    const d = { ...donnees([seance('s0', '2026-10-20', [50]), seance('s1', '2026-10-27', [50])]), objectifs: [{ depuis: '2026-10-05', phase: 'prise' as const, volume: {}, ecartVise: 3, finPrevue: '2026-12-28' }] }
    expect(genererBilan(d, '2026-10-19', '2026-10-29')).toContain('visé par ta phase : +3 kg en 12 semaines, soit +0,25 kg/semaine')
  })
})
