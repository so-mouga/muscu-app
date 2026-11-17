import { Camera, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { photoReduite } from '../lib/image'
import { useRetour } from '../lib/nav'
import type { CircuitPlan } from '../types'
import Dessin from './Dessin'
import { confirmer, informer } from './Dialogues'
import { MiniStepper } from './EditeurExoPlan'

/** Réglage d'un circuit. Tout s'écrit au fil de l'eau : fermer (bouton, appui à côté, retour) garde ce qui est saisi. */
export default function EditeurCircuit({ circuit, onChange, onSupprimer, onFermer }: { circuit: CircuitPlan; onChange: (c: CircuitPlan) => void; onSupprimer: () => void; onFermer: () => void }) {
  useRetour(true, onFermer)
  const [c, setC] = useState(circuit)
  const maj = (f: (x: CircuitPlan) => void) => {
    const x = structuredClone(c)
    f(x)
    setC(x)
    // Un mouvement sans nom n'est pas gardé ; un nom effacé revient au nom d'avant.
    onChange({ ...x, nom: x.nom.trim() || circuit.nom, mouvements: x.mouvements.filter((m) => m.nom.trim()).map((m) => ({ ...m, nom: m.nom.trim(), detail: m.detail?.trim() || undefined })) })
  }
  const photo = async (k: number, fichier?: File) => {
    if (!fichier) return
    try {
      const image = await photoReduite(fichier, 480)
      maj((x) => void (x.mouvements[k].image = image))
    } catch {
      void informer('Choisis une photo au format JPEG ou PNG.', 'Impossible de lire cette image')
    }
  }
  const minute = c.type === 'minute'
  const n = c.mouvements.filter((m) => m.nom.trim()).length

  return createPortal(
    <div className="modal-fond" onClick={onFermer}>
      <div className="modal modal-colonne" onClick={(e) => e.stopPropagation()}>
        <div className="modal-tete">
          <input className="circuit-nom" aria-label="Nom du circuit" value={c.nom} onChange={(e) => maj((x) => void (x.nom = e.target.value))} />
        </div>
        <div className="modal-defile pile">
          <div className="rpe" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <button type="button" className={minute ? '' : 'actif'} aria-pressed={!minute} onClick={() => maj((x) => void (x.type = 'duree'))}>
              Sur une durée
            </button>
            <button type="button" className={minute ? 'actif' : ''} aria-pressed={minute} onClick={() => maj((x) => void (x.type = 'minute'))}>
              Minute par minute
            </button>
          </div>
          <div className="faible">
            {minute ? 'Un mouvement par minute : tu le fais, tu souffles jusqu’au bip, le téléphone annonce le suivant.' : 'Tu enchaînes les mouvements dans l’ordre, sans t’arrêter, et tu comptes tes tours.'}
          </div>
          {minute ? (
            <div className="ligne entre">
              <span>
                Combien de fois la liste
                <span className="faible prog-sous">{n ? `${n * c.tours} min en tout` : ''}</span>
              </span>
              <MiniStepper valeur={c.tours} min={1} max={20} onChange={(v) => maj((x) => void (x.tours = v))} />
            </div>
          ) : (
            <div className="ligne entre">
              <span>Durée, en minutes</span>
              <MiniStepper valeur={c.minutes} min={1} max={60} onChange={(v) => maj((x) => void (x.minutes = v))} />
            </div>
          )}

          <div className="faible">{minute ? 'Les minutes, dans l’ordre' : 'Les mouvements, dans l’ordre'}</div>
          {c.mouvements.map((m, k) => (
            <div key={k} className="circuit-edit">
              <label className="circuit-photo" aria-label={`Photo de ${m.nom || 'ce mouvement'}`}>
                {m.image ? <Dessin image={m.image} taille={52} /> : <span className="dessin vide circuit-sans-photo"><Camera size={18} /></span>}
                <input type="file" accept="image/*" hidden onChange={(e) => void photo(k, e.target.files?.[0])} />
              </label>
              <div className="circuit-champs">
                <input aria-label={`Mouvement ${k + 1}`} placeholder={minute ? `Minute ${k + 1} : ex. 12 sit-ups` : 'ex. 12 thrusters'} value={m.nom} onChange={(e) => maj((x) => void (x.mouvements[k].nom = e.target.value))} />
                <input aria-label={`Précision du mouvement ${k + 1}`} className="circuit-detail" placeholder="précision : haltères, kettlebell…" value={m.detail ?? ''} onChange={(e) => maj((x) => void (x.mouvements[k].detail = e.target.value))} />
              </div>
              <button type="button" className="icone" aria-label={`Retirer ${m.nom || 'ce mouvement'}`} onClick={() => maj((x) => void x.mouvements.splice(k, 1))}>
                <X size={20} />
              </button>
            </div>
          ))}
          <button type="button" className="btn plein" onClick={() => maj((x) => void x.mouvements.push({ nom: '' }))}>
            <Plus size={18} /> Ajouter {minute ? 'une minute' : 'un mouvement'}
          </button>
          <button
            type="button"
            className="btn discret danger plein"
            onClick={async () => {
              if (await confirmer('Les séances déjà faites ne changent pas.', { titre: `Supprimer « ${c.nom} » ?`, oui: 'Supprimer le circuit', danger: true })) onSupprimer()
            }}
          >
            Supprimer ce circuit
          </button>
        </div>
        <div className="modal-pied ligne">
          <button className="btn primaire grand" style={{ flex: 1 }} onClick={onFermer}>
            Terminer
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
