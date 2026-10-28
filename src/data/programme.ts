import type { ExoPlan, SeanceModele, SeriePlan } from '../types'

/** n séries identiques, ou une liste de RPE série par série. */
function s(repsMin: number, repsMax: number, rpes: number[]): SeriePlan[] {
  return rpes.map((rpe) => ({ repsMin, repsMax, rpe }))
}

function exo(exoId: string, repos: number, series: SeriePlan[], charge: number | null, extra: Partial<ExoPlan> = {}): ExoPlan {
  return { exoId, repos, series, charge, chauffes: [], finisseur: false, ...extra }
}

export const PROGRAMME: SeanceModele[] = [
  {
    id: 'haut_a',
    nom: 'Haut A',
    sousTitre: 'pecs prioritaire',
    jour: 1,
    exercices: [
      exo(
        'smith_incline',
        180,
        [
          { repsMin: 8, repsMax: 10, rpe: 7, charge: 50 },
          { repsMin: 8, repsMax: 10, rpe: 8, charge: 52.5 },
          { repsMin: 8, repsMax: 10, rpe: 8, charge: 52.5 },
        ],
        52.5,
        { chauffes: ['25×8', '35×4', '45×2'] }
      ),
      exo('tirage_large', 180, s(10, 12, [8, 8, 8]), 67, { chauffes: ['40×8'] }),
      exo('butterfly', 150, s(12, 15, [8, 8, 9, 10]), 30, { finisseur: true }),
      exo('tirage_horizontal', 180, s(10, 10, [8, 8, 8]), 65),
      exo('elevation_poulie', 150, s(12, 15, [9, 9, 9]), 15),
      exo('triceps_un_bras', 150, s(12, 13, [9, 9]), 41),
    ],
  },
  {
    id: 'bas',
    nom: 'Bas',
    sousTitre: 'maintien',
    jour: 2,
    exercices: [
      exo('presse', 180, s(8, 10, [7, 8, 8]), 67, { chauffes: ['30×10', '45×5'] }),
      exo('rdl', 180, s(10, 10, [8, 8, 8]), 60, { chauffes: ['30×8', '45×4'] }),
      exo('curl_jambe_assis', 150, s(11, 11, [8, 8, 8]), 75),
      exo('extension_jambes', 150, s(12, 12, [8, 8]), 70),
      exo('mollets_machine', 90, s(12, 12, [8, 8, 8]), null, { note: 'Léger. La 1re série légère sert de chauffe (note-la sous RPE 7, elle ne comptera pas).' }),
      exo('releve_genoux', 90, s(12, 12, [9, 9, 9]), 0),
    ],
  },
  {
    id: 'haut_b',
    nom: 'Haut B',
    sousTitre: 'dos + 2e passage pecs',
    jour: 3,
    exercices: [
      exo('tractions', 180, s(8, 12, [8, 8, 8]), 0, { chauffes: ['1 série facile de 4–5 reps'] }),
      exo('super_row', 180, s(10, 12, [8, 8, 8]), 70, { chauffes: ['40×8'] }),
      exo('incline_machine', 180, s(10, 12, [8, 8, 8]), 71, { chauffes: ['35×8', '50×4'] }),
      exo('bras_tendus', 150, s(12, 15, [8, 9, 10]), 40, { finisseur: true }),
      exo('face_pull', 120, s(15, 15, [8, 8, 8]), null, { optionnel: true, note: 'Optionnel, 2 à 3 séries.' }),
      exo('elevation_machine', 120, s(12, 15, [9, 9, 9]), null),
      exo('curl_araignee', 150, s(10, 10, [9, 9, 10]), 20, { finisseur: true }),
    ],
  },
  {
    id: 'haut_c',
    nom: 'Haut C',
    sousTitre: 'pecs en volume + bras',
    jour: 5,
    exercices: [
      exo('dips', 180, s(8, 12, [8, 8, 8]), 0, { chauffes: ['1 série légère de 6 reps'] }),
      exo('butterfly_haut', 150, s(12, 15, [8, 9, 10]), null, { finisseur: true }),
      exo('tirage_vertical_v', 180, s(10, 12, [8, 8, 8]), 60, { chauffes: ['40×8'] }),
      exo('oiseau', 120, s(15, 15, [9, 9]), null),
      exo('triceps_tete', 150, s(12, 12, [9, 9, 9]), null),
      exo('curl_marteau', 150, s(12, 12, [9, 9, 9]), 45),
    ],
  },
  {
    id: 'bas_maison',
    nom: 'Bas — maison',
    sousTitre: 'banc, haltères 24 kg, élastiques',
    varianteDe: 'bas',
    exercices: [
      exo('squat_bulgare', 120, s(8, 10, [8, 8, 8]), 24),
      exo('rdl_halteres', 150, s(10, 12, [8, 8, 8]), 24),
      exo('extension_elastique', 90, s(15, 20, [9, 9]), 1),
      exo('curl_elastique', 90, s(15, 15, [9, 9]), 1),
      exo('mollets_haltere', 90, s(12, 15, [8, 8, 8]), 24),
      exo('releve_jambes_banc', 90, s(12, 12, [9, 9, 9]), 0),
    ],
  },
]

export const MODELES: Record<string, SeanceModele> = Object.fromEntries(PROGRAMME.map((m) => [m.id, m]))
