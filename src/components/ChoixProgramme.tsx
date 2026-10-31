import { useState } from 'react'
import { installerProgramme, type Catalogue } from '../catalogue'
import { PROGRAMMES_TYPES } from '../data/programmesTypes'
import { informer } from './Dialogues'

/**
 * Programmes tout prêts : sur l'accueil d'un nouvel utilisateur (« Pour commencer ») et dans
 * l'onglet Programmes. Un appui copie le programme et en fait le programme actif.
 */
export default function ChoixProgramme({ catalogue, titre, intro, onChoisi }: { catalogue: Catalogue; titre: string; intro?: string; onChoisi?: () => void }) {
  const [enCours, setEnCours] = useState<string | null>(null)
  const choisir = async (id: string) => {
    const t = PROGRAMMES_TYPES.find((x) => x.id === id)!
    setEnCours(id)
    try {
      await installerProgramme(t, catalogue)
      onChoisi?.()
      if (catalogue.cycle) void informer(`« ${t.nom} » est ajouté à tes programmes. Ton cycle en cours continue avec son programme.`, 'Programme ajouté')
    } finally {
      setEnCours(null)
    }
  }
  return (
    <div className="carte pile">
      <h2>{titre}</h2>
      {intro && <div className="faible">{intro}</div>}
      {PROGRAMMES_TYPES.map((t) => (
        <div key={t.id} className="programme-type">
          <div>
            <strong>{t.nom}</strong>
            <div className="pour">{t.pour}</div>
            <div className="faible">{t.description}</div>
          </div>
          <button className="btn primaire" disabled={enCours !== null} onClick={() => void choisir(t.id)}>
            {enCours === t.id ? '…' : 'Choisir'}
          </button>
        </div>
      ))}
    </div>
  )
}
