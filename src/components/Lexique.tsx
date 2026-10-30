import { useState } from 'react'
import { LEXIQUE } from '../data/lexique'
import { useRetour } from '../lib/nav'

/** Les termes de l'appli expliqués (PDC, RPE, 1RM…). */
export function ListeLexique() {
  return (
    <dl className="lexique">
      {LEXIQUE.map(([terme, sens]) => (
        <div key={terme}>
          <dt>{terme}</dt>
          <dd>{sens}</dd>
        </div>
      ))}
    </dl>
  )
}

function FenetreLexique({ onFermer }: { onFermer: () => void }) {
  useRetour(true, onFermer)
  return (
    <div className="modal-fond" onClick={onFermer}>
      <div className="modal pile" onClick={(e) => e.stopPropagation()}>
        <h2>Lexique</h2>
        <ListeLexique />
        <button className="btn discret plein" onClick={onFermer}>
          Fermer
        </button>
      </div>
    </div>
  )
}

/** Lien discret vers le lexique, là où les termes apparaissent. */
export function BoutonLexique() {
  const [ouvert, setOuvert] = useState(false)
  return (
    <>
      <button type="button" className="btn discret petit lien-action" onClick={() => setOuvert(true)}>
        ⓘ PDC, RPE… ? Lexique
      </button>
      {ouvert && <FenetreLexique onFermer={() => setOuvert(false)} />}
    </>
  )
}
