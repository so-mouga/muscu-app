import { registerPlugin } from '@capacitor/core'
import { db, setReglage } from '../db'
import type { JourJournal } from '../types'
import { CLE_OBJECTIFS, CLE_PHASES, CLE_VOLUME, lireFrise } from './objectifs'
import { objectifDuJour } from './nutrition'
import { dateISO } from './calc'
import { natif, versionInstallee } from './natif'
import { plusRecente } from './versions'

/**
 * Pas et sommeil (APK 2.5) et repas (APK 2.6) lus dans Health Connect (`SantePlugin.kt`) : ce que la montre, le
 * téléphone ou l'appli de repas y écrivent. Rangés par jour dans le journal (`pas`, `sommeil`), ils remplissent la case Sommeil, le Journal, le
 * Bilan et les textes partagés. La montre fait foi : sa nuit remplace ce qui a été noté à la main, et ne se modifie
 * pas (choix de l'utilisateur, 10 nov. 2026). Une nuit sans données se note toujours à la main. Rien dans le navigateur.
 */
export interface EtatSante {
  disponible: boolean
  pas: boolean
  sommeil: boolean
  /** Repas (APK 2.6) : absent avant. */
  nutrition?: boolean
}

/** Total des repas d'un jour, tel que l'appli de repas l'écrit (kcal, grammes). */
export interface RepasJour {
  date: string
  kcal: number
  proteines?: number
  glucides?: number
  lipides?: number
}

/** Une période de sommeil telle que Health Connect la donne : début, fin (horodatages) et minutes dormies. */
export interface NuitBrute {
  debut: number
  fin: number
  minutes: number
}

interface PluginSante {
  etat(): Promise<EtatSante>
  autoriser(): Promise<EtatSante>
  lire(o: { jours: number }): Promise<{ pas: { date: string; pas: number }[]; nuits: NuitBrute[]; repas?: RepasJour[] }>
}

const Sante = registerPlugin<PluginSante>('Sante')

/** Réglage : la personne a branché sa montre (Réglages). Sans lui, rien n'est lu. */
export const CLE_SANTE = 'sante'

/** L'APK installé sait lire Health Connect (2.5 et plus). */
export const santeDisponible = async () => {
  const v = await versionInstallee()
  return !!v && !plusRecente('2.5', v)
}

/** L'APK installé sait aussi lire les repas (2.6 et plus). */
export const repasDisponible = async () => {
  const v = await versionInstallee()
  return !!v && !plusRecente('2.6', v)
}

export const etatSante = (): Promise<EtatSante> => (natif ? Sante.etat() : Promise.resolve({ disponible: false, pas: false, sommeil: false, nutrition: false }))

/** Écran d'autorisation de Health Connect ; le réglage suit ce qui a été accordé. */
export async function autoriserSante(): Promise<EtatSante> {
  const e = await Sante.autoriser()
  await setReglage(CLE_SANTE, e.pas || e.sommeil || !!e.nutrition)
  return e
}

/** Une nuit compte pour le jour où l'on se réveille, si on se lève avant 15 h : une sieste l'après-midi n'est pas une nuit. */
const HEURE_LIMITE_NUIT = 15

/** Heures dormies par jour de réveil (sommes des périodes de la nuit, éveils retirés), au centième d'heure. */
export function nuitsParJour(nuits: NuitBrute[]): Record<string, number> {
  const minutes: Record<string, number> = {}
  for (const n of nuits) {
    const fin = new Date(n.fin)
    if (fin.getHours() >= HEURE_LIMITE_NUIT || n.minutes <= 0) continue
    const jour = dateISO(fin)
    minutes[jour] = (minutes[jour] ?? 0) + n.minutes
  }
  return Object.fromEntries(Object.entries(minutes).map(([j, m]) => [j, Math.round((m / 60) * 100) / 100]))
}

/** « Tenu » = à 150 kcal près de l'objectif : en prise, le surplus fait environ 300 kcal, un pourcentage serait trop large. */
export const MARGE_CALORIES = 150

/** Le verdict d'un jour d'après son vrai total : dans l'objectif, trop ou pas assez. */
export function jugerCalories(kcal: number, objectif: number): NonNullable<JourJournal['calories']> {
  if (kcal > objectif + MARGE_CALORIES) return 'trop'
  if (kcal < objectif - MARGE_CALORIES) return 'pasAssez'
  return 'ok'
}

/**
 * Ce qui change dans le journal d'un jour avec ce que disent la montre et l'appli de repas : les pas (le chiffre du
 * jour grossit jusqu'au soir), le sommeil, qui remplace une nuit notée à la main, et les repas, qui font foi aussi :
 * le verdict est déduit du total, seulement pour un jour fini et avec un objectif. Null si rien ne change.
 */
export function majJour(j: JourJournal | undefined, pas: number | undefined, sommeil: number | undefined, repas?: RepasJour, objectif?: number | null, fini = true): Partial<JourJournal> | null {
  const c: Partial<JourJournal> = {}
  if (pas !== undefined && pas !== j?.pas) c.pas = pas
  if (sommeil !== undefined && (sommeil !== j?.sommeil || !j?.sommeilMontre)) Object.assign(c, { sommeil, sommeilMontre: true })
  if (repas) {
    const g = (x: number | undefined) => (x === undefined ? undefined : Math.round(x))
    const lu: Partial<JourJournal> = { kcal: Math.round(repas.kcal), proteines: g(repas.proteines), glucides: g(repas.glucides), lipides: g(repas.lipides), kcalAppli: true, calories: fini && objectif ? jugerCalories(repas.kcal, objectif) : undefined }
    for (const [k, v] of Object.entries(lu) as [keyof JourJournal, unknown][]) if (j?.[k] !== v) Object.assign(c, { [k]: v })
  }
  return Object.keys(c).length ? c : null
}

let derniereLecture = 0

/** Lit les 14 derniers jours et les range dans le journal. Au plus une fois toutes les 10 min, sauf `forcer`. */
export async function synchroniserSante(forcer = false): Promise<void> {
  if (!natif || (!forcer && Date.now() - derniereLecture < 10 * 60000)) return
  const r = await db.reglages.get(CLE_SANTE)
  if (r?.valeur !== true || !(await santeDisponible())) return
  derniereLecture = Date.now()
  const lu = await Sante.lire({ jours: 14 })
  const pas = Object.fromEntries(lu.pas.map((x) => [x.date, x.pas]))
  const sommeil = nuitsParJour(lu.nuits)
  const repas = Object.fromEntries((lu.repas ?? []).map((x) => [x.date, x]))
  // Objectif calories de chaque jour (celui de sa phase) : le verdict se déduit du vrai total.
  const frise = lireFrise(...((await db.reglages.bulkGet([CLE_OBJECTIFS, CLE_PHASES, CLE_VOLUME])).map((r) => r?.valeur) as [unknown, unknown, unknown]))
  const aujourdhui = dateISO()
  const jours = [...new Set([...Object.keys(pas), ...Object.keys(sommeil), ...Object.keys(repas)])]
  await db.transaction('rw', db.journal, async () => {
    for (const date of jours) {
      const j = await db.journal.get(date)
      const c = majJour(j, pas[date], sommeil[date], repas[date], objectifDuJour(frise, date)?.kcal, date < aujourdhui)
      if (c) await db.journal.put({ ...j, ...c, date })
    }
  })
}
