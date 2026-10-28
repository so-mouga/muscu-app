import type { Exercice, ExoPlan, Seance, Serie } from '../types'

export type Decision = 'augmenter' | 'plus_une_rep' | 'consolider' | 'baisser' | 'calibrer' | 'depart' | 'manuel'

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

const estFinisseur = (s: Serie) => s.type === 'echec' || s.type === 'serie_longue'
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

function increment(exo: Exercice, c: number): number {
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
      message: 'Charge de départ du programme.',
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
 * Suggestion pour la prochaine séance d'un exercice : l'objectif fixé à la main en fin de
 * dernière séance s'il existe, sinon la double progression automatique.
 * `seances` : séances terminées, la plus récente en premier.
 */
export function suggestionPour(exo: Exercice, plan: ExoPlan, seances: Seance[]): Suggestion {
  const avec = seances.filter((s) => s.series.some((x) => x.exoId === exo.id))
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
  return suggere(
    exo,
    plan,
    avec.map((s) => s.series.filter((x) => x.exoId === exo.id))
  )
}
