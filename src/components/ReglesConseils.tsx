import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import Deplie from './Deplie'

/**
 * « Comment l'appli te conseille » (page de Réglages) : toutes les règles des conseils et alertes, en clair.
 * À tenir à jour quand une règle change (lib/progression, blocages, analyse, motivation, cycle).
 */
const REGLES: [string, string[]][] = [
  [
    'La règle de base',
    [
      'Rien ne monte tout seul : la prochaine fois, l’objectif est de refaire pareil que la dernière fois. C’est toi qui décides de monter, en fin de séance ou plus tard sur la séance enregistrée.',
      'L’appli ne commente jamais ton poids et ne compte pas de série de jours (le repos fait partie du programme).',
    ],
  ],
  [
    'Pendant la séance',
    [
      'Record battu, dès la série validée : une charge jamais soulevée, sinon plus de reps (ou de temps) que jamais à cette charge. Jamais en séance allégée. La fin de séance, le Journal et le Bilan comptent les mêmes records.',
      'Progresser, partout dans l’appli, c’est une charge plus lourde ou une rep de plus à une charge déjà faite, sur tes séries normales. L’effort noté et la force estimée n’y entrent jamais : mêmes charge et reps notées plus faciles, ce n’est ni « mieux » ni un record.',
      '« Tu peux monter la charge » : ta série d’avant dépasse le haut de la fourchette de 3 reps ou plus. Proposé : la charge + un pas de l’exercice (sauf au maximum du matériel).',
      '« Faute de frappe ? » : une charge bien plus lourde que d’habitude (plus de 1,5 fois et au moins 20 kg de plus).',
      'Exercice bloqué : une ligne sur la carte de l’exercice (voir « Exercice bloqué »).',
      'Séance ouverte depuis plus de 4 h : un avertissement ; si rien n’a été fait depuis 2 h, l’appli demande à la réouverture s’il faut l’enregistrer.',
    ],
  ],
  [
    'Les crans et ton disque',
    [
      'Un cran = un record battu sur un exercice : une charge jamais faite, ou plus de reps que jamais à une charge déjà faite, sur une série normale.',
      'Un seul cran par exercice et par séance. Aucun en séance allégée. En sèche aussi, un record vaut un cran.',
      'Un cran gagné ne se perd jamais. Au 12e, ton disque est plein et tu en commences un autre.',
      'À la saisie, le chiffre du jour passe en orange avec « record · +1 cran » dès qu’il bat ton record à la charge réglée. Jamais si l’exercice n’a jamais été fait, si la charge est plus légère que tout ce que tu as fait, ou si le cran du jour est déjà gagné.',
      'En vert : mieux que la même série la dernière fois (charge plus lourde, ou plus de reps à la même charge), sans battre ton record. Ça ne donne pas de cran.',
      'Sur l’accueil, « record à ta portée » : le conseil de la dernière fois était « Tu peux viser plus », et ta meilleure série était déjà à ton record. Une rep de plus le bat.',
      'Les crans se comptent depuis le 9 novembre 2026. Les séances d’avant servent de référence.',
      'La revanche : une série finie sous le bas de sa fourchette la dernière fois, à la même charge, ou une charge ratée à laquelle tu remontes après une séance plus légère. Elle est annoncée avant la série ; rien n’est dit si tu ne la prends pas.',
    ],
  ],
  [
    'En fin de séance',
    [
      'En tête : tes records battus et ton disque. Sans record, combien d’exercices ont été mieux que la dernière fois (charge plus lourde, ou rep de plus à une charge de la dernière fois).',
      'Une série à l’échec, dégressive ou en rest-pause compte comme une série faite : elle ne fait plus dire « Tu as fait 2 séries sur 3 ».',
      'Chaque exercice a une fourchette de reps, écrite pendant la saisie : 8–12 d’office s’il fait travailler plusieurs articulations, 12–15 sinon. Avec le même nombre des deux côtés, pas de conseil pour monter. Chaque série est jugée sur sa propre fourchette. Tu l’appliques ou non.',
      'Une rep de plus, même charge : sur deux séries si toutes étaient faciles (effort 7/10 ou moins, 3 reps en réserve), sinon sur une seule ; celles qui sont le plus loin du haut de leur fourchette.',
      'Monter la charge quand toutes les séries prévues sont au haut de leur fourchette, à l’effort visé (en moyenne pas plus d’un demi-point au-dessus, aucune série à plus d’un point), et que la série d’échec n’est pas trop courte. Les reps repartent au bas de la fourchette.',
      'De combien : environ +2,5 %, arrondi au-dessus au palier de la machine (au moins un palier). Le palier sert aussi aux boutons −/+ ; il se corrige en séance en touchant « kg · ±… » sous la charge, ou dans la fiche de l’exercice. Saut de plus de 10 % (petites charges) : refais d’abord une séance au haut de la fourchette pour confirmer. Charge maximale du matériel atteinte (à régler dans la fiche de l’exercice, facultatif) : ralentis la descente ou ajoute une pause.',
      'Série ratée (sous le bas de la fourchette alors que l’effort était au niveau visé) : même charge, vise le bas. Vaut aussi avec le même nombre des deux côtés.',
      'Deux séances ratées de suite (fourchette avec deux nombres différents) : baisser d’environ 5 % (au moins un pas).',
      'Exercice assisté (tractions à la machine) : les kg notés aident, donc tout s’inverse. Progresser, c’est retirer de l’assistance, d’un palier à la fois ; c’est aussi ce qui compte comme un progrès.',
      'Séance écourtée (moins de séries que prévu) : pas de conseil, refais d’abord la séance en entier.',
      'Chaque conseil dit pourquoi, avec tes chiffres du jour (quelle série, combien de reps, quel effort). En fin de séance, tu choisis entre « Comme aujourd’hui » (coché par défaut) et le conseil, un par un ou tous d’un coup avec « suivre les conseils » ; rien ne monte tout seul. Une fois la séance enregistrée, le même choix reste sur sa page (un appui sur la séance faite à l’Accueil, ou dans le Journal), tant que tu n’as pas refait l’exercice : c’est toujours ta dernière fois qui compte.',
      'Sans conseil, la carte dit pourquoi on refait pareil : effort plus dur que prévu, ou série d’échec trop courte.',
      'L’effort d’une série se note pendant le repos qui la suit (« C’était comment ? »). Sans appui, c’est l’effort visé qui est gardé : si la série était plus dure ou plus facile, dis-le, le conseil en dépend.',
    ],
  ],
  [
    'Sur l’accueil',
    [
      'Gain en orange à côté d’un exercice (à battre) : seulement quand tu as fixé un objectif plus haut que la dernière fois.',
      'Après 10 jours ou plus sans séance : « mêmes charges que la dernière fois, baisse un peu si c’est trop dur ».',
      'Semaines tenues de suite (à partir de 2) : une semaine est tenue avec les trois quarts des séances prévues (3 → 2, 4 → 3), séances libres comprises. Une semaine allégée est tenue dès une séance ; sans séance, comme une semaine en pause, elle ne casse pas la série. L’Accueil, la frise et les lignes du cycle, et le Bilan disent la même chose.',
      'Sur ce bloc (cycle en cours, sinon objectif en cours, sinon 4 semaines) : ton exercice principal le plus pratiqué qui a progressé.',
      'Déload à avancer (pendant un cycle) : ta force baisse sur 2 exercices et tu as répondu « Difficile » à 2 des 3 dernières séances, ou ta force baisse sur 3 exercices (ces 10 derniers jours). Monter la charge, ou faire autant de reps à la même charge, n’est pas une baisse. Jamais dans les 3 semaines après un déload ou 2 semaines sans séance.',
      'En haut, deux rappels au plus : nouvelle version de l’appli, cycle terminé, objectif terminé, déload conseillé, repères de fin d’objectif, sauvegarde (après 7 jours sans export), repères de début d’objectif ou mensurations (après 3 semaines sans en prendre). Une fin de cycle ou d’objectif, une fois vue ou masquée, ne revient plus.',
      'Repères de début d’objectif (prise, sèche ou maintien) : pendant ses 7 premiers jours, pour ce qui n’a pas été pris depuis une semaine avant son début (photos, mensurations, ou les deux). Une croix, et plus rien jusqu’à l’objectif suivant.',
      'Repères de fin d’objectif : la veille et le dernier jour d’un objectif d’au moins 14 jours dont la fin est connue, pour ce qui n’a pas été pris ces 7 derniers jours. Une croix, et il ne revient plus pour cette fin d’objectif.',
      'Cycle arrêté : il s’est fini avec au moins ses 2 dernières semaines sans séance. Le Bilan ne porte alors que sur les semaines faites, sans remarque sur les séances manquées.',
      'Écart « depuis le début de l’objectif » : la mesure de départ doit dater d’au plus 14 jours avant son début, sinon on prend la première prise ensuite. Sans prise comparable, aucun écart n’est affiché.',
      'Rappel de séance (appli Android, si tu l’actives) : les jours prévus à l’heure choisie, sauf si ta séance est déjà commencée.',
    ],
  ],
  [
    'Le constat d’un exercice',
    [
      'Ça monte : un progrès dans les 4 dernières semaines (charge plus dure, ou rep de plus à une charge déjà faite). Le gain affiché est compté sur 8 semaines, en vrais kilos ou en reps.',
      'Stable : plus de progrès depuis au moins 4 semaines, ou aucun depuis le début. Un peu en dessous : tes séries récentes sont nettement moins bonnes que celles du début de ces 8 semaines.',
      'Pas de jugement avant 3 séances (« Première fois », « Trop tôt pour dire »), ni après 4 semaines sans l’exercice (« Pas fait depuis… »). Les séances allégées ne comptent pas.',
    ],
  ],
  [
    'Exercice bloqué',
    [
      'Bloqué : ni charge plus lourde, ni rep de plus à une charge déjà faite, sur 6 semaines d’entraînement et au moins 3 séances, avec l’exercice fait dans les 14 derniers jours. Monter la charge ou ajouter une rep sur une seule série, c’est un progrès. L’effort noté ne compte pas ici.',
      'Ne comptent pas : les semaines sans cet exercice, les déloads et la sèche (y garder ses charges, c’est déjà réussir). Après une sèche ou 3 semaines d’arrêt, on repart de zéro. À la charge maximale du matériel, on ne parle pas de blocage.',
      'Pistes affichées seulement si tu as noté la donnée : sommeil moyen sous 6 h 30, calories « pas assez » au moins 30 % des jours, en prise poids qui monte de moins de 0,1 kg par semaine depuis le début de l’objectif, effort moyen de 9 ou plus, pas de déload ni d’arrêt depuis plus de 6 semaines.',
    ],
  ],
  [
    'Séance allégée',
    [
      'Interrupteur « Séance allégée » (écran « Voir ») : pour cette séance seulement, moitié des séries, charges −10 %, effort 6-7/10, sans finisseur. Ton cycle ne bouge pas.',
      'Elle compte pour ta régularité et pour les muscles de la semaine (séries à 7/10 ou plus). Elle ne compte ni pour la « dernière fois », ni pour les progrès, les records et les blocages : la prochaine vraie séance reprend là où tu en étais.',
      'Elle ne remplace pas une semaine allégée : le conseil d’alléger reste actif.',
    ],
  ],
  [
    'Bilan : « À retenir »',
    [
      'Au plus 3 lignes, dans cet ordre : douleurs signalées, lecture de ton objectif (prise, sèche ou maintien), sommeil, séances sous 75 % du prévu, exercices bloqués (résumés en une ligne), fatigue. Le bilan regarde les semaines finies : la semaine en cours n’y entre pas, sauf le dimanche, pour faire ton point avant d’attaquer la nouvelle. Le texte partagé est plus complet.',
      'Sèche (jugée depuis le début de l’objectif, avec au moins 2 semaines de pesées) : charges en baisse de 5 % ou plus → déficit trop fort ; perte de plus de 1 % du poids par semaine → ralentis ; poids qui ne baisse pas → réduis un peu (150 kcal de moins si tu tiens déjà tes calories) ; les deux à la fois → regarde d’abord ton sommeil et ta fatigue, sans changer ce que tu manges ; sinon « sèche qui marche ».',
      'Prise : moins de +0,1 kg par semaine → mange un peu plus (+100 kcal si tu tiens déjà tes calories) ; plus de +0,4 kg par semaine → 100 kcal de moins ; charges qui ne montent pas → objectif réaliste rappelé ; sinon « prise qui marche ».',
      'Sommeil moyen sous 6 h 30. Séances sous 75 % du prévu ; une semaine mise en pause ne compte ni dans le prévu, ni dans le volume par muscle. Changer de programme ne réécrit pas le passé : chaque semaine est jugée sur ce qui était prévu à ce moment-là.',
      'Fatigue : effort en hausse et énergie en baisse par rapport à la période d’avant → pense à une semaine allégée.',
    ],
  ],
  [
    'Volume et objectifs',
    [
      'Volume par muscle : Léger (sous la cible), Optimal, Beaucoup. Seules les séries dures comptent (effort de 7 ou plus), les muscles secondaires pour une demi-série. Dans le Bilan, les jauges attendent 2 semaines finies d’entraînement. Pour chaque muscle, tu choisis : Normal (10 à 16 séries pour les gros muscles, 6 à 16 pour les plus petits), Entretien (4 à 8, pour le garder sans chercher à le faire grossir) Priorité (16 à 20, pour un point faible, sur 4 à 8 semaines) ou Sans conseil (tes séries restent, sans barre ni remarque). Pour tous les muscles d’un coup : « Masquer les conseils de volume », en bas de la page Volume.',
      'Poids visé d’un objectif : dès que tu le choisis, l’appli donne le rythme par semaine et dit s’il est bon. Un mot si le rythme sort de +0,15 à +0,4 kg par semaine en prise, ou de −0,2 à −1 kg par semaine en sèche. Rien à viser en maintien.',
    ],
  ],
]

export default function ReglesConseils() {
  const [ouvert, setOuvert] = useState<string | null>(null)
  return (
    <div className="carte">
      {REGLES.map(([titre, lignes]) => (
        <div key={titre} className="regle-section">
          <button type="button" className="ligne-reglage" onClick={() => setOuvert(ouvert === titre ? null : titre)} aria-expanded={ouvert === titre}>
            <span>{titre}</span>
            <ChevronRight size={20} className={'muted depliable-chevron' + (ouvert === titre ? ' ouvert' : '')} />
          </button>
          <Deplie ouvert={ouvert === titre}>
            <ul className="regle-lignes pile">
              {lignes.map((l) => (
                <li key={l} className="petit">
                  {l}
                </li>
              ))}
            </ul>
          </Deplie>
        </div>
      ))}
    </div>
  )
}
