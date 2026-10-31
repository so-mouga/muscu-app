import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { changerObjectifs, type Catalogue } from '../catalogue'
import { confirmer } from '../components/Dialogues'
import VolumeMuscles from '../components/VolumeMuscles'
import { db, setReglage } from '../db'
import ChampNombre from '../components/ChampNombre'
import { AJUSTEMENT, CLE_PROFIL, objectifDuJour, profilComplet, type Profil } from '../lib/nutrition'
import { dateCourte, dateISO, kg, semaineType, volumePrevu } from '../lib/calc'
import { volumeDefaut } from '../lib/cycle'
import { CLE_OBJECTIFS, deplacer, nomPhase, objectifsA, PHASES, periodes, phaseAffichee, type Phase } from '../lib/objectifs'

const JOUR = 86400000
const plusJours = (iso: string, n: number) => dateISO(new Date(Date.parse(iso + 'T12:00:00') + n * JOUR))
const jour = (iso: string) => dateCourte(iso).replace(/^\S+ /, '')
const DUREES = [8, 12, 16]

/** Partie Objectifs de Progression : phase (sèche, maintien, prise) avec sa durée, volume par muscle, plus tard les calories. */
export default function Objectifs({ catalogue }: { catalogue: Catalogue }) {
  const [voirAvant, setVoirAvant] = useState(false)
  const frise = catalogue.objectifs
  const aujourdhui = dateISO()
  // Phase montrée : celle programmée à l'avance s'il y en a une, sinon celle en cours.
  const phase = phaseAffichee(frise, aujourdhui)
  const avant = periodes(frise)
    .filter((p) => p.fin && p.debut !== phase?.debut)
    .reverse()
  // Une phase à venir se modifie à sa date ; sinon, le changement part d'aujourd'hui.
  const changer = (c: Parameters<typeof changerObjectifs>[1]) => void changerObjectifs(catalogue, c, phase?.aVenir ? phase.debut : aujourdhui)
  const choisir = (id: Phase | undefined) => {
    if (id === phase?.phase) return
    // « Aucune » sur une phase à venir : on l'annule, la phase en cours continue.
    if (!id && phase?.aVenir) void setReglage(CLE_OBJECTIFS, frise.filter((e) => e.depuis !== phase.debut))
    else if (id || phase) changer({ phase: id })
  }
  // Bornes pour déplacer le début : après l'étape d'avant, avant l'étape suivante (l'avenir est permis).
  const etapes = frise.map((e) => e.depuis)
  const k = phase ? etapes.indexOf(phase.debut) : -1
  const minDebut = k > 0 ? plusJours(etapes[k - 1], 1) : undefined
  const maxDebut = k >= 0 && k < etapes.length - 1 ? plusJours(etapes[k + 1], -1) : undefined
  const finie = phase && !phase.aVenir && phase.finPrevue && phase.finPrevue < aujourdhui

  const volume = volumePrevu(semaineType(catalogue.actif).map((e) => catalogue.modele(e.modeleId)).filter((m) => !!m), catalogue.exercices)
  const reinitialiser = async () => {
    if (await confirmer('Chaque muscle reprend l’objectif conseillé par l’appli.', { titre: 'Revenir aux objectifs conseillés ?', oui: 'Revenir aux objectifs conseillés' }))
      void changerObjectifs(catalogue, { volume: volumeDefaut() })
  }

  return (
    <div>
      {phase && finie && (
        <div className="carte pile rappel-phase">
          <strong>
            Ta {nomPhase(phase.phase).toLowerCase()} prévue jusqu’au {jour(phase.finPrevue!)} est finie.
          </strong>
          <div className="ligne wrap" style={{ gap: 8 }}>
            {phase.phase !== 'maintien' && (
              <button className="btn petit" onClick={() => changer({ phase: 'maintien' })}>
                Passer en maintien
              </button>
            )}
            <button className="btn petit" onClick={() => changer({ finPrevue: plusJours(phase.finPrevue!, 28) })}>
              Prolonger de 4 semaines
            </button>
          </div>
        </div>
      )}

      <div className="carte pile">
        <h3>Phase</h3>
        <div className="segments" role="radiogroup" aria-label="Phase">
          {[{ id: undefined, court: 'Aucune' }, ...PHASES].map((p) => (
            <button key={p.court} role="radio" aria-checked={phase?.phase === p.id} className={phase?.phase === p.id ? 'actif' : ''} onClick={() => choisir(p.id)}>
              {p.court}
            </button>
          ))}
        </div>
        {phase ? (
          <>
            <div className="faible">{PHASES.find((p) => p.id === phase.phase)!.explication}</div>
            <div>
              <div className="ligne entre">
                <strong>
                  {phase.aVenir ? `Commence le ${dateCourte(phase.debut)}` : `Semaine ${phase.semaine}${phase.total ? ` sur ${phase.total}` : ''}`}
                </strong>
                {phase.finPrevue && <span className="faible">jusqu’au {jour(phase.finPrevue)}</span>}
              </div>
              {!phase.aVenir && phase.total && (
                <div className="barre-phase">
                  <span style={{ width: `${Math.min(100, (phase.semaine / phase.total) * 100)}%` }} />
                </div>
              )}
              {phase.enCours && (
                <div className="faible" style={{ marginTop: 4 }}>
                  Jusque-là : {nomPhase(phase.enCours.phase).toLowerCase()} (semaine {phase.enCours.semaine}
                  {phase.enCours.total ? ` sur ${phase.enCours.total}` : ''}).
                </div>
              )}
            </div>
            <div className="ligne" style={{ gap: 12 }}>
              <label className="champ" style={{ flex: 1, minWidth: 0 }}>
                <span>Début</span>
                <input
                  type="date"
                  value={phase.debut}
                  min={minDebut}
                  max={maxDebut}
                  onChange={(e) => e.target.value && void setReglage(CLE_OBJECTIFS, deplacer(frise, phase.debut, e.target.value))}
                />
              </label>
              <label className="champ" style={{ flex: 1, minWidth: 0 }}>
                <span>Fin prévue</span>
                <input type="date" value={phase.finPrevue ?? ''} min={phase.debut} onChange={(e) => changer({ finPrevue: e.target.value || undefined })} />
              </label>
            </div>
            <div className="chips">
              {DUREES.map((n) => {
                const fin = plusJours(phase.debut, n * 7)
                return (
                  <button key={n} className={phase.finPrevue === fin ? 'actif' : ''} onClick={() => changer({ finPrevue: fin })}>
                    {n} semaines
                  </button>
                )
              })}
              <button className={!phase.finPrevue ? 'actif' : ''} onClick={() => changer({ finPrevue: undefined })}>
                Sans fin prévue
              </button>
            </div>
            <div className="faible">Le début peut être dans le futur (ex. lundi prochain) : la phase est alors prévue, et visible dans le calendrier du Journal.</div>
          </>
        ) : (
          <div className="faible">Choisis ta phase : le Bilan s’en servira pour lire tes perfs et ton poids (une baisse de force n’a pas le même sens en sèche qu’en prise). Tu pourras la faire commencer plus tard.</div>
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
        <VolumeMuscles volume={volume} cibles={catalogue.cibles} onCible={(m, v) => void changerObjectifs(catalogue, { volume: { ...catalogue.cibles, [m]: v } })} />
        <button className="btn discret petit lien-action" style={{ marginTop: 8 }} onClick={reinitialiser}>
          Revenir aux objectifs conseillés
        </button>
      </div>

      <CaloriesVisees catalogue={catalogue} />
    </div>
  )
}

/** Objectif calories du jour : calculé d'après le profil, le poids et la phase, ou fixé à la main (daté dans les objectifs). */
function CaloriesVisees({ catalogue }: { catalogue: Catalogue }) {
  const profil = useLiveQuery(() => db.reglages.get(CLE_PROFIL), [], null)
  const pesee = useLiveQuery(() => db.pesees.orderBy('date').last(), [], null)
  if (profil === null || pesee === null) return null
  const p = profil?.valeur as Profil | undefined
  const aujourdhui = dateISO()
  const o = objectifDuJour(catalogue.objectifs, aujourdhui, p, pesee?.poids, catalogue.planning.length)
  const manquant = [!profilComplet(p) && 'ton profil (Réglages → Mon profil)', !pesee && 'une pesée (Progression → Corps)'].filter(Boolean)
  const ajust = o?.phase ? AJUSTEMENT[o.phase] : 0
  return (
    <div className="carte pile" style={{ marginBottom: 24 }}>
      <h3>Calories visées</h3>
      {o ? (
        <>
          <div className="ligne entre" style={{ alignItems: 'baseline' }}>
            <strong className="valeur-kcal">{o.kcal.toLocaleString('fr-FR')} kcal</strong>
            {o.proteines && <span className="faible">dont {o.proteines} g de protéines</span>}
          </div>
          <div className="faible">
            {o.manuel
              ? 'Fixé par toi.'
              : `Maintien estimé ${o.maintien!.toLocaleString('fr-FR')} kcal (poids ${kg(pesee!.poids)} kg, activité, ${catalogue.planning.length} séances par semaine)${o.phase ? `, ${ajust > 0 ? '+' : ajust < 0 ? '−' : '±'}${Math.abs(ajust * 100)} % pour ta ${nomPhase(o.phase).toLowerCase()}` : ''}. Il se met à jour à chaque pesée.`}
          </div>
        </>
      ) : (
        <div className="faible">Pour le calcul, il manque {manquant.join(' et ')}. Ou fixe ton objectif toi-même ci-dessous.</div>
      )}
      <div className="ligne entre">
        <span>Mon objectif à moi</span>
        <span className="ligne" style={{ gap: 6 }}>
          <ChampNombre valeur={objectifsA(catalogue.objectifs, aujourdhui)?.calories} placeholder="auto" onChange={(v) => void changerObjectifs(catalogue, { calories: v && Math.round(v) })} />
          <span className="faible">kcal</span>
        </span>
      </div>
      <div className="faible">Laisse vide pour le calcul automatique. Chaque jour, l’accueil te demande si tu as tenu l’objectif de la veille : c’est noté pour le Bilan.</div>
    </div>
  )
}
