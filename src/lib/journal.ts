import type { Exercice, Seance } from '../types'
import { scoreSerie } from './historique'
import type { Phase } from './objectifs'

/**
 * Plus forte progression depuis une date (début de phase) : meilleure série de la dernière séance
 * face à la référence (dernière séance avant la date, sinon la première après). Déloads exclus.
 */
export function meilleureProgression(seances: Seance[], exo: (id: string) => Exercice, depuis: string): { exo: Exercice; pct: number } | null {
  const travail = seances.filter((s) => !s.deload).sort((a, b) => a.debut - b.debut)
  const meilleur = (s: Seance, id: string) => Math.max(0, ...s.series.filter((x) => x.exoId === id && x.reps > 0).map((x) => scoreSerie(exo(id), x, s.poidsCorps)))
  let res: { exo: Exercice; pct: number } | null = null
  for (const id of new Set(travail.flatMap((s) => s.series.map((x) => x.exoId)))) {
    const avec = travail.filter((s) => s.series.some((x) => x.exoId === id))
    const ref = [...avec].reverse().find((s) => s.date < depuis) ?? avec.find((s) => s.date >= depuis)
    const der = avec[avec.length - 1]
    if (!ref || !der || der === ref || der.date < depuis) continue
    const a = meilleur(ref, id)
    const b = meilleur(der, id)
    if (a <= 0) continue
    const pct = (b / a - 1) * 100
    if (pct > 0.5 && (!res || pct > res.pct)) res = { exo: exo(id), pct }
  }
  return res
}

/** Une phrase pour l'assiette du jour, selon la phase et s'il y a entraînement (pas de chiffres : ça viendra avec les calories). */
export function conseilRepas(phase: Phase | undefined, entrainement: boolean): string | null {
  if (phase === 'prise')
    return entrainement ? 'Jour d’entraînement en prise : mange un peu plus que d’habitude, des protéines à chaque repas.' : 'Repos en prise : continue à bien manger, c’est aujourd’hui que le muscle se construit.'
  if (phase === 'seche')
    return entrainement ? 'Jour d’entraînement en sèche : protéines hautes, et tes glucides plutôt autour de la séance.' : 'Repos en sèche : reste dans ton déficit, protéines hautes, et marche un peu.'
  if (phase === 'maintien') return 'Maintien : mange comme d’habitude, des protéines à chaque repas.'
  return null
}
