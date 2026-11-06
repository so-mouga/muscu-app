import { useState } from 'react'
import type { Catalogue } from '../catalogue'
import { dateISO } from '../lib/calc'
import { useRetour } from '../lib/nav'
import { partagerTexte } from '../lib/partage'
import { texteProgramme } from '../lib/partageProgramme'
import type { Programme, Seance } from '../types'
import { informer } from './Dialogues'
import { useMouvements } from './Echauffement'
import Interrupteur from './Interrupteur'

const annule = (e: unknown) => (e as Error).name === 'AbortError'

/** Partager un programme en texte, pour un coach ou une IA : jamais le poids, les mesures ni les photos. */
export default function PartageProgramme({ programme, catalogue, seances, onFermer }: { programme: Programme; catalogue: Catalogue; seances: Seance[]; onFermer: () => void }) {
  const [avecCharges, setAvecCharges] = useState(true)
  const mouvements = useMouvements()
  useRetour(true, onFermer)
  const texte = texteProgramme(programme, { ...catalogue, seances, mouvements, aujourdhui: dateISO() }, avecCharges)

  const envoyer = async () => {
    try {
      const fait = await partagerTexte(`Programme ${programme.nom}`, texte)
      onFermer()
      if (fait === 'copie') void informer('Le programme est copié : colle-le où tu veux.', 'Copié')
    } catch (e) {
      if (!annule(e)) void informer('Le programme n’a pas pu être partagé. Réessaie.', 'Programme non partagé')
    }
  }
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(texte)
      onFermer()
      void informer('Le programme est copié : colle-le où tu veux.', 'Copié')
    } catch {
      void informer('Le texte n’a pas pu être copié. Essaie « Partager ».', 'Pas copié')
    }
  }

  return (
    <div className="modal-fond" onClick={onFermer}>
      <div className="modal modal-colonne" onClick={(e) => e.stopPropagation()}>
        <div className="modal-tete">
          <h2>Partager ce programme</h2>
          <p className="faible partage-intro">Un texte à envoyer à un coach ou à une IA. Ni ton poids, ni tes mesures, ni tes photos.</p>
          <Interrupteur on={avecCharges} onChange={setAvecCharges} label="Avec mes dernières charges" aide="Ce que tu as fait la dernière fois, sous chaque exercice." />
        </div>
        <div className="modal-defile">
          <pre className="partage-texte">{texte}</pre>
        </div>
        <div className="modal-pied partage-duo">
          <button type="button" className="btn" onClick={() => void copier()}>
            Copier
          </button>
          <button type="button" className="btn primaire" onClick={() => void envoyer()}>
            Partager
          </button>
        </div>
      </div>
    </div>
  )
}
