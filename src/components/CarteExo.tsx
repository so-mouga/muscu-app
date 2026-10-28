import { useState } from 'react'
import { db, uid } from '../db'
import { chargeTexte, chrono, kg, reposApres, reposTexte, RIR, serieTexte } from '../lib/calc'
import { useRetour } from '../lib/nav'
import Vignette from './Vignette'
import { vibrer } from '../lib/appareil'
import type { Suggestion } from '../lib/progression'
import type { Exercice, ExoPlan, Seance, Serie, TypeSerie, ZoneDemiReps } from '../types'

const TYPES: [TypeSerie, string][] = [
  ['normale', 'Normale'],
  ['echec', 'Échec'],
  ['serie_longue', 'Série longue'],
  ['drop', 'Drop set'],
  ['rest_pause', 'Rest-pause'],
]
const ZONES: [ZoneDemiReps, string][] = [
  ['etiree', 'étirée'],
  ['milieu', 'milieu'],
  ['contractee', 'contractée'],
]
const RPES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]

interface Props {
  seance: Seance
  plan: ExoPlan
  exo: Exercice
  sugg: Suggestion
  derniere: Serie[] | undefined
  onValide: (s: Serie, repos: number) => void
  onMachinePrise: () => void
  /** Secondes de repos restantes (0 = pas de repos en cours). */
  reposRestant: number
  /** Juste après une validation : évite d'enregistrer deux fois sur un double appui. */
  verrou: boolean
  /** Cet exercice n'est pas l'exercice en cours : on le regarde, on n'y ajoute pas de série. */
  consultation: boolean
  /** Nom de l'exercice en cours (absent quand tout est fait). */
  enCoursNom?: string
  onFaireMaintenant: () => void
  onAllerEnCours: () => void
}

/** Heure de la dernière validation : bloque un double appui avant même le rafraîchissement de l'écran. */
let derniereValidation = 0

export function majSeance(id: string, fn: (s: Seance) => void) {
  return db.seances.where('id').equals(id).modify(fn)
}

export default function CarteExo({
  seance,
  plan,
  exo,
  sugg,
  derniere,
  onValide,
  onMachinePrise,
  reposRestant,
  verrou,
  consultation,
  enCoursNom,
  onFaireMaintenant,
  onAllerEnCours,
}: Props) {
  const faites = seance.series.filter((s) => s.exoId === exo.id)
  const total = Math.max(faites.length, plan.series.length + (seance.ajustSeries[exo.id] ?? 0))
  const [editId, setEditId] = useState<string | null>(null)
  const [photo, setPhoto] = useState(false)
  const enEdition = faites.find((s) => s.id === editId)
  const index = enEdition ? faites.indexOf(enEdition) : faites.length
  const termine = !enEdition && faites.length >= total

  const ajuster = (delta: number) =>
    majSeance(seance.id, (s) => {
      s.ajustSeries[exo.id] = (s.ajustSeries[exo.id] ?? 0) + delta
    })

  return (
    <div className="carte pile">
      <div>
        <div className="ligne entre" style={{ alignItems: 'flex-start' }}>
          {exo.image && <Vignette exo={exo} taille={52} onClick={() => setPhoto(true)} />}
          <h2 style={{ flex: 1 }}>
            {exo.nom}
            {plan.optionnel && (
              <span className="pastille" style={{ marginLeft: 8, verticalAlign: 'middle' }}>
                optionnel
              </span>
            )}
          </h2>
          <button className="btn petit" style={{ minHeight: 40, flex: '0 0 auto' }} onClick={onMachinePrise}>
            Machine prise
          </button>
        </div>
        <div className="faible">
          {plan.series.length} × {plan.series[0].repsMin === plan.series[0].repsMax ? plan.series[0].repsMin : `${plan.series[0].repsMin}–${plan.series[0].repsMax}`} · RPE{' '}
          {plan.series.map((p) => kg(p.rpe)).join(', ')} · repos {reposTexte(plan)}
          {plan.finisseur && <span style={{ color: 'var(--finisseur)' }}> · ★ finisseur</span>}
        </div>
      </div>

      {derniere && (
        <div className="petit muted">
          Dernière fois : {derniere.map((s) => serieTexte(exo, s).replace(/^PDC /, '')).join(' · ')}
        </div>
      )}
      <div className="suggestion petit">
        <div>
          <strong>
            Cible : {chargeTexte(exo, sugg.charges[0])}
            {sugg.charges.some((c) => c !== sugg.charges[0]) && ` → ${chargeTexte(exo, sugg.charges[sugg.charges.length - 1])}`} ×{' '}
            {sugg.reps.join('/')}
          </strong>
        </div>
        <div className="muted">{sugg.message}</div>
      </div>
      {(plan.note || exo.notes) && <div className="faible">ℹ️ {plan.note ?? exo.notes}</div>}

      {plan.chauffes.length > 0 && (
        <div>
          <div className="faible" style={{ marginBottom: 6 }}>
            Chauffe (repos 1 min)
          </div>
          <div className="chauffes">
            {plan.chauffes.map((c, i) => {
              const cle = `${exo.id}:${i}`
              const fait = !!seance.chauffes[cle]
              return (
                <button
                  key={cle}
                  className={fait ? 'fait' : ''}
                  onClick={() => {
                    vibrer()
                    void majSeance(seance.id, (s) => {
                      s.chauffes[cle] = !fait
                    })
                  }}
                >
                  {fait ? '☑' : '☐'} {c}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {faites.length > 0 && (
        <div>
          {faites.map((s, i) => (
            <button
              key={s.id}
              className={'serie-faite' + (s.id === editId ? ' edition' : '')}
              onClick={() => setEditId(s.id === editId ? null : s.id)}
            >
              <span>
                <span className="faible">S{i + 1}</span> {serieTexte(exo, s)}
              </span>
              <span className="faible">
                {s.type === 'serie_longue' ? '★' : s.type !== 'normale' ? TYPES.find((t) => t[0] === s.type)?.[1] : ''}
                {s.douleur ? ' ⚠️' : ''} ✎
              </span>
            </button>
          ))}
        </div>
      )}

      {termine ? (
        <div className="pile">
          <div className="ligne entre">
            <span className="pastille ok">✓ Exercice terminé</span>
            <button className="btn discret petit" onClick={() => (ajuster(+1), onFaireMaintenant())}>
              + série
            </button>
          </div>
          <button className="btn primaire grand" onClick={onAllerEnCours}>
            {enCoursNom ? `Continuer : ${enCoursNom} →` : 'Terminer la séance'}
          </button>
        </div>
      ) : consultation && !enEdition ? (
        <div className="consultation pile">
          <div className="petit">
            👀 <strong>Consultation.</strong>{' '}
            <span className="muted">
              L’exercice en cours est <strong>{enCoursNom}</strong>.
            </span>
          </div>
          <div>
            {Array.from({ length: total - faites.length }, (_, k) => {
              const n = faites.length + k
              const j = Math.min(n, sugg.charges.length - 1)
              const p = plan.series[Math.min(n, plan.series.length - 1)]
              return (
                <div key={n} className="serie-prevue">
                  <span className="faible">S{n + 1}</span> {chargeTexte(exo, sugg.charges[j])} × {sugg.reps[j] ?? p.repsMin} · RPE {kg(p.rpe)}
                  {plan.finisseur && n === total - 1 ? ' ★' : ''}
                  <span className="faible"> · repos {chrono(reposApres(plan, n, total))}</span>
                </div>
              )
            })}
          </div>
          <button className="btn primaire grand" onClick={onAllerEnCours}>
            ↩ Revenir à {enCoursNom}
          </button>
          <button className="btn plein" onClick={onFaireMaintenant}>
            Faire cet exercice maintenant
          </button>
        </div>
      ) : (
        <Editeur
          key={`${exo.id}-${index}-${editId ?? ''}`}
          seance={seance}
          plan={plan}
          exo={exo}
          sugg={sugg}
          index={index}
          total={total}
          faites={faites}
          edition={enEdition}
          reposRestant={reposRestant}
          verrou={verrou}
          onFini={(s) => {
            if (enEdition) setEditId(null)
            else onValide(s, reposApres(plan, index, total))
          }}
          onAnnulerEdition={() => setEditId(null)}
        />
      )}

      {!termine && !enEdition && (
        <div className="ligne entre">
          <button className="btn discret petit" onClick={() => ajuster(+1)}>
            + série
          </button>
          {total > faites.length && (
            <button className="btn discret petit" onClick={() => ajuster(-1)}>
              − retirer la série {index + 1}
            </button>
          )}
        </div>
      )}

      {photo && exo.image && <Photo src={exo.image} titre={exo.nom} onFermer={() => setPhoto(false)} />}

      <textarea
        rows={2}
        placeholder="Note (réglage machine, sensation, douleur…)"
        defaultValue={seance.notes[exo.id] ?? ''}
        onBlur={(e) => {
          const v = e.target.value
          void majSeance(seance.id, (s) => {
            s.notes[exo.id] = v
          })
        }}
      />
    </div>
  )
}

function Photo({ src, titre, onFermer }: { src: string; titre: string; onFermer: () => void }) {
  useRetour(true, onFermer)
  return (
    <div className="modal-fond" onClick={onFermer}>
      <div className="modal pile" onClick={onFermer}>
        <h3>{titre}</h3>
        <img src={src} alt={titre} className="photo-grande" />
        <button className="btn discret plein">Fermer</button>
      </div>
    </div>
  )
}

interface EditeurProps {
  seance: Seance
  plan: ExoPlan
  exo: Exercice
  sugg: Suggestion
  index: number
  total: number
  faites: Serie[]
  edition?: Serie
  reposRestant: number
  verrou: boolean
  onFini: (s: Serie) => void
  onAnnulerEdition: () => void
}

function Editeur({ seance, plan, exo, sugg, index, total, faites, edition, reposRestant, verrou, onFini, onAnnulerEdition }: EditeurProps) {
  const p = plan.series[Math.min(index, plan.series.length - 1)]
  const i = Math.min(index, sugg.charges.length - 1)
  const finisseur = !edition && plan.finisseur && index === total - 1

  // Charge proposée : la suggestion, décalée du même écart que l'utilisateur a appliqué à la série précédente.
  const chargeInitiale = (): number => {
    const prec = faites[index - 1]
    const s = sugg.charges[i]
    if (s === null) return prec?.charge ?? (exo.mode === 'elastique' ? 1 : 0)
    const sPrec = sugg.charges[Math.min(index - 1, sugg.charges.length - 1)]
    return prec && sPrec !== null && index > 0 ? Math.max(0, s + (prec.charge - sPrec)) : s
  }

  const [charge, setCharge] = useState(edition?.charge ?? chargeInitiale())
  const [chargeTxt, setChargeTxt] = useState<string | null>(null)
  const [reps, setReps] = useState(edition?.reps ?? sugg.reps[i] ?? p.repsMin)
  const [rpe, setRpe] = useState(edition?.rpe ?? (finisseur ? 10 : p.rpe))
  const [type, setType] = useState<TypeSerie>(edition?.type ?? (finisseur ? 'echec' : 'normale'))
  const [douleur, setDouleur] = useState(edition?.douleur ?? false)
  const [options, setOptions] = useState(false)
  const [panneau, setPanneau] = useState(false)
  const [demi, setDemi] = useState(edition?.demiReps ?? 6)
  const [zone, setZone] = useState<ZoneDemiReps>(edition?.zone ?? 'etiree')
  const [aideRpe, setAideRpe] = useState(false)

  // Pendant le repos, la validation reste possible mais passe au second plan.
  const enRepos = !edition && reposRestant > 0
  const pas = exo.pas
  const unite = exo.mode === 'elastique' ? 'niveau' : exo.mode === 'poids_corps' ? 'kg de lest (− = assistance)' : exo.mode === 'par_main' ? 'kg par main' : 'kg'
  const arr = (x: number) => Math.round(x * 100) / 100

  const construire = (t: TypeSerie, extra: Partial<Serie> = {}): Serie => ({
    id: edition?.id ?? uid(),
    exoId: exo.id,
    type: t,
    charge,
    reps,
    rpe: t === 'serie_longue' ? 10 : rpe,
    rpeCible: p.rpe,
    repsMin: p.repsMin,
    repsMax: p.repsMax,
    douleur: douleur || undefined,
    heure: edition?.heure ?? Date.now(),
    ...extra,
  })

  const enregistrer = async (s: Serie) => {
    if (!edition) {
      if (Date.now() - derniereValidation < 1500) return
      derniereValidation = Date.now()
    }
    vibrer(40)
    await majSeance(seance.id, (x) => {
      const k = x.series.findIndex((y) => y.id === s.id)
      if (k >= 0) x.series[k] = s
      else x.series.push(s)
    })
    onFini(s)
  }

  const supprimer = async () => {
    if (!edition) return
    await majSeance(seance.id, (x) => {
      x.series = x.series.filter((y) => y.id !== edition.id)
    })
    onAnnulerEdition()
  }

  if (panneau) {
    return (
      <div className="pile">
        <div className="bandeau-fin">★ Demi-reps · enchaîne sans repos</div>
        <div className="stepper">
          <button onClick={() => setDemi(Math.max(0, demi - 1))}>−</button>
          <div className="valeur">
            <input inputMode="numeric" value={demi} onChange={(e) => setDemi(parseInt(e.target.value) || 0)} />
            <span className="unite">demi-reps (5–8)</span>
          </div>
          <button onClick={() => setDemi(demi + 1)}>+</button>
        </div>
        <div className="chips">
          {ZONES.map(([z, nom]) => (
            <button key={z} className={zone === z ? 'actif' : ''} onClick={() => setZone(z)}>
              {nom}
            </button>
          ))}
        </div>
        <button className="btn finisseur grand" onClick={() => enregistrer(construire('serie_longue', { demiReps: demi, zone }))}>
          VALIDER LE FINISSEUR
        </button>
        <button className="btn plein" onClick={() => enregistrer(construire('echec'))}>
          Passer
        </button>
        <div className="faible">Série longue : uniquement sur la dernière série. Stoppe si douleur articulaire (pas une simple brûlure musculaire).</div>
      </div>
    )
  }

  return (
    <div className="pile">
      <div className="ligne entre">
        <h3>
          {edition ? `Modifier la série ${index + 1}` : `Série ${index + 1}/${total}`}
        </h3>
        <span className="faible">
          cible {p.repsMin === p.repsMax ? p.repsMin : `${p.repsMin}–${p.repsMax}`} reps · RPE {kg(p.rpe)} · repos {chrono(reposApres(plan, index, total))}
        </span>
      </div>

      {finisseur && <div className="bandeau-fin">★ FINISSEUR · échec puis 5–8 demi-reps étirées</div>}

      <div className="stepper">
        <button onClick={() => (setCharge(arr(charge - pas)), setChargeTxt(null))}>−</button>
        <div className="valeur">
          <input
            inputMode="decimal"
            value={chargeTxt ?? kg(charge)}
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
              setChargeTxt(e.target.value)
              const v = parseFloat(e.target.value.replace(',', '.'))
              if (!isNaN(v)) setCharge(v)
            }}
            onBlur={() => setChargeTxt(null)}
          />
          <span className="unite">{unite}</span>
        </div>
        <button onClick={() => (setCharge(arr(charge + pas)), setChargeTxt(null))}>+</button>
      </div>

      <div className="stepper">
        <button onClick={() => setReps(Math.max(0, reps - 1))}>−</button>
        <div className="valeur">
          <input inputMode="numeric" value={reps} onFocus={(e) => e.target.select()} onChange={(e) => setReps(parseInt(e.target.value) || 0)} />
          <span className="unite">reps</span>
        </div>
        <button onClick={() => setReps(reps + 1)}>+</button>
      </div>

      {!finisseur && (
        <div>
          <div className="rpe">
            {RPES.map((r) => (
              <button
                key={r}
                className={(rpe === r ? 'actif ' : '') + (p.rpe === r ? 'cible ' : '') + (r % 1 ? 'demi' : '')}
                onClick={() => setRpe(r)}
                onContextMenu={(e) => (e.preventDefault(), setAideRpe(true))}
              >
                {r % 1 ? '½' : r}
              </button>
            ))}
          </div>
          <div className="ligne entre faible" style={{ marginTop: 4 }}>
            <span>
              RPE {kg(rpe)} · {RIR[Math.floor(rpe)] ?? ''}
              {rpe > p.rpe + 0.5 && <span style={{ color: 'var(--alerte)' }}> · plus dur que prévu</span>}
            </span>
            <button className="btn discret petit" style={{ minHeight: 0, padding: 0 }} onClick={() => setAideRpe(!aideRpe)}>
              aide RPE
            </button>
          </div>
          {aideRpe && (
            <table className="note-rpe" style={{ marginTop: 6 }}>
              <tbody>
                {[10, 9, 8, 7, 6].map((r) => (
                  <tr key={r}>
                    <td>
                      <strong>{r}</strong>
                    </td>
                    <td>{['4 en réserve, très facile', '3 en réserve', '2 en réserve', '1 rep de plus possible', 'échec technique'][r - 6]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {verrou && !edition ? (
        <button className="btn grand" disabled style={{ opacity: 1, color: 'var(--ok)' }}>
          ✓ SÉRIE ENREGISTRÉE
        </button>
      ) : finisseur ? (
        <button className={'btn grand' + (enRepos ? '' : ' finisseur')} onClick={() => setPanneau(true)}>
          {enRepos ? `Échec atteint · repos ${chrono(reposRestant)}` : 'ÉCHEC ATTEINT'}
        </button>
      ) : (
        <button
          className={'btn grand' + (enRepos ? '' : ' primaire')}
          onClick={() => enregistrer(construire(type, type === 'serie_longue' ? { demiReps: demi, zone } : { demiReps: undefined, zone: undefined }))}
        >
          {edition ? 'METTRE À JOUR' : enRepos ? `Valider maintenant · repos ${chrono(reposRestant)}` : 'VALIDER LA SÉRIE'}
        </button>
      )}

      <div className="ligne entre">
        <button className="btn discret petit" onClick={() => setOptions(!options)}>
          {options ? '▾' : '▸'} Type, douleur{edition?.type === 'serie_longue' ? ', demi-reps' : ''}
        </button>
        {edition && (
          <div className="ligne">
            <button className="btn discret petit" onClick={onAnnulerEdition}>
              Annuler
            </button>
            <button className="btn discret petit danger" onClick={supprimer}>
              Supprimer
            </button>
          </div>
        )}
      </div>

      {options && (
        <div className="pile">
          <div className="chips">
            {TYPES.map(([t, nom]) => (
              <button
                key={t}
                className={type === t ? 'actif' : ''}
                onClick={() => {
                  setType(t)
                  if (t === 'echec' || t === 'serie_longue') setRpe(10)
                }}
              >
                {nom}
              </button>
            ))}
          </div>
          {type === 'serie_longue' && (
            <>
              {index !== total - 1 && <div className="faible" style={{ color: 'var(--alerte)' }}>Série longue : normalement sur la dernière série seulement.</div>}
              <div className="ligne">
                <span className="petit">Demi-reps</span>
                <button className="btn" onClick={() => setDemi(Math.max(0, demi - 1))}>
                  −
                </button>
                <strong>{demi}</strong>
                <button className="btn" onClick={() => setDemi(demi + 1)}>
                  +
                </button>
              </div>
              <div className="chips">
                {ZONES.map(([z, nom]) => (
                  <button key={z} className={zone === z ? 'actif' : ''} onClick={() => setZone(z)}>
                    {nom}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="chips">
            <button className={douleur ? 'actif' : ''} onClick={() => setDouleur(!douleur)}>
              ⚠️ Douleur {douleur ? 'signalée' : ''}
            </button>
          </div>
          {douleur && <div className="faible">Si la douleur est articulaire, allège ou passe l’exercice. Si elle persiste, consulte.</div>}
        </div>
      )}
    </div>
  )
}
