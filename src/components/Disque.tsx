import { useId } from 'react'
import { CRANS_PAR_DISQUE } from '../lib/crans'

/**
 * Le disque du logo, d'une seule couleur (celle du texte) : le signe d'un cran. L'encoche et le trou sont découpés par un
 * masque, pour que l'encoche puisse se tailler (`.cran-encoche`, animée par le parent au moment où le cran est gagné).
 */
export function IconeCran({ taille = 16, className }: { taille?: number; className?: string }) {
  const id = useId()
  return (
    <svg width={taille} height={taille} viewBox="76 76 360 360" aria-hidden="true" className={'icone-cran' + (className ? ' ' + className : '')}>
      <mask id={id} maskUnits="userSpaceOnUse" x="76" y="76" width="360" height="360">
        <rect x="76" y="76" width="360" height="360" fill="white" />
        <rect className="cran-encoche" x="220.36" y="76" width="71.28" height="78.18" fill="black" />
        <circle cx="256" cy="256" r="40.73" fill="black" />
      </mask>
      <circle cx="256" cy="256" r="168" fill="currentColor" mask={`url(#${id})`} />
    </svg>
  )
}

/**
 * Le disque en cours : douze crans sur son tour, ceux qui sont gagnés en clair. `nouveaux` : les derniers gagnés
 * (fin de séance), en vert et posés un par un. `chiffre` : le nombre de crans au centre. `plein` : le 12e cran vient
 * d'être gagné : une fois les nouveaux posés, le disque fait un tour et passe au vert (le chiffre, lui, ne tourne pas).
 */
export default function Disque({ crans, nouveaux = 0, taille, chiffre, plein }: { crans: number; nouveaux?: number; taille: number; chiffre?: boolean; plein?: boolean }) {
  return (
    <svg className={'disque' + (plein ? ' disque-plein' : '')} width={taille} height={taille} viewBox="0 0 100 100" aria-hidden="true">
      <g className="disque-tour">
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
        {plein && <circle className="disque-vert" cx="50" cy="50" r="38" pathLength={CRANS_PAR_DISQUE} strokeDasharray="0.82 0.18" />}
      </g>
      </g>
      {chiffre && (
        <text x="50" y="58" textAnchor="middle" className="disque-chiffre">
          {crans}
        </text>
      )}
    </svg>
  )
}
