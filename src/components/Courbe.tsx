import { useState } from 'react'
import { premiereFois } from '../lib/animations'
import { dateCourte } from '../lib/calc'

type Point = { date: string; valeur: number }
const jourDe = (iso: string) => Date.parse(iso + 'T12:00:00') / 86400000

/**
 * Courbe d'évolution datée ; un appui sur un point affiche sa valeur. Avec `cible` (poids visé d'un objectif), l'axe
 * suit les dates jusqu'à la fin prévue et un pointillé gris trace le chemin du départ au poids visé.
 */
export default function Courbe({
  points,
  format,
  label = 'Évolution',
  sansEnTete = false,
  cible,
}: {
  points: Point[]
  format: (v: number) => string
  label?: string
  sansEnTete?: boolean
  cible?: { depart: Point; arrivee: Point }
}) {
  const [actif, setActif] = useState(points.length - 1)
  const [trace] = useState(() => premiereFois('courbe:' + label + ':' + points.map((q) => q.date + q.valeur).join()))
  const L = 320
  const H = 145
  // Marge droite dédiée pour les labels Y, assez large pour « 83,6 cm » sans le couper
  const m = { g: 8, d: 48, h: 16, b: 24 }
  const vals = [...points.map((p) => p.valeur), ...(cible ? [cible.depart.valeur, cible.arrivee.valeur] : [])]
  let min = Math.min(...vals)
  let max = Math.max(...vals)
  // Les graduations écrites restent les vraies valeurs, même quand l'échelle est élargie.
  const plusBas = min
  const plusHaut = max
  if (max - min < 1) {
    min -= 0.5
    max += 0.5
  }
  const premier = cible ? Math.min(jourDe(points[0].date), jourDe(cible.depart.date)) : 0
  const xDate = (iso: string) => m.g + ((jourDe(iso) - premier) / Math.max(1, jourDe(cible!.arrivee.date) - premier)) * (L - m.g - m.d)
  const x = (i: number) => (cible ? xDate(points[i].date) : m.g + (points.length > 1 ? (i / (points.length - 1)) * (L - m.g - m.d) : (L - m.g - m.d) / 2))
  const y = (v: number) => m.h + (1 - (v - min) / (max - min)) * (H - m.h - m.b)
  const p = points[actif] ?? points[points.length - 1]

  const tracePoints = points.map((q, i) => `${x(i)},${y(q.valeur)}`).join(' ')
  const airePoints = `${tracePoints} ${x(points.length - 1)},${H - m.b} ${x(0)},${H - m.b}`

  return (
    <div style={{ marginTop: sansEnTete ? 4 : 8 }}>
      {/* Valeur du point actif au survol / clic (optionnellement masquée si affichée à côté) */}
      {!sansEnTete && (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6, padding: '0 2px' }}>
          <div style={{ fontSize: 'var(--t-titre)', fontWeight: 700, color: 'var(--texte)' }}>
            {format(p.valeur)}
          </div>
          <div style={{ fontSize: 'var(--t-legende)', color: 'var(--texte-2)' }}>
            {dateCourte(p.date)}
          </div>
        </div>
      )}

      <svg className="graph" viewBox={`0 0 ${L} ${H}`} width="100%" role="img" aria-label={label} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="orangeGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
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
            stroke="var(--voile)"
            strokeWidth="1"
          />
        ))}

        {/* Graduations Y placées dans la marge droite dédiée (pas de collision avec la courbe) */}
        <text x={L - m.d + 6} y={y(plusHaut) + 3} fill="var(--texte-2)" fontSize="10" fontWeight="500" textAnchor="start">
          {format(plusHaut)}
        </text>
        {y(plusBas) - y(plusHaut) >= 12 && (
          <text x={L - m.d + 6} y={y(plusBas) + 3} fill="var(--texte-2)" fontSize="10" fontWeight="500" textAnchor="start">
            {format(plusBas)}
          </text>
        )}

        {cible && (
          <>
            <line x1={xDate(cible.depart.date)} y1={y(cible.depart.valeur)} x2={xDate(cible.arrivee.date)} y2={y(cible.arrivee.valeur)} stroke="var(--texte-3)" strokeWidth="1.5" strokeDasharray="3 5" />
            <circle cx={xDate(cible.arrivee.date)} cy={y(cible.arrivee.valeur)} r={4} fill="var(--bg)" stroke="var(--texte-2)" strokeWidth="1.5" />
          </>
        )}

        {/* Aire dégradée sous la courbe */}
        <polygon points={airePoints} fill="url(#orangeGradient)" className={trace ? 'trace-apres' : undefined} />

        {/* Courbe lisse */}
        <polyline
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={tracePoints}
          pathLength={1}
          className={trace ? 'trace-ligne' : undefined}
        />

        {/* Ligne verticale repère sur le point actif */}
        <line
          x1={x(actif)}
          x2={x(actif)}
          y1={m.h}
          y2={H - m.b}
          stroke="var(--voile-bord)"
          strokeWidth="1"
          strokeDasharray="3 3"
        />

        {/* Point rond unique sur la valeur active */}
        <circle
          cx={x(actif)}
          cy={y(p.valeur)}
          r={5}
          fill="var(--accent)"
          stroke="var(--bg)"
          strokeWidth="2.5"
          className={trace ? 'trace-apres' : undefined}
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
        <text x={m.g} y={H - 6} fill="var(--texte-2)" fontSize="10" textAnchor="start">
          {dateCourte(points[0].date)}
        </text>
        <text x={L - m.d} y={H - 6} fill="var(--texte-2)" fontSize="10" textAnchor="end">
          {dateCourte(cible ? cible.arrivee.date : points[points.length - 1].date)}
        </text>
      </svg>
    </div>
  )
}
