import { Camera, Images } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { modifierExercice } from '../db'
import { useRetour } from '../lib/nav'
import { PhotoZoomable } from '../screens/Photos'
import type { Exercice } from '../types'
import BoutonRetour from './BoutonRetour'
import { confirmer } from './Dialogues'
import IconeMuscle from './IconeMuscle'
import { changerPhoto } from './ReglagesMachine'

/** Appareil photo et galerie : Android choisit l'appli, et la photo est enregistrée dès qu'elle est choisie. */
function BoutonsPhoto({ exo, appareil, onFait }: { exo: Exercice; appareil: string; onFait?: () => void }) {
  const [chargement, setChargement] = useState(false)
  const choisir = async (f?: File) => {
    if (!f) return
    setChargement(true)
    const i = await changerPhoto(exo.id, f)
    setChargement(false)
    if (i) onFait?.()
  }
  return (
    <>
      <label className="btn">
        <Camera size={18} /> {chargement ? 'Chargement…' : appareil}
        <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => void choisir(e.target.files?.[0])} />
      </label>
      <label className="btn">
        <Images size={18} /> Galerie
        <input type="file" accept="image/*" hidden onChange={(e) => void choisir(e.target.files?.[0])} />
      </label>
    </>
  )
}

/** Sans photo : le muscle à côté du nom, et de quoi ajouter une photo d'un appui. */
export function CasePhoto({ exo }: { exo: Exercice }) {
  const [ouvert, setOuvert] = useState(false)
  useRetour(ouvert, () => setOuvert(false))
  return (
    <>
      <button className="fiche-case" aria-label="Ajouter une photo" onClick={() => setOuvert(true)}>
        <IconeMuscle muscle={exo.muscle} taille={46} />
        <span className="fiche-case-photo">
          <Camera size={14} />
        </span>
      </button>
      {/* Hors de l'en-tête de la fiche, sinon la barre du bas passe par-dessus. */}
      {ouvert &&
        createPortal(
          <div className="modal-fond" onClick={() => setOuvert(false)}>
            <div className="modal pile" onClick={(e) => e.stopPropagation()}>
              <h3>Photo de {exo.mode === 'machine' ? 'la machine' : 'l’exercice'}</h3>
              <div className="reglage-photo-boutons">
                <BoutonsPhoto exo={exo} appareil="Prendre une photo" onFait={() => setOuvert(false)} />
              </div>
              <button className="btn discret plein" onClick={() => setOuvert(false)}>
                Fermer
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}

/** La photo en haut de la fiche ; un appui la montre en entier, avec le zoom et de quoi la changer. */
export function BandeauPhoto({ exo }: { exo: Exercice }) {
  const [plein, setPlein] = useState(false)
  useRetour(plein, () => setPlein(false))
  const retirer = async () => {
    if (!(await confirmer('Elle disparaît de cet exercice. Ton historique ne change pas.', { titre: 'Retirer cette photo ?', oui: 'Retirer la photo', danger: true }))) return
    await modifierExercice(exo.id, { image: undefined })
    setPlein(false)
  }
  return (
    <>
      <button className="fiche-bandeau" aria-label="Voir la photo en entier" onClick={() => setPlein(true)}>
        <img src={exo.image} alt={exo.nom} />
      </button>
      {plein &&
        createPortal(
          <div className="comparaison-plein">
            <div className="ligne">
              <BoutonRetour onClick={() => setPlein(false)} />
            </div>
            <div className="photo-exo-cadre">
              <PhotoZoomable key={exo.image} image={exo.image} />
            </div>
            <div className="photo-exo-actions">
              <BoutonsPhoto exo={exo} appareil="Reprendre" />
              <button className="btn" style={{ color: 'var(--danger)' }} onClick={() => void retirer()}>
                Retirer
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
