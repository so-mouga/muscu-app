import { useEffect, useRef, useState } from 'react'
import { alarme } from '../lib/appareil'
import { chrono } from '../lib/calc'

export interface EtatMinuteur {
  /** Horodatage de fin : le temps restant ne dépend jamais d'un décompte en mémoire. */
  fin: number
  duree: number
  /** Début du repos (la fin bouge avec −15/+15, pas le début). */
  debut?: number
  /** Séance à laquelle appartient ce repos : un autre séance ne le reprend jamais. */
  seanceId?: string
}

interface Props {
  etat: EtatMinuteur
  onChange: (e: EtatMinuteur | null) => void
  /** Ce qui vient après le repos, ex. « Butterfly · série 3/4 ». */
  ensuite?: string
  /** Présent quand l'écran affiché n'est pas l'exercice en cours : y revenir en un appui. */
  onAller?: () => void
}

export default function Minuteur({ etat, onChange, ensuite, onAller }: Props) {
  const [maintenant, setMaintenant] = useState(Date.now())
  const sonne = useRef<number | null>(null)

  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 250)
    return () => clearInterval(t)
  }, [])

  const reste = (etat.fin - maintenant) / 1000
  const fini = reste <= 0

  useEffect(() => {
    // Sonne une seule fois par repos, y compris au retour au premier plan.
    if (fini && sonne.current !== etat.fin) {
      sonne.current = etat.fin
      if (maintenant - etat.fin < 60000) alarme()
    }
  }, [fini, etat.fin, maintenant])

  return (
    <div className={'minuteur' + (fini ? ' fini flash' : '')}>
      <div className="contenu">
        <div className="temps">
          {fini ? chrono(reste) : chrono(Math.ceil(reste))}
          <div className="faible" style={{ color: 'inherit', opacity: 0.7, fontSize: 12, fontWeight: 600 }}>
            {fini ? 'Repos terminé — à toi' : `Repos ${chrono(etat.duree)}`}
          </div>
        </div>
        <button className="btn" onClick={() => onChange({ ...etat, fin: etat.fin - 15000 })}>
          −15
        </button>
        <button className="btn" onClick={() => onChange({ ...etat, fin: etat.fin + 15000 })}>
          +15
        </button>
        <button className="btn" onClick={() => onChange(null)}>
          ✕
        </button>
      </div>
      {ensuite && (
        <button className={'ensuite' + (onAller ? ' cliquable' : '') + (fini && onAller ? ' reprendre' : '')} onClick={onAller} disabled={!onAller}>
          <span>
            <span className="label">{fini ? 'À toi' : 'Ensuite'}</span> {ensuite}
          </span>
          {onAller && <span className="aller">{fini ? 'Reprendre ›' : 'Y aller ›'}</span>}
        </button>
      )}
    </div>
  )
}
