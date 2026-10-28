import { useState } from 'react'
import { MUSCLES } from '../data/exercices'
import { db, uid } from '../db'
import { photoReduite } from '../lib/image'
import type { Exercice, ModeCharge, Muscle } from '../types'
import Interrupteur from './Interrupteur'

export const MODES: [ModeCharge, string][] = [
  ['machine', 'Machine / barre / poulie'],
  ['par_main', 'Haltère par main'],
  ['poids_corps', 'Poids du corps (+ lest)'],
  ['elastique', 'Élastique (niveau)'],
]

interface Props {
  /** Exercice à modifier ; absent = création. */
  initial?: Exercice
  nomInitial?: string
  muscleInitial?: Muscle
  onEnregistre: (exo: Exercice) => void
  onAnnuler: () => void
}

export default function FormExo({ initial, nomInitial = '', muscleInitial, onEnregistre, onAnnuler }: Props) {
  const [nom, setNom] = useState(initial?.nom ?? nomInitial)
  const [muscle, setMuscle] = useState<Muscle>(initial?.muscle ?? muscleInitial ?? 'pecs')
  const [secondaires, setSecondaires] = useState(initial?.secondaires ?? [])
  const [mode, setMode] = useState<ModeCharge>(initial?.mode ?? 'machine')
  const [pas, setPas] = useState(String(initial?.pas ?? 2.5).replace('.', ','))
  const [compose, setCompose] = useState(initial ? initial.type === 'compose' : false)
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [image, setImage] = useState(initial?.image)
  const [chargement, setChargement] = useState(false)

  const basculerSecondaire = (m: Muscle) =>
    setSecondaires((x) => (x.some((s) => s.muscle === m) ? x.filter((s) => s.muscle !== m) : [...x, { muscle: m, coef: 0.5 }]))

  const choisirPhoto = async (f: File | undefined) => {
    if (!f) return
    setChargement(true)
    try {
      setImage(await photoReduite(f))
    } catch {
      alert('Impossible de lire cette image.')
    } finally {
      setChargement(false)
    }
  }

  const enregistrer = async () => {
    const p = parseFloat(pas.replace(',', '.'))
    const exo: Exercice = {
      ...initial,
      id: initial?.id ?? 'x_' + uid(),
      nom: nom.trim(),
      muscle,
      secondaires: secondaires.filter((s) => s.muscle !== muscle),
      type: compose ? 'compose' : 'isolation',
      mode,
      pas: p > 0 ? p : mode === 'elastique' ? 1 : 2.5,
      suivreE1rm: compose,
      notes: notes.trim() || undefined,
      image,
      perso: initial ? initial.perso : true,
    }
    if (!exo.secondaires?.length) delete exo.secondaires
    await db.exercices.put(exo)
    // L'ancien réglage de pas (écran Progression) est remplacé par celui de la fiche.
    await db.reglages.delete(`pas:${exo.id}`)
    onEnregistre(exo)
  }

  return (
    <div className="pile">
      <h2>{initial ? 'Modifier l’exercice' : 'Nouvel exercice'}</h2>

      <div className="ligne" style={{ alignItems: 'center', gap: 12 }}>
        {image ? (
          <img src={image} alt="" style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 14 }} />
        ) : (
          <span className="vignette vide" style={{ width: 88, height: 88, borderRadius: 14, fontSize: 28 }}>
            📷
          </span>
        )}
        <div className="pile" style={{ flex: 1 }}>
          <label className="btn plein">
            {chargement ? 'Chargement…' : image ? 'Changer la photo' : 'Ajouter une photo'}
            <input type="file" accept="image/*" hidden onChange={(e) => choisirPhoto(e.target.files?.[0])} />
          </label>
          {image && (
            <button type="button" className="btn discret petit plein" onClick={() => setImage(undefined)}>
              Retirer la photo
            </button>
          )}
        </div>
      </div>

      <label className="champ">
        <span>Nom</span>
        <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="ex. Pec deck prise neutre" />
      </label>
      <label className="champ">
        <span>Muscle principal</span>
        <select value={muscle} onChange={(e) => setMuscle(e.target.value as Muscle)}>
          {MUSCLES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nom}
            </option>
          ))}
        </select>
      </label>
      <div className="champ">
        <span>Muscles secondaires (comptés pour 0,5 série dans le volume)</span>
        <div className="chips">
          {MUSCLES.filter((m) => m.id !== muscle).map((m) => (
            <button key={m.id} type="button" className={secondaires.some((s) => s.muscle === m.id) ? 'actif' : ''} onClick={() => basculerSecondaire(m.id)}>
              {m.nom}
            </button>
          ))}
        </div>
      </div>
      <label className="champ">
        <span>Mode de charge</span>
        <select
          value={mode}
          onChange={(e) => {
            const m = e.target.value as ModeCharge
            setMode(m)
            setPas(m === 'elastique' ? '1' : m === 'par_main' ? '2' : '2,5')
          }}
        >
          {MODES.map(([m, n]) => (
            <option key={m} value={m}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label className="champ">
        <span>Pas de charge ({mode === 'elastique' ? 'niveau' : 'kg'}) — boutons −/+ et montée de charge</span>
        <input inputMode="decimal" value={pas} onChange={(e) => setPas(e.target.value)} />
      </label>
      <Interrupteur
        on={compose}
        onChange={setCompose}
        label="Exercice composé"
        aide="Plusieurs articulations (développé, rowing, squat…). Active le suivi de l’e1RM."
      />
      <label className="champ">
        <span>Réglages machine / consignes</span>
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ex. siège cran 4, dossier 2" />
      </label>

      <button className="btn primaire grand" disabled={!nom.trim() || chargement} onClick={enregistrer}>
        {initial ? 'ENREGISTRER' : 'CRÉER'}
      </button>
      <button type="button" className="btn discret plein" onClick={onAnnuler}>
        Annuler
      </button>
    </div>
  )
}
