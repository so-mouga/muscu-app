import { useEffect, useRef, useState } from 'react'
import { alarme } from '../lib/appareil'
import { chrono } from '../lib/calc'

export interface EtatMinuteur {
  /** Horodatage de fin : le temps restant ne dépend jamais d'un décompte en mémoire. */
  fin: number
  duree: number
}

export default function Minuteur({ etat, onChange }: { etat: EtatMinuteur; onChange: (e: EtatMinuteur | null) => void }) {
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
    </div>
  )
}
