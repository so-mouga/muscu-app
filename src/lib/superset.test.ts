import { describe, expect, it } from 'vitest'
import type { ExoPlan } from '../types'
import {
  delier,
  estDansSuperset,
  estEnchaine,
  groupeSuperset,
  prochainExoDeSeance,
  prochainExoDuGroupe,
  reposApresSuperset,
  retirerDuPlan,
  suivantDansGroupe,
  tousLesGroupes,
} from './superset'

const makePlan = (exoId: string, series = 3, repos = 90, enchaine = false): ExoPlan => ({
  exoId,
  repos,
  series: Array.from({ length: series }, () => ({ repsMin: 10, repsMax: 10, rpe: 8 })),
  chauffes: [],
  finisseur: false,
  charge: 20,
  enchaine,
})

describe('groupeSuperset & estDansSuperset', () => {
  it('teste estEnchaine', () => {
    expect(estEnchaine(makePlan('a', 3, 0, true))).toBe(true)
    expect(estEnchaine(makePlan('a', 3, 0, false))).toBe(false)
    expect(estEnchaine(undefined)).toBe(false)
  })

  it('identifie les exercices isolés', () => {
    const plans = [makePlan('a'), makePlan('b'), makePlan('c')]
    expect(groupeSuperset(plans, 0)).toEqual([0])
    expect(groupeSuperset(plans, 1)).toEqual([1])
    expect(groupeSuperset(plans, 2)).toEqual([2])
    expect(estDansSuperset(plans, 0)).toBe(false)
  })

  it('identifie un superset de deux exercices', () => {
    const plans = [makePlan('a', 3, 0, true), makePlan('b', 3, 120, false), makePlan('c', 3, 90, false)]
    expect(groupeSuperset(plans, 0)).toEqual([0, 1])
    expect(groupeSuperset(plans, 1)).toEqual([0, 1])
    expect(groupeSuperset(plans, 2)).toEqual([2])
    expect(estDansSuperset(plans, 0)).toBe(true)
    expect(estDansSuperset(plans, 1)).toBe(true)
    expect(estDansSuperset(plans, 2)).toBe(false)
  })

  it('identifie un tri-set de trois exercices', () => {
    const plans = [
      makePlan('a', 3, 0, true),
      makePlan('b', 3, 0, true),
      makePlan('c', 3, 120, false),
    ]
    expect(groupeSuperset(plans, 0)).toEqual([0, 1, 2])
    expect(groupeSuperset(plans, 1)).toEqual([0, 1, 2])
    expect(groupeSuperset(plans, 2)).toEqual([0, 1, 2])
  })

  it('gère plusieurs supersets dans la même séance', () => {
    const plans = [
      makePlan('a', 3, 0, true),
      makePlan('b', 3, 90, false),
      makePlan('c', 3, 90, false),
      makePlan('d', 3, 15, true),
      makePlan('e', 3, 90, false),
    ]
    expect(tousLesGroupes(plans)).toEqual([[0, 1], [2], [3, 4]])
  })
})

describe('prochainExoDuGroupe', () => {
  it('alterne proprement entre deux exercices à séries égales', () => {
    const plans = [makePlan('a', 3), makePlan('b', 3)]
    const g = [0, 1]
    const nb: Record<string, number> = { a: 0, b: 0 }
    const total = () => 3

    // Début : A0
    expect(prochainExoDuGroupe(g, plans, (id) => nb[id], total)).toBe(0)
    nb.a = 1

    // Après A0 : B0
    expect(prochainExoDuGroupe(g, plans, (id) => nb[id], total)).toBe(1)
    nb.b = 1

    // Après B0 : A1
    expect(prochainExoDuGroupe(g, plans, (id) => nb[id], total)).toBe(0)
    nb.a = 2

    // Après A1 : B1
    expect(prochainExoDuGroupe(g, plans, (id) => nb[id], total)).toBe(1)
    nb.b = 2

    // Après B1 : A2
    expect(prochainExoDuGroupe(g, plans, (id) => nb[id], total)).toBe(0)
    nb.a = 3

    // Après A2 : B2
    expect(prochainExoDuGroupe(g, plans, (id) => nb[id], total)).toBe(1)
    nb.b = 3

    // Fini
    expect(prochainExoDuGroupe(g, plans, (id) => nb[id], total)).toBeNull()
  })

  it('gère des nombres de séries différents (A: 3, B: 2)', () => {
    const plans = [makePlan('a', 3), makePlan('b', 2)]
    const g = [0, 1]
    const nb: Record<string, number> = { a: 0, b: 0 }
    const total = (i: number) => plans[i].series.length

    // A0 -> B0 -> A1 -> B1 -> A2 (car B est déjà fini) -> fini
    expect(prochainExoDuGroupe(g, plans, (id) => nb[id], total)).toBe(0)
    nb.a = 1
    expect(prochainExoDuGroupe(g, plans, (id) => nb[id], total)).toBe(1)
    nb.b = 1
    expect(prochainExoDuGroupe(g, plans, (id) => nb[id], total)).toBe(0)
    nb.a = 2
    expect(prochainExoDuGroupe(g, plans, (id) => nb[id], total)).toBe(1)
    nb.b = 2
    // B a fini ses 2 séries ! A doit faire sa 3e série
    expect(prochainExoDuGroupe(g, plans, (id) => nb[id], total)).toBe(0)
    nb.a = 3
    expect(prochainExoDuGroupe(g, plans, (id) => nb[id], total)).toBeNull()
  })

  it('gère le cas où un exercice est passé (estPasse)', () => {
    const plans = [makePlan('a', 3), makePlan('b', 3)]
    const g = [0, 1]
    const nb: Record<string, number> = { a: 0, b: 0 }
    const total = () => 3

    // Si A est passé, seul B s'exécute
    expect(prochainExoDuGroupe(g, plans, (id) => nb[id], total, (i) => i === 0)).toBe(1)
  })
})

describe('prochainExoDeSeance', () => {
  it('enchaîne les groupes dans l’ordre', () => {
    const plans = [
      makePlan('a', 2, 0, true), // superset A+B
      makePlan('b', 2, 90, false),
      makePlan('c', 2, 90, false), // exo simple C
    ]
    const nb: Record<string, number> = { a: 0, b: 0, c: 0 }
    const total = () => 2

    // 1. Début de séance
    expect(prochainExoDeSeance({ plans, nbFaites: (id) => nb[id], totalDe: total })).toBe(0)

    // A0 validé
    nb.a = 1
    expect(prochainExoDeSeance({ plans, nbFaites: (id) => nb[id], totalDe: total, derniereExoId: 'a' })).toBe(1)

    // B0 validé
    nb.b = 1
    expect(prochainExoDeSeance({ plans, nbFaites: (id) => nb[id], totalDe: total, derniereExoId: 'b' })).toBe(0)

    // A1 validé
    nb.a = 2
    expect(prochainExoDeSeance({ plans, nbFaites: (id) => nb[id], totalDe: total, derniereExoId: 'a' })).toBe(1)

    // B1 validé (superset fini !) -> passe à C
    nb.b = 2
    expect(prochainExoDeSeance({ plans, nbFaites: (id) => nb[id], totalDe: total, derniereExoId: 'b' })).toBe(2)

    // C0 validé -> reste sur C
    nb.c = 1
    expect(prochainExoDeSeance({ plans, nbFaites: (id) => nb[id], totalDe: total, derniereExoId: 'c' })).toBe(2)

    // C1 validé -> tout est fini !
    nb.c = 2
    expect(prochainExoDeSeance({ plans, nbFaites: (id) => nb[id], totalDe: total, derniereExoId: 'c' })).toBe(-1)
  })
})

describe('reposApresSuperset', () => {
  it('donne le repos de transition si l’exercice est enchaîné', () => {
    const plans = [makePlan('a', 3, 15, true), makePlan('b', 3, 120, false)]
    expect(reposApresSuperset(plans, 0, 0, 3)).toBe(15)
    expect(reposApresSuperset(plans, 0, 2, 3)).toBe(15) // même sur la dernière série de A !
  })

  it('donne le repos normal de B si le superset n’est pas fini', () => {
    const plans = [makePlan('a', 3, 0, true), makePlan('b', 3, 120, false)]
    // Première série de B terminée, il reste des séries
    expect(reposApresSuperset(plans, 1, 0, 3, { a: 1, b: 0 })).toBe(120)
  })

  it('donne reposApres de B quand tout le superset est terminé', () => {
    const pB = makePlan('b', 2, 90, false)
    pB.reposApres = 180
    const plans = [makePlan('a', 2, 0, true), pB]
    // Dernière série de B avec A déjà fini à 2/2
    expect(reposApresSuperset(plans, 1, 1, 2, { a: 2, b: 1 })).toBe(180)
  })

  it('groupe inégal : quand B est fini, A garde le repos complet, pas la transition', () => {
    const plans = [makePlan('a', 5, 20, true), makePlan('b', 3, 90, false)]
    // A1 : B reste à faire, transition.
    expect(reposApresSuperset(plans, 0, 0, 5, { a: 0, b: 0 })).toBe(20)
    // A4, B déjà à 3/3 : prochaine série = A, repos complet.
    expect(reposApresSuperset(plans, 0, 3, 5, { a: 3, b: 3 })).toBe(90)
  })

  it('les séries ajoutées et les exercices sautés comptent', () => {
    const pB = makePlan('b', 3, 90, false)
    pB.reposApres = 180
    const plans = [makePlan('a', 3, 0, true), pB]
    expect(reposApresSuperset(plans, 1, 2, 3, { a: 3, b: 2 }, (i) => (i === 0 ? 4 : 3))).toBe(90)
    expect(reposApresSuperset(plans, 1, 2, 3, { a: 0, b: 2 }, (i) => (i === 0 ? 0 : 3))).toBe(180)
  })
})

describe('après « Faire maintenant »', () => {
  it('on revient au premier exercice non terminé, pas à celui d’après', () => {
    const plans = [makePlan('a'), makePlan('b'), makePlan('c'), makePlan('d')]
    const nb: Record<string, number> = { a: 1, b: 0, c: 3, d: 0 }
    expect(prochainExoDeSeance({ plans, nbFaites: (id) => nb[id], totalDe: () => 3, derniereExoId: 'c' })).toBe(0)
  })
})

describe('suivantDansGroupe', () => {
  const plans = [makePlan('a', 3, 0, true), makePlan('b', 2, 90, false)]
  it('alterne, puis reste sur celui qui a encore des séries, puis plus rien', () => {
    expect(suivantDansGroupe(plans, 0, { a: 0, b: 0 })).toBe(1)
    expect(suivantDansGroupe(plans, 1, { a: 1, b: 0 })).toBe(0)
    expect(suivantDansGroupe(plans, 0, { a: 1, b: 2 })).toBe(0)
    expect(suivantDansGroupe(plans, 0, { a: 2, b: 2 })).toBeNull()
  })
})

describe('retirerDuPlan', () => {
  const repos = () => 150
  const liste = () => [makePlan('a', 3, 0, true), makePlan('b'), makePlan('c')]

  it('retirer le 2e d’un superset ne lie pas le 1er à l’exercice suivant, et lui rend un vrai repos', () => {
    const r = retirerDuPlan(liste(), 1, repos)
    expect(r.map((p) => p.exoId)).toEqual(['a', 'c'])
    expect(r[0].enchaine).toBeUndefined()
    expect(r[0].repos).toBe(150)
    expect(estDansSuperset(r, 0)).toBe(false)
  })
  it('retirer le dernier exercice ne laisse pas un repos de 0 s', () => {
    const r = retirerDuPlan([makePlan('a', 3, 0, true), makePlan('b')], 1, repos)
    expect(r[0]).toMatchObject({ exoId: 'a', repos: 150 })
    expect(r[0].enchaine).toBeUndefined()
  })
  it('retirer le milieu d’un enchaînement de trois garde les deux autres liés', () => {
    const r = retirerDuPlan([makePlan('a', 3, 0, true), makePlan('b', 3, 0, true), makePlan('c')], 1, repos)
    expect(r[0].enchaine).toBe(true)
    expect(r[0].repos).toBe(0)
    expect(estDansSuperset(r, 0)).toBe(true)
  })
  it('retirer un exercice seul ne change rien aux autres', () => {
    const r = retirerDuPlan([makePlan('a', 3, 0, true), makePlan('b'), makePlan('c')], 2, repos)
    expect(r[0].enchaine).toBe(true)
    expect(r[1].enchaine).toBeFalsy()
  })
})

describe('delier', () => {
  it('reprend le repos après la dernière série s’il y en a un, sinon le repos par défaut', () => {
    expect(delier({ ...makePlan('a', 3, 0, true), reposApres: 200 }, 150).repos).toBe(200)
    expect(delier(makePlan('a', 3, 15, true), 150).repos).toBe(150)
  })
  it('garde un vrai repos déjà réglé, et ne touche pas à un exercice qui n’est pas lié', () => {
    expect(delier(makePlan('a', 3, 90, true), 150).repos).toBe(90)
    const seul = makePlan('a', 3, 0)
    expect(delier(seul, 150)).toBe(seul)
  })
})
