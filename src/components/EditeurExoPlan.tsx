import { Fragment, useRef, useState } from 'react'
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

/**
 * Petit champ numérique (reps d'une série) : la valeur n'est prise qu'une fois la saisie finie
 * (champ quitté ou Entrée). Taper « 10 » ne passe jamais par « 1 ».
 */
function NombreCourt({ valeur, onChange }: { valeur: number; onChange: (v: number) => void }) {
  const [texte, setTexte] = useState<string | null>(null)
  const valider = () => {
    const v = parseInt(texte ?? '')
    if (v > 0 && v !== valeur) onChange(v)
    setTexte(null)
  }
  return (
    <input
      inputMode="numeric"
      enterKeyHint="done"
      style={{ width: 52, padding: '8px 4px', textAlign: 'center', flex: '0 0 auto' }}
      value={texte ?? String(valeur)}
      onFocus={(e) => e.target.select()}
      onChange={(e) => setTexte(e.target.value)}
      onBlur={valider}
      onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
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
  /** Reçoit le plan à la fermeture (OK, appui à côté, retour) : rien ne se perd. */
  onValider: (p: ExoPlan) => void
  /** Enregistrer puis ouvrir l'exercice suivant de la séance (absent pour le dernier). */
  onSuivant?: (p: ExoPlan) => void
  /** Remplacer l'exercice par un autre en gardant ce plan (séries, reps, RPE, repos). */
  onRemplacer?: (p: ExoPlan) => void
}

export default function EditeurExoPlan({ exo, plan, onValider, onSuivant, onRemplacer }: Props) {
  const [p, setP] = useState<ExoPlan>(() => structuredClone(plan))
  // Charge de chaque série (texte saisi) : celle de la série, sinon la charge de départ générale.
  const [charges, setCharges] = useState(() => plan.series.map((s) => kg(s.charge ?? plan.charge ?? undefined).replace('—', '')))
  const [chauffes, setChauffes] = useState<LigneChauffe[]>(() => plan.chauffes.map(versLigne))
  const [aideFin, setAideFin] = useState(false)
  const [avance, setAvance] = useState(false)
  // Fourchette de reps (8–12) : option avancée ; par défaut un seul nombre par série.
  const [fourchette, setFourchette] = useState(() => plan.series.some((s) => s.repsMin !== s.repsMax))

  const n = p.series.length
  const temps = exo.mesure === 'temps'
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
    setCharges((c) => {
      const x = [...c]
      while (x.length < k) x.push(x[x.length - 1] ?? '')
      return x.slice(0, k)
    })
  }

  /** Modifier une série : les séries suivantes qui avaient la même valeur suivent (3 × 12 en une saisie). */
  const majReps = (i: number, champ: 'repsMin' | 'repsMax' | 'les2', v: number) =>
    maj((q) => {
      const ancien = q.series[i]
      const pareil = (j: number) => (champ === 'repsMax' ? q.series[j].repsMax === ancien.repsMax : q.series[j].repsMin === ancien.repsMin && (champ === 'repsMin' || q.series[j].repsMax === ancien.repsMax))
      const cibles = [i, ...q.series.map((_, j) => j).filter((j) => j > i && pareil(j))]
      for (const j of cibles) {
        const s = q.series[j]
        if (champ === 'les2') (s.repsMin = v), (s.repsMax = v)
        else if (champ === 'repsMin') (s.repsMin = v), (s.repsMax = Math.max(v, s.repsMax))
        else (s.repsMax = v), (s.repsMin = Math.min(v, s.repsMin))
      }
    })
  const majCharge = (i: number, t: string) =>
    setCharges((c) => c.map((x, j) => (j === i || (j > i && x === c[i]) ? t : x)))


  const resultat = (): ExoPlan => {
    // Charge de départ générale = celle de la 1re série ; les autres séries ne la précisent que si elle diffère.
    const chargeGenerale = lireCharge(charges[0] ?? '')
    return {
      ...p,
      charge: chargeGenerale ?? null,
      series: p.series.map((s, i) => {
        const { charge: _c, repos: _r, ...base } = s
        const charge = lireCharge(charges[i] ?? '')
        return {
          ...base,
          ...(fourchette ? {} : { repsMax: base.repsMin }),
          ...(charge !== undefined && charge !== chargeGenerale ? { charge } : {}),
          ...(s.repos !== undefined && s.repos !== p.repos ? { repos: s.repos } : {}),
        }
      }),
      chauffes: chauffes.map(depuisLigne).filter(Boolean),
      note: p.note?.trim() || undefined,
    }
  }
  // Fermer = enregistrer : par OK, par un appui à côté ou par le bouton retour.
  const valider = () => {
    // Un nombre en cours de saisie est pris avant de fermer.
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    setTimeout(() => onValider(resultatRef.current()), 0)
  }
  const resultatRef = useRef(resultat)
  resultatRef.current = resultat
  useRetour(true, valider)

  const unite = exo.mode === 'poids_corps' ? 'lest kg' : exo.mode === 'elastique' ? 'niveau' : exo.mode === 'par_main' ? 'kg/main' : 'kg'
  const chargeBase = lireCharge(charges[0] ?? '')
  const resumeAvance = [
    `RPE ${[...new Set(p.series.map((s) => kg(s.rpe)))].join(', ')}`,
    p.series.some((s) => s.repos !== undefined && s.repos !== p.repos) ? 'repos par série' : '',
    p.finisseur ? '★ finisseur' : '',
    p.optionnel ? 'optionnel' : '',
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="modal-fond" onClick={valider}>
      <div className="modal pile" onClick={(e) => e.stopPropagation()}>
        <h2>{exo.nom}</h2>

        <div className="ligne entre">
          <span>Séries</span>
          <MiniStepper valeur={n} min={1} max={10} onChange={setNombre} />
        </div>

        <div className="tableau-series">
          <span />
          <span className="faible">{temps ? 'Secondes' : 'Reps'}</span>
          <span className="faible">Charge ({unite})</span>
          {p.series.map((s, i) => (
            <Fragment key={i}>
              <span className="faible">S{i + 1}</span>
              {fourchette ? (
                <span className="ligne" style={{ gap: 4 }}>
                  <NombreCourt valeur={s.repsMin} onChange={(v) => majReps(i, 'repsMin', v)} />
                  <span className="faible">–</span>
                  <NombreCourt valeur={s.repsMax} onChange={(v) => majReps(i, 'repsMax', v)} />
                </span>
              ) : (
                <NombreCourt valeur={s.repsMin} onChange={(v) => majReps(i, 'les2', v)} />
              )}
              <input
                inputMode="decimal"
                className="charge-serie"
                placeholder="—"
                value={charges[i] ?? ''}
                onFocus={(e) => e.target.select()}
                onChange={(e) => majCharge(i, e.target.value)}
              />
            </Fragment>
          ))}
        </div>
        {/* Fourchette juste sous le tableau : on voit tout de suite ce qu'elle change (deux nombres par série). */}
        <button type="button" className={'interrupteur petit-inter' + (fourchette ? ' on' : '')} onClick={() => setFourchette(!fourchette)}>
          <span>
            {temps ? 'Fourchette de secondes (min – max)' : 'Fourchette de reps (min – max)'}
            <div className="faible">
              {fourchette
                ? 'Chaque série a un minimum et un maximum : vise le haut, et monte la charge quand tu l’atteins sur toutes les séries.'
                : 'Un nombre fixe par série. Active pour viser une fourchette (ex. 8–12).'}
            </div>
          </span>
          <span className="piste" />
        </button>
        <div className="faible">
          Change la 1re série : les suivantes identiques suivent. La charge ne sert que la toute première fois (ensuite, l’appli repart de ta dernière
          séance) ; pas d’idée ? Laisse « — », tu la trouveras pendant la séance.
        </div>

        <div className="ligne entre">
          <span>Repos entre les séries</span>
          <ChoixDuree valeur={p.repos} onChange={(v) => maj((q) => (q.repos = v))} />
        </div>
        {/* Réglé presque à chaque exercice : à côté du repos, pas dans « Avancé ». */}
        <div className="ligne entre">
          <span>
            Repos avant l’exercice suivant
            <div className="faible">après la dernière série (changer de machine, souffler)</div>
          </span>
          <ChoixDuree valeur={p.reposApres ?? p.repos} onChange={(v) => maj((q) => (q.reposApres = v === q.repos ? undefined : v))} />
        </div>

        <div>
          <div className="ligne entre">
            <span>Séries d’échauffement</span>
            <MiniStepper
              valeur={chauffes.length}
              max={4}
              onChange={(k) =>
                setChauffes((c) => {
                  if (k < c.length) return c.slice(0, k)
                  // Nouvelle ligne : palier suivant de la chauffe auto si la charge est connue.
                  const auto = chargeBase ? chauffeAuto(chargeBase, exo.pas, k).map(versLigne) : []
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
          {chauffes.length > 0 && chargeBase! > 0 && (
            <button type="button" className="btn discret petit" onClick={() => setChauffes(chauffeAuto(chargeBase!, exo.pas, chauffes.length).map(versLigne))}>
              Calculer depuis la charge de la 1re série (50 %, 70 %, 85 %)
            </button>
          )}
        </div>

        <label className="champ">
          <span>Note (consigne pour cette séance)</span>
          <input value={p.note ?? ''} onChange={(e) => maj((q) => (q.note = e.target.value))} />
        </label>

        {/* Réglages pour aller plus loin, repliés : par défaut l'appli vise RPE 8 sans qu'on ait à y penser. */}
        <button type="button" className="groupe-repli" onClick={() => setAvance(!avance)} aria-expanded={avance}>
          <span>
            Avancé <span className="faible">· {resumeAvance}</span>
          </span>
          <span className="muted">{avance ? '▾' : '▸'}</span>
        </button>
        {avance && (
          <div className="pile">
            <div>
              <div className="petit">Difficulté visée (RPE) par série</div>
              <div className="faible" style={{ marginBottom: 6 }}>
                8 = il te reste 2 reps en réserve ; 10 = échec. C’est elle qui dit quand une série compte comme « dure ».
              </div>
              {p.series.map((s, i) => (
                <div key={i} className="ligne" style={{ marginBottom: 6, gap: 6 }}>
                  <span className="faible" style={{ width: 22, flex: '0 0 auto' }}>
                    S{i + 1}
                  </span>
                  <select value={s.rpe} disabled={p.finisseur && i === n - 1} onChange={(e) => maj((q) => (q.series[i].rpe = parseFloat(e.target.value)))}>
                    {RPES.map((r) => (
                      <option key={r} value={r}>
                        RPE {kg(r)}
                        {r === 10 ? ' (échec)' : ''}
                      </option>
                    ))}
                  </select>
                  <ChoixDuree compact valeur={s.repos ?? p.repos} onChange={(v) => maj((q) => (q.series[i].repos = v))} />
                </div>
              ))}
              <div className="faible">À droite : repos après chaque série (par défaut, celui réglé plus haut).</div>
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
            <Interrupteur on={!!p.optionnel} onChange={(v) => maj((q) => (q.optionnel = v || undefined))} label="Optionnel" aide="À faire seulement si tu as le temps." />
          </div>
        )}

        {onSuivant ? (
          <div className="ligne">
            <button className="btn grand" style={{ flex: 1 }} onClick={valider}>
              OK
            </button>
            <button className="btn primaire grand" style={{ flex: 2 }} onClick={() => onSuivant(resultat())}>
              OK · suivant ›
            </button>
          </div>
        ) : (
          <button className="btn primaire grand" onClick={valider}>
            OK
          </button>
        )}
        {onRemplacer && (
          <button className="btn plein" onClick={() => onRemplacer(resultat())}>
            ⇄ Remplacer par un autre exercice
          </button>
        )}

      </div>
    </div>
  )
}
