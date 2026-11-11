import { ChevronLeft, ChevronRight } from 'lucide-react'
import { NomInfos } from './InfosExo'
import { Fragment, useEffect, useRef, useState } from 'react'
import { chauffeCalculable, chauffeDuJour, kg, lireChauffe, lirePourcentChauffe, RIR } from '../lib/calc'
import { FINISSEURS, typeFinisseur, ZONES } from '../lib/finisseur'
import { useRetour } from '../lib/nav'
import { reposParDefaut } from '../lib/programme'
import { delier } from '../lib/superset'
import type { Exercice, ExoPlan, TypeFinisseur } from '../types'
import ChoixDuree from './ChoixDuree'
import Interrupteur from './Interrupteur'
import Deplie from './Deplie'

/** Les mêmes cinq efforts qu'en séance. */
const RPES = [6, 7, 8, 9, 10]

const PALIERS = [
  [0.5, 8],
  [0.7, 4],
  [0.85, 2],
  [0.9, 1],
]

/** Chauffe calculée à chaque séance : 50 % × 8, 70 % × 4, 85 % × 2 de la charge du jour, arrondie au palier de ce jour-là. */
export function chauffeAuto(n = 3): string[] {
  return PALIERS.slice(0, n).map(([pct, reps]) => `${Math.round(pct * 100)}%×${reps}`)
}

/** Ligne d'échauffement éditable : % de la charge du jour × reps, charge fixe × reps, ou consigne libre (« 1 série facile »). */
type LigneChauffe = { pct: string; reps: number } | { charge: string; reps: number } | { texte: string }
const versLigne = (c: string): LigneChauffe => {
  const p = lirePourcentChauffe(c)
  if (p) return { pct: kg(p.pct), reps: p.reps }
  const l = lireChauffe(c)
  return l ? { charge: kg(l.charge), reps: l.reps } : { texte: c }
}
const depuisLigne = (l: LigneChauffe) =>
  'texte' in l ? l.texte.trim() : 'pct' in l ? (l.pct.trim() ? `${l.pct.trim()}%×${l.reps}` : '') : l.charge.trim() ? `${l.charge.trim()}×${l.reps}` : ''

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
  /** Écrit le plan au fil de l'eau, fenêtre encore ouverte : rien ne se perd si l'appli se ferme. */
  onModifie?: (p: ExoPlan) => void
  /** Enregistrer puis ouvrir l'exercice suivant de la séance (absent pour le dernier). */
  onSuivant?: (p: ExoPlan) => void
  /** Enregistrer puis ouvrir l'exercice précédent (absent pour le premier). */
  onPrecedent?: (p: ExoPlan) => void
  /** Ouvert par ‹ ou › : pas de montée, la fenêtre paraît rester à sa place. */
  sansMontee?: boolean
  /** Remplacer l'exercice par un autre en gardant ce plan (séries, reps, effort, repos). */
  onRemplacer?: (p: ExoPlan) => void
  /** Ouvrir la fiche d'exécution par-dessus. */
  onInfos?: () => void
  onRetirer?: () => void
}

export default function EditeurExoPlan({ exo, plan, onValider, onModifie, onSuivant, onPrecedent, sansMontee, onRemplacer, onInfos, onRetirer }: Props) {
  const [p, setP] = useState<ExoPlan>(() => structuredClone(plan))
  // Charge de chaque série (texte saisi) : celle de la série, sinon la charge de départ générale.
  const [charges, setCharges] = useState(() => plan.series.map((s) => kg(s.charge ?? plan.charge ?? undefined).replace('—', '')))
  const [chauffes, setChauffes] = useState<LigneChauffe[]>(() => plan.chauffes.map(versLigne))
  const [aideFin, setAideFin] = useState(false)
  const n = p.series.length
  const temps = exo.mesure === 'temps'
  // Toujours une fourchette ; en temps, un seul nombre (pas de conseil de montée), sauf si une fourchette existe déjà.
  const [fourchette] = useState(() => !temps || plan.series.some((s) => s.repsMin !== s.repsMax))
  // Ce qu'on a ouvert : rien de changé, rien de réécrit (le réglage retouchait les charges et faisait croire à un programme modifié).
  const depart = useRef({ p, charges, chauffes })
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

  // Le cas courant : toutes les séries pareilles, réglées une seule fois (reps, effort). Le finisseur de la dernière
  // série, toujours à 10, n'en fait pas une série différente. « Série par série » pour le reste (12 / 10 / 8, série lourde puis légères).
  const estFinisseur = (i: number) => p.finisseur && i === n - 1
  const effort = p.series.find((_, i) => !estFinisseur(i))?.rpe ?? p.series[0].rpe
  const pareilles =
    p.series.every((s, i) => s.repsMin === p.series[0].repsMin && s.repsMax === p.series[0].repsMax && (estFinisseur(i) || s.rpe === effort) && (s.repos === undefined || s.repos === p.repos)) &&
    charges.every((c) => c === charges[0])
  // Ouvert à la demande ; des séries déjà différentes s'affichent toujours une par une.
  const [detail, setDetail] = useState(false)
  // La ligne reste pendant qu'on efface la charge pour en taper une autre.
  const [avaitCharge] = useState(() => !!charges[0])
  const parSerie = detail || !pareilles
  const majToutes = (f: (s: ExoPlan['series'][number], i: number, q: ExoPlan) => void) => maj((q) => q.series.forEach((s, i) => f(s, i, q)))
  const remettrePareilles = () => {
    maj((q) => {
      const a = q.series[0]
      q.series.forEach((s, i) => {
        s.repsMin = a.repsMin
        s.repsMax = a.repsMax
        if (!(q.finisseur && i === q.series.length - 1)) s.rpe = effort
        delete s.repos
      })
    })
    setCharges((c) => c.map(() => c[0] ?? ''))
    setDetail(false)
  }


  const resultat = (): ExoPlan => {
    if (p === depart.current.p && charges === depart.current.charges && chauffes === depart.current.chauffes) return plan
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
          ...(charge !== undefined && charge !== chargeGenerale ? { charge } : {}),
          ...(s.repos !== undefined && s.repos !== p.repos ? { repos: s.repos } : {}),
        }
      }),
      chauffes: chauffes.map(depuisLigne).filter(Boolean),
      note: p.note?.trim() || undefined,
    }
  }
  // Fermer = enregistrer : par OK, par un appui à côté ou par le bouton retour.
  // Un nombre en cours de saisie est pris avant de partir.
  const puis = (f: (p: ExoPlan) => void) => () => {
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    setTimeout(() => f(resultatRef.current()), 0)
  }
  const valider = puis(onValider)
  const resultatRef = useRef(resultat)
  resultatRef.current = resultat
  useRetour(true, valider)
  // Pas à l'ouverture : un exercice seulement regardé n'est pas réécrit.
  const ouvert = useRef(false)
  useEffect(() => {
    if (!ouvert.current) {
      ouvert.current = true
      return
    }
    const t = setTimeout(() => onModifie?.(resultatRef.current()), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p, charges, chauffes])

  const unite = exo.mode === 'poids_corps' ? 'lest kg' : exo.mode === 'elastique' ? 'niveau' : exo.mode === 'par_main' ? 'kg/main' : 'kg'
  const calculable = chauffeCalculable(exo)
  // En %, les kg que ça donne avec la charge du programme : « 50 » seul se lisait comme 50 kg.
  const kgChauffe = (pct: string, reps: number) => {
    const j = chauffeDuJour(exo, `${pct.trim()}%×${reps}`, lireCharge(charges[0] ?? ''))
    return j && 'charge' in j ? `${kg(j.charge)} kg` : ''
  }
  return (
    <div className={`modal-fond${sansMontee ? ' sans-montee' : ''}`} onClick={valider}>
      <div className="modal modal-colonne" onClick={(e) => e.stopPropagation()}>
        <div className="modal-tete">
          <h2>
            <NomInfos nom={exo.nom} onClick={onInfos} />
          </h2>
        </div>
        <div className="modal-defile pile">
        <div className="ligne entre">
          <span>Séries</span>
          <MiniStepper valeur={n} min={1} max={10} onChange={setNombre} />
        </div>

        {!parSerie && (
          <>
            <div className="ligne entre">
              <span>
                {temps ? 'Secondes' : 'Reps'}
                {!temps && <div className="faible">{p.series[0].repsMin < p.series[0].repsMax ? 'vise le haut, puis monte la charge' : 'même nombre : pas de conseil de montée'}</div>}
              </span>
              {fourchette ? (
                <span className="ligne" style={{ gap: 4 }}>
                  <NombreCourt valeur={p.series[0].repsMin} onChange={(v) => majToutes((s) => ((s.repsMin = v), (s.repsMax = Math.max(v, s.repsMax))))} />
                  <span className="faible">–</span>
                  <NombreCourt valeur={p.series[0].repsMax} onChange={(v) => majToutes((s) => ((s.repsMax = v), (s.repsMin = Math.min(v, s.repsMin))))} />
                </span>
              ) : (
                <NombreCourt valeur={p.series[0].repsMin} onChange={(v) => majToutes((s) => ((s.repsMin = v), (s.repsMax = v)))} />
              )}
            </div>
            {/* L'effort visé, avec les boutons de la séance : c'est lui qui dit quand une série compte comme « dure ». */}
            <div className="reglage-effort">
              <div className="ligne entre">
                <span>
                  Effort visé <span className="mot-salle">RPE</span>
                </span>
                <span className="faible">
                  {kg(effort)}/10 · {RIR[Math.floor(effort)] ?? ''}
                </span>
              </div>
              <div className="rpe" style={{ gridTemplateColumns: `repeat(${RPES.length}, 1fr)` }}>
                {RPES.map((r) => (
                  <button key={r} type="button" className={Math.round(effort) === r ? 'actif' : ''} aria-pressed={Math.round(effort) === r} onClick={() => majToutes((s, k, q) => !(q.finisseur && k === q.series.length - 1) && (s.rpe = r))}>
                    {r}
                  </button>
                ))}
              </div>
              {p.finisseur && n > 1 && <div className="faible">La dernière série est un finisseur : à fond, 10/10.</div>}
            </div>
          </>
        )}

        <div className="ligne entre">
          <span>
            {p.enchaine ? 'Repos avant l’exercice suivant (transition)' : 'Repos entre les séries'}
            {p.enchaine && <div className="faible">0:00 = enchaîné direct sans pause</div>}
          </span>
          <ChoixDuree valeur={p.repos} onChange={(v) => maj((q) => (q.repos = v))} />
        </div>
        {/* Réglé presque à chaque exercice : à côté du repos, pas dans « Avancé » (sauf si enchaîné). */}
        {!p.enchaine && (
          <div className="ligne entre">
            <span>
              Repos avant l’exercice suivant
              <div className="faible">après la dernière série</div>
            </span>
            <ChoixDuree valeur={p.reposApres ?? p.repos} onChange={(v) => maj((q) => (q.reposApres = v === q.repos ? undefined : v))} />
          </div>
        )}

        <button type="button" className="liste-btn lien-detail" aria-expanded={parSerie} onClick={() => (pareilles ? setDetail(!detail) : undefined)}>
          <span>Régler série par série</span>
          <span className="faible">{!pareilles ? 'séries différentes' : detail ? 'refermer' : 'toutes pareilles'} {pareilles && <ChevronRight size={16} className={'muted' + (detail ? ' tourne' : '')} />}</span>
        </button>
        {parSerie && (
          <div className="pile">
            <div className="tableau-detail">
              <span />
              <span className="faible">{temps ? 'Secondes' : 'Reps'}</span>
              <span className="faible">Effort</span>
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
                  <select aria-label={`Effort visé, série ${i + 1}`} value={s.rpe} disabled={estFinisseur(i)} onChange={(e) => maj((q) => (q.series[i].rpe = parseFloat(e.target.value)))}>
                    {[...new Set([...RPES, s.rpe])].sort((x, y) => x - y).map((r) => (
                      <option key={r} value={r}>
                        {kg(r)}/10
                      </option>
                    ))}
                  </select>
                  <input inputMode="decimal" className="charge-serie" aria-label={`Charge de départ, série ${i + 1}`} placeholder="—" value={charges[i] ?? ''} onFocus={(e) => e.target.select()} onChange={(e) => majCharge(i, e.target.value)} />
                </Fragment>
              ))}
            </div>
            <div className="faible">Chaque série est jugée sur sa propre fourchette. La charge sert seulement la première fois : sans idée, laisse « — ».</div>
            <div>
              <div className="petit">Repos après chaque série</div>
              {p.series.map((s, i) => (
                <div key={i} className="ligne entre" style={{ marginTop: 6 }}>
                  <span className="faible">S{i + 1}</span>
                  <ChoixDuree compact valeur={s.repos ?? p.repos} onChange={(v) => maj((q) => (q.series[i].repos = v))} />
                </div>
              ))}
            </div>
            <button type="button" className="btn discret petit" onClick={remettrePareilles}>
              Remettre toutes les séries pareilles
            </button>
          </div>
        )}
        {/* Une charge de départ déjà notée reste visible, même avec des séries toutes pareilles. */}
        {!parSerie && avaitCharge && (
          <div className="ligne entre">
            <span>
              Charge de départ
              <div className="faible">sert seulement la première fois</div>
            </span>
            <span className="ligne" style={{ gap: 6 }}>
              <input inputMode="decimal" className="charge-depart" aria-label="Charge de départ" placeholder="—" value={charges[0] ?? ''} onFocus={(e) => e.target.select()} onChange={(e) => setCharges((c) => c.map(() => e.target.value))} />
              <span className="faible">{unite}</span>
            </span>
          </div>
        )}

        <div>
          <div className="ligne entre">
            <span>Séries d’échauffement</span>
            <MiniStepper
              valeur={chauffes.length}
              max={4}
              onChange={(k) =>
                setChauffes((c) => {
                  if (k < c.length) return c.slice(0, k)
                  // Nouvelle ligne : palier suivant de la chauffe calculée à chaque séance, quand l'exercice s'y prête.
                  const auto = calculable ? chauffeAuto(k).map(versLigne) : []
                  return [...c, ...Array.from({ length: k - c.length }, (_, j) => auto[c.length + j] ?? { charge: '', reps: 8 })]
                })
              }
            />
          </div>
          <div className="faible" style={{ margin: '4px 0 6px' }}>
            Légères, cochées en séance. Elles ne comptent ni dans le volume ni dans la progression.
          </div>
          {chauffes.map((l, i) => (
            <div key={i} className="ligne" style={{ marginBottom: 6, gap: 6 }}>
              <span className="faible" style={{ width: 22, flex: '0 0 auto' }}>
                É{i + 1}
              </span>
              {'texte' in l ? (
                <input value={l.texte} onChange={(e) => setChauffes((c) => c.map((x, k) => (k === i ? { texte: e.target.value } : x)))} />
              ) : 'pct' in l ? (
                <>
                  <label className="chauffe-pct">
                    <input
                      inputMode="decimal"
                      aria-label={`Échauffement ${i + 1}, en % de la charge du jour`}
                      value={l.pct}
                      onChange={(e) => setChauffes((c) => c.map((x, k) => (k === i ? { ...l, pct: e.target.value } : x)))}
                    />
                    %
                  </label>
                  <span className="faible">×</span>
                  <MiniStepper valeur={l.reps} min={1} onChange={(v) => setChauffes((c) => c.map((x, k) => (k === i ? { ...l, reps: v } : x)))} />
                  {kgChauffe(l.pct, l.reps) && <span className="chauffe-kg">{kgChauffe(l.pct, l.reps)}</span>}
                </>
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
          {chauffes.some((l) => 'pct' in l) && <div className="faible">En %, la charge se calcule à chaque séance, d’après celle du jour et le palier de la machine.</div>}
          {calculable && chauffes.length > 0 && chauffes.some((l) => !('pct' in l)) && (
            <button type="button" className="btn discret petit" onClick={() => setChauffes(chauffeAuto(chauffes.length).map(versLigne))}>
              Calculer à chaque séance (50 %, 70 %, 85 % de la charge du jour)
            </button>
          )}
        </div>

        {/* Plus de menu « Avancé » (11 nov. 2026) : trois réglages ne se cachent pas derrière un appui. */}
        <Interrupteur
          on={p.finisseur}
          onChange={(v) =>
            maj((q) => {
              q.finisseur = v
              if (v) q.series[q.series.length - 1].rpe = 10
            })
          }
          label="Finisseur sur la dernière série"
          aide={p.finisseur ? 'Effort 10/10 sur cette série. Plutôt sur de l’isolation, un ou deux par séance.' : 'Une technique pour finir à fond.'}
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
              <span className={'chevron-accordeon' + (aideFin ? ' ouvert' : '')}>▸</span> C’est quoi, chaque technique ?
            </button>
            <Deplie ouvert={aideFin}>
              <div className="pile petit" style={{ gap: 6 }}>
                {Object.values(FINISSEURS).map((f) => (
                  <div key={f.nom}>
                    <strong>{f.nom}</strong> <span className="muted">— {f.aide}</span>
                  </div>
                ))}
              </div>
            </Deplie>
          </div>
        )}
        <Interrupteur on={!!p.optionnel} onChange={(v) => maj((q) => (q.optionnel = v || undefined))} label="Optionnel" aide="Seulement si tu as le temps." />
        <label className="champ">
          <span>Note</span>
          <input value={p.note ?? ''} placeholder="ex. tempo lent à la descente" onChange={(e) => maj((q) => (q.note = e.target.value))} />
        </label>

        <div className="exo-plan-plus">
          {onRemplacer && (
            <button type="button" className="liste-btn" onClick={() => onRemplacer(resultat())}>
              <span>Remplacer par un autre exercice</span>
              <ChevronRight size={20} className="muted" />
            </button>
          )}
          {onSuivant && (
            <button
              type="button"
              className="liste-btn"
              onClick={() =>
                maj((q) => {
                  if (q.enchaine) {
                    q.repos = delier(q, reposParDefaut(exo)).repos
                    q.enchaine = undefined
                  } else {
                    q.enchaine = true
                    if (q.repos > 30) q.repos = 0
                  }
                })
              }
            >
              <span>{p.enchaine ? 'Délier le superset' : 'Enchaîner avec le suivant (superset)'}</span>
            </button>
          )}
          {onRetirer && (
            <button type="button" className="liste-btn" onClick={onRetirer}>
              <span style={{ color: 'var(--danger)' }}>Retirer de la séance</span>
            </button>
          )}
        </div>
        </div>

        {/* Tout s'enregistre : on ferme par « Terminer », un appui à côté ou le retour, on change d'exercice par les flèches. */}
        <div className="modal-pied ligne">
          {/* Flèches toujours à la même place : « Terminer » ne bouge pas d'un exercice à l'autre. */}
          {(onPrecedent || onSuivant) && (
            <button className="btn grand btn-fleche" aria-label="Exercice précédent" disabled={!onPrecedent} onClick={onPrecedent && puis(onPrecedent)}>
              <ChevronLeft size={24} />
            </button>
          )}
          <button className="btn primaire grand" style={{ flex: 1 }} onClick={valider}>
            Terminer
          </button>
          {(onPrecedent || onSuivant) && (
            <button className="btn grand btn-fleche" aria-label="Exercice suivant" disabled={!onSuivant} onClick={onSuivant && puis(onSuivant)}>
              <ChevronRight size={24} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
