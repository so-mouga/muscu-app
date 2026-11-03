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

Les règles métier et d'interface sont dans `AGENTS.md`, qui reste la référence. Vocabulaire : Programme = modèle ; Cycle = programme lancé à une date ; Phase = objectif corps et assiette, indépendante du cycle. Plein écran de séance sans défilement à 384 × 832 ; accueil sur un écran, « Démarrer » toujours au même endroit ; libellés utilisés par `e2e/parcours.e2e.ts` inchangés. Pas d'activités hors muscu, pas de calcul automatique de calories, pas d'estimation de calories brûlées.

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

État au 3 nov. 2026 : Progression et Corps refaits après `d58adde`. Le système de design et les règles de la séance sont dans `AGENTS.md`, qui reste la référence.

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
- **Fin de séance** : `49ffc54` pour le fond (choix et sensations enregistrés tout de suite, exercice assisté, « viser plus » sans perdre de reps, pas de faux choix), `cf15503` pour l'affichage (sensations en haut, cartes réduites, chiffre qui change en orange, « suivre les conseils »).
- **Fenêtre d'objectif** : `9d97247`. « Fixer cet objectif » toujours visible, titres de colonnes, boutons de 44 px, assistance négative qui ne saute plus à zéro.
- **Parcours de séance testé de bout en bout, 12 corrections** : `9e4f230`. Double « Démarrer », charge vide à calibrer, saisie gardée, pas de repos après la dernière série, séance libre, ordre après « Faire maintenant », repos de superset, déload écrit en plein écran, « − série » jusqu'à 1, messages qui ne bloquent plus.
- **Superset en plein écran** : `2d72189`. Seul l'exercice en cours, ligne « Ensuite », « Valider » collé en bas si l'écran déborde.
- **Réglages de la machine, en-tête, vocabulaire** : `3a385b7`. Plus de formulaire complet en séance, « Reste 4 exercices », correction depuis la fin de séance, note à la saisie, finisseurs sans défiler, « effort 8/10 » dans toute la séance.
- **Photo depuis l'appareil** : `cddf5ea`. « Prendre une photo » et « Galerie » dans les réglages de la machine.

- **Accueil** : refait entièrement le 2 nov. 2026, version choisie par l'utilisateur après comparaison de maquettes (décrite dans `AGENTS.md`). Poids qui ne se perd plus, programme sans jours qui n'est plus une impasse, calories seulement avec un objectif, déload écrit sur la carte, onglets moins coupés. Puis le haut de l'écran, jugé fade tout en gris, regroupé dans une carte où les chiffres ressortent.

- **Progression et Corps** (3 nov. 2026, après inventaire et maquette validée) : `a627b06` Accueil et Journal, `3f08dbf` Bilan, `7693f98` Photos, `e099c74` Phases, `93e23f7` Corps. Bilan en 5 sections et environ 2 écrans, Corps en une page. Le détail et ce qui a été retiré sont dans `AGENTS.md`.

- **Démarrage d'un nouvel utilisateur** (3 nov. 2026, après inventaire et maquette cliquable validée) : accueil et onglet Programme sans programme, Full body 2 jours, questions avec croix et reprise, proposition. Le détail est dans `AGENTS.md`.

- **Programme modifié pendant un cycle** (3 nov. 2026) : la question ne se perd plus, un refus est respecté. Le détail est dans `AGENTS.md`.

**Le parcours d'entraînement est donc repris de l'Accueil à l'enregistrement.**

### À vérifier sur le téléphone (S25)

- Démarrage : vrai bouton retour Android à chaque question (depuis la 1re, l'appli se ferme), largeur des 7 jours et du titre « Ton programme » + « Faire une séance › » avec sa police, flash éventuel au chargement. À essayer avec sa famille : leurs vraies hésitations avant d'ajouter d'autres cas.
- Bilan et Corps : place en largeur avec sa police, retour Android depuis une fiche (même période, même position), « Noter mon poids », photos réelles dans Corps (poids en mémoire, fluidité).

Rien depuis `f591d41` n'a encore été confirmé sur le téléphone, sauf que la photo depuis la galerie fonctionne.

- Accueil : la taille réelle de l'écran, les trois cases du matin sans texte coupé, la barre du bas entière à 360 px de large, la montée des fenêtres de saisie, l'envie ou non de retrouver la frise de la semaine.

- Fenêtres : fluidité de la montée et du flou ; clavier dans « Ajouter un mouvement » et dans les réglages de la machine.
- Bouton retour réel : liste (replier, puis revenir), réglages depuis la fiche, fenêtre de correction.
- Prise de photo : retour dans la fenêtre avec la photo ; si Android ferme l'appli pendant la prise de vue, la photo peut être perdue (le reste est gardé).
- Son, vibrations, notification sur écran verrouillé et alarme ; aucune alarme après la dernière série ; son à la fin du repos quand une fenêtre est ouverte.
- Double appui réel sur « Démarrer ». Si une séance en double existait déjà, elle réapparaît : l'annuler.
- Superset sans repos : message « Enchaîne », lisibilité de « Ensuite » ; finisseurs ; saisie absente de la liste, est-ce gênant en salle ?

Limites connues du parcours :

- 5 séries et échauffement sous 720 px de haut : l'écran défile, « Valider » collé en bas recouvre les efforts jusqu'à ce qu'on défile.
- Fenêtre de réglages avec une photo, sur petit écran : il faut défiler pour voir ses boutons.
- Séance libre : l'interrupteur « séance réutilisable » et son nom ne sont pas gardés si on revient dans la séance.
- Pas essayé : déload depuis un vrai cycle ; « Créer un exercice » en séance.

### Décisions validées, absentes d'`AGENTS.md`

- **Manière de travailler sur un retour** : ne pas coder tout de suite. Reformuler, dire franchement si on est d'accord et pourquoi, signaler ce qui contredit `AGENTS.md` ou ce fichier, proposer mieux si possible, puis attendre « go ». L'utilisateur préfère être contredit plutôt que voir appliquer un mauvais retour.
- **Questions de goût** : montrer des captures comparées avant de mettre en ligne.
- **Ordre de la refonte** : un écran à la fois, un commit par écran, avec des captures avant / après.
- **L'utilisateur ne se dit pas expert en applis** et demande un avis franc : proposer une direction claire avec une recommandation, pas seulement appliquer son retour. Il préfère qu'on remonte à la cause (« à quoi sert cet écran ? ») plutôt qu'on retire des infos une à une.
- **Goûts constatés** : il préfère une direction claire à une liste d'options ; il trouve vite « trop gros » et « trop d'orange ». Il aime voir d'un coup d'œil ce qui change (chiffre en orange). Quand il n'a pas d'avis sur un écran, il attend qu'on teste tous les cas et qu'on lui dise ce qui ne va pas.
- **Retours groupés** : s'il annonce d'autres retours, les vérifier à l'écran et proposer un seul lot avant de coder.
- **Principe « les explications restent visibles »** : il vaut pour les conseils. La méthode de calcul de la durée de séance peut rester derrière un ⓘ (écran « Voir »).

### Reste à faire, dans l'ordre

1. **Programmes** (le sous-titre « maintien » d'une séance se lit mal à côté de la phase « Prise »).
2. **Exercices** (la fiche d'exercice n'a pas encore été capturée pendant la refonte).
3. **Réglages.**

À traiter en refaisant ces écrans :

- Bilan du cycle (fenêtre) : fait double emploi avec le Bilan sur la période Cycle, à réunir en refaisant Programmes.
- Saisie des mensurations : garde un bouton « Enregistrer », contraire à l'enregistrement automatique. Détail de séance : « + Ajouter une série oubliée » répété sous chaque exercice, icônes ℹ et émojis du détail à reprendre.
- Fiche d'exercice : @8 et 1RM à dire en clair.

- Exercice créé par l'utilisateur et assisté : rien ne permet encore de le marquer (`Exercice.assistance`), à prévoir dans la fiche en refaisant Exercices. Le repère des exercices équivalents (`repere`) ne connaît pas non plus l'assistance.
- La liste des variables de couleur d'`AGENTS.md` (`--flamme`, `--ambre`, `--forme-*`…) cite des noms absents de `styles.css` : à remettre d'accord.
- Le Bilan, Programmes, Exercices et Réglages ont changé de teinte sans avoir été relus.
- Réduire les `style={{…}}`, les tailles hors échelle et les variables de couleur restantes. La séance n'a plus d'émojis ni de RPE (sauf l'aide de l'effort) ; il en reste dans le Bilan, Programmes, le lexique, et ailleurs.
- Fenêtres de l'Accueil (« Choisir une séance », détail d'une séance faite) : pas encore reprises, encore des `style={{…}}`.
- Formulaire de l'onglet Exercices : dire « Palier » comme en séance (il dit encore « Pas de charge »).
- Revoir l'échauffement général de la séance, pas encore repris.
- Plein écran à 360 px de large : dans la rangée de séries, « S1 » est coupé à gauche, car la rangée se centre sur la série en cours. Déjà présent avant, à reprendre si ça gêne en salle.
- Tester chaque écran de 667 à 832 px de haut et à 360 comme à 384 px de large. Les scripts de capture ne sont pas dans le dépôt : Playwright sur `npm run build` + `.claude/launch.json`, en écrivant dans IndexedDB une séance `enCours` et un historique, avec les noms d'exercices les plus longs (« Extension triceps poulie haute à la corde ») et un superset. Pour simuler le bouton retour Android : `window.__retourCran()`. Deux validations à moins de 1,5 s : la seconde est ignorée (voulu). Les messages durent 4 s.
- À la fin : `QA.md` et la fiche Play Store si des fonctions visibles ont changé, puis une vérification complète.

### Choix en attente de l'avis de l'utilisateur

- **Full body 2 jours** : les 9 muscles suivis restent « Léger » dans le programme et le Bilan. Non vu avec de vraies séances ; à revoir si ça met la pression.
- **« Créer le mien »** : ouvre l'éditeur de programme actuel, pas encore repris (étape Programmes).

- **« Suivre les conseils »** : gardé par défaut ; à retirer seulement s'il ne s'en sert jamais après plusieurs séances.
- **« Stoppe si douleur articulaire… »** : masqué sur les finisseurs sous 720 px de haut, pour que tout tienne. À remettre s'il préfère défiler.
- **« Reste 4 exercices »** et **absence de l'autre exercice en superset** : décidés, à confirmer après un essai en salle.
- **Décompte de 10 s avant de démarrer** (vu dans son ancienne appli) : déconseillé, rien ne court pendant qu'on s'installe et la durée se compte depuis la 1re série. Rien n'a été ajouté ; sa réponse n'est pas encore donnée. Il pourrait seulement avoir un sens pour les exercices en temps, où le décompte est de 3 s.
- **Largeur réelle du S25** : ses captures indiquent environ 360 × 731 px, alors que `AGENTS.md` prend 384 × 832 comme référence. À confirmer sur l'appareil.
- **Halo du cercle de repos** : en ligne, mais aucun avis donné sur ce point précis. Sa fluidité sur le téléphone n'est pas confirmée non plus.
- **Lueur de réussite** (record, série battue) : proposée, pas décidée.
- **Lueur très légère en haut de l'écran** : proposée, pas essayée.
- **« EXPORTER », « AJOUTER », « REMPLACER »** : encore en majuscules dans la sauvegarde, parce que le test les cherche tels quels. Passer en minuscules demande de modifier le test.
- **Écran de lancement Android** : il peut garder l'ancienne couleur. Le changer demanderait un nouvel APK.
- **Exercices au poids du corps** : l'unité dit « kg de lest », sans la précision « − = assistance », à remettre si elle manque.
