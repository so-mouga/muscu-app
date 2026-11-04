import { describe, expect, it } from 'vitest'
import { EXERCICES } from '../data/exercices'
import type { Programme, SeanceModele, Serie } from '../types'
import { conseil } from './progression'
import { copieProgramme, estDuJour, fourchetteParDefaut, joursPris, nomSeanceLibre, programmesAbandonnes, programmesSansSeance, enFourchette } from './programme'

const seance = (id: string): SeanceModele => ({ id, nom: `Séance ${id}`, sousTitre: '', exercices: [{ exoId: 'presse', repos: 120, chauffes: [], finisseur: false, charge: 50, series: [{ repsMin: 8, repsMax: 12, rpe: 8 }] }] })
const programme: Programme = { id: 'p1', nom: 'Mon programme ', seances: [{ modeleId: 'a', jour: 1 }, { modeleId: 'b', jour: 3 }, { modeleId: 'a', jour: 5 }] }
const modele = (id: string) => ({ a: seance('a'), b: seance('b') })[id]
const compteur = () => {
  let k = 0
  return () => String(++k)
}

describe('copieProgramme', () => {
  it('copie les séances : la copie ne pointe plus vers les séances d’origine', () => {
    const { programme: c, seances } = copieProgramme(programme, modele, compteur())
    expect(c.nom).toBe('Mon programme (copie)')
    expect(c.id).not.toBe('p1')
    expect(seances).toHaveLength(2)
    expect(c.seances.map((e) => e.modeleId)).not.toContain('a')
    expect(c.seances.map((e) => e.modeleId)).not.toContain('b')
  })
  it('garde les jours, et une séance faite deux fois par semaine reste une seule séance', () => {
    const { programme: c, seances } = copieProgramme(programme, modele, compteur())
    expect(c.seances.map((e) => e.jour)).toEqual([1, 3, 5])
    expect(c.seances[0].modeleId).toBe(c.seances[2].modeleId)
    expect(seances.map((m) => m.nom)).toEqual(['Séance a', 'Séance b'])
  })
  it('modifier une séance copiée ne touche pas à l’originale', () => {
    const originale = seance('a')
    const { seances } = copieProgramme({ ...programme, seances: [{ modeleId: 'a' }] }, () => originale, compteur())
    seances[0].exercices.pop()
    expect(originale.exercices).toHaveLength(1)
  })
  it('ignore une séance qui n’existe plus', () => {
    const { programme: c } = copieProgramme({ ...programme, seances: [{ modeleId: 'a' }, { modeleId: 'disparue' }] }, modele, compteur())
    expect(c.seances).toHaveLength(1)
  })
})

describe('nomSeanceLibre', () => {
  it('propose la première lettre libre, jamais un nom déjà pris', () => {
    expect(nomSeanceLibre([])).toBe('Séance A')
    expect(nomSeanceLibre(['Séance A', 'Haut'])).toBe('Séance B')
    expect(nomSeanceLibre(['Séance A', 'Séance C'])).toBe('Séance B')
    expect(nomSeanceLibre(['Séance A', 'Séance B', 'Séance C'])).toBe('Séance D')
  })
  it('passe à un numéro après la dernière lettre', () => {
    expect(nomSeanceLibre([...'ABCDEFGHIJ'].map((l) => `Séance ${l}`))).toBe('Séance 11')
  })
})

describe('programmesSansSeance', () => {
  it('retire toutes les entrées de la séance, et ne renvoie que les programmes concernés', () => {
    const autre: Programme = { id: 'p2', nom: 'Autre', seances: [{ modeleId: 'b' }] }
    const r = programmesSansSeance([programme, autre], 'a')
    expect(r).toHaveLength(1)
    expect(r[0].seances).toEqual([{ modeleId: 'b', jour: 3 }])
  })
})

describe('estDuJour', () => {
  const planning = (id: string, jour: number) => [{ modele: { id }, jour }]

  it('suit le planning du cycle, pas le jour écrit dans le programme', () => {
    const ligne = { modeleId: 'a', jour: 2 }
    expect(estDuJour(ligne, [ligne], planning('a', 1), 2)).toBe(false)
    expect(estDuJour(ligne, [ligne], planning('a', 1), 1)).toBe(true)
  })

  it('la même séance deux fois : seule la ligne de ce jour est marquée', () => {
    const lignes = [{ modeleId: 'a', jour: 1 }, { modeleId: 'a', jour: 4 }]
    const plan = [{ modele: { id: 'a' }, jour: 1 }, { modele: { id: 'a' }, jour: 4 }]
    expect(estDuJour(lignes[0], lignes, plan, 4)).toBe(false)
    expect(estDuJour(lignes[1], lignes, plan, 4)).toBe(true)
  })
})

describe('fourchetteParDefaut', () => {
  it('8–12 à plusieurs articulations, 12–15 en isolation', () => {
    expect(fourchetteParDefaut(EXERCICES.smith_incline)).toEqual({ repsMin: 8, repsMax: 12 })
    expect(fourchetteParDefaut(EXERCICES.butterfly)).toEqual({ repsMin: 12, repsMax: 15 })
  })

  it('un exercice ajouté reçoit un conseil de monter dès qu’il dépasse le bas de sa fourchette', () => {
    const exo = EXERCICES.smith_incline
    const plan = { exoId: exo.id, repos: 180, series: [0, 1, 2].map(() => ({ ...fourchetteParDefaut(exo), rpe: 8 })), chauffes: [], finisseur: false, charge: null }
    const faites = [0, 1, 2].map((i): Serie => ({ id: String(i), exoId: exo.id, type: 'normale', charge: 50, reps: 10, rpe: 7, heure: 0 }))
    expect(conseil(exo, plan, [faites])).not.toBeNull()
  })
})

describe('programmesAbandonnes', () => {
  const vide = (id: string, nom: string): Programme => ({ id, nom, seances: [] })
  const plein: Programme = { id: 'p', nom: 'Mon programme', seances: [{ modeleId: 'a', jour: 1 }] }

  it('retire un programme vide sous son nom proposé', () => {
    expect(programmesAbandonnes([plein, vide('x', 'Mon programme 2'), vide('y', 'Mon programme 3')], 'p', [])).toEqual(['x', 'y'])
  })

  it('garde le programme en service, celui qui est ouvert, un programme renommé et un programme non vide', () => {
    expect(programmesAbandonnes([plein, vide('x', 'Mon programme 2')], 'x', [])).toEqual([])
    expect(programmesAbandonnes([plein, vide('x', 'Mon programme 2')], 'p', ['x'])).toEqual([])
    expect(programmesAbandonnes([plein, vide('x', 'Jambes')], 'p', [])).toEqual([])
  })

  it('ne retire jamais le seul programme', () => {
    expect(programmesAbandonnes([vide('x', 'Mon programme')], 'autre', [])).toEqual([])
  })
})

describe('joursPris', () => {
  const seances = [{ modeleId: 'a', jour: 1 }, { modeleId: 'b', jour: 3 }, { modeleId: 'c' }, { modeleId: 'supprimee', jour: 5 }]
  const existe = (id: string) => id !== 'supprimee'

  it('donne les jours des autres séances, sans celle qu’on place', () => {
    expect(joursPris(seances, existe, 0)).toEqual([3])
  })
  it('une nouvelle séance voit tous les jours pris, sans ceux d’une séance supprimée', () => {
    expect(joursPris(seances, existe)).toEqual([1, 3])
  })
})

describe('passage en fourchette', () => {
  const plan = (series: { repsMin: number; repsMax: number }[], exoId = 'a') => ({ exoId, repos: 60, series: series.map((x) => ({ ...x, rpe: 8 })), chauffes: [], finisseur: false, charge: 50 })
  it('le nombre devient le milieu, une fourchette existante ne bouge pas', () => {
    const r = enFourchette({ exercices: [plan([{ repsMin: 10, repsMax: 10 }, { repsMin: 8, repsMax: 12 }])] }, () => false)
    expect(r.exercices[0].series.map((x) => [x.repsMin, x.repsMax])).toEqual([[8, 12], [8, 12]])
  })
  it('un exercice en temps garde son nombre, et jamais moins d’une rep', () => {
    const r = enFourchette({ exercices: [plan([{ repsMin: 30, repsMax: 30 }], 't'), plan([{ repsMin: 2, repsMax: 2 }])] }, (id) => id === 't')
    expect(r.exercices[0].series[0].repsMin).toBe(30)
    expect(r.exercices[1].series[0]).toMatchObject({ repsMin: 1, repsMax: 4 })
  })
})
