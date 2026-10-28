import { useState } from 'react'
import { kg } from '../lib/calc'
import { useRetour } from '../lib/nav'
import type { Suggestion } from '../lib/progression'
import type { Exercice, Objectif } from '../types'

interface Props {
  exo: Exercice
  /** Proposition automatique, point de départ de l'ajustement. */
  auto: Suggestion
  actuel?: Objectif
  onValider: (o: Objectif) => void
  onAuto: () => void
  onFermer: () => void
}

const arr = (x: number) => Math.round(x * 100) / 100

/** Ajuster à la main la charge et les reps de chaque série pour la prochaine séance. */
export default function EditeurObjectif({ exo, auto, actuel, onValider, onAuto, onFermer }: Props) {
  useRetour(true, onFermer)
  const [charges, setCharges] = useState<(number | null)[]>(actuel?.charges ?? auto.charges)
  const [reps, setReps] = useState<number[]>(actuel?.reps ?? auto.reps)
  const [textes, setTextes] = useState<(string | null)[]>(() => charges.map(() => null))

  const unite = exo.mode === 'elastique' ? 'niv.' : exo.mode === 'poids_corps' ? 'lest' : 'kg'
  const decaler = (dc: number, dr: number) => {
    if (dc) setCharges((c) => c.map((x) => arr(Math.max(0, (x ?? 0) + dc))))
    if (dr) setReps((r) => r.map((x) => Math.max(1, x + dr)))
    setTextes((t) => t.map(() => null))
  }

  return (
    <div className="modal-fond" onClick={onFermer}>
      <div className="modal pile" onClick={(e) => e.stopPropagation()}>
        <div>
          <h2>{exo.nom}</h2>
          <div className="faible">Objectif pour la prochaine séance</div>
        </div>
        <div className="suggestion petit">
          <div className="faible">Proposition automatique</div>
          <div>{auto.message}</div>
        </div>

        <div className="ligne entre wrap" style={{ gap: 6 }}>
          <span className="petit">Toutes les séries</span>
          <span className="ligne" style={{ gap: 6 }}>
            <button className="btn petit" onClick={() => decaler(-exo.pas, 0)}>
              −{kg(exo.pas)} {unite}
            </button>
            <button className="btn petit" onClick={() => decaler(exo.pas, 0)}>
              +{kg(exo.pas)} {unite}
            </button>
            <button className="btn petit" onClick={() => decaler(0, -1)}>
              −1 rep
            </button>
            <button className="btn petit" onClick={() => decaler(0, 1)}>
              +1 rep
            </button>
          </span>
        </div>

        <div>
          <div className="faible" style={{ marginBottom: 6 }}>
            Série · charge ({unite}) · reps
          </div>
          {charges.map((c, i) => (
            <div key={i} className="ligne" style={{ marginBottom: 6, gap: 6 }}>
              <span className="faible" style={{ width: 24 }}>
                S{i + 1}
              </span>
              <span className="mini-stepper compact">
                <button type="button" onClick={() => (setCharges((x) => x.map((v, k) => (k === i ? arr(Math.max(0, (v ?? 0) - exo.pas)) : v))), setTextes((t) => t.map((v, k) => (k === i ? null : v))))}>
                  −
                </button>
                <input
                  className="duree"
                  inputMode="decimal"
                  placeholder="—"
                  value={textes[i] ?? (c === null ? '' : kg(c))}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const t = e.target.value
                    setTextes((x) => x.map((v, k) => (k === i ? t : v)))
                    const v = parseFloat(t.replace(',', '.'))
                    setCharges((x) => x.map((w, k) => (k === i ? (t.trim() === '' ? null : isNaN(v) ? w : v) : w)))
                  }}
                />
                <button type="button" onClick={() => (setCharges((x) => x.map((v, k) => (k === i ? arr((v ?? 0) + exo.pas) : v))), setTextes((t) => t.map((v, k) => (k === i ? null : v))))}>
                  +
                </button>
              </span>
              <span className="mini-stepper compact">
                <button type="button" onClick={() => setReps((x) => x.map((v, k) => (k === i ? Math.max(1, v - 1) : v)))}>
                  −
                </button>
                <strong>{reps[i]}</strong>
                <button type="button" onClick={() => setReps((x) => x.map((v, k) => (k === i ? v + 1 : v)))}>
                  +
                </button>
              </span>
            </div>
          ))}
        </div>

        <button className="btn primaire grand" onClick={() => onValider({ charges, reps })}>
          FIXER CET OBJECTIF
        </button>
        {actuel && (
          <button className="btn plein" onClick={onAuto}>
            Revenir à la proposition automatique
          </button>
        )}
        <button className="btn discret plein" onClick={onFermer}>
          Annuler
        </button>
      </div>
    </div>
  )
}
