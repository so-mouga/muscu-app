const triceps05 = [{ muscle: 'triceps', coef: 0.5 }];
const liste = [
    // Haut A
    { id: 'smith_incline', nom: 'Développé incliné Smith', muscle: 'pecs', secondaires: triceps05, type: 'compose', mode: 'machine', pas: 2.5, suivreE1rm: true },
    { id: 'tirage_large', nom: 'Tirage poitrine prise large', muscle: 'dos', type: 'compose', mode: 'machine', pas: 2.5, suivreE1rm: true },
    { id: 'butterfly', nom: 'Butterfly', muscle: 'pecs', type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
    { id: 'tirage_horizontal', nom: 'Tirage horizontal prise neutre', muscle: 'dos', type: 'compose', mode: 'machine', pas: 2.5, suivreE1rm: true },
    { id: 'elevation_poulie', nom: 'Élévation latérale poulie', muscle: 'epaule_laterale', type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
    { id: 'triceps_un_bras', nom: 'Extension triceps un bras', muscle: 'triceps', type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
    // Bas
    { id: 'presse', nom: 'Presse à cuisse', muscle: 'quadriceps', type: 'compose', mode: 'machine', pas: 2.5, suivreE1rm: true },
    { id: 'rdl', nom: 'Soulevé de terre roumain', muscle: 'ischios', type: 'compose', mode: 'machine', pas: 2.5, suivreE1rm: true },
    { id: 'curl_jambe_assis', nom: 'Curl jambe assis', muscle: 'ischios', type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
    { id: 'extension_jambes', nom: 'Extension de jambes', muscle: 'quadriceps', type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
    { id: 'mollets_machine', nom: 'Mollets machine', muscle: 'mollets', type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
    { id: 'releve_genoux', nom: 'Relevé de genoux', muscle: 'abdos', type: 'isolation', mode: 'poids_corps', pas: 2.5, suivreE1rm: false },
    // Haut B
    { id: 'tractions', nom: 'Tractions pronation', muscle: 'dos', type: 'compose', mode: 'poids_corps', pas: 2.5, suivreE1rm: true },
    { id: 'super_row', nom: 'Super-row overhand poulie', muscle: 'dos', type: 'compose', mode: 'machine', pas: 2.5, suivreE1rm: true },
    { id: 'incline_machine', nom: 'Développé incliné machine', muscle: 'pecs', secondaires: triceps05, type: 'compose', mode: 'machine', pas: 2.5, suivreE1rm: true },
    { id: 'bras_tendus', nom: 'Tirage bras tendus poulie haute', muscle: 'dos', type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
    { id: 'face_pull', nom: 'Face pull', muscle: 'epaule_arriere', type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
    { id: 'elevation_machine', nom: 'Élévation latérale machine à plaques', muscle: 'epaule_laterale', type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
    { id: 'curl_araignee', nom: 'Curl araignée', muscle: 'biceps', type: 'isolation', mode: 'machine', pas: 2, suivreE1rm: false },
    // Haut C
    { id: 'dips', nom: 'Dips penchés en avant', muscle: 'pecs', secondaires: triceps05, type: 'compose', mode: 'poids_corps', pas: 2.5, suivreE1rm: true },
    { id: 'butterfly_haut', nom: 'Butterfly prise haute', muscle: 'pecs', type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false, notes: 'Siège plus bas ; sur la machine à siège fixe, tenir le haut de la poignée.' },
    { id: 'tirage_vertical_v', nom: 'Tirage vertical prise neutre (V)', muscle: 'dos', type: 'compose', mode: 'machine', pas: 2.5, suivreE1rm: true },
    { id: 'oiseau', nom: 'Oiseau machine', muscle: 'epaule_arriere', type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
    { id: 'triceps_tete', nom: 'Extension triceps au-dessus de la tête', muscle: 'triceps', type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
    { id: 'curl_marteau', nom: 'Curl marteau poulie', muscle: 'biceps', type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
    // Bas — maison
    { id: 'squat_bulgare', nom: 'Squat bulgare (par jambe)', muscle: 'quadriceps', type: 'compose', mode: 'par_main', pas: 2, chargeMax: 24, suivreE1rm: false, notes: 'Pied arrière sur le banc.' },
    { id: 'rdl_halteres', nom: 'Soulevé de terre roumain haltères', muscle: 'ischios', type: 'compose', mode: 'par_main', pas: 2, chargeMax: 24, suivreE1rm: false, notes: 'Descente en 3 s.' },
    { id: 'extension_elastique', nom: 'Extension de jambe élastique', muscle: 'quadriceps', type: 'isolation', mode: 'elastique', pas: 1, suivreE1rm: false },
    { id: 'curl_elastique', nom: 'Curl de jambe élastique', muscle: 'ischios', type: 'isolation', mode: 'elastique', pas: 1, suivreE1rm: false },
    { id: 'mollets_haltere', nom: 'Mollets une jambe, haltère', muscle: 'mollets', type: 'isolation', mode: 'par_main', pas: 2, chargeMax: 24, suivreE1rm: false },
    { id: 'releve_jambes_banc', nom: 'Relevés de jambes sur banc', muscle: 'abdos', type: 'isolation', mode: 'poids_corps', pas: 2.5, suivreE1rm: false },
];
export const EXERCICES = Object.fromEntries(liste.map((e) => [e.id, e]));
export const MUSCLES = [
    { id: 'pecs', nom: 'Pecs', cible: 16 },
    { id: 'dos', nom: 'Dos', cible: 18 },
    { id: 'epaule_laterale', nom: 'Épaule latérale', cible: 6 },
    { id: 'epaule_arriere', nom: "Arrière d'épaule", cible: 5 },
    { id: 'triceps', nom: 'Triceps', cible: 9.5 },
    { id: 'biceps', nom: 'Biceps', cible: 6 },
    { id: 'quadriceps', nom: 'Quadriceps', cible: 5 },
    { id: 'ischios', nom: 'Ischios / fessiers', cible: 6 },
    { id: 'mollets', nom: 'Mollets', cible: 3 },
    { id: 'abdos', nom: 'Abdos', cible: 3 },
];
