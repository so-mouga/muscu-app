import { ArrowLeft, ChevronRight, Info, StickyNote, X } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { consigne } from '../data/consignes'
import { useRetour } from '../lib/nav'
import { kg } from '../lib/calc'
import type { Exercice } from '../types'
import { nomMuscle } from './ChoixExo'
import IconeMuscle from './IconeMuscle'
import { ContenuReglages, titreReglages } from './ReglagesMachine'

/** Consignes d'exécution : position de départ, étapes, erreurs fréquentes. */
export function Consignes({ exo }: { exo: Exercice }) {
  const c = consigne(exo.id)
  if (!c) return null
  return (
    <>
      <div className="bloc-consigne">
        <h3>Position de départ</h3>
        <div>{c.depart}</div>
      </div>
      <ul className="consignes">
        {c.etapes.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
      <div className="bloc-consigne">
        <h3>Erreurs fréquentes</h3>
        <ul className="consignes erreurs">
          {c.erreurs.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </div>
    </>
  )
}

/** Ce que disent les réglages de l'exercice, en une ligne. */
export const resumeReglages = (exo: Exercice) =>
  exo.mode === 'elastique'
    ? 'Note et photo'
    : exo.mode === 'poids_corps' || exo.assistance
      ? `Palier ${kg(exo.pas)} kg`
      : `Palier ${kg(exo.pas)} kg · charge max : ${exo.chargeMax !== undefined ? `${kg(exo.chargeMax)} kg` : 'pas réglée'}`

/** Il y a quelque chose à lire sur cet exercice (un exercice créé peut n'avoir ni consignes, ni note, ni photo). */
export const aDesInfos = (exo: Exercice) => !!(consigne(exo.id) || exo.notes || exo.image)

/** Petit bouton ⓘ qui ouvre la fiche d'exécution ; `dansNom` : juste après le nom, dans le texte. */
export function BoutonInfos({ onClick, dansNom }: { onClick: () => void; dansNom?: boolean }) {
  return (
    <button
      type="button"
      className={`btn-infos${dansNom ? ' dans-nom' : ''}`}
      aria-label="Comment faire l’exercice"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      <Info size={22} />
    </button>
  )
}

/** Le nom et son ⓘ : collé au dernier mot, pour ne jamais se retrouver seul sur une ligne. */
export function NomInfos({ nom, onClick }: { nom: string; onClick?: () => void }) {
  if (!onClick) return <>{nom}</>
  const i = nom.lastIndexOf(' ') + 1
  return (
    <>
      {nom.slice(0, i)}
      <span className="nom-infos">
        {nom.slice(i)}
        <BoutonInfos dansNom onClick={onClick} />
      </span>
    </>
  )
}

/**
 * Fiche d'exécution par-dessus l'écran (séance, ajout d'exercices) : on la ferme et on reprend où on était.
 * Rendue dans <body> : ouverte depuis une carte d'exercice, elle doit couvrir aussi l'en-tête de la séance.
 */
export default function InfosExo({ exo, onFermer, action }: { exo: Exercice; onFermer: () => void; /** Liste d'ajout : décider sur place, après avoir lu la fiche. */ action?: { texte: string; faire: () => void } }) {
  const [reglages, setReglages] = useState(false)
  useRetour(true, onFermer)
  useRetour(reglages, () => setReglages(false))
  const avecConsignes = !!consigne(exo.id)
  const resume = resumeReglages(exo)
  return createPortal(
    <div className="modal-fond" onClick={onFermer}>
      {/* Toujours la même fenêtre : passer aux réglages change son contenu, sans la faire remonter une 2e fois. */}
      <div className="modal pile fiche-exo" onClick={(e) => e.stopPropagation()}>
        {reglages ? (
          <>
            <div className="ligne entre">
              <button className="btn-fermer" aria-label="Retour à la fiche" onClick={() => setReglages(false)}>
                <ArrowLeft size={22} />
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2>{titreReglages(exo)}</h2>
                <div className="faible">{exo.nom}</div>
              </div>
              <button className="btn-fermer" aria-label="Fermer" onClick={onFermer}>
                <X size={22} />
              </button>
            </div>
            <ContenuReglages exo={exo} />
          </>
        ) : (
          <>
            <div className="ligne" style={{ gap: 12, alignItems: 'flex-start' }}>
              <IconeMuscle muscle={exo.muscle} taille={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2>{exo.nom}</h2>
                <div className="faible">
                  {nomMuscle(exo.muscle)}
                  {exo.secondaires?.length ? ` · aussi ${exo.secondaires.map((x) => nomMuscle(x.muscle).toLowerCase()).join(', ')}` : ''}
                </div>
              </div>
              <button className="btn-fermer" aria-label="Fermer" onClick={onFermer}>
                <X size={22} />
              </button>
            </div>
            {exo.image && <img src={exo.image} alt={exo.nom} className="photo-grande" />}
            <Consignes exo={exo} />
            {exo.notes && <div className="faible"><StickyNote size={14} className="ico-texte" /> {exo.notes}</div>}
            {!avecConsignes && !exo.notes && <div className="faible">Pas encore de consignes pour cet exercice.</div>}
            <button className="fiche-reglages" onClick={() => setReglages(true)}>
              <span>{resume}</span>
              <ChevronRight size={20} />
            </button>
            {action && (
              <button className="btn primaire plein" onClick={action.faire}>
                {action.texte}
              </button>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
