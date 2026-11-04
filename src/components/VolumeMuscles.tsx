import { useState } from 'react'
import { ChevronRight, Info } from 'lucide-react'
import { MUSCLES } from '../data/exercices'
import { LigneAide } from './Aide'
import InfosExo, { aDesInfos } from './InfosExo'
import Interrupteur from './Interrupteur'
import { premiereFois } from '../lib/animations'
import { kg, type LigneVolume } from '../lib/calc'
import { useRetour } from '../lib/nav'
import { cibleConseillee, etatVolume, LIBELLE_VOLUME } from '../lib/volume'
import type { Exercice, Muscle } from '../types'

interface Props {
  /** Séries dures par muscle sur la semaine prévue. */
  volume: Record<Muscle, number>
  /** Les exercices qui font ce volume, muscle par muscle. */
  detail: Record<Muscle, LigneVolume[]>
  /** Le programme a des jours : seules ces séances comptent, et l'aide le dit. */
  avecJours: boolean
  /** Pour ouvrir la fiche d'un exercice depuis sa ligne. */
  exo: (id: string) => Exercice
  /** Conseils en vigueur (priorités du cycle comprises) ; 0 = pas de conseil. */
  cibles: Record<Muscle, number>
  /** Ce que la personne a gardé ou coupé, et l'enregistrement d'un changement. */
  perso: Record<Muscle, number>
  onCibles: (v: Record<Muscle, number>) => void
}

/** Le niveau d'une jauge : il se remplit la première fois qu'on le voit. */
export function NiveauJauge({ muscle, etat, valeur, max }: { muscle: Muscle; etat: string; valeur: number; max: number }) {
  const [remplit] = useState(() => premiereFois(`jauge:${muscle}:${valeur}:${max}`))
  return <span className={`niveau ${etat}${remplit ? ' remplit' : ''}`} style={{ width: `${Math.min(100, (valeur / max) * 100)}%` }} />
}

/**
 * Une jauge par muscle : séries dures de la semaine face au conseil, pleine quand il est atteint ; les muscles hors zone d'abord.
 * Rien à régler d'emblée : un appui sur un muscle montre ses exercices, et permet de couper son conseil.
 */
export default function VolumeMuscles({ volume, detail, avecJours, exo, cibles, perso, onCibles }: Props) {
  const [choisi, setChoisi] = useState<Muscle | null>(null)
  const rang = { leger: 0, beaucoup: 1, optimal: 2, suivi: 3 }
  const jauges = MUSCLES.filter((m) => cibles[m.id] > 0).sort((a, b) => rang[etatVolume(a.id, volume[a.id], cibles[a.id])] - rang[etatVolume(b.id, volume[b.id], cibles[b.id])])
  const suivis = MUSCLES.filter((m) => cibles[m.id] <= 0)

  return (
    <>
      {jauges.map((m) => {
        const v = volume[m.id]
        const cible = cibles[m.id]
        const etat = etatVolume(m.id, v, cible)
        return (
          <button key={m.id} type="button" className="ligne-volume" onClick={() => setChoisi(m.id)}>
            <span className="ligne-volume-corps">
              <span className="ligne entre petit">
                <span>{m.nom}</span>
                <span>
                  <strong>{kg(v)}</strong> <span className="faible">sur {kg(cible)}</span> <span className={`etat-volume ${etat}`}>· {LIBELLE_VOLUME[etat]}</span>
                </span>
              </span>
              <span className="jauge">
                <NiveauJauge muscle={m.id} etat={etat} valeur={v} max={cible} />
              </span>
            </span>
            <ChevronRight size={16} className="muted" />
          </button>
        )
      })}
      {suivis.length > 0 && (
        <div className="volume-suivis">
          <div className="faible">Aussi suivis, sans conseil</div>
          <div className="chips">
            {suivis.map((m) => (
              <button key={m.id} type="button" onClick={() => setChoisi(m.id)}>
                {m.nom} {kg(volume[m.id])}
              </button>
            ))}
          </div>
        </div>
      )}
      {choisi && (
        <FenetreCible
          key={choisi}
          muscle={choisi}
          volume={volume[choisi]}
          lignes={detail[choisi]}
          avecJours={avecJours}
          exo={exo}
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

/** Un seul muscle : d'où vient son volume, puis son conseil, à garder ou à couper. Un appui à côté ou le retour gardent le changement, « Annuler » ne garde rien. */
function FenetreCible({ muscle, volume, lignes, avecJours, exo, enVigueur, depart, onFin }: { muscle: Muscle; volume: number; lignes: LigneVolume[]; avecJours: boolean; exo: (id: string) => Exercice; enVigueur: number; depart: number; onFin: (cible?: number) => void }) {
  const [c, setC] = useState(depart)
  const [infos, setInfos] = useState<string | null>(null)
  useRetour(true, () => onFin(c))
  const def = MUSCLES.find((m) => m.id === muscle)!
  const conseil = cibleConseillee(muscle)
  // Tant que rien n'a bougé, le même chiffre que sur la jauge (priorité du cycle comprise).
  const cible = c === depart ? enVigueur : c
  const etat = etatVolume(muscle, volume, cible)
  return (
    <div className="modal-fond" onClick={() => onFin(c)}>
      <div className="modal modal-colonne volume-fenetre" onClick={(e) => e.stopPropagation()}>
        <div className="modal-tete">
          <h2>{def.nom}</h2>
          <div className="faible">
            <strong className="volume-total">
              {kg(volume)} série{volume >= 2 ? 's' : ''} par semaine
            </strong>
            {etat !== 'suivi' && (
              <>
                {' '}
                sur {kg(cible)} <span className={`etat-volume ${etat}`}>· {LIBELLE_VOLUME[etat]}</span>
              </>
            )}
          </div>
        </div>
        <div className="modal-defile pile">
          <div className="volume-exos">
            {lignes.map((l) => {
              const avecInfos = aDesInfos(exo(l.exoId))
              const contenu = (
                <>
                  <span className="volume-exo-nom">
                    {l.nom}
                    {avecInfos && <Info size={16} className="ico-texte volume-exo-info" />}
                    <span className="faible prog-sous">
                      {l.seance}
                      {l.aide ? ' · aide' : ''}
                    </span>
                  </span>
                  <span className="volume-exo-series">{kg(l.series)}</span>
                </>
              )
              const classe = `volume-exo${l.aide ? ' aide' : ''}`
              return avecInfos ? (
                <button key={`${l.exoId}:${l.seance}`} type="button" className={classe} aria-label={`Comment faire : ${l.nom}`} onClick={() => setInfos(l.exoId)}>
                  {contenu}
                </button>
              ) : (
                <div key={`${l.exoId}:${l.seance}`} className={classe}>
                  {contenu}
                </div>
              )
            })}
            {lignes.length === 0 && <p className="faible petit-texte">Aucun exercice de ce programme ne le travaille pour l'instant.</p>}
            {lignes.some((l) => l.aide) && <p className="faible petit-texte">Un exercice qui aide compte pour moitié.</p>}
          </div>
          {conseil > 0 ? (
            <Interrupteur on={c > 0} onChange={(v) => setC(v ? conseil : 0)} label="Conseil pour ce muscle" aide={c > 0 ? `Le conseil général : ${conseil} à ${def.haut} séries.` : 'Coupé : pas de barre ni de remarque.'} />
          ) : (
            <p className="faible petit-texte volume-sans-conseil">Pas de conseil : {lignes.length ? 'il travaille déjà avec les autres exercices, on le suit simplement.' : 'on le suit simplement.'}</p>
          )}
          <LigneAide
            libelle="Comment ça se compte ?"
            titre="Comment ça se compte ?"
            texte={
              <div className="pile">
                <p>Ne comptent que les séries vraiment dures : 7/10 d’effort ou plus.</p>
                <p>Un exercice qui aide, comme le triceps sur un développé, compte pour moitié : 3 séries y font 1,5.</p>
                {avecJours && <p>Seules les séances qui ont un jour dans ton programme comptent.</p>}
                <p>Barre pleine : le conseil général est atteint. « Beaucoup » veut dire que tu le dépasses nettement.</p>
                <p>Pour changer tes séries, modifie les exercices de tes séances.</p>
              </div>
            }
          />
        </div>
        {infos && <InfosExo exo={exo(infos)} onFermer={() => setInfos(null)} />}
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
