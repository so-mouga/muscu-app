/** Consignes d'exécution : position de départ, étapes, erreurs fréquentes. */
export interface Consigne {
  depart: string
  etapes: string[]
  erreurs: string[]
}

type Brut = [string, string[], string[]]

const C: Record<string, Brut> = {
  // Pecs
  smith_incline: ['Banc incliné à 30° sous la barre guidée', ['Omoplates serrées, pieds ancrés', 'Descends la barre vers le haut des pecs', 'Pousse sans verrouiller les coudes'], ['Banc trop incliné (travaille les épaules)', 'Coudes écartés à 90°']],
  incline_machine: ['Assis, poignées à hauteur du haut des pecs', ['Dos plaqué, omoplates serrées', 'Pousse en gardant les coudes un peu rentrés', 'Reviens lentement jusqu’à l’étirement'], ['Décoller le dos du dossier', 'Amplitude coupée en bas']],
  butterfly: ['Assis, bras ouverts, coudes légèrement fléchis', ['Rapproche les mains en serrant les pecs', 'Marque une courte pause bras fermés', 'Ouvre lentement jusqu’à l’étirement'], ['Pousser avec les bras tendus', 'Revenir trop vite']],
  butterfly_haut: ['Siège bas, poignées tenues par le haut', ['Rapproche les mains vers le bas', 'Serre les pecs en fin de mouvement', 'Ouvre lentement'], ['Hausser les épaules', 'Revenir sans contrôle']],
  dips: ['En appui sur les barres, bras tendus', ['Penche le buste en avant', 'Descends jusqu’à sentir l’étirement des pecs', 'Remonte sans verrouiller'], ['Descendre trop bas avec douleur à l’épaule', 'Buste trop droit (triceps)']],
  dev_couche_barre: ['Allongé sur un banc, yeux sous la barre', ['Omoplates serrées, pieds ancrés au sol', 'Descends la barre jusqu’à la ligne des pecs', 'Pousse sans verrouiller les coudes'], ['Cambrer excessivement le dos', 'Écarter les coudes à 90°', 'Faire rebondir la barre sur la poitrine']],
  dev_couche_halteres: ['Allongé, haltères au-dessus de la poitrine', ['Descends les haltères sur les côtés des pecs', 'Coudes à 45° du buste', 'Pousse en rapprochant légèrement les haltères'], ['Descendre trop vite', 'Haltères qui partent vers la tête']],
  dev_couche_smith: ['Allongé sous la barre guidée, barre au-dessus des pecs', ['Omoplates serrées', 'Descends jusqu’à effleurer la poitrine', 'Pousse sans verrouiller'], ['Banc mal placé (barre vers le cou)', 'Rebond sur la poitrine']],
  dev_couche_machine: ['Assis, poignées à hauteur des pecs', ['Dos plaqué au dossier', 'Pousse devant toi', 'Reviens lentement jusqu’à l’étirement'], ['Siège trop haut ou trop bas', 'Décoller les épaules du dossier']],
  dev_incline_barre: ['Banc incliné à 30°, barre au-dessus du haut des pecs', ['Omoplates serrées', 'Descends vers le haut de la poitrine', 'Pousse à la verticale'], ['Banc trop incliné', 'Coudes trop écartés']],
  dev_incline_halteres: ['Banc incliné à 30°, haltères au-dessus des épaules', ['Descends sur les côtés du haut des pecs', 'Coudes à 45°', 'Pousse en rapprochant les haltères'], ['Amplitude coupée', 'Dos qui se décolle']],
  dev_decline_barre: ['Banc décliné, jambes bloquées', ['Descends la barre vers le bas des pecs', 'Contrôle la descente', 'Pousse sans verrouiller'], ['Barre qui descend vers le cou', 'Rebond']],
  ecarte_halteres: ['Allongé, haltères au-dessus de la poitrine, coudes un peu fléchis', ['Ouvre les bras en arc de cercle', 'Descends jusqu’à l’étirement', 'Referme comme pour enlacer un arbre'], ['Bras tendus (stress sur les coudes)', 'Descendre trop bas']],
  ecarte_incline_halteres: ['Banc incliné à 30°, haltères au-dessus', ['Ouvre en arc de cercle', 'Étirement contrôlé', 'Referme en serrant le haut des pecs'], ['Transformer en développé', 'Charge trop lourde']],
  ecarte_poulie: ['Debout entre les poulies hautes, un pied devant', ['Buste légèrement penché', 'Ramène les mains devant toi, vers le bas', 'Reviens lentement'], ['Tirer avec le dos', 'Coudes qui se plient trop']],
  ecarte_poulie_basse: ['Debout entre les poulies basses', ['Ramène les mains vers le haut, devant le visage', 'Serre le haut des pecs', 'Reviens lentement'], ['Cambrer le dos', 'Hausser les épaules']],
  pompes: ['Mains un peu plus larges que les épaules, corps gainé', ['Descends la poitrine près du sol', 'Coudes à 45°', 'Pousse en gardant le corps droit'], ['Bassin qui s’affaisse', 'Amplitude partielle']],
  pull_over_haltere: ['Allongé en travers ou sur un banc, haltère au-dessus de la poitrine', ['Bras légèrement fléchis', 'Descends l’haltère derrière la tête', 'Remonte au-dessus de la poitrine'], ['Plier les coudes en cours de route', 'Descendre trop bas']],
  // Dos
  tirage_large: ['Assis, cuisses calées, barre prise large', ['Poitrine sortie', 'Tire la barre vers le haut de la poitrine', 'Remonte lentement bras tendus'], ['Tirer derrière la nuque', 'Se balancer en arrière']],
  tirage_horizontal: ['Assis, pieds calés, poignée neutre', ['Dos droit', 'Tire vers le nombril en serrant les omoplates', 'Reviens en laissant les épaules s’avancer'], ['Arrondir le dos', 'Tirer avec le buste']],
  tractions: ['Suspendu, prise pronation un peu plus large que les épaules', ['Abaisse les épaules', 'Monte la poitrine vers la barre', 'Redescends bras tendus'], ['Balancer les jambes', 'Amplitude partielle']],
  super_row: ['Assis face à la poulie, prise pronation', ['Tire en écartant les coudes', 'Serre le haut du dos', 'Reviens lentement'], ['Hausser les épaules', 'Tirer avec le buste']],
  bras_tendus: ['Debout face à la poulie haute, bras tendus', ['Buste légèrement penché', 'Ramène la barre vers les cuisses bras tendus', 'Remonte lentement'], ['Plier les coudes', 'Bouger le buste']],
  tirage_vertical_v: ['Assis, poignée en V', ['Poitrine sortie', 'Tire vers le haut de la poitrine', 'Remonte bras tendus'], ['Se pencher trop en arrière', 'Coupler l’amplitude']],
  rowing_barre: ['Debout, buste penché à 45°, barre en pronation', ['Dos plat, genoux fléchis', 'Tire la barre vers le bas du ventre', 'Redescends bras tendus'], ['Dos arrondi', 'Se relever pour tirer']],
  rowing_haltere: ['Un genou et une main sur le banc, haltère dans l’autre main', ['Dos plat', 'Tire l’haltère vers la hanche', 'Redescends en étirant'], ['Tourner le buste', 'Tirer vers l’épaule']],
  rowing_t: ['Debout au-dessus de la barre, buste penché', ['Dos plat', 'Tire la poignée vers la poitrine', 'Redescends contrôlé'], ['Dos arrondi', 'À-coups']],
  rowing_machine: ['Poitrine contre l’appui, poignées devant', ['Tire en serrant les omoplates', 'Coudes près du corps', 'Reviens lentement'], ['Décoller la poitrine', 'Amplitude coupée']],
  tirage_poitrine_serre: ['Assis, barre prise serrée', ['Poitrine sortie', 'Tire vers le haut de la poitrine', 'Remonte bras tendus'], ['Se balancer', 'Tirer avec les bras seulement']],
  tirage_unilateral: ['À genoux ou assis, poignée dans une main', ['Tire le coude vers la hanche', 'Serre le dos en bas', 'Remonte en étirant'], ['Tourner le buste', 'Hausser l’épaule']],
  tirage_horizontal_large: ['Assis, barre large en pronation', ['Tire vers le bas de la poitrine coudes écartés', 'Serre le haut du dos', 'Reviens lentement'], ['Tirer avec le buste', 'Hausser les épaules']],
  tractions_supination: ['Suspendu, paumes vers toi, prise largeur d’épaules', ['Abaisse les épaules', 'Monte le menton au-dessus de la barre', 'Redescends bras tendus'], ['Balancer', 'Amplitude partielle']],
  tractions_assistees: ['Genoux sur la plateforme, prise pronation', ['Abaisse les épaules', 'Monte la poitrine vers la barre', 'Redescends lentement'], ['Trop d’assistance', 'Descente sans contrôle']],
  souleve_terre: ['Debout, barre au-dessus du milieu du pied', ['Dos plat, poitrine sortie, barre contre les tibias', 'Pousse dans le sol pour te relever', 'Redescends en reculant les hanches'], ['Dos arrondi', 'Barre éloignée du corps', 'Hyperextension en haut']],
  pull_over_poulie: ['Debout face à la poulie haute, corde en main', ['Buste penché, bras presque tendus', 'Ramène la corde vers les hanches', 'Remonte lentement'], ['Plier les coudes', 'Bouger le buste']],
  // Trapèzes
  shrug_halteres: ['Debout, haltères le long du corps', ['Monte les épaules vers les oreilles', 'Tiens une seconde', 'Redescends lentement'], ['Rouler les épaules', 'Plier les coudes']],
  shrug_barre: ['Debout, barre devant les cuisses', ['Monte les épaules', 'Pause en haut', 'Redescends contrôlé'], ['Rouler les épaules', 'Charge trop lourde, amplitude minuscule']],
  shrug_machine: ['Sous les appuis de la machine', ['Monte les épaules', 'Pause en haut', 'Redescends lentement'], ['Plier les genoux pour aider', 'Amplitude coupée']],
  // Lombaires
  extension_lombaire: ['Sur le banc à 45°, hanches sur l’appui', ['Descends le buste dos droit', 'Remonte jusqu’à l’alignement', 'Sans dépasser la ligne du corps'], ['Hyperextension en haut', 'À-coups']],
  extension_lombaire_machine: ['Assis, dos contre l’appui', ['Pousse vers l’arrière en dépliant le buste', 'Contrôle le retour', 'Garde la nuque neutre'], ['Charge trop lourde', 'Mouvement brusque']],
  good_morning: ['Debout, barre sur le haut du dos', ['Genoux légèrement fléchis', 'Penche le buste en reculant les hanches', 'Remonte dos plat'], ['Dos arrondi', 'Descendre trop bas']],
  // Épaules
  dev_militaire: ['Debout, barre sur le haut de la poitrine', ['Gaine les abdos et les fessiers', 'Pousse la barre au-dessus de la tête', 'Redescends devant le visage'], ['Cambrer le bas du dos', 'Pousser la barre loin devant']],
  dev_epaules_halteres: ['Assis dos calé, haltères à hauteur des oreilles', ['Pousse au-dessus de la tête', 'Rapproche légèrement les haltères', 'Redescends à hauteur des oreilles'], ['Cambrer', 'Descendre trop bas']],
  dev_epaules_machine: ['Assis, poignées à hauteur des épaules', ['Dos plaqué', 'Pousse vers le haut', 'Redescends lentement'], ['Siège mal réglé', 'Verrouiller les coudes']],
  dev_epaules_smith: ['Assis sur un banc droit sous la barre guidée', ['Barre devant le visage', 'Pousse vers le haut', 'Redescends au menton'], ['Barre derrière la nuque', 'Dos décollé']],
  dev_arnold: ['Assis, haltères devant le visage paumes vers toi', ['Pousse en tournant les paumes vers l’avant', 'Bras presque tendus en haut', 'Redescends en tournant à l’inverse'], ['Mouvement trop rapide', 'Cambrer']],
  elevation_frontale_halteres: ['Debout, haltères devant les cuisses', ['Monte un bras tendu devant toi', 'Jusqu’à hauteur des yeux', 'Redescends lentement'], ['Balancer le buste', 'Monter trop haut']],
  elevation_frontale_poulie: ['Dos à la poulie basse, poignée entre les jambes', ['Monte bras tendu devant toi', 'Jusqu’à hauteur des épaules', 'Redescends lentement'], ['Se pencher en arrière', 'Plier le bras']],
  elevation_poulie: ['De profil à la poulie basse, poignée dans la main opposée', ['Monte le bras sur le côté', 'Jusqu’à hauteur d’épaule', 'Redescends lentement'], ['Hausser l’épaule', 'Bras qui part devant']],
  elevation_machine: ['Assis, coudes contre les appuis', ['Monte les coudes sur le côté', 'Jusqu’à hauteur d’épaule', 'Redescends lentement'], ['Hausser les épaules', 'À-coups']],
  elevation_laterale_halteres: ['Debout, haltères le long du corps', ['Coudes légèrement fléchis', 'Monte sur les côtés jusqu’aux épaules', 'Redescends lentement'], ['Balancer le buste', 'Monter plus haut que les épaules', 'Hausser les épaules']],
  rowing_menton: ['Debout, barre en pronation large', ['Monte la barre le long du corps', 'Coudes plus hauts que les mains', 'Jusqu’au bas de la poitrine'], ['Prise trop serrée (épaules)', 'Monter trop haut']],
  oiseau: ['Assis face à la machine, bras devant', ['Ouvre les bras vers l’arrière', 'Serre l’arrière des épaules', 'Reviens lentement'], ['Serrer les omoplates (dos)', 'À-coups']],
  oiseau_halteres: ['Buste penché presque à l’horizontale, haltères sous la poitrine', ['Coudes légèrement fléchis', 'Ouvre les bras sur les côtés', 'Redescends lentement'], ['Se redresser', 'Tirer avec le dos']],
  oiseau_poulie: ['Entre deux poulies hautes, câbles croisés', ['Bras tendus devant toi', 'Ouvre en arrière à hauteur d’épaule', 'Reviens lentement'], ['Plier les coudes', 'Hausser les épaules']],
  face_pull: ['Face à la poulie haute, corde en main', ['Tire la corde vers le visage', 'Écarte les mains en fin de mouvement', 'Reviens lentement'], ['Tirer vers la poitrine', 'Se pencher en arrière']],
  // Biceps
  curl_araignee: ['Poitrine contre le pupitre incliné, bras pendants', ['Monte la charge en pliant les coudes', 'Serre en haut', 'Redescends jusqu’à bras tendus'], ['Amplitude coupée', 'Décoller la poitrine']],
  curl_marteau: ['Debout face à la poulie basse, corde en prise neutre', ['Coudes collés au corps', 'Monte en gardant les pouces vers le haut', 'Redescends lentement'], ['Coudes qui avancent', 'Balancer']],
  curl_barre: ['Debout, barre en supination, largeur d’épaules', ['Coudes collés au corps', 'Monte la barre vers les épaules', 'Redescends lentement'], ['Balancer le buste', 'Coudes qui avancent']],
  curl_barre_ez: ['Debout, barre EZ en supination', ['Coudes fixes', 'Monte jusqu’à la contraction', 'Redescends bras tendus'], ['Tricher avec le dos', 'Amplitude partielle']],
  curl_halteres: ['Debout ou assis, haltères le long du corps', ['Monte en tournant la paume vers le haut', 'Serre en haut', 'Redescends lentement'], ['Balancer', 'Coudes qui bougent']],
  curl_marteau_halteres: ['Debout, haltères en prise neutre', ['Coudes collés', 'Monte pouces vers le haut', 'Redescends lentement'], ['Balancer', 'Coudes qui avancent']],
  curl_incline: ['Assis sur un banc incliné à 45°, bras pendants', ['Coudes en arrière du buste', 'Monte sans avancer les coudes', 'Redescends jusqu’à l’étirement'], ['Coudes qui avancent', 'Charge trop lourde']],
  curl_pupitre: ['Assis, bras posés sur le pupitre', ['Monte la charge', 'Serre en haut', 'Redescends presque bras tendus'], ['Décoller les bras', 'Descente brutale']],
  curl_poulie_basse: ['Debout face à la poulie basse, barre en supination', ['Coudes collés', 'Monte vers les épaules', 'Redescends lentement'], ['Se pencher en arrière', 'Coudes qui avancent']],
  curl_bayesian: ['Dos à la poulie basse, bras tiré vers l’arrière', ['Coude en arrière du corps', 'Monte la main vers l’épaule', 'Redescends jusqu’à l’étirement'], ['Avancer le coude', 'Tourner le buste']],
  curl_concentre: ['Assis, coude posé contre l’intérieur de la cuisse', ['Monte l’haltère vers l’épaule', 'Serre en haut', 'Redescends bras tendu'], ['Bouger le coude', 'Aider avec le buste']],
  // Triceps
  triceps_un_bras: ['Face à la poulie haute, poignée dans une main', ['Coude collé au corps', 'Tends le bras vers le bas', 'Remonte lentement'], ['Coude qui bouge', 'Se pencher sur la charge']],
  triceps_tete: ['Dos à la poulie, corde au-dessus de la tête', ['Coudes fixes près de la tête', 'Tends les bras vers l’avant', 'Reviens jusqu’à l’étirement'], ['Coudes qui s’écartent', 'Cambrer']],
  barre_front: ['Allongé, barre EZ au-dessus du front', ['Coudes fixes', 'Descends la barre vers le front ou derrière la tête', 'Tends les bras'], ['Coudes qui s’écartent', 'Bouger les épaules']],
  extension_corde: ['Face à la poulie haute, corde en main', ['Coudes collés au corps', 'Tends les bras en écartant la corde en bas', 'Remonte lentement'], ['Coudes qui avancent', 'Pousser avec le buste']],
  extension_barre_poulie: ['Face à la poulie haute, barre en pronation', ['Coudes collés', 'Pousse la barre vers les cuisses', 'Remonte lentement'], ['Coudes qui bougent', 'Se pencher dessus']],
  extension_haltere_tete: ['Assis, haltère tenu à deux mains au-dessus de la tête', ['Coudes près de la tête', 'Descends l’haltère derrière la nuque', 'Tends les bras'], ['Coudes écartés', 'Cambrer']],
  kickback: ['Buste penché, coude collé au corps, bras à 90°', ['Tends le bras vers l’arrière', 'Serre le triceps', 'Reviens lentement'], ['Coude qui descend', 'Balancer']],
  dev_couche_serre: ['Allongé, barre prise largeur d’épaules', ['Coudes près du corps', 'Descends vers le bas des pecs', 'Pousse'], ['Prise trop serrée (poignets)', 'Coudes écartés']],
  dips_machine: ['Assis, poignées sur les côtés', ['Dos contre le dossier', 'Pousse vers le bas', 'Remonte lentement'], ['Hausser les épaules', 'Amplitude coupée']],
  dips_banc: ['Mains sur un banc derrière toi, pieds sur un autre', ['Descends en pliant les coudes', 'Jusqu’à 90°', 'Remonte bras tendus'], ['Descendre trop bas (épaules)', 'Coudes écartés']],
  // Avant-bras
  curl_poignet: ['Assis, avant-bras sur les cuisses, paumes vers le haut', ['Laisse la barre rouler dans les doigts', 'Monte en pliant les poignets', 'Redescends lentement'], ['Bouger les avant-bras', 'Charge trop lourde']],
  curl_poignet_inverse: ['Assis, avant-bras sur les cuisses, paumes vers le bas', ['Monte le dos de la main', 'Pause en haut', 'Redescends lentement'], ['Charge trop lourde', 'Amplitude minuscule']],
  curl_inverse: ['Debout, barre EZ en pronation', ['Coudes collés', 'Monte la barre vers les épaules', 'Redescends lentement'], ['Poignets cassés', 'Balancer']],
  marche_fermier: ['Debout, un haltère lourd dans chaque main', ['Gaine-toi, épaules basses', 'Marche à petits pas réguliers', 'Pose les haltères sans arrondir le dos'], ['Se pencher sur le côté', 'Hausser les épaules']],
  // Quadriceps
  presse: ['Assis, pieds largeur d’épaules sur la plateforme', ['Descends jusqu’à ~90° aux genoux', 'Bas du dos collé au dossier', 'Pousse sans verrouiller les genoux'], ['Bassin qui se décolle en bas', 'Genoux qui rentrent']],
  extension_jambes: ['Assis, genoux alignés avec l’axe de la machine', ['Tends les jambes', 'Serre les quadriceps en haut', 'Redescends lentement'], ['À-coups', 'Décoller les fesses']],
  squat_bulgare: ['Pied arrière sur un banc, haltères en main', ['Descends le genou arrière vers le sol', 'Buste légèrement penché', 'Pousse dans le talon avant'], ['Pied avant trop près du banc', 'Genou qui rentre']],
  extension_elastique: ['Assis, élastique fixé derrière, autour de la cheville', ['Tends la jambe', 'Serre en haut', 'Reviens lentement'], ['Élastique pas assez tendu au départ', 'À-coups']],
  squat_barre: ['Barre sur le haut du dos, pieds largeur d’épaules', ['Gaine-toi, poitrine sortie', 'Descends en poussant les genoux vers l’extérieur', 'Remonte en poussant dans le sol'], ['Dos qui s’arrondit en bas', 'Genoux qui rentrent', 'Talons qui décollent']],
  squat_avant: ['Barre sur l’avant des épaules, coudes hauts', ['Buste droit', 'Descends profond', 'Remonte coudes hauts'], ['Coudes qui tombent', 'Buste qui plonge']],
  squat_smith: ['Sous la barre guidée, pieds un peu devant', ['Descends en gardant le dos droit', 'Jusqu’à cuisses parallèles', 'Pousse dans les talons'], ['Pieds trop en arrière', 'Genoux qui rentrent']],
  hack_squat: ['Dos contre le dossier, épaules sous les appuis', ['Descends profond', 'Genoux dans l’axe des pieds', 'Pousse sans verrouiller'], ['Talons qui décollent', 'Bassin qui se décolle']],
  goblet_squat: ['Debout, haltère tenu contre la poitrine', ['Descends entre les jambes', 'Coudes à l’intérieur des genoux', 'Remonte buste droit'], ['Talons qui décollent', 'Dos arrondi']],
  presse_unilaterale: ['Assis, un pied au centre de la plateforme', ['Descends sur une jambe', 'Genou dans l’axe', 'Pousse sans verrouiller'], ['Bassin qui tourne', 'Amplitude coupée']],
  fentes_halteres: ['Debout, haltères en main', ['Grand pas en avant', 'Descends le genou arrière vers le sol', 'Reviens en poussant sur la jambe avant'], ['Genou avant qui rentre', 'Pas trop court']],
  fentes_marchees: ['Debout, haltères en main', ['Avance d’un grand pas', 'Descends le genou arrière', 'Enchaîne avec l’autre jambe'], ['Buste qui plonge', 'Pas trop courts']],
  step_up: ['Face à un banc, haltères en main', ['Pose un pied entier sur le banc', 'Monte en poussant sur ce pied', 'Redescends lentement'], ['Pousser avec la jambe d’en bas', 'Genou qui rentre']],
  sissy_squat: ['Debout, une main sur un appui', ['Penche-toi en arrière en avançant les genoux', 'Descends sur la pointe des pieds', 'Remonte en contractant les quadriceps'], ['Plier aux hanches', 'Descendre trop vite']],
  // Ischios
  rdl: ['Debout, charge devant les cuisses', ['Genoux légèrement fléchis', 'Recule les hanches, dos plat', 'Remonte en poussant les hanches vers l’avant'], ['Dos arrondi', 'Plier les genoux comme un squat']],
  rdl_halteres: ['Debout, haltères devant les cuisses', ['Genoux légèrement fléchis', 'Descends en reculant les hanches', 'Remonte en serrant les fessiers'], ['Dos arrondi', 'Haltères éloignés des jambes']],
  curl_jambe_assis: ['Assis, genoux alignés avec l’axe, cuisses bloquées', ['Plie les jambes vers le bas', 'Serre en bas', 'Remonte lentement'], ['Décoller les fesses', 'À-coups']],
  curl_elastique: ['Allongé sur le ventre, élastique à la cheville', ['Ramène le talon vers les fesses', 'Serre', 'Reviens lentement'], ['Bassin qui se décolle', 'Élastique trop mou']],
  curl_jambe_allonge: ['Allongé sur le ventre, rouleau au-dessus des talons', ['Ramène les talons vers les fesses', 'Hanches collées au banc', 'Redescends lentement'], ['Bassin qui se décolle', 'À-coups']],
  curl_jambe_debout: ['Debout, une jambe sous le rouleau', ['Plie la jambe vers les fesses', 'Serre en haut', 'Redescends lentement'], ['Bouger la hanche', 'Charge trop lourde']],
  rdl_barre: ['Debout, barre devant les cuisses', ['Genoux presque tendus', 'Descends la barre le long des jambes, dos plat', 'Remonte en serrant les fessiers'], ['Dos arrondi', 'Barre loin des jambes']],
  nordic_curl: ['À genoux, chevilles bloquées', ['Corps droit des genoux à la tête', 'Descends vers l’avant le plus lentement possible', 'Rattrape-toi avec les mains et remonte'], ['Plier aux hanches', 'Descente trop rapide']],
  // Fessiers
  hip_thrust_barre: ['Haut du dos sur un banc, barre sur les hanches', ['Pieds à plat, tibias verticaux en haut', 'Monte les hanches en serrant les fessiers', 'Redescends contrôlé'], ['Cambrer le bas du dos', 'Pieds trop loin']],
  hip_thrust_machine: ['Haut du dos contre l’appui, ceinture sur les hanches', ['Monte les hanches', 'Serre les fessiers en haut', 'Redescends lentement'], ['Cambrer', 'Pousser avec les pointes de pieds']],
  pont_fessier: ['Allongé sur le dos, genoux fléchis', ['Monte les hanches', 'Serre les fessiers une seconde', 'Redescends lentement'], ['Cambrer le bas du dos', 'Pousser sur les orteils']],
  kickback_poulie: ['Face à la poulie basse, sangle à la cheville', ['Buste légèrement penché', 'Pousse la jambe vers l’arrière', 'Reviens lentement'], ['Cambrer', 'Balancer la jambe']],
  abduction_machine: ['Assis, cuisses contre les appuis', ['Écarte les jambes', 'Pause en position ouverte', 'Referme lentement'], ['Revenir trop vite', 'Se décoller du dossier']],
  fentes_arriere: ['Debout, haltères en main', ['Grand pas en arrière', 'Descends le genou arrière', 'Reviens en poussant sur le talon avant'], ['Buste qui plonge', 'Pas trop court']],
  // Adducteurs
  adduction_machine: ['Assis, cuisses écartées contre les appuis', ['Rapproche les jambes', 'Serre une seconde', 'Ouvre lentement'], ['Écart trop grand au départ', 'À-coups']],
  adduction_poulie: ['De profil à la poulie basse, sangle à la cheville intérieure', ['Ramène la jambe devant l’autre', 'Serre', 'Reviens lentement'], ['Pencher le buste', 'Balancer']],
  squat_sumo: ['Pieds très écartés, pointes vers l’extérieur, haltère entre les jambes', ['Descends buste droit', 'Genoux dans l’axe des pieds', 'Remonte en serrant les adducteurs'], ['Genoux qui rentrent', 'Dos arrondi']],
  // Mollets
  mollets_machine: ['Pointes de pieds sur la marche, talons dans le vide', ['Descends les talons au maximum', 'Monte sur la pointe des pieds', 'Pause en haut'], ['Rebondir en bas', 'Plier les genoux']],
  mollets_haltere: ['Une pointe de pied sur une marche, haltère dans la main', ['Descends le talon', 'Monte le plus haut possible', 'Pause en haut'], ['Rebondir', 'Amplitude coupée']],
  mollets_debout: ['Épaules sous les appuis, pointes sur la marche', ['Descends les talons', 'Monte sur les pointes', 'Pause en haut'], ['Rebondir', 'Plier les genoux']],
  mollets_assis: ['Assis, genoux sous l’appui, pointes sur la marche', ['Descends les talons', 'Monte au maximum', 'Pause en haut'], ['Rebondir', 'Amplitude coupée']],
  mollets_presse: ['Assis à la presse, pointes au bas de la plateforme', ['Jambes presque tendues', 'Pousse avec les pointes', 'Reviens jusqu’à l’étirement'], ['Plier les genoux', 'Pieds qui glissent']],
  mollets_smith: ['Sous la barre guidée, pointes sur une marche', ['Descends les talons', 'Monte sur les pointes', 'Pause en haut'], ['Rebondir', 'Plier les genoux']],
  // Abdos
  releve_genoux: ['En appui sur les avant-bras ou suspendu', ['Monte les genoux vers la poitrine', 'Enroule le bassin', 'Redescends lentement'], ['Balancer', 'Ne pas enrouler le bassin']],
  releve_jambes_banc: ['Allongé sur un banc, mains derrière la tête', ['Jambes tendues', 'Monte les jambes à la verticale', 'Redescends sans toucher le banc'], ['Cambrer le bas du dos', 'Élan']],
  crunch: ['Allongé, genoux fléchis, mains aux tempes', ['Enroule le haut du dos', 'Rapproche les côtes du bassin', 'Redescends lentement'], ['Tirer sur la nuque', 'Remonter tout le buste']],
  crunch_poulie: ['À genoux face à la poulie haute, corde derrière la tête', ['Enroule le buste vers le sol', 'Rapproche les coudes des cuisses', 'Remonte lentement'], ['Tirer avec les bras', 'Bouger les hanches']],
  crunch_machine: ['Assis, poignées en main ou appuis sur la poitrine', ['Enroule le buste', 'Serre les abdos', 'Reviens lentement'], ['Tirer avec les bras', 'Charge trop lourde']],
  releve_jambes_suspendu: ['Suspendu à une barre', ['Monte les jambes devant toi', 'Enroule le bassin en haut', 'Redescends lentement'], ['Balancer', 'Élan']],
  roulette: ['À genoux, mains sur la roue', ['Gaine les abdos', 'Roule vers l’avant le plus loin possible', 'Reviens en contractant les abdos'], ['Cambrer le bas du dos', 'Aller trop loin']],
  gainage: ['En appui sur les avant-bras et les pointes de pieds', ['Corps droit des épaules aux talons', 'Serre abdos et fessiers', 'Respire calmement'], ['Bassin trop haut ou trop bas', 'Bloquer la respiration']],
  pallof: ['De profil à la poulie, poignée contre la poitrine', ['Tends les bras devant toi', 'Résiste à la rotation', 'Ramène les mains'], ['Tourner le buste', 'Cambrer']],
  russian_twist: ['Assis, buste incliné en arrière, pieds au sol ou décollés', ['Tourne le buste d’un côté', 'Puis de l’autre', 'Garde le dos droit'], ['Bouger seulement les bras', 'Dos arrondi']],
}

export function consigne(id: string): Consigne | undefined {
  const c = C[id]
  return c && { depart: c[0], etapes: c[1], erreurs: c[2] }
}

export const AVEC_CONSIGNE = new Set(Object.keys(C))
