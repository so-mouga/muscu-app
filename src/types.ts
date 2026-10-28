export type Muscle =
  | 'pecs'
  | 'dos'
  | 'epaule_arriere'
  | 'epaule_laterale'
  | 'triceps'
  | 'biceps'
  | 'quadriceps'
  | 'ischios'
  | 'mollets'
  | 'abdos'

export type ModeCharge = 'machine' | 'par_main' | 'poids_corps' | 'elastique'

export interface Exercice {
  id: string
  nom: string
  muscle: Muscle
  secondaires?: { muscle: Muscle; coef: number }[]
  type: 'compose' | 'isolation'
  mode: ModeCharge
  /** Pas de charge en kg (lest pour le poids du corps, 1 niveau pour l'élastique). */
  pas: number
  /** Charge maximale disponible (haltères fixes à la maison). */
  chargeMax?: number
  suivreE1rm: boolean
  notes?: string
  /** Créé par l'utilisateur (sinon : bibliothèque préchargée). */
  perso?: boolean
}

export interface SeriePlan {
  repsMin: number
  repsMax: number
  rpe: number
  /** Charge de départ propre à la série (sinon `ExoPlan.charge`). */
  charge?: number
}

export interface ExoPlan {
  exoId: string
  repos: number // secondes
  series: SeriePlan[]
  /** Liste cochable de chauffes : "25×8", ou texte libre "1 série facile de 4–5 reps". */
  chauffes: string[]
  finisseur: boolean
  /** Charge de départ (null = à calibrer). */
  charge: number | null
  optionnel?: boolean
  note?: string
}

export interface SeanceModele {
  id: string
  nom: string
  sousTitre: string
  /** 1 = lundi … 7 = dimanche */
  jour?: number
  varianteDe?: string
  exercices: ExoPlan[]
  /** Séance préchargée masquée par l'utilisateur. */
  supprime?: boolean
}

/** Un programme regroupe des séances (de la bibliothèque) et leur planning. */
export interface Programme {
  id: string
  nom: string
  description?: string
  seances: { modeleId: string; /** 1 = lundi … 7 = dimanche */ jour?: number }[]
}

export type TypeSerie = 'normale' | 'echec' | 'serie_longue' | 'drop' | 'rest_pause'
export type ZoneDemiReps = 'etiree' | 'milieu' | 'contractee'

export interface Serie {
  id: string
  exoId: string
  type: TypeSerie
  /** Charge machine, par main, lest (poids du corps) ou niveau (élastique). */
  charge: number
  reps: number
  rpe: number
  rpeCible?: number
  repsMin?: number
  repsMax?: number
  demiReps?: number
  zone?: ZoneDemiReps
  note?: string
  douleur?: boolean
  heure: number
}

export interface Seance {
  id: string
  /** AAAA-MM-JJ */
  date: string
  modeleId?: string
  nom: string
  sousTitre?: string
  /** Plan du jour, copié du modèle au démarrage puis modifiable sans toucher au modèle. */
  exercices: ExoPlan[]
  debut: number
  fin?: number
  enCours: boolean
  poidsCorps?: number
  /** clé : `${exoId}:${index}` */
  chauffes: Record<string, boolean>
  series: Serie[]
  notes: Record<string, string>
  /** Séries ajoutées (+) ou retirées (−) par rapport au modèle, pour aujourd'hui. */
  ajustSeries: Record<string, number>
  ressenti?: number
  energie?: number
}

export interface Pesee {
  date: string
  poids: number
}

export interface Reglage {
  cle: string
  valeur: unknown
}
