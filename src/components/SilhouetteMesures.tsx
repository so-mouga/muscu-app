import { MESURES } from '../data/mesures'

const CORPS = 'var(--silhouette)'

/** Membre : segment arrondi épais (bras, jambes), et son symétrique. */
const membre = (x1: number, y1: number, x2: number, y2: number, e: number) =>
  [
    [x1, y1, x2, y2],
    [200 - x1, y1, 200 - x2, y2],
  ].map(([a, b, c, d], i) => <line key={i} x1={a} y1={b} x2={c} y2={d} stroke={CORPS} strokeWidth={e} strokeLinecap="round" />)

interface Props {
  /** Mesure mise en avant. */
  active?: string
  onChoix?: (id: string) => void
  /** Mesures déjà renseignées (point plein). */
  remplies?: Set<string>
}

/** Silhouette de face avec un trait à chaque endroit de mesure ; un appui sur un trait choisit la mesure. */
export default function SilhouetteMesures({ active, onChoix, remplies }: Props) {
  return (
    <svg viewBox="0 0 200 400" className="silhouette-mesures" role="img" aria-label="Où mesurer">
      {/* Corps */}
      <ellipse cx={100} cy={34} rx={21} ry={26} fill={CORPS} />
      <rect x={89} y={54} width={22} height={22} rx={6} fill={CORPS} />
      <path d="M50 84 Q100 70 150 84 L146 122 Q138 148 136 170 Q148 194 148 222 L100 240 L52 222 Q52 194 64 170 Q62 148 54 122 Z" fill={CORPS} />
      {membre(44, 92, 36, 160, 24)}
      {membre(36, 160, 28, 228, 19)}
      {[0, 1].map((i) => (
        <ellipse key={i} cx={i ? 173 : 27} cy={244} rx={9} ry={12} fill={CORPS} />
      ))}
      {membre(76, 226, 74, 306, 36)}
      {membre(74, 306, 76, 376, 25)}
      {[0, 1].map((i) => (
        <ellipse key={i} cx={i ? 122 : 78} cy={388} rx={13} ry={7} fill={CORPS} />
      ))}

      {/* Endroits de mesure */}
      {MESURES.map((m, k) => {
        const on = m.id === active
        const { y, x1, x2 } = m.trait
        return (
          <g key={m.id} onClick={() => onChoix?.(m.id)} style={{ cursor: onChoix ? 'pointer' : undefined }}>
            {/* Zone d'appui bien plus grande que le trait et le repère */}
            <rect x={x1 - 8} y={y - 14} width={x2 - x1 + 24} height={28} fill="transparent" />
            <line x1={x1} y1={y} x2={x2} y2={y} stroke={on ? 'var(--accent)' : 'var(--texte-3)'} strokeWidth={on ? 3 : 1.6} strokeDasharray={on ? undefined : '4 3'} />
            <circle cx={x2} cy={y} r={on ? 10 : 8.5} fill={on ? 'var(--accent)' : remplies?.has(m.id) ? 'var(--texte-2)' : 'var(--surface)'} stroke={on ? 'var(--accent)' : 'var(--texte-3)'} strokeWidth={1.5} />
            <text x={x2} y={y + 3.5} textAnchor="middle" fontSize={10} fontWeight={700} fill={on ? 'var(--accent-texte)' : remplies?.has(m.id) ? 'var(--bg)' : 'var(--texte-2)'}>
              {k + 1}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
