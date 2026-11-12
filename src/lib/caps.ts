import type { Exercice, ExoPlan, Seance, Serie } from '../types'
import { chargeTexte, enTemps, kg } from './calc'
import { serieComptee } from './historique'
import { fourchetteParDefaut } from './programme'

/**
 * Les caps : une charge à atteindre sur un exercice, plus loin que le conseil de la prochaine fois (« 60 kg au développé
 * couché »). Un seul nombre à choisir, sans date. Franchi le jour où toutes les séries du programme sont faites à cette
 * charge, au bas de la fourchette ou plus : c'est la façon dont l'appli fait déjà monter. Au poids du corps, le cap est
 * un nombre de reps sur toutes les séries. Le cap ne change aucun conseil. Seule la définition est enregistrée (réglage
 * `caps`) : où on en est et le jour où il tombe se recalculent depuis les séances.
 */

export const CLE_CAPS = 'caps'
/** Caps en cours en même temps : au-delà, ce n'est plus un cap, c'est une liste de souhaits. */
export const CAPS_MAX = 3
/** Cap proposé : ce nombre de paliers au-dessus de la charge actuelle, puis arrondi à un chiffre rond. */
const PALIERS_PROPOSES = 4

/** Ce qui compte pour un cap : tant de séries, à tant de reps ou plus. Copié du programme le jour où le cap est fixé. */
export interface RegleCap {
  /** `charge` : des kg à atteindre. `reps` : au poids du corps, un nombre de reps. */
  genre: 'charge' | 'reps'
  series: number
  /** Reps à faire au moins sur chaque série (genre `charge`). */
  reps: number
}

export interface Cap extends RegleCap {
  exoId: string
  /** Kg à atteindre, ou reps au poids du corps. */
  cible: number
  /** Où on en était le jour où le cap a été fixé. */
  depart: number
  /** Jour où il a été fixé (AAAA-MM-JJ). */
  depuis: string
}

const arrondi = (x: number) => Math.round(x * 100) / 100

export function lireCaps(valeur: unknown): Cap[] {
  if (!Array.isArray(valeur)) return []
  return valeur.filter((c): c is Cap => !!c && typeof c.exoId === 'string' && typeof c.cible === 'number' && typeof c.depart === 'number' && typeof c.depuis === 'string' && (c.genre === 'charge' || c.genre === 'reps'))
}

/** Pas de cap sur un exercice assisté (moins de kg = plus dur), en temps ou à l'élastique. */
export function genreCap(exo: Exercice): RegleCap['genre'] | null {
  if (exo.assistance || enTemps(exo) || exo.mode === 'elastique') return null
  return exo.mode === 'poids_corps' ? 'reps' : 'charge'
}

/**
 * La règle d'un cap pour cet exercice : les séries du programme (sans le finisseur) et le bas de leur fourchette.
 * Hors programme : les séries normales de la dernière fois et la fourchette par défaut.
 */
export function regleCap(exo: Exercice, plan?: ExoPlan, derniere?: Serie[]): RegleCap | null {
  const genre = genreCap(exo)
  if (!genre) return null
  const prevues = plan ? plan.series.slice(0, Math.max(1, plan.series.length - (plan.finisseur ? 1 : 0))) : []
  const series = prevues.length || derniere?.filter(serieComptee).length || 3
  const reps = prevues.length ? Math.min(...prevues.map((x) => x.repsMin)) : fourchetteParDefaut(exo).repsMin
  return { genre, series, reps }
}

/** Ce qu'une séance vaut pour un cap : la charge tenue sur toutes les séries demandées (ou les reps, au poids du corps). Rien s'il manque des séries. */
export function niveauSeance(regle: RegleCap, series: Serie[]): number | null {
  const comptees = series.filter(serieComptee)
  const valeurs = regle.genre === 'charge' ? comptees.filter((x) => x.reps >= regle.reps).map((x) => x.charge) : comptees.filter((x) => x.charge >= 0).map((x) => x.reps)
  return valeurs.sort((a, b) => b - a)[regle.series - 1] ?? null
}

/** Où on en est : la meilleure séance, hors séances allégées. */
export function niveau(regle: RegleCap, exoId: string, seances: Seance[]): number | null {
  let max: number | null = null
  for (const s of seances) {
    if (s.deload || s.enCours) continue
    const n = niveauSeance(regle, s.series.filter((x) => x.exoId === exoId))
    if (n !== null && (max === null || n > max)) max = n
  }
  return max
}

/** Le cap proposé : quelques paliers plus haut, à un chiffre rond. Rien sans repère, ni au-delà de la charge max du matériel. */
export function capPropose(exo: Exercice, regle: RegleCap, actuel: number | null): number | null {
  if (actuel === null) return null
  if (regle.genre === 'reps') return actuel + 2
  if (actuel <= 0) return null
  let c = arrondi(actuel + PALIERS_PROPOSES * exo.pas)
  while (c % 5 !== 0 && c < actuel + 2 * PALIERS_PROPOSES * exo.pas) c = arrondi(c + exo.pas)
  if (exo.chargeMax) c = Math.min(c, exo.chargeMax)
  return c > actuel ? c : null
}

/** Le plus petit cap possible : un palier (ou une rep) au-dessus de là où on en est. */
export const capMin = (exo: Exercice, regle: RegleCap, actuel: number) => (regle.genre === 'reps' ? actuel + 1 : arrondi(actuel + exo.pas))

export interface EtatCap {
  /** Où on en est, jamais sous le départ. */
  niveau: number
  reste: number
  /** Chemin fait, de 0 à 1. */
  part: number
  /** La séance où il est tombé. */
  franchi?: { date: string; seanceId: string }
}

/** Où en est un cap, et la première séance, depuis qu'il est fixé, où il a été franchi. */
export function etatCap(cap: Cap, seances: Seance[]): EtatCap {
  let max = cap.depart
  let franchi: EtatCap['franchi']
  for (const s of [...seances].sort((a, b) => a.debut - b.debut)) {
    if (s.deload || s.enCours) continue
    const n = niveauSeance(cap, s.series.filter((x) => x.exoId === cap.exoId))
    if (n === null) continue
    max = Math.max(max, n)
    if (!franchi && n >= cap.cible && s.date >= cap.depuis) franchi = { date: s.date, seanceId: s.id }
  }
  const total = cap.cible - cap.depart
  return { niveau: max, reste: Math.max(0, arrondi(cap.cible - max)), part: total > 0 ? Math.min(1, Math.max(0, (max - cap.depart) / total)) : 1, franchi }
}

/** Caps encore à franchir. */
export const capsEnCours = (caps: Cap[], seances: Seance[]) => caps.filter((c) => !etatCap(c, seances).franchi)

/** Le cap tombe dans cette séance (en cours ou finie) : elle l'atteint, et aucune séance d'avant ne l'avait fait. Jamais en séance allégée. */
export function capFranchiDans(cap: Cap, seance: Seance, avant: Seance[]): boolean {
  if (seance.deload || seance.date < cap.depuis) return false
  const n = niveauSeance(cap, seance.series.filter((x) => x.exoId === cap.exoId))
  return n !== null && n >= cap.cible && !etatCap(cap, avant.filter((s) => s.id !== seance.id && s.debut < seance.debut)).franchi
}

/**
 * Le cap est à ta portée aujourd'hui : les charges prévues pour la séance sont celles du cap, sur toutes ses séries
 * (on y est monté, ou on y était déjà sans avoir toutes les reps). Au poids du corps : les reps prévues, ou une rep d'écart.
 */
export function capAPortee(cap: Cap, prevu: { charges: (number | null)[]; reps: number[] }, actuel: number): boolean {
  if (cap.genre === 'charge') return prevu.charges.filter((c) => c !== null && c >= cap.cible).length >= cap.series
  return prevu.reps.filter((r) => r >= cap.cible).length >= cap.series || actuel === cap.cible - 1
}

/** « 60 kg », « 22 kg/main », ou « 3 × 10 » au poids du corps. */
export const texteCap = (exo: Exercice, regle: RegleCap, valeur: number) => (regle.genre === 'charge' ? chargeTexte(exo, valeur) : `${regle.series} × ${valeur}`)

/** « Encore 5 kg. », « Encore 2 reps. » */
export const texteReste = (regle: RegleCap, reste: number) => (regle.genre === 'charge' ? `Encore ${kg(reste)} kg.` : `Encore ${reste} rep${reste > 1 ? 's' : ''}.`)

/** Quand il tombe : « toutes tes séries à cette charge », écrit avec les chiffres. */
export const regleEnClair = (exo: Exercice, regle: RegleCap, cible: number) =>
  regle.genre === 'charge'
    ? `Franchi le jour où tu fais ${regle.series > 1 ? `tes ${regle.series} séries` : 'ta série'} à ${chargeTexte(exo, cible)}, à ${regle.reps} reps ou plus.`
    : `Franchi le jour où tu fais ${regle.series > 1 ? `${regle.series} séries` : 'une série'} de ${cible} reps.`

/** Le temps mis, dit après coup : « en 19 semaines », « en 9 jours ». Jamais une échéance. */
export function dureeCap(depuis: string, date: string): string {
  const jours = Math.max(1, Math.round((Date.parse(date + 'T12:00:00') - Date.parse(depuis + 'T12:00:00')) / 86400000))
  if (jours < 14) return `en ${jours} jour${jours > 1 ? 's' : ''}`
  return `en ${Math.round(jours / 7)} semaines`
}
