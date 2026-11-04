import { useState } from 'react'
import { erreurDates } from '../lib/analyse'
import { dateISO } from '../lib/calc'
import { useRetour } from '../lib/nav'

const JOUR = 86400000

/** Choisir la période du Bilan. Un appui à côté garde des dates correctes qu'on vient de changer. */
export default function ChoixDates({ du: duInitial, au: auInitial, dates, onChoix, onFermer }: { du: string; au: string; /** Dates des séances, pour dire ce que la période contient. */ dates: string[]; onChoix: (du: string, au: string) => void; onFermer: () => void }) {
  const [du, setDu] = useState(duInitial)
  const [au, setAu] = useState(auInitial)
  const aujourdhui = dateISO()
  const erreur = erreurDates(du, au, aujourdhui)
  const fermer = () => {
    if (!erreur && (du !== duInitial || au !== auInitial)) onChoix(du, au)
    else onFermer()
  }
  useRetour(true, fermer)
  const semaines = Math.round((Date.parse(au) - Date.parse(du) + JOUR) / (7 * JOUR))
  const nb = dates.filter((d) => d >= du && d <= au).length

  return (
    <div className="modal-fond" onClick={fermer}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Choisir les dates</h2>
        <div className="choix-dates">
          <label>
            <span className="faible">Du</span>
            <input type="date" value={du} max={aujourdhui} onChange={(e) => setDu(e.target.value)} />
          </label>
          <label>
            <span className="faible">Au</span>
            <input type="date" value={au} max={aujourdhui} onChange={(e) => setAu(e.target.value)} />
          </label>
        </div>
        {erreur ? (
          <p className="petit-texte choix-dates-info alerte">{erreur}</p>
        ) : (
          <p className="faible petit-texte choix-dates-info">
            {semaines} semaine{semaines > 1 ? 's' : ''} · {nb} séance{nb > 1 ? 's' : ''}
          </p>
        )}
        <button type="button" className="btn primaire" disabled={!!erreur} onClick={() => onChoix(du, au)}>
          Voir ce bilan
        </button>
      </div>
    </div>
  )
}
