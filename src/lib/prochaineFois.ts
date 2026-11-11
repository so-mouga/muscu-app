import type { Exercice, ExoPlan, Seance } from '../types'
import { historiqueDe } from './historique'
import { conseil, pareil, raisonPareil, rienDePlus, type Suggestion } from './progression'

/** Un exercice fait ce jour-là, et ce qui se décide pour la prochaine fois (comme en fin de séance). */
export interface LigneProchaineFois {
  plan: ExoPlan
  exo: Exercice
  /** Refaire pareil : le choix par défaut. */
  s: Suggestion
  conseil: Suggestion | null
  raison: string | null
}

/** Séances terminées avant `seance`, la plus récente en premier (l'ordre que lisent les conseils). */
export const seancesAvant = (seance: Seance, toutes: Seance[]) => toutes.filter((s) => !s.enCours && s.id !== seance.id && s.debut < seance.debut).sort((a, b) => b.debut - a.debut)

/**
 * La séance est la dernière fois que l'exercice a été fait (hors allégées) : c'est elle que lit la séance suivante
 * (`suggestionPour`), donc c'est sur elle que la prochaine fois se décide. Sur une séance plus ancienne, un choix ne servirait à rien.
 */
export function decideProchaineFois(seance: Seance, toutes: Seance[], exoId: string): boolean {
  if (seance.deload || seance.enCours || !seance.series.some((x) => x.exoId === exoId)) return false
  return !toutes.some((s) => s.id !== seance.id && !s.enCours && !s.deload && s.debut > seance.debut && s.series.some((x) => x.exoId === exoId))
}

/**
 * Exercices faits ce jour-là, avec leur choix pour la prochaine fois : refaire pareil, le conseil, ou la raison de refaire pareil.
 * `avant` : séances terminées avant celle-ci, la plus récente en premier. Séance allégée : rien à conseiller.
 */
export function lignesProchaineFois(seance: Seance, avant: Seance[], exoDe: (id: string) => Exercice): LigneProchaineFois[] {
  const avecCelleCi = [seance, ...avant]
  return seance.exercices
    .filter((p) => seance.series.some((x) => x.exoId === p.exoId))
    .map((plan) => {
      const exo = exoDe(plan.exoId)
      const histo = historiqueDe(avecCelleCi, plan.exoId)
      // Semaine allégée : rien à juger ni à conseiller, et l'historique ne contient que la séance normale d'avant.
      if (seance.deload) return { plan, exo, s: pareil(exo, plan, histo), conseil: null, raison: null }
      return { plan, exo, s: pareil(exo, plan, histo), conseil: conseil(exo, plan, histo), raison: raisonPareil(exo, plan, histo) }
    })
}

/** Il y a un vrai choix : le conseil propose plus que refaire pareil. */
export const vraiChoix = (l: LigneProchaineFois) => !!l.conseil && !rienDePlus(l.conseil, l.s)

/**
 * Conseils encore à choisir sur cette séance : un vrai choix, sur un exercice dont elle décide encore, et pas d'objectif fixé
 * (ni le conseil, ni un objectif à la main). Pour l'Accueil : « Prochaine fois : 2 conseils à choisir ».
 */
export function conseilsAChoisir(seance: Seance, toutes: Seance[], exoDe: (id: string) => Exercice): number {
  if (seance.deload || seance.enCours) return 0
  return lignesProchaineFois(seance, seancesAvant(seance, toutes), exoDe).filter((l) => vraiChoix(l) && !seance.objectifs?.[l.exo.id] && decideProchaineFois(seance, toutes, l.exo.id)).length
}
