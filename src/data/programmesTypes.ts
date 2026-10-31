import type { ExoPlan, SeanceModele, SeriePlan } from '../types'
import { PROGRAMME } from './programme'

/**
 * Programmes tout prêts, proposés à un nouvel utilisateur (Accueil) et dans l'onglet Programmes.
 * Charges à calibrer (null) : la 1re séance sert à trouver la bonne charge. Volume de chaque muscle
 * dans la zone utile (vérifié par un test). Choisir un programme copie ses séances chez l'utilisateur.
 */
export interface ProgrammeType {
  id: string
  nom: string
  /** « Débutant · 3 séances par semaine » */
  pour: string
  description: string
  seances: SeanceModele[]
  /** Séances déjà dans la bibliothèque de base : pas de copie, le programme pointe vers elles. */
  deBase?: boolean
}

const s = (n: number, repsMin: number, repsMax: number, rpe = 8): SeriePlan[] => Array.from({ length: n }, () => ({ repsMin, repsMax, rpe }))
const exo = (exoId: string, repos: number, series: SeriePlan[]): ExoPlan => ({ exoId, repos, series, charge: null, chauffes: [], finisseur: false })
const seance = (id: string, nom: string, sousTitre: string, jour: number, exercices: ExoPlan[]): SeanceModele => ({ id, nom, sousTitre, jour, exercices })

export const PROGRAMMES_TYPES: ProgrammeType[] = [
  {
    id: 'full_body_3',
    nom: 'Full body 3 jours',
    pour: 'Débutant · 3 séances par semaine',
    description: 'Tout le corps à chaque séance, surtout des machines et des haltères : simple à apprendre, idéal pour démarrer ou reprendre.',
    seances: [
      seance('fb_a', 'Full body A', 'presse, développé couché', 1, [
        exo('presse', 150, s(3, 10, 12, 7)),
        exo('dev_couche_halteres', 150, s(3, 8, 12, 7)),
        exo('tirage_large', 150, s(3, 10, 12, 7)),
        exo('elevation_laterale_halteres', 90, s(3, 12, 15)),
        exo('curl_jambe_assis', 90, s(3, 10, 15)),
        exo('extension_corde', 90, s(2, 10, 15)),
      ]),
      seance('fb_b', 'Full body B', 'soulevé de terre roumain, incliné', 3, [
        exo('rdl_halteres', 150, s(3, 8, 12, 7)),
        exo('incline_machine', 150, s(3, 8, 12, 7)),
        exo('rowing_machine', 150, s(3, 10, 12, 7)),
        exo('extension_jambes', 90, s(4, 10, 15)),
        exo('elevation_poulie', 90, s(3, 12, 15)),
        exo('curl_halteres', 90, s(3, 10, 12)),
      ]),
      seance('fb_c', 'Full body C', 'goblet squat, rowing', 5, [
        exo('goblet_squat', 150, s(3, 10, 12, 7)),
        exo('dev_couche_machine', 150, s(4, 8, 12, 7)),
        exo('tirage_horizontal', 150, s(4, 10, 12, 7)),
        exo('curl_jambe_assis', 90, s(2, 10, 15)),
        exo('elevation_machine', 90, s(2, 12, 15)),
        exo('face_pull', 90, s(2, 12, 15)),
        exo('mollets_machine', 90, s(3, 10, 15)),
      ]),
    ],
  },
  {
    id: 'haut_bas_4',
    nom: 'Haut / Bas 4 jours',
    pour: 'Avec un peu d’expérience · 4 séances par semaine',
    description: 'Deux séances haut du corps et deux bas du corps : plus de volume par muscle, avec les grands mouvements à la barre.',
    seances: [
      seance('hb_haut1', 'Haut 1', 'développé couché, tirage', 1, [
        exo('dev_couche_barre', 180, s(3, 6, 10, 7)),
        exo('tirage_large', 150, s(3, 8, 12)),
        exo('dev_epaules_halteres', 150, s(3, 8, 12)),
        exo('rowing_haltere', 150, s(3, 8, 12)),
        exo('elevation_laterale_halteres', 90, s(3, 12, 15)),
        exo('extension_corde', 90, s(2, 10, 15)),
        exo('curl_halteres', 90, s(2, 10, 12)),
      ]),
      seance('hb_bas1', 'Bas 1', 'squat, soulevé de terre roumain', 2, [
        exo('squat_barre', 180, s(3, 6, 10, 7)),
        exo('rdl', 180, s(3, 8, 10, 7)),
        exo('extension_jambes', 90, s(3, 10, 15)),
        exo('curl_jambe_assis', 90, s(3, 10, 15)),
        exo('mollets_debout', 90, s(3, 10, 15)),
        exo('crunch_poulie', 90, s(3, 10, 15)),
      ]),
      seance('hb_haut2', 'Haut 2', 'incliné, rowing', 4, [
        exo('dev_incline_halteres', 150, s(4, 8, 12)),
        exo('tirage_horizontal', 150, s(3, 8, 12)),
        exo('ecarte_poulie', 90, s(3, 12, 15)),
        exo('tractions_assistees', 150, s(3, 6, 10)),
        exo('elevation_poulie', 90, s(4, 12, 15)),
        exo('triceps_tete', 90, s(2, 10, 15)),
        exo('curl_marteau_halteres', 90, s(2, 10, 12)),
      ]),
      seance('hb_bas2', 'Bas 2', 'presse, hip thrust', 5, [
        exo('presse', 150, s(3, 10, 12)),
        exo('hip_thrust_barre', 150, s(3, 8, 12)),
        exo('fentes_halteres', 120, s(2, 10, 12)),
        exo('curl_jambe_allonge', 90, s(3, 10, 15)),
        exo('mollets_assis', 90, s(3, 12, 15)),
        exo('releve_genoux', 90, s(3, 10, 15)),
      ]),
    ],
  },
  {
    id: 'recompo_4',
    nom: 'Recompo 4 jours',
    pour: 'Avancé · 4 séances par semaine',
    description: 'Haut du corps prioritaire (pecs, dos, épaules), jambes en entretien, finisseurs : pour qui connaît déjà ses charges.',
    seances: PROGRAMME,
    deBase: true,
  },
]
