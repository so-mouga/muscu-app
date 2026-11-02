import { useState, type ReactNode } from 'react'
import { Clock, Sparkles } from 'lucide-react'
import type { Catalogue } from '../catalogue'
import { exoAvecReglages, historiqueDe } from '../db'
import { duree, dureeSeanceEffective, e1rm, ecartSerie, estDure, kg, kgSouleves, serieTexte, tempsParExo } from '../lib/calc'
import type { Exercice, ExoPlan, Reglage, Seance, Serie } from '../types'

/** Durée d'une séance : effective (de la 1re à la dernière série), ou jusqu'à maintenant si elle est en cours. */
export const dureeSeance = (s: Seance) => (s.enCours ? Date.now() - s.debut : dureeSeanceEffective(s))

/** Pastilles de bilan d'une séance : durée, séries dures, kg soulevés… */
export function ResumeSeance({ seance, exo }: { seance: Seance; exo?: (id: string) => Exercice }) {
  const ms = dureeSeance(seance)
  const dures = seance.series.filter(estDure).length
  const tonnage = seance.series.reduce((a, s) => a + kgSouleves(s, exo?.(s.exoId)), 0)
  const finisseurs = seance.series.filter((s) => s.type === 'serie_longue' || s.type === 'drop' || s.type === 'rest_pause').length
  const chauffes = Object.values(seance.chauffes).filter(Boolean).length
  return (
    <>
      <div className="ligne wrap" style={{ marginTop: 8, gap: 6 }}>
        <span className="pastille" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Clock size={12} strokeWidth={2} />
          {duree(ms)}
        </span>
        <span className="pastille">
          {dures} série{dures > 1 ? 's' : ''} dure{dures > 1 ? 's' : ''}
        </span>
        <span className="pastille">{kg(Math.round(tonnage))} kg soulevés</span>
        {finisseurs > 0 && (
          <span className="pastille fin" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Sparkles size={12} strokeWidth={2} />
            {finisseurs} finisseur(s)
          </span>
        )}
        {chauffes > 0 && <span className="pastille">{chauffes} échauffement(s)</span>}
      </div>
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
  const [details, setDetails] = useState<Record<string, boolean>>({})
  const toggleDetail = (id: string) => setDetails((d) => ({ ...d, [id]: !d[id] }))

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
        const volumeExo = series.reduce((a, x) => a + kgSouleves(x, exo), 0)
        const meilleur = Math.max(0, ...series.map((x) => e1rm(exo, x, seance.poidsCorps) ?? 0))
        const ouvert = !!details[exo.id]

        return (
          <div key={exo.id} className="carte pile recap">
            <div className="ligne entre" style={{ alignItems: 'center' }}>
              <strong style={{ fontSize: '1.05rem' }}>{exo.nom}</strong>
              <button
                type="button"
                className={'btn discret petit' + (ouvert ? ' actif' : '')}
                style={{
                  padding: '2px 8px',
                  borderRadius: 999,
                  fontSize: '0.82rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                onClick={() => toggleDetail(exo.id)}
                aria-label={`Détails pour ${exo.nom}`}
                aria-expanded={ouvert}
              >
                ℹ <span className={'chevron-accordeon' + (ouvert ? ' ouvert' : '')} style={{ fontSize: 11 }}>▸</span>
              </button>
            </div>

            <div className={'accordeon-tiroir' + (ouvert ? ' ouvert' : '')}>
              <div className="accordeon-contenu">
                <div className="pile" style={{ gap: 6, padding: '8px 0 4px', borderTop: '1px solid var(--bord)', fontSize: '0.86rem' }}>
                  {seance.notes[exo.id] && (
                    <div>
                      📝 <strong>Réglage / note :</strong> {seance.notes[exo.id]}
                    </div>
                  )}
                  {meilleur > 0 && (
                    <div>
                      🏆 <strong>1RM estimé :</strong> {kg(Math.round(meilleur * 2) / 2)} {exo.mode === 'par_main' ? 'kg/main' : 'kg'}
                      {record && meilleur > record ? ' · record battu 🏆' : ''}
                    </div>
                  )}
                  {volumeExo > 0 && (
                    <div>
                      📊 <strong>Volume :</strong> {kg(Math.round(volumeExo))} kg soulevés
                    </div>
                  )}
                  {ms > 0 && (
                    <div>
                      ⏱ <strong>Durée :</strong> {duree(ms)}
                    </div>
                  )}
                  {precedente.length > 0 && (
                    <div className="faible" style={{ marginTop: 2 }}>
                      🗓 <strong>Séance précédente :</strong> {precedente.map((s) => serieTexte(exo, s, false)).join(' · ')}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pile" style={{ gap: 2 }}>
              {series.map((x, k) => {
                const e = ecartSerie(x, precedente[k], exo)
                const contenu = (
                  <div className="ligne entre" style={{ alignItems: 'baseline', flexWrap: 'nowrap', width: '100%', padding: '2px 0' }}>
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span className="faible" style={{ minWidth: 26, display: 'inline-block' }}>S{k + 1}</span>
                      <strong>{serieTexte(exo, x, false)}</strong>
                      {x.douleur ? ' ⚠️' : ''}
                      {onSerie && <span className="faible"> ✎</span>}
                    </span>
                    {e ? (
                      <span className={'avant ' + e.sens} style={{ display: 'inline', textAlign: 'right', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                        {e.sens === 'mieux' ? '↑ ' : e.sens === 'egal' ? '= ' : '↓ '}{e.texte}
                      </span>
                    ) : (
                      <span className="faible" style={{ fontSize: '0.82rem' }}>{precedente.length ? '' : '1re fois'}</span>
                    )}
                  </div>
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

            {basExo?.(exo, plan)}
          </div>
        )
      })}
    </>
  )
}
