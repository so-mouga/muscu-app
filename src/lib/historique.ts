import type { Exercice, Seance, Serie } from '../types'
import { dateISO, dureeSeanceEffective, e1rm, enTemps, estDure, kgSouleves, lundi } from './calc'

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

/** Séries qui mesurent le progrès : les séries normales. Un échec, une dégressive ou un rest-pause ne se comparent pas d'une fois à l'autre. */
export const serieComptee = (x: Serie) => x.type === 'normale' && x.reps > 0

/**
 * LA mesure du progrès, la seule : la charge et les reps, jamais l'effort noté ni la force estimée.
 * Progrès = charge plus dure, ou rep de plus à une charge déjà faite, rang par rang (la 2e série à 60 kg face à la
 * meilleure 2e série à 60 kg). Record = charge jamais faite aussi dure, ou plus de reps que jamais à une charge déjà faite.
 * Sert aux blocages, au constat de la fiche, aux records, à « mieux que la dernière fois » et au Bilan.
 * `repartir` oublie la référence (après un arrêt ou une sèche).
 */
export function suiviProgres(exo: Exercice) {
  const durete = (c: number) => (exo.assistance ? -c : c)
  let plusDur = -Infinity
  let meilleures = new Map<number, number[]>()
  const juger = (series: Serie[]): { progres: boolean; record: 'charge' | 'reps' | null } => {
    const parCharge = new Map<number, number[]>()
    for (const x of series) parCharge.set(x.charge, [...(parCharge.get(x.charge) ?? []), x.reps])
    let progres = false
    let record: 'charge' | 'reps' | null = null
    for (const [charge, reps] of parCharge) {
      reps.sort((a, b) => b - a)
      const avant = meilleures.get(charge) ?? []
      if (plusDur !== -Infinity && durete(charge) > plusDur) {
        progres = true
        record = 'charge'
      }
      if (avant.length && reps.some((r, i) => r > (avant[i] ?? 0))) progres = true
      if (avant.length && reps[0] > avant[0]) record ??= 'reps'
      meilleures.set(charge, Array.from({ length: Math.max(reps.length, avant.length) }, (_, i) => Math.max(reps[i] ?? 0, avant[i] ?? 0)))
    }
    plusDur = Math.max(plusDur, ...[...parCharge.keys()].map(durete))
    return { progres, record }
  }
  return {
    plusDur: () => plusDur,
    /** Le plus de reps jamais faites à cette charge ; rien si elle n'a jamais été faite. */
    meilleur: (charge: number) => meilleures.get(charge)?.[0],
    repartir: () => {
      plusDur = -Infinity
      meilleures = new Map()
    },
    juger,
    progres: (series: Serie[]) => juger(series).progres,
  }
}

/** Séries comptées de chaque exercice d'une séance. */
function parExo(s: Seance): Map<string, Serie[]> {
  const m = new Map<string, Serie[]>()
  for (const x of s.series) if (serieComptee(x)) m.set(x.exoId, [...(m.get(x.exoId) ?? []), x])
  return m
}

/**
 * Nombre d'exercices qui battent leur record par séance (`suiviProgres`) : une charge jamais faite aussi dure, ou plus
 * de reps que jamais à une charge déjà faite. Le premier passage sur un exercice ne compte pas : il n'y a encore rien
 * à battre. Les déloads ne comptent jamais.
 */
export function recordsParSeance(seances: Seance[], exo: (id: string) => Exercice): Record<string, number> {
  const suivis = new Map<string, ReturnType<typeof suiviProgres>>()
  const res: Record<string, number> = {}
  for (const s of [...seances].sort((a, b) => a.debut - b.debut)) {
    res[s.id] = 0
    if (s.deload) continue
    for (const [id, series] of parExo(s)) {
      if (!suivis.has(id)) suivis.set(id, suiviProgres(exo(id)))
      if (suivis.get(id)!.juger(series).record) res[s.id]++
    }
  }
  return res
}

/**
 * Nombre d'exercices en progrès par séance, face à la fois d'avant sur le même exercice : charge plus dure, ou rep de
 * plus à une charge de la dernière fois (`suiviProgres`). Les déloads ne comptent pas et ne servent pas de référence.
 */
export function mieuxParSeance(seances: Seance[], exo: (id: string) => Exercice): Record<string, number> {
  const derniere = new Map<string, Serie[]>()
  const res: Record<string, number> = {}
  for (const s of [...seances].sort((a, b) => a.debut - b.debut)) {
    res[s.id] = 0
    if (s.deload) continue
    for (const [id, series] of parExo(s)) {
      const avant = derniere.get(id)
      if (avant) {
        // Plus de reps sur une série plus légère que la meilleure de la dernière fois : ce n'est pas mieux.
        const e = exo(id)
        const suivi = suiviProgres(e)
        suivi.juger(avant)
        if (suivi.progres(series) && sensPerf(e, meilleureSerie(avant, e.assistance)!, meilleureSerie(series, e.assistance)!) >= 0) res[s.id]++
      }
      derniere.set(id, series)
    }
  }
  return res
}

/**
 * Record battu par ces séries du jour, face à l'historique de l'exercice (`avant` : ses séries par séance, hors
 * déload) : « charge » ou « reps », sinon null. Rien sans historique. `dejaFaites` : les séries d'avant dans la même
 * séance, pour ne pas annoncer deux fois le même record.
 */
export function recordDuJour(exo: Exercice, avant: Serie[][], series: Serie[], dejaFaites: Serie[] = []): 'charge' | 'reps' | null {
  const histo = avant.map((h) => h.filter(serieComptee)).filter((h) => h.length)
  const duJour = series.filter(serieComptee)
  if (!histo.length || !duJour.length) return null
  const suivi = suiviProgres(exo)
  for (const h of histo) suivi.juger(h)
  const deja = dejaFaites.filter(serieComptee)
  if (deja.length) suivi.juger(deja)
  return suivi.juger(duJour).record
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
 * Meilleure série de travail d'un exercice sur un groupe de séances : la plus lourde (la moins assistée), puis le plus
 * de reps. Séries normales seulement, comme les blocages ; ni l'effort noté ni la force estimée n'y entrent.
 */
export function meilleureDeTravail(exo: Exercice, seances: Seance[]): { serie: Serie } | undefined {
  const serie = meilleureSerie(seances.flatMap((s) => s.series.filter((x) => x.exoId === exo.id && serieComptee(x))), exo.assistance)
  return serie && { serie }
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
 * Évolution en % entre deux séries, d'après la charge et les reps seulement : l'écart de charge quand elle change, sinon
 * les reps en plus ou en moins (une rep sur dix vaut environ 2,5 %, comme une petite montée de charge). 0 si rien n'a
 * changé, quel que soit l'effort noté ; toujours du signe de `sensPerf`. Depuis une charge de 0 (poids du corps sans
 * lest), pas de pourcentage : 0.
 */
export function pctCharges(exo: Exercice, avant: Serie, apres: Serie): number {
  const sens = sensPerf(exo, avant, apres)
  if (!sens) return 0
  if (apres.charge !== avant.charge) return avant.charge ? (((exo.assistance ? -1 : 1) * (apres.charge - avant.charge)) / Math.abs(avant.charge)) * 100 : 0
  return ((apres.reps - avant.reps) / (enTemps(exo) ? Math.max(1, avant.reps) : 30 + avant.reps)) * 100
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
/** Séance d'une semaine allégée : une séance allégée pour un seul jour n'en fait pas une. */
export const seanceSemaineAllegee = (s: Pick<Seance, 'deload' | 'allegeeSeule'>) => !!s.deload && !s.allegeeSeule

/**
 * Créneaux de cette semaine passés sans séance, pour la liste « Autre séance ». Rien en semaine de pause,
 * ni avant la toute première séance du programme (`premiere`) : un cycle commence le lundi même s'il est
 * lancé le mercredi, et la séance de lundi n'existait pas encore pour la personne.
 */
export function creneauxRates(planning: { jour: number }[], coches: Set<number>, o: { jour: number; lundi: string; premiere?: string; pause?: boolean }): Set<number> {
  const rates = new Set<number>()
  if (o.pause || !o.premiere) return rates
  planning.forEach((p, i) => {
    const date = dateISO(new Date(Date.parse(o.lundi + 'T12:00:00') + (p.jour - 1) * 86400000))
    if (p.jour < o.jour && !coches.has(i) && o.premiere! < date) rates.add(i)
  })
  return rates
}

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
