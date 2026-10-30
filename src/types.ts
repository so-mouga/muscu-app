export type Muscle =
  | 'pecs'
  | 'dos'
  | 'trapezes'
  | 'lombaires'
  | 'epaule_avant'
  | 'epaule_laterale'
  | 'epaule_arriere'
  | 'biceps'
  | 'triceps'
  | 'avant_bras'
  | 'quadriceps'
  | 'ischios'
  | 'fessiers'
  | 'adducteurs'
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
  /** `temps` : chaque série se mesure en secondes tenues (gainage…) ; les champs « reps » contiennent alors des secondes. */
  mesure?: 'reps' | 'temps'
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
  /** Échauffement avant la séance : absent = proposé d'après les muscles, liste = choisi, `aucun`. */
  echauffement?: 'aucun' | string[]
}

/** Un programme regroupe des séances (de la bibliothèque) et leur planning. */
export interface Programme {
  id: string
  nom: string
  description?: string
  seances: { modeleId: string; /** 1 = lundi … 7 = dimanche */ jour?: number }[]
  /** Objectif de séries dures par semaine, par muscle (absent : valeurs par défaut de l'appli). */
  volume?: Partial<Record<Muscle, number>>
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
  /** Exercices sautés aujourd'hui (restent affichés, grisés ; le modèle ne change pas). */
  passes?: string[]
  /** Séries ajoutées (+) ou retirées (−) par rapport au modèle, pour aujourd'hui. */
  ajustSeries: Record<string, number>
  /** Objectifs fixés à la main en fin de séance pour la prochaine fois, par exercice. */
  objectifs?: Record<string, Objectif>
  ressenti?: number
  energie?: number
  /** Cycle et semaine du cycle au démarrage. */
  cycleId?: string
  semaine?: number
  /** Échauffement du jour (mouvements prévus et cochés) ; `fini` quand on l'a terminé ou passé. */
  echauffement?: { ids: string[]; faits: string[]; fini?: boolean }
  /** Séance de déload : allégée, et ignorée pour la progression (objectifs, records, « dernière fois »). */
  deload?: boolean
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

/** Prise de mensurations (cm). Clés : `taille`, ou `bras_g` / `bras_d` pour les mesures à deux côtés. */
export interface Mesure {
  date: string
  valeurs: Record<string, number>
}

/**
 * Cycle : un programme lancé à une date, pour un nombre de semaines, avec ses semaines de déload
 * et ses objectifs de volume. Il garde une copie du programme et de ses séances : modifier le
 * programme ensuite ne change pas le cycle, sauf si on le demande.
 */
export interface Cycle {
  id: string
  programmeId: string
  programme: Programme
  modeles: SeanceModele[]
  /** Lundi de la semaine 1 (AAAA-MM-JJ). */
  debut: string
  semaines: number
  /** Numéros des semaines de déload (1 = première). */
  deloads: number[]
  /** Lundis des semaines mises en pause (vacances, maladie) : elles ne comptent pas. */
  pauses: string[]
  /** Objectif de séries dures par semaine, par muscle. */
  volume: Partial<Record<Muscle, number>>
  /** Date de fin si le cycle a été terminé. */
  fin?: string
}

/** Autre sport de la journée (padel, course…), à côté des séances de muscu. */
export interface Activite {
  id: string
  date: string
  type: string
  /** minutes */
  duree: number
  /** Intensité ressentie, de 1 (très facile) à 10 (maximale). */
  intensite: number
  note?: string
}

export type Pose = 'face' | 'profil' | 'dos'

/** Photo de progression, gardée uniquement sur le téléphone (JPEG data URL). */
export interface PhotoCorps {
  id: string
  date: string
  pose: Pose
  image: string
}

export interface Reglage {
  cle: string
  valeur: unknown
}
