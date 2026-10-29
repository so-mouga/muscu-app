import { EXERCICES, MUSCLES } from '../data/exercices'
import type { Exercice, ExoPlan, Muscle, Programme, Seance, SeanceModele, Serie } from '../types'

export const RIR: Record<number, string> = {
  10: 'échec',
  9: '1 en réserve',
  8: '2 en réserve',
  7: '3 en réserve',
  6: '4 en réserve',
}

export const kg = (x: number | null | undefined) =>
  x === null || x === undefined ? '—' : x.toLocaleString('fr-FR', { maximumFractionDigits: 2 })

export function chargeTexte(exo: Exercice, charge: number | null | undefined): string {
  if (charge === null || charge === undefined) return 'à calibrer'
  if (exo.mode === 'poids_corps') return charge === 0 ? 'PDC' : `PDC ${charge > 0 ? '+' : '−'}${kg(Math.abs(charge))} kg`
  if (exo.mode === 'elastique') return `niveau ${charge}`
  if (exo.mode === 'par_main') return `${kg(charge)} kg/main`
  return `${kg(charge)} kg`
}

/** Exercice mesuré en secondes tenues (gainage…) plutôt qu'en reps. */
export const enTemps = (exo: Exercice) => exo.mesure === 'temps'

/** Quantité d'une série : « 12 » (reps) ou « 45 s ». */
export const qte = (exo: Exercice, n: number | string) => (enTemps(exo) ? `${n} s` : `${n}`)

/** Fourchette visée : « 8–12 » ou « 30–45 s ». */
export const fourchette = (exo: Exercice, min: number, max: number) => qte(exo, min === max ? min : `${min}–${max}`)

/** « 3 × 8–12 », « 3 × 30–45 s », ou série par série quand elles diffèrent : « 12 / 10 / 8 ». */
export function schemaPlan(exo: Exercice, p: ExoPlan): string {
  const f = p.series.map((s) => (s.repsMin === s.repsMax ? `${s.repsMin}` : `${s.repsMin}–${s.repsMax}`))
  if (f.every((x) => x === f[0])) return `${p.series.length} × ${fourchette(exo, p.series[0].repsMin, p.series[0].repsMax)}`
  return qte(exo, f.join(' / '))
}

/** Charge et quantité : « 30 kg × 12 », « PDC +10 kg × 45 s », ou juste « 45 s » au poids du corps. */
export const chargeQte = (exo: Exercice, charge: number | null | undefined, n: number | string) =>
  enTemps(exo) && exo.mode === 'poids_corps' && charge === 0 ? qte(exo, n) : `${chargeTexte(exo, charge)} × ${qte(exo, n)}`

/** Objectif d'un exercice : « 30 kg × 12/12/10 », « 30 kg → 25 kg × 12/12 », « 45/45/45 s ». */
export function cibleTexte(exo: Exercice, charges: (number | null)[], reps: number[]): string {
  const varie = charges.some((c) => c !== charges[0])
  return varie ? `${chargeTexte(exo, charges[0])} → ${chargeTexte(exo, charges[charges.length - 1])} × ${qte(exo, reps.join('/'))}` : chargeQte(exo, charges[0], reps.join('/'))
}

/**
 * Kg soulevés par une série : les deux haltères comptent pour un exercice « par main » ; au poids
 * du corps, seul le lest compte ; un exercice en temps ne compte pas.
 */
export function kgSouleves(s: Serie, exo?: Exercice): number {
  if (exo && enTemps(exo)) return 0
  const charge = exo?.mode === 'poids_corps' ? Math.max(0, s.charge) : s.charge
  return charge * s.reps * (exo?.mode === 'par_main' ? 2 : 1)
}

/** Unité d'écart de quantité : « +1 rep », « +5 s ». */
export const ecartQte = (exo: Exercice | undefined, d: number) =>
  exo && enTemps(exo) ? `${d > 0 ? '+' : '−'}${Math.abs(d)} s` : `${d > 0 ? '+' : '−'}${Math.abs(d)} rep${Math.abs(d) > 1 ? 's' : ''}`

export function serieTexte(exo: Exercice, s: Serie): string {
  let t = `${chargeQte(exo, s.charge, s.reps)} @${kg(s.rpe)}`
  if (s.demiReps) t += ` + ${s.demiReps} demi-reps`
  if (s.suite?.length) t += s.type === 'drop' ? s.suite.map((x) => ` ↘ ${kg(x.charge)}×${x.reps}`).join('') : ` + ${s.suite.map((x) => x.reps).join(' + ')}`
  return t
}

/** Epley corrigé par le RPE. Les demi-reps ne comptent jamais. */
export function e1rm(exo: Exercice, s: Serie, poidsCorps?: number): number | null {
  if (!exo.suivreE1rm || enTemps(exo) || s.reps <= 0) return null
  let charge = s.charge
  if (exo.mode === 'poids_corps') {
    if (!poidsCorps) return null
    charge = poidsCorps + s.charge
  }
  const rtf = s.reps + (10 - s.rpe)
  return Math.round(charge * (1 + rtf / 30) * 10) / 10
}

export const estDure = (s: Serie) => s.rpe >= 7 || s.type === 'echec' || s.type === 'serie_longue'

export function dateISO(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const j = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${j}`
}

/** 1 = lundi … 7 = dimanche */
export const jourSemaine = (d = new Date()) => ((d.getDay() + 6) % 7) + 1

export function lundi(d = new Date()): string {
  const x = new Date(d)
  x.setDate(x.getDate() - (jourSemaine(d) - 1))
  return dateISO(x)
}

export function volumeParMuscle(seances: Seance[], exercices: Record<string, Exercice> = EXERCICES): Record<Muscle, number> {
  const v = Object.fromEntries(MUSCLES.map((m) => [m.id, 0])) as Record<Muscle, number>
  for (const seance of seances)
    for (const s of seance.series) {
      const exo = exercices[s.exoId]
      if (!exo || !estDure(s)) continue
      v[exo.muscle] += 1
      for (const sec of exo.secondaires ?? []) v[sec.muscle] += sec.coef
    }
  return v
}

/** Séries dures prévues par muscle (RPE visé ≥ 7), comptées comme `volumeParMuscle`. */
export function volumePrevu(modeles: SeanceModele[], exercices: Record<string, Exercice> = EXERCICES): Record<Muscle, number> {
  const v = Object.fromEntries(MUSCLES.map((m) => [m.id, 0])) as Record<Muscle, number>
  for (const m of modeles)
    for (const p of m.exercices) {
      const exo = exercices[p.exoId]
      if (!exo) continue
      const n = p.series.filter((s, i) => s.rpe >= 7 || (p.finisseur && i === p.series.length - 1)).length
      v[exo.muscle] += n
      for (const sec of exo.secondaires ?? []) v[sec.muscle] += sec.coef * n
    }
  return v
}

/** Séances d'une semaine type : celles qui ont un jour (sinon toutes, s'il n'y a pas de planning). */
export function semaineType(p: Programme): Programme['seances'] {
  const planifiees = p.seances.filter((e) => e.jour)
  return planifiees.length ? planifiees : p.seances
}

export function duree(ms: number): string {
  const min = Math.round(ms / 60000)
  if (min < 1) return '< 1 min'
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`
}

export function chrono(s: number): string {
  const a = Math.abs(Math.round(s))
  return `${s < 0 ? '+' : ''}${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}`
}

export const dateCourte = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })

/** Repos à lancer après la série `index` (0 = première) sur `total` séries prévues aujourd'hui. */
export function reposApres(plan: ExoPlan, index: number, total: number): number {
  if (index >= total - 1 && plan.reposApres !== undefined) return plan.reposApres
  return plan.series[Math.min(index, plan.series.length - 1)]?.repos ?? plan.repos
}

/** « 2:30 », « 150 » (secondes) ou « 2 » (minutes) → secondes. null si illisible. */
export function lireDuree(texte: string): number | null {
  const t = texte.trim().replace(/[.,h']/g, ':')
  const m = t.match(/^(\d+):(\d{1,2})$/)
  if (m) return +m[1] * 60 + +m[2]
  if (/^\d+$/.test(t)) return +t <= 15 ? +t * 60 : +t
  return null
}

/** « 3:00 », ou « 2:00–3:00 » si le repos varie selon la série. */
export function reposTexte(plan: ExoPlan): string {
  const valeurs = [...new Set(plan.series.map((s) => s.repos ?? plan.repos))].sort((a, b) => a - b)
  const t = valeurs.length > 1 ? `${chrono(valeurs[0])}–${chrono(valeurs[valeurs.length - 1])}` : chrono(valeurs[0] ?? plan.repos)
  return plan.reposApres !== undefined ? `${t}, puis ${chrono(plan.reposApres)}` : t
}

/** Durée estimée : ~1 min par série (installation comprise), les repos prévus, ~1 min par chauffe. */
/** Temps prévu (s) pour l'exercice `i` : chauffes, séries, repos entre les séries et repos qui le précède. */
export function dureePrevueExo(plans: ExoPlan[], i: number): number {
  const p = plans[i]
  const n = p.series.length
  let s = n * 60 + p.chauffes.length * 60
  for (let k = 0; k < n - 1; k++) s += reposApres(p, k, n)
  const prec = plans[i - 1]
  if (prec) s += reposApres(prec, prec.series.length - 1, prec.series.length)
  return s
}

export function dureeEstimee(m: SeanceModele): number {
  const s = m.exercices.reduce((a, _, i) => a + dureePrevueExo(m.exercices, i), 0)
  return Math.round(s / 300) * 5
}

/** Durée réelle habituelle (min) d'une séance : médiane des 3 dernières fois, arrondie à 5 min. */
/** Séances de référence pour la durée habituelle : les 3 dernières vraiment faites (au moins 15 min). */
export const seancesHabituelles = (modeleId: string, terminees: Seance[]) =>
  terminees
    .filter((s) => s.modeleId === modeleId && s.fin && s.series.length > 0 && !s.deload && s.fin - s.debut >= 15 * 60000)
    .sort((a, b) => b.debut - a.debut)
    .slice(0, 3)

export function dureeHabituelle(modeleId: string, terminees: Seance[]): number | null {
  const d = seancesHabituelles(modeleId, terminees)
    .map((s) => s.fin! - s.debut)
    .sort((a, b) => a - b)
  if (!d.length) return null
  return Math.max(5, Math.round(d[Math.floor(d.length / 2)] / 300000) * 5)
}

/** « 55 min », « 1 h 05 ». */
export const minutes = (n: number) => (n < 60 ? `${n} min` : `${Math.floor(n / 60)} h ${String(n % 60).padStart(2, '0')}`)

/** Durée affichée sur une séance : la durée réelle habituelle si elle existe, sinon l'estimation du plan. */
export function dureeTexte(m: SeanceModele, terminees: Seance[] | undefined): string {
  const h = terminees && dureeHabituelle(m.id, terminees)
  return h ? `≈ ${minutes(h)} d’habitude` : `≈ ${minutes(dureeEstimee(m))}`
}

/** Muscu soutenue ≈ 5 MET ; poids par défaut 75 kg quand aucune pesée n'existe. */
export const MET_MUSCU = 5
export const POIDS_DEFAUT = 75
export function calories(ms: number, poids?: number): number {
  return Math.round((MET_MUSCU * (poids ?? POIDS_DEFAUT) * ms) / 3600000)
}

/**
 * Temps passé par exercice (ms) : chaque intervalle entre deux validations compte pour
 * l'exercice de la série validée (mise en place, chauffe et repos qui la précèdent compris).
 */
export function tempsParExo(seance: Pick<Seance, 'debut' | 'series'>): Record<string, number> {
  const t: Record<string, number> = {}
  let prec = seance.debut
  for (const s of [...seance.series].sort((a, b) => a.heure - b.heure)) {
    t[s.exoId] = (t[s.exoId] ?? 0) + Math.max(0, s.heure - prec)
    prec = Math.max(prec, s.heure)
  }
  return t
}

/** Chauffe « 25×8 » → charge et reps ; texte libre → null. */
export function lireChauffe(c: string): { charge: number; reps: number } | null {
  const m = /^\s*([\d.,]+)\s*(?:kg)?\s*[×x*]\s*(\d+)\s*$/i.exec(c)
  return m ? { charge: parseFloat(m[1].replace(',', '.')), reps: parseInt(m[2]) } : null
}

/** Comparaison avec la même série la dernière fois : plus lourd, ou plus de reps à charge égale = mieux. */
export function ecartSerie(s: Serie, avant: Serie | undefined, exo?: Exercice): { sens: 'mieux' | 'egal' | 'moins'; texte: string } | null {
  if (!avant) return null
  const dc = Math.round((s.charge - avant.charge) * 100) / 100
  const dr = s.reps - avant.reps
  const texte = [dc ? `${dc > 0 ? '+' : '−'}${kg(Math.abs(dc))} kg` : '', dr ? ecartQte(exo, dr) : '']
    .filter(Boolean)
    .join(', ')
  const sens = dc > 0 || (dc === 0 && dr > 0) ? 'mieux' : dc === 0 && dr === 0 ? 'egal' : 'moins'
  return { sens, texte: texte || 'identique' }
}
