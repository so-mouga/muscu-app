import { useId } from 'react'

/**
 * Le disque du logo, d'une seule couleur (celle du texte) : la marque d'un record battu (un record, une encoche de plus).
 * L'encoche et le trou sont découpés par un masque, pour que l'encoche puisse se tailler (`.cran-encoche`, animée par le
 * parent au moment où le record est battu).
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

