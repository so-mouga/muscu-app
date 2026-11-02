import { Trophy } from 'lucide-react'
import { useState } from 'react'
import { chargeDecalee, ecartSerie, enTemps, kg, serieTexte } from '../lib/calc'
import { useRetour } from '../lib/nav'
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

/** Ajuster à la main la charge et les reps de chaque série pour la prochaine séance,
 * en regard de ce qui vient d'être fait (charge, reps, RPE, écart avec la dernière fois). */
export default function EditeurObjectif({ exo, base, actuel, faites, precedente, record, quand = 'aujourd’hui', onValider, onDefaut, onFermer }: Props) {
  const [charges, setCharges] = useState<(number | null)[]>(actuel?.charges ?? base.charges)
  const [reps, setReps] = useState<number[]>(actuel?.reps ?? base.reps)
  const [textes, setTextes] = useState<(string | null)[]>(() => charges.map(() => null))
  const [depart] = useState(() => JSON.stringify({ charges, reps }))
  // Appui à côté et retour Android gardent ce qui a changé ; seul « Annuler » ne garde rien.
  const fermer = () => (JSON.stringify({ charges, reps }) === depart ? onFermer() : onValider({ charges, reps }))
  useRetour(true, fermer)

  const pas = exo.pas
  const unite = exo.mode === 'elastique' ? 'niv.' : exo.mode === 'poids_corps' ? 'lest' : 'kg'
  // Exercice en temps : les « reps » sont des secondes, par pas de 5 s.
  const pasQte = enTemps(exo) ? 5 : 1
  const uniteQte = enTemps(exo) ? 's' : 'rep'
  const decaler = (dc: number, dr: number) => {
    if (dc) setCharges((c) => c.map((x) => chargeDecalee(exo, x, dc)))
    if (dr) setReps((r) => r.map((x) => Math.max(1, x + dr)))
    setTextes((t) => t.map(() => null))
  }

  const titreCharge = exo.assistance ? 'Assistance (kg)' : exo.mode === 'elastique' ? 'Niveau' : exo.mode === 'poids_corps' ? 'Lest (kg)' : exo.mode === 'par_main' ? 'Kg par main' : 'Charge (kg)'
  const majCharge = (i: number, f: (v: number | null) => number | null) => setCharges((x) => x.map((v, k) => (k === i ? f(v) : v)))
  const oublierTexte = (i: number) => setTextes((t) => t.map((v, k) => (k === i ? null : v)))

  return (
    <div className="modal-fond" onClick={fermer}>
      <div className="modal modal-colonne" onClick={(e) => e.stopPropagation()}>
        <div className="modal-tete">
          <h2>{exo.nom}</h2>
          <div className="faible">Objectif pour la prochaine séance</div>
        </div>

        <div className="modal-defile">
          {(faites.some((x, k) => ecartSerie(x, precedente[k], exo)?.sens === 'mieux') || record) && (
            <div className="pastille ok objectif-bravo">
              <Trophy size={14} /> {record ? `Nouveau record ${quand}` : quand === 'aujourd’hui' ? 'Mieux que la dernière fois' : 'Mieux que la fois d’avant'}
            </div>
          )}

          <div className="petit">Toutes les séries</div>
          <div className="objectif-tous">
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
          </div>

          <div className="faible petit objectif-legende">Fait {quand}, puis à viser</div>
          <div className="objectif-colonnes faible petit">
            <span>{titreCharge}</span>
            <span>{enTemps(exo) ? 'Secondes' : 'Reps'}</span>
          </div>
          {charges.map((c, i) => (
            <div key={i} className="objectif-serie">
              {faites[i] ? <Fait n={`S${i + 1}`} s={faites[i]} avant={precedente[i]} exo={exo} /> : <div className="faible">S{i + 1}</div>}
              <div className="objectif-colonnes">
                <span className="objectif-stepper">
                  <button type="button" aria-label={`Moins de charge, série ${i + 1}`} onClick={() => (majCharge(i, (v) => chargeDecalee(exo, v, -pas)), oublierTexte(i))}>
                    −
                  </button>
                  <input
                    className={faites[i] && c !== faites[i].charge ? 'fin-diff' : ''}
                    inputMode="decimal"
                    placeholder="—"
                    aria-label={`Charge, série ${i + 1}`}
                    value={textes[i] ?? (c === null ? '' : kg(c))}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const t = e.target.value
                      setTextes((x) => x.map((v, k) => (k === i ? t : v)))
                      const v = parseFloat(t.replace(',', '.'))
                      majCharge(i, (w) => (t.trim() === '' ? null : isNaN(v) ? w : v))
                    }}
                  />
                  <button type="button" aria-label={`Plus de charge, série ${i + 1}`} onClick={() => (majCharge(i, (v) => chargeDecalee(exo, v, pas)), oublierTexte(i))}>
                    +
                  </button>
                </span>
                <span className="objectif-stepper">
                  <button type="button" aria-label={`Moins de reps, série ${i + 1}`} onClick={() => setReps((x) => x.map((v, k) => (k === i ? Math.max(1, v - pasQte) : v)))}>
                    −
                  </button>
                  <strong className={faites[i] && reps[i] !== faites[i].reps ? 'fin-diff' : ''}>{reps[i]}</strong>
                  <button type="button" aria-label={`Plus de reps, série ${i + 1}`} onClick={() => setReps((x) => x.map((v, k) => (k === i ? v + pasQte : v)))}>
                    +
                  </button>
                </span>
              </div>
            </div>
          ))}
          {actuel && (
            <button className="btn plein objectif-remettre" onClick={onDefaut}>
              Remettre comme {quand}
            </button>
          )}
        </div>

        <div className="modal-pied objectif-pied">
          <button className="btn discret" onClick={onFermer}>
            Annuler
          </button>
          <button className="btn primaire grand" onClick={() => onValider({ charges, reps })}>
            Fixer cet objectif
          </button>
        </div>
      </div>
    </div>
  )
}

/** Série faite aujourd'hui : « 30 kg × 14 · effort 8/10 (visé 8) », et l'écart avec la dernière fois. */
function Fait({ n, s, avant, exo }: { n: string; s: Serie; avant?: Serie; exo: Exercice }) {
  const e = ecartSerie(s, avant, exo)
  const ecartRpe = s.rpeCible !== undefined ? s.rpe - s.rpeCible : 0
  return (
    <div className="faible">
      {n} · <strong style={{ color: 'var(--texte)' }}>{serieTexte(exo, s, true)}</strong> · effort {kg(s.rpe)}/10
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
