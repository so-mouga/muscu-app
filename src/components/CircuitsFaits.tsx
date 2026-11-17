import { circuitsFaitsDe, resumeCircuit } from '../lib/circuits'
import type { Seance } from '../types'

/** Les circuits d'une séance, une ligne chacun : ce qui était prévu, ce qui a été fait, l'écart de tours. Rien sans circuit. */
export default function CircuitsFaits({ seance, avant, court }: { seance: Seance; avant: Seance[]; /** Une seule ligne de texte, pour la récompense. */ court?: boolean }) {
  const lignes = circuitsFaitsDe(seance, avant)
  if (!lignes.length) return null
  if (court) {
    const faits = lignes.filter((l) => l.fait)
    if (!faits.length) return null
    return (
      <div className="faible petit circuits-court">
        {faits.map((l, k) => (
          <span key={l.circuit.id}>
            {k > 0 && ' · '}
            {l.circuit.nom} : <b>{l.fait}</b>
            {!!l.ecart && l.ecart > 0 && <span className="ok-texte"> +{l.ecart}</span>}
          </span>
        ))}
      </div>
    )
  }
  return (
    <div className="circuits-faits">
      {lignes.map((l) => (
        <div key={l.circuit.id} className="ligne entre">
          <span>
            <strong>{l.circuit.nom}</strong>
            <span className="faible prog-sous">{resumeCircuit(l.circuit)}</span>
          </span>
          <span className={l.fait ? '' : 'faible'}>
            {l.fait || 'pas fait'}
            {!!l.ecart && l.ecart > 0 && <span className="ok-texte"> +{l.ecart}</span>}
          </span>
        </div>
      ))}
    </div>
  )
}
