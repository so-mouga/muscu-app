/**
 * Calculateur de disques pour barre olympique et Smith machine.
 */

export const POIDS_BARRES = [20, 15, 10, 0] as const
export type PoidsBarre = (typeof POIDS_BARRES)[number]

export const DISQUES_STANDARDS = [20, 10, 5, 2.5, 1.25, 0.5] as const

export interface RepartitionDisques {
  poidsTotal: number
  poidsBarre: number
  chargeParCote: number
  disques: { poids: number; quantite: number }[]
  reste: number
}

/**
 * Calcule la combinaison de disques optimale par côté.
 */
export function repartirDisques(
  poidsTotal: number,
  poidsBarre: number,
  disquesDisponibles: readonly number[] = DISQUES_STANDARDS
): RepartitionDisques {
  if (poidsTotal <= poidsBarre) {
    return {
      poidsTotal,
      poidsBarre,
      chargeParCote: 0,
      disques: [],
      reste: 0,
    }
  }

  const aRepartir = (poidsTotal - poidsBarre) / 2
  let reste = Math.round(aRepartir * 100) / 100
  const resultat: { poids: number; quantite: number }[] = []

  const disquesTries = [...disquesDisponibles].sort((a, b) => b - a)

  for (const d of disquesTries) {
    if (d <= 0) continue
    const qte = Math.floor(reste / d)
    if (qte > 0) {
      resultat.push({ poids: d, quantite: qte })
      reste = Math.round((reste - qte * d) * 100) / 100
    }
  }

  return {
    poidsTotal,
    poidsBarre,
    chargeParCote: aRepartir,
    disques: resultat,
    reste,
  }
}

/**
 * Détermine si un exercice est susceptible d'utiliser une barre ou une Smith machine.
 */
export function estBarreOuSmith(nomOuId: string): boolean {
  const t = nomOuId.toLowerCase()
  return (
    t.includes('barre') ||
    t.includes('smith') ||
    t.includes('guid') ||
    t.includes('squat') ||
    t.includes('terre') ||
    t.includes('hip thrust') ||
    t.includes('rdl') ||
    t.includes('rowing') ||
    t.includes('developpe') ||
    t.includes('développé')
  )
}
