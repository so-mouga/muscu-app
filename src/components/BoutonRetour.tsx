import { ArrowLeft } from 'lucide-react'

/** Le retour en haut d'une page : partout la même taille et la même flèche. */
export default function BoutonRetour({ onClick, label = 'Retour' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="btn btn-retour" onClick={onClick} aria-label={label}>
      <ArrowLeft size={20} strokeWidth={2} />
    </button>
  )
}
