import { MESURES } from '../data/mesures'

/** Contour athlétique du corps centré sur viewBox 160 × 220 (largeur 120 centrée de 20 à 140). */
const CORPS_ATHLETIQUE_160 =
  'M80 8 C72 8 67 14 67 22 C67 29 71 34 73 36 L71 42 L54 45 C44 47 39 54 37 64 L33 88 L28 114 C27 119 30 124 34 123 L38 115 L43 92 L48 70 L52 68 L54 88 L57 108 L54 146 L57 188 L55 208 C55 212 62 213 66 210 L67 190 L72 150 L77 118 L80 118 L83 118 L88 150 L93 190 L94 210 C98 213 105 212 105 208 L103 188 L106 146 L103 108 L106 88 L108 68 L112 70 L117 92 L122 115 L126 123 C130 124 133 119 132 114 L127 88 L123 64 C121 54 116 47 106 45 L89 42 L87 36 C89 34 93 29 93 22 C93 14 88 8 80 8 Z'

interface Props {
  /** Mesure mise en avant. */
  active?: string
  onChoix?: (id: string) => void
  /** Mesures déjà renseignées (point plein). */
  remplies?: Set<string>
}

/** Silhouette de face athlétique avec un trait à chaque endroit de mesure ; un appui sur un trait choisit la mesure. */
export default function SilhouetteMesures({ active, onChoix, remplies }: Props) {
  return (
    <svg viewBox="0 0 160 220" className="silhouette-mesures" role="img" aria-label="Où mesurer">
      {/* Silhouette athlétique stylisée */}
      <path d={CORPS_ATHLETIQUE_160} fill="var(--surface-2)" stroke="var(--bord)" strokeWidth={1.2} />

      {/* Endroits de mesure avec zones tactiles élargies */}
      {MESURES.map((m, k) => {
        const on = m.id === active
        const { y, x1, x2 } = m.trait
        // Place de la pastille : à gauche pour les membres gauches (bras, avant-bras, cuisse, mollet), à droite pour le torse
        const aGauche = m.id === 'bras' || m.id === 'avant_bras' || m.id === 'cuisse' || m.id === 'mollet'
        const px = aGauche ? x1 - 7 : x2 + 7

        return (
          <g key={m.id} onClick={() => onChoix?.(m.id)} style={{ cursor: onChoix ? 'pointer' : undefined }}>
            {/* Zone d'appui tactile invisible bien plus grande que le trait */}
            <rect x={x1 - 12} y={y - 12} width={x2 - x1 + 24} height={24} fill="transparent" />
            {/* Trait de mesure (ruban) */}
            <line
              x1={x1}
              y1={y}
              x2={x2}
              y2={y}
              stroke={on ? 'var(--accent)' : 'var(--texte-3)'}
              strokeWidth={on ? 2.4 : 1.5}
              strokeDasharray={on ? undefined : '3 2'}
            />
            {/* Pastille numérotée */}
            <circle
              cx={px}
              cy={y}
              r={on ? 7.5 : 6}
              fill={on ? 'var(--accent)' : remplies?.has(m.id) ? 'var(--texte-2)' : 'var(--surface)'}
              stroke={on ? 'var(--accent)' : 'var(--texte-3)'}
              strokeWidth={1.2}
            />
            <text
              x={px}
              y={y + 2.5}
              textAnchor="middle"
              fontSize={on ? 8.5 : 7.5}
              fontWeight={800}
              fill={on ? 'var(--accent-texte)' : remplies?.has(m.id) ? 'var(--bg)' : 'var(--texte-2)'}
            >
              {k + 1}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
