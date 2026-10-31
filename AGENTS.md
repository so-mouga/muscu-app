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

## Appli Android (Capacitor)

- Dossier `android/` (Capacitor 8). L'appli charge **le site en ligne** (`server.url` dans `capacitor.config.ts`) : un push sur `main` la met à jour sans réinstaller. Un nouvel APK n'est nécessaire que si on touche à `android/`.
- `npm run android` : synchronise et construit `muscu.apk` (release, non versionné) à la racine. Il faut JDK 21 (`~/.gradle/gradle.properties` → `org.gradle.java.home`) et le SDK Android (`android/local.properties`).
- **Signature** : clé `~/.muscu/muscu-release.jks` (hors dépôt, mot de passe dans `~/.gradle/gradle.properties`, sauvegardée par l'utilisateur). Ne jamais changer de clé : les utilisateurs devraient désinstaller et perdraient leurs données.
- **Publier une nouvelle version** (seulement si `android/` a changé) : augmenter `versionCode` et `versionName` dans `android/app/build.gradle`, `npm run android`, puis `gh release create android-vX.Y muscu.apk --title … --notes …`. Lien fixe à partager : https://github.com/so-mouga/muscu-app/releases/latest/download/muscu.apk
- Première ouverture sans réseau : page « Pas de connexion » avec Réessayer (`MainActivity`).
- Essayer une version locale : `MUSCU_URL=http://10.0.2.2:4173/ npx cap sync android` (émulateur) puis rebuild ; la WebView se débogue en CDP (`adb forward tcp:9333 localabstract:webview_devtools_remote_<pid>`).
- **Minuteur de repos natif** (`android/…/MinuteurRepos*.java`, `src/lib/natif.ts`) : notification avec décompte (écran verrouillé, volet, suivi en direct Android 16), boutons +30 s / Passer, alarme exacte qui sonne et vibre écran éteint sans couper la musique. Appli à l'écran : c'est elle qui bipe, pas la notification. `natif` est faux dans le navigateur : tout le reste marche pareil.
- Les données de l'appli Android sont séparées de celles de Chrome : passer de l'un à l'autre = Exporter puis Importer.

## Organisation

- `src/types.ts` : modèle de données (Exercice, ExoPlan, SeanceModele, Programme, Seance, Serie, Cycle…).
- `src/db.ts` : tables Dexie et migrations (version 7 : table `journal` = sommeil et calories par jour). Toute nouvelle table ou index = nouvelle version.
- `src/catalogue.ts` : bibliothèque de base (`data/`) fusionnée avec ce que l'utilisateur a créé ou modifié.
- `src/screens/` : onglets Accueil, Progression (Bilan, Journal, Corps = poids + mensurations + photos, Objectifs = phase + calories), Programmes (`Seances.tsx`), Exercices, Réglages ; `SeanceEnCours.tsx` pour la séance (vue normale et plein écran).
- `src/lib/` : calculs purs, testés (`calc`, `progression`, `cycle`, `analyse`, `bilan`, `historique`…). `nav.ts` : retour Android (`useRetour`). `appareil.ts` : vibrations, sons, écran allumé.
- `src/data/` : exercices et consignes, programme de base (Recompo, celui de l'utilisateur), programmes tout prêts (`programmesTypes.ts` : Full body 3 jours, Haut / Bas 4 jours, Recompo ; volume vérifié par un test), échauffements, mesures, lexique.

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

## Nouvel utilisateur

- Pas de compte. **Première ouverture** (aucun programme enregistré, aucune séance) : l'accueil montre seulement « Pour commencer, choisis ton programme » (`ChoixProgramme`). Choisir copie les séances (ids suffixés) et rend le programme actif (`installerProgramme`). Aussi dans Programmes → « Programmes tout prêts ».
- **Retours** : Réglages → « 💬 Donner mon avis » (en haut) ouvre un mail pré-rempli vers l'auteur (`CONTACT_AVIS`, adresse publique choisie par lui), avec la version et l'appareil.
- Les séances de base (Recompo) n'apparaissent dans la bibliothèque que si un programme s'en sert ou si l'utilisateur les a modifiées.

## Décisions métier à respecter

- **Pas de progression automatique** : l'objectif par défaut est « refaire pareil » que la dernière fois. L'utilisateur monte lui-même en fin de séance.
- **Conseil de surcharge** (proposition, jamais appliquée seule) : seulement pour un exercice avec une fourchette de reps. En fin de séance, carte 💡 « Conseil » + [Appliquer] (`conseil` dans `lib/progression.ts` : une rep de plus, puis la charge quand toutes les séries sont au haut ; saut > 10 % à confirmer une fois). Série ratée (sous le bas de la fourchette à l'effort visé, même sans fourchette) → conseil « même charge, vise le bas ». Sans conseil, la carte dit pourquoi on refait pareil (`raisonPareil` : RPE trop haut, échec trop court) au lieu de « Comme aujourd'hui ». En séance, petite ligne « monte d'un cran » si la série d'avant dépasse le haut de 3 reps ou plus (`monterMaintenant`). Pas d'interrupteur par exercice : la fourchette suffit. RPE visé 8 par défaut, même en sèche.
- **Blocages** (`lib/blocages.ts`, règles fixes et testées, pas d'IA) : exercice bloqué = aucun progrès du meilleur 1RM estimé corrigé par le RPE (+1 % minimum ; isolation : meilleure série) depuis 3 semaines et 3 séances, hors déloads. On montre le constat et des **pistes chiffrées** (sommeil < 6 h 30, calories « pas assez » ≥ 30 % des jours, poids qui ne monte pas en prise, RPE moyen ≥ 9, pas de déload depuis 6 semaines), jamais une « cause » ; rien quand la donnée manque ; rien en sèche. Affiché dans l'Aperçu, la carte d'exercice en séance (sans pistes), le Bilan (« À retenir », « Bloqués ») et le texte partagé. Déload à avancer (`deloadConseille`) : force en baisse sur 2 exos + énergie ≤ 2/5 sur 2 des 3 dernières séances, ou baisse sur 3 exos ; rappel sur l'Accueil pendant un cycle, vers « Déload maintenant ».
- Vocabulaire : **Programme** = modèle (séances + planning) ; **Cycle** = programme lancé à une date (copie figée, déload en fin de cycle). Un cycle peut avoir un nom à lui (`nomCycle`) et 1 ou 2 **muscles prioritaires** (rangés sous « Plus d'options » au lancement du cycle : fonction rare, gardée discrète) : +4 séries dures par semaine sur leur objectif tant que le cycle couvre la date (`avecPriorites`), sans toucher aux objectifs perso (`catalogue.ciblesPerso` pour les modifier, `catalogue.cibles` / `ciblesA` priorités comprises pour l'analyse). La phase (alimentation, plusieurs cycles) reste indépendante du cycle ; elle peut avoir un **objectif de poids en ± kg** (`ecartVise`, depuis le poids au départ de la phase `poidsDepart`, oublié au changement de phase, `avancePoids`, `avisRythme`).
- Les changements faits pendant une séance ne modifient jamais la séance enregistrée (sauf « Modifier l'exercice » depuis la fiche ⓘ).
- **Accueil = journal du matin** : date, phase (semaine n sur m), séance du jour avec la liste « 🔥 À battre » (exercice, série visée, +1 rep / +2,5 kg ; 3 lignes max), puis carte « Aujourd'hui » (pesée et moyenne 7 j, une phrase d'assiette selon phase et jour d'entraînement — sans chiffres tant qu'il n'y a pas de calories —, progrès réel depuis le début de la phase via `lib/journal.ts`). Pas de citations ni de conseils génériques ; Démarrer doit rester visible sans défiler.
- Calendrier : on change aussi de mois en glissant à gauche / à droite.
- **Bilan selon la phase** (`lecturePhase` dans `lib/analyse.ts`, en tête de « À retenir » après les douleurs) : sèche = alerte si charges −5 % ou perte > 1 %/semaine, ou poids qui ne baisse pas ; « sèche qui marche » si le poids baisse et les charges tiennent. Prise = vise +0,15 à +0,25 kg/semaine : alerte (±100 kcal) sous +0,1 ou au-dessus de +0,4 kg/semaine, ou si les charges ne montent pas (attente réaliste : +1 rep/semaine sur la moitié des exos, charge toutes les 2-4 semaines) ; « prise qui marche » sinon. Maintien : rien de plus. Phase prise à la fin de la période (`phaseA`). Il faut au moins 2 semaines entre la 1re et la dernière pesée, et 2 exercices qui progressent ou régressent. Si la phase a commencé pendant la période, on ne la juge que depuis son début (sinon « pas encore assez de données depuis le début de la phase »). Messages calories prudents (« peut l'expliquer », « essaie 150 kcal de moins »). Assiduité comptée par semaine, plafonnée au prévu, les séances en plus à part (`faites`, `enPlus`).
- **Calories et sommeil** : on valide, on ne compte pas. Profil (Réglages → Mon profil, réglage `profil` : taille, naissance, sexe, activité) → objectif du jour = Mifflin-St Jeor × activité (+0,05 par séance prévue) ajusté selon la phase (sèche −15 %, prise +5 %), ou fixé à la main (champ `calories` de la frise des objectifs) ; `lib/nutrition.ts`. Accueil : sommeil de la nuit (choix ≤5 … 9+ h, un appui, jamais pré-rempli pour ne pas noter une fausse nuit) et calories d'hier (Dans l'objectif / Trop / Pas assez) dans la table `journal`. Bilan : tuiles, messages (sommeil < 6 h 30 ; calories tenues mais poids immobile → l'objectif est à revoir), texte à partager. Health Connect remplira plus tard les mêmes champs.
- **Calendrier du Journal** : navigable un an en avant. Jours à venir = planning du cycle en cours (sinon du programme actif) via `prevuLe` (`lib/cycle.ts`) : cercle pointillé orange, déload en violet ; toucher un jour montre ce qui est prévu. Jour passé ou aujourd'hui : sommeil et calories du jour visibles et modifiables (enregistrés à chaque appui, `noterJournal`).
- **Objectifs personnels** (Progression → Objectifs) : une frise datée (réglage `objectifs`, `lib/objectifs.ts`). Chaque changement de phase (sèche / maintien / prise), de fin prévue ou de volume par muscle ajoute une étape qui reprend le reste ; on ne réécrit jamais le passé (données pour le bilan et la future IA). `catalogue.cibles` = volume en vigueur, `catalogue.ciblesA(date)` pour une période passée. Les mêmes pour tous les programmes et cycles ; `Programme.volume`, `Cycle.volume` et les anciens réglages `phases` / `objectifsVolume` ne servent plus que de repli. Phase « Aucune » possible. **Phases en blocs** (`components/Phases.tsx`) : en cours (modifiée par une étape datée d'aujourd'hui), à venir (repliées en une ligne, on en ouvre une pour la modifier ou la supprimer), passées (figées, avec le poids réel). « + Ajouter une phase après » enchaîne à la fin prévue de la dernière ; allonger, raccourcir ou supprimer décale les phases à venir (`dureePhase`, `supprimerPhase`, `terminerPhase`, `deplacerPhase` dans `lib/objectifs.ts`). Deux phases du même type qui se suivent se fondent en une. Phase visible en trait de couleur sous les jours du calendrier, et dans le texte « Partager ce bilan ». Calories visées : plus tard (Android).
- Séries dures = RPE ≥ 7 ; volume par muscle = séries dures par semaine, secondaires à 0,5.
- **Volume par muscle = jauge, pas un réglage** (`lib/volume.ts`) : zone utile générale par muscle dans `MUSCLES` (`cible` = bas, `haut` ; 10–20 pour pecs, dos, quadriceps ; 0 = suivi seulement, regroupé en une ligne). États Léger / Optimal / Beaucoup. Affiché dans le programme (carte « Volume par semaine »), le Bilan, le cycle ; **plus dans Objectifs** (phase + calories seulement). « Ajuster les cibles » replié sous les jauges (0 à 30, ★ Priorité = +4 au-dessus du conseillé, « Revenir aux zones conseillées ») : écrit dans la frise datée comme avant. Une cible différente de la valeur conseillée = « ajustée ». La priorité de cycle n'est plus proposée au lancement (gardée pour les cycles qui en ont une).
- Exercices équivalents : chacun garde sa propre progression, le lien sert de repère.
- **Séance en plein écran par défaut** (réglage local `modeFocus`, gardé ensuite) : un nouveau découvre le grand chrono dès sa 1re série. Sortie « ☰ Vue liste » ; en vue liste, « ⤢ Plein écran » écrit sous l'anneau du chrono et sous le résumé de séance. Pas de bulle d'astuce : les boutons disent ce qu'ils font.
- Échauffement général : 1re étape de la séance (pas un écran avant « Démarrer »), valeurs fixes juste à cocher. Un seul bouton en bas, dont le texte suit les cases : « Passer l'échauffement », « Terminer l'échauffement (2/4) », « ✓ Échauffé, on attaque » ; revenu par la pastille 🔥 : « Retour à la séance ». Les cases faites restent dans la séance (`echauffement.faits`). Se coupe par séance (interrupteur dans l'éditeur de séance).
- Pas d'estimation de calories brûlées (séance, activités) : précision fausse, retirée. Accueil : « Autre séance » et « + Activité » en vrais boutons ; semaine complète → bouton « Démarrer une séance » quand même.
- **Sauvegarde** : données uniquement sur le téléphone. Rappel sur l'Accueil après 7 jours sans export (masquable une semaine) ; un appui exporte tout sauf les photos et ouvre le partage Android (Drive, mail…) via `sauvegarder` (`lib/sauvegarde.ts`), qui met à jour `dernierExport`. Sauvegarde Drive automatique : plus tard si besoin.
- Le Bilan ne mentionne pas d'IA pour l'instant. Sommeil, pas, calories : plus tard (version Android, Health Connect).

## Tester

- `npm test` doit passer.
- Pour un changement visible : `npm run build && npx vite preview --port 4173`, puis vérifier sur un écran de téléphone (384 × 832). L'appli démarre vide (bibliothèque de base) ; une séance se lance par « Autre séance ».
