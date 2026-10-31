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
- **Ne pas lancer Prettier** (pas de config dans le projet : il reformate des fichiers entiers). Garder le style existant : lignes longues, pas de point-virgule, guillemets simples.
- Git : compte perso uniquement — `git -c user.email=kevin.mougammadaly@gmail.com commit …`, dépôt `so-mouga/muscu-app`.

## Organisation

- `src/types.ts` : modèle de données (Exercice, ExoPlan, SeanceModele, Programme, Seance, Serie, Cycle…).
- `src/db.ts` : tables Dexie et migrations (version 6). Toute nouvelle table ou index = nouvelle version.
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
- Vocabulaire : **Programme** = modèle (séances + planning) ; **Cycle** = programme lancé à une date (copie figée, déload en fin de cycle).
- Les changements faits pendant une séance ne modifient jamais la séance enregistrée (sauf « Modifier l'exercice » depuis la fiche ⓘ).
- **Calendrier du Journal** : navigable un an en avant. Jours à venir = planning du cycle en cours (sinon du programme actif) via `prevuLe` (`lib/cycle.ts`) : cercle pointillé orange, déload en violet ; toucher un jour montre ce qui est prévu.
- **Objectifs personnels** (Progression → Objectifs) : une frise datée (réglage `objectifs`, `lib/objectifs.ts`). Chaque changement de phase (sèche / maintien / prise), de fin prévue ou de volume par muscle ajoute une étape qui reprend le reste ; on ne réécrit jamais le passé (données pour le bilan et la future IA). `catalogue.cibles` = volume en vigueur, `catalogue.ciblesA(date)` pour une période passée. Les mêmes pour tous les programmes et cycles ; `Programme.volume`, `Cycle.volume` et les anciens réglages `phases` / `objectifsVolume` ne servent plus que de repli. Phase « Aucune » possible, et une phase peut commencer dans le futur (affichée « à venir »). Phase visible en trait de couleur sous les jours du calendrier, et dans le texte « Partager ce bilan ». Calories visées : plus tard (Android).
- Séries dures = RPE ≥ 7 ; volume par muscle = séries dures par semaine, secondaires à 0,5.
- Exercices équivalents : chacun garde sa propre progression, le lien sert de repère.
- Échauffement général : 1re étape de la séance (pas un écran avant « Démarrer »), valeurs fixes juste à cocher.
- Le Bilan ne mentionne pas d'IA pour l'instant. Sommeil, pas, calories : plus tard (version Android, Health Connect).

## Tester

- `npm test` doit passer.
- Pour un changement visible : `npm run build && npx vite preview --port 4173`, puis vérifier sur un écran de téléphone (384 × 832). L'appli démarre vide (bibliothèque de base) ; une séance se lance par « Autre séance ».
