import type { Pose } from '../types'

const ORDRE: Pose[] = ['face', 'profil', 'dos']

/** Pose présente aux deux dates (face d'abord) : on ne compare jamais une photo de face à une de dos. */
export const poseCommune = (a: Pose[], b: Pose[]) => ORDRE.find((p) => a.includes(p) && b.includes(p))

/**
 * Deux dates à comparer d'office (dates de la plus ancienne à la plus récente) : la première depuis le
 * début de la phase, sinon la toute première, face à la dernière.
 */
export function paireDepart(dates: string[], debutPhase?: string): { depart?: string; derniere?: string } {
  const derniere = dates[dates.length - 1]
  if (dates.length < 2) return { derniere }
  return { depart: (debutPhase && dates.find((d) => d >= debutPhase && d < derniere)) || dates[0], derniere }
}
