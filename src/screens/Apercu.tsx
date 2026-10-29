import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import type { Catalogue } from '../catalogue'
import { ObjectifApres } from '../components/EditeurObjectif'
import Vignette from '../components/Vignette'
import { db, exoAvecReglages, historiqueDe } from '../db'
import { chargeQte, cibleTexte, dureeEstimee, dureeHabituelle, kg, minutes, reposTexte, schemaPlan, seancesHabituelles } from '../lib/calc'
import { useRetour } from '../lib/nav'
import { planDeload, suggestionDeload } from '../lib/cycle'
import { hausse, suggestionPour } from '../lib/progression'
import type { SeanceModele } from '../types'

interface Props {
  modele: SeanceModele
  catalogue: Catalogue
  onDemarrer: () => void
  onFermer: () => void
  /** Semaine de déload : la séance sera allégée au démarrage. */
  deload?: boolean
}

export default function Apercu({ modele, catalogue, onDemarrer, onFermer, deload = false }: Props) {
  useRetour(true, onFermer)
  // Les déloads ne servent pas de référence pour la progression.
  const terminees = useLiveQuery(() => db.seances.orderBy('debut').reverse().filter((s) => !s.enCours && !s.deload).toArray(), [])
  const reglages = useLiveQuery(() => db.reglages.toArray(), [], [])
  const series = modele.exercices.reduce((a, p) => a + p.series.length, 0)
  const habituelle = terminees && dureeHabituelle(modele.id, terminees)
  const nbHabituelles = terminees ? seancesHabituelles(modele.id, terminees).length : 0
  /** Exercice dont on règle l'objectif (index dans la séance). */
  const [objectif, setObjectif] = useState<number | null>(null)

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
        Prévu : 1 min par série et par échauffement, plus les repos.{habituelle ? (nbHabituelles > 1 ? ` D’habitude : tes ${nbHabituelles} dernières séances.` : ' D’habitude : ta dernière séance.') : ''}
      </div>

      {deload && <div className="bandeau-deload">🧘 Semaine de déload : moitié des séries, charges −10 %, RPE 6-7, sans échec. Récupère.</div>}

      {modele.exercices.map((p0, i) => {
        const p = deload ? planDeload(p0) : p0
        const exo = exoAvecReglages(catalogue.exo(p.exoId), reglages)
        const normale = terminees && suggestionPour(exo, p, terminees)
        const sugg = normale && (deload ? suggestionDeload(exo, normale) : normale)
        const derniere = terminees && historiqueDe(terminees, p.exoId)[0]
        const hausses = sugg ? sugg.charges.map((_, n) => hausse(exo, sugg, derniere, n)) : []
        const battre = hausses.some(Boolean)
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
                  {schemaPlan(exo, p)} · RPE{' '}
                  {p.series.map((x) => kg(x.rpe)).join(', ')} · repos {reposTexte(p)}
                  {p.finisseur && <span style={{ color: 'var(--finisseur)' }}> · ★ finisseur</span>}
                </div>
              </div>
            </div>
            {sugg && (
              <div className={'suggestion petit' + (battre ? ' a-battre' : '')}>
                <div className="ligne entre" style={{ alignItems: 'flex-start' }}>
                  <strong>
                    {cibleTexte(exo, sugg.charges, sugg.reps)}
                  </strong>
                  {battre && <span className="badge-hausse">🔥 À battre</span>}
                </div>
                {battre ? (
                  <div className="muted">
                    {hausses.map((h, n) => (h ? `S${n + 1} ${h}` : null)).filter(Boolean).join(' · ')}
                    {derniere && <> · dernière fois {derniere.map((x) => chargeQte(exo, x.charge, x.reps)).join(', ')}</>}
                  </div>
                ) : (
                  <div className="muted">{sugg.message}</div>
                )}
                {derniere && !deload && (
                  <button className="btn discret petit" style={{ padding: 0, minHeight: 32 }} onClick={() => setObjectif(i)}>
                    ✎ Modifier l’objectif
                  </button>
                )}
              </div>
            )}
            {p.chauffes.length > 0 && <div className="faible">Chauffe : {p.chauffes.join(' · ')}</div>}
            {(p.note || exo.notes) && <div className="faible">ℹ️ {p.note ?? exo.notes}</div>}
          </div>
        )
      })}

      {objectif !== null && terminees && (
        <ObjectifApres
          exo={exoAvecReglages(catalogue.exo(modele.exercices[objectif].exoId), reglages)}
          plan={modele.exercices[objectif]}
          terminees={terminees}
          onFermer={() => setObjectif(null)}
        />
      )}

      <div className="barre-demarrer">
        <button className="btn primaire grand" onClick={onDemarrer}>
          DÉMARRER
        </button>
      </div>
    </div>
  )
}
