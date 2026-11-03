import { useState, type ReactNode } from 'react'
import { BarChart3, CalendarDays, Clock, Info, Sparkles, StickyNote, TriangleAlert, Trophy } from 'lucide-react'
import type { Catalogue } from '../catalogue'
import { exoAvecReglages, historiqueDe } from '../db'
import { duree, dureeSeanceEffective, e1rm, ecartSerie, estDure, kg, kgSouleves, serieTexte, tempsParExo } from '../lib/calc'
import type { Exercice, ExoPlan, Reglage, Seance, Serie } from '../types'
import Deplie from './Deplie'

/** Durée d'une séance : effective (de la 1re à la dernière série), ou jusqu'à maintenant si elle est en cours. */
/** Séance en cours : le temps écoulé ; au-delà de 4 h (oubliée, longue coupure), la même durée que le Journal. */
export const dureeSeance = (s: Seance) => (s.enCours && Date.now() - s.debut <= 4 * 3600000 ? Date.now() - s.debut : dureeSeanceEffective(s))

/** Pastilles de bilan d'une séance : durée, séries dures, kg soulevés… */
export function ResumeSeance({ seance, exo, enLigne }: { seance: Seance; exo?: (id: string) => Exercice; /** Une ligne de texte plutôt que des pastilles. */ enLigne?: boolean }) {
  const ms = dureeSeance(seance)
  const dures = seance.series.filter(estDure).length
  const tonnage = seance.series.reduce((a, s) => a + kgSouleves(s, exo?.(s.exoId)), 0)
  const finisseurs = seance.series.filter((s) => s.type === 'serie_longue' || s.type === 'drop' || s.type === 'rest_pause').length
  const chauffes = Object.values(seance.chauffes).filter(Boolean).length
  if (enLigne) {
    const morceaux = [
      duree(ms),
      dures > 0 && `${dures} série${dures > 1 ? 's' : ''} dure${dures > 1 ? 's' : ''}`,
      tonnage > 0 && `${kg(Math.round(tonnage))} kg soulevés`,
      finisseurs > 0 && `${finisseurs} finisseur${finisseurs > 1 ? 's' : ''}`,
    ]
    return <div className="faible petit">{morceaux.filter(Boolean).join(' · ')}</div>
  }
  return (
    <>
      <div className="ligne wrap" style={{ marginTop: 8, gap: 6 }}>
        <span className="pastille" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Clock size={12} strokeWidth={2} />
          {duree(ms)}
        </span>
        {dures > 0 && (
          <span className="pastille">
            {dures} série{dures > 1 ? 's' : ''} dure{dures > 1 ? 's' : ''}
          </span>
        )}
        {tonnage > 0 && <span className="pastille">{kg(Math.round(tonnage))} kg soulevés</span>}
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
              <strong style={{ fontSize: 'var(--t-texte)' }}>{exo.nom}</strong>
              <button
                type="button"
                className={'btn discret petit' + (ouvert ? ' actif' : '')}
                style={{
                  padding: '2px 8px',
                  borderRadius: 999,
                  fontSize: 'var(--t-petit)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                onClick={() => toggleDetail(exo.id)}
                aria-label={`Détails pour ${exo.nom}`}
                aria-expanded={ouvert}
              >
                <Info size={14} /> <span className={'chevron-accordeon' + (ouvert ? ' ouvert' : '')} style={{ fontSize: 11 }}>▸</span>
              </button>
            </div>

            <Deplie ouvert={ouvert}>
                <div className="pile" style={{ gap: 6, padding: '8px 0 4px', borderTop: '1px solid var(--bord)', fontSize: 'var(--t-petit)' }}>
                  {seance.notes[exo.id] && (
                    <div>
                      <StickyNote size={14} className="ico-texte" /> <strong>Réglage / note :</strong> {seance.notes[exo.id]}
                    </div>
                  )}
                  {meilleur > 0 && (
                    <div>
                      <Trophy size={14} className="ico-texte" /> <strong>Force estimée :</strong> {kg(Math.round(meilleur * 2) / 2)} {exo.mode === 'par_main' ? 'kg/main' : 'kg'}
                      {record && meilleur > record ? ' · record battu' : ''}
                    </div>
                  )}
                  {volumeExo > 0 && (
                    <div>
                      <BarChart3 size={14} className="ico-texte" /> <strong>Volume :</strong> {kg(Math.round(volumeExo))} kg soulevés
                    </div>
                  )}
                  {ms > 0 && (
                    <div>
                      <Clock size={14} className="ico-texte" /> <strong>Durée :</strong> {duree(ms)}
                    </div>
                  )}
                  {precedente.length > 0 && (
                    <div className="faible" style={{ marginTop: 2 }}>
                      <CalendarDays size={14} className="ico-texte" /> <strong>Séance précédente :</strong> {precedente.map((s) => `${serieTexte(exo, s, true)} (effort ${kg(s.rpe)}/10)`).join(' · ')}
                    </div>
                  )}
                </div>
            </Deplie>

            <div className="pile" style={{ gap: 2 }}>
              {series.map((x, k) => {
                const e = ecartSerie(x, precedente[k], exo)
                const contenu = (
                  <div className="ligne entre" style={{ alignItems: 'baseline', flexWrap: 'wrap', columnGap: 8, rowGap: 0, width: '100%', padding: '2px 0' }}>
                    <span>
                      <span className="faible" style={{ minWidth: 26, display: 'inline-block' }}>S{k + 1}</span>
                      <strong>{serieTexte(exo, x, true)}</strong>
                      <span className="faible" style={{ whiteSpace: 'nowrap' }}> · effort {kg(x.rpe)}/10</span>
                      {x.douleur && <TriangleAlert size={14} className="ico-texte" aria-label="Douleur signalée" style={{ marginLeft: 4, color: 'var(--alerte)' }} />}
                    </span>
                    {e ? (
                      <span className={'avant ' + e.sens} style={{ display: 'inline', marginLeft: 'auto', textAlign: 'right', fontSize: 'var(--t-petit)' }}>
                        {e.sens === 'mieux' ? '↑ ' : e.sens === 'egal' ? '= ' : '↓ '}{e.texte}
                      </span>
                    ) : (
                      <span className="faible" style={{ fontSize: 'var(--t-petit)' }}>{precedente.length ? '' : '1re fois'}</span>
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
