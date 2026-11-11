import type { Phase } from './objectifs'

/** Réglage du parcours de démarrage ; sa présence dit que la personne a commencé par ce parcours. */
export const CLE_DEMARRAGE = 'demarrage'

/**
 * Personne qui n'a encore choisi aucun programme. Quelqu'un qui a déjà des séances sans programme
 * enregistré (ancienne version) garde le programme de départ : il ne doit pas perdre son planning.
 */
export const estSansProgramme = (nbProgrammes: number, nbCycles: number, nbSeances: number, demarrageVu: boolean, seanceDeBaseModifiee: boolean) =>
  nbProgrammes === 0 && nbCycles === 0 && !seanceDeBaseModifiee && (nbSeances === 0 || demarrageVu)

export type Etape = 'objectif' | 'ouEnEs' | 'jours' | 'proposition' | 'autres' | 'mien'
export type Objectif = Phase | 'aucun'
export type Niveau = 'debut' | 'regulier' | 'mien'

export interface EtatDemarrage {
  etape: Etape
  /** Étapes précédentes, pour le bouton retour. */
  pile: Etape[]
  objectif?: Objectif
  niveau?: Niveau
  /** Jours choisis : 1 = lundi … 7 = dimanche. */
  jours: number[]
  /** Programme pris dans la liste plutôt que celui proposé. */
  choisi?: string
  /** A quitté le parcours (croix) : il ne revient plus de lui-même. */
  quitte?: boolean
  /** Date où le programme a été pris : la 1re semaine ne compte que les jours restants. */
  installeLe?: string
}

export const NOMS_JOURS = ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']

const ecart = (de: number, a: number) => (a - de + 7) % 7
const ecarts = (j: number[]) => j.map((d, i) => ecart(d, j[(i + 1) % j.length]) || 7)

function combinaisons(l: number[], k: number): number[][] {
  if (k === 0) return [[]]
  return l.flatMap((x, i) => combinaisons(l.slice(i + 1), k - 1).map((r) => [x, ...r]))
}

/** Le plus grand repos minimum, puis le moins de jours à la suite, puis le moins grand trou. */
function note(j: number[]): number[] {
  const e = ecarts(j)
  let suite = 0
  let plus = 0
  for (const x of [...e, ...e]) {
    suite = x === 1 ? suite + 1 : 0
    plus = Math.max(plus, suite)
  }
  return [Math.min(...e), -plus, -Math.max(...e)]
}
const meilleur = (a: number[], b: number[]) => {
  const [x, y] = [note(a), note(b)]
  const i = x.findIndex((v, n) => v !== y[n])
  return i >= 0 && x[i] > y[i]
}

/** `k` jours les mieux répartis : pris dans ceux choisis, complétés s'il en manque ; sans choix, ceux du programme. */
export function joursRepartis(choisis: number[], k: number, duProgramme: number[]): number[] {
  if (!choisis.length) return [...duProgramme].sort((a, b) => a - b)
  const pris = [...choisis].sort((a, b) => a - b)
  const possibles = pris.length >= k ? combinaisons(pris, k) : combinaisons([1, 2, 3, 4, 5, 6, 7], k).filter((c) => pris.every((d) => c.includes(d)))
  return possibles.reduce((m, c) => (meilleur(c, m) ? c : m))
}

/** Jours dans l'ordre des séances : la 1re séance tombe sur le prochain jour, aujourd'hui compris. */
export const ordreDesJours = (jours: number[], aujourdhui: number) => jours.map((jour) => ({ jour, dans: ecart(aujourdhui, jour) })).sort((a, b) => a.dans - b.dans)

export const quand = (dans: number, jour: number) => (dans === 0 ? 'aujourd’hui' : dans === 1 ? 'demain' : NOMS_JOURS[jour])

/** Des jours se suivent : un jour de repos entre deux séances complètes aiderait à récupérer. */
export const seSuivent = (jours: number[]) => ecarts([...jours].sort((a, b) => a - b)).includes(1)

/** Programme proposé : 2 jours, 3 jours (ou 3 pour bien démarrer), sinon haut / bas. */
export function recommande(nbJours: number, niveau?: Niveau): string {
  if (nbJours === 2) return 'full_body_2'
  if (nbJours === 3 || niveau === 'debut') return 'full_body_3'
  return 'haut_bas_4'
}

/** Ce que la réponse à « Qu'est-ce que tu vises ? » change : dit sur la proposition, sinon la question ressemble à un sondage. Rien sans objectif. */
export function pourObjectif(objectif?: Objectif): string | null {
  if (objectif === 'seche') return 'Tu veux perdre du gras : la muscu garde ton muscle, l’assiette fait la perte. Note ton poids le matin, Cran te dira si le rythme est bon.'
  if (objectif === 'prise') return 'Tu veux prendre du muscle : chaque muscle y travaille assez souvent pour ça. Note ton poids le matin, Cran te dira si le rythme est bon.'
  if (objectif === 'maintien') return 'Tu veux progresser à poids stable : tes charges et tes reps diront si ça avance.'
  return null
}

/** Pourquoi ce programme, avec le nombre de jours donné. */
export function pourquoi(id: string, nbJours: number): string {
  if (id === 'full_body_2') return 'Avec 2 jours, le mieux est de travailler tout le corps à chaque séance. Tu progresseras, un peu moins vite qu’avec 3.'
  if (id === 'full_body_3' && nbJours === 3) return '3 jours, c’est le bon rythme pour travailler tout le corps à chaque séance.'
  if (id === 'full_body_3') return `Tu as ${nbJours} jours, mais pour débuter 3 suffisent : ton corps récupère et tu apprends les mouvements. Tu passeras à 4 quand tu voudras.`
  if (nbJours > 4) return `Tu as ${nbJours} jours, mais 4 séances suffisent pour progresser. Les autres jours : repos, ou une séance en plus si tu en as envie.`
  return 'Tu t’entraînes déjà et tu as 4 jours : on alterne haut et bas du corps pour travailler chaque muscle deux fois par semaine.'
}
