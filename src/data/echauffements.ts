import type { Exercice, Muscle, SeanceModele } from '../types'

/** Mouvement d'échauffement général (mobilité, cardio léger), fait avant la séance. */
export interface MouvementEchauffement {
  id: string
  nom: string
  /** « 10 par sens », « 3 min » : valeur fixe, juste à cocher. */
  quantite: string
  /** Durée approximative, en secondes (pour le total affiché). */
  duree: number
  zone: 'general' | 'haut' | 'bas'
  consignes: string[]
  /** Ajouté par l'utilisateur (réglage `echauffementsPerso`). */
  perso?: boolean
}

export const MOUVEMENTS: MouvementEchauffement[] = [
  { id: 'cardio', nom: 'Vélo, rameur ou corde', quantite: '3 min tranquille', duree: 180, zone: 'general', consignes: ['Rythme facile : tu dois pouvoir parler.', 'Le but est de monter un peu le cardio et la température, pas de te fatiguer.'] },
  { id: 'jumping', nom: 'Jumping jacks', quantite: '30 s', duree: 30, zone: 'general', consignes: ['Saute en écartant bras et jambes, puis reviens.', 'Atterris souplement sur l’avant du pied.'] },
  { id: 'moulinets', nom: 'Moulinets de bras', quantite: '10 par sens', duree: 40, zone: 'haut', consignes: ['Bras tendus sur les côtés, fais de grands cercles.', 'Commence petit, agrandis petit à petit.', '10 vers l’avant, puis 10 vers l’arrière.'] },
  { id: 'passages', nom: 'Passages d’épaules (élastique ou bâton)', quantite: '10', duree: 40, zone: 'haut', consignes: ['Tiens l’élastique mains larges, bras tendus devant toi.', 'Passe-le au-dessus de la tête jusque derrière toi, puis reviens.', 'Si ça tire trop, écarte davantage les mains.'] },
  { id: 'ecartes_elastique', nom: 'Écartés à l’élastique', quantite: '15', duree: 40, zone: 'haut', consignes: ['Bras tendus devant toi à hauteur d’épaules.', 'Écarte jusqu’à toucher la poitrine avec l’élastique, en serrant les omoplates.'] },
  { id: 'rotations_externes', nom: 'Rotations externes à l’élastique', quantite: '12 par bras', duree: 60, zone: 'haut', consignes: ['Coude collé au corps, plié à 90°.', 'Tourne l’avant-bras vers l’extérieur sans décoller le coude.', 'Léger : c’est pour réveiller l’épaule.'] },
  { id: 'thoracique', nom: 'Rotations du haut du dos', quantite: '8 par côté', duree: 60, zone: 'haut', consignes: ['À quatre pattes, une main derrière la tête.', 'Ouvre le coude vers le plafond en suivant du regard, puis referme.'] },
  { id: 'chat_vache', nom: 'Chat-vache', quantite: '8 lents', duree: 40, zone: 'haut', consignes: ['À quatre pattes : arrondis le dos en rentrant le menton.', 'Puis creuse le dos en regardant devant toi.'] },
  { id: 'pompes_scapulaires', nom: 'Pompes scapulaires', quantite: '10', duree: 30, zone: 'haut', consignes: ['En planche bras tendus, sans plier les coudes.', 'Rapproche puis écarte les omoplates : le corps monte et descend de quelques centimètres.'] },
  { id: 'balances_jambes', nom: 'Balancés de jambes', quantite: '10 par jambe', duree: 60, zone: 'bas', consignes: ['Une main sur un appui, balance la jambe d’avant en arrière.', 'Puis de gauche à droite devant toi.', 'Amplitude progressive, sans forcer.'] },
  { id: 'squat_tenu', nom: 'Squat profond tenu', quantite: '30 s', duree: 30, zone: 'bas', consignes: ['Descends le plus bas possible, talons au sol.', 'Pousse les genoux vers l’extérieur avec les coudes.', 'Garde le buste droit et respire.'] },
  { id: 'fentes_rotation', nom: 'Fentes avec rotation', quantite: '6 par jambe', duree: 60, zone: 'bas', consignes: ['Grand pas en avant, descends en fente.', 'Tourne le buste du côté de la jambe avant, puis reviens.'] },
  { id: 'pont_fessier', nom: 'Pont fessier', quantite: '15', duree: 40, zone: 'bas', consignes: ['Allongé, pieds à plat, genoux pliés.', 'Monte le bassin en serrant les fessiers, marque 1 s en haut.'] },
  { id: 'chevilles', nom: 'Genou au mur (chevilles)', quantite: '10 par jambe', duree: 60, zone: 'bas', consignes: ['Pied à une main du mur, talon au sol.', 'Avance le genou vers le mur sans décoller le talon, puis reviens.'] },
  { id: 'hanches_9090', nom: '90/90 des hanches', quantite: '6 par côté', duree: 60, zone: 'bas', consignes: ['Assis, une jambe devant et une sur le côté, genoux pliés à 90°.', 'Bascule les deux genoux de l’autre côté, buste droit.'] },
]

/** `liste` : la bibliothèque et les mouvements ajoutés par l'utilisateur. */
export const mouvement = (id: string, liste = MOUVEMENTS) => liste.find((m) => m.id === id)

const HAUT: Muscle[] = ['pecs', 'dos', 'trapezes', 'epaule_avant', 'epaule_laterale', 'epaule_arriere', 'biceps', 'triceps', 'avant_bras']
const BAS: Muscle[] = ['quadriceps', 'ischios', 'fessiers', 'adducteurs', 'mollets', 'lombaires']

/**
 * Échauffement proposé d'après les muscles principaux des exercices de la séance (les abdos ne
 * comptent pas) : haut du corps, bas du corps ou mixte, 6 à 7 mouvements, environ 6-8 min.
 */
export function echauffementAuto(muscles: Muscle[]): string[] {
  const haut = muscles.filter((m) => HAUT.includes(m)).length
  const bas = muscles.filter((m) => BAS.includes(m)).length
  const total = haut + bas
  if (total && bas / total < 0.25) return ['cardio', 'moulinets', 'passages', 'ecartes_elastique', 'rotations_externes', 'thoracique']
  if (total && haut / total < 0.25) return ['cardio', 'balances_jambes', 'chevilles', 'hanches_9090', 'pont_fessier', 'fentes_rotation', 'squat_tenu']
  return ['cardio', 'moulinets', 'passages', 'balances_jambes', 'fentes_rotation', 'squat_tenu']
}

/** Mouvements prévus pour une séance, selon son réglage. */
export function echauffementDe(m: SeanceModele, exo: (id: string) => Exercice): string[] {
  if (m.echauffement === 'aucun') return []
  if (Array.isArray(m.echauffement)) return m.echauffement
  return echauffementAuto(m.exercices.map((p) => exo(p.exoId).muscle))
}

/** Durée totale approximative, en secondes. */
export const dureeEchauffement = (ids: string[], liste = MOUVEMENTS) => ids.reduce((a, id) => a + (mouvement(id, liste)?.duree ?? 0), 0)
