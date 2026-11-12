import type { Pose } from '../types'
import { repere } from './recap'

const ORDRE: Pose[] = ['face', 'profil', 'dos']

/** Pose présente aux deux dates (face d'abord) : on ne compare jamais une photo de face à une de dos. */
export const poseCommune = (a: Pose[], b: Pose[]) => ORDRE.find((p) => a.includes(p) && b.includes(p))

/**
 * Deux dates à comparer d'office (dates de la plus ancienne à la plus récente) : celle du début de l'objectif (comme
 * les mensurations : la dernière des 14 jours d'avant, sinon la première ensuite), sinon la toute première, face à la
 * dernière. `duDebut` dit si la première est bien celle du début de l'objectif.
 */
export function paireDepart(dates: string[], debutPhase?: string): { depart?: string; derniere?: string; duDebut?: boolean } {
  const derniere = dates[dates.length - 1]
  if (dates.length < 2) return { derniere }
  const debut = debutPhase ? repere(dates.slice(0, -1).map((date) => ({ date })), debutPhase)?.date : undefined
  return { depart: debut ?? dates[0], derniere, duDebut: !!debut }
}
