import { useState } from 'react'
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
      <div>
        <div className="faible">Position de départ</div>
        <div>{c.depart}</div>
      </div>
      <ul className="consignes">
        {c.etapes.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
      <div>
        <div className="erreurs-titre">Erreurs fréquentes</div>
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
      i
    </button>
  )
}

/** Fiche d'exécution par-dessus l'écran (séance, ajout d'exercices) : on la ferme et on reprend où on était. */
export default function InfosExo({ exo, onFermer }: { exo: Exercice; onFermer: () => void }) {
  const [modifier, setModifier] = useState(false)
  useRetour(true, onFermer)
  useRetour(modifier, () => setModifier(false))
  const avecConsignes = !!consigne(exo.id)
  if (modifier)
    return (
      <div className="modal-fond">
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <FormExo initial={exo} onAnnuler={() => setModifier(false)} onEnregistre={() => setModifier(false)} />
        </div>
      </div>
    )
  return (
    <div className="modal-fond" onClick={onFermer}>
      <div className="modal pile" onClick={(e) => e.stopPropagation()}>
        <div className="ligne" style={{ gap: 12 }}>
          <IconeMuscle muscle={exo.muscle} taille={52} />
          <div>
            <h2>{exo.nom}</h2>
            <div className="faible">
              {nomMuscle(exo.muscle)}
              {exo.secondaires?.length ? ` · aussi ${exo.secondaires.map((x) => nomMuscle(x.muscle).toLowerCase()).join(', ')}` : ''}
            </div>
          </div>
        </div>
        {exo.image && <img src={exo.image} alt={exo.nom} className="photo-grande" />}
        <Consignes exo={exo} />
        {exo.notes && <div className="faible">📝 {exo.notes}</div>}
        {!avecConsignes && !exo.notes && (
          <div className="faible">Pas encore de consignes pour cet exercice. Tu peux ajouter une note avec « Modifier l’exercice ».</div>
        )}
        <button className="btn" onClick={() => setModifier(true)}>
          ✎ Modifier l’exercice (pas de charge, réglages, photo…)
        </button>
        <button className="btn plein" onClick={onFermer}>
          Fermer
        </button>
      </div>
    </div>
  )
}
