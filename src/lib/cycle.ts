import { MUSCLES } from '../data/exercices'
import type { Cycle, Exercice, ExoPlan, Muscle, Programme, SeanceModele } from '../types'
import { dateISO, lundi } from './calc'
import type { Suggestion } from './progression'

const SEMAINE = 7 * 86400000
const jours = (iso: string) => Date.parse(iso + 'T12:00:00')
const plusSemaines = (iso: string, n: number) => dateISO(new Date(jours(iso) + n * SEMAINE))

export const DUREE_DEFAUT = 6

/** Objectifs de volume par défaut (séries dures par semaine). */
export const volumeDefaut = (): Partial<Record<Muscle, number>> => Object.fromEntries(MUSCLES.filter((m) => m.cible > 0).map((m) => [m.id, m.cible]))

/** Objectifs de volume d'un programme : les siens, sinon les valeurs par défaut de l'appli. */
export const volumeProgramme = (p?: Programme): Partial<Record<Muscle, number>> => p?.volume ?? volumeDefaut()

/**
 * Objectif de chaque muscle : les objectifs personnels (partie Objectifs de Progression), les mêmes
 * quel que soit le programme. Tant qu'ils n'ont jamais été réglés : ceux du cycle en cours ou du
 * programme actif (anciennes données), sinon les valeurs par défaut.
 */
export const cibles = (perso?: Partial<Record<Muscle, number>>, cycle?: Cycle, programme?: Programme): Record<Muscle, number> => {
  const v = perso ?? cycle?.volume ?? volumeProgramme(programme)
  return Object.fromEntries(MUSCLES.map((m) => [m.id, v[m.id] ?? 0])) as Record<Muscle, number>
}

export interface EtatCycle {
  /** Numéro de semaine (1 = première) ; ≤ 0 avant le début. */
  n: number
  total: number
  deload: boolean
  pause: boolean
  fini: boolean
}

/** Où en est le cycle à une date : semaine, déload, pause, terminé. */
export function etatCycle(c: Cycle, date = dateISO()): EtatCycle {
  const l = lundi(new Date(date + 'T12:00:00'))
  const ecart = Math.round((jours(l) - jours(c.debut)) / SEMAINE)
  const pause = c.pauses.includes(l)
  const n = ecart - c.pauses.filter((p) => p < l).length + 1
  return { n, total: c.semaines, pause, deload: !pause && c.deloads.includes(n), fini: !!c.fin || n > c.semaines }
}

/** Lundi de la semaine `n` du cycle, en sautant les semaines en pause. */
export function lundiDe(c: Cycle, n: number): string {
  let l = c.debut
  let k = 0
  for (;;) {
    if (!c.pauses.includes(l)) k++
    if (k === n) return l
    l = plusSemaines(l, 1)
  }
}

/** Nom affiché d'un cycle : le sien, sinon celui du programme. */
export const nomCycle = (c: Cycle) => c.nom?.trim() || c.programme.nom

/** Séries dures de plus par semaine pour un muscle prioritaire du cycle. */
export const BONUS_PRIORITE = 4
export const MAX_PRIORITES = 2

/** Le cycle couvre cette date : de son lundi de départ à sa fin réelle, sinon prévue. */
export const couvre = (c: Cycle, date: string) => date >= c.debut && date <= (c.fin ?? dateISO(new Date(jours(lundiDe(c, c.semaines)) + 6 * 86400000)))

/** Objectifs de volume avec les priorités du cycle qui couvre la date (les objectifs perso ne changent pas). */
export function avecPriorites(v: Record<Muscle, number>, cycles: Cycle[], date: string): Record<Muscle, number> {
  const c = cycles.find((x) => x.priorites?.length && couvre(x, date))
  return c ? { ...v, ...Object.fromEntries(c.priorites!.map((m) => [m, (v[m] ?? 0) + BONUS_PRIORITE])) } : v
}

/** Nouveau cycle, avec une copie du programme et de ses séances. */
export function nouveauCycle(
  id: string,
  programme: Programme,
  modele: (id: string) => SeanceModele | undefined,
  debut: string,
  semaines = DUREE_DEFAUT,
  deloads = [semaines],
  volume = volumeProgramme(programme)
): Cycle {
  return {
    id,
    programmeId: programme.id,
    programme: structuredClone(programme),
    modeles: copieSeances(programme, modele),
    debut: lundi(new Date(debut + 'T12:00:00')),
    semaines,
    deloads,
    pauses: [],
    volume: { ...volume },
  }
}

export const copieSeances = (p: Programme, modele: (id: string) => SeanceModele | undefined) =>
  [...new Set(p.seances.map((e) => e.modeleId))].map((id) => modele(id)).filter((m): m is SeanceModele => !!m).map((m) => structuredClone(m))

// --- Programme modifié pendant le cycle ---------------------------------------

/** Ce qui diffère entre le cycle et le programme, sans ce qui a déjà été gardé pour le prochain cycle. */
export interface EcartCycle {
  planning: boolean
  /** Séances du cycle dont la bibliothèque a une autre version (celle de la bibliothèque). */
  seances: SeanceModele[]
}

const CLE_PLANNING = 'planning'
/** Deux versions identiques ont la même signature, quel que soit l'ordre des champs. */
const signature = (x: unknown) =>
  JSON.stringify(x, (_, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v))
// L'ordre des séances ne change pas ce qu'on fait chaque jour : seuls comptent quelles séances et quels jours.
const signaturePlanning = (p: Programme) =>
  signature(p.seances.map((e) => [e.modeleId, e.jour ?? 0]).sort((a, b) => String(a[0]).localeCompare(String(b[0])) || Number(a[1]) - Number(b[1])))

export function ecartCycle(c: Cycle, programme: Programme | undefined, modele: (id: string) => SeanceModele | undefined): EcartCycle | undefined {
  const dansCycle = new Set(c.programme.seances.map((e) => e.modeleId))
  const planning = !!programme && signaturePlanning(programme) !== signaturePlanning(c.programme) && signaturePlanning(programme) !== c.refus?.[CLE_PLANNING]
  const seances = c.modeles.flatMap((copie) => {
    const m = dansCycle.has(copie.id) ? modele(copie.id) : undefined
    return m && signature(m) !== signature(copie) && signature(m) !== c.refus?.[copie.id] ? [m] : []
  })
  return planning || seances.length ? { planning, seances } : undefined
}

/** Le cycle prend ce qui est listé dans l'écart, et rien d'autre : un changement gardé pour le prochain cycle n'y entre pas. */
export function appliquerEcart(c: Cycle, e: EcartCycle, programme: Programme | undefined, modele: (id: string) => SeanceModele | undefined): Pick<Cycle, 'programme' | 'modeles' | 'refus'> {
  const refus = { ...c.refus }
  let prog = c.programme
  let modeles = c.modeles
  if (e.planning && programme) {
    prog = structuredClone(programme)
    modeles = [...new Set(programme.seances.map((x) => x.modeleId))].flatMap((id) => {
      const m = c.modeles.find((x) => x.id === id) ?? modele(id)
      return m ? [structuredClone(m)] : []
    })
    delete refus[CLE_PLANNING]
  }
  for (const s of e.seances) {
    modeles = modeles.map((m) => (m.id === s.id ? structuredClone(s) : m))
    delete refus[s.id]
  }
  return { programme: prog, modeles, refus: Object.keys(refus).length ? refus : undefined }
}

/** « Garder pour le prochain cycle » : ces versions ne sont plus reproposées, tant qu'on ne les modifie pas encore. */
export function garderEcart(c: Cycle, e: EcartCycle, programme: Programme | undefined): Pick<Cycle, 'refus'> {
  const refus = { ...c.refus }
  if (e.planning && programme) refus[CLE_PLANNING] = signaturePlanning(programme)
  for (const s of e.seances) refus[s.id] = signature(s)
  return { refus }
}

/** Met la semaine en cours en pause : la suite du cycle (déload compris) glisse d'une semaine. */
export function mettreEnPause(c: Cycle, date = dateISO()): Cycle {
  const l = lundi(new Date(date + 'T12:00:00'))
  return c.pauses.includes(l) ? c : { ...c, pauses: [...c.pauses, l].sort() }
}

/** Déload maintenant : la semaine en cours devient un déload, la suite est décalée d'une semaine. */
export function deloadMaintenant(c: Cycle, date = dateISO()): Cycle {
  const { n } = etatCycle(c, date)
  if (c.deloads.includes(n)) return c
  return { ...c, semaines: c.semaines + 1, deloads: [...c.deloads.map((d) => (d >= n ? d + 1 : d)), n].sort((a, b) => a - b) }
}

// --- Déload ---------------------------------------------------------------

/** Plan allégé : moitié des séries (arrondi au-dessus), RPE 6-7, pas de finisseur ni d'échec. */
export function planDeload(p: ExoPlan): ExoPlan {
  const n = Math.max(1, Math.ceil(p.series.length / 2))
  return { ...p, finisseur: false, series: p.series.slice(0, n).map((s) => ({ ...s, rpe: Math.min(7, Math.max(6, s.rpe - 2)) })) }
}

const arrondiPas = (x: number, pas: number) => Math.round(Math.round(x / pas) * pas * 100) / 100

/** Charges −10 % (arrondies au pas de l'exercice) par rapport à l'objectif normal. */
export function suggestionDeload(exo: Exercice, s: Suggestion): Suggestion {
  const alleger = (c: number | null) => {
    if (c === null || c <= 0 || exo.mode === 'elastique' || exo.assistance) return c
    const r = arrondiPas(c * 0.9, exo.pas)
    return r < c ? r : Math.max(0, arrondiPas(c - exo.pas, exo.pas))
  }
  return { ...s, charges: s.charges.map(alleger), message: 'Déload : environ −10 % de charge, effort 6-7/10, sans aller à l’échec.' }
}

/** Ce qui est prévu un jour donné : séances du planning (1 = lundi), et pendant un cycle sa semaine, déload ou pause. */
export function prevuLe(planning: { modele: SeanceModele; jour: number }[], cycle: Cycle | undefined, iso: string): { seances: SeanceModele[]; semaine?: number; total?: number; deload?: boolean; pause?: boolean } {
  const jour = ((new Date(iso + 'T12:00:00').getDay() + 6) % 7) + 1
  const seances = planning.filter((e) => e.jour === jour).map((e) => e.modele)
  if (!cycle) return { seances }
  const e = etatCycle(cycle, iso)
  if (e.n < 1 || e.n > e.total) return { seances: [] }
  if (e.pause) return { seances: [], pause: true }
  return { seances, semaine: e.n, total: e.total, deload: e.deload }
}
