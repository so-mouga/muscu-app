import { useState } from 'react'
import { MUSCLES } from '../data/exercices'
import { kg } from '../lib/calc'
import { etatVolume, LIBELLE_VOLUME, zone } from '../lib/volume'
import type { Muscle } from '../types'
import { ARRIERE, AVANT, CONTOUR_CORPS, ZONES_TACTILES_ARRIERE, ZONES_TACTILES_AVANT, type Forme } from './IconeMuscle'

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
  /** Muscle mis en avant, piloté de l'extérieur (ex. la liste « Détail par muscle »). */
  choisi?: Muscle | null
  onChoisir?: (m: Muscle | null) => void
  /** Ce que veut dire « plein » (par défaut : l'objectif de la semaine atteint). */
  legende?: string
  /** Libellé des séries dans le détail (ex. « prévues », « faites cette semaine »). */
  quoi?: string
}

const FAISCEAUX_EPAULE: { id: Muscle; court: string }[] = [
  { id: 'epaule_avant', court: 'Avant' },
  { id: 'epaule_laterale', court: 'Latérale' },
  { id: 'epaule_arriere', court: 'Arrière' },
]

/** Face et dos, chaque muscle sculpté et coloré selon ses séries dures de la semaine ; un appui donne le détail. */
export default function SilhouetteVolume({ volume, cibles, choisi: choisiExterne, onChoisir, legende = 'objectif atteint', quoi = 'dures' }: Props) {
  const [choisiInterne, setChoisiInterne] = useState<Muscle | null>(null)
  const choisi = choisiExterne !== undefined ? choisiExterne : choisiInterne
  const setChoisi = onChoisir ?? setChoisiInterne
  const cible = (m: Muscle) => cibles?.[m] ?? MUSCLES.find((x) => x.id === m)?.cible ?? 0
  const def = choisi && MUSCLES.find((m) => m.id === choisi)
  const estEpaule = choisi?.startsWith('epaule_')

  const figure = (formes: Forme[], tactiles: { m: Muscle; d: string }[], titre: string) => (
    <figure className="figure-volume">
      <svg viewBox="0 0 120 220" role="img" aria-label={`Muscles travaillés, vue de ${titre}`}>
        {/* Silhouette humaine athlétique en fond */}
        <path d={CONTOUR_CORPS} fill="var(--surface-2)" stroke="var(--bord)" strokeWidth={1} />
        {/* Faisceaux musculaires sculptés */}
        {formes.map((f, i) => {
          const fill = f.m ? NIVEAUX[niveau(volume[f.m], cible(f.m))] : 'var(--silhouette)'
          const estActif = f.m && f.m === choisi
          const props = {
            fill,
            stroke: estActif ? 'var(--texte)' : 'rgba(0,0,0,0.25)',
            strokeWidth: estActif ? 1.5 : 0.6,
            onClick: f.m ? () => setChoisi(f.m === choisi ? null : f.m!) : undefined,
            style: f.m ? { cursor: 'pointer', transition: 'fill 0.15s, stroke 0.15s' } : undefined,
          }
          return <path key={i} d={f.d} {...props} />
        })}
        {/* Calques tactiles invisibles élargis pour garantir un clic sans erreur (épaules, adducteurs, etc.) */}
        {tactiles.map((t, i) => (
          <path
            key={'tac_' + i}
            d={t.d}
            fill="transparent"
            stroke="transparent"
            style={{ cursor: 'pointer' }}
            onClick={() => setChoisi(t.m === choisi ? null : t.m)}
          />
        ))}
      </svg>
      <figcaption className="faible">{titre}</figcaption>
    </figure>
  )

  return (
    <div className="silhouette-volume">
      <div className="figures-volume">
        {figure(AVANT, ZONES_TACTILES_AVANT, 'face')}
        {figure(ARRIERE, ZONES_TACTILES_ARRIERE, 'dos')}
      </div>
      <div className="detail-volume">
        {def ? (
          <span>
            <strong>{def.nom}</strong> : {kg(volume[def.id])} série{volume[def.id] >= 2 ? 's' : ''} {quoi === 'dures' && volume[def.id] >= 2 ? 'dures' : quoi}
            {cible(def.id) ? ` · ${LIBELLE_VOLUME[etatVolume(def.id, volume[def.id], cible(def.id))]} (zone utile ${kg(zone(def.id, cible(def.id))!.bas)} à ${kg(zone(def.id, cible(def.id))!.haut)})` : ' · suivi seulement'}
          </span>
        ) : (
          <span className="faible">Appuie sur un muscle pour voir ses séries.</span>
        )}
      </div>
      {/* Raccourci fluide pour basculer facilement entre les 3 faisceaux d'épaule */}
      {estEpaule && (
        <div className="chips mini-chips" style={{ margin: '2px 0 6px', justifyContent: 'center' }}>
          {FAISCEAUX_EPAULE.map((f) => (
            <button key={f.id} className={choisi === f.id ? 'actif' : ''} onClick={() => setChoisi(f.id)}>
              Épaule {f.court}
            </button>
          ))}
        </div>
      )}
      <div className="legende-volume" aria-hidden="true">
        <span className="faible">0</span>
        {NIVEAUX.map((c, i) => (
          <span key={i} className="case-volume" style={{ background: c }} />
        ))}
        <span className="faible">{legende}</span>
      </div>
    </div>
  )
}
