import { registerPlugin } from '@capacitor/core'
import { db, setReglage } from '../db'
import type { JourJournal } from '../types'
import { dateISO } from './calc'
import { natif, versionInstallee } from './natif'
import { plusRecente } from './versions'

/**
 * Pas et sommeil lus dans Health Connect (APK 2.5, `SantePlugin.kt`) : ce que la montre ou le téléphone y
 * écrivent. Rangés par jour dans le journal (`pas`, `sommeil`), ils remplissent la case Sommeil, le Journal, le
 * Bilan et les textes partagés. Le sommeil noté à la main n'est jamais écrasé. Rien dans le navigateur.
 */
export interface EtatSante {
  disponible: boolean
  pas: boolean
  sommeil: boolean
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
  lire(o: { jours: number }): Promise<{ pas: { date: string; pas: number }[]; nuits: NuitBrute[] }>
}

const Sante = registerPlugin<PluginSante>('Sante')

/** Réglage : la personne a branché sa montre (Réglages). Sans lui, rien n'est lu. */
export const CLE_SANTE = 'sante'

/** L'APK installé sait lire Health Connect (2.5 et plus). */
export const santeDisponible = async () => {
  const v = await versionInstallee()
  return !!v && !plusRecente('2.5', v)
}

export const etatSante = (): Promise<EtatSante> => (natif ? Sante.etat() : Promise.resolve({ disponible: false, pas: false, sommeil: false }))

/** Écran d'autorisation de Health Connect ; le réglage suit ce qui a été accordé. */
export async function autoriserSante(): Promise<EtatSante> {
  const e = await Sante.autoriser()
  await setReglage(CLE_SANTE, e.pas || e.sommeil)
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

/**
 * Ce qui change dans le journal d'un jour avec ce que dit la montre : les pas toujours (le chiffre du jour grossit
 * jusqu'au soir), le sommeil seulement s'il n'a pas été noté à la main. Null si rien ne change.
 */
export function majJour(j: JourJournal | undefined, pas: number | undefined, sommeil: number | undefined): Partial<JourJournal> | null {
  const c: Partial<JourJournal> = {}
  if (pas !== undefined && pas !== j?.pas) c.pas = pas
  const sommeilALaMain = j?.sommeil !== undefined && !j.sommeilMontre
  if (sommeil !== undefined && !sommeilALaMain && (sommeil !== j?.sommeil || !j?.sommeilMontre)) Object.assign(c, { sommeil, sommeilMontre: true })
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
  const jours = [...new Set([...Object.keys(pas), ...Object.keys(sommeil)])]
  await db.transaction('rw', db.journal, async () => {
    for (const date of jours) {
      const j = await db.journal.get(date)
      const c = majJour(j, pas[date], sommeil[date])
      if (c) await db.journal.put({ ...j, ...c, date })
    }
  })
}
