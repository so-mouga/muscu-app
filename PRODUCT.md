# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Une personne qui se muscle en salle et suit ses séances sur son téléphone Android (Samsung S25), en français. En séance : essoufflée, mains moites, sous les néons, parfois au soleil, entre deux séries. Le reste du temps, elle consulte au calme son bilan, son journal et ses exercices.

## Product Purpose

Noter ses séries vite, savoir quoi refaire la prochaine fois, et voir si l'entraînement avance. Réussi = la saisie en salle ne demande aucun effort, et les conseils sont compris sans explication extérieure.

## Positioning

Pas de compte ni de serveur : tout reste sur le téléphone. Les conseils sont des règles fixes et testées, jamais appliquées seules, et chacun dit pourquoi avec les chiffres du jour.

## Operating Context

PWA en ligne (so-mouga.github.io/muscu-app) et appli Android Capacitor qui charge ce même site. Écran de référence : 384 × 832. Deux contextes d'usage : la salle (séance, gros boutons, contraste fort) et le calme (Bilan, Journal, Exercices, plus denses).

## Capabilities and Constraints

Les règles métier et d'interface sont dans `AGENTS.md`, qui reste la référence. Vocabulaire : Programme = modèle ; Cycle = programme lancé à une date ; Phase = objectif corps et assiette, indépendante du cycle. Plein écran de séance sans défilement à 384 × 832 ; « Démarrer » visible sans défiler sur l'accueil ; libellés utilisés par `e2e/parcours.e2e.ts` inchangés. Pas d'activités hors muscu, pas de calcul automatique de calories, pas d'estimation de calories brûlées.

## Brand Commitments

Nom : Cran (« monte d'un cran »). Logo : disque de fonte orange avec une encoche en haut et un trou au centre (`public/icon.svg`). Tout en français, en mots clairs, sans jargon. Icônes et pictogrammes maison, jamais copiés d'autres applis.

## Evidence on Hand

Aucun témoignage ni chiffre d'usage. Ne pas en inventer. Pas encore publiée sur le Play Store.

## Product Principles

- La salle d'abord : ce qui sert en séance passe avant tout le reste.
- Les explications restent visibles ; seules les définitions du lexique se cachent.
- Une proposition, jamais une décision à la place de l'utilisateur.
- Sans pression : pas de série de jours, de badges, ni de jugement sur le poids ou le corps.
- Rien ne se perd : enregistrement automatique partout.

## Accessibility & Inclusion

Lisible sous les néons et au soleil, utilisable mains moites : cibles de 48 px minimum en séance, 44 px ailleurs, contraste du texte d'au moins 4,5:1.
