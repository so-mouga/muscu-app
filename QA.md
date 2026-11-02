# Tester Cran comme un utilisateur

Tu es testeur. Tu utilises l'appli **Cran** (carnet de musculation, en français) comme le ferait un pratiquant en salle, sur un téléphone. Tu n'as pas accès au code : seulement à l'appli. Tu cherches ce qui casse, ce qui perd des données, et ce qui est confus, puis tu rends un rapport.

Pour chaque partie, ce qui est **attendu** est écrit ci-dessous : ce sont des choix voulus par l'auteur. Un écart avec ce qui est attendu est un bug, même si l'écran « marche ».

## Préparer

- Adresse de l'appli : **https://so-mouga.github.io/muscu-app/**
- Ouvre-la dans un navigateur réglé comme un téléphone : écran de **384 × 832**, tactile.
- Pas de compte : tout est enregistré dans le navigateur. Au départ, l'appli est vide. Pour repartir de zéro, efface les données du site (stockage du site / cookies et données).
- Beaucoup de fonctions ont besoin d'historique (bilan, conseils, blocages, déload). Si ton outil le permet, **avance l'horloge** (par exemple `page.clock` de Playwright) pour faire des séances sur plusieurs semaines. Sinon, dis dans le rapport ce que tu n'as pas pu tester faute d'historique.
- Certaines choses n'existent que dans l'appli Android (APK) : notification de séance, alarme de fin de repos, bouton retour physique, appareil photo natif, bannière « Nouvelle version ». Dans le navigateur, le **retour** se teste avec le bouton Précédent du navigateur. Liste à part ce qui demande un vrai téléphone.

## Le parcours, dans l'ordre

Fais-le comme une vraie personne, en notant tout ce qui t'arrête.

### 1. Première ouverture
- L'accueil montre seulement « Pour commencer, choisis ton programme ».
- Choisir un programme tout prêt (Full body 3 jours, Haut / Bas 4 jours, Recompo) : il devient actif, ses séances apparaissent.
- Réglages : bouton en haut à droite de l'accueil, pas dans la barre du bas. (Pas de profil ni d'activités hors muscu : retirés volontairement.)

### 2. Accueil (la séance du jour)
- Tout tient sur un écran, sans défiler. Date, puis la **phase toujours sous la date**, à côté du cycle (un appui sur la phase ouvre Corps → Objectifs ; sans phase jamais réglée : « + Phase »).
- « À noter » et les pastilles Poids, Sommeil, Calories (Calories seulement si un objectif est fixé ; absent à la toute première ouverture). Un appui ouvre une fenêtre, le sommeil et les calories se notent en 2 appuis, **jamais pré-remplis**. Une fois notés : une ligne discrète (« 70 kg · 7 h de sommeil · calories tenues »), un appui corrige. Poids réglé puis appui à côté ou retour : il est gardé ; ouvrir et fermer sans rien changer : rien n'est noté.
- Ligne « Cette semaine » : un point par séance prévue, vert quand elle est faite ; un appui ouvre le Journal. « n-ième semaine tenue » à partir de 2. Une phrase de progrès (« … : +2,5 kg sur ce bloc ») seulement s'il y en a un.
- Carte de séance : nom, durée, liste des exercices, **« Démarrer » toujours en bas de la carte, au même endroit, visible sans défiler**. Un gain en orange à côté d'un exercice n'apparaît que si un objectif plus haut que la dernière fois a été fixé (conseil appliqué ou crayon en fin de séance) : par défaut on refait pareil. Repos ou séance faite : pas de bouton orange, la séance suivante et « Voir la séance ».
- « Autre séance › », séance libre.
- Rappels en haut, sur une ligne, deux au plus à la fois : sauvegarde (après 7 jours sans export), mensurations…, masquables.

### 3. Une séance complète
- Démarrer. Elle s'ouvre **en plein écran** (grand chrono), **à chaque séance**, même si la vue liste avait été choisie la fois d'avant.
- Plein écran : pastilles S1 S2 S3 (faite ✓ ✎, en cours ▶, à venir avec leur cible), charge et reps côte à côte, RPE en 5 gros boutons (6 à 10, pas de demis). Tout tient **sans défiler**, chaque info une seule fois.
- Valider des séries, laisser tourner le repos (dans l'appli : toucher le cercle = pause, −15 / +15, Passer ; « Pause / +30 s / Passer » sont les boutons de la notification Android), corriger une série déjà faite. Les nombres (charge, reps) se tapent aussi au clavier en les touchant (soulignés en pointillé).
- Passer en « Voir la séance » : **toute la séance en liste**, une ligne par exercice, un seul bouton orange « Continuer » sur l'exercice en cours, qui revient au plein écran. **On ne saisit jamais de série dans la liste** (voulu). Un appui sur une ligne la déplie (séries, conseil s'il apprend quelque chose, actions), le retour la replie.
- Naviguer entre exercices : en plein écran, l'appli enchaîne seule et « Voir la séance » en haut montre le reste (pas de pastilles d'exercices, voulu) ; en vue liste, « Faire maintenant » sur un exercice déplié, et n'importe quelle ligne pour le consulter. « Machine prise », remplacer un exercice, sauter un exercice (ligne grisée, « Le faire quand même »), « Échanger » proposé seulement sur l'exercice en cours, retour de Fin de séance vers l'écran d'où on vient, ajouter un exercice, + / − série, note, corriger une série depuis la liste.
- Superset : relier deux exercices, vérifier l'alternance des séries et le repos de transition. L'écran ne montre que l'exercice en cours, avec son nom entier, ⓘ et une ligne « Ensuite » ; au repos, la dernière série de l'autre exercice se corrige par « Corriger ».
- Échauffement : coupé par défaut ; le choisir (ligne « Échauffement · aucun · Choisir › » en haut de l'écran « Voir », ou dans Programmes ; aucun mouvement choisi = pas d'échauffement), cocher des mouvements, le texte du bouton suit les cases (« Passer l'échauffement », « Terminer l'échauffement (2/4) », « ✓ Échauffé, on attaque »).
- Fiche ⓘ d'un exercice : consignes et ligne « Palier 5 kg · charge max : … » qui ouvre les réglages (palier avec « Autre », charge max, note, photo avec l'appareil ou la galerie), sans seconde montée de fenêtre. Le crayon sous la charge ouvre les mêmes réglages. Pas de formulaire complet en séance.
- Les changements faits en séance **ne modifient pas** la séance enregistrée dans le programme (les réglages de la machine, eux, restent sur l'exercice).
- **Retour** pendant la séance : ferme d'abord les fenêtres, puis défait ta dernière navigation (exercice 3 → retour → exercice 1, plein écran ↔ liste). Au départ sans série faite : la séance est annulée, retour à l'écran d'où tu l'as lancée. Avec des séries : fenêtre Continuer / Terminer et enregistrer / Supprimer.
- En-tête : « Reste 4 exercices », puis « Dernier exercice, 2 séries ». Partout dans la séance : « effort 8/10 », jamais RPE ni @8 (sauf l'aide). Fin de séance : en dépliant les séries, un appui permet de corriger. Une note écrite dans la liste apparaît sur l'écran de saisie.
- Toute dernière série : pas de repos, l'écran propose « Terminer la séance » et « Ajouter un exercice ». 1re séance d'un programme : charge vide, bouton « Indique la charge » tant qu'elle n'est pas réglée. Charge modifiée puis « Voir la séance » et « Continuer » : elle est toujours là. Double appui sur « Démarrer » : une seule séance. Séance libre : elle s'ouvre sur la liste. « Faire maintenant » sur un autre exercice : ensuite, retour au premier non terminé. Déload : écrit à côté de « Reste n séries ».
- Fin de séance : « ✓ Enregistrer la séance » toujours visible en bas, sensations « Comment c'était ? » en 3 choix (Difficile / Bien / Au top) en haut, dans la carte du résumé. Section « Pour la prochaine fois » : choix « Comme aujourd'hui » (coché par défaut) / conseil (« +1 rep, 3e série », « Tu peux monter »…), le chiffre qui change en orange, une ligne « Pourquoi » ; à partir de 3 cartes, « suivre les conseils » les coche toutes (nouvel appui : tout revient comme aujourd'hui, un objectif fixé à la main ne bouge pas). Revenir dans la séance ou recharger la page garde les choix et les sensations. « On refait pareil » : une ligne par exercice ; « Confirme d'abord » y figure, sans faux choix. Exercices sautés : « Pas fait aujourd'hui ». Tractions assistées : le conseil retire de l'assistance (« Moins d'assistance »). Le conseil n'existe que pour un exercice avec une fourchette de reps et une séance complète (séance écourtée : pas de conseil, « refais d'abord les 3 séries »), « Supprimer la séance » discret. Après l'enregistrement : retour à l'accueil.
- Refais la même séance : l'objectif par défaut est **refaire pareil** que la dernière fois (pas de progression automatique).

### 4. Programmes
- Créer un programme, une séance, ajouter / retirer / réordonner des exercices (poignée ⠿, appui maintenu, pas de flèches).
- Planning par jour, rendre un programme actif, lancer un cycle (nom, déload en fin de cycle), « Plus d'options ».
- Carte « Volume par semaine » : jauges Léger / Optimal / Beaucoup, « Ajuster les cibles ».
- Supprimer un programme, une séance (au moins un programme reste).

### 5. Exercices
- Recherche, liste par muscle, « Récents ».
- Créer un exercice, le modifier, le supprimer.
- Fiche d'un exercice : interrupteur « Calculateur de disques » (coupé pour un exercice créé ; activé d'office sur les exercices à barre et Smith, pas sur les presses), poids de la barre ; en séance, la puce sous la charge donne les disques par côté.
- Exercice de base : modifiable, « ↺ Revenir à l'original », « Masquer » (réversible, jamais supprimé).
- Courbe de progression d'un exercice déjà fait.

### 6. Progression (Bilan et Journal) et Corps (onglet à part)
- **Bilan** : périodes, « À retenir », assiduité, muscles, intensité, corps, semaine par semaine, « Partager ce bilan » (texte copié). Avec historique : exercices bloqués et leurs pistes chiffrées, lecture de la phase (sèche / prise).
- **Journal** : calendrier (glisser à gauche / à droite change de mois, un an en avant), jours prévus en pointillé orange, déload en violet, phase en trait de couleur. Toucher un jour : séances (détail, corriger une série, série oubliée), poids, mensurations (taille + écart, fenêtre de toutes les valeurs), photos (vignettes → plein écran, « Comparer avec »), sommeil et calories (un appui ouvre le choix, choisir enregistre et referme, Annuler / Effacer).
- **Corps** : poids (moyenne 7 jours), mensurations (silhouette, consignes), photos (séance photo guidée : une seule pose puis « Terminer » doit la garder ; Galerie ; « ✎ Modifier » une date : changer la date, remplacer ou supprimer une pose ; dates anciennes repliées ; « Importer des photos déjà prises » avec date modifiable, comparer deux dates côte à côte / superposées, plein écran avec zoom à deux doigts **indépendant sur chaque photo**, double appui).
- **Objectifs** (onglet Corps → sous-onglet Objectifs) : phases sèche / maintien / prise / aucune, en cours / à venir / passées, « + Ajouter une phase après », allonger, raccourcir, supprimer (les phases suivantes se décalent), objectif de poids en ± kg, calories visées (fixées à la main ; pas de calcul automatique, voulu).

### 7. Réglages (bouton en haut à droite de l'accueil ; ← et le retour reviennent à l'accueil)
- « 💬 Donner mon avis » en haut (mail pré-rempli).
- Bips de fin de repos. (Plus de réglage du pas des −/+ : ils suivent le palier de chaque exercice, modifiable en séance.)
- « 🔔 Rappel de séance » : seulement dans l'appli Android 1.6 et plus (à lister dans « vrai téléphone » sinon).
- Sauvegarde : Exporter (choix des données), **Importer** ce fichier dans un site vidé : tout doit revenir à l'identique. Export CSV des séries.
- Stockage, À propos.

## À vérifier partout

- **Rien ne se perd** : pas de bouton Enregistrer, tout s'enregistre seul. Quitte un écran en pleine saisie (barre du bas, retour, rechargement de la page) puis reviens.
- **Fenêtres** : un appui à côté ferme en gardant ce qui est saisi ; le retour les ferme une par une.
- Jamais de fenêtre native du navigateur (`alert`, `confirm`, `prompt`).
- Nombres saisis au clavier : pris en compte à la fin de la saisie ; essaie 0, vide, négatif, virgule, 999.
- Tout en français, sans jargon ni faute ; libellés compréhensibles par quelqu'un qui débute.
- Pas de défilement horizontal, rien de coupé ni de superposé à 384 px de large ; textes lisibles sur fond sombre.
- Double appui rapide sur les boutons importants (valider une série, enregistrer) : pas de doublon.
- Aucune erreur dans la console.

## Le rapport

Commence par un résumé de 5 lignes maximum : ce qui marche bien, ce qui est grave.

Puis **un bloc par bug** :

```
### [Gravité] Titre court
Gravité : Bloquant (données perdues, appli inutilisable) / Majeur (fonction cassée) / Mineur (gêne) / Cosmétique
Écran : …
Étapes : 1. … 2. … 3. …
Attendu : … (cite la règle de ce document si elle est enfreinte)
Obtenu : …
Capture : …
```

Ensuite, à part, **les remarques d'usage** (ce qui marche mais est confus, lent ou mal placé), avec ta proposition.

Enfin, **ce que tu n'as pas pu tester** et pourquoi (vrai téléphone, historique, horloge).

Trie les bugs du plus grave au moins grave. N'invente rien : si tu n'as pas pu reproduire, dis-le.
