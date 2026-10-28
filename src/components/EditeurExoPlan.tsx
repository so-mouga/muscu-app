import { useState } from 'react'
import { kg } from '../lib/calc'
import { useRetour } from '../lib/nav'
import type { Exercice, ExoPlan } from '../types'
import ChoixDuree from './ChoixDuree'
import Interrupteur from './Interrupteur'

const RPES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]

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

const lireCharge = (t: string) => {
  const v = parseFloat(t.replace(',', '.'))
  return t.trim() === '' || isNaN(v) ? undefined : v
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
  const [chargesSerie, setChargesSerie] = useState(() => plan.series.map((s) => (s.charge === undefined ? '' : kg(s.charge))))
  const [chauffeTxt, setChauffeTxt] = useState(p.chauffes.join(', '))
  const [detail, setDetail] = useState(() => plan.series.some((s) => s.charge !== undefined || s.repos !== undefined))

  const n = p.series.length
  const repsMin = p.series[0].repsMin
  const repsMax = p.series[0].repsMax
  const maj = (f: (q: ExoPlan) => void) =>
    setP((q) => {
      const c = structuredClone(q)
      f(c)
      return c
    })

  const setNombre = (k: number) => {
    maj((q) => {
      while (q.series.length < k) q.series.push({ ...q.series[q.series.length - 1] })
      q.series.length = k
      if (q.finisseur) q.series[k - 1].rpe = 10
    })
    setChargesSerie((c) => {
      const x = [...c]
      while (x.length < k) x.push(x[x.length - 1] ?? '')
      return x.slice(0, k)
    })
  }
  const setReps = (min: number, max: number) =>
    maj((q) => q.series.forEach((s) => ((s.repsMin = min), (s.repsMax = Math.max(min, max)))))

  const valider = () => {
    const chargeGenerale = lireCharge(chargeTxt)
    onValider({
      ...p,
      charge: chargeGenerale ?? null,
      series: p.series.map((s, i) => {
        const { charge: _c, repos: _r, ...base } = s
        if (!detail) return base
        const charge = lireCharge(chargesSerie[i] ?? '')
        return {
          ...base,
          ...(charge !== undefined && charge !== chargeGenerale ? { charge } : {}),
          ...(s.repos !== undefined && s.repos !== p.repos ? { repos: s.repos } : {}),
        }
      }),
      chauffes: chauffeTxt
        .split(/[,;]/)
        .map((c) => c.trim().replace(/x/gi, '×'))
        .filter(Boolean),
      note: p.note?.trim() || undefined,
    })
  }

  const unite = exo.mode === 'poids_corps' ? 'lest kg' : exo.mode === 'elastique' ? 'niveau' : exo.mode === 'par_main' ? 'kg/main' : 'kg'
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

        <div className="ligne entre">
          <span>Repos entre les séries</span>
          <ChoixDuree valeur={p.repos} onChange={(v) => maj((q) => (q.repos = v))} />
        </div>

        <label className="champ">
          <span>{libelleCharge} — vide = à calibrer</span>
          <input inputMode="decimal" value={chargeTxt} placeholder="à calibrer" onChange={(e) => setChargeTxt(e.target.value)} />
        </label>

        <div>
          <Interrupteur
            on={detail}
            onChange={setDetail}
            label="Régler série par série"
            aide="Charge et repos différents selon la série (ex. 1re série plus légère)."
          />
          <div className="faible" style={{ margin: '6px 0' }}>
            {detail ? `Série · RPE · charge (${unite}) · repos après` : 'RPE visé par série'}
          </div>
          {p.series.map((s, i) => (
            <div key={i} className="ligne" style={{ marginBottom: 6, gap: 6 }}>
              <span className="faible" style={{ width: 22, flex: '0 0 auto' }}>
                S{i + 1}
              </span>
              <select
                value={s.rpe}
                style={detail ? { width: 74, padding: '8px 4px', flex: '0 0 auto' } : undefined}
                disabled={p.finisseur && i === n - 1}
                onChange={(e) => maj((q) => (q.series[i].rpe = parseFloat(e.target.value)))}
              >
                {RPES.map((r) => (
                  <option key={r} value={r}>
                    {detail ? kg(r) : `RPE ${kg(r)}${r === 10 ? ' (échec)' : ''}`}
                  </option>
                ))}
              </select>
              {detail && (
                <>
                  <input
                    inputMode="decimal"
                    style={{ width: 62, padding: '8px 4px', textAlign: 'center', flex: '0 0 auto' }}
                    placeholder={chargeTxt || '—'}
                    value={chargesSerie[i] ?? ''}
                    onChange={(e) => setChargesSerie((c) => c.map((x, k) => (k === i ? e.target.value : x)))}
                  />
                  <ChoixDuree compact valeur={s.repos ?? p.repos} onChange={(v) => maj((q) => (q.series[i].repos = v))} />
                </>
              )}
            </div>
          ))}
        </div>

        <div>
          <Interrupteur
            on={p.reposApres !== undefined}
            onChange={(v) => maj((q) => (q.reposApres = v ? q.repos : undefined))}
            label="Repos spécifique avant l’exercice suivant"
            aide="Lancé après la dernière série (changer de machine, souffler)."
          />
          {p.reposApres !== undefined && (
            <div className="ligne entre" style={{ marginTop: 6 }}>
              <span className="petit">Repos après l’exercice</span>
              <ChoixDuree valeur={p.reposApres} onChange={(v) => maj((q) => (q.reposApres = v))} />
            </div>
          )}
        </div>

        <div className="champ">
          <span>Chauffe (cochée en séance, jamais comptée) — vide = aucune</span>
          <div className="ligne">
            <input value={chauffeTxt} placeholder="ex. 25×8, 35×4, 45×2" onChange={(e) => setChauffeTxt(e.target.value)} />
            <button
              type="button"
              className="btn"
              disabled={!(lireCharge(chargeTxt)! > 0)}
              onClick={() => setChauffeTxt(chauffeAuto(lireCharge(chargeTxt)!, exo.pas).join(', '))}
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
          <span>Note (consigne pour cette séance)</span>
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
