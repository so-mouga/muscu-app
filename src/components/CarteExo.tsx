import { Check, ChevronRight, Info, Lightbulb, Pencil, Sparkles, Timer, TriangleAlert, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { db, uid } from '../db'
import { chargeDecalee, chargeQte, chargeTexte, enTemps, fourchette, kg, RIR } from '../lib/calc'
import { FINISSEURS, typeFinisseur, ZONES } from '../lib/finisseur'
import { useRetour } from '../lib/nav'
import ChronoTenue from './ChronoTenue'
import { PuceDisques } from './CalculateurDisques'
import ReglagesMachine from './ReglagesMachine'
import { vibrer } from '../lib/appareil'
import { monterMaintenant, type Suggestion } from '../lib/progression'
import type { Exercice, ExoPlan, Seance, Serie, TypeSerie, ZoneDemiReps } from '../types'
import { confirmer, informer } from './Dialogues'

const TYPES: [TypeSerie, string, string][] = [
  ['normale', 'Normale', 'Série classique, arrêtée avant l’échec.'],
  ['echec', 'Échec', 'Poussée jusqu’à ne plus pouvoir faire une rep propre.'],
  ['serie_longue', 'Partielles', 'Échec puis demi-reps sans reposer la charge.'],
  ['drop', 'Drop set', 'Échec, charge baissée, puis à nouveau jusqu’à l’échec.'],
  ['rest_pause', 'Rest-pause', 'Échec, courte pause, puis quelques reps de plus.'],
]
// Entiers seulement : un demi-point de RPE ne se ressent pas de façon fiable, et 5 gros boutons se touchent mieux.
const RPES = [6, 7, 8, 9, 10]

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

/** Objectif de la série `n` : « 60 kg × 10 · effort 8/10 ». Avec `faites`, la charge suit l'écart pris aux séries d'avant. */
export function cibleSerie(exo: Exercice, plan: ExoPlan, sugg: Suggestion, n: number, faites?: Serie[]): string {
  const j = Math.min(n, sugg.charges.length - 1)
  const p = plan.series[Math.min(n, plan.series.length - 1)]
  // Charge encore inconnue (machine jamais faite, rien de saisi avant) : « à calibrer », pas « 0 kg ».
  const charge = faites && !(sugg.charges[j] === null && !faites[n - 1]) ? chargeProposee(exo, sugg, faites, n) : sugg.charges[j]
  const total = plan.series.length
  if (plan.finisseur && n === total - 1) {
    const chargeTxt = charge !== null ? (charge > 0 ? `${kg(charge)} kg` : '') : 'à calibrer'
    return chargeTxt ? `${chargeTxt} · jusqu’à l’échec` : 'jusqu’à l’échec'
  }
  return `${chargeQte(exo, charge, sugg.reps[j] ?? p.repsMin)} · effort ${kg(p.rpe)}/10`
}

export function majSeance(id: string, fn: (s: Seance) => void) {
  return db.seances.where('id').equals(id).modify(fn)
}

export function Photo({ src, titre, onFermer }: { src: string; titre: string; onFermer: () => void }) {
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
  /** Dans une fenêtre : reçoit de quoi la fermer en gardant la correction (appui à côté, retour). */
  fermeture?: { current: (() => void) | null }
}

interface Brouillon {
  exoId: string
  index: number
  charge: number
  reps: number
  rpe: number
  type: TypeSerie
  douleur: boolean
  aRegler: boolean
}

function lireBrouillon(cle: string | null, exoId: string, index: number): Brouillon | null {
  if (!cle) return null
  try {
    const b = JSON.parse(localStorage.getItem(cle) ?? 'null') as Brouillon | null
    return b && b.exoId === exoId && b.index === index ? b : null
  } catch {
    return null
  }
}

function oublierBrouillon(cle: string) {
  try {
    localStorage.removeItem(cle)
  } catch {
    /* stockage indisponible */
  }
}

export function Editeur({ seance, plan, exo, sugg, index, total, faites, edition, reposRestant, verrou, onFini, onAnnulerEdition, compact = false, heure, fermeture }: EditeurProps) {
  const p = plan.series[Math.min(index, plan.series.length - 1)]
  const i = Math.min(index, sugg.charges.length - 1)
  const finisseur = !edition && plan.finisseur && index === total - 1

  // Charge proposée : la suggestion, décalée du même écart que l'utilisateur a appliqué à la série précédente.
  const chargeInitiale = () => chargeProposee(exo, sugg, faites, index)

  // Plein écran : ce qui a été réglé sans valider revient après un passage par la liste ou une appli fermée.
  const cleBrouillon = !edition && compact && !heure ? `brouillon:${seance.id}` : null
  const [brouillon] = useState(() => lireBrouillon(cleBrouillon, exo.id, index))
  const [charge, setCharge] = useState(edition?.charge ?? brouillon?.charge ?? chargeInitiale())
  const [chargeTxt, setChargeTxt] = useState<string | null>(null)
  const [reps, setReps] = useState(edition?.reps ?? brouillon?.reps ?? sugg.reps[i] ?? p.repsMin)
  const [rpe, setRpe] = useState(edition?.rpe ?? brouillon?.rpe ?? (finisseur ? 10 : Math.round(p.rpe)))
  const [type, setType] = useState<TypeSerie>(edition?.type ?? brouillon?.type ?? (finisseur ? 'echec' : 'normale'))
  const [douleur, setDouleur] = useState(edition?.douleur ?? brouillon?.douleur ?? false)
  // Charge jamais connue : champ vide, à remplir, plutôt qu'un « 0 » qu'on validerait sans s'en rendre compte.
  const [aRegler, setARegler] = useState(() => brouillon?.aRegler ?? (!edition && !enTemps(exo) && exo.mode !== 'poids_corps' && exo.mode !== 'elastique' && sugg.charges[i] === null && !faites[index - 1]))
  const premierRendu = useRef(true)
  useEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false
      return
    }
    if (!cleBrouillon) return
    try {
      localStorage.setItem(cleBrouillon, JSON.stringify({ exoId: exo.id, index, charge, reps, rpe, type, douleur, aRegler }))
    } catch {
      /* stockage indisponible */
    }
  }, [cleBrouillon, exo.id, index, charge, reps, rpe, type, douleur, aRegler])
  const [options, setOptions] = useState(false)
  const [panneau, setPanneau] = useState(false)
  const [demi, setDemi] = useState(edition?.demiReps ?? 6)
  const zone: ZoneDemiReps = edition?.zone ?? plan.zone ?? 'etiree'
  const [suite, setSuite] = useState<{ charge: number; reps: number }[]>(edition?.suite ?? [])
  const tf = typeFinisseur(plan)
  const info = FINISSEURS[tf]
  const [aideRpe, setAideRpe] = useState(false)
  useRetour(options, () => setOptions(false))
  useRetour(aideRpe, () => setAideRpe(false))
  // Exercice en temps : « reps » = secondes, par pas de 5 s, et un chrono pour les mesurer.
  const temps = enTemps(exo)
  const pasQte = temps ? 5 : 1
  const [chronoOuvert, setChronoOuvert] = useState(false)
  const [saisieManuelle, setSaisieManuelle] = useState(false)
  const [reglerPalier, setReglerPalier] = useState(false)

  // Pendant le repos, la validation reste possible mais passe au second plan.
  const enRepos = !edition && reposRestant > 0
  // Les −/+ suivent le palier de la machine (fiche de l'exercice) : pas de charge qui n'existe pas.
  const pas = exo.pas
  const unite = exo.assistance ? 'kg d’assistance' : exo.mode === 'elastique' ? 'niveau' : exo.mode === 'poids_corps' ? 'kg de lest (− = assistance)' : exo.mode === 'par_main' ? 'kg par main' : 'kg'
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
    // Corriger un drop set ou un rest-pause garde ses mini-séries.
    ...(edition?.suite && { suite: edition.suite }),
    ...extra,
  })

  // Garde-fous : au moins 1 rep, et une confirmation si la charge dépasse de loin la cible (faute de frappe).
  const reference = Math.max(0, ...sugg.charges.map((c) => c ?? 0), ...faites.map((x) => x.charge))
  const chargeSuspecte = (c: number) => (reference > 0 ? c > reference * 1.5 && c - reference >= 20 : c > 300)

  const enregistrer = async (s: Serie) => {
    if ((s.reps <= 0 || aRegler) && !edition) return
    if (
      chargeSuspecte(s.charge) &&
      !(await confirmer(`C’est bien plus que d’habitude (${chargeTexte(exo, reference)}). Faute de frappe ?`, { titre: `Valider ${chargeTexte(exo, s.charge)} ?`, oui: 'Valider quand même', non: 'Corriger' }))
    )
      return
    if (!edition) {
      if (performance.now() - derniereValidation < 1500) return
      derniereValidation = performance.now()
      if (cleBrouillon) oublierBrouillon(cleBrouillon)
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

  // Fermer la fenêtre (appui à côté, retour) garde la correction, comme partout ; rien de changé : on ferme.
  const serieAffichee = () => construire(type, type === 'serie_longue' ? { demiReps: demi, zone } : { demiReps: undefined, zone: undefined })
  const modifiee = !!edition && (charge !== edition.charge || reps !== edition.reps || rpe !== edition.rpe || type !== edition.type || douleur !== !!edition.douleur || (type === 'serie_longue' && demi !== edition.demiReps))
  if (fermeture) fermeture.current = () => (modifiee && reps > 0 ? void enregistrer(serieAffichee()) : onAnnulerEdition())

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
          <Sparkles size={16} className="ico-texte" /> {info.nom} · {tf === 'partielles' ? 'enchaîne sans reposer la charge' : tf === 'drop' ? 'baisse la charge et repars, sans repos' : 'pose la charge 15 s, puis repars'}
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
        {/* Plein écran : côte à côte, pour que « Valider » et « échec » restent à l'écran. */}
        <div className={compact && tf === 'rest_pause' ? 'steppers-duo' : 'pile'}>
          {suite.map((x, k) => (
            <div key={k} className="pile" style={{ gap: 6 }}>
              <div className="faible">{tf === 'drop' ? 'Après la baisse' : `Après la pause ${k + 1}`}</div>
              <div className={compact && tf === 'drop' ? 'steppers-duo' : 'pile'}>
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
            </div>
          ))}
        </div>
        <button
          className="btn finisseur grand"
          onClick={() => enregistrer(construire(info.typeSerie, tf === 'partielles' ? { demiReps: demi, zone } : { suite, rpe: 10 }))}
        >
          Valider le finisseur
        </button>
        <button className="btn plein" onClick={() => enregistrer(construire('echec'))}>
          Je me suis arrêté à l’échec
        </button>
        <div className="faible panneau-prudence">Stoppe si douleur articulaire (une brûlure musculaire, c’est normal).</div>
      </div>
    )
  }

  // Charge et reps : l'un sous l'autre, ou côte à côte en plein écran (compact) pour tout voir sans défiler.
  const stepperCharge = (
    <div className="stepper">
      <button onClick={() => !aRegler && (setCharge(chargeDecalee(exo, charge, -pas)), setChargeTxt(null))}>−</button>
      <div className="valeur">
        <input
          inputMode="decimal"
          placeholder="—"
          value={chargeTxt ?? (aRegler ? '' : kg(charge))}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            setChargeTxt(e.target.value)
            const v = parseFloat(e.target.value.replace(',', '.'))
            if (!isNaN(v)) (setCharge(v), setARegler(false))
          }}
          onBlur={() => setChargeTxt(null)}
        />
        {exo.mode === 'elastique' ? (
          <span className="unite">{unite}</span>
        ) : (
          // Le palier se corrige devant la machine : c'est là qu'on le connaît.
          <button type="button" className="unite unite-palier" onClick={() => setReglerPalier(!reglerPalier)} aria-label={`Palier de la machine : ${kg(pas)} kg, modifier`}>
            {compact && exo.mode === 'poids_corps' ? 'kg de lest' : unite} · ±{kg(pas)} <Pencil size={12} />
          </button>
        )}
      </div>
      <button onClick={() => (setCharge(chargeDecalee(exo, charge, pas)), setChargeTxt(null), setARegler(false))}>+</button>
    </div>
  )
  const stepperReps = (
    <div className="stepper">
      <button onClick={() => setReps(Math.max(0, reps - pasQte))}>−</button>
      <div className="valeur">
        <input inputMode="numeric" value={reps} onFocus={(e) => e.target.select()} onChange={(e) => setReps(parseInt(e.target.value) || 0)} />
        <span className="unite">{temps ? 'secondes tenues' : 'reps'}</span>
      </div>
      <button onClick={() => setReps(reps + pasQte)}>+</button>
    </div>
  )

  // L'intitulé passe au-dessus des boutons en saisie compacte : on voit tout de suite à quoi ils servent.
  // Toujours sur une ligne : choisir un effort ne doit rien décaler.
  const plusDur = rpe > p.rpe + 0.5
  const ligneEffort = (
    <div className={'ligne entre faible ligne-effort' + (compact ? ' une-ligne' : '')}>
      <span className="texte-effort">
        {compact ? <strong>Effort </strong> : 'Effort '}{kg(rpe)}/10 ·{' '}
        {compact && plusDur ? (
          <span style={{ color: 'var(--alerte)' }}>plus dur que prévu ({kg(p.rpe)})</span>
        ) : (
          <>
            {RIR[Math.floor(rpe)] ?? ''}
            {compact && rpe !== p.rpe && <span> · visé {kg(p.rpe)}</span>}
            {!compact && plusDur && <span style={{ color: 'var(--alerte)' }}> · plus dur que prévu</span>}
          </>
        )}
      </span>
      <button className="btn-infos" aria-label="aide RPE" onClick={() => setAideRpe(true)}>
        <Info size={20} />
      </button>
    </div>
  )

  return (
    <div className={'pile' + (compact ? ' editeur-compact' : '')}>
      {!compact && (
        <div className="ligne entre">
          {edition && <h3>Modifier la série {index + 1}</h3>}
          <span className="faible">
            {finisseur && !edition ? (
              'Finisseur · jusqu’à l’échec'
            ) : (
              <>
                fourchette {fourchette(exo, p.repsMin, p.repsMax)}
                {enTemps(exo) ? '' : ' reps'} · effort {kg(p.rpe)}/10
              </>
            )}
          </span>
        </div>
      )}

      {finisseur && (
        <div className="bandeau-fin">
          <Sparkles size={16} className="ico-texte" /> Finisseur · {info.nom} : {info.court}
        </div>
      )}

      {temps && !edition && !saisieManuelle ? (
        <div className="pile" style={{ alignItems: 'center', margin: '4px 0 8px' }}>
          {(charge > 0 || exo.mode !== 'poids_corps') && (
            <div style={{ width: '100%', marginBottom: 6 }}>
              {stepperCharge}
            </div>
          )}
          <button
            type="button"
            className="btn primaire grand"
            style={{ width: '100%', fontSize: 'var(--t-texte)', minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            onClick={() => setChronoOuvert(true)}
          >
            <Timer size={20} />
            <span>Lancer le chrono ({sugg.reps[i] ?? p.repsMax} s)</span>
          </button>
          <button
            type="button"
            className="btn discret petit lien-action"
            style={{ marginTop: 4, color: 'var(--texte-3)', fontSize: 'var(--t-petit)' }}
            onClick={() => setSaisieManuelle(true)}
          >
            <Pencil size={14} /> Saisie manuelle ({reps} s)
          </button>
        </div>
      ) : (
        <>
          {compact ? (
            <div className="steppers-duo">
              {stepperCharge}
              {stepperReps}
            </div>
          ) : (
            <>
              {stepperCharge}
              {stepperReps}
            </>
          )}
          {temps && !edition && (
            <div style={{ textAlign: 'center', marginTop: 2, marginBottom: 4 }}>
              <button
                type="button"
                className="btn discret petit lien-action"
                style={{ color: 'var(--accent)', fontSize: 'var(--t-petit)' }}
                onClick={() => setSaisieManuelle(false)}
              >
                <Timer size={16} /> Utiliser le chronomètre interactif
              </button>
            </div>
          )}
        </>
      )}
      {reglerPalier && <ReglagesMachine exo={exo} onFermer={() => setReglerPalier(false)} />}
      <div className="ligne-disques">
        <PuceDisques exo={exo} charge={charge} unite={unite} />
      </div>
      {/* Série d'avant bien au-dessus de la fourchette : proposer un cran de plus, sans rien imposer. */}
      {!edition &&
        (() => {
          const prec = faites[index - 1]
          const c = monterMaintenant(exo, plan, prec, index)
          if (c === null || (exo.assistance ? charge <= c : charge >= c)) return null
          return (
            <div className="conseil-surcharge discret">
              <span className="faible">
                <Lightbulb size={14} className="ico-texte" /> {prec.reps} reps, bien au-dessus de {plan.series[Math.min(index - 1, plan.series.length - 1)].repsMax} : tu peux monter d’un cran.
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

      {chronoOuvert && (
        <ChronoTenue
          objectif={sugg.reps[i] ?? p.repsMax}
          nom={exo.nom}
          onAnnuler={() => setChronoOuvert(false)}
          onStop={(sec) => {
            setChronoOuvert(false)
            if (sec > 0) {
              setReps(sec)
              void enregistrer(construire(type, { reps: sec }))
            }
          }}
        />
      )}

      {!finisseur && (
        <div className="zone-effort">
          {compact && ligneEffort}
          <div className="rpe" style={{ gridTemplateColumns: `repeat(${RPES.length}, 1fr)` }}>
            {RPES.map((r) => (
              <button
                key={r}
                className={(rpe === r ? 'actif ' : '') + (Math.round(p.rpe) === r ? 'cible' : '')}
                onClick={() => setRpe(r)}
                onContextMenu={(e) => (e.preventDefault(), setAideRpe(true))}
              >
                {r}
              </button>
            ))}
          </div>
          {!compact && ligneEffort}
        </div>
      )}

      <div className="zone-valider">
      {verrou && !edition ? (
        <button className="btn grand" disabled style={{ opacity: 1, color: 'var(--ok)' }}>
          <Check size={22} /> Série enregistrée
        </button>
      ) : finisseur ? (
        <button className={'btn grand' + (enRepos ? '' : ' finisseur')} disabled={aRegler} onClick={() => (tf === 'echec' ? enregistrer(construire('echec')) : ouvrirPanneau())}>
          {tf === 'echec' ? 'Valider (échec)' : 'Échec atteint'}
        </button>
      ) : temps && !edition && !saisieManuelle ? null : (
        <button
          className={'btn grand' + (enRepos ? '' : ' primaire')}
          disabled={reps <= 0 || aRegler}
          onClick={() => enregistrer(serieAffichee())}
        >
          {aRegler ? 'Indique la charge' : reps <= 0 ? (temps ? 'Indique le temps tenu' : 'Indique au moins 1 rep') : edition ? 'Mettre à jour' : 'Valider la série'}
        </button>
      )}
      </div>

      <div className="ligne entre ligne-options">
        <button className="btn discret petit" onClick={() => setOptions(!options)}>
          Type de série, douleur
          {(type !== 'normale' || douleur) && (
            <span style={{ color: 'var(--alerte)' }}>
              · {[type !== 'normale' ? TYPES.find((t) => t[0] === type)?.[1] : null, douleur ? 'douleur signalée' : null].filter(Boolean).join(', ')}
            </span>
          )}
          <ChevronRight size={16} />
        </button>
        {edition && !compact && (
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

      {edition && compact && (
        <div className="ligne entre ligne-correction">
          <button className="btn discret petit danger" onClick={supprimer}>
            Supprimer la série
          </button>
          <button className="btn discret petit" onClick={onAnnulerEdition}>
            Annuler
          </button>
        </div>
      )}

      {options &&
        createPortal(
          <div className="modal-fond" onClick={() => setOptions(false)}>
            <div className="modal pile" onClick={(e) => e.stopPropagation()}>
              <div className="ligne entre">
                <h2>Type de série, douleur</h2>
                <button className="btn-fermer" aria-label="Fermer" onClick={() => setOptions(false)}>
                  <X size={22} />
                </button>
              </div>
          <div className="sous-carte bloc-option">
            <div className="petit" style={{ marginBottom: 8 }}>
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
          <div className="sous-carte bloc-option">
            <div className="petit" style={{ marginBottom: 8 }}>
              <strong>Douleur articulaire ?</strong>{' '}
              <span className="muted">— notée dans l’historique pour la surveiller. Une brûlure musculaire est normale : ne la signale pas.</span>
            </div>
            <div className="chips">
              <button className={douleur ? 'actif' : ''} onClick={() => setDouleur(!douleur)}>
                <TriangleAlert size={16} className="ico-texte" /> {douleur ? 'Douleur signalée' : 'Signaler une douleur'}
              </button>
            </div>
            {douleur && <div className="faible">Allège ou passe l’exercice. Si elle persiste, consulte.</div>}
          </div>
            </div>
          </div>,
          document.body
        )}
      {aideRpe &&
        createPortal(
          <div className="modal-fond" onClick={() => setAideRpe(false)}>
            <div className="modal pile" onClick={(e) => e.stopPropagation()}>
              <div className="ligne entre">
                <h2>Effort (RPE)</h2>
                <button className="btn-fermer" aria-label="Fermer" onClick={() => setAideRpe(false)}>
                  <X size={22} />
                </button>
              </div>
              <table className="note-rpe">
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
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
