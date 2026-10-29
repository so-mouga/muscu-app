import type { ReactNode } from 'react'
import type { Catalogue } from '../catalogue'
import { exoAvecReglages, historiqueDe } from '../db'
import { calories, chrono, duree, dureePrevueExo, e1rm, ecartSerie, estDure, kg, POIDS_DEFAUT, kgSouleves, reposTexte, schemaPlan, serieTexte, tempsParExo } from '../lib/calc'
import type { Exercice, ExoPlan, Reglage, Seance, Serie } from '../types'

/** Durée d'une séance : jusqu'à sa fin, ou jusqu'à maintenant si elle est en cours. */
export const dureeSeance = (s: Seance) => (s.fin ?? Date.now()) - s.debut

/** Pastilles de bilan d'une séance : durée, calories, séries dures, kg soulevés… */
export function ResumeSeance({ seance, explication = false, exo }: { seance: Seance; explication?: boolean; exo?: (id: string) => Exercice }) {
  const ms = dureeSeance(seance)
  const dures = seance.series.filter(estDure).length
  const tonnage = seance.series.reduce((a, s) => a + kgSouleves(s, exo?.(s.exoId)), 0)
  const finisseurs = seance.series.filter((s) => s.type === 'serie_longue' || s.type === 'drop' || s.type === 'rest_pause').length
  const chauffes = Object.values(seance.chauffes).filter(Boolean).length
  return (
    <>
      <div className="ligne wrap" style={{ marginTop: 8 }}>
        <span className="pastille">⏱ {duree(ms)}</span>
        <span className="pastille">🔥 ≈ {calories(ms, seance.poidsCorps)} kcal</span>
        <span className="pastille">{dures} séries dures</span>
        <span className="pastille">{kg(Math.round(tonnage))} kg soulevés</span>
        {finisseurs > 0 && <span className="pastille fin">★ {finisseurs} finisseur(s)</span>}
        {chauffes > 0 && <span className="pastille">{chauffes} échauffement(s)</span>}
      </div>
      {explication && (
        <div className="faible" style={{ marginTop: 8 }}>
          Calories estimées d’après la durée et{' '}
          {seance.poidsCorps ? `ton poids (${kg(seance.poidsCorps)} kg)` : `un poids de ${POIDS_DEFAUT} kg : note ton poids dans Progression → Poids pour affiner`}. C’est un ordre de
          grandeur, pas une mesure.
        </div>
      )}
    </>
  )
}

interface Props {
  seance: Seance
  /** Séances terminées avant celle-ci, de la plus récente à la plus ancienne. */
  avant: Seance[]
  reglages: Reglage[]
  catalogue: Catalogue
  /** Contenu ajouté en bas de chaque exercice (ex. « Prochaine fois »). */
  basExo?: (exo: Exercice, plan: ExoPlan) => ReactNode
  /** Appui sur une série (correction depuis l'historique). */
  onSerie?: (s: Serie) => void
}

/** Récap par exercice : séries comparées à la fois d'avant, temps, échauffements, 1RM estimé. */
export default function RecapExos({ seance, avant, reglages, catalogue, basExo, onSerie }: Props) {
  const temps = tempsParExo(seance)
  const plans = seance.exercices.filter((p) => seance.series.some((s) => s.exoId === p.exoId))

  return (
    <>
      {plans.map((plan) => {
        const exo = exoAvecReglages(catalogue.exo(plan.exoId), reglages)
        const histo = historiqueDe(avant, plan.exoId)
        const precedente = histo[0] ?? []
        const record = Math.max(0, ...histo.flat().map((x) => e1rm(exo, x, seance.poidsCorps) ?? 0))
        const series = seance.series.filter((x) => x.exoId === plan.exoId)
        const ms = temps[plan.exoId] ?? 0
        const prevu = dureePrevueExo(seance.exercices, seance.exercices.indexOf(plan))
        const ch = plan.chauffes.filter((_, k) => seance.chauffes[`${exo.id}:${k}`]).length
        const volumeExo = series.reduce((a, x) => a + kgSouleves(x, exo), 0)
        const meilleur = Math.max(0, ...series.map((x) => e1rm(exo, x, seance.poidsCorps) ?? 0))
        return (
          <div key={exo.id} className="carte pile recap">
            <div>
              <div className="ligne entre" style={{ alignItems: 'baseline' }}>
                <strong>{exo.nom}</strong>
                {ms > 0 && (
                  <span className="faible" style={{ whiteSpace: 'nowrap' }}>
                    ⏱ {duree(ms)} <span className="muted">/ prévu {duree(prevu * 1000)}</span>
                  </span>
                )}
              </div>
              <div className="faible">
                Visé : {schemaPlan(exo, plan)} · RPE {plan.series.map((x) => kg(x.rpe)).join(', ')} ·
                repos {reposTexte(plan)}
              </div>
            </div>
            <div>
              {series.map((x, k) => {
                const e = ecartSerie(x, precedente[k], exo)
                const ecartRpe = x.rpeCible !== undefined ? x.rpe - x.rpeCible : 0
                const contenu = (
                  <>
                    <div className="ligne entre">
                      <span>
                        <span className="faible">S{k + 1}</span> {serieTexte(exo, x)}
                        {x.douleur ? ' ⚠️' : ''}
                        {onSerie && <span className="faible"> ✎</span>}
                      </span>
                      {e ? (
                        <span className={'avant ' + e.sens} style={{ display: 'inline', marginTop: 0 }}>
                          {e.sens === 'mieux' ? '↑' : e.sens === 'egal' ? '=' : '↓'} {e.texte}
                        </span>
                      ) : (
                        <span className="faible">{precedente.length ? '' : '1re fois'}</span>
                      )}
                    </div>
                    <div className="faible petit-info">
                      {x.rpeCible !== undefined && (
                        <span style={ecartRpe > 0.5 ? { color: 'var(--alerte)' } : undefined}>
                          RPE visé {kg(x.rpeCible)}
                          {ecartRpe ? ` (${ecartRpe > 0 ? '+' : '−'}${kg(Math.abs(ecartRpe))})` : ' ✓'}
                        </span>
                      )}
                      {k > 0 && <span>⏱ {chrono((x.heure - series[k - 1].heure) / 1000)} depuis S{k}</span>}
                      {precedente[k] && <span>avant : {serieTexte(exo, precedente[k])}</span>}
                    </div>
                  </>
                )
                return onSerie ? (
                  <button key={x.id} className="recap-serie cliquable" onClick={() => onSerie(x)}>
                    {contenu}
                  </button>
                ) : (
                  <div key={x.id} className="recap-serie">
                    {contenu}
                  </div>
                )
              })}
            </div>
            <div className="ligne wrap" style={{ gap: 6 }}>
              {plan.chauffes.length > 0 && (
                <span className="pastille">
                  Échauffement {ch}/{plan.chauffes.length}
                </span>
              )}
              {volumeExo > 0 && <span className="pastille">{kg(Math.round(volumeExo))} kg soulevés</span>}
              {meilleur > 0 && (
                <span className={'pastille' + (record && meilleur > record ? ' ok' : '')}>
                  1RM estimé {kg(Math.round(meilleur * 2) / 2)} {exo.mode === 'par_main' ? 'kg/main' : 'kg'}{record && meilleur > record ? ' · record 🏆' : ''}
                </span>
              )}
            </div>
            {seance.notes[exo.id] && <div className="faible">📝 {seance.notes[exo.id]}</div>}
            {basExo?.(exo, plan)}
          </div>
        )
      })}
    </>
  )
}
