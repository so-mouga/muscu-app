import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { INTENSITES, kcalActivite, TYPES_ACTIVITE } from '../data/activites'
import { db, uid } from '../db'
import { dateCourte, dateISO } from '../lib/calc'
import { useRetour } from '../lib/nav'
import type { Activite } from '../types'

const DUREES = [30, 45, 60, 90, 120]

/** Ajout ou modification d'une activité (padel, course…). */
export default function FormActivite({ initial, onFermer }: { initial?: Activite; onFermer: () => void }) {
  useRetour(true, onFermer)
  const [type, setType] = useState(initial?.type ?? 'padel')
  const [duree, setDuree] = useState(initial?.duree ?? 60)
  const [dureeTxt, setDureeTxt] = useState<string | null>(null)
  const [intensite, setIntensite] = useState(initial?.intensite ?? 6)
  const [date, setDate] = useState(initial?.date ?? dateISO())
  const [note, setNote] = useState(initial?.note ?? '')
  const poids = useLiveQuery(() => db.pesees.orderBy('date').last(), [])

  const enregistrer = async () => {
    await db.activites.put({ id: initial?.id ?? uid(), date, type, duree, intensite, note: note.trim() || undefined })
    onFermer()
  }
  const supprimer = async () => {
    if (!initial || !confirm(`Supprimer l’activité du ${dateCourte(initial.date)} ?`)) return
    await db.activites.delete(initial.id)
    onFermer()
  }

  return (
    <div className="modal-fond" onClick={onFermer}>
      <div className="modal pile" onClick={(e) => e.stopPropagation()}>
        <h2>{initial ? 'Modifier l’activité' : 'Autre activité'}</h2>
        <div className="chips">
          {TYPES_ACTIVITE.map((t) => (
            <button key={t.id} className={type === t.id ? 'actif' : ''} onClick={() => setType(t.id)}>
              {t.emoji} {t.nom}
            </button>
          ))}
        </div>

        <div>
          <div className="faible" style={{ marginBottom: 6 }}>
            Durée
          </div>
          <div className="ligne wrap" style={{ gap: 6 }}>
            <div className="chips">
              {DUREES.map((d) => (
                <button key={d} className={duree === d && dureeTxt === null ? 'actif' : ''} onClick={() => (setDuree(d), setDureeTxt(null))}>
                  {d < 60 ? `${d} min` : `${Math.floor(d / 60)} h${d % 60 ? ` ${d % 60}` : ''}`}
                </button>
              ))}
            </div>
            <span className="ligne" style={{ gap: 4 }}>
              <input
                inputMode="numeric"
                style={{ width: 70 }}
                placeholder="autre"
                value={dureeTxt ?? ''}
                onChange={(e) => {
                  setDureeTxt(e.target.value)
                  const v = parseInt(e.target.value)
                  if (v > 0) setDuree(v)
                }}
              />
              <span className="faible">min</span>
            </span>
          </div>
        </div>

        <div>
          <div className="faible" style={{ marginBottom: 6 }}>
            Intensité ressentie : <strong style={{ color: 'var(--texte)' }}>{intensite}/10</strong> · {INTENSITES[intensite]}
          </div>
          <div className="rpe" style={{ gridTemplateColumns: 'repeat(10, 1fr)' }}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button key={n} className={intensite === n ? 'actif' : ''} onClick={() => setIntensite(n)}>
                {n}
              </button>
            ))}
          </div>
        </div>

        <label className="champ">
          <span>Date</span>
          <input type="date" value={date} max={dateISO()} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <input placeholder="Note (optionnel)" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="faible">
          🔥 ≈ {kcalActivite({ type, duree, intensite }, poids?.poids)} kcal, estimées d’après le sport, l’intensité et {poids ? 'ton poids' : 'un poids moyen'}.
        </div>

        <button className="btn primaire grand" disabled={!(duree > 0)} onClick={enregistrer}>
          ENREGISTRER
        </button>
        {initial && (
          <button className="btn discret danger plein" onClick={supprimer}>
            Supprimer
          </button>
        )}
        <button className="btn discret plein" onClick={onFermer}>
          Annuler
        </button>
      </div>
    </div>
  )
}
