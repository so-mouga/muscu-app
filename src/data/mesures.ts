/** Mensurations suivies, avec où et comment mesurer, et leur trait sur la silhouette (viewBox 200 × 400). */
export interface DefMesure {
  id: string
  nom: string
  /** Mesure à deux côtés (gauche / droite), chacun facultatif. */
  cotes: boolean
  consigne: string
  trait: { y: number; x1: number; x2: number }
}

export const MESURES: DefMesure[] = [
  { id: 'cou', nom: 'Cou', cotes: false, consigne: 'Juste sous la pomme d’Adam, ruban horizontal, sans serrer.', trait: { y: 66, x1: 86, x2: 114 } },
  { id: 'epaules', nom: 'Épaules', cotes: false, consigne: 'Au plus large des épaules, bras le long du corps, ruban horizontal.', trait: { y: 86, x1: 24, x2: 176 } },
  { id: 'poitrine', nom: 'Poitrine', cotes: false, consigne: 'Au niveau des tétons, bras le long du corps, en fin d’expiration normale.', trait: { y: 112, x1: 50, x2: 150 } },
  { id: 'bras', nom: 'Bras', cotes: true, consigne: 'Au plus gros du biceps, bras contracté à l’horizontale.', trait: { y: 128, x1: 22, x2: 54 } },
  { id: 'avant_bras', nom: 'Avant-bras', cotes: true, consigne: 'Au plus gros, juste sous le coude, main ouverte et bras tendu.', trait: { y: 186, x1: 16, x2: 44 } },
  { id: 'taille', nom: 'Taille', cotes: false, consigne: 'Au niveau du nombril, ventre relâché (ne rentre pas le ventre), en fin d’expiration.', trait: { y: 166, x1: 60, x2: 140 } },
  { id: 'hanches', nom: 'Hanches', cotes: false, consigne: 'Au plus large des fesses, pieds joints.', trait: { y: 212, x1: 52, x2: 148 } },
  { id: 'cuisse', nom: 'Cuisse', cotes: true, consigne: 'Au plus gros, juste sous le pli de la fesse, jambe relâchée, poids réparti sur les deux pieds.', trait: { y: 258, x1: 54, x2: 96 } },
  { id: 'mollet', nom: 'Mollet', cotes: true, consigne: 'Au plus gros, debout, poids réparti sur les deux pieds.', trait: { y: 336, x1: 56, x2: 90 } },
]

/** Mesures montrées d'emblée ; les autres sont repliées dans « Autres mesures ». */
export const PRINCIPALES = ['poitrine', 'bras_g', 'taille', 'cuisse_g']

export const CONSEILS_MESURE = 'Le matin, à jeun, avant l’entraînement, avec le même ruban. Ruban à plat sur la peau, sans serrer. Toutes les 2 à 4 semaines suffisent.'

/** Clés d'une mesure : `taille`, ou `bras_g` / `bras_d`. */
export const clesDe = (m: DefMesure) => (m.cotes ? [`${m.id}_g`, `${m.id}_d`] : [m.id])

export const nomCle = (cle: string) => {
  const m = MESURES.find((x) => cle === x.id || cle.startsWith(x.id + '_'))
  if (!m) return cle
  return cle.endsWith('_g') ? `${m.nom} gauche` : cle.endsWith('_d') ? `${m.nom} droit${m.id === 'bras' || m.id === 'avant_bras' || m.id === 'mollet' ? '' : 'e'}` : m.nom
}
