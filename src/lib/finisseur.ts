import type { ExoPlan, TypeFinisseur, TypeSerie, ZoneDemiReps } from '../types'

export interface InfoFinisseur {
  nom: string
  /** Rappel affiché en séance. */
  court: string
  /** Explication complète (création de séance, aide). */
  aide: string
  typeSerie: TypeSerie
}

export const FINISSEURS: Record<TypeFinisseur, InfoFinisseur> = {
  partielles: {
    nom: 'Répétitions partielles',
    court: 'échec, puis 5–8 demi-reps sans reposer la charge',
    aide: 'Va jusqu’à l’échec, puis enchaîne 5 à 8 demi-répétitions (amplitude réduite) sans poser la charge. En position étirée, c’est le plus efficace pour la prise de muscle.',
    typeSerie: 'serie_longue',
  },
  drop: {
    nom: 'Drop set',
    court: 'échec, baisse la charge d’environ 25 %, repars jusqu’à l’échec',
    aide: 'Va jusqu’à l’échec, baisse immédiatement la charge d’environ 25 % (goupille ou haltères plus légers) et repars jusqu’à l’échec, sans repos. Idéal sur machine ou poulie.',
    typeSerie: 'drop',
  },
  rest_pause: {
    nom: 'Rest-pause',
    court: 'échec, 15 s de pause, repars ; deux fois',
    aide: 'Va jusqu’à l’échec, pose la charge 10 à 20 secondes (respire), puis refais autant de reps que possible avec la même charge. Recommence une deuxième fois.',
    typeSerie: 'rest_pause',
  },
  echec: {
    nom: 'Jusqu’à l’échec',
    court: 'jusqu’à ne plus pouvoir faire une rep propre',
    aide: 'La dernière série est poussée jusqu’à l’échec technique : tu arrêtes quand la rep suivante ne passerait plus proprement. Pas de technique en plus.',
    typeSerie: 'echec',
  },
}

export const ZONES: [ZoneDemiReps, string][] = [
  ['etiree', 'étirée'],
  ['milieu', 'milieu'],
  ['contractee', 'contractée'],
]

export const typeFinisseur = (p: ExoPlan): TypeFinisseur => p.typeFinisseur ?? 'partielles'

/** Charge après la baisse d'un drop set : les trois quarts, au palier de la machine. */
export const chargeBaisse = (charge: number, pas: number) => Math.max(0, Math.round((charge * 0.75) / pas) * pas)

/**
 * Ce qu'il faut faire sur un finisseur, en une phrase, dite AVANT la série (repos, annonce, saisie) : apprise après
 * l'appui, elle arrive trop tard (retour du cousin de l'utilisateur, 11 nov. 2026). `baisse` : la charge après la
 * baisse d'un drop set, déjà écrite (« 15 kg »).
 */
export function consigne(tf: TypeFinisseur, baisse?: string): string {
  if (tf === 'drop') return `Va jusqu’à l’échec, ${baisse ? `baisse à ${baisse}` : 'baisse la charge d’un quart'} et repars tout de suite, sans repos.`
  if (tf === 'rest_pause') return 'Va jusqu’à l’échec, pose la charge 15 secondes, repars. Deux fois.'
  if (tf === 'partielles') return 'Va jusqu’à l’échec, puis enchaîne 5 à 8 demi-reps sans poser la charge.'
  return 'Continue jusqu’à ne plus pouvoir faire une rep propre.'
}
