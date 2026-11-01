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
 * Détermine si un exercice utilise une barre, une Smith machine ou des disques libres.
 * Exclut explicitement les machines à pile, poulies, haltères et poids de corps.
 */
export function estBarreOuSmith(nomOuId: string): boolean {
  const t = nomOuId.toLowerCase()
  if (
    t.includes('poulie') ||
    t.includes('halt') ||
    t.includes('elast') ||
    t.includes('élast') ||
    t.includes('corps') ||
    t.includes('butterfly') ||
    t.includes('tirage') ||
    t.includes('cable') ||
    t.includes('câble')
  ) {
    return false
  }
  if (t.includes('machine') && !t.includes('plaques') && !t.includes('smith') && !t.includes('guid')) {
    return false
  }
  return (
    t.includes('barre') ||
    t.includes('smith') ||
    t.includes('guid') ||
    t.includes('plaques') ||
    t.includes('presse') ||
    t.includes('squat') ||
    t.includes('terre') ||
    t.includes('hip thrust') ||
    (t.includes('rdl') && !t.includes('haltere')) ||
    (t.includes('rowing') && !t.includes('poulie') && !t.includes('machine')) ||
    ((t.includes('developpe') || t.includes('développé')) && !t.includes('machine') && !t.includes('haltere'))
  )
}
