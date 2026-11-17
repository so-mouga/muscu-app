/** Dessins livrés avec l'appli (`public/dessins`), pour la séance « Force et circuits ». */
const DESSINS = ['brasjambe', 'chat', 'chevilles', 'elevations', 'genoux', 'hanches', 'menton', 'planche', 'presse', 'quadri', 'rowing', 'situps', 'souleve', 'swings', 'thrusters', 'tirage', 'triceps']

/**
 * Demande les dessins une fois, peu après l'ouverture : le service worker les garde, et ils s'affichent
 * ensuite sans réseau (à la salle). Environ 120 Ko en tout ; un échec ne gêne rien.
 */
export function prechargerDessins() {
  setTimeout(() => {
    for (const nom of DESSINS) new Image().src = `${import.meta.env.BASE_URL}dessins/${nom}.jpg`
  }, 4000)
}
