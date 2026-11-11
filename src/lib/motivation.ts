import type { Cycle, Exercice, Seance, Serie } from '../types'
import { dateISO } from './calc'
import { prevuDuCycle, type EtapePrevu } from './prevu'
import { couvre, etatCycle, lignesCycle } from './cycle'
import { meilleureDeTravail, mieuxParSeance, recordsParSeance, semaineDe, sensPerf } from './historique'

/**
 * Ce qui aide à continuer, sans pression : des faits tirés des séances (semaines tenues, progrès du
 * bloc, ce qui a été mieux aujourd'hui, retour après une pause). Rien sur le poids ou le corps, pas de
 * série de jours (on se repose exprès), pas de badges.
 */

const JOUR = 86400000
const plusJours = (iso: string, n: number) => dateISO(new Date(Date.parse(iso + 'T12:00:00') + n * JOUR))

/** Séances qui suffisent pour qu'une semaine soit « tenue » : les trois quarts, arrondis (3 → 2, 4 → 3, 5 → 4). */
export const seuilSemaine = (prevues: number) => Math.max(1, Math.round(prevues * 0.75))

/** Ce que vaut une semaine, partout pareil (Accueil, frise et lignes du cycle, Bilan) : `seuilSemaine` séances, une seule en semaine allégée. */
export const semaineTenue = (faites: number, prevues: number, allegee = false) => faites >= (allegee ? 1 : seuilSemaine(prevues))

/** Semaine en pause, ou semaine allégée d'un cycle, à cette date. */
const semaineDuCycle = (cycles: Cycle[], lundi: string): 'pause' | 'allegee' | null => {
  for (const c of cycles) {
    if (!couvre(c, lundi)) continue
    const e = etatCycle(c, lundi)
    if (e.pause) return 'pause'
    if (e.deload) return 'allegee'
  }
  return null
}

/**
 * Semaines « tenues » d'affilée : au moins les trois quarts des séances prévues (`seuilSemaine`). Une semaine en pause
 * ne compte pas et ne casse rien ; une semaine allégée est tenue dès une séance, comme dans la frise du cycle, et sans
 * séance elle ne casse rien non plus. La semaine en cours compte dès qu'elle est tenue, sinon elle ne casse rien (elle
 * n'est pas finie).
 */
export function semainesTenues(seances: Seance[], prevuesParSemaine: number | ((lundi: string) => number), cycles: Cycle[], aujourdhui: string): number {
  const prevuDe = typeof prevuesParSemaine === 'function' ? prevuesParSemaine : () => prevuesParSemaine
  const faites = seances.filter((s) => !s.enCours)
  if (!faites.length) return 0
  const premiere = semaineDe(faites.reduce((a, s) => (s.date < a ? s.date : a), faites[0].date))
  const parSemaine = new Map<string, number>()
  for (const s of faites) parSemaine.set(semaineDe(s.date), (parSemaine.get(semaineDe(s.date)) ?? 0) + 1)
  let n = 0
  const enCours = semaineDe(aujourdhui)
  for (let l = enCours; l >= premiere; l = plusJours(l, -7)) {
    const special = semaineDuCycle(cycles, l)
    const nb = parSemaine.get(l) ?? 0
    // Rien de prévu cette semaine-là, pause, ou semaine allégée sans séance : elle ne compte pas et ne casse rien.
    if (special === 'pause' || prevuDe(l) <= 0 || (special === 'allegee' && !nb)) continue
    if (semaineTenue(nb, prevuDe(l), special === 'allegee')) n++
    else if (l !== enCours) break
  }
  return n
}

/**
 * Semaines tenues sur une période, pour l'image du bilan : semaines entières seulement, depuis la toute
 * première séance, sans celles où rien n'était prévu, les semaines en pause ni les semaines allégées sans séance.
 */
export function tenuesSurPeriode(seances: Seance[], prevuesParSemaine: number | ((lundi: string) => number), cycles: Cycle[], debut: string, fin: string): { n: number; sur: number } {
  const prevuDe = typeof prevuesParSemaine === 'function' ? prevuesParSemaine : () => prevuesParSemaine
  const faites = seances.filter((s) => !s.enCours)
  const r = { n: 0, sur: 0 }
  if (!faites.length) return r
  const premiere = semaineDe(faites.reduce((a, s) => (s.date < a ? s.date : a), faites[0].date))
  for (let l = semaineDe(debut); plusJours(l, 6) <= fin; l = plusJours(l, 7)) {
    const special = semaineDuCycle(cycles, l)
    const nb = faites.filter((s) => semaineDe(s.date) === l).length
    if (l < debut || l < premiere || special === 'pause' || prevuDe(l) <= 0 || (special === 'allegee' && !nb)) continue
    r.sur++
    if (semaineTenue(nb, prevuDe(l), special === 'allegee')) r.n++
  }
  return r
}

/** « 3 sur 4 » de la semaine : toutes les séances faites comptent, séances libres comprises, sans dépasser le prévu. */
export const faitesSurPrevues = (faites: number, prevues: number) => Math.min(faites, prevues)

/** Meilleure série de travail d'un exercice dans une séance : la plus lourde, puis le plus de reps (`meilleureDeTravail`). */
const meilleure = (exo: Exercice, s: Seance) => meilleureDeTravail(exo, [s])

/**
 * Depuis le début du bloc (cycle, sinon phase) : pour les exercices principaux (composés, les plus
 * pratiqués, `max` au plus), la meilleure série de la 1re séance du bloc face à celle de la dernière, en
 * charge × reps. Seulement ceux qui ont progressé (charge plus dure, ou reps en plus à la même charge : `sensPerf`,
 * jamais l'effort noté) ; déloads exclus ; il faut deux séances dans le bloc.
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
      const avec = bloc.flatMap((s) => meilleure(e, s) ?? [])
      if (avec.length < 2) return []
      const [a, b] = [avec[0].serie, avec[avec.length - 1].serie]
      return sensPerf(e, a, b) > 0 ? [{ exo: e, avant: a, apres: b }] : []
    })
    .slice(0, max)
}

/**
 * Tous les exercices d'un bloc, de la 1re séance à la dernière (déloads exclus) : ce qui monte, ce qui ne bouge pas, ce
 * qui baisse, et ce qui n'a été fait qu'une fois. Plus lourd ou plus de reps à la même charge = monte (`sensPerf`).
 */
export function exercicesDuBloc(seances: Seance[], exo: (id: string) => Exercice) {
  const bloc = seances.filter((s) => !s.enCours && !s.deload).sort((a, b) => a.debut - b.debut)
  const res = { monte: [] as LigneBloc[], stable: [] as LigneBloc[], baisse: [] as LigneBloc[], uneFois: [] as LigneBloc[] }
  for (const id of new Set(bloc.flatMap((s) => s.series.map((x) => x.exoId)))) {
    const e = exo(id)
    const avec = bloc.flatMap((s) => {
      const m = meilleure(e, s)
      return m ? [m.serie] : []
    })
    if (!avec.length) continue
    const [avant, apres] = [avec[0], avec[avec.length - 1]]
    const ligne = { exo: e, avant, apres, seances: avec.length }
    const sens = sensPerf(e, avant, apres)
    res[avec.length < 2 ? 'uneFois' : sens > 0 ? 'monte' : sens < 0 ? 'baisse' : 'stable'].push(ligne)
  }
  for (const l of Object.values(res)) l.sort((a, b) => b.seances - a.seances)
  return res
}
export type LigneBloc = { exo: Exercice; avant: Serie; apres: Serie; seances: number }

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

/**
 * Chaque semaine du cycle et ce qu'il s'en est passé : la frise, les lignes et le résumé du cycle. `prevus` : les
 * nombres de séances prévues notés au fil du temps (réglage `prevusParSemaine`) ; chaque semaine est jugée sur ce qui
 * était prévu à son époque (`prevuDuCycle`), pas sur le programme d'aujourd'hui. Une semaine allégée passée sans
 * séance reste « allégée » : ni tenue, ni manquée, comme sur l'Accueil.
 */
export function suiviCycle(c: Cycle, seances: Seance[], aujourdhui: string, prevus: EtapePrevu[] = []) {
  const prevuDe = prevuDuCycle(prevus, c)
  const ceLundi = semaineDe(aujourdhui)
  const duCycle = seances.filter((s) => s.cycleId === c.id && !s.enCours)
  const semaines = lignesCycle(c).map((x) => {
    const lundi = 'pause' in x ? x.pause : x.lundi
    const faites = duCycle.filter((s) => semaineDe(s.date) === lundi).length
    const prevues = prevuDe(lundi)
    const allegee = !('pause' in x) && c.deloads.includes(x.n)
    let etat: EtatSemaine
    if ('pause' in x) etat = 'pause'
    else if (lundi === ceLundi && !etatCycle(c, aujourdhui).fini) etat = 'courante'
    else if (lundi < ceLundi) etat = semaineTenue(faites, prevues, allegee) ? 'tenue' : allegee ? 'allegee' : 'manquee'
    else etat = allegee ? 'allegee' : 'avenir'
    return { lundi, etat, faites, prevues }
  })
  return { semaines, prevues: prevuDe(ceLundi), faites: duCycle.length, tenues: semaines.filter((x) => x.etat === 'tenue').length, cetteSemaine: duCycle.filter((s) => semaineDe(s.date) === ceLundi).length }
}
