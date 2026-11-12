import { MUSCLES } from '../data/exercices'
import { kg } from './calc'
import type { Muscle } from '../types'

/**
 * Volume par muscle lu comme une jauge : sous la zone utile = « Léger », dedans = « Optimal »,
 * au-dessus = « Beaucoup ». Chaque muscle a un niveau : Normal (la zone de `MUSCLES`), Entretien
 * (4 à 8), Priorité (16 à 20 ; avec moins de 3 séances par semaine, 6 à 7 séries par séance) ou Sans conseil (0). Il s'enregistre en chiffre, ce qui relit aussi les anciennes cibles.
 */
export type EtatVolume = 'suivi' | 'leger' | 'optimal' | 'beaucoup'

export const LIBELLE_VOLUME: Record<EtatVolume, string> = { suivi: 'suivi', leger: 'Léger', optimal: 'Optimal', beaucoup: 'Beaucoup' }

const def = (m: Muscle) => MUSCLES.find((x) => x.id === m)!

/** Cible de l'appli (bas de la zone utile), 0 = suivi seulement. */
export const cibleConseillee = (m: Muscle) => def(m).cible

/** Séries d'un même muscle dans une séance : en dessous de 6, la priorité ne se voit pas ; au-delà de 7, les suivantes rapportent peu. */
const PAR_SEANCE = { bas: 6, haut: 7 }

/** Moins de 3 séances par semaine : la Priorité ne peut pas demander 16 à 20 séries (8 à 10 du même muscle par séance). */
const peuDeSeances = (seances?: number): seances is number => !!seances && seances > 0 && seances * PAR_SEANCE.bas < CIBLE_PRIORITE

/** Le bas de la Priorité : 16, ou 6 séries par séance quand il y a moins de 3 séances ; jamais sous le conseil général du muscle. */
export const ciblePriorite = (m: Muscle, seances?: number) => (peuDeSeances(seances) ? Math.max(def(m).cible, seances * PAR_SEANCE.bas) : CIBLE_PRIORITE)

/** La Priorité ramenée au nombre de séances : c'est une cible au-dessus du conseil général, égale à 6 séries par séance. */
const prioriteReduite = (m: Muscle, cible: number, seances?: number) => peuDeSeances(seances) && cible > def(m).cible && cible === seances * PAR_SEANCE.bas

/** Zone utile [bas, haut] pour cette cible, ou null sans cible. `seances` : séances par semaine du programme. */
export function zone(m: Muscle, cible: number, seances?: number): { bas: number; haut: number } | null {
  if (cible <= 0) return null
  if (prioriteReduite(m, cible, seances)) return { bas: cible, haut: seances! * PAR_SEANCE.haut }
  return { bas: cible, haut: Math.max(niveauDe(m, cible) === 'entretien' ? HAUT_ENTRETIEN : def(m).haut, Math.round(cible * 1.25)) }
}

export function etatVolume(m: Muscle, v: number, cible: number, seances?: number): EtatVolume {
  const z = zone(m, cible, seances)
  if (!z) return 'suivi'
  return v < z.bas ? 'leger' : v > z.haut ? 'beaucoup' : 'optimal'
}

export type NiveauVolume = 'entretien' | 'normal' | 'priorite' | 'sans'

const CIBLE_ENTRETIEN = 4
const HAUT_ENTRETIEN = 8
const CIBLE_PRIORITE = 16

/** Le niveau que dit une cible : 0 = Sans conseil ; 16 ou plus = Priorité ; 8 ou moins, et sous le bas du muscle = Entretien ; sinon Normal. Rien de noté = Normal. */
export function niveauDe(m: Muscle, cible: number | undefined): NiveauVolume {
  if (cible === undefined) return 'normal'
  if (cible <= 0) return 'sans'
  if (cible >= CIBLE_PRIORITE) return 'priorite'
  return cible <= HAUT_ENTRETIEN && cible < def(m).cible ? 'entretien' : 'normal'
}

export const cibleDuNiveau = (m: Muscle, n: NiveauVolume) => (n === 'sans' ? 0 : n === 'entretien' ? CIBLE_ENTRETIEN : n === 'priorite' ? CIBLE_PRIORITE : def(m).cible)

/** La cible à lire pour ce niveau, avec ce nombre de séances par semaine (le chiffre enregistré, lui, reste 16 pour une Priorité). */
export const cibleLue = (m: Muscle, cible: number, seances?: number) => (cible >= CIBLE_PRIORITE && def(m).cible > 0 ? Math.max(cible - CIBLE_PRIORITE + ciblePriorite(m, seances), 0) : cible)

/** Toutes les cibles, lues avec ce nombre de séances par semaine. */
export const ciblesLues = (v: Record<Muscle, number>, seances?: number) => Object.fromEntries(MUSCLES.map((m) => [m.id, cibleLue(m.id, v[m.id] ?? 0, seances)])) as Record<Muscle, number>

/** La phrase du choix, chiffres du muscle compris. */
export function phraseNiveau(m: Muscle, n: NiveauVolume, seances?: number) {
  const z = zone(m, cibleLue(m, cibleDuNiveau(m, n), seances), seances)
  if (!z) return 'Ses séries restent affichées, sans barre ni remarque.'
  if (n === 'priorite' && peuDeSeances(seances)) return `Avec ${seances} séance${seances > 1 ? 's' : ''} par semaine, vise ${z.bas}${z.haut > z.bas ? ` à ${z.haut}` : ''} séries. Au-delà de ${PAR_SEANCE.haut} séries d’un muscle dans une séance, les suivantes rapportent peu : pour viser plus haut, il faut une séance de plus.`
  if (n === 'entretien') return `Le garder sans chercher à le faire grossir : ${z.bas} à ${z.haut} séries.`
  if (n === 'priorite') return `Un point faible, sur 4 à 8 semaines : ${z.bas} à ${z.haut} séries.`
  return `Le conseil général : ${z.bas} à ${z.haut} séries.`
}

/** Aujourd'hui et après : le niveau de chaque muscle ; les anciennes cibles en chiffres y sont ramenées. Muscle sans conseil général : rien. */
export const ciblesEnVigueur = (v: Partial<Record<Muscle, number>>) => Object.fromEntries(MUSCLES.map((m) => [m.id, m.cible > 0 ? cibleDuNiveau(m.id, niveauDe(m.id, v[m.id])) : 0])) as Record<Muscle, number>

/**
 * La ligne de la page Programme, en chiffres : le muscle en Priorité d'abord, avec ce qu'il vise, puis les plus travaillés.
 * Sans `conseils` (conseils masqués) : les séries seules.
 */
export function resumeMuscles(volume: Record<Muscle, number>, conseils?: { cibles: Record<Muscle, number>; perso: Record<Muscle, number>; seances: number }): string[] {
  const texte = (m: (typeof MUSCLES)[number], avecMot = false) => `${m.nom} ${kg(volume[m.id])}${avecMot ? ` série${volume[m.id] >= 2 ? 's' : ''}` : ''}`
  const tries = MUSCLES.filter((m) => m.cible > 0 && volume[m.id] > 0).sort((a, b) => volume[b.id] - volume[a.id])
  const prio = conseils && MUSCLES.find((m) => conseils.cibles[m.id] > 0 && niveauDe(m.id, conseils.perso[m.id]) === 'priorite')
  const z = prio && conseils ? zone(prio.id, conseils.cibles[prio.id], conseils.seances) : null
  const autres = tries.filter((m) => m !== prio).slice(0, prio ? 3 : 2)
  if (prio && z) return [`${texte(prio)}, en priorité : vise ${kg(z.bas)} à ${kg(z.haut)}`, autres.map((m) => texte(m)).join(' · ')].filter(Boolean)
  const tete = tries.slice(0, 3)
  return tete.length ? [tete.map((m, i) => texte(m, i === 0)).join(' · ')] : []
}
