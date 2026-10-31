import { useState } from 'react'
import { MUSCLES } from '../data/exercices'
import { kg } from '../lib/calc'
import { ajustee, BONUS_PRIORITE_MUSCLE, cibleConseillee, ciblesConseillees, etatVolume, LIBELLE_VOLUME, prioritaire, zone } from '../lib/volume'
import type { Muscle } from '../types'

interface Props {
  /** Séries dures par muscle sur la semaine (faites ou prévues). */
  volume: Record<Muscle, number>
  /** Cibles en vigueur (priorités du cycle comprises) ; sinon celles de l'appli. */
  cibles?: Record<Muscle, number>
  /** Réglage avancé : les cibles réglées par l'utilisateur, et l'enregistrement d'un changement. */
  perso?: Record<Muscle, number>
  onCibles?: (v: Record<Muscle, number>) => void
  /** Sans réglage : un appui sur un muscle le désigne (ex. sur la silhouette). */
  actif?: Muscle | null
  onChoix?: (m: Muscle) => void
}

/**
 * Une jauge par muscle : séries dures de la semaine face à la zone utile (Léger, Optimal,
 * Beaucoup). Rien à régler par défaut ; « Ajuster les cibles » (replié) pour qui suit un coach.
 */
export default function VolumeMuscles({ volume, cibles, perso, onCibles, actif, onChoix }: Props) {
  const cibleDe = (m: Muscle) => cibles?.[m] ?? cibleConseillee(m)
  // Muscles sans zone (travaillés surtout par d'autres exercices) : regroupés en une ligne, sauf sur la silhouette.
  const affiches = MUSCLES.filter((m) => cibleDe(m.id) > 0 || (onChoix && volume[m.id] > 0))
  const suivis = onChoix ? [] : MUSCLES.filter((m) => cibleDe(m.id) <= 0 && volume[m.id] > 0)

  return (
    <>
      {affiches.map((m) => {
        const v = volume[m.id]
        const cible = cibleDe(m.id)
        const z = zone(m.id, cible)
        const etat = etatVolume(m.id, v, cible)
        // Échelle : un peu au-delà du haut de la zone, pour voir où l'on se situe.
        const max = z ? z.haut * 1.25 : 1
        const contenu = (
          <>
            <div className="ligne entre petit">
              <span>{m.nom}</span>
              <span>
                <strong>{kg(v)}</strong>{' '}
                <span className={`etat-volume ${etat}`}>{etat === 'suivi' ? 'suivi seulement' : LIBELLE_VOLUME[etat]}</span>
                {z && ajustee(m.id, cible) && <span className="faible"> · visé {kg(cible)}</span>}
              </span>
            </div>
            {z && (
              <div className="jauge">
                <span className="zone-utile" style={{ left: `${(z.bas / max) * 100}%`, width: `${((z.haut - z.bas) / max) * 100}%` }} />
                <span className={`niveau ${etat}`} style={{ width: `${Math.min(100, (v / max) * 100)}%` }} />
              </div>
            )}
          </>
        )
        return (
          <div key={m.id} style={{ marginBottom: 8 }}>
            {onChoix ? (
              <button type="button" className={'ligne-volume' + (actif === m.id ? ' actif' : '')} onClick={() => onChoix(m.id)}>
                {contenu}
              </button>
            ) : (
              contenu
            )}
          </div>
        )
      })}
      {suivis.length > 0 && (
        <div className="faible" style={{ marginBottom: 8 }}>
          Suivi seulement (déjà travaillés par les autres exercices) : {suivis.map((m) => `${m.nom} ${kg(volume[m.id])}`).join(' · ')}
        </div>
      )}
      {perso && onCibles && <AjusterCibles perso={perso} onCibles={onCibles} />}
    </>
  )
}

/** Réglage avancé, replié : une cible par muscle (0 à 30), priorité en un appui, retour aux zones conseillées. */
function AjusterCibles({ perso, onCibles }: { perso: Record<Muscle, number>; onCibles: (v: Record<Muscle, number>) => void }) {
  const [ouvert, setOuvert] = useState(false)
  const nbAjustees = MUSCLES.filter((m) => ajustee(m.id, perso[m.id] ?? 0)).length
  const fixer = (m: Muscle, n: number) => onCibles({ ...perso, [m]: Math.max(0, Math.min(30, n)) })
  return (
    <div className="ajuster-cibles">
      <button type="button" className="groupe-repli" onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert}>
        <span>
          Ajuster les cibles
          <span className="faible">{nbAjustees ? ` · ${nbAjustees} ajustée${nbAjustees > 1 ? 's' : ''}` : ' · pour qui suit un coach'}</span>
        </span>
        <span className="muted">{ouvert ? '▾' : '▸'}</span>
      </button>
      {ouvert && (
        <div className="pile" style={{ gap: 6 }}>
          <div className="faible">
            Séries dures par semaine visées pour chaque muscle (0 = suivi seulement). ★ Priorité : +{BONUS_PRIORITE_MUSCLE} au-dessus du conseillé. Chaque changement est daté.
          </div>
          {MUSCLES.map((m) => {
            const c = perso[m.id] ?? 0
            const prio = prioritaire(m.id, c)
            return (
              <div key={m.id} className="ligne entre reglage-cible">
                <span>
                  {m.nom}
                  {ajustee(m.id, c) && <span className="faible"> · conseillé {kg(cibleConseillee(m.id))}</span>}
                </span>
                <span className="ligne" style={{ gap: 6 }}>
                  {cibleConseillee(m.id) > 0 && (
                    <button type="button" className={'btn petit' + (prio ? ' primaire' : '')} aria-pressed={prio} onClick={() => fixer(m.id, prio ? cibleConseillee(m.id) : cibleConseillee(m.id) + BONUS_PRIORITE_MUSCLE)}>
                      ★
                    </button>
                  )}
                  <span className="mini-stepper">
                    <button type="button" onClick={() => fixer(m.id, c - 1)} aria-label={`Moins pour ${m.nom}`}>
                      −
                    </button>
                    <strong>{kg(c)}</strong>
                    <button type="button" onClick={() => fixer(m.id, c + 1)} aria-label={`Plus pour ${m.nom}`}>
                      +
                    </button>
                  </span>
                </span>
              </div>
            )
          })}
          {nbAjustees > 0 && (
            <button type="button" className="btn discret petit lien-action" onClick={() => onCibles(ciblesConseillees())}>
              ↺ Revenir aux zones conseillées
            </button>
          )}
        </div>
      )}
    </div>
  )
}
