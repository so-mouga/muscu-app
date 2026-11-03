import { Camera, Images, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { modifierExercice } from '../db'
import { kg } from '../lib/calc'
import { photoReduite } from '../lib/image'
import { useRetour } from '../lib/nav'
import type { Exercice } from '../types'
import { informer } from './Dialogues'

/** Paliers courants ; les autres (machines en livres…) se tapent dans « Autre ». */
const PALIERS = [1, 1.25, 2, 2.5, 5, 10]

const nombre = (t: string) => {
  const v = parseFloat(t.replace(',', '.'))
  return v > 0 ? v : undefined
}
const texte = (v?: number) => (v === undefined ? '' : kg(v))

/**
 * Ce qu'on ne découvre que devant la machine : palier, charge maximale, note et photo. Enregistré au
 * fil de l'eau. Le reste de l'exercice (nom, muscle, mode) se modifie depuis la fiche, dans Progrès.
 */
export function ContenuReglages({ exo }: { exo: Exercice }) {
  const [pas, setPas] = useState(exo.pas)
  const [autreOuvert, setAutreOuvert] = useState(!PALIERS.includes(exo.pas))
  const [autre, setAutre] = useState(PALIERS.includes(exo.pas) ? '' : kg(exo.pas))
  const [max, setMax] = useState(texte(exo.chargeMax))
  const [note, setNote] = useState(exo.notes ?? '')
  const [image, setImage] = useState(exo.image)
  const [chargement, setChargement] = useState(false)

  // Texte en cours de saisie : pris en compte à la fin (champ quitté ou fenêtre fermée).
  const saisie = useRef({ max, note, autre, pas: exo.pas, chargeMax: exo.chargeMax, notes: exo.notes ?? '' })
  saisie.current.max = max
  saisie.current.note = note
  saisie.current.autre = autre
  const garderTextes = () => {
    const s = saisie.current
    const palier = nombre(s.autre)
    if (palier && palier !== s.pas) {
      s.pas = palier
      void modifierExercice(exo.id, { pas: palier })
    }
    const chargeMax = nombre(s.max)
    if (chargeMax !== s.chargeMax || s.note !== s.notes) {
      s.chargeMax = chargeMax
      s.notes = s.note
      void modifierExercice(exo.id, { chargeMax, notes: s.note.trim() || undefined })
    }
  }
  const garder = useRef(garderTextes)
  garder.current = garderTextes
  useEffect(() => () => garder.current(), [])

  const choisirPalier = (v: number) => {
    setPas(v)
    saisie.current.pas = v
    void modifierExercice(exo.id, { pas: v })
  }
  const choisirPhoto = async (f?: File) => {
    if (!f) return
    setChargement(true)
    try {
      const i = await photoReduite(f)
      setImage(i)
      await modifierExercice(exo.id, { image: i })
    } catch {
      void informer('Choisis une photo au format JPEG ou PNG.', 'Impossible de lire cette image')
    } finally {
      setChargement(false)
    }
  }
  const retirerPhoto = () => {
    setImage(undefined)
    void modifierExercice(exo.id, { image: undefined })
  }

  return (
    <>
      {exo.mode !== 'elastique' && (
        <div className="reglage-machine">
          <div className="petit">{exo.mode === 'poids_corps' ? 'Palier du lest' : 'Palier'}</div>
          <div className="faible petit">L’écart entre deux charges : boutons − et + et montée de charge.</div>
          <div className="chips">
            {PALIERS.map((v) => (
              <button key={v} type="button" className={!autreOuvert && pas === v ? 'actif' : ''} onClick={() => (setAutreOuvert(false), setAutre(''), choisirPalier(v))}>
                {kg(v)} kg
              </button>
            ))}
            <button type="button" className={autreOuvert ? 'actif' : ''} onClick={() => setAutreOuvert(true)}>
              Autre
            </button>
          </div>
          {autreOuvert && (
            <input
              inputMode="decimal"
              autoFocus={!autre}
              placeholder="Palier en kg"
              aria-label="Autre palier, en kg"
              value={autre}
              onChange={(e) => setAutre(e.target.value)}
              onBlur={garderTextes}
            />
          )}
        </div>
      )}
      {(exo.mode === 'machine' || exo.mode === 'par_main') && !exo.assistance && (
        <label className="reglage-machine">
          <span className="petit">Charge maximale, facultatif</span>
          <span className="faible petit">Le haut de la pile, ou tes haltères les plus lourds. L’appli ne propose pas de monter au-delà.</span>
          <input inputMode="decimal" placeholder="Pas de limite" value={max} onChange={(e) => setMax(e.target.value)} onBlur={garderTextes} />
        </label>
      )}
      <label className="reglage-machine">
        <span className="petit">Note</span>
        <textarea rows={2} placeholder="Réglage du siège, prise…" value={note} onChange={(e) => setNote(e.target.value)} onBlur={garderTextes} />
      </label>
      <div className="reglage-machine">
        <span className="petit">Photo</span>
        {image && (
          <div className="reglage-photo">
            <img src={image} alt={exo.nom} />
            <button type="button" className="btn discret petit" onClick={retirerPhoto}>
              Retirer
            </button>
          </div>
        )}
        {/* Android peut fermer l'appli pendant la prise de vue : ce qui est saisi part dans la base avant. */}
        <div className="reglage-photo-boutons">
          <label className="btn" onClick={garderTextes}>
            <Camera size={18} /> {chargement ? 'Chargement…' : image ? 'Reprendre' : 'Prendre une photo'}
            <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => void choisirPhoto(e.target.files?.[0])} />
          </label>
          <label className="btn" onClick={garderTextes}>
            <Images size={18} /> Galerie
            <input type="file" accept="image/*" hidden onChange={(e) => void choisirPhoto(e.target.files?.[0])} />
          </label>
        </div>
      </div>
    </>
  )
}

export const titreReglages = (exo: Exercice) => (exo.mode === 'machine' ? 'Réglages de la machine' : 'Réglages de l’exercice')

/** Fenêtre ouverte depuis le crayon sous la charge. */
export default function ReglagesMachine({ exo, onFermer }: { exo: Exercice; onFermer: () => void }) {
  useRetour(true, onFermer)
  return createPortal(
    <div className="modal-fond" onClick={onFermer}>
      <div className="modal pile" onClick={(e) => e.stopPropagation()}>
        <div className="ligne entre">
          <div style={{ minWidth: 0 }}>
            <h2>{titreReglages(exo)}</h2>
            <div className="faible">{exo.nom}</div>
          </div>
          <button className="btn-fermer" aria-label="Fermer" onClick={onFermer}>
            <X size={22} />
          </button>
        </div>
        <ContenuReglages exo={exo} />
      </div>
    </div>,
    document.body
  )
}
