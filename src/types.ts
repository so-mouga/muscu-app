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
  /** Photo (data URL JPEG réduite), par exemple la machine ou le réglage. */
  image?: string
  /** Masqué de la bibliothèque ; l'historique garde son nom. */
  supprime?: boolean
}

export interface SeriePlan {
  repsMin: number
  repsMax: number
  rpe: number
  /** Charge de départ propre à la série (sinon `ExoPlan.charge`). */
  charge?: number
  /** Repos après cette série, en secondes (sinon `ExoPlan.repos`). */
  repos?: number
}

export interface ExoPlan {
  exoId: string
  /** Repos par défaut entre les séries, en secondes. */
  repos: number
  /** Repos après la dernière série, avant l'exercice suivant (sinon le repos de la série). */
  reposApres?: number
  series: SeriePlan[]
  /** Liste cochable de chauffes : "25×8", ou texte libre "1 série facile de 4–5 reps". */
  chauffes: string[]
  finisseur: boolean
  /** Technique du finisseur (défaut : partielles = échec puis demi-reps). */
  typeFinisseur?: TypeFinisseur
  /** Zone des demi-reps du finisseur « partielles » (défaut : étirée). */
  zone?: ZoneDemiReps
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
export type TypeFinisseur = 'partielles' | 'drop' | 'rest_pause' | 'echec'

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
  /** Drop set : charges baissées ; rest-pause : mini-séries après la pause. */
  suite?: { charge: number; reps: number }[]
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
  /** Exercice choisi comme « en cours » (« Faire maintenant », « Plus tard ») ; sinon déduit des séries. */
  courant?: string
  /** Séries ajoutées (+) ou retirées (−) par rapport au modèle, pour aujourd'hui. */
  ajustSeries: Record<string, number>
  /** Objectifs fixés à la main en fin de séance pour la prochaine fois, par exercice. */
  objectifs?: Record<string, Objectif>
  ressenti?: number
  energie?: number
}

export interface Objectif {
  /** Charge par série (null = à calibrer). */
  charges: (number | null)[]
  reps: number[]
}

export interface Pesee {
  date: string
  poids: number
}

export interface Reglage {
  cle: string
  valeur: unknown
}
