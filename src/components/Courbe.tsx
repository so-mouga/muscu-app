import { useState } from 'react'
import { dateCourte } from '../lib/calc'

/** Courbe d'évolution datée ; un appui sur un point affiche sa valeur. */
export default function Courbe({ points, format, label = 'Évolution' }: { points: { date: string; valeur: number }[]; format: (v: number) => string; label?: string }) {
  const [actif, setActif] = useState(points.length - 1)
  const L = 320
  const H = 140
  const m = { g: 8, d: 8, h: 12, b: 22 }
  const vals = points.map((p) => p.valeur)
  let min = Math.min(...vals)
  let max = Math.max(...vals)
  if (max - min < 1) (min -= 1), (max += 1)
  const x = (i: number) => m.g + (i / (points.length - 1)) * (L - m.g - m.d)
  const y = (v: number) => m.h + (1 - (v - min) / (max - min)) * (H - m.h - m.b)
  const p = points[actif]

  return (
    <div style={{ marginTop: 8 }}>
      <div className="ligne entre petit" style={{ marginBottom: 4 }}>
        <strong>{format(p.valeur)}</strong>
        <span className="faible">{dateCourte(p.date)}</span>
      </div>
      <svg className="graph" viewBox={`0 0 ${L} ${H}`} width="100%" role="img" aria-label={label}>
        {[min, (min + max) / 2, max].map((v) => (
          <line key={v} x1={m.g} x2={L - m.d} y1={y(v)} y2={y(v)} stroke="var(--bord)" strokeWidth="1" />
        ))}
        <polyline
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinejoin="round"
          points={points.map((q, i) => `${x(i)},${y(q.valeur)}`).join(' ')}
        />
        <line x1={x(actif)} x2={x(actif)} y1={m.h} y2={H - m.b} stroke="var(--texte-3)" strokeWidth="1" strokeDasharray="3 3" />
        {points.map((q, i) => (
          <g key={i} onClick={() => setActif(i)} style={{ cursor: 'pointer' }}>
            <rect x={x(i) - 14} y={0} width={28} height={H} fill="transparent" />
            <circle cx={x(i)} cy={y(q.valeur)} r={i === actif ? 5 : 4} fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
          </g>
        ))}
        <text x={m.g} y={H - 6}>
          {dateCourte(points[0].date)}
        </text>
        <text x={L - m.d} y={H - 6} textAnchor="end">
          {dateCourte(points[points.length - 1].date)}
        </text>
      </svg>
    </div>
  )
}
