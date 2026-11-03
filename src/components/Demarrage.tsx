import { ArrowLeft, X } from 'lucide-react'
import { useState } from 'react'
import { changerObjectifs, installerProgramme, type Catalogue } from '../catalogue'
import { PROGRAMMES_TYPES } from '../data/programmesTypes'
import { dateISO, jourSemaine } from '../lib/calc'
import { CLE_DEMARRAGE, joursRepartis, NOMS_JOURS, ordreDesJours, recommande, type EtatDemarrage, type Etape, type Niveau, type Objectif } from '../lib/demarrage'
import { transition, useRetour } from '../lib/nav'
import { objectifsA } from '../lib/objectifs'
import { setReglage } from '../db'

/** parcours : 1re ouverture ; programme : rouvert depuis l'accueil ; objectif : la question de l'objectif, seule. */
export type ModeDemarrage = 'parcours' | 'programme' | 'objectif'

const OBJECTIFS: { id: Objectif; nom: string; aide?: string }[] = [
  { id: 'seche', nom: 'Perdre du gras' },
  { id: 'prise', nom: 'Prendre du muscle' },
  { id: 'maintien', nom: 'Progresser, poids stable', aide: 'Gagner en force sans viser le poids' },
  { id: 'aucun', nom: 'Je ne sais pas encore', aide: 'Tu pourras choisir plus tard' },
]
const NIVEAUX: { id: Niveau; nom: string; aide?: string }[] = [
  { id: 'debut', nom: 'Je débute ou je reprends' },
  { id: 'regulier', nom: 'Je m’entraîne déjà, propose-moi un programme' },
  { id: 'mien', nom: 'J’ai déjà mon programme', aide: 'Tu le crées ou tu en choisis un' },
]
const INITIALES = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const POSITION: Partial<Record<Etape, number>> = { objectif: 1, ouEnEs: 2, jours: 3 }

function etatDeDepart(mode: ModeDemarrage, initial: EtatDemarrage | undefined, phaseReglee: boolean): EtatDemarrage {
  const e = initial ?? { etape: phaseReglee ? 'ouEnEs' : 'objectif', pile: [], jours: [] }
  if (mode === 'programme') return { ...e, etape: 'ouEnEs', pile: [], choisi: undefined }
  if (mode === 'objectif') return { ...e, etape: 'objectif', pile: [], choisi: undefined }
  return e
}

/**
 * Parcours de démarrage, en plein écran : ce qu'on vise, où on en est, ses jours, puis une proposition.
 * Chaque réponse est gardée tout de suite ; la croix mène à l'accueil et le parcours ne revient plus de lui-même.
 */
export default function Demarrage({ catalogue, mode, initial, onFermer, onCreer, onInstalle }: { catalogue: Catalogue; mode: ModeDemarrage; initial?: EtatDemarrage; onFermer: () => void; onCreer: () => void; onInstalle: () => void }) {
  const [etat, setEtat] = useState(() => etatDeDepart(mode, initial, !!objectifsA(catalogue.objectifs, dateISO())?.phase))
  const seul = mode === 'objectif'

  const garder = (e: EtatDemarrage) => {
    setEtat(e)
    return setReglage(CLE_DEMARRAGE, mode === 'parcours' ? e : { ...e, quitte: true })
  }
  const aller = (etape: Etape, changement: Partial<EtatDemarrage> = {}) => {
    transition(() => void garder({ ...etat, ...changement, etape, pile: [...etat.pile, etat.etape] }), 'avant')
    window.scrollTo({ top: 0 })
  }
  const quitter = async () => {
    await setReglage(CLE_DEMARRAGE, { ...etat, quitte: true })
    onFermer()
  }
  const retour = () => {
    if (!etat.pile.length) return void quitter()
    transition(() => void garder({ ...etat, etape: etat.pile[etat.pile.length - 1], pile: etat.pile.slice(0, -1), choisi: undefined }), 'arriere')
    window.scrollTo({ top: 0 })
  }
  // 1re question de la 1re ouverture : le retour Android ferme l'appli, comme depuis l'accueil.
  useRetour(etat.pile.length > 0 || mode !== 'parcours', retour)

  const repondreObjectif = async (objectif: Objectif) => {
    if (objectif !== 'aucun') await changerObjectifs(catalogue, { phase: objectif })
    else if (objectifsA(catalogue.objectifs, dateISO())?.phase) await changerObjectifs(catalogue, { phase: undefined })
    if (seul) {
      await setReglage(CLE_DEMARRAGE, { ...etat, objectif, quitte: true })
      onFermer()
    } else aller('ouEnEs', { objectif })
  }
  const inverserJour = (j: number) => void garder({ ...etat, jours: etat.jours.includes(j) ? etat.jours.filter((x) => x !== j) : [...etat.jours, j] })

  const position = seul ? undefined : POSITION[etat.etape]
  const n = etat.jours.length
  return (
    <div className="demarrage">
      <div className="demarrage-haut">
        {etat.pile.length > 0 || mode === 'programme' ? (
          <button type="button" className="demarrage-icone" onClick={retour} aria-label="Retour">
            <ArrowLeft size={24} strokeWidth={1.75} />
          </button>
        ) : (
          <span />
        )}
        {position ? (
          <div className="demarrage-points" role="img" aria-label={`Question ${position} sur 3`}>
            {[1, 2, 3].map((i) => (
              <i key={i} className={i <= position ? 'fait' : ''} />
            ))}
          </div>
        ) : (
          <span />
        )}
        <button type="button" className="demarrage-icone" onClick={() => void quitter()} aria-label="Quitter">
          <X size={24} strokeWidth={1.75} />
        </button>
      </div>

      {etat.etape === 'objectif' && (
        <div className="demarrage-corps">
          <h1>Qu’est-ce que tu vises ?</h1>
          <div className="demarrage-choix">
            {OBJECTIFS.map((o) => (
              <button key={o.id} type="button" className={etat.objectif === o.id ? 'demarrage-option pris' : 'demarrage-option'} onClick={() => void repondreObjectif(o.id)}>
                <strong>{o.nom}</strong>
                {o.aide && <span>{o.aide}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {etat.etape === 'ouEnEs' && (
        <div className="demarrage-corps">
          <h1>Où en es-tu ?</h1>
          <div className="demarrage-choix">
            {NIVEAUX.map((o) => (
              <button key={o.id} type="button" className={etat.niveau === o.id ? 'demarrage-option pris' : 'demarrage-option'} onClick={() => aller(o.id === 'mien' ? 'mien' : 'jours', { niveau: o.id })}>
                <strong>{o.nom}</strong>
                {o.aide && <span>{o.aide}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {etat.etape === 'jours' && (
        <>
          <div className="demarrage-corps">
            <h1>Quels jours peux-tu t’entraîner ?</h1>
            <div className="demarrage-jours">
              {INITIALES.map((l, i) => (
                <button key={i} type="button" aria-label={NOMS_JOURS[i + 1]} aria-pressed={etat.jours.includes(i + 1)} onClick={() => inverserJour(i + 1)}>
                  {l}
                </button>
              ))}
            </div>
            <div className="demarrage-compte">{n === 0 ? '' : n === 1 ? 'Choisis au moins 2 jours' : `${n} jours par semaine`}</div>
            <p className="faible">Pas besoin d’être exact : tu pourras faire ta séance un autre jour.</p>
          </div>
          <div className="demarrage-bas">
            <button type="button" className="btn primaire plein" disabled={n < 2} onClick={() => aller('proposition')}>
              Continuer
            </button>
          </div>
        </>
      )}

      {(etat.etape === 'proposition' || etat.etape === 'autres' || etat.etape === 'mien') && (
        <div className="demarrage-corps">
          <button
            type="button"
            className="btn primaire plein"
            onClick={() =>
              void (async () => {
                const t = PROGRAMMES_TYPES.find((x) => x.id === recommande(n, etat.niveau))!
                const aJour = t.seances.filter((m) => m.jour)
                const jours = ordreDesJours(joursRepartis(etat.jours, aJour.length, aJour.map((m) => m.jour!)), jourSemaine()).map((x) => x.jour)
                await setReglage(CLE_DEMARRAGE, { ...etat, quitte: true, installeLe: dateISO() })
                await installerProgramme(t, catalogue, jours)
                onInstalle()
              })()
            }
          >
            Prendre ce programme
          </button>
          <button type="button" className="btn plein" onClick={onCreer}>
            Créer le mien
          </button>
        </div>
      )}
    </div>
  )
}
