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
- **Écran « Voir »** (avant de démarrer) **et fenêtre Échauffement** : `eb7ec5d`. Plus d'exercices visibles, ligne à la place de l'interrupteur, fenêtres qui montent vraiment du bas (toutes les fenêtres du bas en profitent).
- **Fenêtre « Modifier l'objectif »** : `ab1303d`. Un appui à côté ou le retour la ferment en gardant ce qui a changé.
- **Vue liste de la séance** : `f591d41`. Toute la séance en une liste, plus de saisie ; plein écran = faire, liste = voir et organiser.
- **Écran de repos** : `f5c4968`. « Voir la suite de la séance » retiré, il faisait double emploi avec la liste.
- **Machine prise, retour de Fin de séance, temps en clair** : `f9f2c5a`. Icônes et lignes sans bordure, « Échanger » seulement sur l'exercice en cours, retour vers l'écran d'où on vient, « 0:04 de séance · ~55 min restantes » en plein écran.
- **Fin de séance** : `49ffc54` pour les corrections de fond (choix enregistrés tout de suite, exercice assisté, viser plus sans perdre de reps, pas de faux choix), puis nouvel affichage : sensations en haut, cartes réduites, chiffre qui change en orange, « suivre les conseils ».

Rien de ces six derniers points n'a encore été essayé sur le téléphone. À y regarder : fluidité de la montée des fenêtres et du flou ; clavier dans « Ajouter un mouvement » ; vrai bouton retour dans la liste (replier, puis revenir) ; saisie absente de la liste, est-ce gênant en salle ?

### Décisions validées, absentes d'`AGENTS.md`

- **Manière de travailler sur un retour** : ne pas coder tout de suite. Reformuler, dire franchement si on est d'accord et pourquoi, signaler ce qui contredit `AGENTS.md` ou ce fichier, proposer mieux si possible, puis attendre « go ». L'utilisateur préfère être contredit plutôt que voir appliquer un mauvais retour.
- **Questions de goût** : montrer des captures comparées avant de mettre en ligne.
- **Ordre de la refonte** : un écran à la fois, un commit par écran, avec des captures avant / après.
- **L'utilisateur ne se dit pas expert en applis** et demande un avis franc : proposer une direction claire avec une recommandation, pas seulement appliquer son retour. Il préfère qu'on remonte à la cause (« à quoi sert cet écran ? ») plutôt qu'on retire des infos une à une.
- **Principe « les explications restent visibles »** : il vaut pour les conseils. La méthode de calcul de la durée de séance peut rester derrière un ⓘ (écran « Voir »).

### Reste à faire, dans l'ordre

1. **Accueil.**
2. **Progression** (Bilan, Journal).
3. **Corps.**
4. **Programmes.**
5. **Exercices** (la fiche d'exercice n'a pas encore été capturée pendant la refonte).
6. **Réglages.**

À traiter en refaisant ces écrans :

- Exercice créé par l'utilisateur et assisté : rien ne permet encore de le marquer (`Exercice.assistance`), à prévoir dans la fiche en refaisant Exercices. Le repère des exercices équivalents (`repere`) ne connaît pas non plus l'assistance.
- Fenêtre d'objectif avec 5 séries sous 700 px de haut : elle défile, « Fixer cet objectif » est sous le pli (un appui à côté garde ce qui a changé).
- La liste des variables de couleur d'`AGENTS.md` (`--flamme`, `--ambre`, `--forme-*`…) cite des noms absents de `styles.css` : à remettre d'accord.
- Le Bilan, Programmes, Exercices et Réglages ont changé de teinte sans avoir été relus.
- Réduire les `style={{…}}`, les tailles hors échelle et les variables de couleur restantes. Remplacer les émojis et symboles restants, dont ★ en séance et 🏆 dans la fenêtre d'objectif.
- Revoir l'échauffement général de la séance, pas encore repris.
- Plein écran à 360 px de large : dans la rangée de séries, « S1 » est coupé à gauche, car la rangée se centre sur la série en cours. Déjà présent avant, à reprendre si ça gêne en salle.
- Vérifier la séance sur le téléphone en mode finisseur, et le son à la fin du repos quand une fenêtre est ouverte.
- Tester chaque écran de 667 à 832 px de haut et à 360 comme à 384 px de large. Les scripts de capture n'ont pas été gardés dans le dépôt : Playwright sur `npm run build` + `.claude/launch.json`, en remplissant la base avec un historique de séances, les noms d'exercices les plus longs (« Extension triceps poulie haute à la corde ») et un superset.
- À la fin : `QA.md` et la fiche Play Store si des fonctions visibles ont changé, puis une vérification complète.

### Choix en attente de l'avis de l'utilisateur

- **Décompte de 10 s avant de démarrer** (vu dans son ancienne appli) : déconseillé, rien ne court pendant qu'on s'installe et la durée se compte depuis la 1re série. Rien n'a été ajouté ; sa réponse n'est pas encore donnée. Il pourrait seulement avoir un sens pour les exercices en temps, où le décompte est de 3 s.
- **Largeur réelle du S25** : `AGENTS.md` prend 384 px comme référence, mais le téléphone peut être à 360 selon son réglage d'affichage. À confirmer sur l'appareil.
- **Halo du cercle de repos** : en ligne, mais aucun avis donné sur ce point précis. Sa fluidité sur le téléphone n'est pas confirmée non plus.
- **Lueur de réussite** (record, série battue) : proposée, pas décidée.
- **Lueur très légère en haut de l'écran** : proposée, pas essayée.
- **« EXPORTER », « AJOUTER », « REMPLACER »** : encore en majuscules dans la sauvegarde, parce que le test les cherche tels quels. Passer en minuscules demande de modifier le test.
- **Écran de lancement Android** : il peut garder l'ancienne couleur. Le changer demanderait un nouvel APK.
- **Superset** : le bouton ⓘ a disparu de l'écran de saisie, à remettre s'il sert.
- **Exercices au poids du corps** : l'unité dit « kg de lest », sans la précision « − = assistance », à remettre si elle manque.
