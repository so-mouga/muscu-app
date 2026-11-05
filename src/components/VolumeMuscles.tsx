import { useState } from 'react'
import { CLE_CONSEILS_VOLUME_MASQUES, type Catalogue } from '../catalogue'
import { setReglage } from '../db'
import Interrupteur from './Interrupteur'
import { ChevronRight, Info } from 'lucide-react'
import { MUSCLES } from '../data/exercices'
import { LigneAide } from './Aide'
import InfosExo, { aDesInfos } from './InfosExo'
import { premiereFois } from '../lib/animations'
import { kg, type LigneVolume } from '../lib/calc'
import { useRetour } from '../lib/nav'
import { cibleConseillee, cibleDuNiveau, etatVolume, zone, LIBELLE_VOLUME, niveauDe, phraseNiveau, type NiveauVolume } from '../lib/volume'
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
  /** Le niveau choisi pour chaque muscle, et l'enregistrement d'un changement. */
  perso: Record<Muscle, number>
  onCibles: (v: Record<Muscle, number>) => void
  /** Conseils masqués : les séries seules, sans barre ni choix. */
  masque?: boolean
}

/** « zone 10 à 16 » : 10 est le bas de la zone, pas un objectif à ne pas dépasser. */
const texteZone = (m: Muscle, cible: number) => {
  const z = zone(m, cible)!
  return `zone ${kg(z.bas)} à ${kg(z.haut)}`
}

const NIVEAUX: { id: NiveauVolume; nom: string }[] = [
  { id: 'entretien', nom: 'Entretien' },
  { id: 'normal', nom: 'Normal' },
  { id: 'priorite', nom: 'Priorité' },
  { id: 'sans', nom: 'Sans conseil' },
]

/** Tous les muscles d'un coup, en bas de « Volume par semaine ». Les choix restent : couper le réglage les retrouve. */
export function MasquerConseilsVolume({ catalogue }: { catalogue: Catalogue }) {
  const on = !!catalogue.conseilsVolumeMasques
  return <Interrupteur on={on} onChange={(v) => void setReglage(CLE_CONSEILS_VOLUME_MASQUES, v)} label="Masquer les conseils de volume" aide={on ? 'Tes séries restent affichées, sans barre ni remarque. Tes choix reviennent si tu le coupes.' : 'Pour tous les muscles : le nombre de séries, sans barre ni remarque, ici et dans le Bilan.'} />
}

/** Le niveau d'une jauge : il se remplit la première fois qu'on le voit. */
export function NiveauJauge({ muscle, etat, valeur, max }: { muscle: Muscle; etat: string; valeur: number; max: number }) {
  const [remplit] = useState(() => premiereFois(`jauge:${muscle}:${valeur}:${max}`))
  return <span className={`niveau ${etat}${remplit ? ' remplit' : ''}`} style={{ width: `${Math.min(100, (valeur / max) * 100)}%` }} />
}

/**
 * Une jauge par muscle : séries dures de la semaine face au conseil, pleine quand il est atteint ; les muscles hors zone d'abord.
 * Rien à régler d'emblée : un appui sur un muscle montre ses exercices, et permet de choisir son niveau.
 */
export default function VolumeMuscles({ volume, detail, avecJours, exo, cibles, perso, onCibles, masque }: Props) {
  const [choisi, setChoisi] = useState<Muscle | null>(null)
  const rang = { leger: 0, beaucoup: 1, optimal: 2, suivi: 3 }
  const jauges = MUSCLES.filter((m) => cibles[m.id] > 0).sort((a, b) => rang[etatVolume(a.id, volume[a.id], cibles[a.id])] - rang[etatVolume(b.id, volume[b.id], cibles[b.id])])
  const suivis = MUSCLES.filter((m) => (masque ? cibleConseillee(m.id) : cibles[m.id]) <= 0)
  const sansBarre = masque ? MUSCLES.filter((m) => cibleConseillee(m.id) > 0) : []

  return (
    <>
      {jauges.map((m) => {
        const v = volume[m.id]
        const cible = cibles[m.id]
        const etat = etatVolume(m.id, v, cible)
        const niveau = niveauDe(m.id, perso[m.id])
        return (
          <button key={m.id} type="button" className="ligne-volume" onClick={() => setChoisi(m.id)}>
            <span className="ligne-volume-corps">
              <span className="ligne entre petit">
                <span>
                  {m.nom}
                  {niveau !== 'normal' && <span className="faible"> · {niveau === 'priorite' ? 'priorité' : 'entretien'}</span>}
                </span>
                <span>
                  <strong>{kg(v)}</strong> <span className="faible">· {texteZone(m.id, cible)}</span> <span className={`etat-volume ${etat}`}>· {LIBELLE_VOLUME[etat]}</span>
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
      {sansBarre.map((m) => (
        <button key={m.id} type="button" className="ligne-volume" onClick={() => setChoisi(m.id)}>
          <span className="ligne-volume-corps">
            <span className="ligne entre petit">
              <span>{m.nom}</span>
              <strong>{kg(volume[m.id])}</strong>
            </span>
          </span>
          <ChevronRight size={16} className="muted" />
        </button>
      ))}
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
          masque={masque}
          onFin={(c) => {
            setChoisi(null)
            if (c !== undefined && c !== (perso[choisi] ?? 0)) onCibles({ ...perso, [choisi]: c })
          }}
        />
      )}
    </>
  )
}

/** Un seul muscle : d'où vient son volume, puis ce qu'on veut pour lui. Un appui à côté ou le retour gardent le changement, « Annuler » ne garde rien. */
function FenetreCible({ muscle, volume, lignes, avecJours, exo, enVigueur, depart, masque, onFin }: { muscle: Muscle; volume: number; lignes: LigneVolume[]; avecJours: boolean; exo: (id: string) => Exercice; enVigueur: number; depart: number; masque?: boolean; onFin: (cible?: number) => void }) {
  const [c, setC] = useState(depart)
  const [infos, setInfos] = useState<string | null>(null)
  useRetour(true, () => onFin(c))
  const def = MUSCLES.find((m) => m.id === muscle)!
  const avecConseil = cibleConseillee(muscle) > 0
  const niveau = niveauDe(muscle, c)
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
                · {texteZone(muscle, cible)} <span className={`etat-volume ${etat}`}>· {LIBELLE_VOLUME[etat]}</span>
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
          {!avecConseil ? (
            <p className="faible petit-texte volume-sans-conseil">Pas de conseil : {lignes.length ? 'il travaille déjà avec les autres exercices, on le suit simplement.' : 'on le suit simplement.'}</p>
          ) : (
            !masque && (
              <div className="volume-niveau">
                <div className="petit">Pour ce muscle, tu veux :</div>
                <div className="chips volume-niveaux">
                  {NIVEAUX.map((n) => (
                    <button key={n.id} type="button" className={niveau === n.id ? 'actif' : ''} aria-pressed={niveau === n.id} onClick={() => setC(cibleDuNiveau(muscle, n.id))}>
                      {n.nom}
                    </button>
                  ))}
                </div>
                <p className="faible petit-texte volume-sans-conseil">{phraseNiveau(muscle, niveau)}</p>
              </div>
            )
          )}
          <LigneAide
            libelle="Comment ça se compte ?"
            titre="Comment ça se compte ?"
            texte={
              <div className="pile">
                <p>Ne comptent que les séries vraiment dures : 7/10 d’effort ou plus.</p>
                <p>Un exercice qui aide, comme le triceps sur un développé, compte pour moitié : 3 séries y font 1,5.</p>
                {avecJours && <p>Seules les séances qui ont un jour dans ton programme comptent.</p>}
                {!masque && <p>Barre pleine : ce que tu as choisi pour ce muscle est atteint. « Beaucoup » veut dire que tu le dépasses.</p>}
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
