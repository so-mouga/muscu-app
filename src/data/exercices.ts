import type { Exercice, Muscle } from '../types'

const sec = (...m: [Muscle, number][]) => m.map(([muscle, coef]) => ({ muscle, coef }))
const pousseeHaut = sec(['triceps', 0.5], ['epaule_avant', 0.5])
const chainePost = sec(['fessiers', 0.5], ['lombaires', 0.5])
// Secondaires : seulement le triceps sur les poussées (objectifs de volume de l'utilisateur) et les
// muscles sans objectif ; pas de biceps sur les tirages, sinon l'objectif biceps serait faussé.

type Def = Omit<Exercice, 'suivreE1rm' | 'pas'> & { pas?: number; suivreE1rm?: boolean }
// Pas (palier) par défaut : 2 kg par haltère, 2,5 kg sinon ; machines à pile réglées à 5 kg une par une
// (pas les presses ni ce qui dépend de la salle). e1RM suivi pour les composés.
// `barre` : calculateur de disques réglé à la main, exercice par exercice (barre libre 20 kg, Smith 10 kg).
// Pas pour ce qui dépend de la salle (presses, hack squat, barres EZ fixes ou chargées) : l'utilisateur l'active.
const exo = (e: Def): Exercice => ({ pas: e.mode === 'par_main' ? 2 : e.mode === 'elastique' ? 1 : 2.5, suivreE1rm: e.type === 'compose' && e.mesure !== 'temps', ...e })

const liste: Exercice[] = [
  // --- Séances de départ (identifiants conservés : ils sont dans l'historique) ---
  { id: 'smith_incline', nom: 'Développé incliné Smith', muscle: 'pecs', secondaires: pousseeHaut, type: 'compose', mode: 'machine', barre: 10, pas: 2.5, suivreE1rm: true },
  { id: 'tirage_large', nom: 'Tirage vertical prise large', muscle: 'dos', type: 'compose', mode: 'machine', pas: 5, suivreE1rm: true },
  { id: 'butterfly', nom: 'Butterfly', muscle: 'pecs', type: 'isolation', mode: 'machine', pas: 5, suivreE1rm: false },
  { id: 'tirage_horizontal', nom: 'Tirage horizontal prise neutre', muscle: 'dos', type: 'compose', mode: 'machine', pas: 5, suivreE1rm: true },
  { id: 'elevation_poulie', nom: 'Élévation latérale poulie', muscle: 'epaule_laterale', type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
  { id: 'triceps_un_bras', nom: 'Extension triceps poulie un bras', muscle: 'triceps', type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
  { id: 'presse', nom: 'Presse à cuisses', muscle: 'quadriceps', secondaires: sec(['fessiers', 0.5]), type: 'compose', mode: 'machine', pas: 2.5, suivreE1rm: true },
  { id: 'rdl', nom: 'Soulevé de terre roumain barre', muscle: 'ischios', secondaires: chainePost, type: 'compose', mode: 'machine', barre: 20, pas: 2.5, suivreE1rm: true },
  { id: 'curl_jambe_assis', nom: 'Curl jambe assis', muscle: 'ischios', type: 'isolation', mode: 'machine', pas: 5, suivreE1rm: false },
  { id: 'extension_jambes', nom: 'Extension de jambes', muscle: 'quadriceps', type: 'isolation', mode: 'machine', pas: 5, suivreE1rm: false },
  { id: 'mollets_machine', nom: 'Mollets debout', muscle: 'mollets', type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
  { id: 'releve_genoux', nom: 'Relevé de genoux', muscle: 'abdos', type: 'isolation', mode: 'poids_corps', pas: 2.5, suivreE1rm: false },
  { id: 'tractions', nom: 'Tractions', muscle: 'dos', type: 'compose', mode: 'poids_corps', pas: 2.5, suivreE1rm: true },
  { id: 'super_row', nom: 'Tirage horizontal prise large', muscle: 'dos', type: 'compose', mode: 'machine', pas: 2.5, suivreE1rm: true },
  { id: 'incline_machine', nom: 'Développé incliné machine', muscle: 'pecs', secondaires: pousseeHaut, type: 'compose', mode: 'machine', pas: 5, suivreE1rm: true },
  { id: 'bras_tendus', nom: 'Tirage bras tendus poulie', muscle: 'dos', type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
  { id: 'face_pull', nom: 'Face pull', muscle: 'epaule_arriere', secondaires: sec(['trapezes', 0.5]), type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
  { id: 'elevation_machine', nom: 'Élévation latérale machine', muscle: 'epaule_laterale', type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
  { id: 'curl_araignee', nom: 'Curl araignée', muscle: 'biceps', type: 'isolation', mode: 'machine', pas: 2, suivreE1rm: false },
  { id: 'dips', nom: 'Dips penchés en avant', muscle: 'pecs', secondaires: pousseeHaut, type: 'compose', mode: 'poids_corps', pas: 2.5, suivreE1rm: true },
  { id: 'butterfly_haut', nom: 'Butterfly prise haute', muscle: 'pecs', type: 'isolation', mode: 'machine', pas: 5, suivreE1rm: false, notes: 'Siège plus bas ; sur la machine à siège fixe, tenir le haut de la poignée.' },
  { id: 'tirage_vertical_v', nom: 'Tirage vertical poignée en V', muscle: 'dos', type: 'compose', mode: 'machine', pas: 5, suivreE1rm: true },
  { id: 'oiseau', nom: 'Oiseau machine', muscle: 'epaule_arriere', type: 'isolation', mode: 'machine', pas: 5, suivreE1rm: false },
  { id: 'triceps_tete', nom: 'Extension au-dessus de la tête poulie', muscle: 'triceps', type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
  { id: 'curl_marteau', nom: 'Curl marteau poulie', muscle: 'biceps', secondaires: sec(['avant_bras', 0.5]), type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
  { id: 'squat_bulgare', nom: 'Squat bulgare haltères', muscle: 'quadriceps', secondaires: sec(['fessiers', 0.5]), type: 'compose', mode: 'par_main', pas: 2, chargeMax: 24, suivreE1rm: false, notes: 'Pied arrière sur le banc.' },
  { id: 'rdl_halteres', nom: 'Soulevé de terre roumain haltères', muscle: 'ischios', secondaires: chainePost, type: 'compose', mode: 'par_main', pas: 2, chargeMax: 24, suivreE1rm: false, notes: 'Descente en 3 s.' },
  { id: 'extension_elastique', nom: 'Extension de jambe élastique', muscle: 'quadriceps', type: 'isolation', mode: 'elastique', pas: 1, suivreE1rm: false },
  { id: 'curl_elastique', nom: 'Curl jambe élastique', muscle: 'ischios', type: 'isolation', mode: 'elastique', pas: 1, suivreE1rm: false },
  { id: 'mollets_haltere', nom: 'Mollets une jambe haltère', muscle: 'mollets', type: 'isolation', mode: 'par_main', pas: 2, chargeMax: 24, suivreE1rm: false },
  { id: 'releve_jambes_banc', nom: 'Relevé de jambes sur banc', muscle: 'abdos', type: 'isolation', mode: 'poids_corps', pas: 2.5, suivreE1rm: false },

  // --- Pecs ---
  exo({ id: 'dev_couche_barre', nom: 'Développé couché barre', muscle: 'pecs', secondaires: pousseeHaut, type: 'compose', mode: 'machine', barre: 20 }),
  exo({ id: 'dev_couche_halteres', nom: 'Développé couché haltères', muscle: 'pecs', secondaires: pousseeHaut, type: 'compose', mode: 'par_main' }),
  exo({ id: 'dev_couche_smith', nom: 'Développé couché Smith', muscle: 'pecs', secondaires: pousseeHaut, type: 'compose', mode: 'machine', barre: 10 }),
  exo({ id: 'dev_couche_machine', nom: 'Développé couché machine', muscle: 'pecs', secondaires: pousseeHaut, type: 'compose', mode: 'machine', pas: 5 }),
  exo({ id: 'dev_incline_barre', nom: 'Développé incliné barre', muscle: 'pecs', secondaires: pousseeHaut, type: 'compose', mode: 'machine', barre: 20 }),
  exo({ id: 'dev_incline_halteres', nom: 'Développé incliné haltères', muscle: 'pecs', secondaires: pousseeHaut, type: 'compose', mode: 'par_main' }),
  exo({ id: 'ecarte_halteres', nom: 'Écarté couché haltères', muscle: 'pecs', type: 'isolation', mode: 'par_main' }),
  exo({ id: 'ecarte_poulie', nom: 'Écarté poulie', muscle: 'pecs', type: 'isolation', mode: 'machine' }),
  exo({ id: 'pompes', nom: 'Pompes', muscle: 'pecs', secondaires: pousseeHaut, type: 'compose', mode: 'poids_corps', suivreE1rm: false }),

  // --- Dos ---
  exo({ id: 'rowing_barre', nom: 'Rowing barre', muscle: 'dos', secondaires: sec(['lombaires', 0.5]), type: 'compose', mode: 'machine', barre: 20 }),
  exo({ id: 'rowing_haltere', nom: 'Rowing haltère', muscle: 'dos', type: 'compose', mode: 'par_main' }),
  exo({ id: 'rowing_t', nom: 'Rowing T-bar', muscle: 'dos', type: 'compose', mode: 'machine' }),
  exo({ id: 'rowing_machine', nom: 'Rowing machine', muscle: 'dos', type: 'compose', mode: 'machine', pas: 5 }),
  exo({ id: 'tractions_supination', nom: 'Tractions paumes vers toi', muscle: 'dos', type: 'compose', mode: 'poids_corps' }),
  exo({ id: 'tractions_assistees', nom: 'Tractions assistées machine', muscle: 'dos', type: 'compose', mode: 'machine', assistance: true, pas: 5, suivreE1rm: false, notes: 'Charge = assistance : plus elle baisse, plus c’est dur.' }),
  exo({ id: 'souleve_terre', nom: 'Soulevé de terre', muscle: 'dos', secondaires: sec(['fessiers', 0.5], ['ischios', 0.5], ['lombaires', 0.5]), type: 'compose', mode: 'machine', barre: 20 }),

  // --- Trapèzes ---
  exo({ id: 'shrug_halteres', nom: 'Shrug haltères', muscle: 'trapezes', type: 'isolation', mode: 'par_main' }),
  exo({ id: 'shrug_barre', nom: 'Shrug barre', muscle: 'trapezes', type: 'isolation', mode: 'machine', barre: 20 }),

  // --- Lombaires ---
  exo({ id: 'extension_lombaire', nom: 'Extension lombaire banc', muscle: 'lombaires', secondaires: sec(['fessiers', 0.5]), type: 'isolation', mode: 'poids_corps' }),

  // --- Épaules ---
  exo({ id: 'dev_militaire', nom: 'Développé militaire barre', muscle: 'epaule_avant', secondaires: sec(['epaule_laterale', 0.5], ['triceps', 0.5]), type: 'compose', mode: 'machine', barre: 20 }),
  exo({ id: 'dev_epaules_halteres', nom: 'Développé épaules haltères', muscle: 'epaule_avant', secondaires: sec(['epaule_laterale', 0.5], ['triceps', 0.5]), type: 'compose', mode: 'par_main' }),
  exo({ id: 'dev_epaules_machine', nom: 'Développé épaules machine', muscle: 'epaule_avant', secondaires: sec(['epaule_laterale', 0.5], ['triceps', 0.5]), type: 'compose', mode: 'machine', pas: 5 }),
  exo({ id: 'dev_epaules_smith', nom: 'Développé épaules Smith', muscle: 'epaule_avant', secondaires: sec(['epaule_laterale', 0.5], ['triceps', 0.5]), type: 'compose', mode: 'machine', barre: 10 }),
  exo({ id: 'elevation_frontale_halteres', nom: 'Élévation frontale haltères', muscle: 'epaule_avant', type: 'isolation', mode: 'par_main' }),
  exo({ id: 'elevation_laterale_halteres', nom: 'Élévation latérale haltères', muscle: 'epaule_laterale', type: 'isolation', mode: 'par_main' }),
  exo({ id: 'oiseau_halteres', nom: 'Oiseau haltères', muscle: 'epaule_arriere', type: 'isolation', mode: 'par_main' }),

  // --- Biceps ---
  exo({ id: 'curl_barre', nom: 'Curl barre', muscle: 'biceps', type: 'isolation', mode: 'machine' }),
  exo({ id: 'curl_barre_ez', nom: 'Curl barre EZ', muscle: 'biceps', type: 'isolation', mode: 'machine' }),
  exo({ id: 'curl_halteres', nom: 'Curl haltères', muscle: 'biceps', type: 'isolation', mode: 'par_main' }),
  exo({ id: 'curl_marteau_halteres', nom: 'Curl marteau haltères', muscle: 'biceps', secondaires: sec(['avant_bras', 0.5]), type: 'isolation', mode: 'par_main' }),
  exo({ id: 'curl_incline', nom: 'Curl incliné haltères', muscle: 'biceps', type: 'isolation', mode: 'par_main' }),
  exo({ id: 'curl_pupitre', nom: 'Curl pupitre', muscle: 'biceps', type: 'isolation', mode: 'machine' }),
  exo({ id: 'curl_poulie_basse', nom: 'Curl poulie', muscle: 'biceps', type: 'isolation', mode: 'machine' }),

  // --- Triceps ---
  exo({ id: 'barre_front', nom: 'Barre au front', muscle: 'triceps', type: 'isolation', mode: 'machine' }),
  exo({ id: 'extension_corde', nom: 'Extension triceps poulie corde', muscle: 'triceps', type: 'isolation', mode: 'machine' }),
  exo({ id: 'extension_barre_poulie', nom: 'Extension triceps poulie barre', muscle: 'triceps', type: 'isolation', mode: 'machine' }),
  exo({ id: 'extension_haltere_tete', nom: 'Extension au-dessus de la tête haltère', muscle: 'triceps', type: 'isolation', mode: 'par_main' }),
  exo({ id: 'dev_couche_serre', nom: 'Développé couché prise serrée', muscle: 'triceps', secondaires: sec(['pecs', 0.5]), type: 'compose', mode: 'machine', barre: 20 }),
  exo({ id: 'dips_machine', nom: 'Dips machine', muscle: 'triceps', secondaires: sec(['pecs', 0.5]), type: 'compose', mode: 'machine', pas: 5 }),

  // --- Avant-bras ---
  exo({ id: 'curl_poignet', nom: 'Curl poignets', muscle: 'avant_bras', type: 'isolation', mode: 'machine' }),

  // --- Quadriceps ---
  exo({ id: 'squat_barre', nom: 'Squat barre', muscle: 'quadriceps', secondaires: sec(['fessiers', 0.5], ['adducteurs', 0.5]), type: 'compose', mode: 'machine', barre: 20 }),
  exo({ id: 'squat_smith', nom: 'Squat Smith', muscle: 'quadriceps', secondaires: sec(['fessiers', 0.5]), type: 'compose', mode: 'machine', barre: 10 }),
  exo({ id: 'hack_squat', nom: 'Hack squat', muscle: 'quadriceps', secondaires: sec(['fessiers', 0.5]), type: 'compose', mode: 'machine' }),
  exo({ id: 'goblet_squat', nom: 'Goblet squat', muscle: 'quadriceps', secondaires: sec(['fessiers', 0.5]), type: 'compose', mode: 'par_main', suivreE1rm: false, notes: 'Charge = l’haltère tenu contre la poitrine.' }),
  exo({ id: 'fentes_halteres', nom: 'Fentes avant haltères', muscle: 'quadriceps', secondaires: sec(['fessiers', 0.5]), type: 'compose', mode: 'par_main', suivreE1rm: false }),

  // --- Ischios ---
  exo({ id: 'curl_jambe_allonge', nom: 'Curl jambe allongé', muscle: 'ischios', type: 'isolation', mode: 'machine', pas: 5 }),

  // --- Fessiers ---
  exo({ id: 'hip_thrust_barre', nom: 'Hip thrust barre', muscle: 'fessiers', secondaires: sec(['ischios', 0.5]), type: 'compose', mode: 'machine', barre: 20 }),
  exo({ id: 'hip_thrust_machine', nom: 'Hip thrust machine', muscle: 'fessiers', secondaires: sec(['ischios', 0.5]), type: 'compose', mode: 'machine' }),
  exo({ id: 'pont_fessier', nom: 'Pont fessier', muscle: 'fessiers', type: 'isolation', mode: 'poids_corps' }),
  exo({ id: 'kickback_poulie', nom: 'Kickback fessier poulie', muscle: 'fessiers', type: 'isolation', mode: 'machine' }),
  exo({ id: 'abduction_machine', nom: 'Abducteurs machine', muscle: 'fessiers', type: 'isolation', mode: 'machine', pas: 5 }),

  // --- Adducteurs ---
  exo({ id: 'adduction_machine', nom: 'Adducteurs machine', muscle: 'adducteurs', type: 'isolation', mode: 'machine', pas: 5 }),

  // --- Mollets ---
  exo({ id: 'mollets_assis', nom: 'Mollets assis', muscle: 'mollets', type: 'isolation', mode: 'machine' }),
  exo({ id: 'mollets_presse', nom: 'Mollets à la presse', muscle: 'mollets', type: 'isolation', mode: 'machine' }),

  // --- Abdos ---
  exo({ id: 'crunch', nom: 'Crunch', muscle: 'abdos', type: 'isolation', mode: 'poids_corps' }),
  exo({ id: 'crunch_poulie', nom: 'Crunch poulie', muscle: 'abdos', type: 'isolation', mode: 'machine' }),
  exo({ id: 'crunch_machine', nom: 'Crunch machine', muscle: 'abdos', type: 'isolation', mode: 'machine', pas: 5 }),
  exo({ id: 'gainage', nom: 'Gainage', muscle: 'abdos', type: 'isolation', mode: 'poids_corps', mesure: 'temps' }),
  exo({ id: 'gainage_lateral', nom: 'Gainage latéral', muscle: 'abdos', type: 'isolation', mode: 'poids_corps', mesure: 'temps' }),
]

export const EXERCICES: Record<string, Exercice> = Object.fromEntries(liste.map((e) => [e.id, e]))

/** Anciens noms des exercices de base : une copie enregistrée avec l'ancien nom affiche le nouveau (un nom choisi par la personne reste), et la recherche les trouve encore. */
export const ANCIENS_NOMS: Record<string, string[]> = {
  tirage_large: ['Tirage poitrine prise large'],
  triceps_un_bras: ['Extension triceps un bras'],
  presse: ['Presse à cuisse'],
  rdl: ['Soulevé de terre roumain'],
  mollets_machine: ['Mollets machine'],
  tractions: ['Tractions pronation'],
  super_row: ['Super-row overhand poulie'],
  bras_tendus: ['Tirage bras tendus poulie haute'],
  elevation_machine: ['Élévation latérale machine à plaques'],
  tirage_vertical_v: ['Tirage vertical prise neutre (V)'],
  triceps_tete: ['Extension triceps au-dessus de la tête'],
  squat_bulgare: ['Squat bulgare (par jambe)'],
  curl_elastique: ['Curl de jambe élastique'],
  mollets_haltere: ['Mollets une jambe, haltère'],
  releve_jambes_banc: ['Relevés de jambes sur banc'],
  ecarte_poulie: ['Écarté poulie vis-à-vis'],
  rowing_barre: ['Rowing barre buste penché'],
  rowing_haltere: ['Rowing haltère un bras'],
  rowing_machine: ['Rowing machine appui poitrine'],
  tractions_supination: ['Tractions supination'],
  extension_lombaire: ['Extension lombaire banc à 45°'],
  dev_epaules_halteres: ['Développé épaules haltères assis'],
  oiseau_halteres: ['Oiseau haltères buste penché'],
  curl_barre: ['Curl barre droite'],
  curl_pupitre: ['Curl pupitre (Larry Scott)'],
  curl_poulie_basse: ['Curl poulie basse'],
  extension_corde: ['Extension triceps poulie haute à la corde'],
  extension_barre_poulie: ['Extension triceps poulie haute barre'],
  extension_haltere_tete: ['Extension haltère au-dessus de la tête'],
  dips_machine: ['Dips machine assis'],
  pont_fessier: ['Pont fessier au sol'],
  abduction_machine: ['Abduction hanche machine'],
  adduction_machine: ['Adduction hanche machine'],
  mollets_assis: ['Mollets assis machine'],
  crunch: ['Crunch au sol'],
  crunch_poulie: ['Crunch poulie haute à genoux'],
  gainage: ['Gainage (planche)'],
}
/** Autres mots qui mènent à un exercice dans la recherche : son nom anglais, ou le doublon retiré à son profit. */
export const AUTRES_MOTS: Record<string, string[]> = {
  extension_jambes: ['leg extension'],
  curl_jambe_assis: ['leg curl'],
  curl_jambe_allonge: ['leg curl'],
  butterfly: ['pec deck'],
  tirage_large: ['lat pulldown'],
  presse: ['leg press'],
  rdl: ['jambes tendues'],
  bras_tendus: ['pull-over poulie'],
  tirage_vertical_v: ['tirage poitrine prise serrée'],
  mollets_machine: ['mollets debout machine'],
}
/** Ce que la recherche lit pour un exercice. */
export const texteRecherche = (e: Exercice) => [e.nom, MUSCLES.find((m) => m.id === e.muscle)?.nom, ...(ANCIENS_NOMS[e.id] ?? []), ...(AUTRES_MOTS[e.id] ?? [])].join(' ')

/** Zones du corps : filtres du choix d'exercice ; `face` : vue de l'icône. */
export type Zone = 'pecs' | 'dos' | 'epaules' | 'bras' | 'jambes' | 'abdos'
export const ZONES: { id: Zone; nom: string }[] = [
  { id: 'pecs', nom: 'Pecs' },
  { id: 'dos', nom: 'Dos' },
  { id: 'epaules', nom: 'Épaules' },
  { id: 'bras', nom: 'Bras' },
  { id: 'jambes', nom: 'Jambes' },
  { id: 'abdos', nom: 'Abdos' },
]

/**
 * Zone utile de séries dures par semaine pour progresser, la même pour tout le monde (repères
 * courants : 10 à 20 pour les gros muscles, moins pour ceux que les gros exercices travaillent déjà).
 * `cible` : bas de la zone ; `haut` : au-delà, c'est beaucoup. 0 = pas de zone, suivi seulement
 * (muscle travaillé surtout par d'autres exercices : trapèzes, lombaires, avant d'épaule…).
 */
export const MUSCLES: { id: Muscle; nom: string; cible: number; haut: number; zone: Zone; face: 'avant' | 'arriere' }[] = [
  { id: 'pecs', nom: 'Pecs', cible: 10, haut: 16, zone: 'pecs', face: 'avant' },
  { id: 'dos', nom: 'Dos', cible: 10, haut: 16, zone: 'dos', face: 'arriere' },
  { id: 'trapezes', nom: 'Trapèzes', cible: 0, haut: 0, zone: 'dos', face: 'arriere' },
  { id: 'lombaires', nom: 'Lombaires', cible: 0, haut: 0, zone: 'dos', face: 'arriere' },
  { id: 'epaule_avant', nom: 'Avant d’épaule', cible: 0, haut: 0, zone: 'epaules', face: 'avant' },
  { id: 'epaule_laterale', nom: 'Épaule latérale', cible: 8, haut: 16, zone: 'epaules', face: 'avant' },
  { id: 'epaule_arriere', nom: "Arrière d'épaule", cible: 6, haut: 16, zone: 'epaules', face: 'arriere' },
  { id: 'biceps', nom: 'Biceps', cible: 6, haut: 16, zone: 'bras', face: 'avant' },
  { id: 'triceps', nom: 'Triceps', cible: 6, haut: 16, zone: 'bras', face: 'arriere' },
  { id: 'avant_bras', nom: 'Avant-bras', cible: 0, haut: 0, zone: 'bras', face: 'avant' },
  { id: 'quadriceps', nom: 'Quadriceps', cible: 10, haut: 16, zone: 'jambes', face: 'avant' },
  { id: 'ischios', nom: 'Ischios', cible: 8, haut: 16, zone: 'jambes', face: 'arriere' },
  { id: 'fessiers', nom: 'Fessiers', cible: 0, haut: 0, zone: 'jambes', face: 'arriere' },
  { id: 'adducteurs', nom: 'Adducteurs', cible: 0, haut: 0, zone: 'jambes', face: 'avant' },
  { id: 'mollets', nom: 'Mollets', cible: 6, haut: 16, zone: 'jambes', face: 'arriere' },
  { id: 'abdos', nom: 'Abdos', cible: 0, haut: 0, zone: 'abdos', face: 'avant' },
]

