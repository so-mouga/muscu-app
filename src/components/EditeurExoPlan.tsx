import { useState } from 'react'
import { kg, lireChauffe } from '../lib/calc'
import { FINISSEURS, typeFinisseur, ZONES } from '../lib/finisseur'
import { useRetour } from '../lib/nav'
import type { Exercice, ExoPlan, TypeFinisseur } from '../types'
import ChoixDuree from './ChoixDuree'
import Interrupteur from './Interrupteur'

const RPES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]

const PALIERS = [
  [0.5, 8],
  [0.7, 4],
  [0.85, 2],
  [0.9, 1],
]

/** Chauffe auto : ~50 % × 8, ~70 % × 4, ~85 % × 2, arrondie au pas. */
export function chauffeAuto(charge: number, pas: number, n = 3): string[] {
  const arr = (x: number) => Math.round(x / pas) * pas
  return PALIERS.slice(0, n).map(([pct, reps]) => `${kg(arr(charge * pct))}×${reps}`)
}

/** Ligne d'échauffement éditable : charge × reps, ou consigne libre (« 1 série facile »). */
type LigneChauffe = { charge: string; reps: number } | { texte: string }
const versLigne = (c: string): LigneChauffe => {
  const l = lireChauffe(c)
  return l ? { charge: kg(l.charge), reps: l.reps } : { texte: c }
}
const depuisLigne = (l: LigneChauffe) => ('texte' in l ? l.texte.trim() : l.charge.trim() ? `${l.charge.trim()}×${l.reps}` : '')

function MiniStepper({ valeur, min = 0, max = 99, pas = 1, onChange }: { valeur: number; min?: number; max?: number; pas?: number; onChange: (v: number) => void }) {
  return (
    <span className="mini-stepper">
      <button type="button" onClick={() => onChange(Math.max(min, valeur - pas))}>
        −
      </button>
      <strong>{valeur}</strong>
      <button type="button" onClick={() => onChange(Math.min(max, valeur + pas))}>
        +
      </button>
    </span>
  )
}

/** Petit champ numérique (reps d'une série) : la valeur n'est prise qu'une fois le nombre complet. */
function NombreCourt({ valeur, onChange }: { valeur: number; onChange: (v: number) => void }) {
  const [texte, setTexte] = useState<string | null>(null)
  return (
    <input
      inputMode="numeric"
      style={{ width: 52, padding: '8px 4px', textAlign: 'center', flex: '0 0 auto' }}
      value={texte ?? String(valeur)}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        setTexte(e.target.value)
        const v = parseInt(e.target.value)
        if (v > 0) onChange(v)
      }}
      onBlur={() => setTexte(null)}
    />
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
  const [chauffes, setChauffes] = useState<LigneChauffe[]>(() => plan.chauffes.map(versLigne))
  const [aideFin, setAideFin] = useState(false)
  const [detail, setDetail] = useState(() =>
    plan.series.some((s) => s.charge !== undefined || s.repos !== undefined || s.repsMin !== plan.series[0].repsMin || s.repsMax !== plan.series[0].repsMax)
  )

  const n = p.series.length
  const temps = exo.mesure === 'temps'
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
        // Sans réglage série par série : les mêmes reps pour toutes (celles affichées en haut).
        if (!detail) return { ...base, repsMin: p.series[0].repsMin, repsMax: p.series[0].repsMax }
        const charge = lireCharge(chargesSerie[i] ?? '')
        return {
          ...base,
          ...(charge !== undefined && charge !== chargeGenerale ? { charge } : {}),
          ...(s.repos !== undefined && s.repos !== p.repos ? { repos: s.repos } : {}),
        }
      }),
      chauffes: chauffes.map(depuisLigne).filter(Boolean),
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
          <span>
            {temps ? 'Secondes min' : 'Reps min'}
            {detail && <span className="faible"> · toutes les séries</span>}
          </span>
          <MiniStepper valeur={repsMin} min={1} max={temps ? 600 : 99} pas={temps ? 5 : 1} onChange={(v) => setReps(v, Math.max(v, repsMax))} />
        </div>
        <div className="ligne entre">
          <span>
            {temps ? 'Secondes max' : 'Reps max'}
            {detail && <span className="faible"> · toutes les séries</span>}
          </span>
          <MiniStepper valeur={repsMax} min={repsMin} max={temps ? 600 : 99} pas={temps ? 5 : 1} onChange={(v) => setReps(repsMin, v)} />
        </div>

        <div className="ligne entre">
          <span>Repos entre les séries</span>
          <ChoixDuree valeur={p.repos} onChange={(v) => maj((q) => (q.repos = v))} />
        </div>

        <label className="champ">
          <span>{libelleCharge}</span>
          <input inputMode="decimal" value={chargeTxt} placeholder="je ne sais pas encore" onChange={(e) => setChargeTxt(e.target.value)} />
          <span className="faible">
            Sert seulement la toute première fois. Ensuite, l’appli repart de ce que tu as fait la dernière fois. Pas d’idée ? Laisse vide : tu
            trouveras la bonne charge pendant la séance, dès la 1re série.
          </span>
        </label>

        <div>
          <Interrupteur
            on={detail}
            onChange={setDetail}
            label="Régler série par série"
            aide="Reps, charge et repos différents selon la série (ex. 12 / 10 / 8 en montant la charge)."
          />
          <div className="faible" style={{ margin: '6px 0' }}>
            {detail ? `Par série : ${temps ? 'secondes' : 'reps'} min–max, puis RPE · charge (${unite}) · repos après` : 'RPE visé par série'}
          </div>
          {p.series.map((s, i) => (
            <div key={i} className={detail ? 'serie-plan' : undefined}>
            {detail && (
              <div className="ligne" style={{ gap: 6 }}>
                <span className="faible" style={{ width: 22, flex: '0 0 auto' }}>
                  S{i + 1}
                </span>
                <NombreCourt valeur={s.repsMin} onChange={(v) => maj((q) => ((q.series[i].repsMin = v), (q.series[i].repsMax = Math.max(v, q.series[i].repsMax))))} />
                <span className="faible">–</span>
                <NombreCourt valeur={s.repsMax} onChange={(v) => maj((q) => ((q.series[i].repsMax = v), (q.series[i].repsMin = Math.min(v, q.series[i].repsMin))))} />
                <span className="faible">{temps ? 's' : 'reps'}</span>
              </div>
            )}
            <div className="ligne" style={{ marginBottom: 6, gap: 6 }}>
              <span className="faible" style={{ width: 22, flex: '0 0 auto' }}>
                {detail ? '' : `S${i + 1}`}
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

        <div>
          <div className="ligne entre">
            <span>Séries d’échauffement</span>
            <MiniStepper
              valeur={chauffes.length}
              max={4}
              onChange={(k) =>
                setChauffes((c) => {
                  const base = lireCharge(chargeTxt)
                  if (k < c.length) return c.slice(0, k)
                  // Nouvelle ligne : palier suivant de la chauffe auto si la charge est connue.
                  const auto = base ? chauffeAuto(base, exo.pas, k).map(versLigne) : []
                  return [...c, ...Array.from({ length: k - c.length }, (_, j) => auto[c.length + j] ?? { charge: '', reps: 8 })]
                })
              }
            />
          </div>
          <div className="faible" style={{ margin: '4px 0 6px' }}>
            Séries légères avant les vraies, cochées pendant la séance. Elles ne comptent ni dans le volume ni dans la progression.
          </div>
          {chauffes.map((l, i) => (
            <div key={i} className="ligne" style={{ marginBottom: 6, gap: 6 }}>
              <span className="faible" style={{ width: 22, flex: '0 0 auto' }}>
                É{i + 1}
              </span>
              {'texte' in l ? (
                <input value={l.texte} onChange={(e) => setChauffes((c) => c.map((x, k) => (k === i ? { texte: e.target.value } : x)))} />
              ) : (
                <>
                  <input
                    inputMode="decimal"
                    style={{ width: 70, padding: '8px 4px', textAlign: 'center', flex: '0 0 auto' }}
                    placeholder={unite}
                    value={l.charge}
                    onChange={(e) => setChauffes((c) => c.map((x, k) => (k === i ? { ...l, charge: e.target.value } : x)))}
                  />
                  <span className="faible">{unite} ×</span>
                  <MiniStepper valeur={l.reps} min={1} onChange={(v) => setChauffes((c) => c.map((x, k) => (k === i ? { ...l, reps: v } : x)))} />
                </>
              )}
            </div>
          ))}
          {chauffes.length > 0 && lireCharge(chargeTxt)! > 0 && (
            <button
              type="button"
              className="btn discret petit"
              onClick={() => setChauffes(chauffeAuto(lireCharge(chargeTxt)!, exo.pas, chauffes.length).map(versLigne))}
            >
              Calculer depuis la charge de départ (50 %, 70 %, 85 %)
            </button>
          )}
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
          aide="Une technique d’intensité sur la dernière série. Plutôt sur de l’isolation, un ou deux par séance."
        />
        {p.finisseur && (
          <div className="pile" style={{ gap: 8 }}>
            <div className="chips">
              {(Object.keys(FINISSEURS) as TypeFinisseur[]).map((t) => (
                <button key={t} className={typeFinisseur(p) === t ? 'actif' : ''} onClick={() => maj((q) => (q.typeFinisseur = t))}>
                  {FINISSEURS[t].nom}
                </button>
              ))}
            </div>
            <div className="suggestion petit">{FINISSEURS[typeFinisseur(p)].aide}</div>
            {typeFinisseur(p) === 'partielles' && (
              <div className="ligne entre wrap">
                <span className="petit">Zone des demi-reps</span>
                <div className="chips">
                  {ZONES.map(([z, nom]) => (
                    <button key={z} className={(p.zone ?? 'etiree') === z ? 'actif' : ''} onClick={() => maj((q) => (q.zone = z))}>
                      {nom}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button type="button" className="btn discret petit" onClick={() => setAideFin(!aideFin)}>
              {aideFin ? '▾' : '▸'} C’est quoi, chaque technique ?
            </button>
            {aideFin && (
              <div className="pile petit" style={{ gap: 6 }}>
                {Object.values(FINISSEURS).map((f) => (
                  <div key={f.nom}>
                    <strong>{f.nom}</strong> <span className="muted">— {f.aide}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
