export const FINISSEURS = {
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
};
export const ZONES = [
    ['etiree', 'étirée'],
    ['milieu', 'milieu'],
    ['contractee', 'contractée'],
];
export const typeFinisseur = (p) => p.typeFinisseur ?? 'partielles';
