import type { Exercice, JourJournal, Pesee, Seance } from '../types'
import { enTemps, heuresMinutes, kg } from './calc'
import { scoreSerie, semaineDe } from './historique'
import { phaseA, type EtapeObjectifs, type Phase } from './objectifs'

const JOUR = 86400000
const jours = (a: string, b: string) => Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / JOUR)
const decaler = (iso: string, n: number) => new Date(Date.parse(iso + 'T12:00:00') + n * JOUR).toISOString().slice(0, 10)
const moyenne = (l: number[]) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : null)
const arrondi = (x: number, d = 1) => Math.round(x * 10 ** d) / 10 ** d

/** Le 1RM estimé bouge avec le RPE noté : sous +1 %, ce n'est pas un vrai progrès. Sinon (isolation, temps, poids du corps), tout gain compte. */
const seuil = (exo: Exercice) => (exo.suivreE1rm && !enTemps(exo) && exo.mode !== 'poids_corps' ? 1.01 : 1)

/** Meilleure série de chaque séance de travail sur l'exercice (hors déload et finisseurs), de la plus ancienne à la plus récente. */
function scores(exo: Exercice, seances: Seance[], jusqua: string) {
  return seances
    .filter((s) => !s.enCours && !s.deload && s.date <= jusqua)
    .sort((a, b) => a.debut - b.debut)
    .flatMap((s) => {
      const l = s.series.filter((x) => x.exoId === exo.id && x.type === 'normale' && x.reps > 0)
      if (!l.length) return []
      const notes = l.map((x) => ({ serie: x, score: scoreSerie(exo, x, s.poidsCorps) })).sort((a, b) => b.score - a.score)
      return [{ date: s.date, score: notes[0].score, serie: notes[0].serie }]
    })
}

export interface Blocage {
  /** Semaines d'entraînement sur cet exercice depuis le dernier progrès (ni arrêt, ni déload, ni sèche). */
  semaines: number
  /** Séances faites depuis le dernier progrès. */
  seances: number
  /** Date du dernier progrès (ou de la reprise, ou de la 1re séance). */
  depuis: string
}

/** Semaines d'entraînement sans progrès avant de parler de blocage. */
export const SEMAINES_BLOCAGE = 6
/** 3 semaines sans s'entraîner : on repart de zéro, la référence d'avant l'arrêt ne vaut plus. */
const JOURS_ARRET = 21

/**
 * Exercice bloqué : ni charge plus dure, ni reps en plus à une charge déjà faite, sur 6 semaines d'entraînement et au
 * moins 3 séances, et l'exercice est toujours pratiqué (dans les 14 derniers jours). Rien ne passe par la force estimée :
 * monter la charge ou ajouter une rep sur une seule série, comme le conseille l'appli, est un progrès, et une note d'effort
 * n'y change rien. La sèche, les déloads et les arrêts ne comptent pas ; après une sèche ou un arrêt, on repart de zéro.
 * À la charge maximale du matériel, on ne parle pas de blocage.
 */
export function blocage(exo: Exercice, seances: Seance[], jusqua: string, objectifs: EtapeObjectifs[] = []): Blocage | null {
  const seriesDe = (s: Seance) => s.series.filter((x) => x.exoId === exo.id && x.type === 'normale' && x.reps > 0)
  const durete = (c: number) => (exo.assistance ? -c : c)
  const liste = seances.filter((s) => !s.enCours && !s.deload && s.date <= jusqua && seriesDe(s).length).sort((a, b) => a.debut - b.debut)
  let plusDur = -Infinity
  let meilleures = new Map<number, number[]>()
  let semaines = new Set<string>()
  let nb = 0
  let depuis = ''
  let precedente = ''
  let repartir = true
  for (const s of liste) {
    const enSeche = phaseA(objectifs, s.date)?.phase === 'seche'
    repartir = repartir || enSeche || (!!precedente && jours(precedente, s.date) >= JOURS_ARRET)
    precedente = s.date
    if (enSeche) continue
    if (repartir) {
      plusDur = -Infinity
      meilleures = new Map()
      semaines = new Set()
      nb = 0
      depuis = s.date
    }
    const parCharge = new Map<number, number[]>()
    for (const x of seriesDe(s)) parCharge.set(x.charge, [...(parCharge.get(x.charge) ?? []), x.reps])
    let progres = false
    for (const [charge, reps] of parCharge) {
      reps.sort((a, b) => b - a)
      const avant = meilleures.get(charge) ?? []
      if (plusDur !== -Infinity && durete(charge) > plusDur) progres = true
      if (avant.length && reps.some((r, i) => r > (avant[i] ?? 0))) progres = true
      meilleures.set(charge, Array.from({ length: Math.max(reps.length, avant.length) }, (_, i) => Math.max(reps[i] ?? 0, avant[i] ?? 0)))
    }
    plusDur = Math.max(plusDur, ...[...parCharge.keys()].map(durete))
    if (progres) {
      depuis = s.date
      semaines = new Set()
      nb = 0
    } else if (!repartir) {
      nb++
      if (semaineDe(s.date) !== semaineDe(depuis)) semaines.add(semaineDe(s.date))
    }
    repartir = false
  }
  // Dernières séances en sèche : le compte d'avant la sèche ne vaut plus.
  if (repartir) return null
  // À la charge maximale du matériel, ce n'est pas un blocage : l'appli conseille déjà de ralentir la descente.
  if (exo.chargeMax !== undefined && plusDur >= durete(exo.chargeMax)) return null
  return semaines.size >= SEMAINES_BLOCAGE && nb >= 3 && jours(precedente, jusqua) <= 14 ? { semaines: semaines.size, seances: nb, depuis } : null
}

export interface Contexte {
  /** Toutes les séances terminées, déloads compris. */
  seances: Seance[]
  journal?: JourJournal[]
  pesees?: Pesee[]
  phase?: Phase
  /** Début de la phase en cours : le rythme du poids en prise ne regarde pas la phase d'avant. */
  debutPhase?: string
  /** Frise des phases : les semaines de sèche ne comptent pas dans un blocage. */
  objectifs?: EtapeObjectifs[]
}

/** Ce qui a changé pendant le blocage et peut l'expliquer, chiffres à l'appui. Rien quand la donnée manque. */
export function pistes(exo: Exercice, depuis: string, jusqua: string, c: Contexte): string[] {
  const r: string[] = []
  const jrs = (c.journal ?? []).filter((j) => j.date > depuis && j.date <= jusqua)
  const nuits = jrs.flatMap((j) => (j.sommeil !== undefined ? [j.sommeil] : []))
  const sommeil = nuits.length >= 5 ? moyenne(nuits)! : null
  if (sommeil !== null && sommeil < 6.5) r.push(`sommeil moyen ${heuresMinutes(sommeil)}`)

  const notes = jrs.filter((j) => j.calories)
  const pasAssez = notes.filter((j) => j.calories === 'pasAssez').length
  if (c.phase !== 'seche' && notes.length >= 4 && pasAssez / notes.length >= 0.3) r.push(`calories sous l’objectif ${pasAssez} jours sur ${notes.length}`)

  // Poids en prise : moyenne de la 1re semaine du blocage face à la dernière.
  const departPoids = c.debutPhase && c.debutPhase > depuis ? c.debutPhase : depuis
  if (c.phase === 'prise' && jours(departPoids, jusqua) >= 14) {
    const p = (c.pesees ?? []).filter((x) => x.date >= departPoids && x.date <= jusqua)
    const debut = moyenne(p.filter((x) => x.date <= decaler(departPoids, 7)).map((x) => x.poids))
    const fin = moyenne(p.filter((x) => x.date > decaler(jusqua, -7)).map((x) => x.poids))
    if (debut !== null && fin !== null) {
      const parSemaine = (fin - debut) / ((jours(departPoids, jusqua) - 7) / 7)
      if (parSemaine < 0.1) r.push(`poids qui ne monte pas (${parSemaine >= 0 ? '+' : '−'}${kg(Math.abs(arrondi(parSemaine, 2)))} kg par semaine)`)
    }
  }

  const rpes = c.seances
    .filter((s) => !s.enCours && !s.deload && s.date > depuis && s.date <= jusqua)
    .flatMap((s) => s.series.filter((x) => x.exoId === exo.id && x.type === 'normale').map((x) => x.rpe))
  const rpe = moyenne(rpes)
  if (rpe !== null && rpe >= 9) r.push(`séries déjà très dures (effort moyen ${kg(arrondi(rpe))}/10)`)

  const faites = c.seances.filter((s) => !s.enCours && s.date <= jusqua)
  // Le repère : le dernier déload, ou la reprise après un arrêt (s'arrêter 3 semaines, c'est aussi récupérer).
  const dates = [...new Set(faites.map((s) => s.date))].sort()
  const dernierDeload = faites.filter((s) => s.deload).reduce<string | null>((a, s) => (!a || s.date > a ? s.date : a), null)
  const reprise = dates.reduce<string | null>((a, d, i) => (i && jours(dates[i - 1], d) >= JOURS_ARRET ? d : a), dates[0] ?? null)
  const repere = [dernierDeload, reprise].reduce<string | null>((a, d) => (d && (!a || d > a) ? d : a), null)
  if (repere && jours(repere, jusqua) > 42) r.push(`pas de déload depuis ${Math.floor(jours(repere, jusqua) / 7)} semaines`)
  return r
}

/** Blocage et pistes d'un exercice. En sèche, garder ses charges est déjà le but : on ne signale rien. */
export function diagnostic(exo: Exercice, c: Contexte, jusqua: string): (Blocage & { pistes: string[] }) | null {
  if (c.phase === 'seche') return null
  const b = blocage(exo, c.seances, jusqua, c.objectifs)
  return b && { ...b, pistes: pistes(exo, b.depuis, jusqua, c) }
}

/** « Pas de progrès depuis 4 semaines (5 séances). Pistes : sommeil moyen 5 h 10. » */
export function texteBlocage(d: Blocage & { pistes: string[] }): string {
  return `Pas de progrès depuis ${d.semaines} semaines (${d.seances} séances). ${d.pistes.length ? `Pistes : ${d.pistes.join(', ')}.` : 'Tente +1 rep ou un cran de charge, ou une variante.'}`
}

/**
 * Déload à avancer : force en baisse sur au moins 2 exercices ces 10 derniers jours (meilleure série sous
 * celle des 2 séances d'avant), avec une énergie basse (≤ 2/5) sur 2 des 3 dernières séances de ces 10 jours, ou une
 * baisse sur 3 exercices ou plus. Une charge plus dure, ou autant de reps à la même charge, n'est pas une baisse,
 * quoi que dise la force estimée. Jamais dans les 3 semaines qui suivent un déload ou 2 semaines sans séance : on vient de récupérer.
 */
export function deloadConseille(seances: Seance[], exo: (id: string) => Exercice, jusqua: string): { baisses: Exercice[]; energieBasse: boolean } | null {
  const faites = seances.filter((s) => !s.enCours && s.date <= jusqua)
  if (faites.some((s) => s.deload && jours(s.date, jusqua) < 21)) return null
  const dates = [...new Set(faites.map((s) => s.date))].sort()
  if (dates.some((d, i) => i && jours(dates[i - 1], d) >= 14 && jours(d, jusqua) < 21)) return null
  const recentes = faites.filter((s) => !s.deload && jours(s.date, jusqua) <= 10)
  const ids = [...new Set(recentes.flatMap((s) => s.series.map((x) => x.exoId)))]
  const baisses = ids.map(exo).filter((e) => {
    const l = scores(e, faites, jusqua)
    if (l.length < 3 || jours(l[l.length - 1].date, jusqua) > 10) return false
    const avant = Math.max(l[l.length - 2].score, l[l.length - 3].score)
    const ref = l[l.length - 2].score >= l[l.length - 3].score ? l[l.length - 2].serie : l[l.length - 3].serie
    const der = l[l.length - 1].serie
    const dur = (c: number) => (e.assistance ? -c : c)
    if (dur(der.charge) > dur(ref.charge) || (der.charge === ref.charge && der.reps >= ref.reps)) return false
    return l[l.length - 1].score < (seuil(e) > 1 ? avant * 0.97 : Math.min(l[l.length - 2].score, l[l.length - 3].score))
  })
  // Même fenêtre que la baisse de force : une fatigue d'il y a un mois n'explique pas celle d'aujourd'hui.
  const energies = recentes
    .filter((s) => s.energie !== undefined)
    .sort((a, b) => b.debut - a.debut)
    .slice(0, 3)
  const energieBasse = energies.filter((s) => s.energie! <= 2).length >= 2
  return baisses.length >= 2 && (energieBasse || baisses.length >= 3) ? { baisses, energieBasse } : null
}
