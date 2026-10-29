import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRetour } from '../lib/nav'

interface Demande {
  titre?: string
  texte: string
  oui: string
  /** Absent : simple information, un seul bouton. */
  non?: string
  /** Action destructrice : bouton rouge. */
  danger?: boolean
  resoudre: (r: boolean) => void
}

let afficher: ((d: Demande) => void) | null = null

/**
 * Remplace `confirm()` : une fenêtre dans le style de l'appli, avec des boutons qui disent ce qu'ils
 * font. Résout à true pour `oui`, false pour `non`, un appui à côté ou le bouton retour.
 */
export function confirmer(texte: string, o: { titre?: string; oui?: string; non?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise((resoudre) => {
    if (!afficher) return resoudre(window.confirm(texte))
    afficher({ texte, titre: o.titre, oui: o.oui ?? 'Confirmer', non: o.non ?? 'Annuler', danger: o.danger, resoudre })
  })
}

/** Remplace `alert()`. */
export function informer(texte: string, titre?: string): Promise<void> {
  return new Promise((resoudre) => {
    if (!afficher) return (window.alert(texte), resoudre())
    afficher({ texte, titre, oui: 'OK', resoudre: () => resoudre() })
  })
}

/** À monter une fois, à la racine : affiche les demandes une par une. */
export default function Dialogues() {
  const [file, setFile] = useState<Demande[]>([])
  useEffect(() => {
    afficher = (d) => setFile((f) => [...f, d])
    return () => {
      afficher = null
    }
  }, [])
  const d = file[0]
  if (!d) return null
  return (
    <Fenetre
      key={file.length + d.texte}
      d={d}
      onFin={(r) => {
        d.resoudre(r)
        setFile((f) => f.slice(1))
      }}
    />
  )
}

function Fenetre({ d, onFin }: { d: Demande; onFin: (r: boolean) => void }) {
  useRetour(true, () => onFin(false))
  return createPortal(
    <div className="modal-fond dialogue" onClick={() => onFin(false)}>
      <div className="modal pile" role="alertdialog" aria-label={d.titre ?? d.texte} onClick={(e) => e.stopPropagation()}>
        {d.titre && <h2>{d.titre}</h2>}
        {/* Sans titre, le texte est la question : il passe au premier plan. */}
        <div className={'texte-dialogue' + (d.titre ? '' : ' seul')}>{d.texte}</div>
        <button className={'btn grand ' + (d.danger ? 'danger-plein' : 'primaire')} onClick={() => onFin(true)}>
          {d.oui}
        </button>
        {d.non && (
          <button className="btn grand" onClick={() => onFin(false)}>
            {d.non}
          </button>
        )}
      </div>
    </div>,
    document.body
  )
}
