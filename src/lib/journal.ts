import type { Phase } from './objectifs'

/** Une phrase pour l'assiette du jour, selon la phase et s'il y a entraînement (pas de chiffres : ça viendra avec les calories). */
export function conseilRepas(phase: Phase | undefined, entrainement: boolean, deload = false): string | null {
  if (deload) return 'Semaine allégée : mange et marche comme d’habitude. Ne réduis pas tes repas, une semaine allégée ne fait pas perdre de muscle.'
  if (phase === 'prise')
    return entrainement ? 'Jour d’entraînement en prise : mange un peu plus que d’habitude, des protéines à chaque repas.' : 'Repos en prise : continue à bien manger, c’est aujourd’hui que le muscle se construit.'
  if (phase === 'seche')
    return entrainement ? 'Jour d’entraînement en sèche : protéines hautes, et tes glucides plutôt autour de la séance.' : 'Repos en sèche : reste dans ton déficit, protéines hautes, et marche un peu.'
  if (phase === 'maintien') return 'Maintien : mange comme d’habitude, des protéines à chaque repas.'
  return null
}
