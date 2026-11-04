import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { MUSCLES } from '../data/exercices'
import { LigneAide } from './Aide'
import { premiereFois } from '../lib/animations'
import { kg, type LigneVolume } from '../lib/calc'
import { useRetour } from '../lib/nav'
import { ajustee, BONUS_PRIORITE_MUSCLE, cibleConseillee, etatVolume, LIBELLE_VOLUME, prioritaire, zone } from '../lib/volume'
import type { Muscle } from '../types'

interface Props {
  /** Séries dures par muscle sur la semaine prévue. */
  volume: Record<Muscle, number>
  /** Les exercices qui font ce volume, muscle par muscle. */
  detail: Record<Muscle, LigneVolume[]>
  /** Le programme a des jours : seules ces séances comptent, et l'aide le dit. */
  avecJours: boolean
  /** Cibles en vigueur (priorités du cycle comprises). */
  cibles: Record<Muscle, number>
  /** Les cibles réglées par l'utilisateur, et l'enregistrement d'un changement. */
  perso: Record<Muscle, number>
  onCibles: (v: Record<Muscle, number>) => void
}

/** Le niveau d'une jauge : il se remplit la première fois qu'on le voit. */
export function NiveauJauge({ muscle, etat, valeur, max }: { muscle: Muscle; etat: string; valeur: number; max: number }) {
  const [remplit] = useState(() => premiereFois(`jauge:${muscle}:${valeur}:${max}`))
  return <span className={`niveau ${etat}${remplit ? ' remplit' : ''}`} style={{ width: `${Math.min(100, (valeur / max) * 100)}%` }} />
}

/**
 * Une jauge par muscle : séries dures de la semaine face à la zone utile, les muscles hors zone d'abord.
 * Rien à régler d'emblée : un appui sur un muscle montre ses exercices et sa cible, pour qu'aucun chiffre ne change en faisant défiler.
 */
export default function VolumeMuscles({ volume, detail, avecJours, cibles, perso, onCibles }: Props) {
  const [choisi, setChoisi] = useState<Muscle | null>(null)
  const rang = { leger: 0, beaucoup: 1, optimal: 2, suivi: 3 }
  const jauges = MUSCLES.filter((m) => cibles[m.id] > 0).sort((a, b) => rang[etatVolume(a.id, volume[a.id], cibles[a.id])] - rang[etatVolume(b.id, volume[b.id], cibles[b.id])])
  const suivis = MUSCLES.filter((m) => cibles[m.id] <= 0)

  return (
    <>
      {jauges.map((m) => {
        const v = volume[m.id]
        const cible = cibles[m.id]
        const z = zone(m.id, cible)!
        const etat = etatVolume(m.id, v, cible)
        // Échelle : un peu au-delà du haut de la zone, pour voir où l'on se situe.
        const max = z.haut * 1.25
        return (
          <button key={m.id} type="button" className="ligne-volume" onClick={() => setChoisi(m.id)}>
            <span className="ligne-volume-corps">
              <span className="ligne entre petit">
                <span>{m.nom}</span>
                <span>
                  <strong>{kg(v)}</strong> <span className={`etat-volume ${etat}`}>{LIBELLE_VOLUME[etat]}</span>
                  {ajustee(m.id, cible) && <span className="faible"> · visé {kg(cible)}</span>}
                </span>
              </span>
              <span className="jauge">
                <span className="zone-utile" style={{ left: `${(z.bas / max) * 100}%`, width: `${((z.haut - z.bas) / max) * 100}%` }} />
                <NiveauJauge muscle={m.id} etat={etat} valeur={v} max={max} />
              </span>
            </span>
            <ChevronRight size={16} className="muted" />
          </button>
        )
      })}
      {suivis.length > 0 && (
        <details className="volume-suivis">
          <summary className="faible">Aussi suivis, déjà travaillés par les autres exercices ({suivis.length})</summary>
          <div className="chips">
            {suivis.map((m) => (
              <button key={m.id} type="button" onClick={() => setChoisi(m.id)}>
                {m.nom} {kg(volume[m.id])}
              </button>
            ))}
          </div>
        </details>
      )}
      {choisi && (
        <FenetreCible
          key={choisi}
          muscle={choisi}
          volume={volume[choisi]}
          lignes={detail[choisi]}
          avecJours={avecJours}
          enVigueur={cibles[choisi]}
          depart={perso[choisi] ?? 0}
          onFin={(c) => {
            setChoisi(null)
            if (c !== undefined && c !== (perso[choisi] ?? 0)) onCibles({ ...perso, [choisi]: c })
          }}
        />
      )}
    </>
  )
}

/** Un seul muscle : d'où vient son volume, puis sa cible. Un appui à côté ou le retour gardent le changement, « Annuler » ne garde rien. */
function FenetreCible({ muscle, volume, lignes, avecJours, enVigueur, depart, onFin }: { muscle: Muscle; volume: number; lignes: LigneVolume[]; avecJours: boolean; enVigueur: number; depart: number; onFin: (cible?: number) => void }) {
  const [c, setC] = useState(depart)
  useRetour(true, () => onFin(c))
  const def = MUSCLES.find((m) => m.id === muscle)!
  const conseil = cibleConseillee(muscle)
  const prio = prioritaire(muscle, c)
  const fixer = (n: number) => setC(Math.max(0, Math.min(30, n)))
  // Tant que la cible n'a pas bougé, le même état que sur la jauge (priorité du cycle comprise).
  const etat = etatVolume(muscle, volume, c === depart ? enVigueur : c)
  return (
    <div className="modal-fond" onClick={() => onFin(c)}>
      <div className="modal modal-colonne volume-fenetre" onClick={(e) => e.stopPropagation()}>
        <div className="modal-tete">
          <h2>{def.nom}</h2>
          <div className="faible">
            <strong className="volume-total">
              {kg(volume)} série{volume >= 2 ? 's' : ''} par semaine
            </strong>
            {etat !== 'suivi' && <span className={`etat-volume ${etat}`}> · {LIBELLE_VOLUME[etat]}</span>}
          </div>
          <div className="faible">{conseil > 0 ? `Conseillé : ${conseil} à ${def.haut}.` : lignes.length ? 'Pas de cible conseillée : il travaille déjà avec les autres exercices.' : 'Pas de cible conseillée.'}</div>
        </div>
        <div className="modal-defile pile">
          <div className="volume-exos">
            {lignes.map((l) => (
              <div key={`${l.exoId}:${l.seance}`} className={`volume-exo${l.aide ? ' aide' : ''}`}>
                <span className="volume-exo-nom">
                  {l.nom}
                  <span className="faible prog-sous">
                    {l.seance}
                    {l.aide ? ' · aide' : ''}
                  </span>
                </span>
                <span className="volume-exo-series">{kg(l.series)}</span>
              </div>
            ))}
            {lignes.length === 0 && <p className="faible petit-texte">Aucun exercice de ce programme ne le travaille pour l'instant.</p>}
            {lignes.some((l) => l.aide) && <p className="faible petit-texte">Un exercice qui aide compte pour moitié.</p>}
          </div>
          <div className="ligne entre volume-cible">
            <span>
              Ta cible
              {c === 0 && <span className="faible prog-sous">Suivi seulement</span>}
            </span>
            <span className="mini-stepper">
              <button type="button" onClick={() => fixer(c - 1)} aria-label={`Moins pour ${def.nom}`}>
                −
              </button>
              <strong>{kg(c)}</strong>
              <button type="button" onClick={() => fixer(c + 1)} aria-label={`Plus pour ${def.nom}`}>
                +
              </button>
            </span>
          </div>
          {conseil > 0 && (
            <button type="button" className="liste-btn" aria-pressed={prio} onClick={() => setC(prio ? conseil : conseil + BONUS_PRIORITE_MUSCLE)}>
              <span>
                Priorité
                <span className="faible prog-sous">{BONUS_PRIORITE_MUSCLE} séries de plus que le conseillé</span>
              </span>
              {prio && <span>✓</span>}
            </button>
          )}
          {c !== conseil && (
            <button type="button" className="btn discret plein" onClick={() => setC(conseil)}>
              Revenir au conseillé ({kg(conseil)})
            </button>
          )}
          <LigneAide
            libelle="Comment ça se compte ?"
            titre="Comment ça se compte ?"
            texte={
              <div className="pile">
                <p>Ne comptent que les séries vraiment dures : 7/10 d’effort ou plus.</p>
                <p>Un exercice qui aide, comme le triceps sur un développé, compte pour moitié : 3 séries y font 1,5.</p>
                {avecJours && <p>Seules les séances qui ont un jour dans ton programme comptent.</p>}
                <p>La zone verte de la jauge est celle où l’on progresse bien en général.</p>
              </div>
            }
          />
        </div>
        <div className="modal-pied ligne volume-pied">
          <button type="button" className="btn discret" onClick={() => onFin()}>
            Annuler
          </button>
          <button type="button" className="btn" onClick={() => onFin(c)}>
            Terminé
          </button>
        </div>
      </div>
    </div>
  )
}
