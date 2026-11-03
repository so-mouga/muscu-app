import { ArrowLeft, X } from 'lucide-react'
import { useState } from 'react'
import { changerObjectifs, installerProgramme, lancerCycle, type Catalogue } from '../catalogue'
import { PROGRAMMES_TYPES, type ProgrammeType } from '../data/programmesTypes'
import { dateISO, dureeEstimee, jourSemaine, minutes } from '../lib/calc'
import { debutCycle } from '../lib/cycle'
import { CLE_DEMARRAGE, joursRepartis, NOMS_JOURS, ordreDesJours, pourquoi, quand, recommande, seSuivent, type EtatDemarrage, type Etape, type Niveau, type Objectif } from '../lib/demarrage'
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
  const idPropose = recommande(n, etat.niveau)
  const prendre = async (t: ProgrammeType, jours: number[]) => {
    await setReglage(CLE_DEMARRAGE, { ...etat, quitte: true, installeLe: dateISO() })
    const p = await installerProgramme(t, catalogue, jours)
    await lancerCycle(catalogue, p, { debut: debutCycle(jours) })
    onInstalle()
  }
  const creer = (
    <button
      type="button"
      className="demarrage-option"
      onClick={() =>
        void (async () => {
          await setReglage(CLE_DEMARRAGE, { ...etat, quitte: true })
          onCreer()
        })()
      }
    >
      <strong>Créer le mien</strong>
      <span>Tes séances, tes exercices, tes jours</span>
    </button>
  )
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

      {etat.etape === 'proposition' && (
        <Proposition etat={etat} idPropose={idPropose} onPrendre={prendre} onAutres={() => aller('autres')} />
      )}

      {(etat.etape === 'autres' || etat.etape === 'mien') && (
        <div className="demarrage-corps">
          <h1>{etat.etape === 'mien' ? 'Ton programme' : 'Les autres programmes'}</h1>
          <div className="demarrage-choix">
            {etat.etape === 'mien' && creer}
            {PROGRAMMES_TYPES.filter((t) => etat.etape === 'mien' || t.id !== idPropose).map((t) => (
              <button key={t.id} type="button" className="demarrage-option" onClick={() => aller('proposition', { choisi: t.id })}>
                <strong>{t.nom}</strong>
                <span>{t.description}</span>
              </button>
            ))}
            {etat.etape === 'autres' && creer}
          </div>
        </div>
      )}
    </div>
  )
}

/** Le programme proposé, ou choisi dans la liste : une proposition que la personne peut refuser. */
function Proposition({ etat, idPropose, onPrendre, onAutres }: { etat: EtatDemarrage; idPropose: string; onPrendre: (t: ProgrammeType, jours: number[]) => Promise<void>; onAutres: () => void }) {
  const [occupe, setOccupe] = useState(false)
  const t = PROGRAMMES_TYPES.find((x) => x.id === (etat.choisi ?? idPropose))!
  const aJour = t.seances.filter((m) => m.jour).sort((a, b) => a.jour! - b.jour!)
  const ordre = ordreDesJours(joursRepartis(etat.jours, aJour.length, aJour.map((m) => m.jour!)), jourSemaine())
  const ajoutes = etat.jours.length ? ordre.filter((x) => !etat.jours.includes(x.jour)).map((x) => NOMS_JOURS[x.jour]) : []
  const moyenne = Math.round(aJour.reduce((a, m) => a + dureeEstimee(m), 0) / aJour.length / 5) * 5
  return (
    <>
      <div className="demarrage-corps">
        <div className="demarrage-titre">
          <span>{etat.choisi ? 'Ton choix' : 'On te propose'}</span>
          <h1>{t.nom}</h1>
        </div>
        <p>{etat.choisi ? t.description : pourquoi(t.id, etat.jours.length)}</p>
        {ajoutes.length > 0 && (
          <p className="faible">
            Ce programme demande {aJour.length} jours : on a ajouté {ajoutes.join(' et ')}.
          </p>
        )}
        <div className="demarrage-seances">
          {ordre.map((x, i) => (
            <div key={x.jour} className="demarrage-seance">
              <span className="demarrage-jour">{NOMS_JOURS[x.jour].slice(0, 3)}</span>
              <strong>{aJour[i].nom}</strong>
              {i === 0 && <span className="demarrage-premiere">1re séance, {quand(x.dans, x.jour)}</span>}
            </div>
          ))}
        </div>
        {t.id.startsWith('full_body') && etat.jours.length === aJour.length && seSuivent(etat.jours) && <p className="faible">Ces jours se suivent : un jour de repos entre deux séances aide à récupérer.</p>}
        <p className="faible">
          Environ {minutes(moyenne)} par séance. Le premier jour, commence léger : tu notes la charge qui te convient.
        </p>
        <p>
          <strong>Sur 6 semaines</strong>, la dernière allégée pour récupérer. Tout se modifie ensuite{etat.jours.length ? '' : ', jours compris'}.
        </p>
      </div>
      <div className="demarrage-bas">
        <button
          type="button"
          className="btn primaire plein"
          disabled={occupe}
          onClick={() => {
            setOccupe(true)
            void onPrendre(t, ordre.map((x) => x.jour)).finally(() => setOccupe(false))
          }}
        >
          Prendre ce programme
        </button>
        {!etat.choisi && (
          <button type="button" className="btn plein" onClick={onAutres}>
            Voir les autres ou créer le mien
          </button>
        )}
      </div>
    </>
  )
}
