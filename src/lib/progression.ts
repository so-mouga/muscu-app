import type { Exercice, ExoPlan, Seance, Serie } from '../types'
import { enTemps } from './calc'

export type Decision = 'augmenter' | 'plus_une_rep' | 'consolider' | 'baisser' | 'calibrer' | 'depart' | 'manuel' | 'pareil'

export interface Suggestion {
  decision: Decision
  /** Charge par série prévue (null = à calibrer). */
  charges: (number | null)[]
  reps: number[]
  message: string
}

/** Au-delà de ce saut relatif, la montée doit être confirmée sur deux séances. */
const SAUT_MAX = 0.1
const EPS = 1e-9

const estFinisseur = (s: Serie) => s.type !== 'normale'
const arrondi = (x: number) => Math.round(x * 100) / 100
const nombre = (x: number) => x.toLocaleString('fr-FR', { maximumFractionDigits: 2 })

interface Bilan {
  top: boolean
  rpeOk: boolean
  garde: boolean
  sous: boolean
  ecartMoyen: number
}

function bilan(series: Serie[], plan: ExoPlan): Bilan | null {
  const bas = plan.series[0].repsMin
  const haut = plan.series[0].repsMax
  const ref = series.filter((s) => s.type === 'normale')
  const fin = series.filter(estFinisseur)
  if (ref.length === 0) return null
  const cible = (s: Serie) => s.rpeCible ?? plan.series[series.indexOf(s)]?.rpe ?? plan.series[0].rpe
  const ecarts = ref.map((s) => s.rpe - cible(s))
  const ecartMoyen = ecarts.reduce((a, b) => a + b, 0) / ecarts.length
  return {
    top: ref.every((s) => s.reps >= haut),
    rpeOk: ecartMoyen <= 0.5 + EPS && Math.max(...ecarts) <= 1 + EPS,
    garde: fin.every((f) => f.reps >= bas - 3),
    sous: ref.some((s) => s.reps < bas && s.rpe >= cible(s)),
    ecartMoyen,
  }
}

export function increment(exo: Exercice, c: number): number {
  if (exo.mode === 'poids_corps' || exo.mode === 'elastique') return exo.pas
  return exo.pas * Math.max(1, Math.ceil((c * 0.025) / exo.pas - EPS))
}

function decrement(exo: Exercice, c: number): number {
  if (exo.mode === 'poids_corps' || exo.mode === 'elastique') return exo.pas
  return exo.pas * Math.max(1, Math.floor((c * 0.05) / exo.pas + EPS))
}

/**
 * Double progression au RPE visé (cahier des charges 5.6, avec la baisse
 * conditionnée à deux séances de suite sous la borne basse).
 * `historique` : séries de l'exercice par séance, la plus récente en premier.
 */
export function suggere(exo: Exercice, plan: ExoPlan, historique: Serie[][]): Suggestion {
  const n = plan.series.length
  const bas = plan.series[0].repsMin
  const haut = plan.series[0].repsMax
  const derniere = historique.find((h) => h.length > 0)

  if (!derniere) {
    if (plan.charge === null) {
      return {
        decision: 'calibrer',
        charges: Array(n).fill(null),
        reps: plan.series.map((p) => p.repsMin),
        message: 'À calibrer : démarre léger et ajuste jusqu’au RPE visé dès la 1re série.',
      }
    }
    return {
      decision: 'depart',
      charges: plan.series.map((p) => p.charge ?? plan.charge),
      reps: plan.series.map((p) => p.repsMin),
      message: 'Premier passage : charge de départ prévue, ajuste-la au ressenti.',
    }
  }

  const precedente = historique.filter((h) => h.length > 0)[1]
  const chargeA = (i: number) => (derniere[i] ?? derniere[derniere.length - 1]).charge
  const repsA = (i: number) => (derniere[i] ?? derniere[derniere.length - 1]).reps
  const memesCharges = () => plan.series.map((_, i) => chargeA(i))
  const memesReps = () => plan.series.map((_, i) => Math.min(repsA(i), haut))

  const b = bilan(derniere, plan)
  if (!b) {
    return { decision: 'consolider', charges: memesCharges(), reps: memesReps(), message: 'Refais la même séance.' }
  }

  if (b.top && b.rpeOk && b.garde) {
    const ref = Math.max(...memesCharges())
    const inc = increment(exo, ref)
    const grosSaut = (exo.mode === 'machine' || exo.mode === 'par_main') && ref > 0 && inc / ref > SAUT_MAX + EPS
    const max = exo.chargeMax
    if (max !== undefined && ref + inc > max + EPS) {
      return {
        decision: 'consolider',
        charges: memesCharges(),
        reps: plan.series.map(() => haut),
        message: 'Charge max du matériel atteinte : garde la charge, ralentis la descente ou ajoute une pause.',
      }
    }
    if (grosSaut) {
      const pb = precedente && bilan(precedente, plan)
      if (!(pb && pb.top && pb.rpeOk && pb.garde)) {
        return {
          decision: 'consolider',
          charges: memesCharges(),
          reps: plan.series.map(() => haut),
          message: `Sommet atteint, mais +${nombre(inc)} kg = +${Math.round((inc / ref) * 100)} % : confirme une séance avant de monter.`,
        }
      }
    }
    const unite = exo.mode === 'elastique' ? ' niveau' : ' kg'
    return {
      decision: 'augmenter',
      charges: plan.series.map((_, i) => arrondi(chargeA(i) + increment(exo, chargeA(i)))),
      reps: plan.series.map(() => bas),
      message: `↑ +${nombre(inc)}${unite} : toutes les séries au sommet de la fourchette au RPE visé. Reps repartent à ${bas}.`,
    }
  }

  if (b.sous) {
    const pb = precedente && bilan(precedente, plan)
    if (pb && pb.sous) {
      return {
        decision: 'baisser',
        charges: plan.series.map((_, i) => {
          const c = chargeA(i)
          const d = c - decrement(exo, c)
          return exo.mode === 'machine' || exo.mode === 'par_main' ? Math.max(0, arrondi(d)) : arrondi(d)
        }),
        reps: plan.series.map(() => bas),
        message: `↓ Deux séances de suite sous ${bas} reps : on baisse un peu pour repartir propre.`,
      }
    }
    return {
      decision: 'consolider',
      charges: memesCharges(),
      reps: plan.series.map(() => bas),
      message: `Reps sous ${bas} : même charge. Si ça se répète, elle baissera.`,
    }
  }

  if (!b.rpeOk || !b.garde) {
    return {
      decision: 'consolider',
      charges: memesCharges(),
      reps: memesReps(),
      message: !b.garde
        ? `= Série d’échec trop courte (< ${bas - 3} reps) : on consolide.`
        : `= RPE plus haut que prévu (+${nombre(arrondi(b.ecartMoyen))} en moyenne) : on consolide.`,
    }
  }

  // Même charge, +1 rep sur une ou deux séries de référence (les plus basses).
  const reps = memesReps()
  const candidates = plan.series
    .map((_, i) => i)
    .filter((i) => derniere[i] && derniere[i].type === 'normale' && reps[i] < haut)
    .sort((a, c) => reps[a] - reps[c] || a - c)
    .slice(0, 2)
  candidates.forEach((i) => (reps[i] = Math.min(haut, reps[i] + 1)))
  return {
    decision: 'plus_une_rep',
    charges: memesCharges(),
    reps,
    message: `+1 rep sur ${candidates.length > 1 ? 'deux séries' : 'une série'}, même charge.`,
  }
}

/**
 * Refaire exactement la dernière séance : même charge et mêmes reps, série par série.
 * Séance incomplète : une série pas faite prend la charge de la dernière série faite, et les reps
 * de la fois d'avant (sinon du programme). Une séance écourtée ne fausse jamais les autres séries.
 * C'est l'utilisateur qui décide de monter (objectif fixé en fin de séance).
 */
export function pareil(exo: Exercice, plan: ExoPlan, historique: Serie[][]): Suggestion {
  const depart = suggere(exo, plan, [])
  const derniere = historique.find((h) => h.length > 0)
  if (!derniere) return suggere(exo, plan, historique)
  const avant = (i: number) => historique.find((h) => h[i])?.[i]
  const chargeFaite = derniere[derniere.length - 1].charge
  return {
    decision: 'pareil',
    charges: plan.series.map((_, i) => derniere[i]?.charge ?? chargeFaite),
    reps: plan.series.map((_, i) => derniere[i]?.reps ?? avant(i)?.reps ?? depart.reps[i]),
    message: '= Comme la dernière fois.',
  }
}

/**
 * Suggestion pour la prochaine séance d'un exercice : l'objectif fixé à la main en fin de
 * dernière séance s'il existe, sinon refaire pareil (ou la double progression automatique si `auto`).
 * `seances` : séances terminées, la plus récente en premier.
 */
export function suggestionPour(exo: Exercice, plan: ExoPlan, seances: Seance[], auto = false): Suggestion {
  // Les déloads (allégés) ne servent jamais de référence.
  const avec = seances.filter((s) => !s.deload && s.series.some((x) => x.exoId === exo.id))
  const objectif = avec[0]?.objectifs?.[exo.id]
  if (objectif) {
    const n = plan.series.length
    const ajuste = <T,>(a: T[]) => Array.from({ length: n }, (_, i) => a[Math.min(i, a.length - 1)])
    return {
      decision: 'manuel',
      charges: ajuste(objectif.charges),
      reps: ajuste(objectif.reps),
      message: '✎ Objectif fixé par toi à la fin de la dernière séance.',
    }
  }
  return (auto ? suggere : pareil)(
    exo,
    plan,
    avec.map((s) => s.series.filter((x) => x.exoId === exo.id))
  )
}

const aFourchette = (plan: ExoPlan) => plan.series.some((x) => x.repsMin < x.repsMax)

/**
 * Conseil de surcharge pour la prochaine fois, d'après la double progression : seulement pour un
 * exercice avec une fourchette de reps (sinon on refait pareil). D'abord des reps dans la fourchette,
 * puis la charge quand toutes les séries atteignent le haut. C'est une proposition : l'utilisateur
 * l'applique ou non. `historique` : séries de l'exercice par séance, la plus récente en premier.
 */
export function conseil(exo: Exercice, plan: ExoPlan, historique: Serie[][]): Suggestion | null {
  if (enTemps(exo) || !aFourchette(plan) || !historique.some((h) => h.length)) return null
  const s = suggere(exo, plan, historique)
  const bas = plan.series[0].repsMin
  const haut = plan.series[0].repsMax
  if (s.decision === 'augmenter') return { ...s, message: `Toutes tes séries ont atteint ${haut} reps : monte la charge, les reps repartent à ${bas}.` }
  if (s.decision === 'plus_une_rep') return { ...s, message: `Même charge, une rep de plus. Tu monteras la charge quand toutes les séries atteindront ${haut}.` }
  if (s.decision === 'baisser') return { ...s, message: `Deux séances de suite sous ${bas} reps : baisse un peu pour repartir propre.` }
  // Haut atteint mais montée trop forte d'un coup (ou matériel au max) : le dire plutôt que se taire.
  const b = historique.find((h) => h.length) && bilan(historique.find((h) => h.length)!, plan)
  if (s.decision === 'consolider' && b && b.top && b.rpeOk && b.garde) {
    const saut = s.message.match(/mais (.+) : confirme/)
    return { ...s, message: saut ? `Haut de la fourchette atteint, mais ${saut[1]} d’un coup : refais ${haut} reps sur toutes les séries pour confirmer, puis monte.` : s.message }
  }
  return null
}

/**
 * Pendant la séance : la série d'avant dépasse nettement le haut de la fourchette (3 reps ou plus),
 * on peut monter d'un cran tout de suite. Renvoie la charge proposée, sinon null.
 */
export function monterMaintenant(exo: Exercice, plan: ExoPlan, precedente: Serie | undefined, index: number): number | null {
  const p = plan.series[Math.min(index - 1, plan.series.length - 1)]
  if (!precedente || precedente.type !== 'normale' || enTemps(exo) || !p || p.repsMin >= p.repsMax) return null
  if (precedente.reps < p.repsMax + 3) return null
  const c = arrondi(precedente.charge + increment(exo, precedente.charge))
  return exo.chargeMax !== undefined && c > exo.chargeMax + EPS ? null : c
}

/** Ce que l'objectif demande de plus que la dernière fois pour la série `i` : « +2,5 kg », « +1 rep » (null sinon). */
export function hausse(exo: Exercice, sugg: Suggestion, derniere: Serie[] | undefined, i: number): string | null {
  const d = derniere?.[i]
  const c = sugg.charges[i]
  if (!d || c === null || c === undefined) return null
  const dc = arrondi(c - d.charge)
  const dr = (sugg.reps[i] ?? 0) - d.reps
  if (dc > EPS) return `+${nombre(dc)}${exo.mode === 'elastique' ? ' niv.' : ' kg'}`
  if (Math.abs(dc) <= EPS && dr > 0) return exo.mesure === 'temps' ? `+${dr} s` : `+${dr} rep${dr > 1 ? 's' : ''}`
  return null
}

/** L'objectif dépasse la dernière fois sur au moins une série : « à battre ». */
export const aBattre = (exo: Exercice, sugg: Suggestion, derniere: Serie[] | undefined) => sugg.charges.some((_, i) => hausse(exo, sugg, derniere, i) !== null)
