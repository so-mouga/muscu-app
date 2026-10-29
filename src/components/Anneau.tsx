import type { ReactNode } from 'react'

interface Props {
  /** Avancement, de 0 à 1. */
  valeur: number
  taille: number
  epaisseur?: number
  couleur?: string
  children?: ReactNode
  label?: string
}

/** Anneau d'avancement avec un contenu centré (pourcentage, temps…). */
export default function Anneau({ valeur, taille, epaisseur = 4, couleur = 'var(--accent)', children, label }: Props) {
  const r = (taille - epaisseur) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, valeur))
  return (
    <div className="anneau" style={{ width: taille, height: taille }} role="img" aria-label={label}>
      <svg width={taille} height={taille} viewBox={`0 0 ${taille} ${taille}`}>
        <circle cx={taille / 2} cy={taille / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={epaisseur} />
        <circle
          cx={taille / 2}
          cy={taille / 2}
          r={r}
          fill="none"
          stroke={couleur}
          strokeWidth={epaisseur}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          transform={`rotate(-90 ${taille / 2} ${taille / 2})`}
        />
      </svg>
      <div className="anneau-centre">{children}</div>
    </div>
  )
}
