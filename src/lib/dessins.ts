import { MOUVEMENTS } from '../data/echauffements'
import { EXERCICES } from '../data/exercices'
import { PROGRAMMES_TYPES } from '../data/programmesTypes'
import { srcDessin } from '../components/Dessin'

/** Photo prise ou choisie par la personne (data URL), par opposition à un dessin livré avec l'appli. */
export const estPhotoPerso = (image?: string) => !!image && /^(data:|blob:)/.test(image)

/**
 * Image d'une version modifiée d'un exercice de base : la photo de la personne reste la sienne ;
 * sinon, le dessin de l'exercice de base, même si la copie a été enregistrée avant qu'il existe,
 * ou avec un ancien dessin depuis remplacé. Retirer sa photo fait donc revenir le dessin.
 */
export const imageDeCopie = (copie?: string, base?: string) => (estPhotoPerso(copie) ? copie : base)

/** Tous les dessins livrés avec l'appli (`public/dessins`) : exercices de base, échauffements, circuits des programmes tout prêts. */
export function dessinsLivres(): string[] {
  const images = [
    ...Object.values(EXERCICES).map((e) => e.image),
    ...MOUVEMENTS.map((m) => m.image),
    ...PROGRAMMES_TYPES.flatMap((p) => p.seances.flatMap((s) => (s.circuits ?? []).flatMap((c) => c.mouvements.map((m) => m.image)))),
  ]
  return [...new Set(images.filter((i): i is string => !!i && !estPhotoPerso(i)).map(srcDessin))]
}

/**
 * Demande les dessins une fois, peu après l'ouverture : le service worker les garde, et ils s'affichent
 * ensuite sans réseau (à la salle). La liste vient des données : un dessin ajouté à un exercice y entre seul.
 * Un échec ne gêne rien.
 */
export function prechargerDessins() {
  setTimeout(() => {
    for (const src of dessinsLivres()) new Image().src = src
  }, 4000)
}
