import { useState } from 'react'
import { db, uid } from '../db'
import { chargeTexte, chrono, ecartSerie, kg, lireChauffe, reposApres, reposTexte, RIR, serieTexte } from '../lib/calc'
import { FINISSEURS, typeFinisseur, ZONES } from '../lib/finisseur'
import { useRetour } from '../lib/nav'
import { usePasBoutons } from '../lib/pasBoutons'
import Vignette from './Vignette'
import { vibrer } from '../lib/appareil'
import type { Suggestion } from '../lib/progression'
import type { Exercice, ExoPlan, Seance, Serie, TypeSerie, ZoneDemiReps } from '../types'

const TYPES: [TypeSerie, string, string][] = [
  ['normale', 'Normale', 'Série classique, arrêtée avant l’échec.'],
  ['echec', 'Échec', 'Poussée jusqu’à ne plus pouvoir faire une rep propre.'],
  ['serie_longue', 'Partielles', 'Échec puis demi-reps sans reposer la charge.'],
  ['drop', 'Drop set', 'Échec, charge baissée, puis à nouveau jusqu’à l’échec.'],
  ['rest_pause', 'Rest-pause', 'Échec, courte pause, puis quelques reps de plus.'],
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
  /** Exercice sauté aujourd'hui. */
  passe: boolean
  onAnnulerPasser: () => void
  /** Mode plein écran : sans « Machine prise » (reste sur l'écran normal). */
  focus?: boolean
}

/** Instant de la dernière validation (horloge monotone, insensible aux changements d'heure du
 * téléphone) : bloque un double appui avant même le rafraîchissement de l'écran. */
let derniereValidation = -Infinity

/** Objectif de la série `n` : « 60 kg × 10 · RPE 8 ». */
export function cibleSerie(exo: Exercice, plan: ExoPlan, sugg: Suggestion, n: number): string {
  const j = Math.min(n, sugg.charges.length - 1)
  const p = plan.series[Math.min(n, plan.series.length - 1)]
  return `${chargeTexte(exo, sugg.charges[j])} × ${sugg.reps[j] ?? p.repsMin} · RPE ${kg(p.rpe)}`
}

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
  passe,
  onAnnulerPasser,
  focus,
}: Props) {
  const faites = seance.series.filter((s) => s.exoId === exo.id)
  const total = passe ? faites.length : Math.max(faites.length, plan.series.length + (seance.ajustSeries[exo.id] ?? 0))
  const [editId, setEditId] = useState<string | null>(null)
  const [photo, setPhoto] = useState(false)
  const enEdition = faites.find((s) => s.id === editId)
  const index = enEdition ? faites.indexOf(enEdition) : faites.length
  const termine = !enEdition && faites.length >= total
  // Série à saisir maintenant (aucune quand l'exercice est fini ou seulement consulté).
  const enSaisie = termine || consultation ? -1 : faites.length

  const cible = (n: number) => cibleSerie(exo, plan, sugg, n)

  // Même série à la séance précédente (la plus proche si elle en avait moins).
  const avant = (n: number) => derniere?.[n]

  // Saisie collée sous la série concernée : celle en cours, ou une série faite qu'on corrige.
  const editeur = (
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
  )

  const ajuster = (delta: number) =>
    majSeance(seance.id, (s) => {
      s.ajustSeries[exo.id] = (s.ajustSeries[exo.id] ?? 0) + delta
    })

  return (
    <div className={'carte pile carte-exo' + (passe ? ' exo-passe' : '')}>
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
          {!focus && (
            <button className="btn petit" style={{ minHeight: 40, flex: '0 0 auto' }} onClick={onMachinePrise}>
              Machine prise
            </button>
          )}
        </div>
        <div className="faible">
          {plan.series.length} × {plan.series[0].repsMin === plan.series[0].repsMax ? plan.series[0].repsMin : `${plan.series[0].repsMin}–${plan.series[0].repsMax}`} · RPE{' '}
          {plan.series.map((p) => kg(p.rpe)).join(', ')} · repos {reposTexte(plan)}
          {plan.finisseur && <span style={{ color: 'var(--finisseur)' }}> · ★ {FINISSEURS[typeFinisseur(plan)].nom.toLowerCase()}</span>}
        </div>
      </div>

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

      <div>
        {plan.chauffes.map((c, i) => {
          const cle = `${exo.id}:${i}`
          const fait = !!seance.chauffes[cle]
          const l = lireChauffe(c)
          return (
            <button
              key={cle}
              className={'serie-chauffe' + (fait ? ' fait' : '')}
              onClick={() => {
                vibrer()
                void majSeance(seance.id, (x) => {
                  x.chauffes[cle] = !fait
                })
              }}
            >
              <span className="case">{fait ? '✓' : ''}</span>
              <span>
                <span className="faible">Échauffement {i + 1}</span> {l ? `${chargeTexte(exo, l.charge)} × ${l.reps}` : c}
              </span>
            </button>
          )
        })}
        {Array.from({ length: total }, (_, n) => {
          const s = faites[n]
          if (s) {
            const ligne = (
              <button key={s.id} className={'serie-faite' + (s.id === editId ? ' edition' : '')} onClick={() => setEditId(s.id === editId ? null : s.id)}>
                <span>
                  <span className="ok-texte">✓</span> <span className="faible">S{n + 1}</span> {serieTexte(exo, s)}
                  {avant(n) && <Ecart s={s} avant={avant(n)!} exo={exo} />}
                </span>
                <span className="faible">
                  {s.type === 'serie_longue' ? '★' : s.type !== 'normale' ? TYPES.find((t) => t[0] === s.type)?.[1] : ''}
                  {s.douleur ? ' ⚠️' : ''} ✎
                </span>
              </button>
            )
            return s.id === editId ? (
              <div key={s.id} className="serie-bloc">
                {ligne}
                {editeur}
              </div>
            ) : (
              ligne
            )
          }
          const ligne = (
            <div key={n} className={'serie-prevue ' + (n === enSaisie ? 'en-cours' : 'a-venir')}>
              <span>
                {n === enSaisie ? '▶' : '○'} <span className="faible">S{n + 1}</span> {cible(n)}
                {plan.finisseur && n === total - 1 ? ' ★' : ''}
                {avant(n) && <span className="avant">dernière fois : {serieTexte(exo, avant(n)!)}</span>}
              </span>
              <span className="faible">repos {chrono(reposApres(plan, n, total))}</span>
            </div>
          )
          return n === enSaisie && !enEdition ? (
            <div key={n} className="serie-bloc">
              {ligne}
              {editeur}
            </div>
          ) : (
            ligne
          )
        })}
      </div>

      {termine && (
        <div className="pile">
          <div className="ligne entre">
            {passe ? (
              <span className="pastille">⤼ Passé aujourd’hui{faites.length ? ` après ${faites.length} série${faites.length > 1 ? 's' : ''}` : ''}</span>
            ) : (
              <span className="pastille ok">✓ Exercice terminé</span>
            )}
            <button className="btn discret petit" onClick={() => (passe ? onAnnulerPasser() : (ajuster(+1), onFaireMaintenant()))}>
              {passe ? 'Le faire quand même' : '+ série'}
            </button>
          </div>
          <button className="btn primaire grand" onClick={onAllerEnCours}>
            {enCoursNom ? `Continuer : ${enCoursNom} →` : 'Terminer la séance'}
          </button>
        </div>
      )}
      {!termine && consultation && !enEdition && (
        <div className="consultation pile">
          <div className="petit">
            👀 <strong>Consultation.</strong>{' '}
            <span className="muted">
              L’exercice en cours est <strong>{enCoursNom}</strong>.
            </span>
          </div>
          <button className="btn primaire grand" onClick={onAllerEnCours}>
            ↩ Revenir à {enCoursNom}
          </button>
          <button className="btn plein" onClick={onFaireMaintenant}>
            Faire cet exercice maintenant
          </button>
        </div>
      )}

      {!termine && !enEdition && (
        <div className="ligne entre">
          <button className="btn discret petit" onClick={() => ajuster(+1)}>
            + série
          </button>
          {total > faites.length && (
            <button className="btn discret petit" onClick={() => ajuster(-1)}>
              − retirer une série
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

export function Ecart({ s, avant, exo }: { s: Serie; avant: Serie; exo: Exercice }) {
  const e = ecartSerie(s, avant)!
  return (
    <span className={'avant ' + e.sens}>
      {e.sens === 'mieux' ? '↑' : e.sens === 'egal' ? '=' : '↓'} {e.texte} <span className="faible">(avant {serieTexte(exo, avant)})</span>
    </span>
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

export function Editeur({ seance, plan, exo, sugg, index, total, faites, edition, reposRestant, verrou, onFini, onAnnulerEdition }: EditeurProps) {
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
  const zone: ZoneDemiReps = edition?.zone ?? plan.zone ?? 'etiree'
  const [suite, setSuite] = useState<{ charge: number; reps: number }[]>(edition?.suite ?? [])
  const tf = typeFinisseur(plan)
  const info = FINISSEURS[tf]
  const [aideRpe, setAideRpe] = useState(false)
  const pasBoutons = usePasBoutons()

  // Pendant le repos, la validation reste possible mais passe au second plan.
  const enRepos = !edition && reposRestant > 0
  const pas = pasBoutons(exo)
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
      if (performance.now() - derniereValidation < 1500) return
      derniereValidation = performance.now()
    }
    vibrer(40)
    // Nouvelle série : le repos démarre et le bouton se verrouille dès l'appui, sans attendre
    // l'écriture (parfois lente sur téléphone) qui laissait le bouton actif.
    if (!edition) onFini(s)
    try {
      const n = await majSeance(seance.id, (x) => {
        const k = x.series.findIndex((y) => y.id === s.id)
        if (k >= 0) x.series[k] = s
        else x.series.push(s)
      })
      if (n === 0) throw new Error('séance introuvable')
    } catch (e) {
      derniereValidation = -Infinity
      alert(`La série n’a pas été enregistrée : ${(e as Error).message}\n(version ${__VERSION__})`)
      return
    }
    if (edition) onFini(s)
  }

  const supprimer = async () => {
    if (!edition) return
    await majSeance(seance.id, (x) => {
      x.series = x.series.filter((y) => y.id !== edition.id)
    })
    onAnnulerEdition()
  }

  const ouvrirPanneau = () => {
    // Drop set : ~25 % de moins, arrondi au pas ; rest-pause : même charge, deux mini-séries.
    if (tf === 'drop') setSuite([{ charge: Math.max(0, Math.round((charge * 0.75) / exo.pas) * exo.pas), reps: 6 }])
    if (tf === 'rest_pause') setSuite([{ charge, reps: 4 }, { charge, reps: 2 }])
    setPanneau(true)
  }
  const majSuite = (k: number, champ: 'charge' | 'reps', v: number) => setSuite((x) => x.map((y, j) => (j === k ? { ...y, [champ]: Math.max(0, arr(v)) } : y)))

  if (panneau) {
    return (
      <div className="pile">
        <div className="bandeau-fin">
          ★ {info.nom} · {tf === 'partielles' ? 'enchaîne sans reposer la charge' : tf === 'drop' ? 'baisse la charge et repars, sans repos' : 'pose la charge 15 s, puis repars'}
        </div>
        {tf === 'partielles' && (
          <>
            <div className="stepper">
              <button onClick={() => setDemi(Math.max(0, demi - 1))}>−</button>
              <div className="valeur">
                <input inputMode="numeric" value={demi} onChange={(e) => setDemi(parseInt(e.target.value) || 0)} />
                <span className="unite">demi-reps (5–8), zone {ZONES.find((z) => z[0] === zone)?.[1]}</span>
              </div>
              <button onClick={() => setDemi(demi + 1)}>+</button>
            </div>
          </>
        )}
        {suite.map((x, k) => (
          <div key={k} className="pile" style={{ gap: 6 }}>
            <div className="faible">{tf === 'drop' ? 'Après la baisse' : `Après la pause ${k + 1}`}</div>
            {tf === 'drop' && (
              <div className="stepper">
                <button onClick={() => majSuite(k, 'charge', x.charge - pas)}>−</button>
                <div className="valeur">
                  <strong>{kg(x.charge)}</strong>
                  <span className="unite">{unite}</span>
                </div>
                <button onClick={() => majSuite(k, 'charge', x.charge + pas)}>+</button>
              </div>
            )}
            <div className="stepper">
              <button onClick={() => majSuite(k, 'reps', x.reps - 1)}>−</button>
              <div className="valeur">
                <strong>{x.reps}</strong>
                <span className="unite">reps</span>
              </div>
              <button onClick={() => majSuite(k, 'reps', x.reps + 1)}>+</button>
            </div>
          </div>
        ))}
        <button
          className="btn finisseur grand"
          onClick={() => enregistrer(construire(info.typeSerie, tf === 'partielles' ? { demiReps: demi, zone } : { suite, rpe: 10 }))}
        >
          VALIDER LE FINISSEUR
        </button>
        <button className="btn plein" onClick={() => enregistrer(construire('echec'))}>
          Je me suis arrêté à l’échec
        </button>
        <div className="faible">Stoppe si douleur articulaire (une brûlure musculaire, c’est normal).</div>
      </div>
    )
  }

  return (
    <div className="pile">
      <div className="ligne entre">
        {edition && <h3>Modifier la série {index + 1}</h3>}
        <span className="faible">
          fourchette {p.repsMin === p.repsMax ? p.repsMin : `${p.repsMin}–${p.repsMax}`} reps · RPE {kg(p.rpe)}
        </span>
      </div>

      {finisseur && (
        <div className="bandeau-fin">
          ★ FINISSEUR · {info.nom} : {info.court}
        </div>
      )}

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
        <button className={'btn grand' + (enRepos ? '' : ' finisseur')} onClick={() => (tf === 'echec' ? enregistrer(construire('echec')) : ouvrirPanneau())}>
          {tf === 'echec' ? 'VALIDER (ÉCHEC)' : 'ÉCHEC ATTEINT'}
          {enRepos ? ` · repos ${chrono(reposRestant)}` : ''}
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
          {options ? '▾' : '▸'} Autre type de série, douleur
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
        <div className="pile options-serie">
          <div>
            <div className="petit" style={{ marginBottom: 6 }}>
              <strong>Type de série</strong> <span className="muted">— à changer seulement si ce n’était pas une série classique</span>
            </div>
            <div className="chips">
              {TYPES.map(([t, nom]) => (
                <button
                  key={t}
                  className={type === t ? 'actif' : ''}
                  onClick={() => {
                    setType(t)
                    if (t !== 'normale') setRpe(10)
                  }}
                >
                  {nom}
                </button>
              ))}
            </div>
            <div className="faible" style={{ marginTop: 4 }}>
              {TYPES.find((t) => t[0] === type)?.[2]}
            </div>
          </div>
          {type === 'serie_longue' && (
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
          )}
          <div>
            <div className="petit" style={{ marginBottom: 6 }}>
              <strong>Douleur articulaire ?</strong>{' '}
              <span className="muted">— notée dans l’historique pour la surveiller. Une brûlure musculaire est normale : ne la signale pas.</span>
            </div>
            <div className="chips">
              <button className={douleur ? 'actif' : ''} onClick={() => setDouleur(!douleur)}>
                ⚠️ {douleur ? 'Douleur signalée' : 'Signaler une douleur'}
              </button>
            </div>
            {douleur && <div className="faible">Allège ou passe l’exercice. Si elle persiste, consulte.</div>}
          </div>
        </div>
      )}
    </div>
  )
}
