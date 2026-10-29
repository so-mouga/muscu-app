import { useState } from 'react'
import { MUSCLES } from '../data/exercices'
import { kg } from '../lib/calc'
import type { Muscle } from '../types'
import { ARRIERE, AVANT, type Forme } from './IconeMuscle'

/** Remplissage d'un muscle : une seule teinte, de plus en plus soutenue avec les séries (repère : l'objectif). */
const NIVEAUX = ['var(--silhouette)', 'color-mix(in srgb, var(--accent) 30%, var(--silhouette))', 'color-mix(in srgb, var(--accent) 60%, var(--silhouette))', 'var(--accent)']

/** Niveau 0-3 : rien, moins de la moitié de l'objectif, en route, objectif atteint. Sans objectif : 10 séries = plein. */
function niveau(v: number, cible: number): number {
  if (v <= 0) return 0
  const r = v / (cible || 10)
  return r >= 1 ? 3 : r >= 0.5 ? 2 : 1
}

interface Props {
  volume: Record<Muscle, number>
  cibles?: Record<Muscle, number>
}

/** Face et dos, chaque muscle coloré selon ses séries dures de la semaine ; un appui donne le détail. */
export default function SilhouetteVolume({ volume, cibles }: Props) {
  const [choisi, setChoisi] = useState<Muscle | null>(null)
  const cible = (m: Muscle) => cibles?.[m] ?? MUSCLES.find((x) => x.id === m)?.cible ?? 0
  const def = choisi && MUSCLES.find((m) => m.id === choisi)

  const figure = (formes: Forme[], titre: string) => (
    <figure className="figure-volume">
      <svg viewBox="0 0 60 100" role="img" aria-label={`Muscles travaillés, vue de ${titre}`}>
        {formes.map((f, i) => {
          const fill = f.m ? NIVEAUX[niveau(volume[f.m], cible(f.m))] : 'var(--silhouette)'
          const props = {
            fill,
            stroke: f.m && f.m === choisi ? 'var(--texte)' : 'none',
            strokeWidth: 0.8,
            onClick: f.m ? () => setChoisi(f.m === choisi ? null : f.m!) : undefined,
            style: f.m ? { cursor: 'pointer' } : undefined,
          }
          return 'e' in f ? <ellipse key={i} cx={f.e[0]} cy={f.e[1]} rx={f.e[2]} ry={f.e[3]} {...props} /> : <path key={i} d={f.d} {...props} />
        })}
      </svg>
      <figcaption className="faible">{titre}</figcaption>
    </figure>
  )

  return (
    <div className="silhouette-volume">
      <div className="figures-volume">
        {figure(AVANT, 'face')}
        {figure(ARRIERE, 'dos')}
      </div>
      <div className="detail-volume">
        {def ? (
          <span>
            <strong>{def.nom}</strong> : {kg(volume[def.id])} série{volume[def.id] >= 2 ? 's' : ''} dure{volume[def.id] >= 2 ? 's' : ''}
            {cible(def.id) ? ` sur ${kg(cible(def.id))}` : ' · suivi seulement'}
          </span>
        ) : (
          <span className="faible">Appuie sur un muscle pour voir ses séries.</span>
        )}
      </div>
      <div className="legende-volume" aria-hidden="true">
        <span className="faible">0</span>
        {NIVEAUX.map((c, i) => (
          <span key={i} className="case-volume" style={{ background: c }} />
        ))}
        <span className="faible">objectif atteint</span>
      </div>
    </div>
  )
}
