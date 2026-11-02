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

Lisible sous les néons et au soleil, utilisable mains moites : cibles de 44 px minimum pour les actions de la séance, sans grossir au point d'étouffer l'écran, contraste du texte d'au moins 4,5:1.

## Refonte : où on en est

État au 2 nov. 2026. Le système de design et les règles de la séance sont dans `AGENTS.md`, qui reste la référence.

### Fait et poussé

- **Base du système** : `121638a` (variables, échelles de texte et de rayons, bugs de la barre du bas, du message de record, de la barre de repos et du nom « Bas 1 »).
- **Séance plein écran** : saisie, repos et correction.
  - `04d4f0c` : première version pour la salle.
  - `ec7f3f9` : plus aérée, tout tient sur un écran peu haut, un seul orange plein.
  - `1e11378` : « Voir la séance », fenêtres pour le type de série et l'aide RPE, fiche d'exercice épurée, cercle qui réagit tout de suite, ambre aux derniers bips.
  - `024409e` : repos au changement d'exercice, blocage de l'effet élastique (confirmé sur le téléphone).
  - `135d9fc` : correction d'une série en fenêtre par-dessus le chrono.
  - `468594e` : échauffement lisible.
  - `eea2d98` : halo du cercle de repos.
- **Teinte et boutons, pour toute l'appli** : `af79a66`, validé par l'utilisateur. Remplace le relief de `75ead3c`, jugé vieillot.
- **Test du parcours de séance fiable** : `b0fc9aa`.
- **Écran « Voir » et fenêtre Échauffement** : plus d'exercices visibles, ligne à la place de l'interrupteur, fenêtres qui montent vraiment du bas (toutes les fenêtres du bas en profitent). Fluidité à confirmer sur le téléphone.
- **Vue liste de la séance** : toute la séance en une liste, plus de saisie ; plein écran = faire, liste = voir et organiser. À essayer sur le téléphone.

### Décisions validées, absentes d'`AGENTS.md`

- **Manière de travailler sur un retour** : ne pas coder tout de suite. Reformuler, dire franchement si on est d'accord et pourquoi, signaler ce qui contredit `AGENTS.md` ou ce fichier, proposer mieux si possible, puis attendre « go ». L'utilisateur préfère être contredit plutôt que voir appliquer un mauvais retour.
- **Questions de goût** : montrer des captures comparées avant de mettre en ligne.
- **Ordre de la refonte** : un écran à la fois, un commit par écran, avec des captures avant / après.

### Reste à faire, dans l'ordre

1. **Fin de séance.**
2. **Accueil.**
3. **Progression** (Bilan, Journal).
4. **Corps.**
5. **Programmes.**
6. **Exercices** (la fiche d'exercice n'a pas encore été capturée pendant la refonte).
7. **Réglages.**

À traiter en refaisant ces écrans :

- Le Bilan, Programmes, Exercices et Réglages ont changé de teinte sans avoir été relus.
- Réduire les `style={{…}}`, les tailles hors échelle et les variables de couleur restantes. Remplacer les émojis et symboles restants, dont ★ et 👀 en séance.
- Revoir le mode « Machine prise » et l'échauffement général de la séance, pas encore repris.
- Vérifier la séance sur le téléphone en mode finisseur, et le son à la fin du repos quand une fenêtre est ouverte.
- Tester chaque écran de 667 à 832 px de haut. Les scripts de capture de cette conversation n'ont pas été gardés dans le dépôt.
- À la fin : `QA.md` et la fiche Play Store si des fonctions visibles ont changé, puis une vérification complète.

### Choix en attente de l'avis de l'utilisateur

- **« Voir la suite de la séance › »** (plein écran, au repos) : fait double emploi avec la nouvelle liste. À retirer si l'utilisateur est d'accord.
- **Halo du cercle de repos** : en ligne, mais aucun avis donné sur ce point précis. Sa fluidité sur le téléphone n'est pas confirmée non plus.
- **Lueur de réussite** (record, série battue) : proposée, pas décidée.
- **Lueur très légère en haut de l'écran** : proposée, pas essayée.
- **« EXPORTER », « AJOUTER », « REMPLACER »** : encore en majuscules dans la sauvegarde, parce que le test les cherche tels quels. Passer en minuscules demande de modifier le test.
- **Écran de lancement Android** : il peut garder l'ancienne couleur. Le changer demanderait un nouvel APK.
- **Superset** : le bouton ⓘ a disparu de l'écran de saisie, à remettre s'il sert.
- **Exercices au poids du corps** : l'unité dit « kg de lest », sans la précision « − = assistance », à remettre si elle manque.
