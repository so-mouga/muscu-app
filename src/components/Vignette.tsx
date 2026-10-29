import type { Exercice } from '../types'
import IconeMuscle from './IconeMuscle'

/** Photo de l'exercice, ou l'icône de son muscle. */
export default function Vignette({ exo, taille = 44, onClick }: { exo: Exercice; taille?: number; onClick?: () => void }) {
  const style = { width: taille, height: taille, borderRadius: Math.round(taille / 4), flex: '0 0 auto' as const }
  if (exo.image)
    return <img src={exo.image} alt="" className="vignette" style={{ ...style, objectFit: 'cover' }} onClick={onClick} />
  return (
    <span className="vignette vide" style={style} onClick={onClick}>
      <IconeMuscle muscle={exo.muscle} taille={Math.round(taille * 0.9)} />
    </span>
  )
}
