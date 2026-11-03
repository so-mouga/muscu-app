import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, HelpCircle } from 'lucide-react'
import { useRetour } from '../lib/nav'

/** L'explication, dans une fenêtre du bas : elle ne peut pas sortir de l'écran, et le retour Android la ferme. */
function FenetreAide({ titre, texte, onFermer }: { titre?: string; texte: ReactNode; onFermer: () => void }) {
  useRetour(true, onFermer)
  return createPortal(
    <div
      className="modal-fond"
      onClick={(e) => {
        e.stopPropagation()
        onFermer()
      }}
    >
      <div className="modal pile" onClick={(e) => e.stopPropagation()}>
        {titre && <h2>{titre}</h2>}
        <div>{texte}</div>
        <button type="button" className="btn plein" onClick={onFermer}>
          Compris
        </button>
      </div>
    </div>,
    document.body
  )
}

/** Petit ⓘ à côté d'un mot : une zone d'appui bien plus grande que l'icône. */
export function Aide({ texte, titre }: { texte: ReactNode; titre?: string }) {
  const [ouvert, setOuvert] = useState(false)
  return (
    <>
      <button
        type="button"
        className="aide-bouton"
        aria-label={titre ? `Aide sur ${titre}` : 'Explication'}
        onClick={(e) => {
          e.stopPropagation()
          setOuvert(true)
        }}
      >
        <HelpCircle size={14} strokeWidth={2} />
      </button>
      {ouvert && <FenetreAide titre={titre} texte={texte} onFermer={() => setOuvert(false)} />}
    </>
  )
}

/** Une question sur toute sa largeur : tout le texte est cliquable. */
export function LigneAide({ libelle, texte, titre }: { libelle: string; texte: ReactNode; titre?: string }) {
  const [ouvert, setOuvert] = useState(false)
  return (
    <>
      <button type="button" className="ligne-aide" onClick={() => setOuvert(true)}>
        <span>{libelle}</span>
        <ChevronRight size={18} className="muted" />
      </button>
      {ouvert && <FenetreAide titre={titre} texte={texte} onFermer={() => setOuvert(false)} />}
    </>
  )
}

export default Aide
