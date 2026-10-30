import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import type { Catalogue } from '../catalogue'
import { confirmer } from '../components/Dialogues'
import VolumeMuscles from '../components/VolumeMuscles'
import { db, setReglage } from '../db'
import { dateCourte, dateISO, semaineType, volumePrevu } from '../lib/calc'
import { volumeDefaut } from '../lib/cycle'
import { changerPhase, CLE_PHASES, enregistrerVolume, PHASES, phaseA, type PeriodePhase, type Phase } from '../lib/objectifs'

/** Partie Objectifs de Progression : phase (sèche, maintien, prise), volume par muscle, plus tard les calories. */
export default function Objectifs({ catalogue }: { catalogue: Catalogue }) {
  const reglage = useLiveQuery(() => db.reglages.get(CLE_PHASES), [], null)
  const [voirAvant, setVoirAvant] = useState(false)
  if (reglage === null) return null
  const periodes = (reglage?.valeur as PeriodePhase[] | undefined) ?? []
  const aujourdhui = dateISO()
  const actuelle = phaseA(periodes, aujourdhui)
  const avant = periodes.filter((p) => p !== actuelle && p.depuis < (actuelle?.depuis ?? aujourdhui)).reverse()
  const nom = (id: Phase) => PHASES.find((p) => p.id === id)!.nom
  const sauver = (l: PeriodePhase[]) => setReglage(CLE_PHASES, l)
  // Date de début de la phase en cours corrigée (ex. sèche commencée lundi dernier).
  const changerDate = (d: string) => actuelle && d && void sauver(changerPhase(periodes.filter((p) => p !== actuelle), actuelle.phase, d))

  const volume = volumePrevu(semaineType(catalogue.actif).map((e) => catalogue.modele(e.modeleId)).filter((m) => !!m), catalogue.exercices)
  const reinitialiser = async () => {
    if (await confirmer('Chaque muscle reprend l’objectif conseillé par l’appli.', { titre: 'Revenir aux objectifs conseillés ?', oui: 'Revenir aux objectifs conseillés' }))
      await enregistrerVolume(volumeDefaut())
  }

  return (
    <div>
      <div className="carte pile">
        <h3>Phase</h3>
        <div className="segments" role="radiogroup" aria-label="Phase">
          {PHASES.map((p) => (
            <button key={p.id} role="radio" aria-checked={actuelle?.phase === p.id} className={actuelle?.phase === p.id ? 'actif' : ''} onClick={() => void sauver(changerPhase(periodes, p.id, aujourdhui))}>
              {p.court}
            </button>
          ))}
        </div>
        {actuelle ? (
          <>
            <div className="faible">{PHASES.find((p) => p.id === actuelle.phase)!.explication}</div>
            <label className="champ">
              <span>Depuis le</span>
              <input type="date" value={actuelle.depuis} max={aujourdhui} onChange={(e) => changerDate(e.target.value)} />
            </label>
          </>
        ) : (
          <div className="faible">Choisis ta phase actuelle : le Bilan s’en servira pour lire tes perfs et ton poids (une baisse de force n’a pas le même sens en sèche qu’en prise).</div>
        )}
        {avant.length > 0 && (
          <>
            <button type="button" className="groupe-repli" onClick={() => setVoirAvant(!voirAvant)} aria-expanded={voirAvant}>
              <span>
                Phases précédentes <span className="faible">({avant.length})</span>
              </span>
              <span className="muted">{voirAvant ? '▾' : '▸'}</span>
            </button>
            {voirAvant &&
              avant.map((p) => (
                <div key={p.depuis} className="ligne-mesure">
                  <span>{nom(p.phase)}</span>
                  <span className="faible">depuis le {dateCourte(p.depuis)}</span>
                </div>
              ))}
          </>
        )}
      </div>

      <div className="carte">
        <h3>Volume par semaine</h3>
        <div className="faible" style={{ margin: '4px 0 10px' }}>
          Séries dures par muscle et par semaine. Ce sont tes objectifs, les mêmes pour tous tes programmes. En face : ce que prévoit « {catalogue.actif.nom} ». Touche un muscle pour changer son objectif.
        </div>
        <VolumeMuscles volume={volume} cibles={catalogue.cibles} onCible={(m, v) => void enregistrerVolume({ ...catalogue.cibles, [m]: v })} />
        <button className="btn discret petit lien-action" style={{ marginTop: 8 }} onClick={reinitialiser}>
          Revenir aux objectifs conseillés
        </button>
      </div>

      <div className="carte pile" style={{ marginBottom: 24 }}>
        <h3>
          Calories visées <span className="pastille">bientôt</span>
        </h3>
        <div className="faible">Avec la version Android : tes calories du jour face à ton objectif, selon ta phase.</div>
      </div>
    </div>
  )
}
