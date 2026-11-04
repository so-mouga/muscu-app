import { useEffect, useState } from 'react'
import { dateISO } from '../lib/calc'
import { dessinerBilan, type ContenuImage } from '../lib/imageBilan'
import { useRetour } from '../lib/nav'
import { partagerImage, partagerTexte } from '../lib/partage'
import { informer } from './Dialogues'

const annule = (e: unknown) => (e as Error).name === 'AbortError'

/** Partager le bilan : une image à montrer (sans poids ni corps), ou le texte complet pour un coach ou une IA. */
export default function PartageBilan({ contenu, texte, onFermer }: { contenu: ContenuImage; texte: () => string; onFermer: () => void }) {
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null)
  const [imageRatee, setImageRatee] = useState(false)
  useRetour(true, onFermer)

  useEffect(() => {
    let vivant = true
    let url: string | undefined
    dessinerBilan(contenu)
      .then((blob) => {
        if (!vivant) return
        url = URL.createObjectURL(blob)
        setImage({ blob, url })
      })
      .catch(() => vivant && setImageRatee(true))
    return () => {
      vivant = false
      if (url) URL.revokeObjectURL(url)
    }
    // Le contenu ne change pas tant que la fenêtre est ouverte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const envoyerImage = async () => {
    if (!image) return
    try {
      await partagerImage(`cran-bilan-${dateISO()}.png`, image.blob)
      onFermer()
    } catch (e) {
      if (!annule(e)) void informer((e as Error).message, 'Image non partagée')
    }
  }
  const envoyerTexte = async () => {
    try {
      const fait = await partagerTexte('Bilan d’entraînement', texte())
      onFermer()
      if (fait === 'copie') void informer('Le bilan complet est copié : colle-le où tu veux.', 'Copié')
    } catch (e) {
      if (!annule(e)) void informer('Le bilan n’a pas pu être partagé. Réessaie.', 'Bilan non partagé')
    }
  }

  return (
    <div className="modal-fond" onClick={onFermer}>
      <div className="modal modal-colonne" onClick={(e) => e.stopPropagation()}>
        <h2>Partager ce bilan</h2>
        <div className="modal-defile">
          {image && <img className="partage-apercu" src={image.url} alt="Aperçu de l’image à partager" />}
          {imageRatee && <p className="faible petit-texte">L’image n’a pas pu être créée. Le texte complet reste disponible.</p>}
        </div>
        <div className="partage-actions">
          <button type="button" className="btn primaire" disabled={!image} onClick={() => void envoyerImage()}>
            Partager l’image
          </button>
          <button type="button" className="btn" onClick={() => void envoyerTexte()}>
            Partager le texte complet
          </button>
          <p className="faible partage-note">Tout le détail, pour un coach ou une IA. Il peut contenir ton poids.</p>
        </div>
      </div>
    </div>
  )
}
