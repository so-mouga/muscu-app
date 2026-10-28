import { useState } from 'react'
import type { Catalogue } from '../catalogue'
import { MUSCLES } from '../data/exercices'
import { db, uid } from '../db'
import { useRetour } from '../lib/nav'
import type { Exercice, ModeCharge, Muscle } from '../types'

const MODES: [ModeCharge, string][] = [
  ['machine', 'Machine / barre'],
  ['par_main', 'Haltère par main'],
  ['poids_corps', 'Poids du corps (+ lest)'],
  ['elastique', 'Élastique (niveau)'],
]

const nomMuscle = (m: Muscle) => MUSCLES.find((x) => x.id === m)?.nom ?? m

interface Props {
  catalogue: Catalogue
  titre: string
  /** Muscle de l'exercice remplacé : ses équivalents passent en premier. */
  muscle?: Muscle
  exclure?: string[]
  /** `exo` est fourni quand il vient d'être créé (pas encore dans le catalogue). */
  onChoix: (exoId: string, exo?: Exercice) => void
  onFermer: () => void
}

export default function ChoixExo({ catalogue, titre, muscle, exclure = [], onChoix, onFermer }: Props) {
  const [recherche, setRecherche] = useState('')
  const [creation, setCreation] = useState(false)
  useRetour(true, () => (creation ? (setCreation(false), 'rester') : onFermer()))

  const norm = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  const tous = Object.values(catalogue.exercices)
    .filter((e) => !exclure.includes(e.id))
    .filter((e) => !recherche || norm(e.nom + ' ' + nomMuscle(e.muscle)).includes(norm(recherche)))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  const memeMuscle = muscle ? tous.filter((e) => e.muscle === muscle) : []
  const autres = tous.filter((e) => !memeMuscle.includes(e))

  const ligne = (e: Exercice) => (
    <button key={e.id} className="liste-btn" onClick={() => onChoix(e.id)}>
      <span>
        <strong>{e.nom}</strong>
        <div className="faible">
          {nomMuscle(e.muscle)} · {e.type === 'compose' ? 'composé' : 'isolation'}
          {e.perso ? ' · perso' : ''}
        </div>
      </span>
      <span className="muted">+</span>
    </button>
  )

  return (
    <div className="modal-fond" onClick={onFermer}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {creation ? (
          <CreerExo
            nomInitial={recherche}
            muscleInitial={muscle}
            onCree={onChoix}
            onAnnuler={() => setCreation(false)}
          />
        ) : (
          <div className="pile">
            <h2>{titre}</h2>
            <input placeholder="Rechercher (nom ou muscle)" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
            <button className="btn primaire plein" onClick={() => setCreation(true)}>
              + Créer un exercice{recherche ? ` « ${recherche} »` : ''}
            </button>
            {memeMuscle.length > 0 && (
              <div>
                <div className="faible" style={{ margin: '4px 0 8px' }}>
                  Même muscle ({nomMuscle(muscle!)})
                </div>
                {memeMuscle.map(ligne)}
              </div>
            )}
            <div>
              {memeMuscle.length > 0 && autres.length > 0 && (
                <div className="faible" style={{ margin: '4px 0 8px' }}>
                  Autres
                </div>
              )}
              {autres.map(ligne)}
              {tous.length === 0 && <div className="muted">Aucun exercice trouvé.</div>}
            </div>
            <button className="btn discret plein" onClick={onFermer}>
              Annuler
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function CreerExo({
  nomInitial,
  muscleInitial,
  onCree,
  onAnnuler,
}: {
  nomInitial: string
  muscleInitial?: Muscle
  onCree: (id: string, exo: Exercice) => void
  onAnnuler: () => void
}) {
  const [nom, setNom] = useState(nomInitial)
  const [muscle, setMuscle] = useState<Muscle>(muscleInitial ?? 'pecs')
  const [mode, setMode] = useState<ModeCharge>('machine')
  const [pas, setPas] = useState('2,5')
  const [compose, setCompose] = useState(false)

  const creer = async () => {
    const p = parseFloat(pas.replace(',', '.'))
    const exo: Exercice = {
      id: 'x_' + uid(),
      nom: nom.trim(),
      muscle,
      type: compose ? 'compose' : 'isolation',
      mode,
      pas: p > 0 ? p : mode === 'elastique' ? 1 : 2.5,
      suivreE1rm: compose,
      perso: true,
    }
    await db.exercices.add(exo)
    onCree(exo.id, exo)
  }

  return (
    <div className="pile">
      <h2>Nouvel exercice</h2>
      <label className="champ">
        <span>Nom</span>
        <input autoFocus value={nom} onChange={(e) => setNom(e.target.value)} placeholder="ex. Pec deck prise neutre" />
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
        <span>Pas de charge ({mode === 'elastique' ? 'niveau' : 'kg'})</span>
        <input inputMode="decimal" value={pas} onChange={(e) => setPas(e.target.value)} />
      </label>
      <Interrupteur
        on={compose}
        onChange={setCompose}
        label="Exercice composé"
        aide="Plusieurs articulations (développé, rowing, squat…). Active le suivi de l’e1RM."
      />
      <button className="btn primaire grand" disabled={!nom.trim()} onClick={creer}>
        Créer et ajouter
      </button>
      <button className="btn discret plein" onClick={onAnnuler}>
        Retour
      </button>
    </div>
  )
}

export function Interrupteur({ on, onChange, label, aide }: { on: boolean; onChange: (v: boolean) => void; label: string; aide?: string }) {
  return (
    <button type="button" className={'interrupteur' + (on ? ' on' : '')} onClick={() => onChange(!on)}>
      <span>
        {label}
        {aide && <div className="faible">{aide}</div>}
      </span>
      <span className="piste" />
    </button>
  )
}
