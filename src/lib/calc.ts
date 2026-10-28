import { EXERCICES, MUSCLES } from '../data/exercices'
import type { Exercice, ExoPlan, Muscle, Seance, SeanceModele, Serie } from '../types'

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

export function serieTexte(exo: Exercice, s: Serie): string {
  let t = `${chargeTexte(exo, s.charge)} × ${s.reps} @${kg(s.rpe)}`
  if (s.demiReps) t += ` + ${s.demiReps} demi-reps`
  if (s.suite?.length) t += s.type === 'drop' ? s.suite.map((x) => ` ↘ ${kg(x.charge)}×${x.reps}`).join('') : ` + ${s.suite.map((x) => x.reps).join(' + ')}`
  return t
}

/** Epley corrigé par le RPE. Les demi-reps ne comptent jamais. */
export function e1rm(exo: Exercice, s: Serie, poidsCorps?: number): number | null {
  if (!exo.suivreE1rm || s.reps <= 0) return null
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
export function ecartSerie(s: Serie, avant: Serie | undefined): { sens: 'mieux' | 'egal' | 'moins'; texte: string } | null {
  if (!avant) return null
  const dc = Math.round((s.charge - avant.charge) * 100) / 100
  const dr = s.reps - avant.reps
  const texte = [dc ? `${dc > 0 ? '+' : '−'}${kg(Math.abs(dc))} kg` : '', dr ? `${dr > 0 ? '+' : '−'}${Math.abs(dr)} rep${Math.abs(dr) > 1 ? 's' : ''}` : '']
    .filter(Boolean)
    .join(', ')
  const sens = dc > 0 || (dc === 0 && dr > 0) ? 'mieux' : dc === 0 && dr === 0 ? 'egal' : 'moins'
  return { sens, texte: texte || 'identique' }
}
