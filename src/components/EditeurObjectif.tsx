import { useState } from 'react'
import { ecartSerie, enTemps, kg, serieTexte } from '../lib/calc'
import { useRetour } from '../lib/nav'
import { usePasBoutons } from '../lib/pasBoutons'
import type { Suggestion } from '../lib/progression'
import { db, historiqueDe } from '../db'
import { pareil } from '../lib/progression'
import type { Exercice, ExoPlan, Objectif, Seance, Serie } from '../types'

interface Props {
  exo: Exercice
  /** Objectif par défaut : refaire exactement la séance du jour. */
  base: Suggestion
  actuel?: Objectif
  /** Séries faites aujourd'hui, et celles de la dernière fois pour comparer. */
  faites: Serie[]
  precedente: Serie[]
  /** Nouveau record de 1RM estimé aujourd'hui. */
  record?: boolean
  /** Séance de référence des séries `faites` (« aujourd'hui » en fin de séance, sinon « la dernière fois »). */
  quand?: string
  onValider: (o: Objectif) => void
  /** Revenir à l'objectif par défaut (comme aujourd'hui). */
  onDefaut: () => void
  onFermer: () => void
}

const arr = (x: number) => Math.round(x * 100) / 100

/** Ajuster à la main la charge et les reps de chaque série pour la prochaine séance,
 * en regard de ce qui vient d'être fait (charge, reps, RPE, écart avec la dernière fois). */
export default function EditeurObjectif({ exo, base, actuel, faites, precedente, record, quand = 'aujourd’hui', onValider, onDefaut, onFermer }: Props) {
  useRetour(true, onFermer)
  const [charges, setCharges] = useState<(number | null)[]>(actuel?.charges ?? base.charges)
  const [reps, setReps] = useState<number[]>(actuel?.reps ?? base.reps)
  const [textes, setTextes] = useState<(string | null)[]>(() => charges.map(() => null))

  const pas = usePasBoutons()(exo)
  const unite = exo.mode === 'elastique' ? 'niv.' : exo.mode === 'poids_corps' ? 'lest' : 'kg'
  // Exercice en temps : les « reps » sont des secondes, par pas de 5 s.
  const pasQte = enTemps(exo) ? 5 : 1
  const uniteQte = enTemps(exo) ? 's' : 'rep'
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
        {(faites.some((x, k) => ecartSerie(x, precedente[k], exo)?.sens === 'mieux') || record) && (
          <div className="pastille ok" style={{ alignSelf: 'flex-start' }}>
            🏆 {record ? `Nouveau record ${quand}` : quand === 'aujourd’hui' ? 'Mieux que la dernière fois' : 'Mieux que la fois d’avant'}
          </div>
        )}

        <div className="ligne entre wrap" style={{ gap: 6 }}>
          <span className="petit">Toutes les séries</span>
          <span className="ligne" style={{ gap: 6 }}>
            <button className="btn petit" onClick={() => decaler(-pas, 0)}>
              −{kg(pas)} {unite}
            </button>
            <button className="btn petit" onClick={() => decaler(pas, 0)}>
              +{kg(pas)} {unite}
            </button>
            <button className="btn petit" onClick={() => decaler(0, -pasQte)}>
              −{pasQte} {uniteQte}
            </button>
            <button className="btn petit" onClick={() => decaler(0, pasQte)}>
              +{pasQte} {uniteQte}
            </button>
          </span>
        </div>

        <div>
          <div className="faible" style={{ marginBottom: 6 }}>
            Prochaine fois · charge ({unite}) · {enTemps(exo) ? 'secondes' : 'reps'}
          </div>
          {charges.map((c, i) => (
            <div key={i} className="objectif-serie">
              {faites[i] && <Fait n={`S${i + 1}`} quand={quand} s={faites[i]} avant={precedente[i]} exo={exo} />}
            <div className="ligne" style={{ gap: 6 }}>
              <span className="faible" style={{ width: 24 }}>
                {faites[i] ? '→' : `S${i + 1}`}
              </span>
              <span className="mini-stepper compact">
                <button type="button" onClick={() => (setCharges((x) => x.map((v, k) => (k === i ? arr(Math.max(0, (v ?? 0) - pas)) : v))), setTextes((t) => t.map((v, k) => (k === i ? null : v))))}>
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
                <button type="button" onClick={() => (setCharges((x) => x.map((v, k) => (k === i ? arr((v ?? 0) + pas) : v))), setTextes((t) => t.map((v, k) => (k === i ? null : v))))}>
                  +
                </button>
              </span>
              <span className="mini-stepper compact">
                <button type="button" onClick={() => setReps((x) => x.map((v, k) => (k === i ? Math.max(1, v - pasQte) : v)))}>
                  −
                </button>
                <strong>{reps[i]}</strong>
                <button type="button" onClick={() => setReps((x) => x.map((v, k) => (k === i ? v + pasQte : v)))}>
                  +
                </button>
              </span>
            </div>
            </div>
          ))}
        </div>

        <button className="btn primaire grand" onClick={() => onValider({ charges, reps })}>
          FIXER CET OBJECTIF
        </button>
        {actuel && (
          <button className="btn plein" onClick={onDefaut}>
            Remettre comme {quand}
          </button>
        )}
        <button className="btn discret plein" onClick={onFermer}>
          Annuler
        </button>
      </div>
    </div>
  )
}

/** Série faite aujourd'hui : « 30 kg × 14 · RPE 8 (visé 8) », et l'écart avec la dernière fois. */
function Fait({ n, quand, s, avant, exo }: { n: string; quand: string; s: Serie; avant?: Serie; exo: Exercice }) {
  const e = ecartSerie(s, avant, exo)
  const ecartRpe = s.rpeCible !== undefined ? s.rpe - s.rpeCible : 0
  return (
    <div className="faible">
      {n} · {quand} <strong style={{ color: 'var(--texte)' }}>{serieTexte(exo, s).replace(' @', ' · RPE ')}</strong>
      {s.rpeCible !== undefined && ecartRpe !== 0 && (
        <span style={ecartRpe > 0.5 ? { color: 'var(--alerte)' } : undefined}>
          {' '}
          (visé {kg(s.rpeCible)})
        </span>
      )}
      {e && e.sens !== 'egal' && (
        <span className={'avant ' + e.sens} style={{ display: 'inline', marginLeft: 6 }}>
          {e.sens === 'mieux' ? '↑' : '↓'} {e.texte}
        </span>
      )}
    </div>
  )
}

/**
 * Objectif fixé après coup (aperçu de la séance, ou pendant la séance) : il s'enregistre sur la
 * dernière séance terminée qui contient l'exercice, celle que lit `suggestionPour`.
 * `terminees` : la plus récente en premier.
 */
export function ObjectifApres({ exo, plan, terminees, onFermer }: { exo: Exercice; plan: ExoPlan; terminees: Seance[]; onFermer: () => void }) {
  const avec = terminees.filter((s) => !s.deload && s.series.some((x) => x.exoId === exo.id))
  const derniere = avec[0]
  if (!derniere) return null
  const histo = historiqueDe(avec, exo.id)
  const ecrire = (o: Objectif | null) =>
    db.seances.update(derniere.id, {
      objectifs: (() => {
        const { [exo.id]: _ancien, ...reste } = derniere.objectifs ?? {}
        return o ? { ...reste, [exo.id]: o } : reste
      })(),
    })
  return (
    <EditeurObjectif
      exo={exo}
      base={pareil(exo, plan, histo)}
      actuel={derniere.objectifs?.[exo.id]}
      faites={histo[0]}
      precedente={histo[1] ?? []}
      quand="la dernière fois"
      onFermer={onFermer}
      onValider={(o) => void ecrire(o).then(onFermer)}
      onDefaut={() => void ecrire(null).then(onFermer)}
    />
  )
}
