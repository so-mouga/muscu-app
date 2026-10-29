import { MUSCLES } from '../data/exercices'
import { kg } from '../lib/calc'
import type { Muscle } from '../types'

interface Props {
  /** Séries dures par muscle sur la semaine (faites ou prévues). */
  volume: Record<Muscle, number>
  /** Objectifs du cycle en cours (sinon ceux par défaut). */
  cibles?: Record<Muscle, number>
}

/** Une barre par muscle : séries dures de la semaine face à l'objectif (vert dans la cible, orange au-delà). */
export default function VolumeMuscles({ volume, cibles }: Props) {
  return (
    <>
      {MUSCLES.map((x) => ({ ...x, cible: cibles?.[x.id] ?? x.cible }))
        .filter((m) => m.cible > 0 || volume[m.id] > 0)
        .map((m) => {
        const v = volume[m.id]
        // Sans objectif (fessiers, trapèzes…) : seulement le nombre de séries, barre neutre.
        if (!m.cible)
          return (
            <div key={m.id} className="ligne entre petit" style={{ marginBottom: 8 }}>
              <span>{m.nom}</span>
              <span className="muted">{kg(v)} · suivi seulement</span>
            </div>
          )
        const pct = Math.min(100, (v / m.cible) * 100)
        const etat = v > m.cible * 1.25 ? 'trop' : v >= m.cible ? 'ok' : ''
        return (
          <div key={m.id} style={{ marginBottom: 8 }}>
            <div className="ligne entre petit">
              <span>{m.nom}</span>
              <span className="muted">
                {kg(v)}/{kg(m.cible)}
              </span>
            </div>
            <div className={'barre ' + etat}>
              <div style={{ width: pct + '%' }} />
            </div>
          </div>
        )
      })}
    </>
  )
}
