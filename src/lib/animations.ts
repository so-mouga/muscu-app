// Ce qui s'est déjà tracé depuis l'ouverture de l'appli : revenir sur une page ne rejoue rien.
const vus = new Set<string>()

/** Vrai la première fois qu'on voit ces données ; un chiffre qui change fait une nouvelle première fois. */
export function premiereFois(cle: string): boolean {
  if (vus.has(cle)) return false
  vus.add(cle)
  return true
}
