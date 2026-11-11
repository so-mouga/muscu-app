import { describe, expect, it } from 'vitest'
import { EXERCICES } from '../data/exercices'
import type { Cycle, ExoPlan, Programme, Seance, SeanceModele } from '../types'
import { effort, reposPartage, texteProgramme, type DonneesProgramme } from './partageProgramme'
import { ciblesEnVigueur } from './volume'

const haut: SeanceModele = {
  id: 'haut',
  nom: 'Haut A',
  sousTitre: 'pecs prioritaire',
  echauffement: ['moulinets'],
  exercices: [
    { exoId: 'smith_incline', repos: 180, series: [{ repsMin: 8, repsMax: 10, rpe: 7 }, { repsMin: 8, repsMax: 10, rpe: 8 }, { repsMin: 8, repsMax: 10, rpe: 8 }], charge: 52.5, chauffes: ['50%×8', '25×4'], finisseur: false },
    { exoId: 'butterfly', repos: 30, series: [0, 1].map(() => ({ repsMin: 12, repsMax: 15, rpe: 8 })), charge: 30, chauffes: [], finisseur: false, enchaine: true },
    { exoId: 'elevation_poulie', repos: 90, series: [0, 1].map(() => ({ repsMin: 12, repsMax: 15, rpe: 9 })), charge: 15, chauffes: [], finisseur: true, note: 'Coude haut' },
  ],
}
const bas: SeanceModele = { id: 'bas', nom: 'Bas', sousTitre: '', exercices: [{ exoId: 'presse', repos: 180, series: [0, 1, 2].map(() => ({ repsMin: 8, repsMax: 12, rpe: 8 })), charge: 100, chauffes: [], finisseur: false }] }
const programme: Programme = { id: 'p', nom: 'Recompo', seances: [{ modeleId: 'bas', jour: 2 }, { modeleId: 'haut', jour: 1 }, { modeleId: 'haut', jour: 4 }] }

const seance = (date: string, exoId: string, charge: number, reps: number[], deload = false) =>
  ({ id: date + exoId, date, nom: 'x', debut: Date.parse(date + 'T18:00:00'), enCours: false, exercices: [], chauffes: {}, notes: {}, ajustSeries: {}, deload, series: reps.map((r, i) => ({ id: `${date}${i}`, exoId, type: 'normale', charge, reps: r, rpe: 8, heure: i })) }) as unknown as Seance

const donnees = (extra: Partial<DonneesProgramme> = {}): DonneesProgramme => ({
  modele: (id) => [haut, bas].find((m) => m.id === id),
  exo: (id) => EXERCICES[id],
  exercices: EXERCICES,
  objectifs: [{ depuis: '2026-11-01', phase: 'prise', volume: {} }],
  cibles: ciblesEnVigueur({}),
  seances: [seance('2026-11-03', 'smith_incline', 50, [10, 9, 9]), seance('2026-10-27', 'smith_incline', 47.5, [10, 10, 9]), seance('2026-11-05', 'smith_incline', 30, [10], true)],
  aujourdhui: '2026-11-06',
  ...extra,
})

describe('texte d’un programme à partager', () => {
  const t = texteProgramme(programme, donnees(), true)

  it('en tête : le programme, la phase sans poids, et la légende de l’effort', () => {
    expect(t).toMatch(/^Programme Recompo · 3 séances par semaine\n/)
    expect(t).toContain('Phase : Prise de muscle')
    expect(t).toContain('8/10 = il reste environ 2 reps')
    expect(t).not.toMatch(/kg\s*\n.*poids/i)
  })

  it('séances par jour, la même séance deux fois n’est écrite qu’une fois', () => {
    expect(t.indexOf('Lundi · Haut A (pecs prioritaire, environ')).toBeLessThan(t.indexOf('Mardi · Bas'))
    expect(t).toContain('Jeudi · Haut A : la même séance que lundi')
    expect(t.match(/Développé incliné Smith/g)).toHaveLength(1)
  })

  it('chaque exercice : séries, effort, repos, superset, finisseur, échauffements et note', () => {
    expect(t).toContain('Échauffement : moulinets de bras 10 par sens')
    expect(t).toContain('1. Développé incliné Smith · 3 × 8–10 · effort 7, 8, 8/10 · repos 3:00 après chaque série')
    expect(t).toContain('   échauffement 50 % × 8, 25 kg × 4')
    expect(t).toContain('2. Butterfly · 2 × 12–15 · effort 8, 8/10 · superset avec le 3, 0:30 pour changer de poste')
    expect(t).toContain('3. Élévation latérale poulie · 2 × 12–15 · effort 9, 9/10 · repos 1:30 entre les séries · finisseur')
    expect(t).toContain('   note : Coude haut')
  })

  it('dernière fois : la plus récente hors séance allégée, ou « pas encore fait »', () => {
    expect(t).toContain('dernière fois (mar. 3 nov.) : 50 kg × 10, 9, 9')
    expect(t).toContain('   pas encore fait')
  })

  it('sans les charges : aucune ligne « dernière fois »', () => {
    const sans = texteProgramme(programme, donnees(), false)
    expect(sans).not.toContain('dernière fois')
    expect(sans).not.toContain('pas encore fait')
    expect(sans.length).toBeLessThan(t.length)
  })

  it('séries par muscle à la fin, avec léger ou beaucoup', () => {
    expect(t).toMatch(/Séries par semaine[^\n]*\n[^\n]*Pecs \d/)
    expect(t).toContain('(léger)')
    expect(t.trim().endsWith('Fait avec Cran')).toBe(true)
  })

  it('cycle en cours sur ce programme : sa semaine et ses semaines allégées', () => {
    const cycle = { id: 'c', programmeId: 'p', debut: '2026-10-20', semaines: 6, deloads: [6], pauses: [] } as unknown as Cycle
    expect(texteProgramme(programme, donnees({ cycle }), true)).toContain('Cycle de 6 semaines, semaine 3, semaine allégée : 6')
    expect(texteProgramme(programme, donnees({ cycle: { ...cycle, programmeId: 'autre' } }), true)).not.toContain('Cycle')
  })
})

describe('effort et repos visés, série par série', () => {
  const p = (rpe: number[], repos: (number | undefined)[], reposApres?: number): ExoPlan => ({ exoId: 'x', repos: 180, reposApres, series: rpe.map((r, i) => ({ repsMin: 8, repsMax: 12, rpe: r, repos: repos[i] })), charge: 50, chauffes: [], finisseur: false })
  it('une valeur d’effort par série, même quand elles sont toutes pareilles', () => {
    expect(effort(p([8, 8, 9], []))).toBe('effort 8, 8, 9/10')
    expect(effort(p([9, 9, 9], []))).toBe('effort 9, 9, 9/10')
  })
  it('le repos dit à quelles séries il s’applique', () => {
    expect(reposPartage(p([8, 8, 8], []))).toBe('repos 3:00 après chaque série')
    expect(reposPartage(p([8, 8, 8], [], 120))).toBe('repos 3:00 entre les séries, puis 2:00 avant l’exercice suivant')
    expect(reposPartage(p([8, 8, 8], [180, 120, 90]))).toBe('repos 3:00, 2:00 entre les séries, puis 1:30 avant l’exercice suivant')
  })
  it('dernier exercice de la séance : rien après sa dernière série', () => {
    expect(reposPartage(p([8, 8, 8], [], 120), true)).toBe('repos 3:00 entre les séries')
    expect(reposPartage(p([8, 8, 8], [180, 120, 90]), true)).toBe('repos 3:00, 2:00 entre les séries')
    expect(reposPartage(p([8], [], 120), true)).toBe('')
  })
})

