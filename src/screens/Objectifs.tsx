import { useState } from 'react'
import { changerObjectifs, type Catalogue } from '../catalogue'
import { confirmer } from '../components/Dialogues'
import VolumeMuscles from '../components/VolumeMuscles'
import { setReglage } from '../db'
import { dateCourte, dateISO, semaineType, volumePrevu } from '../lib/calc'
import { volumeDefaut } from '../lib/cycle'
import { CLE_OBJECTIFS, deplacer, nomPhase, PHASES, periodes, phaseA } from '../lib/objectifs'

const JOUR = 86400000
const plusJours = (iso: string, n: number) => dateISO(new Date(Date.parse(iso + 'T12:00:00') + n * JOUR))
const jour = (iso: string) => dateCourte(iso).replace(/^\S+ /, '')
const DUREES = [8, 12, 16]

/** Partie Objectifs de Progression : phase (sèche, maintien, prise) avec sa durée, volume par muscle, plus tard les calories. */
export default function Objectifs({ catalogue }: { catalogue: Catalogue }) {
  const [voirAvant, setVoirAvant] = useState(false)
  const frise = catalogue.objectifs
  const aujourdhui = dateISO()
  const actuelle = phaseA(frise, aujourdhui)
  const avant = periodes(frise)
    .filter((p) => p.fin)
    .reverse()
  const changer = (c: Parameters<typeof changerObjectifs>[1]) => void changerObjectifs(catalogue, c)
  // Bornes pour corriger le début de la phase : après l'étape d'avant, avant l'étape suivante.
  const etapes = frise.map((e) => e.depuis)
  const k = actuelle ? etapes.indexOf(actuelle.debut) : -1
  const minDebut = k > 0 ? plusJours(etapes[k - 1], 1) : undefined
  const maxDebut = k >= 0 && k < etapes.length - 1 ? plusJours(etapes[k + 1], -1) : aujourdhui
  const finie = actuelle?.finPrevue && actuelle.finPrevue < aujourdhui

  const volume = volumePrevu(semaineType(catalogue.actif).map((e) => catalogue.modele(e.modeleId)).filter((m) => !!m), catalogue.exercices)
  const reinitialiser = async () => {
    if (await confirmer('Chaque muscle reprend l’objectif conseillé par l’appli.', { titre: 'Revenir aux objectifs conseillés ?', oui: 'Revenir aux objectifs conseillés' })) changer({ volume: volumeDefaut() })
  }

  return (
    <div>
      {actuelle && finie && (
        <div className="carte pile rappel-phase">
          <strong>
            Ta {nomPhase(actuelle.phase).toLowerCase()} prévue jusqu’au {jour(actuelle.finPrevue!)} est finie.
          </strong>
          <div className="ligne wrap" style={{ gap: 8 }}>
            {actuelle.phase !== 'maintien' && (
              <button className="btn petit" onClick={() => changer({ phase: 'maintien' })}>
                Passer en maintien
              </button>
            )}
            <button className="btn petit" onClick={() => changer({ finPrevue: plusJours(actuelle.finPrevue!, 28) })}>
              Prolonger de 4 semaines
            </button>
          </div>
        </div>
      )}

      <div className="carte pile">
        <h3>Phase</h3>
        <div className="segments" role="radiogroup" aria-label="Phase">
          {PHASES.map((p) => (
            <button key={p.id} role="radio" aria-checked={actuelle?.phase === p.id} className={actuelle?.phase === p.id ? 'actif' : ''} onClick={() => actuelle?.phase !== p.id && changer({ phase: p.id })}>
              {p.court}
            </button>
          ))}
        </div>
        {actuelle ? (
          <>
            <div className="faible">{PHASES.find((p) => p.id === actuelle.phase)!.explication}</div>
            <div>
              <div className="ligne entre">
                <strong>
                  Semaine {actuelle.semaine}
                  {actuelle.total ? ` sur ${actuelle.total}` : ''}
                </strong>
                {actuelle.finPrevue && <span className="faible">jusqu’au {jour(actuelle.finPrevue)}</span>}
              </div>
              {actuelle.total && (
                <div className="barre-phase">
                  <span style={{ width: `${Math.min(100, (actuelle.semaine / actuelle.total) * 100)}%` }} />
                </div>
              )}
            </div>
            <div className="ligne" style={{ gap: 12 }}>
              <label className="champ" style={{ flex: 1 }}>
                <span>Début</span>
                <input
                  type="date"
                  value={actuelle.debut}
                  min={minDebut}
                  max={maxDebut}
                  onChange={(e) => e.target.value && void setReglage(CLE_OBJECTIFS, deplacer(frise, actuelle.debut, e.target.value))}
                />
              </label>
              <label className="champ" style={{ flex: 1 }}>
                <span>Fin prévue</span>
                <input type="date" value={actuelle.finPrevue ?? ''} min={actuelle.debut} onChange={(e) => changer({ finPrevue: e.target.value || undefined })} />
              </label>
            </div>
            <div className="chips">
              {DUREES.map((n) => {
                const fin = plusJours(actuelle.debut, n * 7)
                return (
                  <button key={n} className={actuelle.finPrevue === fin ? 'actif' : ''} onClick={() => changer({ finPrevue: fin })}>
                    {n} semaines
                  </button>
                )
              })}
              <button className={!actuelle.finPrevue ? 'actif' : ''} onClick={() => changer({ finPrevue: undefined })}>
                Sans fin prévue
              </button>
            </div>
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
                <div key={p.debut} className="ligne-mesure">
                  <span>{nomPhase(p.phase)}</span>
                  <span className="faible">
                    {jour(p.debut)} → {jour(p.fin!)} · {Math.max(1, Math.round((Date.parse(p.fin!) - Date.parse(p.debut)) / (7 * JOUR)))} sem.
                  </span>
                </div>
              ))}
          </>
        )}
      </div>

      <div className="carte">
        <h3>Volume par semaine</h3>
        <div className="faible" style={{ margin: '4px 0 10px' }}>
          Séries dures par muscle et par semaine : tes objectifs, les mêmes pour tous tes programmes. En face : ce que prévoit « {catalogue.actif.nom} ». Touche un muscle pour changer son objectif ; chaque changement est daté, pour relire plus tard ce que tu visais.
        </div>
        <VolumeMuscles volume={volume} cibles={catalogue.cibles} onCible={(m, v) => changer({ volume: { ...catalogue.cibles, [m]: v } })} />
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
