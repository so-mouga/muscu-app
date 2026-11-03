import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'

/**
 * « Comment l'appli te conseille » (page de Réglages) : toutes les règles des conseils et alertes, en clair.
 * À tenir à jour quand une règle change (lib/progression, blocages, analyse, motivation, cycle).
 */
const REGLES: [string, string[]][] = [
  [
    'La règle de base',
    [
      'Rien ne monte tout seul : la prochaine fois, l’objectif est de refaire pareil que la dernière fois. C’est toi qui décides de monter, en fin de séance.',
      'L’appli ne commente jamais ton poids, ne compte pas de série de jours (le repos fait partie du programme) et ne donne pas de badges.',
    ],
  ],
  [
    'Pendant la séance',
    [
      'Nouveau record, dès la série validée : ta force estimée battue, sinon une charge jamais soulevée, sinon plus de reps (ou de temps) à cette charge. Jamais en déload.',
      '« Monte d’un cran » : ta série d’avant dépasse le haut de la fourchette de 3 reps ou plus. Proposé : la charge + un pas de l’exercice (sauf au maximum du matériel).',
      '« Faute de frappe ? » : une charge bien plus lourde que d’habitude (plus de 1,5 fois et au moins 20 kg de plus).',
      'Exercice bloqué : une ligne sur la carte de l’exercice (voir « Exercice bloqué »).',
      'Séance ouverte depuis plus de 4 h : un avertissement (séance oubliée).',
    ],
  ],
  [
    'En fin de séance',
    [
      'En tête : combien d’exercices ont été mieux que la dernière fois, et les records.',
      'Le conseil n’existe que pour un exercice avec une fourchette de reps (ex. 8–12). Chaque série est jugée sur sa propre fourchette. Tu l’appliques ou non.',
      'Une rep de plus, même charge : sur deux séries si toutes étaient faciles (effort 7/10 ou moins, 3 reps en réserve), sinon sur une seule ; celles qui sont le plus loin du haut de leur fourchette.',
      'Monter la charge quand toutes les séries prévues sont au haut de leur fourchette, à l’effort visé (en moyenne pas plus d’un demi-point au-dessus, aucune série à plus d’un point), et que la série d’échec n’est pas trop courte. Les reps repartent au bas de la fourchette.',
      'De combien : environ +2,5 %, arrondi au-dessus au palier de la machine (au moins un palier). Le palier sert aussi aux boutons −/+ ; il se corrige en séance en touchant « kg · ±… » sous la charge, ou dans la fiche de l’exercice. Saut de plus de 10 % (petites charges) : refais d’abord une séance au haut de la fourchette pour confirmer. Charge maximale du matériel atteinte (à régler dans la fiche de l’exercice, facultatif) : ralentis la descente ou ajoute une pause.',
      'Série ratée (sous le bas de la fourchette alors que l’effort était au niveau visé) : même charge, vise le bas. Vaut aussi pour des reps fixes.',
      'Deux séances ratées de suite (avec fourchette) : baisser d’environ 5 % (au moins un pas).',
      'Exercice assisté (tractions à la machine) : les kg notés aident, donc tout s’inverse. Progresser, c’est retirer de l’assistance, d’un palier à la fois ; c’est aussi ce qui compte comme un progrès.',
      'Séance écourtée (moins de séries que prévu) : pas de conseil, refais d’abord la séance en entier.',
      'Chaque conseil dit pourquoi, avec tes chiffres du jour (quelle série, combien de reps, quel effort). En fin de séance, tu choisis entre « Comme aujourd’hui » (coché par défaut) et le conseil, un par un ou tous d’un coup avec « suivre les conseils » ; rien ne monte tout seul.',
      'Sans conseil, la carte dit pourquoi on refait pareil : effort plus dur que prévu, ou série d’échec trop courte.',
    ],
  ],
  [
    'Sur l’accueil',
    [
      'Gain en orange à côté d’un exercice (à battre) : seulement quand tu as fixé un objectif plus haut que la dernière fois.',
      'Après 10 jours ou plus sans séance : « mêmes charges que la dernière fois, baisse un peu si c’est trop dur ».',
      'Semaines tenues de suite (à partir de 2) : une semaine est tenue avec les trois quarts des séances prévues (3 → 2, 4 → 3). Le déload et une semaine en pause ne cassent pas la série.',
      'Sur ce bloc (cycle en cours, sinon phase, sinon 4 semaines) : ton exercice principal le plus pratiqué qui a progressé.',
      'Déload à avancer (pendant un cycle) : ta force baisse sur 2 exercices et tu as répondu « Difficile » à 2 des 3 dernières séances, ou ta force baisse sur 3 exercices (ces 10 derniers jours). Jamais dans les 3 semaines après un déload.',
      'En haut, deux rappels au plus : nouvelle version de l’appli, cycle terminé, déload conseillé, programme modifié pendant le cycle, sauvegarde (après 7 jours sans export), mensurations.',
      'Rappel de séance (appli Android, si tu l’actives) : les jours prévus à l’heure choisie, sauf si ta séance est déjà commencée.',
    ],
  ],
  [
    'Exercice bloqué',
    [
      'Bloqué : pas de progrès d’au moins 1 % de ta force estimée (meilleure série pour un exercice d’isolation) depuis 3 semaines et 3 séances, comparé à ton dernier vrai progrès. Il faut 4 séances au moins et l’exercice fait dans les 14 derniers jours. Déloads exclus. Jamais en sèche (y garder ses charges, c’est déjà réussir).',
      'Pistes affichées seulement si tu as noté la donnée : sommeil moyen sous 6 h 30, calories « pas assez » au moins 30 % des jours, en prise poids qui monte de moins de 0,1 kg par semaine, effort moyen de 9 ou plus, pas de déload depuis plus de 6 semaines.',
    ],
  ],
  [
    'Bilan : « À retenir »',
    [
      'Au plus 3 lignes, dans cet ordre : douleurs signalées, lecture de la phase, sommeil, séances sous 75 % du prévu, exercices bloqués (résumés en une ligne), fatigue. Le bilan regarde les semaines finies : la semaine en cours n’y entre pas. Le texte partagé est plus complet.',
      'Sèche (jugée depuis le début de la phase, avec au moins 2 semaines de pesées) : charges en baisse de 5 % ou plus → déficit trop fort ; perte de plus de 1 % du poids par semaine → ralentis ; poids qui ne baisse pas → réduis un peu (150 kcal de moins si tu tiens déjà tes calories) ; sinon « sèche qui marche ».',
      'Prise : moins de +0,1 kg par semaine → mange un peu plus (+100 kcal si tu tiens déjà tes calories) ; plus de +0,4 kg par semaine → 100 kcal de moins ; charges qui ne montent pas → objectif réaliste rappelé ; sinon « prise qui marche ».',
      'Sommeil moyen sous 6 h 30. Séances sous 75 % du prévu ; une semaine mise en pause ne compte ni dans le prévu, ni dans le volume par muscle.',
      'Fatigue : effort en hausse et énergie en baisse par rapport à la période d’avant → pense au déload.',
    ],
  ],
  [
    'Volume et objectifs',
    [
      'Volume par muscle : Léger (sous la cible), Optimal, Beaucoup. Seules les séries dures comptent (effort de 7 ou plus), les muscles secondaires pour une demi-série.',
      'Poids visé d’une phase : dès que tu le choisis, l’appli donne le rythme par semaine et dit s’il est bon. Un mot si le rythme sort de +0,15 à +0,4 kg par semaine en prise, ou de −0,2 à −1 kg par semaine en sèche. Rien à viser en maintien.',
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
            {ouvert === titre ? <ChevronDown size={20} className="muted" /> : <ChevronRight size={20} className="muted" />}
          </button>
          {ouvert === titre && (
            <ul className="regle-lignes pile">
              {lignes.map((l) => (
                <li key={l} className="petit">
                  {l}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}
