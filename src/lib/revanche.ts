import type { Exercice, ExoPlan, Serie } from '../types'
import { enTemps } from './calc'

/**
 * La revanche : la série qu'on a ratée ou la charge qu'on a dû lâcher, annoncée au moment d'y retourner (plein écran,
 * choix de l'utilisateur, 11 nov. 2026). Jamais une charge jamais faite : ça, c'est un record, et le cran s'en occupe.
 */
export type Revanche = { genre: 'reps' | 'charge'; /** Ce qu'on avait fait (reps), ou la charge où on était redescendu. */ avant: number; /** Ce qu'il faut faire aujourd'hui. */ vise: number }

const basDe = (plan: ExoPlan, i: number) => plan.series[Math.min(i, plan.series.length - 1)].repsMin

/**
 * Revanche de la série `n` (0 = première), à la charge prévue aujourd'hui. `histo` : séries de l'exercice par séance, la
 * plus récente d'abord, hors allégées.
 * - Reps : la dernière fois, cette série a fini sous le bas de sa fourchette, à la même charge. À faire : le bas.
 * - Charge (1re série seulement) : on remonte à une charge qu'on avait ratée, après une séance plus légère.
 * Rien sur un finisseur, un exercice en temps ou assisté (pour la charge), ni sans charge connue.
 */
export function revanche(exo: Exercice, plan: ExoPlan, histo: Serie[][], n: number, charge: number | null | undefined): Revanche | null {
  if (typeof charge !== 'number' || enTemps(exo)) return null
  if (plan.finisseur && n >= plan.series.length - 1) return null
  const derniere = histo[0]
  if (!derniere?.length) return null
  const bas = basDe(plan, n)
  const d = derniere[n]
  if (d && d.type === 'normale' && d.charge === charge && d.reps > 0 && d.reps < bas) return { genre: 'reps', avant: d.reps, vise: bas }
  if (n === 0 && !exo.assistance) {
    const plusLourde = Math.max(...derniere.map((x) => x.charge))
    if (plusLourde < charge) {
      // La dernière séance où cette charge a été tentée : il faut qu'elle y ait été ratée, sinon c'est juste un programme qui alterne lourd et léger.
      const tentative = histo.slice(1).find((h) => h.some((x) => x.charge >= charge))
      if (tentative?.some((x) => x.charge >= charge && x.type === 'normale' && x.reps < bas)) return { genre: 'charge', avant: plusLourde, vise: charge }
    }
  }
  return null
}

/** La série faite prend-elle la revanche ? Reps : le bas atteint. Charge : la charge retrouvée, avec au moins le bas. */
export const revanchePrise = (r: Revanche, plan: ExoPlan, n: number, s: Serie) => (r.genre === 'reps' ? s.reps >= r.vise : s.charge >= r.vise && s.reps >= basDe(plan, n))
