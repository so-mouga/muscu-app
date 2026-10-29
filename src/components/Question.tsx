import { useState, type ReactNode } from 'react'
import { useRetour } from '../lib/nav'

interface Demande {
  titre: string
  texte: string
  oui: string
  non: string
}

function Question({ titre, texte, oui, non, onReponse }: Demande & { onReponse: (r: boolean) => void }) {
  useRetour(true, () => onReponse(false))
  return (
    <div className="modal-fond" onClick={() => onReponse(false)}>
      <div className="modal pile" onClick={(e) => e.stopPropagation()}>
        <h2>{titre}</h2>
        <div className="faible">{texte}</div>
        <button className="btn primaire grand" onClick={() => onReponse(true)}>
          {oui}
        </button>
        <button className="btn grand" onClick={() => onReponse(false)}>
          {non}
        </button>
      </div>
    </div>
  )
}

/**
 * Question à deux réponses explicites, dans l'appli (au lieu d'un « OK / Annuler » ambigu).
 * `demander` résout à true pour `oui`, false pour `non` (ou retour).
 */
export function useQuestion(): [ReactNode, (d: Demande) => Promise<boolean>] {
  const [q, setQ] = useState<(Demande & { resoudre: (r: boolean) => void }) | null>(null)
  const demander = (d: Demande) => new Promise<boolean>((resoudre) => setQ({ ...d, resoudre }))
  const element = q && (
    <Question
      {...q}
      onReponse={(r) => {
        q.resoudre(r)
        setQ(null)
      }}
    />
  )
  return [element, demander]
}
