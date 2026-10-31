import type { Exercice, JourJournal, Pesee, Seance } from '../types'
import { enTemps, kg } from './calc'
import { scoreSerie } from './historique'
import type { Phase } from './objectifs'

const JOUR = 86400000
const jours = (a: string, b: string) => Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / JOUR)
const decaler = (iso: string, n: number) => new Date(Date.parse(iso + 'T12:00:00') + n * JOUR).toISOString().slice(0, 10)
const moyenne = (l: number[]) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : null)
const arrondi = (x: number, d = 1) => Math.round(x * 10 ** d) / 10 ** d
const heures = (h: number) => `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}`

/** Le 1RM estimé bouge avec le RPE noté : sous +1 %, ce n'est pas un vrai progrès. Sinon (isolation, temps), tout gain compte. */
const seuil = (exo: Exercice) => (exo.suivreE1rm && !enTemps(exo) ? 1.01 : 1)

/** Meilleure série de chaque séance de travail sur l'exercice (hors déload et finisseurs), de la plus ancienne à la plus récente. */
function scores(exo: Exercice, seances: Seance[], jusqua: string) {
  return seances
    .filter((s) => !s.enCours && !s.deload && s.date <= jusqua)
    .sort((a, b) => a.debut - b.debut)
    .flatMap((s) => {
      const l = s.series.filter((x) => x.exoId === exo.id && x.type === 'normale' && x.reps > 0)
      return l.length ? [{ date: s.date, score: Math.max(...l.map((x) => scoreSerie(exo, x, s.poidsCorps))) }] : []
    })
}

export interface Blocage {
  semaines: number
  /** Séances faites depuis le dernier progrès. */
  seances: number
  /** Date du dernier progrès (ou de la 1re séance). */
  depuis: string
}

/**
 * Exercice bloqué : aucun progrès (1RM estimé, corrigé par le RPE, ou meilleure série) depuis 3 semaines
 * ou plus, sur au moins 3 séances, et l'exercice est toujours pratiqué (dans les 14 derniers jours).
 */
export function blocage(exo: Exercice, seances: Seance[], jusqua: string): Blocage | null {
  const l = scores(exo, seances, jusqua)
  if (l.length < 4) return null
  let meilleur = l[0].score
  let depuis = l[0].date
  for (const x of l.slice(1)) {
    if (x.score > meilleur * seuil(exo)) depuis = x.date
    meilleur = Math.max(meilleur, x.score)
  }
  const apres = l.filter((x) => x.date > depuis).length
  const semaines = Math.floor(jours(depuis, jusqua) / 7)
  return semaines >= 3 && apres >= 3 && jours(l[l.length - 1].date, jusqua) <= 14 ? { semaines, seances: apres, depuis } : null
}

export interface Contexte {
  /** Toutes les séances terminées, déloads compris. */
  seances: Seance[]
  journal?: JourJournal[]
  pesees?: Pesee[]
  phase?: Phase
}

/** Ce qui a changé pendant le blocage et peut l'expliquer, chiffres à l'appui. Rien quand la donnée manque. */
export function pistes(exo: Exercice, depuis: string, jusqua: string, c: Contexte): string[] {
  const r: string[] = []
  const jrs = (c.journal ?? []).filter((j) => j.date > depuis && j.date <= jusqua)
  const nuits = jrs.flatMap((j) => (j.sommeil !== undefined ? [j.sommeil] : []))
  const sommeil = nuits.length >= 5 ? moyenne(nuits)! : null
  if (sommeil !== null && sommeil < 6.5) r.push(`sommeil moyen ${heures(sommeil)}`)

  const notes = jrs.filter((j) => j.calories)
  const pasAssez = notes.filter((j) => j.calories === 'pasAssez').length
  if (c.phase !== 'seche' && notes.length >= 4 && pasAssez / notes.length >= 0.3) r.push(`calories sous l’objectif ${pasAssez} jours sur ${notes.length}`)

  // Poids en prise : moyenne de la 1re semaine du blocage face à la dernière.
  if (c.phase === 'prise' && jours(depuis, jusqua) >= 14) {
    const p = (c.pesees ?? []).filter((x) => x.date >= depuis && x.date <= jusqua)
    const debut = moyenne(p.filter((x) => x.date <= decaler(depuis, 7)).map((x) => x.poids))
    const fin = moyenne(p.filter((x) => x.date > decaler(jusqua, -7)).map((x) => x.poids))
    if (debut !== null && fin !== null) {
      const parSemaine = (fin - debut) / ((jours(depuis, jusqua) - 7) / 7)
      if (parSemaine < 0.1) r.push(`poids qui ne monte pas (${parSemaine >= 0 ? '+' : '−'}${kg(Math.abs(arrondi(parSemaine, 2)))} kg par semaine)`)
    }
  }

  const rpes = c.seances
    .filter((s) => !s.enCours && !s.deload && s.date > depuis && s.date <= jusqua)
    .flatMap((s) => s.series.filter((x) => x.exoId === exo.id && x.type === 'normale').map((x) => x.rpe))
  const rpe = moyenne(rpes)
  if (rpe !== null && rpe >= 9) r.push(`séries déjà très dures (RPE moyen ${kg(arrondi(rpe))})`)

  const faites = c.seances.filter((s) => !s.enCours && s.date <= jusqua)
  const premiere = faites.reduce<string | null>((a, s) => (!a || s.date < a ? s.date : a), null)
  const dernierDeload = faites.filter((s) => s.deload).reduce<string | null>((a, s) => (!a || s.date > a ? s.date : a), null)
  const repere = dernierDeload ?? premiere
  if (repere && jours(repere, jusqua) > 42) r.push(`pas de déload depuis ${Math.floor(jours(repere, jusqua) / 7)} semaines`)
  return r
}

/** Blocage et pistes d'un exercice. En sèche, garder ses charges est déjà le but : on ne signale rien. */
export function diagnostic(exo: Exercice, c: Contexte, jusqua: string): (Blocage & { pistes: string[] }) | null {
  if (c.phase === 'seche') return null
  const b = blocage(exo, c.seances, jusqua)
  return b && { ...b, pistes: pistes(exo, b.depuis, jusqua, c) }
}

/** « Pas de progrès depuis 4 semaines (5 séances). Pistes : sommeil moyen 5 h 10. » */
export function texteBlocage(d: Blocage & { pistes: string[] }): string {
  return `Pas de progrès depuis ${d.semaines} semaines (${d.seances} séances). ${d.pistes.length ? `Pistes : ${d.pistes.join(', ')}.` : 'Tente +1 rep ou un cran de charge, ou une variante.'}`
}

/**
 * Déload à avancer : force en baisse sur au moins 2 exercices ces 10 derniers jours (meilleure série sous
 * celle des 2 séances d'avant), avec une énergie basse (≤ 2/5) sur 2 des 3 dernières séances, ou une
 * baisse sur 3 exercices ou plus. Jamais dans les 3 semaines qui suivent un déload.
 */
export function deloadConseille(seances: Seance[], exo: (id: string) => Exercice, jusqua: string): { baisses: Exercice[]; energieBasse: boolean } | null {
  const faites = seances.filter((s) => !s.enCours && s.date <= jusqua)
  if (faites.some((s) => s.deload && jours(s.date, jusqua) < 21)) return null
  const recentes = faites.filter((s) => !s.deload && jours(s.date, jusqua) <= 10)
  const ids = [...new Set(recentes.flatMap((s) => s.series.map((x) => x.exoId)))]
  const baisses = ids.map(exo).filter((e) => {
    const l = scores(e, faites, jusqua)
    if (l.length < 3 || jours(l[l.length - 1].date, jusqua) > 10) return false
    const avant = Math.max(l[l.length - 2].score, l[l.length - 3].score)
    return l[l.length - 1].score < (seuil(e) > 1 ? avant * 0.97 : Math.min(l[l.length - 2].score, l[l.length - 3].score))
  })
  const energies = faites
    .filter((s) => !s.deload && s.energie !== undefined)
    .sort((a, b) => b.debut - a.debut)
    .slice(0, 3)
  const energieBasse = energies.filter((s) => s.energie! <= 2).length >= 2
  return baisses.length >= 2 && (energieBasse || baisses.length >= 3) ? { baisses, energieBasse } : null
}
