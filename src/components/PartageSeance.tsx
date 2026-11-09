import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import type { Catalogue } from '../catalogue'
import { db, exoAvecReglages } from '../db'
import { useRetour } from '../lib/nav'
import { partagerTexte } from '../lib/partage'
import { texteSeance } from '../lib/partageSeance'
import type { Reglage, Seance } from '../types'
import { informer } from './Dialogues'
import { useMouvements } from './Echauffement'
import Interrupteur from './Interrupteur'

const annule = (e: unknown) => (e as Error).name === 'AbortError'

/** Partager une séance faite en texte, pour un coach ou une IA : jamais le poids, les mesures ni les photos. */
export default function PartageSeance({ seance, avant, reglages, catalogue, onFermer }: { seance: Seance; avant: Seance[]; reglages: Reglage[]; catalogue: Catalogue; onFermer: () => void }) {
  const [avecAvant, setAvecAvant] = useState(true)
  const mouvements = useMouvements()
  const cycle = useLiveQuery(async () => (seance.cycleId ? await db.cycles.get(seance.cycleId) : undefined), [seance.cycleId])
  useRetour(true, onFermer)
  const texte = texteSeance(seance, { exo: (id) => exoAvecReglages(catalogue.exo(id), reglages), avant, objectifs: catalogue.objectifs, cycle, mouvements }, avecAvant)

  const envoyer = async () => {
    try {
      const fait = await partagerTexte(`Séance ${seance.nom}`, texte)
      onFermer()
      if (fait === 'copie') void informer('La séance est copiée : colle-la où tu veux.', 'Copié')
    } catch (e) {
      if (!annule(e)) void informer('La séance n’a pas pu être partagée. Réessaie.', 'Séance non partagée')
    }
  }
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(texte)
      onFermer()
      void informer('La séance est copiée : colle-la où tu veux.', 'Copié')
    } catch {
      void informer('Le texte n’a pas pu être copié. Essaie « Partager ».', 'Pas copié')
    }
  }

  return (
    <div className="modal-fond" onClick={onFermer}>
      <div className="modal modal-colonne" onClick={(e) => e.stopPropagation()}>
        <div className="modal-tete">
          <h2>Partager cette séance</h2>
          <p className="faible partage-intro">Un texte à envoyer à un coach ou à une IA. Ni ton poids, ni tes mesures, ni tes photos.</p>
          <Interrupteur on={avecAvant} onChange={setAvecAvant} label="Avec la séance d’avant" aide="Ce que tu avais fait la dernière fois, sous chaque exercice." />
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
