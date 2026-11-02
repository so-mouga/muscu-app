import { Info, Pencil, StickyNote, X } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { consigne } from '../data/consignes'
import { useRetour } from '../lib/nav'
import type { Exercice } from '../types'
import { nomMuscle } from './ChoixExo'
import FormExo from './FormExo'
import IconeMuscle from './IconeMuscle'

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

/** Petit bouton ⓘ qui ouvre la fiche d'exécution. */
export function BoutonInfos({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="btn-infos"
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

/**
 * Fiche d'exécution par-dessus l'écran (séance, ajout d'exercices) : on la ferme et on reprend où on était.
 * Rendue dans <body> : ouverte depuis une carte d'exercice, elle doit couvrir aussi l'en-tête de la séance.
 */
export default function InfosExo({ exo, onFermer }: { exo: Exercice; onFermer: () => void }) {
  const [modifier, setModifier] = useState(false)
  useRetour(true, onFermer)
  useRetour(modifier, () => setModifier(false))
  const avecConsignes = !!consigne(exo.id)
  if (modifier) return createPortal(<FormExo fenetre initial={exo} onAnnuler={() => setModifier(false)} onEnregistre={() => setModifier(false)} />, document.body)
  return createPortal(
    <div className="modal-fond" onClick={onFermer}>
      <div className="modal pile fiche-exo" onClick={(e) => e.stopPropagation()}>
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
        {!avecConsignes && !exo.notes && (
          <div className="faible">Pas encore de consignes pour cet exercice. Tu peux ajouter une note avec « Modifier l’exercice ».</div>
        )}
        <button className="btn discret plein" onClick={() => setModifier(true)}>
          <Pencil size={16} /> Modifier l’exercice
        </button>
      </div>
    </div>,
    document.body
  )
}
