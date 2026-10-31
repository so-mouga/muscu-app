import type { Muscle } from '../types'

/**
 * Objectifs dans le temps : une frise d'étapes datées. Chaque changement (phase, fin prévue, volume)
 * ajoute une étape qui reprend le reste de la précédente ; la frise n'est jamais réécrite, pour
 * pouvoir relire plus tard ce qui était visé à chaque période (bilan, IA).
 */
export const CLE_OBJECTIFS = 'objectifs'
/** Anciens réglages (avant la frise) : repris tant que la frise est vide. */
export const CLE_VOLUME = 'objectifsVolume'
export const CLE_PHASES = 'phases'

export type Phase = 'seche' | 'maintien' | 'prise'

export interface EtapeObjectifs {
  /** AAAA-MM-JJ */
  depuis: string
  phase?: Phase
  /** Fin prévue de la phase (AAAA-MM-JJ), facultative. */
  finPrevue?: string
  /** Séries dures par semaine, par muscle. */
  volume: Partial<Record<Muscle, number>>
}

/** Une phase d'un seul tenant : du changement de phase jusqu'au suivant. */
export interface PeriodePhase {
  phase: Phase
  debut: string
  /** Dernier jour réel (veille de la phase suivante) ; absent si elle est en cours. */
  fin?: string
  finPrevue?: string
}

export const PHASES: { id: Phase; nom: string; court: string; explication: string }[] = [
  { id: 'seche', nom: 'Sèche', court: 'Sèche', explication: 'Tu manges un peu moins pour perdre du gras. Garder tes charges, c’est déjà réussir : une baisse de force est le signal à surveiller.' },
  { id: 'maintien', nom: 'Maintien', court: 'Maintien', explication: 'Poids stable : tu progresses tranquillement, sans viser de prise ni de perte.' },
  { id: 'prise', nom: 'Prise de muscle', court: 'Prise', explication: 'Tu manges un peu plus pour construire : il faut monter régulièrement en reps ou en charge, et le poids doit monter doucement.' },
]
export const nomPhase = (p: Phase) => PHASES.find((x) => x.id === p)!.nom

const JOUR = 86400000
const veille = (iso: string) => new Date(Date.parse(iso + 'T12:00:00') - JOUR).toISOString().slice(0, 10)
const tri = (l: EtapeObjectifs[]) => [...l].sort((a, b) => a.depuis.localeCompare(b.depuis))

/** Frise enregistrée, ou reconstruite depuis les anciens réglages (phases seules, volume seul). */
export function lireFrise(frise: unknown, anciennesPhases: unknown, ancienVolume: unknown): EtapeObjectifs[] {
  if (Array.isArray(frise)) return tri(frise as EtapeObjectifs[])
  const volume = (ancienVolume as Partial<Record<Muscle, number>> | undefined) ?? {}
  const phases = (anciennesPhases as { phase: Phase; depuis: string }[] | undefined) ?? []
  if (phases.length) return tri(phases.map((p) => ({ depuis: p.depuis, phase: p.phase, volume: { ...volume } })))
  return ancienVolume ? [{ depuis: '2000-01-01', volume: { ...volume } }] : []
}

/** Objectifs en vigueur à une date (null si rien n'était encore réglé). */
export function objectifsA(frise: EtapeObjectifs[], date: string): EtapeObjectifs | null {
  return [...tri(frise)].reverse().find((e) => e.depuis <= date) ?? null
}

/**
 * Nouvelle étape à `date` : reprend les objectifs en vigueur (ou `base` pour le volume s'il n'y en a
 * pas) et applique le changement. Changer de phase efface la fin prévue de l'ancienne. Deux
 * changements le même jour : une seule étape, la dernière.
 */
export function modifier(frise: EtapeObjectifs[], date: string, changement: Partial<Omit<EtapeObjectifs, 'depuis'>>, base: Partial<Record<Muscle, number>> = {}): EtapeObjectifs[] {
  const avant = objectifsA(frise, date)
  const nouvellePhase = 'phase' in changement && changement.phase !== avant?.phase
  const etape: EtapeObjectifs = {
    volume: { ...(avant?.volume ?? base) },
    ...(avant?.phase && { phase: avant.phase }),
    ...(!nouvellePhase && avant?.finPrevue && { finPrevue: avant.finPrevue }),
    ...changement,
    depuis: date,
  }
  if (!etape.finPrevue) delete etape.finPrevue
  return tri([...frise.filter((e) => e.depuis !== date), etape])
}

/** Phases d'un seul tenant, de la plus ancienne à la plus récente. */
export function periodes(frise: EtapeObjectifs[]): PeriodePhase[] {
  const res: PeriodePhase[] = []
  for (const e of tri(frise)) {
    const der = res[res.length - 1]
    if (der && !der.fin && der.phase === e.phase) {
      der.finPrevue = e.finPrevue
      continue
    }
    if (der && !der.fin) der.fin = veille(e.depuis)
    if (e.phase) res.push({ phase: e.phase, debut: e.depuis, ...(e.finPrevue && { finPrevue: e.finPrevue }) })
  }
  return res
}

/** Phase en cours à une date, avec son avancement en semaines. */
export function phaseA(frise: EtapeObjectifs[], date: string): (PeriodePhase & { semaine: number; total?: number }) | null {
  const p = periodes(frise).find((x) => x.debut <= date && (!x.fin || date <= x.fin))
  if (!p) return null
  const semaines = (a: string, b: string) => Math.floor((Date.parse(b) - Date.parse(a)) / (7 * JOUR)) + 1
  return { ...p, semaine: semaines(p.debut, date), ...(p.finPrevue && { total: Math.max(1, Math.round((Date.parse(p.finPrevue) - Date.parse(p.debut)) / (7 * JOUR))) }) }
}

/** Texte pour un bilan : « Sèche depuis le 3 nov. (semaine 3 sur 12, fin prévue le 26 janv.) ». */
export function textePhase(frise: EtapeObjectifs[], date: string, jour: (iso: string) => string): string | null {
  const p = phaseA(frise, date)
  if (!p) return null
  return `${nomPhase(p.phase)} depuis le ${jour(p.debut)} (semaine ${p.semaine}${p.total ? ` sur ${p.total}, fin prévue le ${jour(p.finPrevue!)}` : ''})`
}

/** Corrige la date d'une étape (ex. sèche commencée en fait lundi dernier). */
export function deplacer(frise: EtapeObjectifs[], de: string, vers: string): EtapeObjectifs[] {
  return tri([...frise.filter((e) => e.depuis !== vers || e.depuis === de)].map((e) => (e.depuis === de ? { ...e, depuis: vers } : e)))
}
