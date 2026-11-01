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
- Réglages (bouton en haut à droite de l'accueil, pas dans la barre du bas) → Mon profil : taille, naissance, sexe, activité.

### 2. Accueil (journal du matin)
- Date, puis la **phase toujours sous la date** (même quand le bandeau du cycle est affiché ; un appui ouvre Corps → Objectifs ; sans phase jamais réglée : « Pas de phase · Choisir › »), séance du jour, bouton Démarrer **visible sans défiler**. « 🔥 À battre » (3 lignes max) n'apparaît que si un objectif plus haut que la dernière fois a été fixé (conseil 💡 appliqué ou ✎ en fin de séance) : par défaut on refait pareil, il n'y a donc rien à battre.
- Carte « Aujourd'hui » (absente à la toute première ouverture) : pesée sur une ligne (toujours là), sommeil de la nuit (≤5h … 9h+, **jamais pré-rempli**, un appui enregistre), calories d'hier (Tenu / Trop / Pas assez).
- « Autre séance », séance libre.
- Rappels en haut sur une ligne : sauvegarde (après 7 jours sans export), masquables.

### 3. Une séance complète
- Démarrer. Elle s'ouvre **en plein écran** (grand chrono), **à chaque séance**, même si la vue liste avait été choisie la fois d'avant.
- Plein écran : pastilles S1 S2 S3 (faite ✓ ✎, en cours ▶, à venir avec leur cible), charge et reps côte à côte, RPE en 5 gros boutons (6 à 10, pas de demis). Tout tient **sans défiler**, chaque info une seule fois.
- Valider des séries, laisser tourner le repos (dans l'appli : toucher le cercle = pause, −15 / +15, Passer ; « Pause / +30 s / Passer » sont les boutons de la notification Android), corriger une série déjà faite. Les nombres (charge, reps) se tapent aussi au clavier en les touchant (soulignés en pointillé).
- Passer en « ☰ Vue liste » et revenir en « ⤢ Plein écran ».
- Naviguer entre exercices : en plein écran, l'appli enchaîne seule et « Voir la suite de la séance › » montre le reste (pas de pastilles d'exercices, voulu) ; en vue liste, pastilles et Précédent / Suivant. « Machine prise », remplacer un exercice, ajouter un exercice.
- Superset : relier deux exercices, vérifier l'alternance des séries et le repos de transition.
- Échauffement : coupé par défaut ; l'activer (interrupteur « 🤸 Échauffement » en haut de l'écran « Voir », ou dans Programmes), cocher des mouvements, le texte du bouton suit les cases (« Passer l'échauffement », « Terminer l'échauffement (2/4) », « ✓ Échauffé, on attaque »).
- Fiche ⓘ d'un exercice : consignes, « Modifier l'exercice ».
- Les changements faits en séance **ne modifient pas** la séance enregistrée dans le programme (sauf « Modifier l'exercice »).
- **Retour** pendant la séance : ferme d'abord les fenêtres, puis défait ta dernière navigation (exercice 3 → retour → exercice 1, plein écran ↔ liste). Au départ sans série faite : la séance est annulée, retour à l'écran d'où tu l'as lancée. Avec des séries : fenêtre Continuer / Terminer et enregistrer / Supprimer.
- Fin de séance : « ✓ Enregistrer la séance » toujours visible en bas, ressenti et énergie, conseil 💡 avec [Appliquer] seulement pour un exercice avec une fourchette de reps, « Supprimer la séance » discret. Après l'enregistrement : retour à l'accueil.
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
- **Journal** : calendrier (glisser à gauche / à droite change de mois, un an en avant), jours prévus en pointillé orange, déload en violet, phase en trait de couleur. Toucher un jour : séances (détail, corriger une série, série oubliée), activités (+ Ajouter une activité), poids, mensurations (taille + écart, fenêtre de toutes les valeurs), photos (vignettes → plein écran, « Comparer avec »), sommeil et calories (un appui ouvre le choix, choisir enregistre et referme, Annuler / Effacer).
- **Corps** : poids (moyenne 7 jours), mensurations (silhouette, consignes), photos (séance photo guidée : une seule pose puis « Terminer » doit la garder ; Galerie ; « ✎ Modifier » une date : changer la date, remplacer ou supprimer une pose ; dates anciennes repliées ; « Importer des photos déjà prises » avec date modifiable, comparer deux dates côte à côte / superposées, plein écran avec zoom à deux doigts **indépendant sur chaque photo**, double appui).
- **Objectifs** (onglet Corps → Poids, sous la pesée) : phases sèche / maintien / prise / aucune, en cours / à venir / passées, « + Ajouter une phase après », allonger, raccourcir, supprimer (les phases suivantes se décalent), objectif de poids en ± kg, calories visées.

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
