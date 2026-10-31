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

  // 3. Sinon, on cherche le premier groupe incomplet dans l'ordre de la séance
  const groupes = tousLesGroupes(plans)
  // On commence à chercher après le dernier groupe travaillé s'il y en a un
  let debutGroupe = 0
  if (derniereExoId) {
    const i0 = plans.findIndex((p) => p.exoId === derniereExoId)
    if (i0 >= 0) {
      const gIndex = groupes.findIndex((g) => g.includes(i0))
      if (gIndex >= 0) debutGroupe = gIndex + 1
    }
  }

  const ordre = [...groupes.slice(debutGroupe), ...groupes.slice(0, debutGroupe)]
  for (const g of ordre) {
    const p = prochainExoDuGroupe(g, plans, nbFaites, totalDe, estPasse)
    if (p !== null) return p
  }

  return -1
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
): number {
  const p = plans[index]
  if (!p) return 0

  // 1. Si cet exercice est enchaîné vers le suivant : c'est le temps de transition
  if (p.enchaine) {
    const serieRepos = p.series[Math.min(serieIndex, p.series.length - 1)]?.repos
    return serieRepos ?? p.repos
  }

  // 2. Si cet exercice est le dernier d'un groupe superset
  const groupe = groupeSuperset(plans, index)
  if (groupe.length > 1) {
    // Si toutes les séries de tous les exercices du superset sont terminées
    const toutFini = groupe.every((idx) => {
      const plan = plans[idx]
      const faites = (nbFaitesParExo?.[plan.exoId] ?? 0) + (idx === index ? 1 : 0)
      const prevues = plan.series.length
      return faites >= prevues
    })
    if (toutFini && p.reposApres !== undefined) {
      return p.reposApres
    }
    return p.series[Math.min(serieIndex, p.series.length - 1)]?.repos ?? p.repos
  }

  // 3. Exercice simple hors superset
  return reposApres(p, serieIndex, total)
}
