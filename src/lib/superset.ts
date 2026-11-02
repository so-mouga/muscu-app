import type { ExoPlan } from '../types'
import { reposApres } from './calc'

/** L'exercice est-il explicitement enchaîné avec le suivant ? */
export const estEnchaine = (p?: ExoPlan): boolean => Boolean(p?.enchaine)

/**
 * Retourne la liste des indices [début, ..., fin] du groupe de superset (ou tri-set)
 * auquel appartient l'exercice à `index`.
 * Si l'exercice est isolé, retourne `[index]`.
 */
export function groupeSuperset(plans: ExoPlan[], index: number): number[] {
  if (index < 0 || index >= plans.length) return []
  let debut = index
  while (debut > 0 && plans[debut - 1]?.enchaine) {
    debut--
  }
  let fin = index
  while (fin < plans.length - 1 && plans[fin]?.enchaine) {
    fin++
  }
  const indices: number[] = []
  for (let i = debut; i <= fin; i++) {
    indices.push(i)
  }
  return indices
}

/** L'exercice à `index` fait-il partie d'un superset (au moins 2 exercices liés) ? */
export function estDansSuperset(plans: ExoPlan[], index: number): boolean {
  return groupeSuperset(plans, index).length > 1
}

/** Découpe la liste des plans en groupes d'indices (simples ou supersets). */
export function tousLesGroupes(plans: ExoPlan[]): number[][] {
  const res: number[][] = []
  let i = 0
  while (i < plans.length) {
    const g = groupeSuperset(plans, i)
    res.push(g)
    i = g[g.length - 1] + 1
  }
  return res
}

/**
 * Pour un groupe d'exercices (superset ou simple), retourne l'indice de l'exercice
 * à exécuter ensuite selon l'alternance en superset, ou null si tout le groupe est fini.
 */
export function prochainExoDuGroupe(
  indices: number[],
  plans: ExoPlan[],
  nbFaites: (exoId: string) => number,
  totalDe: (index: number) => number,
  estPasse?: (index: number) => boolean,
): number | null {
  const incomplets = indices.filter((i) => (!estPasse || !estPasse(i)) && nbFaites(plans[i].exoId) < totalDe(i))
  if (incomplets.length === 0) return null
  // Alternance : l'exercice qui a le moins de séries faites dans le groupe
  const minFaites = Math.min(...incomplets.map((i) => nbFaites(plans[i].exoId)))
  return incomplets.find((i) => nbFaites(plans[i].exoId) === minFaites) ?? incomplets[0]
}

/**
 * Détermine l'exercice en cours pour l'ensemble d'une séance.
 * Gère l'alternance au sein des supersets et le passage d'un groupe au suivant.
 */
export function prochainExoDeSeance({
  plans,
  nbFaites,
  totalDe,
  estPasse,
  derniereExoId,
  courantExoId,
}: {
  plans: ExoPlan[]
  nbFaites: (exoId: string) => number
  totalDe: (index: number) => number
  estPasse?: (index: number) => boolean
  derniereExoId?: string
  courantExoId?: string
}): number {
  if (plans.length === 0) return -1

  // 1. Si l'utilisateur a explicitement cliqué "Faire maintenant"
  if (courantExoId) {
    const choisi = plans.findIndex((p) => p.exoId === courantExoId)
    if (choisi >= 0 && (!estPasse || !estPasse(choisi)) && nbFaites(plans[choisi].exoId) < totalDe(choisi)) {
      return choisi
    }
  }

  // 2. Si une série vient d'être faite, on continue dans son groupe de superset s'il n'est pas terminé
  if (derniereExoId) {
    const i0 = plans.findIndex((p) => p.exoId === derniereExoId)
    if (i0 >= 0) {
      const groupe = groupeSuperset(plans, i0)
      const suiteGroupe = prochainExoDuGroupe(groupe, plans, nbFaites, totalDe, estPasse)
      if (suiteGroupe !== null) return suiteGroupe
    }
  }

  // 3. Sinon, le premier groupe incomplet
  const groupes = tousLesGroupes(plans)
  // Dans l'ordre de la séance : un exercice commencé puis laissé (« Faire maintenant ») n'est pas oublié.
  for (const g of groupes) {
    const p = prochainExoDuGroupe(g, plans, nbFaites, totalDe, estPasse)
    if (p !== null) return p
  }

  return -1
}

/**
 * Une fois la série en cours de l'exercice `index` faite : l'exercice du groupe qui vient ensuite
 * (alternance), ou null si tout le groupe est fini.
 */
export function suivantDansGroupe(plans: ExoPlan[], index: number, nbFaitesParExo: Record<string, number>, totalDe?: (index: number) => number): number | null {
  const faites = (i: number) => (nbFaitesParExo[plans[i].exoId] ?? 0) + (i === index ? 1 : 0)
  const prevues = (i: number) => totalDe?.(i) ?? plans[i].series.length
  const restants = groupeSuperset(plans, index).filter((i) => faites(i) < prevues(i))
  if (!restants.length) return null
  const moins = Math.min(...restants.map(faites))
  return restants.find((i) => faites(i) === moins)!
}

/**
 * Calcule le repos à observer après une série dans un plan, en tenant compte des supersets.
 */
export function reposApresSuperset(
  plans: ExoPlan[],
  index: number,
  serieIndex: number,
  total: number,
  nbFaitesParExo?: Record<string, number>,
  totalDe?: (index: number) => number,
): number {
  const p = plans[index]
  if (!p) return 0
  const reposDe = (x: ExoPlan) => x.series[Math.min(serieIndex, x.series.length - 1)]?.repos ?? x.repos

  const groupe = groupeSuperset(plans, index)
  if (groupe.length === 1) return reposApres(p, serieIndex, total)
  const dernier = plans[groupe[groupe.length - 1]]

  // Sans les comptes : le repos propre à l'exercice (transition s'il est enchaîné).
  if (!nbFaitesParExo) return reposDe(p)

  const suivant = suivantDansGroupe(plans, index, nbFaitesParExo, totalDe)
  // Tout le groupe est fini : le repos avant l'exercice suivant.
  if (suivant === null) return dernier.reposApres ?? p.reposApres ?? reposDe(dernier)
  // Le suivant est plus loin dans le groupe : transition. Sinon, le tour est fini : repos complet.
  return suivant > index && p.enchaine ? reposDe(p) : reposDe(dernier)
}
