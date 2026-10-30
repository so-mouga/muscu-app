import { useState } from 'react'
import { MUSCLES } from '../data/exercices'
import { kg } from '../lib/calc'
import type { Muscle } from '../types'

interface Props {
  /** Séries dures par muscle sur la semaine (faites ou prévues). */
  volume: Record<Muscle, number>
  /** Objectifs à afficher (cycle ou programme) ; sinon ceux par défaut. */
  cibles?: Record<Muscle, number>
  /** Réglage des objectifs : un appui sur un muscle ouvre son objectif. */
  onCible?: (m: Muscle, v: number) => void
}

/** Au-delà de 125 % de l'objectif, on le signale : plus n'est pas toujours mieux. */
const AU_DESSUS = 1.25

/** Une barre par muscle : séries dures de la semaine face à l'objectif (vert dans la cible, orange au-delà). */
export default function VolumeMuscles({ volume, cibles, onCible }: Props) {
  const [ouvert, setOuvert] = useState<Muscle | null>(null)
  const [ajout, setAjout] = useState(false)
  const cibleDe = (m: Muscle) => cibles?.[m] ?? MUSCLES.find((x) => x.id === m)!.cible
  const affiches = MUSCLES.filter((m) => cibleDe(m.id) > 0 || volume[m.id] > 0 || m.id === ouvert)
  const autres = MUSCLES.filter((m) => !affiches.includes(m))

  return (
    <>
      {affiches.map((m) => {
        const v = volume[m.id]
        const cible = cibleDe(m.id)
        const pct = cible ? Math.min(100, (v / cible) * 100) : 0
        const etat = !cible ? '' : v > cible * AU_DESSUS ? 'trop' : v >= cible ? 'ok' : ''
        const contenu = (
          <>
            <div className="ligne entre petit">
              <span>{m.nom}</span>
              <span className="muted">
                {cible ? (
                  <>
                    {kg(v)}/{kg(cible)}
                    {v > cible * AU_DESSUS && <span className="au-dessus"> · au-dessus</span>}
                  </>
                ) : (
                  // Sans objectif (fessiers, trapèzes…) : seulement le nombre de séries, sans barre.
                  `${kg(v)} · suivi seulement`
                )}
                {onCible && <span className="faible"> ✎</span>}
              </span>
            </div>
            {cible > 0 && (
              <div className={'barre ' + etat}>
                <div style={{ width: pct + '%' }} />
              </div>
            )}
          </>
        )
        return (
          <div key={m.id} style={{ marginBottom: 8 }}>
            {onCible ? (
              <button type="button" className="ligne-volume" onClick={() => setOuvert(ouvert === m.id ? null : m.id)} aria-expanded={ouvert === m.id}>
                {contenu}
              </button>
            ) : (
              contenu
            )}
            {onCible && ouvert === m.id && (
              <div className="ligne entre reglage-cible">
                <span className="faible">Objectif par semaine (0 = aucun)</span>
                <span className="mini-stepper">
                  <button type="button" onClick={() => onCible(m.id, Math.max(0, cible - 1))}>
                    −
                  </button>
                  <strong>{kg(cible)}</strong>
                  <button type="button" onClick={() => onCible(m.id, Math.min(40, cible + 1))}>
                    +
                  </button>
                </span>
              </div>
            )}
          </div>
        )
      })}
      {onCible && autres.length > 0 && (
        <div>
          {ajout ? (
            <div className="chips">
              {autres.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setOuvert(m.id)
                    setAjout(false)
                  }}
                >
                  {m.nom}
                </button>
              ))}
            </div>
          ) : (
            <button type="button" className="btn discret petit lien-action" onClick={() => setAjout(true)}>
              + Objectif pour un autre muscle
            </button>
          )}
        </div>
      )}
    </>
  )
}
