import { describe, expect, it } from 'vitest'
import { EXERCICES } from '../data/exercices'
import type { ExoPlan, Seance, Serie } from '../types'
import { texteSeance, type DonneesSeance } from './partageSeance'

const plan = (exoId: string, charge: number): ExoPlan => ({ exoId, repos: 120, series: [0, 1, 2].map(() => ({ repsMin: 8, repsMax: 12, rpe: 8 })), charge, chauffes: [], finisseur: false })

const seance = (date: string, faits: Record<string, [number, number[]]>, extra: Partial<Seance> = {}) =>
  ({
    id: date,
    date,
    nom: 'Haut A',
    debut: Date.parse(date + 'T18:00:00'),
    enCours: false,
    exercices: [plan('rowing_haltere', 30), plan('dev_militaire', 20), plan('dips', 0)],
    chauffes: {},
    notes: {},
    ajustSeries: {},
    series: Object.entries(faits).flatMap(([exoId, [charge, reps]]) => reps.map((r, i) => ({ id: `${date}${exoId}${i}`, exoId, type: 'normale', charge, reps: r, rpe: 8, heure: Date.parse(date + 'T18:00:00') + i * 600000 }))),
    ...extra,
  }) as Seance

const avant = seance('2026-11-02', { rowing_haltere: [30, [11, 11, 10]] })
const jour = seance('2026-11-09', { rowing_haltere: [30, [12, 12, 12]], dev_militaire: [20, [10, 9, 9]] }, { ressenti: 3, energie: 3, notes: { rowing_haltere: 'Coude serré' }, echauffement: { ids: ['moulinets'], faits: ['moulinets'], fini: true } })
const donnees: DonneesSeance = { exo: (id) => EXERCICES[id], avant: [avant], objectifs: [{ depuis: '2026-11-01', phase: 'prise', volume: {} }] }

describe('texte d’une séance à partager', () => {
  const t = texteSeance(jour, donnees, true)

  it('en tête : la question, puis séance, date, durée, phase, sensation et légende de l’effort', () => {
    expect(t).toMatch(/^Ma question : le conseil de l’appli pour la prochaine fois te paraît-il juste \? Réponds avec mes chiffres, en quelques lignes\.\n\nSéance Haut A · lun\. 9 nov\. · \d+ min\n/)
    expect(t).toContain('Phase : Prise de muscle')
    expect(t).toContain('Sensation : Bien')
    expect(t).toContain('8/10 = il reste environ 2 reps')
    expect(t).toContain('Échauffement : moulinets de bras 10 par sens')
    expect(t).not.toContain('Forme :')
  })

  it('les pas de la veille et la nuit d’avant, s’ils sont connus', () => {
    const avecJournal = texteSeance(jour, { ...donnees, journal: [{ date: '2026-11-08', pas: 13240 }, { date: '2026-11-09', sommeil: 7.17, sommeilMontre: true }] }, true)
    expect(avecJournal).toContain('Sensation : Bien\nForme : 13 240 pas la veille · nuit d’avant : 7 h 10')
    expect(texteSeance(jour, { ...donnees, journal: [{ date: '2026-11-09', pas: 4000 }] }, true)).not.toContain('Forme :')
    const repas = texteSeance(jour, { ...donnees, objectifs: [{ depuis: '2026-11-01', phase: 'prise', volume: {}, calories: 3000 }], journal: [{ date: '2026-11-08', kcal: 2870, proteines: 148, kcalAppli: true }] }, true)
    expect(repas).toContain('Repas de la veille : 2 870 kcal pour 3 000 visées · protéines 148 g')
  })

  it('chaque exercice : prévu, fait avec l’effort, la fois d’avant, la note', () => {
    expect(t).toContain('1. Rowing haltère · 3 × 8–12 · effort 8/10 · repos 2:00')
    expect(t).toContain('   aujourd’hui : 30 kg/main × 12, 12, 12 · effort 8, 8, 8/10')
    expect(t).toContain('   la fois d’avant (lun. 2 nov.) : 30 kg/main × 11, 11, 10 · effort 8, 8, 8/10')
    expect(t).toContain('   note : Coude serré')
    expect(t).toContain('   la fois d’avant : première fois')
  })

  it('le conseil de l’appli et ce qui a été choisi pour la prochaine fois', () => {
    expect(t).toMatch(/conseil de l’appli : Tu peux monter, 32 kg\/main × 8\/8\/8/)
    expect(t).toContain('   prochaine fois : comme aujourd’hui (conseil pas suivi)')
    const suivi = texteSeance({ ...jour, objectifs: { rowing_haltere: { charges: [20, 20, 20], reps: [12, 12, 12] } } }, donnees, true)
    expect(suivi).toContain('prochaine fois : 20 kg/main × 12/12/12 (choisi à la main)')
  })

  it('une série qui n’est pas normale est écrite à part, son type en mots, sans signe à deviner', () => {
    const base = jour.series.filter((x) => x.exoId !== 'dev_militaire')
    const serie = (i: number, extra: Partial<Serie>): Serie => ({ id: `s${i}`, exoId: 'dev_militaire', type: 'normale', charge: 36, reps: 10, rpe: 9, heure: jour.debut + 3600000 + i * 600000, ...extra })
    const s = texteSeance({ ...jour, series: [...base, serie(0, {}), serie(1, { type: 'drop', suite: [{ charge: 28, reps: 6 }] }), serie(2, { type: 'echec', reps: 7, rpe: 10 }), serie(3, { type: 'rest_pause', suite: [{ charge: 36, reps: 4 }, { charge: 36, reps: 3 }] }), serie(4, { demiReps: 3 })] }, donnees, true)
    expect(s).toContain('aujourd’hui : 36 kg × 10 · dégressive : 36 kg × 10, puis 28 kg × 6 · 36 kg × 7 à l’échec · rest-pause : 36 kg × 10, puis 4 + 3 après une courte pause · 36 kg × 10 + 3 demi-reps · effort 9, 9, 10, 9, 9/10')
    expect(s).not.toContain('↘')
  })

  it('exercices sautés à la fin, et rien sur la fois d’avant si on ne la veut pas', () => {
    expect(t).toContain('Pas fait aujourd’hui : Dips penchés en avant')
    expect(t).not.toContain('Dips penchés en avant ·')
    expect(texteSeance(jour, donnees, false)).not.toContain('la fois d’avant')
  })

  it('séance allégée : ni conseil ni prochaine fois, et jamais le poids', () => {
    const allegee = texteSeance({ ...jour, deload: true, allegeeSeule: true, poidsCorps: 82 }, donnees, true)
    expect(allegee).toContain('Séance allégée ce jour-là')
    // Sans conseil à juger, la question change.
    expect(allegee).toMatch(/^Ma question : est-ce que je change quelque chose la prochaine fois \?/)
    expect(allegee).not.toContain('conseil de l’appli')
    expect(allegee).not.toContain('   prochaine fois :')
    expect(allegee).not.toContain('82')
  })

  it('ordre réel : numéroté dans l’ordre fait, « prévu en n » seulement pour ce qui a changé de place', () => {
    // Développé militaire fait avant le rowing (machine occupée) ; dips sautés.
    const decale = { ...jour, series: jour.series.map((x) => (x.exoId === 'dev_militaire' ? { ...x, heure: x.heure - 3 * 3600000 } : x)) }
    const s = texteSeance(decale, donnees, true)
    expect(s).toContain('1. Développé militaire barre (prévu en 2) · 3 × 8–12')
    expect(s).toContain('2. Rowing haltère (prévu en 1) · 3 × 8–12')
    // Ordre respecté : rien.
    expect(t).not.toContain('prévu en')
    // Après « Échanger », le plan a bougé, mais l’ordre de départ est gardé.
    const echange = { ...decale, exercices: [decale.exercices[1], decale.exercices[0], decale.exercices[2]], ordrePrevu: ['rowing_haltere', 'dev_militaire', 'dips'] }
    expect(texteSeance(echange, donnees, true)).toContain('1. Développé militaire barre (prévu en 2)')
  })

  it('remplacement : le remplaçant dit ce qu’il remplace, et l’exercice prévu n’est pas « pas fait »', () => {
    const r = { ...jour, exercices: [plan('rowing_haltere', 30), plan('dev_militaire', 20), plan('dips', 0)].map((p) => (p.exoId === 'rowing_haltere' ? { ...p, exoId: 'rowing_machine' } : p)), series: jour.series.map((x) => (x.exoId === 'rowing_haltere' ? { ...x, exoId: 'rowing_machine' } : x)), remplacements: [{ a: 'rowing_haltere', b: 'rowing_machine' }], ordrePrevu: ['rowing_haltere', 'dev_militaire', 'dips'] }
    const s = texteSeance(r, { ...donnees }, true)
    expect(s).toMatch(/1\. [^\n]+\n   à la place de Rowing haltère \(machine prise\)\n   aujourd’hui/)
    expect(s).not.toContain('prévu en')
    expect(s).toContain('Pas fait aujourd’hui : Dips penchés en avant')
    expect(s).not.toMatch(/Pas fait[^\n]*Rowing haltère/)
  })
})
