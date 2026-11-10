import { useState } from 'react'
import { dateISO } from '../lib/calc'
import { dessinerBilan, type ContenuImage } from '../lib/imageBilan'
import { useRetour } from '../lib/nav'
import { partagerImage, partagerTexte } from '../lib/partage'
import { informer } from './Dialogues'

const annule = (e: unknown) => (e as Error).name === 'AbortError'

/**
 * Partager le bilan : d'abord le texte complet, pour un coach ou une IA (avec une question libre et facultative en
 * tête) ; l'image (sans poids ni corps, pour montrer sa semaine) en lien discret, dessinée seulement si on la demande
 * (choix de l'utilisateur, 10 nov. 2026 : l'image en bouton principal, avec son grand aperçu, ne servait pas son usage).
 */
export default function PartageBilan({ contenu, texte, onFermer }: { contenu: ContenuImage; texte: (question: string) => string; onFermer: () => void }) {
  // Question libre, en tête du texte : « j'ai mal au coude », « je pars ce week-end » (idée de l'IA de l'utilisateur).
  const [question, setQuestion] = useState('')
  const [dessin, setDessin] = useState(false)
  useRetour(true, onFermer)

  const envoyerTexte = async () => {
    try {
      const fait = await partagerTexte('Bilan d’entraînement', texte(question))
      onFermer()
      if (fait === 'copie') void informer('Le bilan complet est copié : colle-le où tu veux.', 'Copié')
    } catch (e) {
      if (!annule(e)) void informer('Le bilan n’a pas pu être partagé. Réessaie.', 'Bilan non partagé')
    }
  }
  const envoyerImage = async () => {
    setDessin(true)
    try {
      const blob = await dessinerBilan(contenu)
      await partagerImage(`cran-bilan-${dateISO()}.png`, blob)
      onFermer()
    } catch (e) {
      if (!annule(e)) void informer((e as Error).message || 'L’image n’a pas pu être créée.', 'Image non partagée')
    } finally {
      setDessin(false)
    }
  }

  return (
    <div className="modal-fond" onClick={onFermer}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Partager ce bilan</h2>
        <div className="partage-actions">
          <label className="partage-question">
            <span className="faible petit-texte">Ma question cette semaine (facultatif)</span>
            <textarea rows={2} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Par exemple : j’ai mal au coude, je pars ce week-end" />
          </label>
          <button type="button" className="btn primaire" onClick={() => void envoyerTexte()}>
            Partager le texte complet
          </button>
          <p className="faible partage-note">Tout le détail, pour un coach ou une IA. Il peut contenir ton poids.</p>
          <button type="button" className="partage-image" disabled={dessin} onClick={() => void envoyerImage()}>
            {dessin ? 'Image en cours…' : 'Partager une image (sans poids)'}
          </button>
        </div>
      </div>
    </div>
  )
}
