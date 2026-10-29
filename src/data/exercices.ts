import type { Exercice, Muscle } from '../types'

const sec = (...m: [Muscle, number][]) => m.map(([muscle, coef]) => ({ muscle, coef }))
const triceps05 = sec(['triceps', 0.5])
const pousseeHaut = sec(['triceps', 0.5], ['epaule_avant', 0.5])
const chainePost = sec(['fessiers', 0.5], ['lombaires', 0.5])
// Secondaires : seulement le triceps sur les poussées (objectifs de volume de l'utilisateur) et les
// muscles sans objectif ; pas de biceps sur les tirages, sinon l'objectif biceps serait faussé.

type Def = Omit<Exercice, 'suivreE1rm' | 'pas'> & { pas?: number; suivreE1rm?: boolean }
// Pas par défaut : 2 kg par haltère, 2,5 kg sinon ; e1RM suivi pour les composés.
const exo = (e: Def): Exercice => ({ pas: e.mode === 'par_main' ? 2 : e.mode === 'elastique' ? 1 : 2.5, suivreE1rm: e.type === 'compose' && e.mesure !== 'temps', ...e })

const liste: Exercice[] = [
  // --- Séances de départ (identifiants conservés : ils sont dans l'historique) ---
  { id: 'smith_incline', nom: 'Développé incliné Smith', muscle: 'pecs', secondaires: pousseeHaut, type: 'compose', mode: 'machine', pas: 2.5, suivreE1rm: true },
  { id: 'tirage_large', nom: 'Tirage poitrine prise large', muscle: 'dos', type: 'compose', mode: 'machine', pas: 2.5, suivreE1rm: true },
  { id: 'butterfly', nom: 'Butterfly', muscle: 'pecs', type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
  { id: 'tirage_horizontal', nom: 'Tirage horizontal prise neutre', muscle: 'dos', type: 'compose', mode: 'machine', pas: 2.5, suivreE1rm: true },
  { id: 'elevation_poulie', nom: 'Élévation latérale poulie', muscle: 'epaule_laterale', type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
  { id: 'triceps_un_bras', nom: 'Extension triceps un bras', muscle: 'triceps', type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
  { id: 'presse', nom: 'Presse à cuisse', muscle: 'quadriceps', secondaires: sec(['fessiers', 0.5]), type: 'compose', mode: 'machine', pas: 2.5, suivreE1rm: true },
  { id: 'rdl', nom: 'Soulevé de terre roumain', muscle: 'ischios', secondaires: chainePost, type: 'compose', mode: 'machine', pas: 2.5, suivreE1rm: true },
  { id: 'curl_jambe_assis', nom: 'Curl jambe assis', muscle: 'ischios', type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
  { id: 'extension_jambes', nom: 'Extension de jambes', muscle: 'quadriceps', type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
  { id: 'mollets_machine', nom: 'Mollets machine', muscle: 'mollets', type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
  { id: 'releve_genoux', nom: 'Relevé de genoux', muscle: 'abdos', type: 'isolation', mode: 'poids_corps', pas: 2.5, suivreE1rm: false },
  { id: 'tractions', nom: 'Tractions pronation', muscle: 'dos', type: 'compose', mode: 'poids_corps', pas: 2.5, suivreE1rm: true },
  { id: 'super_row', nom: 'Super-row overhand poulie', muscle: 'dos', type: 'compose', mode: 'machine', pas: 2.5, suivreE1rm: true },
  { id: 'incline_machine', nom: 'Développé incliné machine', muscle: 'pecs', secondaires: pousseeHaut, type: 'compose', mode: 'machine', pas: 2.5, suivreE1rm: true },
  { id: 'bras_tendus', nom: 'Tirage bras tendus poulie haute', muscle: 'dos', type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
  { id: 'face_pull', nom: 'Face pull', muscle: 'epaule_arriere', secondaires: sec(['trapezes', 0.5]), type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
  { id: 'elevation_machine', nom: 'Élévation latérale machine à plaques', muscle: 'epaule_laterale', type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
  { id: 'curl_araignee', nom: 'Curl araignée', muscle: 'biceps', type: 'isolation', mode: 'machine', pas: 2, suivreE1rm: false },
  { id: 'dips', nom: 'Dips penchés en avant', muscle: 'pecs', secondaires: pousseeHaut, type: 'compose', mode: 'poids_corps', pas: 2.5, suivreE1rm: true },
  { id: 'butterfly_haut', nom: 'Butterfly prise haute', muscle: 'pecs', type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false, notes: 'Siège plus bas ; sur la machine à siège fixe, tenir le haut de la poignée.' },
  { id: 'tirage_vertical_v', nom: 'Tirage vertical prise neutre (V)', muscle: 'dos', type: 'compose', mode: 'machine', pas: 2.5, suivreE1rm: true },
  { id: 'oiseau', nom: 'Oiseau machine', muscle: 'epaule_arriere', type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
  { id: 'triceps_tete', nom: 'Extension triceps au-dessus de la tête', muscle: 'triceps', type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
  { id: 'curl_marteau', nom: 'Curl marteau poulie', muscle: 'biceps', secondaires: sec(['avant_bras', 0.5]), type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
  { id: 'squat_bulgare', nom: 'Squat bulgare (par jambe)', muscle: 'quadriceps', secondaires: sec(['fessiers', 0.5]), type: 'compose', mode: 'par_main', pas: 2, chargeMax: 24, suivreE1rm: false, notes: 'Pied arrière sur le banc.' },
  { id: 'rdl_halteres', nom: 'Soulevé de terre roumain haltères', muscle: 'ischios', secondaires: chainePost, type: 'compose', mode: 'par_main', pas: 2, chargeMax: 24, suivreE1rm: false, notes: 'Descente en 3 s.' },
  { id: 'extension_elastique', nom: 'Extension de jambe élastique', muscle: 'quadriceps', type: 'isolation', mode: 'elastique', pas: 1, suivreE1rm: false },
  { id: 'curl_elastique', nom: 'Curl de jambe élastique', muscle: 'ischios', type: 'isolation', mode: 'elastique', pas: 1, suivreE1rm: false },
  { id: 'mollets_haltere', nom: 'Mollets une jambe, haltère', muscle: 'mollets', type: 'isolation', mode: 'par_main', pas: 2, chargeMax: 24, suivreE1rm: false },
  { id: 'releve_jambes_banc', nom: 'Relevés de jambes sur banc', muscle: 'abdos', type: 'isolation', mode: 'poids_corps', pas: 2.5, suivreE1rm: false },

  // --- Pecs ---
  exo({ id: 'dev_couche_barre', nom: 'Développé couché barre', muscle: 'pecs', secondaires: pousseeHaut, type: 'compose', mode: 'machine' }),
  exo({ id: 'dev_couche_halteres', nom: 'Développé couché haltères', muscle: 'pecs', secondaires: pousseeHaut, type: 'compose', mode: 'par_main' }),
  exo({ id: 'dev_couche_smith', nom: 'Développé couché Smith', muscle: 'pecs', secondaires: pousseeHaut, type: 'compose', mode: 'machine' }),
  exo({ id: 'dev_couche_machine', nom: 'Développé couché machine', muscle: 'pecs', secondaires: pousseeHaut, type: 'compose', mode: 'machine' }),
  exo({ id: 'dev_incline_barre', nom: 'Développé incliné barre', muscle: 'pecs', secondaires: pousseeHaut, type: 'compose', mode: 'machine' }),
  exo({ id: 'dev_incline_halteres', nom: 'Développé incliné haltères', muscle: 'pecs', secondaires: pousseeHaut, type: 'compose', mode: 'par_main' }),
  exo({ id: 'dev_decline_barre', nom: 'Développé décliné barre', muscle: 'pecs', secondaires: triceps05, type: 'compose', mode: 'machine' }),
  exo({ id: 'ecarte_halteres', nom: 'Écarté couché haltères', muscle: 'pecs', type: 'isolation', mode: 'par_main' }),
  exo({ id: 'ecarte_incline_halteres', nom: 'Écarté incliné haltères', muscle: 'pecs', type: 'isolation', mode: 'par_main' }),
  exo({ id: 'ecarte_poulie', nom: 'Écarté poulie vis-à-vis', muscle: 'pecs', type: 'isolation', mode: 'machine' }),
  exo({ id: 'ecarte_poulie_basse', nom: 'Écarté poulie basse vers le haut', muscle: 'pecs', type: 'isolation', mode: 'machine' }),
  exo({ id: 'pompes', nom: 'Pompes', muscle: 'pecs', secondaires: pousseeHaut, type: 'compose', mode: 'poids_corps', suivreE1rm: false }),
  exo({ id: 'pull_over_haltere', nom: 'Pull-over haltère', muscle: 'pecs', secondaires: sec(['dos', 0.5]), type: 'isolation', mode: 'par_main' }),

  // --- Dos ---
  exo({ id: 'rowing_barre', nom: 'Rowing barre buste penché', muscle: 'dos', secondaires: sec(['lombaires', 0.5]), type: 'compose', mode: 'machine' }),
  exo({ id: 'rowing_haltere', nom: 'Rowing haltère un bras', muscle: 'dos', type: 'compose', mode: 'par_main' }),
  exo({ id: 'rowing_t', nom: 'Rowing T-bar', muscle: 'dos', type: 'compose', mode: 'machine' }),
  exo({ id: 'rowing_machine', nom: 'Rowing machine appui poitrine', muscle: 'dos', type: 'compose', mode: 'machine' }),
  exo({ id: 'tirage_poitrine_serre', nom: 'Tirage poitrine prise serrée', muscle: 'dos', type: 'compose', mode: 'machine' }),
  exo({ id: 'tirage_unilateral', nom: 'Tirage unilatéral poulie haute', muscle: 'dos', type: 'compose', mode: 'machine' }),
  exo({ id: 'tirage_horizontal_large', nom: 'Tirage horizontal prise large', muscle: 'dos', secondaires: sec(['epaule_arriere', 0.5]), type: 'compose', mode: 'machine' }),
  exo({ id: 'tractions_supination', nom: 'Tractions supination', muscle: 'dos', type: 'compose', mode: 'poids_corps' }),
  exo({ id: 'tractions_assistees', nom: 'Tractions assistées machine', muscle: 'dos', type: 'compose', mode: 'machine', suivreE1rm: false, notes: 'Charge = assistance : plus elle baisse, plus c’est dur.' }),
  exo({ id: 'souleve_terre', nom: 'Soulevé de terre', muscle: 'dos', secondaires: sec(['fessiers', 0.5], ['ischios', 0.5], ['lombaires', 0.5]), type: 'compose', mode: 'machine' }),
  exo({ id: 'pull_over_poulie', nom: 'Pull-over poulie à la corde', muscle: 'dos', type: 'isolation', mode: 'machine' }),

  // --- Trapèzes ---
  exo({ id: 'shrug_halteres', nom: 'Shrug haltères', muscle: 'trapezes', type: 'isolation', mode: 'par_main' }),
  exo({ id: 'shrug_barre', nom: 'Shrug barre', muscle: 'trapezes', type: 'isolation', mode: 'machine' }),
  exo({ id: 'shrug_machine', nom: 'Shrug machine', muscle: 'trapezes', type: 'isolation', mode: 'machine' }),

  // --- Lombaires ---
  exo({ id: 'extension_lombaire', nom: 'Extension lombaire banc à 45°', muscle: 'lombaires', secondaires: sec(['fessiers', 0.5]), type: 'isolation', mode: 'poids_corps' }),
  exo({ id: 'extension_lombaire_machine', nom: 'Extension lombaire machine', muscle: 'lombaires', type: 'isolation', mode: 'machine' }),
  exo({ id: 'good_morning', nom: 'Good morning barre', muscle: 'lombaires', secondaires: sec(['ischios', 0.5], ['fessiers', 0.5]), type: 'compose', mode: 'machine', suivreE1rm: false }),

  // --- Épaules ---
  exo({ id: 'dev_militaire', nom: 'Développé militaire barre', muscle: 'epaule_avant', secondaires: sec(['epaule_laterale', 0.5], ['triceps', 0.5]), type: 'compose', mode: 'machine' }),
  exo({ id: 'dev_epaules_halteres', nom: 'Développé épaules haltères assis', muscle: 'epaule_avant', secondaires: sec(['epaule_laterale', 0.5], ['triceps', 0.5]), type: 'compose', mode: 'par_main' }),
  exo({ id: 'dev_epaules_machine', nom: 'Développé épaules machine', muscle: 'epaule_avant', secondaires: sec(['epaule_laterale', 0.5], ['triceps', 0.5]), type: 'compose', mode: 'machine' }),
  exo({ id: 'dev_epaules_smith', nom: 'Développé épaules Smith', muscle: 'epaule_avant', secondaires: sec(['epaule_laterale', 0.5], ['triceps', 0.5]), type: 'compose', mode: 'machine' }),
  exo({ id: 'dev_arnold', nom: 'Développé Arnold', muscle: 'epaule_avant', secondaires: sec(['epaule_laterale', 0.5], ['triceps', 0.5]), type: 'compose', mode: 'par_main' }),
  exo({ id: 'elevation_frontale_halteres', nom: 'Élévation frontale haltères', muscle: 'epaule_avant', type: 'isolation', mode: 'par_main' }),
  exo({ id: 'elevation_frontale_poulie', nom: 'Élévation frontale poulie', muscle: 'epaule_avant', type: 'isolation', mode: 'machine' }),
  exo({ id: 'elevation_laterale_halteres', nom: 'Élévation latérale haltères', muscle: 'epaule_laterale', type: 'isolation', mode: 'par_main' }),
  exo({ id: 'rowing_menton', nom: 'Rowing menton prise large', muscle: 'epaule_laterale', secondaires: sec(['trapezes', 0.5]), type: 'compose', mode: 'machine', suivreE1rm: false }),
  exo({ id: 'oiseau_halteres', nom: 'Oiseau haltères buste penché', muscle: 'epaule_arriere', type: 'isolation', mode: 'par_main' }),
  exo({ id: 'oiseau_poulie', nom: 'Oiseau poulie croisée', muscle: 'epaule_arriere', type: 'isolation', mode: 'machine' }),

  // --- Biceps ---
  exo({ id: 'curl_barre', nom: 'Curl barre droite', muscle: 'biceps', type: 'isolation', mode: 'machine' }),
  exo({ id: 'curl_barre_ez', nom: 'Curl barre EZ', muscle: 'biceps', type: 'isolation', mode: 'machine' }),
  exo({ id: 'curl_halteres', nom: 'Curl haltères', muscle: 'biceps', type: 'isolation', mode: 'par_main' }),
  exo({ id: 'curl_marteau_halteres', nom: 'Curl marteau haltères', muscle: 'biceps', secondaires: sec(['avant_bras', 0.5]), type: 'isolation', mode: 'par_main' }),
  exo({ id: 'curl_incline', nom: 'Curl incliné haltères', muscle: 'biceps', type: 'isolation', mode: 'par_main' }),
  exo({ id: 'curl_pupitre', nom: 'Curl pupitre (Larry Scott)', muscle: 'biceps', type: 'isolation', mode: 'machine' }),
  exo({ id: 'curl_poulie_basse', nom: 'Curl poulie basse', muscle: 'biceps', type: 'isolation', mode: 'machine' }),
  exo({ id: 'curl_bayesian', nom: 'Curl poulie derrière le corps', muscle: 'biceps', type: 'isolation', mode: 'machine' }),
  exo({ id: 'curl_concentre', nom: 'Curl concentré', muscle: 'biceps', type: 'isolation', mode: 'par_main' }),

  // --- Triceps ---
  exo({ id: 'barre_front', nom: 'Barre au front', muscle: 'triceps', type: 'isolation', mode: 'machine' }),
  exo({ id: 'extension_corde', nom: 'Extension triceps poulie haute à la corde', muscle: 'triceps', type: 'isolation', mode: 'machine' }),
  exo({ id: 'extension_barre_poulie', nom: 'Extension triceps poulie haute barre', muscle: 'triceps', type: 'isolation', mode: 'machine' }),
  exo({ id: 'extension_haltere_tete', nom: 'Extension haltère au-dessus de la tête', muscle: 'triceps', type: 'isolation', mode: 'par_main' }),
  exo({ id: 'kickback', nom: 'Kickback haltère', muscle: 'triceps', type: 'isolation', mode: 'par_main' }),
  exo({ id: 'dev_couche_serre', nom: 'Développé couché prise serrée', muscle: 'triceps', secondaires: sec(['pecs', 0.5]), type: 'compose', mode: 'machine' }),
  exo({ id: 'dips_machine', nom: 'Dips machine assis', muscle: 'triceps', secondaires: sec(['pecs', 0.5]), type: 'compose', mode: 'machine' }),
  exo({ id: 'dips_banc', nom: 'Dips entre deux bancs', muscle: 'triceps', type: 'compose', mode: 'poids_corps', suivreE1rm: false }),

  // --- Avant-bras ---
  exo({ id: 'curl_poignet', nom: 'Curl poignets', muscle: 'avant_bras', type: 'isolation', mode: 'machine' }),
  exo({ id: 'curl_poignet_inverse', nom: 'Curl poignets inversé', muscle: 'avant_bras', type: 'isolation', mode: 'machine' }),
  exo({ id: 'curl_inverse', nom: 'Curl inversé barre EZ', muscle: 'avant_bras', secondaires: sec(['biceps', 0.5]), type: 'isolation', mode: 'machine' }),
  exo({ id: 'marche_fermier', nom: 'Marche du fermier', muscle: 'avant_bras', secondaires: sec(['trapezes', 0.5]), type: 'compose', mode: 'par_main', suivreE1rm: false, notes: 'Reps = nombre de pas (ou secondes).' }),

  // --- Quadriceps ---
  exo({ id: 'squat_barre', nom: 'Squat barre', muscle: 'quadriceps', secondaires: sec(['fessiers', 0.5], ['adducteurs', 0.5]), type: 'compose', mode: 'machine' }),
  exo({ id: 'squat_avant', nom: 'Squat avant (front squat)', muscle: 'quadriceps', secondaires: sec(['fessiers', 0.5]), type: 'compose', mode: 'machine' }),
  exo({ id: 'squat_smith', nom: 'Squat Smith', muscle: 'quadriceps', secondaires: sec(['fessiers', 0.5]), type: 'compose', mode: 'machine' }),
  exo({ id: 'hack_squat', nom: 'Hack squat', muscle: 'quadriceps', secondaires: sec(['fessiers', 0.5]), type: 'compose', mode: 'machine' }),
  exo({ id: 'goblet_squat', nom: 'Goblet squat', muscle: 'quadriceps', secondaires: sec(['fessiers', 0.5]), type: 'compose', mode: 'par_main', suivreE1rm: false, notes: 'Charge = l’haltère tenu contre la poitrine.' }),
  exo({ id: 'presse_unilaterale', nom: 'Presse à cuisse une jambe', muscle: 'quadriceps', secondaires: sec(['fessiers', 0.5]), type: 'compose', mode: 'machine', suivreE1rm: false }),
  exo({ id: 'fentes_halteres', nom: 'Fentes avant haltères', muscle: 'quadriceps', secondaires: sec(['fessiers', 0.5]), type: 'compose', mode: 'par_main', suivreE1rm: false }),
  exo({ id: 'fentes_marchees', nom: 'Fentes marchées haltères', muscle: 'quadriceps', secondaires: sec(['fessiers', 0.5]), type: 'compose', mode: 'par_main', suivreE1rm: false }),
  exo({ id: 'step_up', nom: 'Montées sur banc haltères', muscle: 'quadriceps', secondaires: sec(['fessiers', 0.5]), type: 'compose', mode: 'par_main', suivreE1rm: false }),
  exo({ id: 'sissy_squat', nom: 'Sissy squat', muscle: 'quadriceps', type: 'isolation', mode: 'poids_corps' }),

  // --- Ischios ---
  exo({ id: 'curl_jambe_allonge', nom: 'Curl jambe allongé', muscle: 'ischios', type: 'isolation', mode: 'machine' }),
  exo({ id: 'curl_jambe_debout', nom: 'Curl jambe debout unilatéral', muscle: 'ischios', type: 'isolation', mode: 'machine' }),
  exo({ id: 'rdl_barre', nom: 'Soulevé de terre jambes tendues barre', muscle: 'ischios', secondaires: chainePost, type: 'compose', mode: 'machine' }),
  exo({ id: 'nordic_curl', nom: 'Nordic curl', muscle: 'ischios', type: 'isolation', mode: 'poids_corps' }),

  // --- Fessiers ---
  exo({ id: 'hip_thrust_barre', nom: 'Hip thrust barre', muscle: 'fessiers', secondaires: sec(['ischios', 0.5]), type: 'compose', mode: 'machine' }),
  exo({ id: 'hip_thrust_machine', nom: 'Hip thrust machine', muscle: 'fessiers', secondaires: sec(['ischios', 0.5]), type: 'compose', mode: 'machine' }),
  exo({ id: 'pont_fessier', nom: 'Pont fessier au sol', muscle: 'fessiers', type: 'isolation', mode: 'poids_corps' }),
  exo({ id: 'kickback_poulie', nom: 'Kickback fessier poulie', muscle: 'fessiers', type: 'isolation', mode: 'machine' }),
  exo({ id: 'abduction_machine', nom: 'Abduction hanche machine', muscle: 'fessiers', type: 'isolation', mode: 'machine' }),
  exo({ id: 'fentes_arriere', nom: 'Fentes arrière haltères', muscle: 'fessiers', secondaires: sec(['quadriceps', 0.5]), type: 'compose', mode: 'par_main', suivreE1rm: false }),

  // --- Adducteurs ---
  exo({ id: 'adduction_machine', nom: 'Adduction hanche machine', muscle: 'adducteurs', type: 'isolation', mode: 'machine' }),
  exo({ id: 'adduction_poulie', nom: 'Adduction poulie basse', muscle: 'adducteurs', type: 'isolation', mode: 'machine' }),
  exo({ id: 'squat_sumo', nom: 'Squat sumo haltère', muscle: 'adducteurs', secondaires: sec(['quadriceps', 0.5], ['fessiers', 0.5]), type: 'compose', mode: 'par_main', suivreE1rm: false }),

  // --- Mollets ---
  exo({ id: 'mollets_debout', nom: 'Mollets debout machine', muscle: 'mollets', type: 'isolation', mode: 'machine' }),
  exo({ id: 'mollets_assis', nom: 'Mollets assis machine', muscle: 'mollets', type: 'isolation', mode: 'machine' }),
  exo({ id: 'chaise', nom: 'Chaise contre le mur', muscle: 'quadriceps', type: 'isolation', mode: 'poids_corps', mesure: 'temps' }),
  exo({ id: 'mollets_presse', nom: 'Mollets à la presse', muscle: 'mollets', type: 'isolation', mode: 'machine' }),
  exo({ id: 'mollets_smith', nom: 'Mollets debout Smith', muscle: 'mollets', type: 'isolation', mode: 'machine' }),

  // --- Abdos ---
  exo({ id: 'crunch', nom: 'Crunch au sol', muscle: 'abdos', type: 'isolation', mode: 'poids_corps' }),
  exo({ id: 'crunch_poulie', nom: 'Crunch poulie haute à genoux', muscle: 'abdos', type: 'isolation', mode: 'machine' }),
  exo({ id: 'crunch_machine', nom: 'Crunch machine', muscle: 'abdos', type: 'isolation', mode: 'machine' }),
  exo({ id: 'releve_jambes_suspendu', nom: 'Relevé de jambes suspendu', muscle: 'abdos', type: 'isolation', mode: 'poids_corps' }),
  exo({ id: 'roulette', nom: 'Roue abdominale', muscle: 'abdos', type: 'isolation', mode: 'poids_corps' }),
  exo({ id: 'gainage', nom: 'Gainage (planche)', muscle: 'abdos', type: 'isolation', mode: 'poids_corps', mesure: 'temps' }),
  exo({ id: 'gainage_lateral', nom: 'Gainage latéral', muscle: 'abdos', type: 'isolation', mode: 'poids_corps', mesure: 'temps' }),
  exo({ id: 'hollow', nom: 'Hollow hold', muscle: 'abdos', type: 'isolation', mode: 'poids_corps', mesure: 'temps' }),
  exo({ id: 'pallof', nom: 'Pallof press', muscle: 'abdos', type: 'isolation', mode: 'machine' }),
  exo({ id: 'russian_twist', nom: 'Russian twist', muscle: 'abdos', type: 'isolation', mode: 'par_main', notes: 'Reps = rotations de chaque côté.' }),
]

export const EXERCICES: Record<string, Exercice> = Object.fromEntries(liste.map((e) => [e.id, e]))

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

/** `cible` : séries dures par semaine (0 = pas d'objectif, affiché seulement s'il est travaillé). */
export const MUSCLES: { id: Muscle; nom: string; cible: number; zone: Zone; face: 'avant' | 'arriere' }[] = [
  { id: 'pecs', nom: 'Pecs', cible: 16, zone: 'pecs', face: 'avant' },
  { id: 'dos', nom: 'Dos', cible: 18, zone: 'dos', face: 'arriere' },
  { id: 'trapezes', nom: 'Trapèzes', cible: 0, zone: 'dos', face: 'arriere' },
  { id: 'lombaires', nom: 'Lombaires', cible: 0, zone: 'dos', face: 'arriere' },
  { id: 'epaule_avant', nom: 'Avant d’épaule', cible: 0, zone: 'epaules', face: 'avant' },
  { id: 'epaule_laterale', nom: 'Épaule latérale', cible: 6, zone: 'epaules', face: 'avant' },
  { id: 'epaule_arriere', nom: "Arrière d'épaule", cible: 5, zone: 'epaules', face: 'arriere' },
  { id: 'biceps', nom: 'Biceps', cible: 6, zone: 'bras', face: 'avant' },
  { id: 'triceps', nom: 'Triceps', cible: 9.5, zone: 'bras', face: 'arriere' },
  { id: 'avant_bras', nom: 'Avant-bras', cible: 0, zone: 'bras', face: 'avant' },
  { id: 'quadriceps', nom: 'Quadriceps', cible: 5, zone: 'jambes', face: 'avant' },
  { id: 'ischios', nom: 'Ischios', cible: 6, zone: 'jambes', face: 'arriere' },
  { id: 'fessiers', nom: 'Fessiers', cible: 0, zone: 'jambes', face: 'arriere' },
  { id: 'adducteurs', nom: 'Adducteurs', cible: 0, zone: 'jambes', face: 'avant' },
  { id: 'mollets', nom: 'Mollets', cible: 3, zone: 'jambes', face: 'arriere' },
  { id: 'abdos', nom: 'Abdos', cible: 3, zone: 'abdos', face: 'avant' },
]
