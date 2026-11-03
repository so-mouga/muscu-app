import type { Exercice, Seance, Serie } from '../types'
import { dureeSeanceEffective, e1rm, enTemps, estDure, kgSouleves, lundi } from './calc'

export interface Bilan {
  seances: number
  /** ms */
  temps: number
  dures: number
  tonnage: number
  records: number
}

/** Durée d'une séance terminée (de la 1re à la dernière série si possible, sinon jusqu'à sa fin). */
export const dureeReelle = (s: Seance) => dureeSeanceEffective(s)

/** Lundi (AAAA-MM-JJ) de la semaine d'une date AAAA-MM-JJ. */
export const semaineDe = (date: string) => lundi(new Date(date + 'T12:00:00'))

/**
 * Score de performance d'une série, pour comparer un exercice avec lui-même : le 1RM estimé quand
 * il existe, sinon le temps tenu (exercice en temps), sinon la charge puis les reps (poids du corps compris).
 */
export function scoreSerie(exo: Exercice, x: Serie, poidsCorps?: number): number {
  if (enTemps(exo)) return x.reps
  // Poids du corps : le lest puis les reps, avec ou sans pesée. Deux échelles (force estimée, lest × 1000) rendaient la référence impossible à battre.
  if (exo.mode === 'poids_corps') return x.charge * 1000 + x.reps
  return e1rm(exo, x, poidsCorps) ?? (exo.assistance ? -x.charge : x.charge) * 1000 + x.reps
}

/**
 * Séries de travail d'un exercice, par séance terminée, la plus récente en premier. Les déloads
 * (allégés) n'y sont jamais : ils ne servent ni de « dernière fois » ni de référence aux conseils.
 */
export function historiqueDe(seances: Seance[], exoId: string): Serie[][] {
  return seances.filter((s) => !s.deload).map((s) => s.series.filter((x) => x.exoId === exoId)).filter((h) => h.length > 0)
}

/**
 * Nombre d'exercices qui battent leur record par séance (voir `scoreSerie`). Le premier passage sur
 * un exercice ne compte pas : il n'y a encore rien à battre. Les déloads ne comptent jamais.
 */
export function recordsParSeance(seances: Seance[], exo: (id: string) => Exercice): Record<string, number> {
  const meilleur: Record<string, number> = {}
  const res: Record<string, number> = {}
  for (const s of [...seances].sort((a, b) => a.debut - b.debut)) {
    const duJour: Record<string, number> = {}
    res[s.id] = 0
    if (s.deload) continue
    for (const x of s.series) {
      if (x.reps <= 0) continue
      // Un exercice assisté sans poids noté a un score négatif : on part de −∞, pas de 0.
      duJour[x.exoId] = Math.max(duJour[x.exoId] ?? -Infinity, scoreSerie(exo(x.exoId), x, s.poidsCorps))
    }
    for (const [id, e] of Object.entries(duJour)) {
      if (meilleur[id] !== undefined && e > meilleur[id]) res[s.id]++
      meilleur[id] = Math.max(meilleur[id] ?? -Infinity, e)
    }
  }
  return res
}

/**
 * Nombre d'exercices en progrès par séance : meilleure série au-dessus de celle de la fois d'avant
 * sur le même exercice (voir `scoreSerie`). Les déloads ne comptent pas et ne servent pas de référence.
 */
export function mieuxParSeance(seances: Seance[], exo: (id: string) => Exercice): Record<string, number> {
  const derniere: Record<string, number> = {}
  const res: Record<string, number> = {}
  for (const s of [...seances].sort((a, b) => a.debut - b.debut)) {
    res[s.id] = 0
    if (s.deload) continue
    const duJour: Record<string, number> = {}
    for (const x of s.series) {
      if (x.reps <= 0) continue
      duJour[x.exoId] = Math.max(duJour[x.exoId] ?? -Infinity, scoreSerie(exo(x.exoId), x, s.poidsCorps))
    }
    for (const [id, e] of Object.entries(duJour)) {
      if (derniere[id] !== undefined && e > derniere[id]) res[s.id]++
      derniere[id] = e
    }
  }
  return res
}

export function bilan(seances: Seance[], records: Record<string, number>, exo?: (id: string) => Exercice): Bilan {
  return {
    seances: seances.length,
    temps: seances.reduce((a, s) => a + dureeReelle(s), 0),
    dures: seances.reduce((a, s) => a + s.series.filter(estDure).length, 0),
    tonnage: seances.reduce((a, s) => a + s.series.reduce((b, x) => b + kgSouleves(x, exo?.(x.exoId)), 0), 0),
    records: seances.reduce((a, s) => a + (records[s.id] ?? 0), 0),
  }
}

/** Séances regroupées par semaine (lundi), de la plus récente à la plus ancienne. */
export function parSemaine(seances: Seance[]): { lundi: string; seances: Seance[] }[] {
  const groupes = new Map<string, Seance[]>()
  for (const s of [...seances].sort((a, b) => b.debut - a.debut)) {
    const l = semaineDe(s.date)
    groupes.set(l, [...(groupes.get(l) ?? []), s])
  }
  return [...groupes].map(([l, x]) => ({ lundi: l, seances: x }))
}

/**
 * Meilleure série de travail d'un exercice sur un groupe de séances, mesurée comme les blocages :
 * séries normales seulement (ni échec, ni drop, ni rest-pause), comparées par `scoreSerie`.
 */
export function meilleureDeTravail(exo: Exercice, seances: Seance[]): { serie: Serie; score: number; e1rm: number | null } | undefined {
  let res: { serie: Serie; score: number; e1rm: number | null } | undefined
  for (const s of seances)
    for (const x of s.series) {
      if (x.exoId !== exo.id || x.type !== 'normale' || x.reps <= 0) continue
      const score = scoreSerie(exo, x, s.poidsCorps)
      if (!res || score > res.score) res = { serie: x, score, e1rm: e1rm(exo, x, s.poidsCorps) }
    }
  return res
}

/**
 * Force au début et à la fin d'une période (séances de la plus ancienne à la plus récente) : meilleure
 * des 2 premières face à la meilleure des 2 dernières, pour qu'une séance ratée ne fausse pas tout ;
 * la 1re face à la dernière quand il y en a moins de 4. Null avec moins de 2 séances.
 */
export function evolutionForce(exo: Exercice, seances: Seance[]) {
  if (seances.length < 2) return null
  const k = seances.length >= 4 ? 2 : 1
  const avant = meilleureDeTravail(exo, seances.slice(0, k))
  const apres = meilleureDeTravail(exo, seances.slice(-k))
  return avant && apres ? { avant, apres } : null
}

/**
 * Ce qui a vraiment changé entre deux séries : +1 charge plus dure, ou plus de reps à la même charge ; −1 l'inverse ; 0 pareil.
 * La force estimée baisse quand on monte la charge et que les reps repartent au bas : ce n'est pas une baisse.
 */
export function sensPerf(exo: Exercice, avant: Serie, apres: Serie): -1 | 0 | 1 {
  const dur = (c: number) => (exo.assistance ? -c : c)
  const d = dur(apres.charge) - dur(avant.charge) || apres.reps - avant.reps
  return d > 0 ? 1 : d < 0 ? -1 : 0
}

/**
 * Évolution en % d'après la force estimée, corrigée par ce qui a vraiment été soulevé : une charge plus dure ou
 * des reps en plus ne font jamais un chiffre négatif, et mêmes charge et reps font 0, quel que soit l'effort noté.
 */
export function evolutionPct(exo: Exercice, avant: Serie, apres: Serie, pct: number): number {
  const sens = sensPerf(exo, avant, apres)
  if (sens === 0) return 0
  if (sens < 0 || pct > 0) return pct
  return avant.charge !== apres.charge && avant.charge ? (Math.abs(apres.charge - avant.charge) / Math.abs(avant.charge)) * 100 : avant.reps ? ((apres.reps - avant.reps) / avant.reps) * 100 : 0
}

/** Meilleure série d'un exercice dans une séance : la plus lourde (la moins assistée), puis le plus de reps. */
export function meilleureSerie(series: Serie[], assistance = false): Serie | undefined {
  const dur = (s: Serie) => (assistance ? -s.charge : s.charge)
  return series.reduce<Serie | undefined>((a, s) => (!a || dur(s) > dur(a) || (s.charge === a.charge && s.reps > a.reps) ? s : a), undefined)
}

/**
 * Créneaux du planning faits cette semaine (indices dans `planning`). Une séance faite coche le
 * créneau de la même séance le plus proche avant son jour, sinon le prochain : faite jeudi, elle
 * coche le créneau du jeudi, pas celui du lundi.
 */
export function creneauxFaits(planning: { id: string; jour: number }[], faites: { id: string; jour: number }[]): Set<number> {
  const pris = new Set<number>()
  for (const f of [...faites].sort((a, b) => a.jour - b.jour)) {
    const libres = planning.map((p, i) => ({ ...p, i })).filter((p) => p.id === f.id && !pris.has(p.i))
    const avant = libres.filter((p) => p.jour <= f.jour).sort((a, b) => b.jour - a.jour)[0]
    const apres = libres.filter((p) => p.jour > f.jour).sort((a, b) => a.jour - b.jour)[0]
    const c = avant ?? apres
    if (c) pris.add(c.i)
  }
  return pris
}
