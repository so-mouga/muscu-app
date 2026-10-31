import { useState } from 'react'
import { db, uid } from '../db'
import { chargeQte, chargeTexte, chrono, cibleTexte, ecartSerie, enTemps, fourchette, kg, lireChauffe, reposApres, reposTexte, RIR, schemaPlan, serieTexte } from '../lib/calc'
import { FINISSEURS, typeFinisseur, ZONES } from '../lib/finisseur'
import { useRetour } from '../lib/nav'
import { usePasBoutons } from '../lib/pasBoutons'
import ChronoTenue from './ChronoTenue'
import InfosExo, { BoutonInfos } from './InfosExo'
import Vignette from './Vignette'
import { vibrer } from '../lib/appareil'
import { hausse, monterMaintenant, type Suggestion } from '../lib/progression'
import type { Exercice, ExoPlan, Seance, Serie, TypeSerie, ZoneDemiReps } from '../types'
import { confirmer, informer } from './Dialogues'

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
  /** Exercice jamais fait : dernière perf d'un équivalent relié, pour s'orienter. */
  repere?: string
  /** Régler l'objectif sur place (absent quand l'exercice n'a pas d'historique). */
  onObjectif?: () => void
  /** Note laissée sur cet exercice à une séance précédente (réglage machine, sensation…). */
  noteAvant?: string
  /** Semaines sans progrès (voir `lib/blocages`), 0 sinon. */
  bloque?: number
}

/** Instant de la dernière validation (horloge monotone, insensible aux changements d'heure du
 * téléphone) : bloque un double appui avant même le rafraîchissement de l'écran. */
let derniereValidation = -Infinity

/**
 * Charge pré-remplie pour la série `index` : la cible, décalée du même écart que celui appliqué à la
 * série précédente (monté de 10 kg en S1 → S2 aussi). Sans cible : la charge de la série d'avant.
 */
export function chargeProposee(exo: Exercice, sugg: Suggestion, faites: Serie[], index: number): number {
  const i = Math.min(index, sugg.charges.length - 1)
  const prec = faites[index - 1]
  const s = sugg.charges[i]
  if (s === null) return prec?.charge ?? (exo.mode === 'elastique' ? 1 : 0)
  const sPrec = sugg.charges[Math.min(index - 1, sugg.charges.length - 1)]
  return prec && sPrec !== null && index > 0 ? Math.max(0, s + (prec.charge - sPrec)) : s
}

/** Objectif de la série `n` : « 60 kg × 10 · RPE 8 ». Avec `faites`, la charge suit l'écart pris aux séries d'avant. */
export function cibleSerie(exo: Exercice, plan: ExoPlan, sugg: Suggestion, n: number, faites?: Serie[]): string {
  const j = Math.min(n, sugg.charges.length - 1)
  const p = plan.series[Math.min(n, plan.series.length - 1)]
  // Charge encore inconnue (machine jamais faite, rien de saisi avant) : « à calibrer », pas « 0 kg ».
  const charge = faites && !(sugg.charges[j] === null && !faites[n - 1]) ? chargeProposee(exo, sugg, faites, n) : sugg.charges[j]
  return `${chargeQte(exo, charge, sugg.reps[j] ?? p.repsMin)} · RPE ${kg(p.rpe)}`
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
  repere,
  onObjectif,
  noteAvant,
  bloque = 0,
}: Props) {
  const faites = seance.series.filter((s) => s.exoId === exo.id)
  const total = passe ? faites.length : Math.max(faites.length, plan.series.length + (seance.ajustSeries[exo.id] ?? 0))
  const [editId, setEditId] = useState<string | null>(null)
  const [photo, setPhoto] = useState(false)
  const [infos, setInfos] = useState(false)
  // Moins d'informations entre deux séries : échauffements repliés une fois l'exercice commencé, note sur demande.
  const [voirChauffes, setVoirChauffes] = useState(false)
  const [voirNote, setVoirNote] = useState(!!seance.notes[exo.id])
  const enEdition = faites.find((s) => s.id === editId)
  const index = enEdition ? faites.indexOf(enEdition) : faites.length
  const termine = !enEdition && faites.length >= total
  // Série à saisir maintenant (aucune quand l'exercice est fini ou seulement consulté).
  const enSaisie = termine || consultation ? -1 : faites.length

  const cible = (n: number) => cibleSerie(exo, plan, sugg, n)

  // Même série à la séance précédente (la plus proche si elle en avait moins).
  const avant = (n: number) => derniere?.[n]
  // Ce que l'objectif demande de plus que la dernière fois (« +2,5 kg ») : là où il faut se surpasser.
  const plus = (n: number) => hausse(exo, sugg, derniere, n)
  const battre = sugg.charges.some((_, n) => plus(n) !== null)

  // Saisie collée sous la série concernée : celle en cours, ou une série faite qu'on corrige.
  const editeur = (
    <Editeur
      key={`${exo.id}-${index}-${editId ?? ''}-${sugg.charges.join()}-${sugg.reps.join()}`}
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
          <BoutonInfos onClick={() => setInfos(true)} />
          <button className="btn petit" style={{ minHeight: 40, flex: '0 0 auto' }} onClick={onMachinePrise}>
            Machine prise
          </button>
        </div>
        <div className="faible">
          {schemaPlan(exo, plan)} · RPE{' '}
          {plan.series.map((p) => kg(p.rpe)).join(', ')} · repos {reposTexte(plan)}
          {plan.finisseur && <span style={{ color: 'var(--finisseur)' }}> · ★ {FINISSEURS[typeFinisseur(plan)].nom.toLowerCase()}</span>}
        </div>
      </div>

      {/* Exercice seulement consulté : on le dit tout de suite, avec de quoi le faire maintenant. */}
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
      <div className={'suggestion petit' + (battre ? ' a-battre' : '')}>
        <div className="ligne entre" style={{ alignItems: 'flex-start' }}>
          <strong>
            Cible : {cibleTexte(exo, sugg.charges, sugg.reps)}
          </strong>
          {battre ? (
            <span className="badge-hausse">🔥 À battre</span>
          ) : (
            onObjectif && (
              <button className="btn discret petit lien-action" onClick={onObjectif}>
                ✎ Modifier
              </button>
            )
          )}
        </div>
        <div className="muted">
          {battre
            ? 'Tu as prévu de faire mieux que la dernière fois : c’est ici qu’on progresse.'
            : bloque >= 3
              ? `⏸ Pas de progrès depuis ${bloque} semaines : tente +1 rep ou un cran de charge${onObjectif ? ' (✎ Modifier)' : ''}, et regarde ton sommeil et tes repas.`
              : sugg.message}
        </div>
        {battre && onObjectif && (
          <button className="btn discret petit lien-action" onClick={onObjectif}>
            ✎ Modifier l’objectif
          </button>
        )}
      </div>
      {repere && (
        <div className="faible">
          📌 Repère, sur l’équivalent : <strong>{repere}</strong>. Les charges ne se comparent pas d’une machine à l’autre : ajuste au ressenti.
        </div>
      )}
      {(plan.note || exo.notes) && <div className="faible">ℹ️ {plan.note ?? exo.notes}</div>}
      {noteAvant && !seance.notes[exo.id] && <div className="faible">📝 La dernière fois : {noteAvant}</div>}

      <div>
        {plan.chauffes.length > 0 && faites.length > 0 && !voirChauffes && (
          <button className="chauffes-repliees" onClick={() => setVoirChauffes(true)}>
            Échauffement {plan.chauffes.every((_, i) => seance.chauffes[`${exo.id}:${i}`]) ? '✓ ' : ''}
            {plan.chauffes.filter((_, i) => seance.chauffes[`${exo.id}:${i}`]).length}/{plan.chauffes.length} ›
          </button>
        )}
        {(faites.length === 0 || voirChauffes) && plan.chauffes.map((c, i) => {
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
                {plus(n) && <span className="badge-hausse">↑ {plus(n)}</span>}
                {avant(n) && <span className="avant">dernière fois : {serieTexte(exo, avant(n)!)}</span>}
              </span>
              <span className="faible" style={{ whiteSpace: 'nowrap' }}>
                repos {chrono(reposApres(plan, n, total))}
              </span>
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

      {!termine && !enEdition && (
        <div className="ligne ajuster-series">
          <button className="btn" onClick={() => ajuster(+1)}>
            + Ajouter une série
          </button>
          {total > faites.length && (
            <button className="btn" onClick={() => ajuster(-1)}>
              − Retirer une série
            </button>
          )}
        </div>
      )}

      {infos && <InfosExo exo={exo} onFermer={() => setInfos(false)} />}
      {photo && exo.image && <Photo src={exo.image} titre={exo.nom} onFermer={() => setPhoto(false)} />}

      {voirNote ? (
        <textarea
          rows={2}
          autoFocus={!seance.notes[exo.id]}
          placeholder="Note (réglage machine, sensation, douleur…)"
          defaultValue={seance.notes[exo.id] ?? ''}
          onBlur={(e) => {
            const v = e.target.value
            void majSeance(seance.id, (s) => {
              s.notes[exo.id] = v
            })
          }}
        />
      ) : (
        <button className="btn discret petit" style={{ alignSelf: 'flex-start' }} onClick={() => setVoirNote(true)}>
          📝 Ajouter une note
        </button>
      )}
    </div>
  )
}

export function Ecart({ s, avant, exo }: { s: Serie; avant: Serie; exo: Exercice }) {
  const e = ecartSerie(s, avant, exo)!
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
  /** Plein écran : sans la ligne de fourchette (la cible est déjà affichée au-dessus). */
  compact?: boolean
  /** Heure d'une série ajoutée après coup (séance passée), au lieu de maintenant. */
  heure?: number
}

export function Editeur({ seance, plan, exo, sugg, index, total, faites, edition, reposRestant, verrou, onFini, onAnnulerEdition, compact = false, heure }: EditeurProps) {
  const p = plan.series[Math.min(index, plan.series.length - 1)]
  const i = Math.min(index, sugg.charges.length - 1)
  const finisseur = !edition && plan.finisseur && index === total - 1

  // Charge proposée : la suggestion, décalée du même écart que l'utilisateur a appliqué à la série précédente.
  const chargeInitiale = () => chargeProposee(exo, sugg, faites, index)

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
  // Exercice en temps : « reps » = secondes, par pas de 5 s, et un chrono pour les mesurer.
  const temps = enTemps(exo)
  const pasQte = temps ? 5 : 1
  const [chronoOuvert, setChronoOuvert] = useState(false)
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
    heure: edition?.heure ?? heure ?? Date.now(),
    ...extra,
  })

  // Garde-fous : au moins 1 rep, et une confirmation si la charge dépasse de loin la cible (faute de frappe).
  const reference = Math.max(0, ...sugg.charges.map((c) => c ?? 0), ...faites.map((x) => x.charge))
  const chargeSuspecte = (c: number) => (reference > 0 ? c > reference * 1.5 && c - reference >= 20 : c > 300)

  const enregistrer = async (s: Serie) => {
    if (s.reps <= 0 && !edition) return
    if (
      chargeSuspecte(s.charge) &&
      !(await confirmer(`C’est bien plus que d’habitude (${chargeTexte(exo, reference)}). Faute de frappe ?`, { titre: `Valider ${chargeTexte(exo, s.charge)} ?`, oui: 'Valider quand même', non: 'Corriger' }))
    )
      return
    if (!edition) {
      if (performance.now() - derniereValidation < 1500) return
      derniereValidation = performance.now()
    }
    // Nouvelle série : le signal (son, vibration) est donné par la séance, qui sait si c'est mieux ou la fin de l'exercice.
    if (edition) vibrer(40)
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
      void informer(`${(e as Error).message}\n(version ${__VERSION__})`, 'La série n’a pas été enregistrée')
      return
    }
    if (edition) onFini(s)
  }

  const supprimer = async () => {
    if (!edition || !(await confirmer(`Supprimer la série ${index + 1} ?`, { oui: 'Supprimer la série', danger: true }))) return
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
      {(!compact || edition) && (
        <div className="ligne entre">
          {edition && <h3>Modifier la série {index + 1}</h3>}
          <span className="faible">
            fourchette {fourchette(exo, p.repsMin, p.repsMax)}
            {enTemps(exo) ? '' : ' reps'} · RPE {kg(p.rpe)}
          </span>
        </div>
      )}

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
      {/* Série d'avant bien au-dessus de la fourchette : proposer un cran de plus, sans rien imposer. */}
      {!edition &&
        (() => {
          const prec = faites[index - 1]
          const c = monterMaintenant(exo, plan, prec, index)
          if (c === null || charge >= c) return null
          return (
            <div className="conseil-surcharge discret">
              <span className="faible">
                💡 {prec.reps} reps, bien au-dessus de {plan.series[Math.min(index - 1, plan.series.length - 1)].repsMax} : tu peux monter d’un cran.
              </span>
              <button className="btn petit" onClick={() => (setCharge(c), setChargeTxt(null))}>
                {chargeTexte(exo, c)}
              </button>
            </div>
          )
        })()}
      {/* Charge décalée comme à la série précédente : on le dit, pour ne pas croire à une erreur. */}
      {!edition && sugg.charges[i] !== null && sugg.charges[i] !== undefined && charge === chargeInitiale() && charge !== sugg.charges[i] && (
        <div className="faible" style={{ marginTop: -4 }}>
          Charge reprise de ta série {index} (cible : {chargeTexte(exo, sugg.charges[i])})
        </div>
      )}

      {temps && !edition && (
        <button className="btn grand chrono-btn" onClick={() => setChronoOuvert(true)}>
          ▶ CHRONO · {sugg.reps[i] ?? p.repsMax} s
        </button>
      )}
      <div className="stepper">
        <button onClick={() => setReps(Math.max(0, reps - pasQte))}>−</button>
        <div className="valeur">
          <input inputMode="numeric" value={reps} onFocus={(e) => e.target.select()} onChange={(e) => setReps(parseInt(e.target.value) || 0)} />
          <span className="unite">{temps ? 'secondes tenues' : 'reps'}</span>
        </div>
        <button onClick={() => setReps(reps + pasQte)}>+</button>
      </div>
      {chronoOuvert && (
        <ChronoTenue
          objectif={sugg.reps[i] ?? p.repsMax}
          nom={exo.nom}
          onAnnuler={() => setChronoOuvert(false)}
          onStop={(sec) => {
            setReps(sec)
            setChronoOuvert(false)
          }}
        />
      )}

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
            <button className="btn discret petit lien-action" onClick={() => setAideRpe(!aideRpe)}>
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
        </button>
      ) : (
        <button
          className={'btn grand' + (enRepos ? '' : ' primaire')}
          disabled={reps <= 0}
          onClick={() => enregistrer(construire(type, type === 'serie_longue' ? { demiReps: demi, zone } : { demiReps: undefined, zone: undefined }))}
        >
          {reps <= 0 ? (temps ? 'INDIQUE LE TEMPS TENU' : 'INDIQUE AU MOINS 1 REP') : edition ? 'METTRE À JOUR' : 'VALIDER LA SÉRIE'}
        </button>
      )}

      <div className="ligne entre">
        <button className="btn discret petit" onClick={() => setOptions(!options)}>
          {options ? '▾' : '▸'} Type de série, douleur
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
