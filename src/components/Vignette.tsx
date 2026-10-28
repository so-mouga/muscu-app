import { MUSCLES } from '../data/exercices'
import type { Exercice } from '../types'

/** Photo de l'exercice, ou ses initiales sur fond neutre. */
export default function Vignette({ exo, taille = 44, onClick }: { exo: Exercice; taille?: number; onClick?: () => void }) {
  const style = { width: taille, height: taille, borderRadius: Math.round(taille / 4), flex: '0 0 auto' as const }
  if (exo.image)
    return <img src={exo.image} alt="" className="vignette" style={{ ...style, objectFit: 'cover' }} onClick={onClick} />
  const initiales = (MUSCLES.find((m) => m.id === exo.muscle)?.nom ?? exo.nom).slice(0, 2)
  return (
    <span className="vignette vide" style={{ ...style, fontSize: Math.round(taille / 3) }} onClick={onClick}>
      {initiales}
    </span>
  )
}
