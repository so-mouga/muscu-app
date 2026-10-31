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
  /** Variation de poids visée sur la phase (kg, + ou −), depuis le poids au début de la phase. */
  ecartVise?: number
  /** Séries dures par semaine, par muscle. */
  volume: Partial<Record<Muscle, number>>
  /** Objectif calories fixé à la main (sinon calculé d'après le profil et la phase). */
  calories?: number
}

/** Une phase d'un seul tenant : du changement de phase jusqu'au suivant. */
export interface PeriodePhase {
  phase: Phase
  debut: string
  /** Dernier jour réel (veille de la phase suivante) ; absent si elle est en cours. */
  fin?: string
  finPrevue?: string
  ecartVise?: number
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
 * pas) et applique le changement. Changer de phase efface la fin prévue et le poids visé de l'ancienne ; `phase:
 * undefined` arrête la phase. Deux changements le même jour : une seule étape, la dernière. Un
 * nouveau volume vaut aussi pour les étapes déjà prévues après (phase programmée à l'avance).
 */
export function modifier(frise: EtapeObjectifs[], date: string, changement: Partial<Omit<EtapeObjectifs, 'depuis'>>, base: Partial<Record<Muscle, number>> = {}): EtapeObjectifs[] {
  const avant = objectifsA(frise, date)
  const nouvellePhase = 'phase' in changement && changement.phase !== avant?.phase
  const etape: EtapeObjectifs = {
    volume: { ...(avant?.volume ?? base) },
    ...(avant?.phase && { phase: avant.phase }),
    ...(!nouvellePhase && avant?.finPrevue && { finPrevue: avant.finPrevue }),
    ...(!nouvellePhase && avant?.ecartVise && { ecartVise: avant.ecartVise }),
    ...changement,
    depuis: date,
  }
  if (!etape.finPrevue) delete etape.finPrevue
  if (!etape.ecartVise) delete etape.ecartVise
  if (!etape.phase) delete etape.phase
  if (!etape.calories) delete etape.calories
  const apres = (e: EtapeObjectifs) => ('volume' in changement && e.depuis > date ? { ...e, volume: { ...etape.volume } } : e)
  return tri([...frise.filter((e) => e.depuis !== date).map(apres), etape])
}

/** Phases d'un seul tenant, de la plus ancienne à la plus récente. */
export function periodes(frise: EtapeObjectifs[]): PeriodePhase[] {
  const res: PeriodePhase[] = []
  for (const e of tri(frise)) {
    const der = res[res.length - 1]
    if (der && !der.fin && der.phase === e.phase) {
      der.finPrevue = e.finPrevue
      der.ecartVise = e.ecartVise
      continue
    }
    if (der && !der.fin) der.fin = veille(e.depuis)
    if (e.phase) res.push({ phase: e.phase, debut: e.depuis, ...(e.finPrevue && { finPrevue: e.finPrevue }), ...(e.ecartVise && { ecartVise: e.ecartVise }) })
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

/** Dernier jour d'une phase pour l'affichage : sa vraie fin, sinon sa fin prévue (ou aujourd'hui si elle est dépassée), sinon sans fin. */
export const finAffichee = (p: PeriodePhase, aujourdhui: string) => p.fin ?? (p.finPrevue ? (p.finPrevue > aujourdhui ? p.finPrevue : aujourdhui) : '9999-12-31')

/**
 * Phase à montrer dans Objectifs : celle programmée à l'avance s'il y en a une (à venir), sinon celle
 * en cours. `enCours` : la phase d'aujourd'hui quand une autre est à venir.
 */
export function phaseAffichee(frise: EtapeObjectifs[], aujourdhui: string) {
  const derniere = periodes(frise).at(-1)
  const enCours = phaseA(frise, aujourdhui)
  if (derniere && derniere.debut > aujourdhui) return { ...derniere, aVenir: true as const, semaine: 0, total: derniere.finPrevue ? Math.max(1, Math.round((Date.parse(derniere.finPrevue) - Date.parse(derniere.debut)) / (7 * JOUR))) : undefined, enCours }
  return enCours && { ...enCours, aVenir: false as const, enCours: null }
}

/** Texte pour un bilan : « Sèche depuis le 3 nov. (semaine 3 sur 12, fin prévue le 26 janv.) ». */
export function textePhase(frise: EtapeObjectifs[], date: string, jour: (iso: string) => string): string | null {
  const p = phaseA(frise, date)
  if (!p) return null
  return `${nomPhase(p.phase)} depuis le ${jour(p.debut)} (semaine ${p.semaine}${p.total ? ` sur ${p.total}, fin prévue le ${jour(p.finPrevue!)}` : ''}${p.ecartVise ? `, objectif ${ecartTexte(p.ecartVise)}` : ''})`
}

const virgule = (x: number) => String(Math.round(x * 100) / 100).replace('.', ',')
/** « +2 kg », « −1,5 kg » */
export const ecartTexte = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : '±'}${virgule(Math.abs(x))} kg`

/**
 * Poids face au poids visé : ce qu'il reste (kg, signé), le rythme qu'il faut tenir d'ici la fin prévue
 * (kg par semaine, si elle est à plus d'une semaine), et si c'est atteint (selon le sens de la phase).
 */
export function avancePoids(phase: Phase, actuel: number, vise: number, aujourdhui: string, finPrevue?: string) {
  const reste = Math.round((vise - actuel) * 10) / 10
  const semaines = finPrevue ? (Date.parse(finPrevue) - Date.parse(aujourdhui)) / (7 * JOUR) : 0
  const atteint = phase === 'prise' ? reste <= 0.1 : phase === 'seche' ? reste >= -0.1 : Math.abs(reste) < 0.5
  return { reste, atteint, parSemaine: !atteint && semaines >= 1 ? Math.round((reste / semaines) * 100) / 100 : null }
}

/** Corrige la date d'une étape (ex. sèche commencée en fait lundi dernier). */
export function deplacer(frise: EtapeObjectifs[], de: string, vers: string): EtapeObjectifs[] {
  return tri([...frise.filter((e) => e.depuis !== vers || e.depuis === de)].map((e) => (e.depuis === de ? { ...e, depuis: vers } : e)))
}

// --- Phases en blocs : en cours (modifiable par une étape datée d'aujourd'hui), à venir (modifiables librement), passées (figées) ---

const plusJours = (iso: string, n: number) => new Date(Date.parse(iso + 'T12:00:00') + n * JOUR).toISOString().slice(0, 10)
const joursEntre = (a: string, b: string) => Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / JOUR)
export const finApres = (debut: string, semaines: number) => plusJours(debut, semaines * 7)

/** Étapes d'une phase : celles qui suivent son début tant que la phase ne change pas. */
function etapesDe(frise: EtapeObjectifs[], debut: string) {
  const t = tri(frise)
  const i = t.findIndex((e) => e.depuis === debut)
  const res: EtapeObjectifs[] = []
  for (let k = i; k >= 0 && k < t.length && t[k].phase === t[i].phase; k++) res.push(t[k])
  return res
}
/** Début de ce qui suit la phase (autre phase, ou arrêt), s'il y en a. */
const apres = (frise: EtapeObjectifs[], debut: string) => {
  const l = etapesDe(frise, debut)
  return tri(frise).find((e) => e.depuis > l[l.length - 1].depuis)?.depuis
}
const enPlace = (frise: EtapeObjectifs[], debut: string, f: (e: EtapeObjectifs) => EtapeObjectifs) => {
  const siens = new Set(etapesDe(frise, debut).map((e) => e.depuis))
  return tri(frise.map((e) => (siens.has(e.depuis) ? f(e) : e)))
}
/** Décale de `jours` les étapes à partir de `date` (phases à venir qui suivent une phase allongée, raccourcie ou supprimée). */
const decaler = (frise: EtapeObjectifs[], date: string, jours: number) =>
  jours ? tri(frise.map((e) => (e.depuis >= date ? { ...e, depuis: plusJours(e.depuis, jours), ...(e.finPrevue && { finPrevue: plusJours(e.finPrevue, jours) }) } : e))) : frise

/**
 * Durée d'une phase (en semaines depuis son début ; undefined = sans fin). La phase en cours change par une
 * étape d'aujourd'hui (le passé n'est jamais réécrit) ; les phases à venir qui la suivaient glissent avec elle.
 */
export function dureePhase(frise: EtapeObjectifs[], debut: string, semaines: number | undefined, aujourdhui: string): EtapeObjectifs[] {
  const ancienne = etapesDe(frise, debut).at(-1)?.finPrevue
  const suite = apres(frise, debut)
  const fin = semaines ? finApres(debut, semaines) : undefined
  const f = debut <= aujourdhui ? modifier(frise, aujourdhui, { finPrevue: fin }) : enPlace(frise, debut, (e) => ({ ...e, finPrevue: fin }))
  return suite && suite > aujourdhui && fin && fin > aujourdhui && ancienne === suite ? decaler(f, suite, joursEntre(suite, fin)) : f
}

/** Change la date de début d'une phase en gardant sa durée : elle et les suivantes glissent ensemble. */
export const deplacerPhase = (frise: EtapeObjectifs[], debut: string, vers: string) => decaler(frise, debut, joursEntre(debut, vers))

/** Variation de poids visée sur une phase (kg, signée ; undefined = aucune). */
export const ecartPhase = (frise: EtapeObjectifs[], debut: string, ecart: number | undefined, aujourdhui: string) =>
  debut <= aujourdhui ? modifier(frise, aujourdhui, { ecartVise: ecart }) : enPlace(frise, debut, (e) => ({ ...e, ecartVise: ecart }))

/** Type d'une phase à venir (sèche, maintien, prise). */
export const typePhase = (frise: EtapeObjectifs[], debut: string, phase: Phase) => enPlace(frise, debut, (e) => ({ ...e, phase }))

/** Nouvelle phase à la suite de la dernière (qui doit avoir une fin prévue). */
export function ajouterApres(frise: EtapeObjectifs[], phase: Phase, semaines: number, base: Partial<Record<Muscle, number>> = {}): EtapeObjectifs[] {
  const derniere = periodes(frise).at(-1)
  if (!derniere?.finPrevue) return frise
  return modifier(frise, derniere.finPrevue, { phase, finPrevue: finApres(derniere.finPrevue, semaines) }, base)
}

/** Supprime une phase à venir ; celles d'après avancent d'autant. */
export function supprimerPhase(frise: EtapeObjectifs[], debut: string): EtapeObjectifs[] {
  const suite = apres(frise, debut)
  const siens = new Set(etapesDe(frise, debut).map((e) => e.depuis))
  const f = frise.filter((e) => !siens.has(e.depuis))
  return suite ? decaler(f, suite, -joursEntre(debut, suite)) : f
}

/** La phase en cours s'arrête aujourd'hui : la suivante (s'il y en a une) commence tout de suite, sinon plus de phase. */
export function terminerPhase(frise: EtapeObjectifs[], debut: string, aujourdhui: string): EtapeObjectifs[] {
  if (debut >= aujourdhui) return supprimerPhase(frise, debut)
  const suite = apres(frise, debut)
  // Une étape d'aujourd'hui (fin ou objectif changés ce matin) laisse la place à la phase suivante.
  if (suite && suite > aujourdhui) return decaler(frise.filter((e) => e.depuis !== aujourdhui || e.depuis === debut), suite, -joursEntre(aujourdhui, suite))
  return modifier(frise, aujourdhui, { phase: undefined })
}

type PeseeSimple = { date: string; poids: number }
const moyennePoids = (l: PeseeSimple[]) => (l.length ? Math.round((l.reduce((a, p) => a + p.poids, 0) / l.length) * 10) / 10 : null)

/** Poids au début d'une phase : moyenne des pesées de J−3 à J+6, sinon la dernière avant. */
export function poidsDepart(pesees: PeseeSimple[], debut: string): number | null {
  const autour = moyennePoids(pesees.filter((p) => p.date >= plusJours(debut, -3) && p.date <= plusJours(debut, 6)))
  return autour ?? [...pesees].filter((p) => p.date < debut).sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.poids ?? null
}

/** Moyenne des pesées des 7 jours qui finissent à `date`. */
export const poidsSemaine = (pesees: PeseeSimple[], date: string) => moyennePoids(pesees.filter((p) => p.date > plusJours(date, -7) && p.date <= date))

/** Rythme d'une variation visée : un mot si c'est trop lent ou trop rapide pour la phase (repères du programme). */
export function avisRythme(phase: Phase, ecart: number, semaines: number): string | null {
  const r = ecart / semaines
  if (phase === 'prise') {
    if (r < 0.15) return 'un peu lent pour une prise : vise +0,15 à +0,25 kg par semaine'
    if (r > 0.4) return 'rapide : une partie risque d’être du gras, vise +0,15 à +0,25 kg par semaine'
  }
  if (phase === 'seche') {
    if (r > -0.2) return 'lent pour une sèche : vise −0,3 à −0,7 kg par semaine'
    if (r < -1) return 'trop rapide : risque de perdre du muscle, vise −0,3 à −0,7 kg par semaine'
  }
  return null
}
