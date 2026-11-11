import type { Exercice, Seance, Serie } from '../types'
import { blocage, JOURS_ARRET, suiviProgres } from './blocages'
import { dateCourte, dateISO, enTemps, kg } from './calc'
import { evolutionForce, meilleureSerie, pctCharges } from './historique'
import type { EtapeObjectifs } from './objectifs'

const JOUR = 86400000
/** « Ça monte » : un progrès dans ces 4 semaines, pas seulement mieux qu'il y a deux mois. */
const JOURS_PROGRES = 28
/** Sans séance depuis 4 semaines, on ne juge plus : on le dit. */
const JOURS_ABSENCE = 28
/** Le gain affiché se compte sur 8 semaines. */
const JOURS_GAIN = 56

const jours = (a: string, b: string) => Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / JOUR)
const dateSeule = (d: string) => dateCourte(d).replace(/^\S+\s/, '')
const seriesDe = (exo: Exercice, s: Seance) => s.series.filter((x) => x.exoId === exo.id && x.type === 'normale' && x.reps > 0)
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

export interface Constat {
  texte: string
  classe: string
  detail?: string
}

/** Ce qui a changé entre deux séances, en vrais kilos ou en reps : rien si ce n'est ni plus dur, ni plus de reps à la même charge. */
export function gain(exo: Exercice, avant: Serie[], apres: Serie[]): { court: string; long: string } | null {
  const a = meilleureSerie(avant, exo.assistance)
  const b = meilleureSerie(apres, exo.assistance)
  if (!a || !b) return null
  const ecart = Math.round((b.charge - a.charge) * (exo.assistance ? -1 : 1) * 100) / 100
  if (ecart > 0) {
    if (exo.assistance) return { court: `−${kg(ecart)} kg`, long: `${kg(ecart)} kg d’aide en moins` }
    if (exo.mode === 'poids_corps') return { court: `+${kg(ecart)} kg`, long: `+${kg(ecart)} kg de lest` }
    if (exo.mode === 'elastique') {
      const t = `+${ecart} niveau${ecart > 1 ? 'x' : ''}`
      return { court: t, long: t }
    }
    const t = `+${kg(ecart)} kg${exo.mode === 'par_main' ? '/main' : ''}`
    return { court: t, long: t }
  }
  if (ecart < 0) return null
  // Meilleure série d'abord : on lit « 13 → 16 reps », pas la somme de toutes les séries. Sinon, une rep gagnée sur une autre série.
  const aCharge = (l: Serie[]) => l.filter((x) => x.charge === a.charge).map((x) => x.reps)
  const total = (l: number[]) => l.reduce((n, x) => n + x, 0)
  const plus = b.reps > a.reps ? b.reps - a.reps : total(aCharge(apres)) - total(aCharge(avant))
  if (plus <= 0) return null
  const t = enTemps(exo) ? `+${plus} s` : `+${pluriel(plus, 'rep')}`
  return { court: t, long: t }
}

/** Séances qui ont progressé, la mesure des blocages : les allégées n'y entrent pas, et 3 semaines d'arrêt font repartir la référence. */
export function seancesEnProgres(exo: Exercice, chrono: Seance[]): Set<string> {
  const suivi = suiviProgres(exo)
  const ids = new Set<string>()
  let precedente = ''
  for (const s of chrono) {
    const series = seriesDe(exo, s)
    if (s.deload || !series.length) continue
    if (precedente && jours(precedente, s.date) >= JOURS_ARRET) suivi.repartir()
    precedente = s.date
    if (suivi.progres(series)) ids.add(s.id)
  }
  return ids
}

/** Ce qu'on écrit à droite de chaque séance : le gain en vert, « = » si tout est pareil, « allégée », ou rien. `chrono` : de la plus ancienne à la plus récente. */
export function marquesSeances(exo: Exercice, chrono: Seance[]): Map<string, { texte: string; classe: string }> {
  const progres = seancesEnProgres(exo, chrono)
  const marques = new Map<string, { texte: string; classe: string }>()
  let avant: Serie[] = []
  for (const s of chrono) {
    if (s.deload) {
      marques.set(s.id, { texte: 'allégée', classe: 'fiche-allegee' })
      continue
    }
    const series = seriesDe(exo, s)
    if (!series.length) continue
    const pareil = avant.length === series.length && series.every((x, i) => x.charge === avant[i].charge && x.reps === avant[i].reps)
    if (progres.has(s.id)) marques.set(s.id, { texte: gain(exo, avant, series)?.court ?? 'mieux', classe: 'tenue' })
    else if (pareil) marques.set(s.id, { texte: '=', classe: 'faible' })
    avant = series
  }
  return marques
}

/**
 * Est-ce que je progresse ? Le constat de la liste et de la fiche. `chrono` : de la plus ancienne à la plus récente.
 * Même mesure que les blocages. « Ça monte » veut dire un progrès récent : un exercice monté il y a deux mois puis
 * resté plat n'est plus en train de monter. Pas de constat sur un exercice arrêté ni avant 3 séances.
 */
export function lectureExo(exo: Exercice, chrono: Seance[], enSeche = false, objectifs: EtapeObjectifs[] = [], jour = dateISO()): Constat | null {
  const travail = chrono.filter((s) => !s.deload && seriesDe(exo, s).length)
  if (!travail.length) return null
  const derniere = travail[travail.length - 1]
  const absence = jours(derniere.date, jour)
  if (absence >= JOURS_ABSENCE) {
    const mois = Math.round(absence / 30)
    return { texte: `Pas fait depuis ${mois >= 2 ? `${mois} mois` : pluriel(Math.round(absence / 7), 'semaine')}`, classe: 'faible' }
  }
  if (travail.length === 1) return { texte: 'Première fois', classe: 'faible', detail: 'Elle sert de repère.' }
  if (travail.length < 3) return { texte: 'Trop tôt pour dire', classe: 'faible', detail: `${travail.length} séances : il en faut au moins 3.` }

  // En sèche, on ne parle pas de blocage : la force qui tient est déjà un bon résultat.
  const bloque = enSeche ? null : blocage(exo, travail, jour, objectifs)
  if (bloque) return { texte: `Bloqué depuis ${bloque.semaines} semaines`, classe: 'alerte-texte', detail: `${bloque.seances} séances sans progrès` }

  const progres = seancesEnProgres(exo, chrono)
  const dernierProgres = [...travail].reverse().find((s) => progres.has(s.id))
  const fenetre = travail.filter((s) => jours(s.date, derniere.date) <= JOURS_GAIN)
  const premiere = fenetre[0]
  if (dernierProgres && jours(dernierProgres.date, jour) <= JOURS_PROGRES) {
    const g = gain(exo, seriesDe(exo, premiere), seriesDe(exo, derniere))
    const duree = jours(premiere.date, derniere.date)
    const enCombien = duree < 7 ? `en ${pluriel(Math.max(1, duree), 'jour')}` : `en ${pluriel(Math.round(duree / 7), 'semaine')}`
    return { texte: 'Ça monte', classe: 'tenue', detail: g ? `${g.long} ${enCombien}` : `Dernier progrès le ${dateSeule(dernierProgres.date)}` }
  }
  const ev = evolutionForce(exo, fenetre.length >= 2 ? fenetre : travail)
  if (ev && pctCharges(exo, ev.avant.serie, ev.apres.serie) <= -2) {
    const semaines = Math.max(1, Math.round(jours(premiere.date, derniere.date) / 7))
    return { texte: 'Un peu en dessous', classe: 'faible', detail: `sur ${semaines > 1 ? `les ${semaines} dernières semaines` : 'la dernière semaine'}` }
  }
  const depuis = dernierProgres ?? travail[0]
  return {
    texte: `Stable depuis ${pluriel(Math.max(1, Math.round(jours(depuis.date, jour) / 7)), 'semaine')}`,
    classe: 'faible',
    detail: dernierProgres ? `Dernier progrès le ${dateSeule(dernierProgres.date)}` : `Mêmes résultats depuis le ${dateSeule(depuis.date)}`,
  }
}
