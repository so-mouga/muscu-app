import { useState } from 'react'
import { chrono, kg } from '../lib/calc'
import { useRetour } from '../lib/nav'
import type { Exercice, ExoPlan } from '../types'
import { Interrupteur } from './ChoixExo'

const RPES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]
const REPOS = [60, 90, 120, 150, 180, 240]

/** Chauffe auto : ~50 % × 8, ~70 % × 4, ~85 % × 2, arrondie au pas. */
export function chauffeAuto(charge: number, pas: number): string[] {
  const arr = (x: number) => Math.round(x / pas) * pas
  return [
    [0.5, 8],
    [0.7, 4],
    [0.85, 2],
  ].map(([pct, reps]) => `${kg(arr(charge * pct))}×${reps}`)
}

function MiniStepper({ valeur, min = 0, max = 99, onChange }: { valeur: number; min?: number; max?: number; onChange: (v: number) => void }) {
  return (
    <span className="mini-stepper">
      <button type="button" onClick={() => onChange(Math.max(min, valeur - 1))}>
        −
      </button>
      <strong>{valeur}</strong>
      <button type="button" onClick={() => onChange(Math.min(max, valeur + 1))}>
        +
      </button>
    </span>
  )
}

interface Props {
  exo: Exercice
  plan: ExoPlan
  onValider: (p: ExoPlan) => void
  onFermer: () => void
}

export default function EditeurExoPlan({ exo, plan, onValider, onFermer }: Props) {
  useRetour(true, onFermer)
  const [p, setP] = useState<ExoPlan>(() => structuredClone(plan))
  const [chargeTxt, setChargeTxt] = useState(p.charge === null ? '' : kg(p.charge))
  const [chauffeTxt, setChauffeTxt] = useState(p.chauffes.join(', '))

  const n = p.series.length
  const repsMin = p.series[0].repsMin
  const repsMax = p.series[0].repsMax
  const maj = (f: (q: ExoPlan) => void) =>
    setP((q) => {
      const c = structuredClone(q)
      f(c)
      return c
    })

  const setNombre = (k: number) =>
    maj((q) => {
      while (q.series.length < k) q.series.push({ ...q.series[q.series.length - 1] })
      q.series.length = k
      if (q.finisseur) q.series[k - 1].rpe = 10
    })
  const setReps = (min: number, max: number) =>
    maj((q) => q.series.forEach((s) => ((s.repsMin = min), (s.repsMax = Math.max(min, max)))))

  const valider = () => {
    const charge = parseFloat(chargeTxt.replace(',', '.'))
    onValider({
      ...p,
      charge: chargeTxt.trim() === '' || isNaN(charge) ? null : charge,
      chauffes: chauffeTxt
        .split(/[,;]/)
        .map((c) => c.trim().replace(/x/gi, '×'))
        .filter(Boolean),
      note: p.note?.trim() || undefined,
    })
  }

  const libelleCharge =
    exo.mode === 'poids_corps' ? 'Lest de départ (kg, 0 = poids du corps)' : exo.mode === 'elastique' ? 'Niveau d’élastique' : exo.mode === 'par_main' ? 'Charge par main (kg)' : 'Charge de départ (kg)'

  return (
    <div className="modal-fond" onClick={onFermer}>
      <div className="modal pile" onClick={(e) => e.stopPropagation()}>
        <h2>{exo.nom}</h2>

        <div className="ligne entre">
          <span>Séries</span>
          <MiniStepper valeur={n} min={1} max={10} onChange={setNombre} />
        </div>
        <div className="ligne entre">
          <span>Reps min</span>
          <MiniStepper valeur={repsMin} min={1} onChange={(v) => setReps(v, Math.max(v, repsMax))} />
        </div>
        <div className="ligne entre">
          <span>Reps max</span>
          <MiniStepper valeur={repsMax} min={repsMin} onChange={(v) => setReps(repsMin, v)} />
        </div>

        <div>
          <div className="faible" style={{ marginBottom: 6 }}>
            RPE visé par série
          </div>
          {p.series.map((s, i) => (
            <div key={i} className="ligne" style={{ marginBottom: 6 }}>
              <span className="faible" style={{ width: 28 }}>
                S{i + 1}
              </span>
              <select
                value={s.rpe}
                disabled={p.finisseur && i === n - 1}
                onChange={(e) => maj((q) => (q.series[i].rpe = parseFloat(e.target.value)))}
              >
                {RPES.map((r) => (
                  <option key={r} value={r}>
                    RPE {kg(r)}
                    {r === 10 ? ' (échec)' : ''}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div>
          <div className="faible" style={{ marginBottom: 6 }}>
            Repos
          </div>
          <div className="chips">
            {REPOS.map((r) => (
              <button key={r} type="button" className={p.repos === r ? 'actif' : ''} onClick={() => maj((q) => (q.repos = r))}>
                {chrono(r)}
              </button>
            ))}
          </div>
        </div>

        <label className="champ">
          <span>{libelleCharge} — vide = à calibrer</span>
          <input inputMode="decimal" value={chargeTxt} placeholder="à calibrer" onChange={(e) => setChargeTxt(e.target.value)} />
        </label>

        <div className="champ">
          <span>Chauffe (cochée en séance, jamais comptée) — vide = aucune</span>
          <div className="ligne">
            <input value={chauffeTxt} placeholder="ex. 25×8, 35×4, 45×2" onChange={(e) => setChauffeTxt(e.target.value)} />
            <button
              type="button"
              className="btn"
              disabled={!(parseFloat(chargeTxt.replace(',', '.')) > 0)}
              onClick={() => setChauffeTxt(chauffeAuto(parseFloat(chargeTxt.replace(',', '.')), exo.pas).join(', '))}
            >
              Auto
            </button>
          </div>
        </div>

        <Interrupteur
          on={p.finisseur}
          onChange={(v) =>
            maj((q) => {
              q.finisseur = v
              if (v) q.series[q.series.length - 1].rpe = 10
            })
          }
          label="★ Finisseur sur la dernière série"
          aide="Échec puis 5–8 demi-reps étirées. Plutôt sur de l’isolation."
        />
        <Interrupteur on={!!p.optionnel} onChange={(v) => maj((q) => (q.optionnel = v || undefined))} label="Optionnel" />

        <label className="champ">
          <span>Note (réglage machine, consigne)</span>
          <input value={p.note ?? ''} onChange={(e) => maj((q) => (q.note = e.target.value))} />
        </label>

        <button className="btn primaire grand" onClick={valider}>
          OK
        </button>
        <button className="btn discret plein" onClick={onFermer}>
          Annuler
        </button>
      </div>
    </div>
  )
}
