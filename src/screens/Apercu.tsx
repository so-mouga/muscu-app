import { useLiveQuery } from 'dexie-react-hooks'
import type { Catalogue } from '../catalogue'
import Vignette from '../components/Vignette'
import { db, exoAvecReglages } from '../db'
import { chargeTexte, dureeEstimee, dureeHabituelle, kg, minutes, reposTexte } from '../lib/calc'
import { useRetour } from '../lib/nav'
import { suggestionPour } from '../lib/progression'
import type { SeanceModele } from '../types'

interface Props {
  modele: SeanceModele
  catalogue: Catalogue
  onDemarrer: () => void
  onFermer: () => void
}

export default function Apercu({ modele, catalogue, onDemarrer, onFermer }: Props) {
  useRetour(true, onFermer)
  const terminees = useLiveQuery(() => db.seances.orderBy('debut').reverse().filter((s) => !s.enCours).toArray(), [])
  const reglages = useLiveQuery(() => db.reglages.toArray(), [], [])
  const series = modele.exercices.reduce((a, p) => a + p.series.length, 0)
  const habituelle = terminees && dureeHabituelle(modele.id, terminees)

  return (
    <div>
      <div className="entete">
        <button className="btn" onClick={onFermer} aria-label="Retour">
          ←
        </button>
        <div style={{ flex: 1 }}>
          <h2>{modele.nom}</h2>
          {modele.sousTitre && <div className="faible">{modele.sousTitre}</div>}
        </div>
      </div>

      <div className="ligne wrap" style={{ marginBottom: 12 }}>
        <span className="pastille">≈ {minutes(dureeEstimee(modele))} prévues</span>
        {habituelle && <span className="pastille">⏱ {minutes(habituelle)} d’habitude</span>}
        <span className="pastille">
          {modele.exercices.length} exercice{modele.exercices.length > 1 ? 's' : ''}
        </span>
        <span className="pastille">{series} séries</span>
        {modele.exercices.some((p) => p.finisseur) && <span className="pastille fin">★ {modele.exercices.filter((p) => p.finisseur).length} finisseur(s)</span>}
      </div>

      <div className="faible" style={{ marginBottom: 12 }}>
        Prévu : 1 min par série et par échauffement, plus les repos.{habituelle ? ' D’habitude : tes 3 dernières séances.' : ''}
      </div>

      {modele.exercices.map((p, i) => {
        const exo = exoAvecReglages(catalogue.exo(p.exoId), reglages)
        const sugg = terminees && suggestionPour(exo, p, terminees)
        return (
          <div key={p.exoId + i} className="carte pile">
            <div className="ligne" style={{ gap: 12 }}>
              <Vignette exo={exo} taille={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>
                  {i + 1}. {exo.nom}
                </strong>
                {p.optionnel && <span className="faible"> (optionnel)</span>}
                <div className="faible">
                  {p.series.length} × {p.series[0].repsMin === p.series[0].repsMax ? p.series[0].repsMin : `${p.series[0].repsMin}–${p.series[0].repsMax}`} · RPE{' '}
                  {p.series.map((x) => kg(x.rpe)).join(', ')} · repos {reposTexte(p)}
                  {p.finisseur && <span style={{ color: 'var(--finisseur)' }}> · ★ finisseur</span>}
                </div>
              </div>
            </div>
            {sugg && (
              <div className="suggestion petit">
                <strong>
                  {chargeTexte(exo, sugg.charges[0])}
                  {sugg.charges.some((c) => c !== sugg.charges[0]) && ` → ${chargeTexte(exo, sugg.charges[sugg.charges.length - 1])}`} × {sugg.reps.join('/')}
                </strong>
                <div className="muted">{sugg.message}</div>
              </div>
            )}
            {p.chauffes.length > 0 && <div className="faible">Chauffe : {p.chauffes.join(' · ')}</div>}
            {(p.note || exo.notes) && <div className="faible">ℹ️ {p.note ?? exo.notes}</div>}
          </div>
        )
      })}

      <div className="barre-demarrer">
        <button className="btn primaire grand" onClick={onDemarrer}>
          DÉMARRER
        </button>
      </div>
    </div>
  )
}
