import { useState } from 'react'
import { dateCourte } from '../lib/calc'

/** Courbe d'évolution datée ; un appui sur un point affiche sa valeur. */
export default function Courbe({
  points,
  format,
  label = 'Évolution',
  sansEnTete = false,
}: {
  points: { date: string; valeur: number }[]
  format: (v: number) => string
  label?: string
  sansEnTete?: boolean
}) {
  const [actif, setActif] = useState(points.length - 1)
  const L = 320
  const H = 145
  // Marge droite dédiée (42px) pour les labels Y afin d'éviter tout chevauchement avec la courbe
  const m = { g: 8, d: 42, h: 16, b: 24 }
  const vals = points.map((p) => p.valeur)
  let min = Math.min(...vals)
  let max = Math.max(...vals)
  if (max - min < 1) {
    min -= 0.5
    max += 0.5
  }
  const x = (i: number) => m.g + (points.length > 1 ? (i / (points.length - 1)) * (L - m.g - m.d) : (L - m.g - m.d) / 2)
  const y = (v: number) => m.h + (1 - (v - min) / (max - min)) * (H - m.h - m.b)
  const p = points[actif] ?? points[points.length - 1]

  const tracePoints = points.map((q, i) => `${x(i)},${y(q.valeur)}`).join(' ')
  const airePoints = `${tracePoints} ${x(points.length - 1)},${H - m.b} ${x(0)},${H - m.b}`

  return (
    <div style={{ marginTop: sansEnTete ? 4 : 8 }}>
      {/* Valeur du point actif au survol / clic (optionnellement masquée si affichée à côté) */}
      {!sansEnTete && (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6, padding: '0 2px' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--texte)' }}>
            {format(p.valeur)}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {dateCourte(p.date)}
          </div>
        </div>
      )}

      <svg className="graph" viewBox={`0 0 ${L} ${H}`} width="100%" role="img" aria-label={label} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="orangeGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Lignes de repère horizontales */}
        {[min, (min + max) / 2, max].map((v) => (
          <line
            key={v}
            x1={m.g}
            x2={L - m.d}
            y1={y(v)}
            y2={y(v)}
            stroke="rgba(255, 255, 255, 0.06)"
            strokeWidth="1"
          />
        ))}

        {/* Graduations Y placées dans la marge droite dédiée (pas de collision avec la courbe) */}
        <text
          x={L - m.d + 6}
          y={y(max) + 3}
          fill="var(--text-secondary)"
          fontSize="10"
          fontWeight="500"
          textAnchor="start"
        >
          {format(max)}
        </text>
        <text
          x={L - m.d + 6}
          y={y(min) + 3}
          fill="var(--text-secondary)"
          fontSize="10"
          fontWeight="500"
          textAnchor="start"
        >
          {format(min)}
        </text>

        {/* Aire dégradée sous la courbe */}
        <polygon points={airePoints} fill="url(#orangeGradient)" />

        {/* Courbe lisse */}
        <polyline
          fill="none"
          stroke="#f97316"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={tracePoints}
        />

        {/* Ligne verticale repère sur le point actif */}
        <line
          x1={x(actif)}
          x2={x(actif)}
          y1={m.h}
          y2={H - m.b}
          stroke="rgba(255, 255, 255, 0.25)"
          strokeWidth="1"
          strokeDasharray="3 3"
        />

        {/* Point rond unique sur la valeur active */}
        <circle
          cx={x(actif)}
          cy={y(p.valeur)}
          r={5}
          fill="#f97316"
          stroke="var(--bg-app)"
          strokeWidth="2.5"
        />

        {/* Zones interactives de clic / touch sur chaque point */}
        {points.map((_, i) => (
          <rect
            key={i}
            x={x(i) - (L - m.g - m.d) / Math.max(1, points.length * 2)}
            y={0}
            width={(L - m.g - m.d) / Math.max(1, points.length)}
            height={H}
            fill="transparent"
            style={{ cursor: 'pointer' }}
            onClick={() => setActif(i)}
            onTouchStart={() => setActif(i)}
          />
        ))}

        {/* Dates début et fin sur l'axe X */}
        <text x={m.g} y={H - 6} fill="var(--text-secondary)" fontSize="10" textAnchor="start">
          {dateCourte(points[0].date)}
        </text>
        <text x={L - m.d} y={H - 6} fill="var(--text-secondary)" fontSize="10" textAnchor="end">
          {dateCourte(points[points.length - 1].date)}
        </text>
      </svg>
    </div>
  )
}
