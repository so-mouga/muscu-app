import type { Exercice, ExoPlan, Seance, Serie } from '../types'
import { enTemps } from './calc'

export type Decision = 'augmenter' | 'plus_une_rep' | 'consolider' | 'baisser' | 'calibrer' | 'depart' | 'manuel' | 'pareil'

export interface Suggestion {
  decision: Decision
  /** Charge par série prévue (null = à calibrer). */
  charges: (number | null)[]
  reps: number[]
  message: string
  /** Titre court du conseil (« 💡 Tu peux viser plus », « 💡 Tu peux monter »…). */
  titre?: string
}

/** Au-delà de ce saut relatif, la montée doit être confirmée sur deux séances. */
const SAUT_MAX = 0.1
const EPS = 1e-9

const estFinisseur = (s: Serie) => s.type !== 'normale'
const arrondi = (x: number) => Math.round(x * 100) / 100
const nombre = (x: number) => x.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
const kgTexte = nombre

interface Bilan {
  top: boolean
  rpeOk: boolean
  garde: boolean
  sous: boolean
  ecartMoyen: number
  /** Séries de travail faites face à celles prévues : moins = séance écourtée, pas de progression. */
  faites: number
  prevues: number
}

/** Fourchette prévue pour la série `i` (chaque série peut avoir la sienne : 12 / 10 / 8). */
const plage = (plan: ExoPlan, i: number) => plan.series[Math.min(i, plan.series.length - 1)]
const bas = (plan: ExoPlan, i: number) => plage(plan, i).repsMin
const haut = (plan: ExoPlan, i: number) => plage(plan, i).repsMax
/** Séries de travail prévues (le finisseur est la dernière série du plan). */
const normalesPrevues = (plan: ExoPlan) => plan.series.length - (plan.finisseur && plan.series.length > 1 ? 1 : 0)
const memeFourchette = (plan: ExoPlan) => plan.series.every((x) => x.repsMin === plan.series[0].repsMin && x.repsMax === plan.series[0].repsMax)
/** « 10 » si toutes les séries ont la même borne, sinon « le bas de leur fourchette ». */
const borneTexte = (plan: ExoPlan, b: 'repsMin' | 'repsMax') => (memeFourchette(plan) ? `${plan.series[0][b]}` : b === 'repsMin' ? 'le bas de leur fourchette' : 'le haut de leur fourchette')

/** « 10 reps » ou « le bas de leur fourchette ». */
const repsBorne = (plan: ExoPlan, b: 'repsMin' | 'repsMax') => (memeFourchette(plan) ? `${plan.series[0][b]} reps` : borneTexte(plan, b))
/** « à 8 » ou « au bas de leur fourchette ». */
const aLaBasse = (plan: ExoPlan) => (memeFourchette(plan) ? `à ${plan.series[0].repsMin}` : 'au bas de leur fourchette')

function bilan(series: Serie[], plan: ExoPlan): Bilan | null {
  const ref = series.filter((s) => s.type === 'normale')
  const fin = series.filter(estFinisseur)
  if (ref.length === 0) return null
  const i = (s: Serie) => series.indexOf(s)
  const cible = (s: Serie) => s.rpeCible ?? plan.series[i(s)]?.rpe ?? plan.series[0].rpe
  const ecarts = ref.map((s) => s.rpe - cible(s))
  const ecartMoyen = ecarts.reduce((a, b) => a + b, 0) / ecarts.length
  return {
    // Toutes les séries prévues, pas seulement celles faites : une séance écourtée n'est pas « au sommet ».
    top: ref.length >= normalesPrevues(plan) && ref.every((s) => s.reps >= haut(plan, i(s))),
    rpeOk: ecartMoyen <= 0.5 + EPS && Math.max(...ecarts) <= 1 + EPS,
    garde: fin.every((f) => f.reps >= bas(plan, i(f)) - 3),
    sous: ref.some((s) => s.reps < bas(plan, i(s)) && s.rpe >= cible(s)),
    ecartMoyen,
    faites: ref.length,
    prevues: normalesPrevues(plan),
  }
}

export function increment(exo: Exercice, c: number): number {
  if (exo.mode === 'poids_corps' || exo.mode === 'elastique' || exo.assistance) return exo.pas
  return exo.pas * Math.max(1, Math.ceil((c * 0.025) / exo.pas - EPS))
}

/** La charge d'un cran plus dur. Exercice assisté : un cran de moins d'assistance, jamais sous zéro. */
const plusDur = (exo: Exercice, c: number) => (exo.assistance ? Math.max(0, arrondi(c - increment(exo, c))) : arrondi(c + increment(exo, c)))

function decrement(exo: Exercice, c: number): number {
  if (exo.mode === 'poids_corps' || exo.mode === 'elastique' || exo.assistance) return exo.pas
  return exo.pas * Math.max(1, Math.floor((c * 0.05) / exo.pas + EPS))
}

/**
 * Double progression au RPE visé (cahier des charges 5.6, avec la baisse
 * conditionnée à deux séances de suite sous la borne basse).
 * `historique` : séries de l'exercice par séance, la plus récente en premier.
 */
export function suggere(exo: Exercice, plan: ExoPlan, historique: Serie[][]): Suggestion {
  const n = plan.series.length
  const basDe = plan.series.map((p) => p.repsMin)
  const derniere = historique.find((h) => h.length > 0)

  if (!derniere) {
    // Rien à trouver au poids du corps ou en temps : pas de « à calibrer » ni de « charge de départ ».
    const sansCharge = enTemps(exo) || exo.mode === 'poids_corps'
    if (sansCharge)
      return {
        decision: 'depart',
        charges: plan.series.map((p) => p.charge ?? plan.charge ?? 0),
        reps: plan.series.map((p) => p.repsMin),
        message: enTemps(exo) ? 'Premier passage : ajuste le temps au ressenti.' : 'Premier passage : ajuste les reps au ressenti.',
      }
    if (plan.charge === null) {
      return {
        decision: 'calibrer',
        charges: Array(n).fill(null),
        reps: plan.series.map((p) => p.repsMin),
        message: 'À calibrer : démarre léger et ajuste jusqu’à l’effort visé dès la 1re série.',
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
  const memesReps = () => plan.series.map((_, i) => Math.min(repsA(i), haut(plan, i)))

  const b = bilan(derniere, plan)
  if (!b) {
    return { decision: 'consolider', charges: memesCharges(), reps: memesReps(), message: 'Refais la même séance.' }
  }

  if (b.top && b.rpeOk && b.garde) {
    const ref = Math.max(...memesCharges())
    if (exo.assistance && ref <= 0) {
      return {
        decision: 'consolider',
        charges: memesCharges(),
        reps: plan.series.map((p) => p.repsMax),
        message: 'Plus aucune assistance : passe à la version sans machine, ou garde et ralentis la descente.',
      }
    }
    const inc = increment(exo, ref)
    // Une assistance en moins ne fait pas un saut de charge : le poids du corps reste le gros du travail.
    const grosSaut = !exo.assistance && (exo.mode === 'machine' || exo.mode === 'par_main') && ref > 0 && inc / ref > SAUT_MAX + EPS
    const max = exo.chargeMax
    if (max !== undefined && ref + inc > max + EPS) {
      return {
        decision: 'consolider',
        charges: memesCharges(),
        reps: plan.series.map((p) => p.repsMax),
        message: 'Charge max du matériel atteinte : garde la charge, ralentis la descente ou ajoute une pause.',
      }
    }
    if (grosSaut) {
      const pb = precedente && bilan(precedente, plan)
      if (!(pb && pb.top && pb.rpeOk && pb.garde)) {
        return {
          decision: 'consolider',
          charges: memesCharges(),
          reps: plan.series.map((p) => p.repsMax),
          message: `Sommet atteint, mais +${nombre(inc)} kg = +${Math.round((inc / ref) * 100)} % : confirme une séance avant de monter.`,
        }
      }
    }
    const unite = exo.mode === 'elastique' ? ' niveau' : ' kg'
    return {
      decision: 'augmenter',
      charges: plan.series.map((_, i) => plusDur(exo, chargeA(i))),
      reps: basDe,
      message: `↑ ${exo.assistance ? '−' : '+'}${nombre(inc)}${unite} : toutes les séries au sommet de la fourchette au RPE visé. Reps repartent ${aLaBasse(plan)}.`,
    }
  }

  if (b.sous) {
    const pb = precedente && bilan(precedente, plan)
    if (pb && pb.sous) {
      return {
        decision: 'baisser',
        charges: plan.series.map((_, i) => {
          const c = chargeA(i)
          if (exo.assistance) return arrondi(c + decrement(exo, c))
          const d = c - decrement(exo, c)
          return exo.mode === 'machine' || exo.mode === 'par_main' ? Math.max(0, arrondi(d)) : arrondi(d)
        }),
        reps: basDe,
        message: `↓ Deux séances de suite sous ${repsBorne(plan, 'repsMin')} : on baisse un peu pour repartir propre.`,
      }
    }
    return {
      decision: 'consolider',
      charges: memesCharges(),
      reps: basDe,
      message: `Sous ${repsBorne(plan, 'repsMin')} : même charge. Si ça se répète, elle baissera.`,
    }
  }

  if (!b.rpeOk || !b.garde) {
    return {
      decision: 'consolider',
      charges: memesCharges(),
      reps: memesReps(),
      message: !b.garde
        ? `= Série d’échec trop courte (< ${bas(plan, n - 1) - 3} reps) : on consolide.`
        : `= RPE plus haut que prévu (+${nombre(arrondi(b.ecartMoyen))} en moyenne) : on consolide.`,
    }
  }

  // Séance écourtée : on refait d'abord la séance en entier, pas de rep en plus.
  if (b.faites < b.prevues) return { decision: 'consolider', charges: memesCharges(), reps: memesReps(), message: 'Refais la même séance, en entier.' }

  // Même charge, +1 rep : sur deux séries si toutes étaient faciles (effort 7 ou moins, 3 reps en réserve),
  // sinon sur une seule ; celles qui sont le plus loin du haut de leur fourchette.
  // On part de ce qui a été fait : une série au-dessus de sa fourchette garde ses reps, viser plus n'en retire jamais.
  const reps = plan.series.map((_, i) => repsA(i))
  const facile = derniere.filter((s) => s.type === 'normale').every((s) => s.rpe <= 7)
  const reste = (i: number) => haut(plan, i) - reps[i]
  const candidates = plan.series
    .map((_, i) => i)
    .filter((i) => derniere[i] && derniere[i].type === 'normale' && reps[i] < haut(plan, i))
    .sort((a, c) => reste(c) - reste(a) || a - c)
    .slice(0, facile ? 2 : 1)
  // Rien à ajouter (séance écourtée, séries faites déjà au sommet) : on refait pareil.
  if (!candidates.length) return { decision: 'consolider', charges: memesCharges(), reps, message: 'Refais la même séance, en entier.' }
  candidates.forEach((i) => (reps[i] = Math.min(haut(plan, i), reps[i] + 1)))
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
      message: 'Objectif fixé par toi à la fin de la dernière séance.',
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
 * exercice avec une vraie fourchette (même nombre des deux côtés : on refait pareil). D'abord des reps dans la fourchette,
 * puis la charge quand toutes les séries atteignent le haut. C'est une proposition : l'utilisateur
 * l'applique ou non. `historique` : séries de l'exercice par séance, la plus récente en premier.
 */
export function conseil(exo: Exercice, plan: ExoPlan, historique: Serie[][]): Suggestion | null {
  if (enTemps(exo) || !historique.some((h) => h.length)) return null
  const s = suggere(exo, plan, historique)
  const bas = borneTexte(plan, 'repsMin')
  const haut = borneTexte(plan, 'repsMax')
  const derniere = historique.find((h) => h.length)!
  const b = bilan(derniere, plan)
  const ord = (i: number) => (i === 0 ? '1re' : `${i + 1}e`)
  const series = (n: number) => `${n} série${n > 1 ? 's' : ''}`
  const unite = exo.mode === 'elastique' ? ' niveau' : exo.assistance ? ' kg d’assistance' : ' kg'
  // Série ratée (sous le bas, à l'effort visé) : viser le bas plutôt que refaire le score raté. Sans
  // fourchette, pas de baisse automatique : on vise le bas, même après deux ratés.
  if (b?.sous && (s.decision !== 'baisser' || !aFourchette(plan))) {
    const p = pareil(exo, plan, historique)
    const reps = p.reps.map((r, i) => Math.max(r, plage(plan, i).repsMin))
    const k = derniere.findIndex((x, i) => x.type === 'normale' && x.reps < plage(plan, i).repsMin)
    if (reps.some((r, i) => r !== p.reps[i]))
      return {
        decision: 'consolider',
        charges: p.charges,
        reps,
        titre: `💡 Même charge, vise ${bas}`,
        message: `Pourquoi : ${derniere[k].reps} reps sur la ${ord(k)} série, sous le bas de ${memeFourchette(plan) ? `ta fourchette (${bas})` : 'sa fourchette'}.\nSi ça se répète, baisse un peu.`,
      }
  }
  if (!aFourchette(plan)) return null
  if (s.decision === 'augmenter') {
    const d = arrondi((s.charges[0] ?? 0) - derniere[0].charge)
    const palier = exo.mode === 'machine' && !exo.assistance ? ' (le palier de la machine)' : ''
    return { ...s, titre: exo.assistance ? '💡 Moins d’assistance' : '💡 Tu peux monter', message: `Pourquoi : ${b!.faites > 1 ? `tes ${series(b!.faites)} ont` : 'ta série a'} atteint ${repsBorne(plan, 'repsMax')} à l’effort visé.\n${d < 0 ? '−' : '+'}${nombre(Math.abs(d))}${unite}${palier}, les reps repartent ${aLaBasse(plan)}.` }
  }
  if (s.decision === 'plus_une_rep') {
    const plus = s.reps.map((_, i) => i).filter((i) => derniere[i] && s.reps[i] > derniere[i].reps)
    const pourquoi =
      plus.length === 1
        ? `${ord(plus[0])} série à ${derniere[plus[0]].reps} reps, effort ${kgTexte(derniere[plus[0]].rpe)}/10`
        : `tes séries étaient faciles (effort 7/10 ou moins)`
    return { ...s, titre: '💡 Tu peux viser plus', message: `Pourquoi : ${pourquoi}.\nLa charge montera quand toutes feront ${haut}.` }
  }
  if (s.decision === 'baisser') return { ...s, titre: exo.assistance ? '💡 Un peu plus d’assistance' : '💡 Baisse un peu', message: `Pourquoi : deux séances de suite sous ${repsBorne(plan, 'repsMin')}.\nOn repart un peu plus ${exo.assistance ? 'aidé' : 'léger'} pour refaire des séries propres.` }
  // Haut atteint mais montée trop forte d'un coup (ou matériel au max) : le dire plutôt que se taire.
  if (s.decision === 'consolider' && b && b.top && b.rpeOk && b.garde) {
    const saut = s.message.match(/mais (.+) : confirme/)
    return saut
      ? { ...s, titre: '💡 Confirme d’abord', message: `Pourquoi : haut de la fourchette atteint, mais ${saut[1]} d’un coup.\nRefais ${memeFourchette(plan) ? `${haut} reps` : 'le haut'} sur toutes les séries pour confirmer, puis monte.` }
      : { ...s, titre: '💡 Charge max atteinte', message: s.message }
  }
  return null
}

/**
 * Pourquoi on refait pareil quand il n'y a pas de conseil (exercice avec fourchette) : effort plus
 * dur que prévu ou série d'échec trop courte. Null si rien à expliquer.
 */
export function raisonPareil(exo: Exercice, plan: ExoPlan, historique: Serie[][]): string | null {
  if (enTemps(exo) || !aFourchette(plan)) return null
  const derniere = historique.find((h) => h.length)
  const b = derniere && bilan(derniere, plan)
  if (!b) return null
  if (b.faites < b.prevues) {
    const r = derniere.filter((x) => x.type === 'normale').map((x) => x.reps)
    return `Tu as fait ${b.faites} série${b.faites > 1 ? 's' : ''} sur ${b.prevues} : refais d’abord les ${b.prevues}${r.every((x) => x === r[0]) ? ` à ${r[0]} reps` : ''}, le conseil viendra ensuite.`
  }
  if (!b.garde) return `Série d’échec trop courte (moins de ${bas(plan, plan.series.length - 1) - 3} reps) : refais pareil avant de monter.`
  if (!b.rpeOk) {
    // En clair et au dixième près : un arrondi au demi-point faisait croire qu'on était pile à la limite.
    const ref = derniere.filter((x) => x.type === 'normale')
    const moy = (l: number[]) => Math.round((l.reduce((x, y) => x + y, 0) / l.length) * 10) / 10
    const fait = moy(ref.map((x) => x.rpe))
    const vise = moy(ref.map((x) => x.rpeCible ?? plan.series[derniere.indexOf(x)]?.rpe ?? plan.series[0].rpe))
    return b.ecartMoyen > 0.5 + EPS
      ? `Plus dur que prévu (effort moyen ${nombre(fait)} pour ${nombre(vise)} visé) : refais pareil pour consolider avant de monter.`
      : `Plus dur que prévu (une série bien au-dessus de l’effort visé) : refais pareil pour consolider avant de monter.`
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
  if (exo.assistance && precedente.charge <= 0) return null
  const c = plusDur(exo, precedente.charge)
  return exo.chargeMax !== undefined && c > exo.chargeMax + EPS ? null : c
}

/** Ce que l'objectif demande de plus que la dernière fois pour la série `i` : « +2,5 kg », « +1 rep » (null sinon). */
export function hausse(exo: Exercice, sugg: Suggestion, derniere: Serie[] | undefined, i: number): string | null {
  const d = derniere?.[i]
  const c = sugg.charges[i]
  if (!d || c === null || c === undefined) return null
  const dc = arrondi(c - d.charge)
  const dr = (sugg.reps[i] ?? 0) - d.reps
  if (exo.assistance && dc < -EPS) return `−${nombre(-dc)} kg d’assistance`
  if (exo.assistance && dc > EPS) return null
  if (dc > EPS) return `+${nombre(dc)}${exo.mode === 'elastique' ? ' niv.' : ' kg'}`
  if (Math.abs(dc) <= EPS && dr > 0) return exo.mesure === 'temps' ? `+${dr} s` : `+${dr} rep${dr > 1 ? 's' : ''}`
  return null
}

/** L'objectif dépasse la dernière fois sur au moins une série : « à battre ». */
export const aBattre = (exo: Exercice, sugg: Suggestion, derniere: Serie[] | undefined) => sugg.charges.some((_, i) => hausse(exo, sugg, derniere, i) !== null)

/**
 * Charge pré-remplie pour la série `index` : la cible, décalée du même écart que celui appliqué à la
 * dernière série faite (monté de 10 kg en S1 → S2 et S3 aussi). Sans cible : la charge de la dernière série faite.
 */
export function chargeProposee(exo: Exercice, sugg: Suggestion, faites: Serie[], index: number): number {
  const i = Math.min(index, sugg.charges.length - 1)
  const k = Math.min(index, faites.length) - 1
  const prec = faites[k]
  const s = sugg.charges[i]
  if (s === null) return prec?.charge ?? (exo.mode === 'elastique' ? 1 : 0)
  const sPrec = sugg.charges[Math.min(k, sugg.charges.length - 1)]
  return prec && sPrec !== null && sPrec !== undefined ? Math.max(0, s + (prec.charge - sPrec)) : s
}
