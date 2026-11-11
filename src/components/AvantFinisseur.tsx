import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { battement } from '../lib/appareil'

/**
 * L'instant d'avant un finisseur : deux secondes en plein écran, avec la consigne, quand on arrive sur la dernière série.
 * Pendant la série, personne ne regarde le téléphone : c'est avant qu'il faut le dire. Un appui le passe.
 */
export default function AvantFinisseur({ exo, technique, consigne, onFin }: { exo: string; technique: string; consigne: string; onFin: () => void }) {
  useEffect(() => {
    battement()
    const t = setTimeout(onFin, 2400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return createPortal(
    <button type="button" className="avant-fin" onClick={onFin} aria-label={`Finisseur, ${technique}. ${consigne} Toucher pour passer.`}>
      <span className="avant-fin-pouls" />
      <span className="avant-fin-petit">
        {exo} · {technique.toLowerCase()}
      </span>
      <span className="avant-fin-grand">Dernière série.</span>
      <span className="avant-fin-fort">À fond.</span>
      <span className="avant-fin-consigne">{consigne}</span>
      <span className="avant-fin-passe">Touche l’écran pour passer</span>
    </button>,
    document.body
  )
}
