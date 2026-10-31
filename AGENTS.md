# muscu-app — règles pour les IA qui codent sur ce projet

Appli perso de musculation (PWA), en français, utilisée en salle sur un téléphone Android (Samsung S25).
En ligne sur https://so-mouga.github.io/muscu-app/ — chaque push sur `main` est déployé par GitHub Actions (`.github/workflows/deploy.yml`).

Plusieurs IA (Claude Code, Gemini/Antigravity) travaillent sur ce dépôt **à tour de rôle**, jamais en même temps.
- Avant de commencer : `git pull`, puis lire `git log --oneline -15` pour voir ce qui a changé depuis la dernière fois.
- En finissant : tout commiter et pousser. Messages de commit en français, qui disent ce que l'utilisateur voit changer.
- Ajouter ici toute nouvelle décision ou convention importante, pour l'IA suivante.

## Stack et commandes

- Vite + React 19 + TypeScript, Dexie (IndexedDB, base `muscu`), Vitest. Service worker écrit à la main. Pas de backend : tout est sur le téléphone.
- `npm run dev`, `npm test`, `npm run build`.
- Vérifier les types avec `npx tsc --noEmit -p tsconfig.json`. **Jamais `tsc -b`** : il écrit des `.js` dans `src/` que Vite prend à la place des `.ts`.
- **Ne pas lancer Prettier** (pas de config dans le projet : il reformate des fichiers entiers). Garder le style existant : lignes longues, pas de point-virgule, guillemets simples. Le formatage à l'enregistrement est coupé dans `.vscode/settings.json` (local, non versionné).
- Git : compte perso uniquement — `git -c user.email=kevin.mougammadaly@gmail.com commit …`, dépôt `so-mouga/muscu-app`.

## Organisation

- `src/types.ts` : modèle de données (Exercice, ExoPlan, SeanceModele, Programme, Seance, Serie, Cycle…).
- `src/db.ts` : tables Dexie et migrations (version 7 : table `journal` = sommeil et calories par jour). Toute nouvelle table ou index = nouvelle version.
- `src/catalogue.ts` : bibliothèque de base (`data/`) fusionnée avec ce que l'utilisateur a créé ou modifié.
- `src/screens/` : onglets Accueil, Progression (Bilan, Journal, Corps = poids + mensurations + photos, Objectifs = phase + volume par muscle), Programmes (`Seances.tsx`), Exercices, Réglages ; `SeanceEnCours.tsx` pour la séance (vue normale et plein écran).
- `src/lib/` : calculs purs, testés (`calc`, `progression`, `cycle`, `analyse`, `bilan`, `historique`…). `nav.ts` : retour Android (`useRetour`). `appareil.ts` : vibrations, sons, écran allumé.
- `src/data/` : exercices et consignes, programme de départ, échauffements, mesures, lexique.

## Conventions d'interface (validées avec l'utilisateur)

- **Tout en français**, y compris noms de variables et fonctions. Expliquer en clair, sans jargon : l'utilisateur trouve les libellés techniques peu clairs.
- **Jamais `confirm` / `alert` / `prompt` natifs** : utiliser `confirmer` / `informer` de `components/Dialogues.tsx`.
- **Enregistrement automatique partout**, pas de bouton Enregistrer. Rien ne doit se perdre en quittant un écran, y compris par la barre du bas.
- **Fenêtres** (`.modal-fond` > `.modal`) : un appui à côté les ferme en gardant ce qui est saisi. Chaque couche ouverte s'enregistre avec `useRetour` pour que le bouton retour Android la ferme.
- Une fenêtre ouverte depuis l'intérieur d'une carte doit passer par `createPortal(…, document.body)`, sinon l'en-tête de séance passe au-dessus.
- Nombres saisis au clavier : pris en compte à la fin de la saisie (`NombreCourt`), pas à chaque touche.
- Réordonner une liste : poignée ⠿ avec appui maintenu, via `useGlisser` (`lib/glisser.ts`). Pas de flèches ↑↓.
- Exercices de base : « Masquer » (réversible), jamais supprimés. Exercices créés : « Supprimer » (effacés pour de bon s'ils n'ont jamais servi).
- Couleurs uniquement via les variables CSS de `:root` (`--bg`, `--surface`, `--accent`, `--texte-2`…). Thème sombre.
- Pas d'illustrations copiées d'autres applis : icônes et pictogrammes maison en SVG.

## Décisions métier à respecter

- **Pas de progression automatique** : l'objectif par défaut est « refaire pareil » que la dernière fois. L'utilisateur monte lui-même en fin de séance.
- **Conseil de surcharge** (proposition, jamais appliquée seule) : seulement pour un exercice avec une fourchette de reps. En fin de séance, carte 💡 « Conseil » + [Appliquer] (`conseil` dans `lib/progression.ts` : une rep de plus, puis la charge quand toutes les séries sont au haut ; saut > 10 % à confirmer une fois). En séance, petite ligne « monte d'un cran » si la série d'avant dépasse le haut de 3 reps ou plus (`monterMaintenant`). Pas d'interrupteur par exercice : la fourchette suffit. RPE visé 8 par défaut, même en sèche.
- **Blocages** (`lib/blocages.ts`, règles fixes et testées, pas d'IA) : exercice bloqué = aucun progrès du meilleur 1RM estimé corrigé par le RPE (+1 % minimum ; isolation : meilleure série) depuis 3 semaines et 3 séances, hors déloads. On montre le constat et des **pistes chiffrées** (sommeil < 6 h 30, calories « pas assez » ≥ 30 % des jours, poids qui ne monte pas en prise, RPE moyen ≥ 9, pas de déload depuis 6 semaines), jamais une « cause » ; rien quand la donnée manque ; rien en sèche. Affiché dans l'Aperçu, la carte d'exercice en séance (sans pistes), le Bilan (« À retenir », « Bloqués ») et le texte partagé. Déload à avancer (`deloadConseille`) : force en baisse sur 2 exos + énergie ≤ 2/5 sur 2 des 3 dernières séances, ou baisse sur 3 exos ; rappel sur l'Accueil pendant un cycle, vers « Déload maintenant ».
- Vocabulaire : **Programme** = modèle (séances + planning) ; **Cycle** = programme lancé à une date (copie figée, déload en fin de cycle). Un cycle peut avoir un nom à lui (`nomCycle`) et 1 ou 2 **muscles prioritaires** : +4 séries dures par semaine sur leur objectif tant que le cycle couvre la date (`avecPriorites`), sans toucher aux objectifs perso (`catalogue.ciblesPerso` pour les modifier, `catalogue.cibles` / `ciblesA` priorités comprises pour l'analyse). La phase (alimentation, plusieurs cycles) reste indépendante du cycle ; elle peut avoir un **objectif de poids en ± kg** (`ecartVise`, depuis le poids au départ de la phase `poidsDepart`, oublié au changement de phase, `avancePoids`, `avisRythme`).
- Les changements faits pendant une séance ne modifient jamais la séance enregistrée (sauf « Modifier l'exercice » depuis la fiche ⓘ).
- **Accueil = journal du matin** : date, phase (semaine n sur m), séance du jour avec la liste « 🔥 À battre » (exercice, série visée, +1 rep / +2,5 kg ; 3 lignes max), puis carte « Aujourd'hui » (pesée et moyenne 7 j, une phrase d'assiette selon phase et jour d'entraînement — sans chiffres tant qu'il n'y a pas de calories —, progrès réel depuis le début de la phase via `lib/journal.ts`). Pas de citations ni de conseils génériques ; Démarrer doit rester visible sans défiler.
- Calendrier : on change aussi de mois en glissant à gauche / à droite.
- **Bilan selon la phase** (`lecturePhase` dans `lib/analyse.ts`, en tête de « À retenir » après les douleurs) : sèche = alerte si charges −5 % ou perte > 1 %/semaine, ou poids qui ne baisse pas ; « sèche qui marche » si le poids baisse et les charges tiennent. Prise = vise +0,15 à +0,25 kg/semaine : alerte (±100 kcal) sous +0,1 ou au-dessus de +0,4 kg/semaine, ou si les charges ne montent pas (attente réaliste : +1 rep/semaine sur la moitié des exos, charge toutes les 2-4 semaines) ; « prise qui marche » sinon. Maintien : rien de plus. Phase prise à la fin de la période (`phaseA`). Il faut au moins 2 semaines entre la 1re et la dernière pesée, et 2 exercices qui progressent ou régressent.
- **Calories et sommeil** : on valide, on ne compte pas. Profil (Réglages → Mon profil, réglage `profil` : taille, naissance, sexe, activité) → objectif du jour = Mifflin-St Jeor × activité (+0,05 par séance prévue) ajusté selon la phase (sèche −15 %, prise +5 %), ou fixé à la main (champ `calories` de la frise des objectifs) ; `lib/nutrition.ts`. Accueil : sommeil de la nuit (pré-rempli, un appui) et calories d'hier (Dans l'objectif / Trop / Pas assez) dans la table `journal`. Bilan : tuiles, messages (sommeil < 6 h 30 ; calories tenues mais poids immobile → l'objectif est à revoir), texte à partager. Health Connect remplira plus tard les mêmes champs.
- **Calendrier du Journal** : navigable un an en avant. Jours à venir = planning du cycle en cours (sinon du programme actif) via `prevuLe` (`lib/cycle.ts`) : cercle pointillé orange, déload en violet ; toucher un jour montre ce qui est prévu. Jour passé ou aujourd'hui : sommeil et calories du jour visibles et modifiables (enregistrés à chaque appui, `noterJournal`).
- **Objectifs personnels** (Progression → Objectifs) : une frise datée (réglage `objectifs`, `lib/objectifs.ts`). Chaque changement de phase (sèche / maintien / prise), de fin prévue ou de volume par muscle ajoute une étape qui reprend le reste ; on ne réécrit jamais le passé (données pour le bilan et la future IA). `catalogue.cibles` = volume en vigueur, `catalogue.ciblesA(date)` pour une période passée. Les mêmes pour tous les programmes et cycles ; `Programme.volume`, `Cycle.volume` et les anciens réglages `phases` / `objectifsVolume` ne servent plus que de repli. Phase « Aucune » possible. **Phases en blocs** (`components/Phases.tsx`) : en cours (modifiée par une étape datée d'aujourd'hui), à venir (modifiables sur place, supprimables), passées (figées, avec le poids réel). « + Ajouter une phase après » enchaîne à la fin prévue de la dernière ; allonger, raccourcir ou supprimer décale les phases à venir (`dureePhase`, `supprimerPhase`, `terminerPhase`, `deplacerPhase` dans `lib/objectifs.ts`). Deux phases du même type qui se suivent se fondent en une. Phase visible en trait de couleur sous les jours du calendrier, et dans le texte « Partager ce bilan ». Calories visées : plus tard (Android).
- Séries dures = RPE ≥ 7 ; volume par muscle = séries dures par semaine, secondaires à 0,5.
- Exercices équivalents : chacun garde sa propre progression, le lien sert de repère.
- Échauffement général : 1re étape de la séance (pas un écran avant « Démarrer »), valeurs fixes juste à cocher.
- **Sauvegarde** : données uniquement sur le téléphone. Rappel sur l'Accueil après 7 jours sans export (masquable une semaine) ; un appui exporte tout sauf les photos et ouvre le partage Android (Drive, mail…) via `sauvegarder` (`lib/sauvegarde.ts`), qui met à jour `dernierExport`. Sauvegarde Drive automatique : plus tard si besoin.
- Le Bilan ne mentionne pas d'IA pour l'instant. Sommeil, pas, calories : plus tard (version Android, Health Connect).

## Tester

- `npm test` doit passer.
- Pour un changement visible : `npm run build && npx vite preview --port 4173`, puis vérifier sur un écran de téléphone (384 × 832). L'appli démarre vide (bibliothèque de base) ; une séance se lance par « Autre séance ».
