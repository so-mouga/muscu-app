import { CRANS_PAR_DISQUE } from '../lib/crans'

/** Le disque du logo, d'une seule couleur (celle du texte) : le signe d'un cran. */
export function IconeCran({ taille = 16, className }: { taille?: number; className?: string }) {
  return (
    <svg width={taille} height={taille} viewBox="76 76 360 360" aria-hidden="true" className={className}>
      <path fill="currentColor" fillRule="evenodd" d="M220.36,91.82 A168,168 0 1,0 291.64,91.82 L291.64,154.18 L220.36,154.18 Z M256,215.27 a40.73,40.73 0 1,0 0,81.45 a40.73,40.73 0 1,0 0,-81.45 Z" />
    </svg>
  )
}

/**
 * Le disque en cours : douze crans sur son tour, ceux qui sont gagnés en clair. `nouveaux` : les derniers gagnés
 * (fin de séance), en vert et posés un par un. `chiffre` : le nombre de crans au centre.
 */
export default function Disque({ crans, nouveaux = 0, taille, chiffre }: { crans: number; nouveaux?: number; taille: number; chiffre?: boolean }) {
  return (
    <svg className="disque" width={taille} height={taille} viewBox="0 0 100 100" aria-hidden="true">
      <g fill="none" strokeWidth="15" transform="rotate(-90 50 50)">
        <circle className="disque-vide" cx="50" cy="50" r="38" pathLength={CRANS_PAR_DISQUE} strokeDasharray="0.82 0.18" />
        {Array.from({ length: Math.min(crans, CRANS_PAR_DISQUE) }, (_, i) => (
          <circle
            key={i}
            className={i >= crans - nouveaux ? 'disque-nouveau' : 'disque-cran'}
            style={i >= crans - nouveaux ? { animationDelay: `calc(var(--duree) + ${(i - (crans - nouveaux)) * 0.25}s)` } : undefined}
            cx="50"
            cy="50"
            r="38"
            pathLength={CRANS_PAR_DISQUE}
            strokeDashoffset={-i}
            strokeDasharray={`0.82 ${CRANS_PAR_DISQUE}`}
          />
        ))}
      </g>
      {chiffre && (
        <text x="50" y="58" textAnchor="middle" className="disque-chiffre">
          {crans}
        </text>
      )}
    </svg>
  )
}
