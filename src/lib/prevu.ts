import type { Cycle, Seance } from '../types'
import { dateISO, semaineType } from './calc'
import { couvre } from './cycle'
import { semaineDe } from './historique'

/** Réglage : le nombre de séances prévues par semaine, à chaque fois qu'il change. On ne réécrit jamais le passé. */
export const CLE_PREVUS = 'prevusParSemaine'

export interface EtapePrevu {
  /** AAAA-MM-JJ */
  depuis: string
  n: number
}

/** Ajoute le nombre prévu aujourd'hui s'il a changé. Deux changements le même jour : une seule étape, la dernière. Renvoie la même liste si rien ne change. */
export function noterPrevu(liste: EtapePrevu[], date: string, n: number): EtapePrevu[] {
  const derniere = liste[liste.length - 1]
  if (derniere?.n === n) return liste
  const avant = derniere?.depuis === date ? liste.slice(0, -1) : liste
  return avant[avant.length - 1]?.n === n ? avant : [...avant, { depuis: date, n }]
}

/**
 * Séances prévues une semaine donnée (son lundi) : le nombre en vigueur le dimanche de cette semaine. Avant la première
 * étape notée (données plus anciennes que cette fonction) : le programme du cycle qui couvrait la semaine, sinon une
 * estimation d'après les séances faites à l'époque, sans dépasser la première valeur connue.
 */
export function prevuDeSemaine(liste: EtapePrevu[], cycles: Cycle[], seances: Seance[], actuel: number): (lundi: string) => number {
  const premiere = liste[0]
  const parSemaine = new Map<string, number>()
  for (const s of seances) if (!s.enCours && (!premiere || s.date < premiere.depuis)) parSemaine.set(semaineDe(s.date), (parSemaine.get(semaineDe(s.date)) ?? 0) + 1)
  const estimation = Math.min(premiere?.n ?? actuel, Math.max(0, ...parSemaine.values()))
  return (lundi) => {
    if (!premiere) return actuel
    const dimanche = dateISO(new Date(Date.parse(lundi + 'T12:00:00') + 6 * 86400000))
    const etape = [...liste].reverse().find((e) => e.depuis <= dimanche)
    if (etape) return etape.n
    const cycle = cycles.find((c) => couvre(c, lundi))
    return cycle ? semaineType(cycle.programme).length : estimation
  }
}
