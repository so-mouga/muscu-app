import { dateISO } from './calc'
import { periodes, poidsSemaine, type EtapeObjectifs, type PeriodePhase } from './objectifs'
import type { Mesure } from '../types'

/**
 * Récap d'une phase : le corps au début et à la fin, seulement quand c'est vraiment comparable. Une mesure prise
 * plusieurs mois avant la phase n'est pas « le début de la phase » : on ne la compte pas, et on n'affiche rien plutôt qu'un chiffre faux.
 */

const JOUR = 86400000
const plusJours = (iso: string, n: number) => dateISO(new Date(Date.parse(iso + 'T12:00:00') + n * JOUR))

/** Avant le début, jusqu'où une prise compte encore comme le point de départ. */
export const MARGE_AVANT = 14
/** Après la fin : les photos et les mesures se prennent souvent quelques jours plus tard. */
export const MARGE_APRES = 7

/** Point de départ d'une liste datée (triée) : la dernière prise des 14 jours avant le début, sinon la première ensuite. Rien si tout est plus ancien. */
export function repere<T extends { date: string }>(liste: T[], debut: string): T | undefined {
  const avant = liste.filter((x) => x.date >= plusJours(debut, -MARGE_AVANT) && x.date <= debut).at(-1)
  return avant ?? liste.find((x) => x.date > debut)
}

/** Dernier jour de la phase pour le récap : sa vraie fin, sinon aujourd'hui. */
export const finRecap = (p: PeriodePhase, aujourdhui: string) => p.fin ?? aujourdhui

type Pesee = { date: string; poids: number }

/** Poids au début (moyenne de J−3 à J+6, sinon le repère) et à la fin (moyenne des 7 derniers jours, sinon la dernière pesée). Il faut deux pesées différentes. */
export function recapPoids(pesees: Pesee[], debut: string, fin: string): { depart: number; arrivee: number; ecart: number; points: { date: string; valeur: number }[] } | null {
  const liste = [...pesees].filter((p) => p.date >= plusJours(debut, -MARGE_AVANT) && p.date <= fin).sort((a, b) => a.date.localeCompare(b.date))
  if (liste.length < 2) return null
  const autour = liste.filter((p) => p.date >= plusJours(debut, -3) && p.date <= plusJours(debut, 6))
  const depart = autour.length ? Math.round((autour.reduce((a, p) => a + p.poids, 0) / autour.length) * 10) / 10 : repere(liste, debut)?.poids
  const arrivee = poidsSemaine(liste, fin) ?? liste[liste.length - 1].poids
  if (depart === undefined) return null
  const points = liste.filter((p) => p.date >= debut).map((p) => ({ date: p.date, valeur: p.poids }))
  return { depart, arrivee, ecart: Math.round((arrivee - depart) * 10) / 10, points }
}

/** Chaque mesure prise au début et à la fin de la phase, et les dates de ces prises. */
export function recapMesures(mesures: Mesure[], debut: string, fin: string) {
  const liste = [...mesures].filter((m) => m.date >= plusJours(debut, -MARGE_AVANT) && m.date <= plusJours(fin, MARGE_APRES)).sort((a, b) => a.date.localeCompare(b.date))
  const lignes = [...new Set(liste.flatMap((m) => Object.keys(m.valeurs)))].flatMap((cle) => {
    const serie = liste.filter((m) => m.valeurs[cle] !== undefined).map((m) => ({ date: m.date, valeur: m.valeurs[cle] }))
    const depart = repere(serie, debut)
    const arrivee = serie[serie.length - 1]
    return depart && arrivee.date > depart.date ? [{ cle, depart, arrivee, points: serie.filter((x) => x.date >= depart.date) }] : []
  })
  return { lignes, debut: lignes.length ? lignes.map((l) => l.depart.date).sort()[0] : undefined, fin: lignes.length ? lignes.map((l) => l.arrivee.date).sort().at(-1) : undefined }
}

/** Dates de photos qui appartiennent à la phase, de la première à la dernière. */
export function datesPhotosPhase(dates: string[], debut: string, fin: string): string[] {
  const dansFenetre = [...dates].sort().filter((d) => d <= plusJours(fin, MARGE_APRES)).map((date) => ({ date }))
  const depart = repere(dansFenetre, debut)
  return depart ? dansFenetre.filter((x) => x.date >= depart.date).map((x) => x.date) : []
}

/** Une phase vient de finir : celle dont la fin prévue est passée, sinon celle qui s'est terminée ces 14 derniers jours (une erreur vite corrigée ne compte pas). */
export function phaseFinie(frise: EtapeObjectifs[], aujourdhui: string): { debut: string; enCours: boolean } | null {
  const liste = periodes(frise)
  const enCours = liste.find((p) => !p.fin && p.debut <= aujourdhui && p.finPrevue && p.finPrevue <= aujourdhui)
  if (enCours) return { debut: enCours.debut, enCours: true }
  const finie = [...liste].reverse().find((p) => p.fin && p.fin < aujourdhui && p.fin >= plusJours(aujourdhui, -14) && p.fin >= plusJours(p.debut, 13))
  return finie ? { debut: finie.debut, enCours: false } : null
}

export type Prises = { mesure?: string; photo?: string }
export type Repere = 'photos' | 'mensurations'
export type ReperesPhase = { debut: string; manque: Repere[] }

const manquants = (prises: Prises, depuis: string): Repere[] => [...(prises.photo && prises.photo >= depuis ? [] : (['photos'] as const)), ...(prises.mesure && prises.mesure >= depuis ? [] : (['mensurations'] as const))]

/** Début d'une phase, pendant 7 jours : ce qui n'a pas été pris depuis une semaine avant son début. */
export function reperesAPrendre(frise: EtapeObjectifs[], aujourdhui: string, prises: Prises): ReperesPhase | null {
  const p = periodes(frise).find((x) => x.debut <= aujourdhui && (!x.fin || aujourdhui <= x.fin))
  if (!p || aujourdhui > plusJours(p.debut, 6)) return null
  const manque = manquants(prises, plusJours(p.debut, -7))
  return manque.length ? { debut: p.debut, manque } : null
}

/** Veille et dernier jour d'une phase d'au moins 14 jours dont la fin est connue : ce qui n'a pas été pris depuis une semaine. */
export function reperesDeFin(frise: EtapeObjectifs[], aujourdhui: string, prises: Prises): (ReperesPhase & { dernierJour: boolean }) | null {
  const p = periodes(frise).find((x) => x.debut <= aujourdhui && (!x.fin || aujourdhui <= x.fin))
  const dernier = p && (p.fin ?? (p.finPrevue ? plusJours(p.finPrevue, -1) : undefined))
  if (!p || !dernier || dernier < plusJours(p.debut, 13) || aujourdhui < plusJours(dernier, -1) || aujourdhui > dernier) return null
  const manque = manquants(prises, plusJours(dernier, -7))
  return manque.length ? { debut: p.debut, manque, dernierJour: aujourdhui === dernier } : null
}
