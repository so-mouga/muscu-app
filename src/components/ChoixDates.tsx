import { dateISO } from '../lib/calc'

const JOUR = 86400000

/** Les dates du Bilan, sur la page : pas de bouton, le bilan suit dès qu'elles sont bonnes. */
export default function ChoixDates({ du, au, erreur, dates, onChange }: { du: string; au: string; /** Rien à dire tant que la date de début n'est pas choisie : la page le dit déjà. */ erreur: string | null; /** Dates des séances, pour dire ce que la période contient. */ dates: string[]; onChange: (du: string, au: string) => void }) {
  const aujourdhui = dateISO()
  const semaines = Math.round((Date.parse(au) - Date.parse(du) + JOUR) / (7 * JOUR))
  const nb = dates.filter((d) => d >= du && d <= au).length

  return (
    <>
      <div className="choix-dates">
        <label>
          <span className="faible">Du</span>
          <input type="date" value={du} max={aujourdhui} onChange={(e) => onChange(e.target.value, au)} />
        </label>
        <label>
          <span className="faible">Au</span>
          <input type="date" value={au} max={aujourdhui} onChange={(e) => onChange(du, e.target.value)} />
        </label>
      </div>
      {!erreur && (
        <p className="faible bilan-periode choix-dates-info">
          {semaines} semaine{semaines > 1 ? 's' : ''} · {nb} séance{nb > 1 ? 's' : ''}
        </p>
      )}
    </>
  )
}
