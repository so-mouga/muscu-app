import { objectifsA, phaseA, type EtapeObjectifs, type Phase } from './objectifs'

/** Réglage du profil (saisi une fois dans Réglages). Le poids vient des pesées. */
export const CLE_PROFIL = 'profil'

export type Activite = 'assis' | 'debout' | 'physique'

export interface Profil {
  /** cm */
  taille?: number
  naissance?: number
  sexe?: 'h' | 'f'
  /** Activité hors salle. */
  activite?: Activite
}

export const ACTIVITES: { id: Activite; nom: string; detail: string; facteur: number }[] = [
  { id: 'assis', nom: 'Assis', detail: 'bureau, peu de marche', facteur: 1.2 },
  { id: 'debout', nom: 'Debout', detail: 'souvent debout, marche régulière', facteur: 1.35 },
  { id: 'physique', nom: 'Physique', detail: 'métier qui bouge beaucoup', facteur: 1.5 },
]

/** Ajustement selon la phase : déficit modéré en sèche, léger surplus en prise. */
export const AJUSTEMENT: Record<Phase, number> = { seche: -0.15, maintien: 0, prise: 0.1 }

export const profilComplet = (p?: Profil): p is Required<Profil> => !!(p?.taille && p.naissance && p.sexe && p.activite)

/** Dépense au repos (Mifflin-St Jeor), en kcal. */
export function metabolismeBase(poids: number, p: Required<Profil>, annee = new Date().getFullYear()): number {
  return 10 * poids + 6.25 * p.taille - 5 * (annee - p.naissance) + (p.sexe === 'h' ? 5 : -161)
}

/**
 * Objectif calories du jour : dépense au repos × activité (hors salle, plus 0,05 par séance prévue
 * dans la semaine), ajusté selon la phase, arrondi à 50 kcal. Protéines : 2 g/kg (2,2 en sèche).
 */
export function objectifCalories(poids: number, p: Required<Profil>, phase: Phase | undefined, seancesParSemaine: number, annee?: number) {
  const facteur = ACTIVITES.find((a) => a.id === p.activite)!.facteur + 0.05 * Math.min(seancesParSemaine, 6)
  const maintien = metabolismeBase(poids, p, annee) * facteur
  const kcal = Math.round((maintien * (1 + (phase ? AJUSTEMENT[phase] : 0))) / 50) * 50
  return { kcal, maintien: Math.round(maintien / 50) * 50, proteines: Math.round(poids * (phase === 'seche' ? 2.2 : 2)) }
}

/**
 * Objectif calories d'une date : celui fixé à la main dans les objectifs, sinon le calcul (profil
 * complet et poids connu), sinon null.
 */
export function objectifDuJour(frise: EtapeObjectifs[], date: string, profil: Profil | undefined, poids: number | undefined, seancesParSemaine: number) {
  const phase = phaseA(frise, date)?.phase
  const manuel = objectifsA(frise, date)?.calories
  const calcul = poids && profilComplet(profil) ? objectifCalories(poids, profil, phase, seancesParSemaine, Number(date.slice(0, 4))) : null
  if (manuel) return { kcal: manuel, proteines: calcul?.proteines ?? (poids ? Math.round(poids * 2) : null), maintien: calcul?.maintien ?? null, manuel: true as const, phase }
  return calcul && { ...calcul, manuel: false as const, phase }
}
