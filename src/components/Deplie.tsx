import { useEffect, useState, type ReactNode } from 'react'

const DUREE = 280 // --duree, plus une marge

/** Contenu d'un accordéon : s'ouvre et se referme en douceur, et n'existe plus une fois refermé. */
export default function Deplie({ ouvert, className, children }: { ouvert: boolean; className?: string; children: ReactNode }) {
  const [present, setPresent] = useState(ouvert)
  // Ouvert depuis l'arrivée sur la page, ou mouvement fini : plus rien à couper (ombres, bulles).
  const [pose, setPose] = useState(ouvert)
  useEffect(() => {
    if (ouvert) setPresent(true)
    else setPose(false)
    const minuteur = setTimeout(() => (ouvert ? setPose(true) : setPresent(false)), DUREE)
    return () => clearTimeout(minuteur)
  }, [ouvert])
  if (!ouvert && !present) return null
  return (
    <div className={'deplie' + (ouvert ? ' ouvert' : '') + (pose ? ' pose' : '') + (className ? ' ' + className : '')}>
      <div>{children}</div>
    </div>
  )
}
