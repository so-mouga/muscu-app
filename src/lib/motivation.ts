import type { Cycle, Exercice, Seance, Serie } from '../types'
import { dateISO, semaineType } from './calc'
import { couvre, etatCycle, lignesCycle } from './cycle'
import { mieuxParSeance, recordsParSeance, scoreSerie, semaineDe } from './historique'

/**
 * Ce qui aide à continuer, sans pression : des faits tirés des séances (semaines tenues, progrès du
 * bloc, ce qui a été mieux aujourd'hui, retour après une pause). Rien sur le poids ou le corps, pas de
 * série de jours (on se repose exprès), pas de badges.
 */

const JOUR = 86400000
const plusJours = (iso: string, n: number) => dateISO(new Date(Date.parse(iso + 'T12:00:00') + n * JOUR))

/** Séances qui suffisent pour qu'une semaine soit « tenue » : les trois quarts, arrondis (3 → 2, 4 → 3, 5 → 4). */
export const seuilSemaine = (prevues: number) => Math.max(1, Math.round(prevues * 0.75))

/**
 * Semaines « tenues » d'affilée : au moins les trois quarts des séances prévues (`seuilSemaine`). Une semaine
 * de déload ou mise en pause ne compte pas et ne casse pas la série ; la semaine en cours compte dès
 * qu'elle est tenue, sinon elle ne casse rien (elle n'est pas finie).
 */
export function semainesTenues(seances: Seance[], prevuesParSemaine: number, cycles: Cycle[], aujourdhui: string): number {
  const faites = seances.filter((s) => !s.enCours)
  if (prevuesParSemaine <= 0 || !faites.length) return 0
  const seuil = seuilSemaine(prevuesParSemaine)
  const premiere = semaineDe(faites.reduce((a, s) => (s.date < a ? s.date : a), faites[0].date))
  const parSemaine = new Map<string, number>()
  for (const s of faites) parSemaine.set(semaineDe(s.date), (parSemaine.get(semaineDe(s.date)) ?? 0) + 1)
  const sansEffort = (lundi: string) =>
    cycles.some((c) => {
      if (!couvre(c, lundi)) return false
      const e = etatCycle(c, lundi)
      return e.pause || e.deload
    })
  let n = 0
  const enCours = semaineDe(aujourdhui)
  for (let l = enCours; l >= premiere; l = plusJours(l, -7)) {
    if (sansEffort(l)) continue
    const tenue = (parSemaine.get(l) ?? 0) >= seuil
    if (tenue) n++
    else if (l !== enCours) break
  }
  return n
}

/** Meilleure série de travail d'un exercice dans une séance (comme les records : `scoreSerie`). */
function meilleure(exo: Exercice, s: Seance): { serie: Serie; score: number } | undefined {
  let res: { serie: Serie; score: number } | undefined
  for (const x of s.series) {
    if (x.exoId !== exo.id || x.type !== 'normale' || x.reps <= 0) continue
    const score = scoreSerie(exo, x, s.poidsCorps)
    if (!res || score > res.score) res = { serie: x, score }
  }
  return res
}

/**
 * Depuis le début du bloc (cycle, sinon phase) : pour les exercices principaux (composés, les plus
 * pratiqués, `max` au plus), la meilleure série de la 1re séance du bloc face à celle de la dernière, en
 * charge × reps. Seulement ceux qui ont progressé ; déloads exclus ; il faut deux séances dans le bloc.
 */
export function depuisDebut(seances: Seance[], exo: (id: string) => Exercice, depuis: string, max = 3): { exo: Exercice; avant: Serie; apres: Serie }[] {
  const bloc = seances.filter((s) => !s.enCours && !s.deload && s.date >= depuis).sort((a, b) => a.debut - b.debut)
  const nb = new Map<string, number>()
  for (const s of bloc) for (const id of new Set(s.series.map((x) => x.exoId))) nb.set(id, (nb.get(id) ?? 0) + 1)
  return [...nb]
    .filter(([id, n]) => n >= 2 && exo(id).type === 'compose')
    .sort((a, b) => b[1] - a[1])
    .flatMap(([id]) => {
      const e = exo(id)
      const avec = bloc.filter((s) => s.series.some((x) => x.exoId === id))
      const a = meilleure(e, avec[0])
      const b = meilleure(e, avec[avec.length - 1])
      return a && b && b.score > a.score ? [{ exo: e, avant: a.serie, apres: b.serie }] : []
    })
    .slice(0, max)
}

/** Fin de séance : exercices mieux que la dernière fois, et records battus (`avant` : séances terminées d'avant). */
export function resumeSeance(seance: Seance, avant: Seance[], exo: (id: string) => Exercice): { mieux: number; records: number } {
  const toutes = [...avant.filter((s) => s.id !== seance.id && !s.enCours), { ...seance, enCours: false }]
  return { mieux: mieuxParSeance(toutes, exo)[seance.id] ?? 0, records: recordsParSeance(toutes, exo)[seance.id] ?? 0 }
}

/** Jours depuis la dernière séance terminée (null s'il n'y en a pas). */
export function joursSansSeance(seances: Seance[], aujourdhui: string): number | null {
  const faites = seances.filter((s) => !s.enCours)
  if (!faites.length) return null
  const derniere = faites.reduce((a, s) => (s.date > a ? s.date : a), faites[0].date)
  return Math.round((Date.parse(aujourdhui + 'T12:00:00') - Date.parse(derniere + 'T12:00:00')) / JOUR)
}

export type EtatSemaine = 'tenue' | 'manquee' | 'courante' | 'allegee' | 'pause' | 'avenir'

/** Chaque semaine du cycle et ce qu'il s'en est passé : la frise et le résumé du cycle. */
export function suiviCycle(c: Cycle, seances: Seance[], aujourdhui: string) {
  const prevues = semaineType(c.programme).length
  const seuil = seuilSemaine(prevues)
  const ceLundi = semaineDe(aujourdhui)
  const duCycle = seances.filter((s) => s.cycleId === c.id && !s.enCours)
  const semaines = lignesCycle(c).map((x) => {
    const lundi = 'pause' in x ? x.pause : x.lundi
    const faites = duCycle.filter((s) => semaineDe(s.date) === lundi).length
    let etat: EtatSemaine
    if ('pause' in x) etat = 'pause'
    else if (lundi === ceLundi && !etatCycle(c, aujourdhui).fini) etat = 'courante'
    else if (lundi < ceLundi) etat = faites >= (c.deloads.includes(x.n) ? 1 : seuil) ? 'tenue' : 'manquee'
    else etat = c.deloads.includes(x.n) ? 'allegee' : 'avenir'
    return { lundi, etat, faites }
  })
  return { semaines, prevues, faites: duCycle.length, tenues: semaines.filter((x) => x.etat === 'tenue').length, cetteSemaine: duCycle.filter((s) => semaineDe(s.date) === ceLundi).length }
}
