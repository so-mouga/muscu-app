import { createPortal } from 'react-dom'
import { ArrowLeftRight, Check, ChevronDown, ChevronRight, Flame, Frown, Info, Link2, Minus, Pencil, Play, Plus, Repeat, Share2, SkipForward, Smile, Square, StickyNote, Sparkles, Timer, TrendingUp, TriangleAlert, Trophy, Unlink, Wind, X, type LucideIcon } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { Catalogue } from '../catalogue'
import BoutonRetour from '../components/BoutonRetour'
import Anneau from '../components/Anneau'
import { cibleSerie, Editeur, majSeance, Photo } from '../components/CarteExo'
import ChoixExo from '../components/ChoixExo'
import { ObjectifApres } from '../components/EditeurObjectif'
import InfosExo, { BoutonInfos } from '../components/InfosExo'
import Interrupteur from '../components/Interrupteur'
import PartageSeance from '../components/PartageSeance'
import ProchaineFois from '../components/ProchaineFois'
import Vignette from '../components/Vignette'
import Minuteur, { BIPS_DEFAUT, reposOublie, resteRepos, type EtatMinuteur } from '../components/Minuteur'
import { ResumeSeance } from '../components/RecapSeance'
import { resumeSeance } from '../lib/motivation'
import { db, exoAvecReglages, historiqueDe, uid } from '../db'
import { debloquerSon, ecranAllume, signalSerie } from '../lib/appareil'
import { recordDuJour } from '../lib/historique'
import { cranDuJour, cransDeSeance, etatDisque, pourquoiCran, seuilCran, texteCran, totalCrans } from '../lib/crans'
import Disque, { IconeCran } from '../components/Disque'
import { verrou } from '../lib/verrou'
import { chargeQte, chargeTexte, chauffeTropLourde, texteChauffe, chrono, cibleTexte, dateCourte, dateISO, ecartSerie, kg, minutes, qte, reposApres, reposTexte, schemaPlan, seanceOubliee, serieTexte } from '../lib/calc'
import { transition, useRetour } from '../lib/nav'
import { lireEquivalents, modifierEquivalents, relies, repere } from '../lib/equivalents'
import { suggestionDeload } from '../lib/cycle'
import { arreterSeanceNatif, natif, pauseNatif, reposNatif, seanceNatif, suivreNatif } from '../lib/natif'
import { hausse, suggestionPour, type Suggestion } from '../lib/progression'
import { blocage } from '../lib/blocages'
import { reposParDefaut } from '../lib/programme'
import { alterneEncore, delier, echangerExos, estDansSuperset, groupeSuperset, prochainExoDeSeance, remplacerEnCours, reposApresSuperset, suivantDansGroupe } from '../lib/superset'
import { phaseA } from '../lib/objectifs'
import type { Exercice, ExoPlan, Objectif, Reglage, Seance, Serie } from '../types'
import { chargeBaisse, consigne, FINISSEURS, typeFinisseur } from '../lib/finisseur'
import AvantFinisseur from '../components/AvantFinisseur'
import { remplacesDe, textePlace } from '../lib/partageSeance'
import { planParDefaut } from './Seances'
import { confirmer } from '../components/Dialogues'
import Echauffement, { echauffementActif } from '../components/Echauffement'
import { dureeEchauffement } from '../data/echauffements'
import Deplie from '../components/Deplie'

function stocke<T>(cle: string, defaut: T): T {
  try {
    const v = localStorage.getItem(cle)
    return v ? (JSON.parse(v) as T) : defaut
  } catch {
    return defaut
  }
}
/** Annonces de finisseur déjà montrées (`séance:exercice`) : ni revenir de la liste, ni rouvrir l'appli en pleine séance ne les rejoue. */
const annoncesVues = new Set<string>(
  (() => {
    try {
      return JSON.parse(localStorage.getItem('annoncesFinisseur') ?? '[]') as string[]
    } catch {
      return []
    }
  })()
)
/** Note l'annonce comme vue ; seules celles de la séance en cours sont gardées. */
function annonceVue(cle: string) {
  annoncesVues.add(cle)
  const seance = cle.split(':')[0]
  try {
    localStorage.setItem('annoncesFinisseur', JSON.stringify([...annoncesVues].filter((c) => c.startsWith(seance + ':'))))
  } catch {
    /* stockage indisponible */
  }
}

function range(cle: string, v: unknown) {
  try {
    if (v === null) localStorage.removeItem(cle)
    else localStorage.setItem(cle, JSON.stringify(v))
  } catch {
    /* stockage indisponible */
  }
}

/**
 * Séance annulée ou supprimée : effacée, et on revient à l'écran d'où on l'avait lancée (l'Accueil
 * relit `retourSeance`). Après un enregistrement, on revient simplement à l'accueil.
 */
async function annulerSeance(seanceId: string) {
  await db.seances.delete(seanceId)
  oublierEtatLocal(seanceId, true)
}

/** À la réouverture d'une séance oubliée : l'enregistrer telle quelle (ou l'annuler si rien n'a été fait), ou la continuer. */
function SeanceOubliee({ seance, onContinuer, onEnregistrer, onAnnuler }: { seance: Seance; onContinuer: () => void; onEnregistrer: () => void; onAnnuler: () => void }) {
  useRetour(true, onContinuer)
  const n = seance.series.length
  const hier = dateISO(new Date(Date.now() - 86400000))
  const quand = seance.date === hier ? 'd’hier' : seance.date === dateISO() ? '' : `du ${dateCourte(seance.date)}`
  const derniere = n ? new Date(Math.max(...seance.series.map((x) => x.heure))).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''
  return createPortal(
    <div className="modal-fond" onClick={onContinuer}>
      <div className="modal pile" onClick={(e) => e.stopPropagation()}>
        <h2>Ta séance {quand} est restée ouverte</h2>
        <div className="faible">{n ? `${seance.nom} : ${n} série${n > 1 ? 's' : ''}, la dernière à ${derniere}.` : `${seance.nom} : aucune série validée.`}</div>
        <button className="btn primaire grand" onClick={n ? onEnregistrer : onAnnuler}>
          {n ? 'Enregistrer' : 'Annuler cette séance'}
        </button>
        <button className="btn grand" onClick={onContinuer}>
          Continuer la séance
        </button>
      </div>
    </div>,
    document.body
  )
}

/** Fenêtre du retour quand des séries sont déjà faites : continuer (le plus probable), terminer, supprimer. */
function SortieSeance({ series, onContinuer, onTerminer, onSupprimer }: { series: number; onContinuer: () => void; onTerminer: () => void; onSupprimer: () => void }) {
  useRetour(true, onContinuer)
  return createPortal(
    <div className="modal-fond" onClick={onContinuer}>
      <div className="modal pile" onClick={(e) => e.stopPropagation()}>
        <h2>Séance commencée</h2>
        <div className="faible">
          {series} série{series > 1 ? 's' : ''} déjà faite{series > 1 ? 's' : ''}.
        </div>
        <button className="btn primaire grand" onClick={onContinuer}>
          Continuer la séance
        </button>
        <button className="btn grand" onClick={onTerminer}>
          Terminer et enregistrer
        </button>
        <button className="btn discret danger plein" onClick={onSupprimer}>
          Supprimer la séance
        </button>
      </div>
    </div>,
    document.body
  )
}

/** Minuteur et exercice affiché d'une séance terminée ou abandonnée. */
function oublierEtatLocal(seanceId: string, garderOrigine = false) {
  if (!garderOrigine) range('retourSeance', null)
  range('minuteur', null)
  void arreterSeanceNatif()
  range(`idx:${seanceId}`, null)
  range(`brouillon:${seanceId}`, null)
}

type Choix = { mode: 'ajouter' } | { mode: 'remplacer'; i: number }

/** Heure courante, rafraîchie à intervalle régulier. */
function useHorloge(ms: number) {
  const [t, setT] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setT(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return t
}

function chronoSeance(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(t / 3600)
  const m = String(Math.floor((t % 3600) / 60)).padStart(h ? 2 : 1, '0')
  const sec = String(t % 60).padStart(2, '0')
  return h ? `${h}:${m}:${sec}` : `${m}:${sec}`
}

export default function SeanceEnCours({ seance, catalogue }: { seance: Seance; catalogue: Catalogue }) {
  // Référence pour la progression : séances terminées, hors déloads (allégées, elles fausseraient la suite).
  const terminees = useLiveQuery(() => db.seances.orderBy('debut').reverse().filter((s) => !s.enCours && !s.deload).toArray(), [])
  const reglages = useLiveQuery(() => db.reglages.toArray(), [])
  const [idxBrut, setIdxEtat] = useState<number>(() => stocke(`idx:${seance.id}`, 0))
  const [minuteur, setMinuteurEtat] = useState<EtatMinuteur | null>(() => {
    const m = stocke<EtatMinuteur | null>('minuteur', null)
    return m?.seanceId === seance.id && !reposOublie(m, Date.now()) ? m : null
  })
  const [toast, setToast] = useState<string | null>(null)
  // Mode plein écran : il le reste d'un repos à l'autre tant qu'on ne le réduit pas.
  // Plein écran par défaut : un nouveau découvre le grand chrono dès sa 1re série ; son choix est ensuite gardé.
  // Chaque séance démarre en plein écran (on y saisit tout sans défiler) ; la vue liste sert à regarder, à un appui.
  // Séance libre : rien à saisir au départ, on commence par la liste, là où on ajoute ses exercices.
  const [focus, setFocusEtat] = useState(seance.exercices.length > 0)
  const setFocus = (v: boolean) => (transition(() => setFocusEtat(v), 'fondu'), window.scrollTo({ top: 0 }))
  /** Plein écran pendant le repos : afficher quand même la saisie. */
  const [saisie, setSaisie] = useState(false)
  /** Plein écran : série en cours de correction. */
  const [corrige, setCorrige] = useState<string | null>(null)
  const [seriesDe, setSeriesDe] = useState<number | null>(null)
  const reglageSon = useLiveQuery(() => db.reglages.get('sonValidation'), [])
  const sonValidation = reglageSon?.valeur !== false
  // L'annonce d'un finisseur (deux secondes avant la dernière série) : une fois par exercice et par séance, coupable dans Réglages.
  const reglageAnnonce = useLiveQuery(() => db.reglages.get('annonceFinisseur'), [])
  const [, setAnnonceVue] = useState(0)
  /** Fiche d'exécution ouverte depuis le plein écran. */
  const [infos, setInfos] = useState<string | null>(null)
  /** Objectif réglé sur place (index de l'exercice dans la séance). */
  const [objectifDe, setObjectifDe] = useState<number | null>(null)
  const [fin, setFin] = useState(false)
  const [choix, setChoix] = useState<Choix | null>(null)
  /** Machine prise : index de l'exercice concerné. */
  const [machineDe, setMachineDe] = useState<number | null>(null)
  /** Vue liste : exercice déplié (un seul à la fois). */
  const [ouvert, setOuvert] = useState<number | null>(null)
  const [verrou, setVerrou] = useState(false)
  const [oubliee, setOubliee] = useState(() => seanceOubliee(seance, Date.now()))
  const maintenant = useHorloge(1000)
  const derniereTouche = useRef(0)
  const repriseAuto = useRef<((finRepos: number) => void) | null>(null)
  const reposTraite = useRef<number | null>(null)

  const plans = seance.exercices
  // Échauffement passé sans rien cocher : plus de ligne dans la liste, il n'y a rien à revoir.
  const avecEchauffement = !!seance.echauffement?.ids.length && !(seance.echauffement.fini && !seance.echauffement.faits.length)
  const idx = idxBrut === -1 && avecEchauffement ? -1 : Math.max(0, Math.min(idxBrut, plans.length - 1))
  const surEchauffement = idx === -1 || echauffementActif(seance)

  // Quand l'échauffement se termine (tout coché, « Passer », 1re série), aller au 1er exercice. Une fois
  // fini, on peut toujours y revenir par sa ligne dans la liste : seul le passage actif → fini fait avancer.
  const echauffementAvant = useRef(echauffementActif(seance))
  useEffect(() => {
    const actif = echauffementActif(seance)
    if (echauffementAvant.current && !actif && idxBrut === -1) {
      setIdxEtat(0)
      range(`idx:${seance.id}`, 0)
    }
    echauffementAvant.current = actif
  }, [idxBrut, seance])

  const setIdx = (i: number) => {
    if (i === idx && !(i >= 0 && surEchauffement)) return
    if (i >= 0 && echauffementActif(seance)) {
      void majSeance(seance.id, (s) => {
        if (s.echauffement) s.echauffement.fini = true
      })
    }
    transition(() => setIdxEtat(i), i > idx ? 'carte-avant' : 'carte-arriere')
    range(`idx:${seance.id}`, i)
    window.scrollTo({ top: 0 })
  }
  // Navigation faite par l'utilisateur (plein écran ↔ liste, Continuer, Faire maintenant) :
  // gardée dans l'ordre pour que le retour la défasse. Les déplacements automatiques n'y entrent pas.
  const pileNav = useRef<{ idx: number; focus: boolean }[]>([])
  const naviguer = (fn: () => void) => {
    pileNav.current = [...pileNav.current.slice(-49), { idx, focus }]
    fn()
  }
  const setMinuteur = (m: EtatMinuteur | null) => {
    const avecSeance = m && { ...m, seanceId: seance.id }
    setMinuteurEtat(avecSeance)
    range('minuteur', avecSeance)
  }

  // Appli Android : la séance est aussi tenue par Android, notification du début à la fin (chrono de
  // séance, décompte du repos ou pause), boutons sur l'écran verrouillé, alarme écran éteint.
  const ensuiteRef = useRef('')
  const minuteurRef = useRef({ minuteur, setMinuteur })
  minuteurRef.current = { minuteur, setMinuteur }
  useEffect(() => {
    if (!natif) return
    const bipsReglage = reglages?.find((r) => r.cle === 'bipsRepos')?.valeur
    const bips = typeof bipsReglage === 'number' ? bipsReglage : BIPS_DEFAUT
    const c = { nom: seance.nom, debut: seance.debut, texte: ensuiteRef.current ? `Ensuite : ${ensuiteRef.current}` : '' }
    if (minuteur && minuteur.pause !== undefined) void pauseNatif(c, minuteur.pause)
    else if (minuteur && minuteur.fin > Date.now()) void reposNatif(c, minuteur.fin, bips)
    else void seanceNatif(c)
  }, [minuteur?.fin, minuteur?.pause, seance.series.length, seance.nom, reglages, ensuiteRef.current])
  // Ce qui a été choisi depuis la notification (Pause, Reprendre, +30 s, Passer) : l'appli suit.
  useEffect(
    () =>
      suivreNatif((e) => {
        const { minuteur: m, setMinuteur: maj } = minuteurRef.current
        if (!m) return
        if (e.mode === 'pause') m.pause !== e.reste && maj({ ...m, pause: e.reste })
        else if (e.mode === 'repos') (e.fin !== m.fin || m.pause !== undefined) && maj({ ...m, fin: e.fin, pause: undefined })
        // Repos passé depuis la notification (pas seulement fini tout seul : l'appli affiche alors « Repos terminé »).
        else if (e.mode === 'seance' && (m.pause !== undefined || m.fin > Date.now())) maj(null)
      }),
    []
  )
  const ouvrirFin = (v: boolean) => (transition(() => setFin(v), v ? 'avant' : 'arriere'), window.scrollTo({ top: 0 }))

  // Retour Android : fin → séance, puis exercice précédent. Ne quitte jamais une séance en cours.
  // Retour Android : les fenêtres se ferment d'abord (chacune a son propre retour), Fin de séance revient
  // à la séance, puis on défait la dernière navigation (exercice, plein écran ↔ liste). À l'écran de
  // départ : aucune série validée → séance annulée, retour d'où on l'a lancée ; sinon on demande.
  const [sortie, setSortie] = useState(false)
  useRetour(true, () => {
    if (fin) {
      ouvrirFin(false)
      return 'rester'
    }
    // Dernière navigation qui a vraiment changé l'écran.
    let e = pileNav.current.pop()
    while (e && e.idx === idx && e.focus === focus) e = pileNav.current.pop()
    if (e) {
      if (e.focus !== focus) setFocus(e.focus)
      if (e.idx !== idx) setIdx(e.idx)
    } else if (seance.series.length === 0) void annulerSeance(seance.id)
    else setSortie(true)
    return 'rester'
  })

  // Retour Android dans la liste : un exercice déplié se replie d'abord.
  useRetour(!focus && !fin && ouvert !== null, () => setOuvert(null))

  useEffect(() => {
    ecranAllume(true)
    return () => ecranAllume(false)
  }, [])

  // Dernier geste hors minuteur : sert à savoir si l'utilisateur regarde autre chose pendant le repos.
  useEffect(() => {
    const noter = (e: Event) => {
      if (!(e.target instanceof Element && e.target.closest('.minuteur'))) derniereTouche.current = Date.now()
    }
    window.addEventListener('pointerdown', noter, true)
    window.addEventListener('keydown', noter, true)
    return () => {
      window.removeEventListener('pointerdown', noter, true)
      window.removeEventListener('keydown', noter, true)
    }
  }, [])

  const finRepos = minuteur && minuteur.pause === undefined && minuteur.fin <= maintenant ? minuteur.fin : null
  useEffect(() => {
    if (finRepos === null || reposTraite.current === finRepos) return
    reposTraite.current = finRepos
    repriseAuto.current?.(finRepos)
  }, [finRepos])

  // Série écrite en base : la saisie de la suivante peut s'ouvrir.
  useEffect(() => setVerrou(false), [seance.series.length])

  // Nouveau repos : le plein écran revient sur le minuteur.
  useEffect(() => {
    setSaisie(false)
    setCorrige(null)
  }, [minuteur?.debut])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  // Plein écran : tant que tout tient, pas de geste vertical, sinon Android étire la page sous le doigt.
  const ecranFocus = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ecranFocus.current
    if (el) el.classList.toggle('tient', el.scrollHeight <= el.clientHeight)
  })

  const exos = useMemo(
    () => (reglages ? plans.map((p) => exoAvecReglages(catalogue.exo(p.exoId), reglages)) : []),
    [plans, reglages, catalogue]
  )
  const suggestions = useMemo(() => {
    // `exos` n'est prêt qu'avec les réglages : ils peuvent arriver après les séances.
    if (!terminees || !reglages) return [] as Suggestion[]
    return plans.map((p, i) => {
      const sugg = suggestionPour(exos[i], p, terminees)
      return seance.deload ? suggestionDeload(exos[i], sugg) : sugg
    })
  }, [terminees, reglages, exos, plans, seance.deload])

  // Repos fini depuis longtemps (séance oubliée, longue coupure) : plus de « +898:00 ».
  useEffect(() => {
    if (minuteur && reposOublie(minuteur, maintenant)) setMinuteur(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maintenant])

  if (!terminees || !reglages) return null

  const equivalents = lireEquivalents(reglages)
  /** Dernière note laissée sur cet exercice (réglage machine, sensation), pour la retrouver. */
  const noteAvant = (exoId: string) => terminees.find((s) => s.notes[exoId]?.trim())?.notes[exoId]
  /** Exercice jamais fait : la dernière perf d'un équivalent relié (séance du jour comprise). */
  const repereDe = (exoId: string) => {
    if (historiqueDe(terminees, exoId).length) return undefined
    const r = repere(exoId, equivalents, [seance, ...terminees], (id) => !!catalogue.exo(id).assistance)
    if (!r) return undefined
    const ref = catalogue.exo(r.exoId)
    return `${ref.nom}, ${chargeQte(ref, r.charge, r.reps)}, effort ${kg(r.rpe)}/10 (${r.date})`
  }

  /** Cette série gagne le cran de son exercice : elle bat le record, et aucune série d'avant ne l'avait fait aujourd'hui. Jamais en séance allégée. */
  const gagneCran = (s: Serie) => {
    if (seance.deload) return false
    const exo = exoAvecReglages(catalogue.exo(s.exoId), reglages)
    const histo = historiqueDe(terminees, s.exoId)
    const deja = seance.series.filter((x) => x.exoId === s.exoId)
    return !recordDuJour(exo, histo, deja) && !!recordDuJour(exo, histo, [...deja, s])
  }
  /** Le cran gagné sur un exercice aujourd'hui, avec la série qui l'a gagné. */
  const cranDe = (exoId: string) => (seance.deload ? null : cranDuJour(exoAvecReglages(catalogue.exo(exoId), reglages), historiqueDe(terminees, exoId), seance.series.filter((x) => x.exoId === exoId)))

  const valider = (s: Serie, repos: number) => {
    debloquerSon()
    // Signal : mieux que la même série la dernière fois, ou fin de l'exercice (on change de machine).
    {
      const k = seance.series.filter((x) => x.exoId === s.exoId).length
      const i = plans.findIndex((p) => p.exoId === s.exoId)
      const avantSerie = seance.deload ? undefined : historiqueDe(terminees, s.exoId)[0]?.[k]
      const fini = i >= 0 && k + 1 >= totalDe(i)
      signalSerie(fini ? 'finExercice' : gagneCran(s) ? 'cran' : avantSerie && ecartSerie(s, avantSerie, exos[i])?.sens === 'mieux' ? 'mieux' : 'normale', sonValidation)
    }
    // Verrou levé quand la série est écrite (voir plus haut), au pire après 8 s.
    setVerrou(true)
    setTimeout(() => setVerrou(false), 8000)
    // Toute dernière série de la séance : plus rien à attendre, l'écran propose de terminer.
    if (repos > 0 && restantes > 1) {
      setMinuteur({ debut: Date.now(), fin: Date.now() + repos * 1000, duree: repos })
    } else {
      setMinuteur(null)
    }
    // Navigation / enchaînement superset : toast et bascule sur l'exercice suivant
    const curIdx = plans.findIndex((p) => p.exoId === s.exoId)
    if (curIdx >= 0 && plans[curIdx]?.enchaine && curIdx < plans.length - 1) {
      // Sans repos, l'écran change d'un coup : on le dit. Avec un repos, « Prochaine série » suffit.
      if (repos === 0 && nbFaites(plans[curIdx + 1].exoId) < totalDe(curIdx + 1)) setToast(`Enchaîne : ${exos[curIdx + 1].nom}`)
      if (idx === curIdx) setIdx(curIdx + 1)
    }
    // Cran gagné : en plein écran avec un repos, le cercle le dit ; sinon un message en haut.
    if (gagneCran(s) && !(focus && repos > 0 && restantes > 1)) setToast('Record battu · +1 cran')
  }

  const choisir = async (exoId: string, cree?: Parameters<typeof planParDefaut>[0]) => {
    const c = choix
    setChoix(null)
    const exo = cree ?? catalogue.exo(exoId)
    if (c?.mode === 'remplacer') {
      // Le substitut garde son propre historique ; sans historique, il est « à calibrer ».
      const ancien = plans[c.i]
      const faites = nbFaites(ancien.exoId)
      const chargeAncien = ancien.charge ?? seance.series.filter((s) => s.exoId === ancien.exoId).pop()?.charge ?? suggestions[c.i]?.charges[0] ?? null
      const histoNouveau = terminees ? historiqueDe(terminees, exoId) : []
      const chargeSubstitut = histoNouveau.length > 0 && histoNouveau[0][0]?.charge ? histoNouveau[0][0].charge : chargeAncien
      const nomAncien = catalogue.exo(ancien.exoId).nom
      const noteSubstitut = chargeAncien ? `Tu étais à ${kg(chargeAncien)} kg sur ${nomAncien}` : undefined
      const substitut = { ...ancien, exoId, charge: chargeSubstitut, chauffes: [], finisseur: ancien.finisseur && exo.type === 'isolation', note: noteSubstitut }
      await majSeance(seance.id, (s) => {
        s.ordrePrevu ??= s.exercices.map((p) => p.exoId)
        s.remplacements = [...(s.remplacements ?? []), { a: ancien.exoId, b: exoId }]
      })
      if (faites === 0) {
        await majSeance(seance.id, (s) => {
          s.exercices[c.i] = substitut
        })
      } else {
        // En cours de route : les séries faites restent sur l'original, les restantes passent au substitut.
        await majSeance(seance.id, (s) => remplacerEnCours(s, c.i, substitut, faites))
        transition(() => setIdxEtat(c.i + 1), 'carte-avant')
        range(`idx:${seance.id}`, c.i + 1)
      }
      setToast(`${nomAncien} → ${exo.nom}${chargeAncien ? ` (${kg(chargeAncien)} kg)` : ''}`)
      if (!(equivalents[ancien.exoId] ?? []).includes(exoId))
        await majSeance(seance.id, (s) => {
          s.aRelier = [...(s.aRelier ?? []), { a: ancien.exoId, b: exoId }]
        })
    } else {
      await majSeance(seance.id, (s) => {
        s.exercices.push(planParDefaut(exo))
      })
      transition(() => setIdxEtat(plans.length), 'carte-avant')
      range(`idx:${seance.id}`, plans.length)
    }
  }

  /** Machine prise : un autre exercice prend sa place, celui-ci se fera à la place de l'autre. */
  const echanger = async (i: number, j: number) => {
    setMachineDe(null)
    await majSeance(seance.id, (s) => {
      s.ordrePrevu ??= s.exercices.map((p) => p.exoId)
      s.exercices = echangerExos(s.exercices, i, j, (p) => reposParDefaut(catalogue.exo(p.exoId)))
      s.courant = s.exercices[i].exoId
    })
    setToast(`Échangé : ${exos[j].nom} maintenant`)
  }

  /** − / + série pendant le repos. Après la fin d'un exercice, « + série » y ramène tout de suite. */
  const ajusterSeries = (i: number, delta: number) => {
    const p = plans[i]
    return majSeance(seance.id, (s) => {
      const faites = s.series.filter((x) => x.exoId === p.exoId).length
      const total = Math.max(faites, p.series.length + (s.ajustSeries[p.exoId] ?? 0))
      s.ajustSeries[p.exoId] = total + delta - p.series.length
      if (delta > 0 && faites >= total) s.courant = p.exoId
    })
  }

  /** Changer d'ordre volontairement : cet exercice devient l'exercice en cours. */
  const faireMaintenant = async (i: number) => {
    await majSeance(seance.id, (s) => {
      s.courant = plans[i].exoId
    })
  }
  /** Depuis la liste : on passe en plein écran, là où se fait la saisie (i = -1 : l'échauffement). */
  const allerSaisir = (i: number) => {
    setOuvert(null)
    naviguer(() => (setIdx(i), setFocus(true)))
  }

  /** Passer : l'exercice reste dans la séance, grisé ; le modèle ne change pas. */
  const passer = async (i: number) => {
    setMachineDe(null)
    const id = plans[i].exoId
    await majSeance(seance.id, (s) => {
      s.passes = [...new Set([...(s.passes ?? []), id])]
      if (s.courant === id) s.courant = undefined
    })
    if (i < plans.length - 1) setIdx(i + 1)
    setToast(`${exos[i].nom} sauté pour aujourd’hui`)
  }
  const annulerPasser = async (i: number) => {
    const id = plans[i].exoId
    await majSeance(seance.id, (s) => {
      s.passes = (s.passes ?? []).filter((x) => x !== id)
      s.courant = id
    })
  }
  const estPasse = (i: number) => !!seance.passes?.includes(plans[i].exoId)

  const delierSuperset = async (i: number) => {
    setMachineDe(null)
    const g = groupeSuperset(plans, i)
    await majSeance(seance.id, (s) => {
      for (const k of g) {
        s.exercices[k] = delier(s.exercices[k], reposParDefaut(catalogue.exo(s.exercices[k].exoId)))
      }
    })
    setToast('Superset délié pour aujourd’hui')
  }

  const nbFaites = (exoId: string) => seance.series.filter((s) => s.exoId === exoId).length
  const totalDe = (i: number) => estPasse(i) ? nbFaites(plans[i].exoId) : Math.max(nbFaites(plans[i].exoId), plans[i].series.length + (seance.ajustSeries[plans[i].exoId] ?? 0))
  const derniereSerie = seance.series.reduce<Serie | null>((a, s) => (!a || s.heure > a.heure ? s : a), null)
  // Exercice en cours : gère l'alternance en superset ou premier exercice pas fini
  const enCours = prochainExoDeSeance({
    plans,
    nbFaites,
    totalDe,
    estPasse,
    derniereExoId: derniereSerie?.exoId,
    courantExoId: seance.courant,
  })
  // Avancement : séries faites sur le total prévu (un exercice passé ne compte que ses séries faites).
  const totalSeries = plans.reduce((a, _, i) => a + totalDe(i), 0)
  const seriesFaites = plans.reduce((a, p) => a + nbFaites(p.exoId), 0)
  const avancement = totalSeries ? seriesFaites / totalSeries : 0
  const restantes = totalSeries - seriesFaites
  const exosRestants = plans.filter((p, i) => nbFaites(p.exoId) < totalDe(i)).length
  // Temps restant : l'échauffement qui reste, ~1 min par série et le repos qui la suit (rien après la toute dernière).
  const derniereAFaire = plans.reduce((d, p, i) => (nbFaites(p.exoId) < totalDe(i) ? i : d), -1)
  const resteSec = plans.reduce((a, p, i) => {
    const t = totalDe(i)
    for (let k = nbFaites(p.exoId); k < t; k++) a += 60 + (i === derniereAFaire && k === t - 1 ? 0 : reposApres(p, k, t))
    return a
  }, echauffementActif(seance) ? dureeEchauffement(seance.echauffement!.ids.filter((id) => !seance.echauffement!.faits.includes(id))) : 0)

  const ensuite = enCours >= 0 ? `${exos[enCours]?.nom} · série ${nbFaites(plans[enCours].exoId) + 1}/${totalDe(enCours)}` : 'Fin de séance'
  ensuiteRef.current = ensuite
  const reposRestant = minuteur ? Math.max(0, Math.ceil(resteRepos(minuteur, maintenant))) : 0

  // Fin du repos : sans geste pendant le repos (téléphone posé), retour sur la série à faire.
  // Si l'utilisateur regardait autre chose, on ne le déplace pas : « Continuer » reste sur la liste.
  repriseAuto.current = (finR) => {
    if (!minuteur || fin || enCours < 0 || Date.now() - finR > 60000) return
    const debut = minuteur.debut ?? finR - minuteur.duree * 1000
    if (derniereTouche.current > debut + 500) return
    if (enCours !== idx) setIdx(enCours)
  }

  if (fin) return <FinSeance seance={seance} terminees={terminees} reglages={reglages} catalogue={catalogue} onRetour={() => ouvrirFin(false)} />

  // Mode plein écran : le repos en grand, puis la carte de l'exercice en cours pour saisir la série.
  const reposEnCours = !!minuteur && !(minuteur.pause === undefined && minuteur.fin <= maintenant)
  const vueRepos = reposEnCours && !saisie
  // Plein écran : la place de dire ce que sont les deux temps ; liste : forme courte, à côté de « Fin de séance ».
  const resumeAvancement = (enClair: boolean) => (
    <div className="ligne focus-avancement">
      <Anneau valeur={avancement} taille={46} label={`${Math.round(avancement * 100)} % de la séance fait`}>
        <span className="anneau-pct">{Math.round(avancement * 100)}%</span>
      </Anneau>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong>
          {exosRestants > 1 ? `Reste ${exosRestants} exercices` : exosRestants === 1 ? `Dernier exercice, ${restantes} série${restantes > 1 ? 's' : ''}` : plans.length ? (seance.passes?.length ? 'Plus rien à faire' : 'Tout est fait') : 'Rien pour l’instant'}
          {seance.deload && <span className="texte-finisseur"> · allégée</span>}
        </strong>
        <div className="faible ligne" style={{ gap: 'var(--e1)' }}>
          <Timer size={14} /> {chronoSeance(maintenant - seance.debut)}
          {enClair && ' de séance'}
          {resteSec > 0 && <> · ~{minutes(Math.max(1, Math.round(resteSec / 60)))}{enClair && ' restantes'}</>}
        </div>
      </div>
    </div>
  )
  const avancementCompact = (
    <div className="focus-haut">
      {resumeAvancement(true)}
      <div className="focus-boutons">
        {/* Pendant l'échauffement : on y reste (pas de saut vers un exercice, pas de « Machine prise »). */}
        <button className="btn petit" onClick={() => naviguer(() => (!echauffementActif(seance) && enCours >= 0 && setIdx(enCours), setFocus(false)))}>
          Voir la séance
        </button>
        {enCours >= 0 && !echauffementActif(seance) && restantes > 0 && (
          <button className="btn petit" onClick={() => setMachineDe(enCours)}>
            Machine prise
          </button>
        )}
        <button className="btn petit" onClick={() => ouvrirFin(true)}>
          Fin de séance
        </button>
      </div>
      {maintenant - seance.debut > 4 * 3600000 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 12px', background: 'var(--surface-2)', border: '1px solid var(--bord)', borderRadius: 'var(--rayon-2)', marginTop: 8 }}>
          <span className="faible" style={{ color: 'var(--texte)' }}><TriangleAlert size={14} className="ico-texte" /> Séance ouverte depuis plus de 4 h</span>
          <button className="btn primaire petit" onClick={() => ouvrirFin(true)}>
            Terminer
          </button>
        </div>
      )}
    </div>
  )

  const reposTexte = () => {
    if (!minuteur) return null
    const reste = resteRepos(minuteur, maintenant)
    return minuteur.pause !== undefined ? `Repos en pause · ${chrono(Math.ceil(reste))}` : reste > 0 ? `Repos ${chrono(Math.ceil(reste))}` : 'Repos terminé'
  }

  // Fenêtres communes à la vue normale et au plein écran (Machine prise, remplacement, lien d'équivalents).
  const fenetres = (
    <>
      {oubliee && (
        <SeanceOubliee
          seance={seance}
          onContinuer={() => setOubliee(false)}
          onAnnuler={() => void annulerSeance(seance.id)}
          onEnregistrer={() => {
            // Heure de la dernière série : la nuit ne compte pas dans la durée. « Comme aujourd'hui » pour la prochaine fois.
            void db.seances.update(seance.id, { enCours: false, fin: Math.max(...seance.series.map((x) => x.heure)) })
            oublierEtatLocal(seance.id)
          }}
        />
      )}
      {sortie && (
        <SortieSeance
          series={seance.series.length}
          onContinuer={() => setSortie(false)}
          onTerminer={() => (setSortie(false), ouvrirFin(true))}
          onSupprimer={async () => {
            if (await confirmer('Les séries déjà faites seront effacées.', { titre: 'Supprimer cette séance ?', oui: 'Supprimer la séance', non: 'Garder', danger: true })) void annulerSeance(seance.id)
          }}
        />
      )}
      {machineDe !== null && plans[machineDe] && (
        <MachinePrise
          nom={exos[machineDe].nom}
          entame={nbFaites(plans[machineDe].exoId) > 0}
          // Échanger ne vaut que pour l'exercice en cours : ailleurs, il ferait sauter sur un autre exercice.
          autres={plans
            .map((_, j) => j)
            .filter((j) => machineDe === enCours && j !== machineDe && !estPasse(j) && nbFaites(plans[j].exoId) < totalDe(j))
            .map((j) => ({ i: j, nom: exos[j].nom, entame: nbFaites(plans[j].exoId) > 0 }))}
          onEchanger={(j) => echanger(machineDe, j)}
          onRemplacer={() => (setMachineDe(null), setChoix({ mode: 'remplacer', i: machineDe }))}
          onPasser={() => passer(machineDe)}
          onDelierSuperset={estDansSuperset(plans, machineDe) ? () => delierSuperset(machineDe) : undefined}
          onFermer={() => setMachineDe(null)}
        />
      )}
      {seriesDe !== null && plans[seriesDe] && (
        <FenetreSeries
          seance={seance}
          plan={plans[seriesDe]}
          exo={exos[seriesDe]}
          total={totalDe(seriesDe)}
          cible={(k) => cibleSerie(exos[seriesDe], plans[seriesDe], suggestions[seriesDe], k, seance.series.filter((x) => x.exoId === plans[seriesDe].exoId), totalDe(seriesDe))}
          repos={reposTexte()}
          noteAvant={noteAvant(plans[seriesDe].exoId)}
          onAjuster={(d) => void ajusterSeries(seriesDe, d)}
          onRevenir={() =>
            void majSeance(seance.id, (x) => {
              delete x.ajustSeries[plans[seriesDe].exoId]
            })
          }
          onFermer={() => setSeriesDe(null)}
        />
      )}
      {choix && (
        <ChoixExo
          catalogue={catalogue}
          titre={choix.mode === 'remplacer' ? `Remplacer ${exos[choix.i].nom}` : 'Ajouter un exercice'}
          muscle={choix.mode === 'remplacer' ? exos[choix.i].muscle : undefined}
          equivalents={choix.mode === 'remplacer' ? equivalents[plans[choix.i].exoId] : undefined}
          exclure={plans.map((p) => p.exoId)}
          onChoix={choisir}
          onFermer={() => setChoix(null)}
        />
      )}
    </>
  )

  // Correction : une fenêtre par-dessus l'écran, le repos continue derrière.
  const correction = (() => {
    const serie = corrige ? seance.series.find((x) => x.id === corrige) : undefined
    const i = serie ? plans.findIndex((p) => p.exoId === serie.exoId) : -1
    if (!serie || i < 0) return null
    const repos = reposTexte()
    return (
      <FenetreCorrection
        key={serie.id}
        seance={seance}
        plan={plans[i]}
        exo={exos[i]}
        sugg={suggestions[i]}
        serie={serie}
        total={totalDe(i)}
        repos={repos}
        onFermer={() => setCorrige(null)}
      />
    )
  })()

  /** La consigne du finisseur de cet exercice, avec la charge de la baisse quand elle est connue. */
  const consigneDe = (i: number) => {
    const tf = typeFinisseur(plans[i])
    const c = suggestions[i].charges[Math.min(nbFaites(plans[i].exoId), suggestions[i].charges.length - 1)]
    return consigne(tf, tf === 'drop' && typeof c === 'number' && c > 0 ? chargeTexte(exos[i], chargeBaisse(c, exos[i].pas)) : undefined)
  }
  /** L'objectif fixé pour la série `n` : plus de reps que la dernière fois, à la même charge. Jamais en séance allégée. */
  const objectifSerie = (i: number, n: number) => {
    if (seance.deload) return undefined
    const d = historiqueDe(terminees, plans[i].exoId)[0]?.[n]
    const c = suggestions[i].charges[n]
    const r = suggestions[i].reps[n]
    return d && typeof c === 'number' && c === d.charge && typeof r === 'number' && r > d.reps ? { charge: c, reps: r, avant: d.reps } : undefined
  }

  if (focus) {
    const faitesParExo = () => Object.fromEntries(plans.map((x) => [x.exoId, nbFaites(x.exoId)]))
    /** Superset : badge et ce qui vient après la série à faire, pour remplacer la liste du groupe. */
    const enteteSuperset = (i: number) => {
      const groupe = groupeSuperset(plans, i)
      return (
        <span className="badge-superset">
          <Link2 size={14} /> Superset {groupe.indexOf(i) + 1}/{groupe.length}
        </span>
      )
    }
    const ensuiteSuperset = (i: number) => {
      const n = nbFaites(plans[i].exoId)
      const compte = faitesParExo()
      const repos = reposApresSuperset(plans, i, n, totalDe(i), compte, totalDe)
      const suivant = suivantDansGroupe(plans, i, compte, totalDe)
      const nom = suivant !== null && suivant !== i ? exos[suivant].nom : null
      // Le repos d'abord : si le nom est coupé sur un petit écran, l'essentiel reste lisible.
      const texte = restantes <= 1 ? 'Ensuite : fin de la séance' : repos === 0 ? (nom ? `Ensuite, sans repos : ${nom}` : 'Ensuite : sans repos') : suivant !== null && suivant > i ? `Ensuite, repos ${chrono(repos)} : ${nom}` : `Ensuite : repos ${chrono(repos)}`
      return <div className="petit ensuite-superset">{texte}</div>
    }
    // La série qu'on vient de faire : battue (on le fête), et de quel exercice (pour la corriger s'il est fini).
    // À l'instant : la fête ne se rejoue pas en revenant de la liste.
    const vient = !!derniereSerie && Date.now() - derniereSerie.heure < 1500
    const derniere = (() => {
      if (!derniereSerie) return null
      const i = plans.findIndex((p) => p.exoId === derniereSerie.exoId)
      if (i < 0) return null
      const k = seance.series.filter((x) => x.exoId === derniereSerie.exoId).indexOf(derniereSerie)
      const avant = seance.deload ? undefined : historiqueDe(terminees, derniereSerie.exoId)[0]?.[k]
      const e = avant && ecartSerie(derniereSerie, avant, exos[i])
      return { i, k, mieux: e?.sens === 'mieux' ? e.texte : null }
    })()
    // Le repos qui suit la série qui a gagné le cran de son exercice : le cercle le dit tant qu'il dure.
    const cranRepos = (() => {
      const c = derniereSerie && cranDe(derniereSerie.exoId)
      return c && c.serie.id === derniereSerie!.id ? c : null
    })()
    // L'exercice qu'on vient de finir, quand la suite change de machine : on le signale clairement.
    const exoFini = (() => {
      if (!derniereSerie || enCours < 0) return null
      const i = plans.findIndex((p) => p.exoId === derniereSerie.exoId)
      return i >= 0 && i !== enCours && nbFaites(plans[i].exoId) >= totalDe(i) ? exos[i].nom : null
    })()
    const prochaine = (() => {
      if (enCours < 0) return null
      const p = plans[enCours]
      const exo = exos[enCours]
      const n = nbFaites(p.exoId)
      const t = totalDe(enCours)
      const avant = historiqueDe(terminees, p.exoId)[0]?.[n]
      const plus = hausse(exo, suggestions[enCours], historiqueDe(terminees, p.exoId)[0], n)
      const objectif = p.finisseur && n === t - 1 ? undefined : objectifSerie(enCours, n)
      const seuil = objectif ? seuilCran(exo, historiqueDe(terminees, p.exoId), seance.series.filter((x) => x.exoId === p.exoId), objectif.charge) : null
      const enSuperset = alterneEncore(plans, enCours, seance.passes ?? [], nbFaites, totalDe)
      return (
        <div className={'focus-bloc prochaine-grand' + (exoFini ? ' nouvel-exo' : '')}>
          {derniere?.mieux && <div className={'mieux-titre' + (vient ? ' vient-monter' : '')}>↑ {derniere.mieux} vs la dernière fois</div>}
          {enSuperset && enteteSuperset(enCours)}
          {/* Superset : la série d'avant vient de l'autre exercice ; elle reste à portée pour la corriger. */}
          {enSuperset && !exoFini && derniere && derniere.i !== enCours && (
            <div className="ligne entre ligne-terminee superset-avant petit">
              <span>
                <Check size={14} className="ok-texte ico-texte" /> {chargeQte(exos[derniere.i], derniereSerie!.charge, derniereSerie!.reps)} · {exos[derniere.i].nom}
              </span>
              <button className="btn discret petit" onClick={() => setCorrige(derniereSerie!.id)} aria-label={`Corriger la série ${derniere.k + 1}`}>
                Corriger
              </button>
            </div>
          )}
          {exoFini ? (
            <>
              <div className="fin-exo">
                <div className={'fin-exo-titre' + (vient ? ' vient-coche' : '')}>
                  <Check size={20} /> <span>{exoFini} terminé</span>
                </div>
                <div className="fin-exo-rang">
                  <LigneSeries court exo={exos[derniere!.i]} faites={seance.series.filter((x) => x.exoId === plans[derniere!.i].exoId)} total={totalDe(derniere!.i)} cible={() => ''} onCorriger={(f) => setCorrige(f.id)} cranId={cranDe(plans[derniere!.i].exoId)?.serie.id} />
                  <button className="btn petit" onClick={() => void ajusterSeries(derniere!.i, 1)}>
                    + série
                  </button>
                </div>
              </div>
              <div className="faible">Exercice suivant</div>
            </>
          ) : (
            <div className="entete-prochaine">
              <div className={p.finisseur && n === t - 1 ? 'texte-finisseur prochaine-finisseur' : 'faible'}>{p.finisseur && n === t - 1 ? 'Prochaine série : finisseur' : 'Prochaine série'}</div>
              <button className="lien-prochaine" onClick={() => setSeriesDe(enCours)}>
                Séries, note <ChevronRight size={16} />
              </button>
            </div>
          )}
          <div className="ligne entre">
            <h2>{exo.nom}</h2>
            <BoutonInfos onClick={() => setInfos(exo.id)} />
          </div>
          {enSuperset && ensuiteSuperset(enCours)}
          {/* Rien de fait sur cet exercice : la cible dessous suffit, les pastilles ne servent qu'à corriger. */}
          {n > 0 && <LigneSeries exo={exo} faites={seance.series.filter((x) => x.exoId === p.exoId)} total={t} cible={(k) => cibleSerie(exo, p, suggestions[enCours], k, seance.series.filter((x) => x.exoId === p.exoId), t)} onCorriger={(f) => setCorrige(f.id)} cranId={cranDe(p.exoId)?.serie.id} vient={vient && derniere?.i === enCours ? (cranRepos ? 'vient-cran' : derniere.mieux ? 'vient-mieux' : 'vient-faite') : undefined} />}
          {objectif && avant ? (
            // L'objectif fixé, en grand, pendant qu'on se prépare : le chiffre à atteindre, et s'il vaut un record.
            <div className="a-battre">
              <div className="faible">
                À battre : {serieTexte(exo, avant, false, false)}
                {seuil?.record === objectif.avant ? ', ton record' : ''}
              </div>
              <div className="vise">
                Vise <span className="vise-chiffre">{qte(exo, objectif.reps)}</span>
              </div>
              {seuil && objectif.reps >= seuil.reps && (
                <div className="vise-record">
                  <IconeCran taille={16} /> Ce sera un record : +1 cran
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="cible-grand">{cibleSerie(exo, p, suggestions[enCours], n, seance.series.filter((x) => x.exoId === p.exoId), t)}</div>
              {plus && <div className="badge-hausse grand"><Flame size={16} /> ↑ {plus} par rapport à la dernière fois</div>}
              {avant && <div className="faible">Dernière fois : {serieTexte(exo, avant, false, false)} · effort {kg(avant.rpe)}/10</div>}
            </>
          )}
          {/* Le finisseur s'annonce pendant le repos, avec ce qu'il faudra faire. */}
          {p.finisseur && n === t - 1 && (
            <div className="consigne-fin">
              <strong>
                <Sparkles size={14} className="ico-texte" /> {FINISSEURS[typeFinisseur(p)].nom}.
              </strong>{' '}
              {consigneDe(enCours)}
            </div>
          )}
          {n === 0 && <ChauffesCochables seance={seance} plan={p} exo={exo} chargeDuJour={suggestions[enCours].charges[0]} />}
          {(p.note || exo.notes) && <div className="faible"><Info size={14} className="ico-texte" /> {p.note ?? exo.notes}</div>}
        </div>
      )
    })()
    const blocTerminer = (
      <div className="focus-bloc pile">
        <h2>{seance.passes?.length ? 'Plus rien à faire' : 'Toutes les séries sont faites'}</h2>
        {!!seance.passes?.length && <div className="faible">Sauté : {seance.passes.map((id) => catalogue.exo(id).nom).join(', ')}. Pour en reprendre un, passe par « Voir la séance ».</div>}
        <button className="btn primaire grand" onClick={() => ouvrirFin(true)}>
          Terminer la séance
        </button>
        <button className="btn discret plein" onClick={() => setChoix({ mode: 'ajouter' })}>
          <Plus size={20} /> Ajouter un exercice
        </button>
      </div>
    )
    return (
      <div ref={ecranFocus} className={'focus' + (vueRepos ? ' fixe' : '')}>
        {avancementCompact}
        {minuteur && <Minuteur etat={minuteur} onChange={setMinuteur} variante={vueRepos ? 'grand' : 'bandeau'} legende={vueRepos && exoFini ? 'exercice fini' : undefined} cran={vueRepos && cranRepos ? pourquoiCran(cranRepos) : undefined} cranVient={vient && !!cranRepos} />}
        {correction}
        {vueRepos ? (
          prochaine ?? blocTerminer
        ) : surEchauffement ? (
          <Echauffement seance={seance} onPasser={() => setIdx(Math.max(0, enCours))} />
        ) : enCours >= 0 ? (
          // Saisie en plein écran : l'essentiel seulement (exercice, cible, dernière fois, saisie, Valider).
          (() => {
            const p = plans[enCours]
            const exo = exos[enCours]
            const n = nbFaites(p.exoId)
            const t = totalDe(enCours)
            const derniereFois = historiqueDe(terminees, p.exoId)[0]
            const plus = hausse(exo, suggestions[enCours], derniereFois, n)
            const finisseurIci = !!p.finisseur && n === t - 1
            const objectifSaisie = finisseurIci ? undefined : objectifSerie(enCours, n)
            const cleAnnonce = `${seance.id}:${p.exoId}`
            const enSuperset = alterneEncore(plans, enCours, seance.passes ?? [], nbFaites, totalDe)
            return (
              <div className="focus-bloc pile saisie-focus">
                {finisseurIci && reglageAnnonce?.valeur !== false && !annoncesVues.has(cleAnnonce) && !corrige && (
                  <AvantFinisseur exo={exo.nom} technique={FINISSEURS[typeFinisseur(p)].nom} consigne={consigneDe(enCours)} onFin={() => (annonceVue(cleAnnonce), setAnnonceVue((x) => x + 1))} />
                )}
                {enSuperset && <div className="superset-badge-saisie">{enteteSuperset(enCours)}</div>}
                <div className="ligne entre" style={{ alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <h2>{exo.nom}</h2>
                    {enSuperset && ensuiteSuperset(enCours)}
                  </div>
                  <BoutonInfos onClick={() => setInfos(exo.id)} />
                </div>
                <LigneSeries avant={n === 0 && chauffesDuJour(seance, p, exo, suggestions[enCours].charges[0]).length ? <ChauffesCochables seance={seance} plan={p} exo={exo} chargeDuJour={suggestions[enCours].charges[0]} enRangee /> : undefined} exo={exo} faites={seance.series.filter((x) => x.exoId === p.exoId)} total={t} cible={(k) => cibleSerie(exo, p, suggestions[enCours], k, seance.series.filter((x) => x.exoId === p.exoId), t)} onCorriger={(f) => setCorrige(f.id)} cranId={cranDe(p.exoId)?.serie.id} />
                {/* Avec un objectif à battre, l'éditeur l'écrit en une ligne (« Vise 9 · à battre : 8 ») : pas de doublon ici. */}
                {!objectifSaisie && (derniereFois?.[n] || plus) && (
                  <div className="faible">
                    {derniereFois?.[n] && <>Dernière fois : {serieTexte(exo, derniereFois[n], false, false)} · effort {kg(derniereFois[n].rpe)}/10</>}
                    {plus && <span className="badge-hausse"> ↑ {plus}</span>}
                  </div>
                )}
                {(() => {
                  // La note du jour d'abord, sur une ligne : la saisie doit rester à l'écran.
                  const note = seance.notes[p.exoId] || (noteAvant(p.exoId) ? `La dernière fois : ${noteAvant(p.exoId)}` : p.note ?? exo.notes)
                  return note ? <div className="faible note-saisie"><StickyNote size={14} className="ico-texte" /> {note}</div> : null
                })()}
                <Editeur
                  key={`${p.exoId}-${n}-${suggestions[enCours].charges.join()}`}
                  seance={seance}
                  plan={p}
                  exo={exo}
                  sugg={suggestions[enCours]}
                  index={n}
                  total={t}
                  faites={seance.series.filter((x) => x.exoId === p.exoId)}
                  reposRestant={reposRestant}
                  verrou={verrou}
                  compact
                  seuilCran={seance.deload ? undefined : (charge) => seuilCran(exo, historiqueDe(terminees, p.exoId), seance.series.filter((x) => x.exoId === p.exoId), charge)}
                  objectif={objectifSaisie}
                  onFini={(s) => valider(s, reposApresSuperset(plans, enCours, n, t, faitesParExo(), totalDe))}
                  onAnnulerEdition={() => undefined}
                />
              </div>
            )
          })()
        ) : (
          blocTerminer
        )}
        {fenetres}
        {toast && <div className="toast">{toast}</div>}
        {objectifDe !== null && plans[objectifDe] && (
          <ObjectifApres exo={exos[objectifDe]} plan={plans[objectifDe]} terminees={terminees} onFermer={() => setObjectifDe(null)} />
        )}
        {infos && <InfosExo exo={exoAvecReglages(catalogue.exo(infos), reglages)} onFermer={() => setInfos(null)} />}
      </div>
    )
  }

  // La liste : toute la séance d'un coup d'œil, on y organise ; la saisie se fait en plein écran.
  const enEchauffement = echauffementActif(seance)
  return (
    <div>
      <div className="entete colle">
        <div className="ligne entre">
          {resumeAvancement(false)}
          <button className="btn petit sans-coupure" onClick={() => ouvrirFin(true)}>
            Fin de séance
          </button>
        </div>
        {maintenant - seance.debut > 4 * 3600000 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 12px', background: 'var(--surface-2)', border: '1px solid var(--bord)', borderRadius: 'var(--rayon-2)', margin: '8px 0' }}>
            <span className="faible" style={{ color: 'var(--texte)' }}><TriangleAlert size={14} className="ico-texte" /> Séance ouverte depuis plus de 4 h</span>
            <button className="btn primaire petit" onClick={() => ouvrirFin(true)}>
              Terminer
            </button>
          </div>
        )}
        {seance.deload && <div className="bandeau-deload"><Wind size={16} className="ico-texte" /> {seance.allegeeSeule ? 'Séance allégée' : 'Semaine allégée'} : charges −10 %, effort 6-7/10, sans échec. Récupère, ne force pas.</div>}
      </div>

      <div className="liste-seance">
        {enCours < 0 && !enEchauffement && plans.length > 0 && (
          <button className="btn primaire grand plein liste-terminer" onClick={() => ouvrirFin(true)}>
            Terminer la séance
          </button>
        )}
        {avecEchauffement && (
          <div className={'carte ligne-seance' + (enEchauffement ? ' en-cours' : ' fait')}>
            <button className="ligne-seance-tete" onClick={() => allerSaisir(-1)}>
              <span className="ligne-seance-etat">{enEchauffement ? <Play size={14} fill="currentColor" /> : <Check size={16} />}</span>
              <span className="ligne-seance-texte">
                <strong>Échauffement</strong>
              </span>
              <span className="faible">{seance.echauffement!.faits.length}/{seance.echauffement!.ids.length}</span>
              <ChevronRight size={20} className="ligne-seance-chevron" />
            </button>
            {enEchauffement && (
              <div className="ligne-seance-continuer">
                <button className="btn primaire plein" onClick={() => allerSaisir(-1)}>
                  Continuer
                </button>
              </div>
            )}
          </div>
        )}

        {plans.map((p, i) => {
          const enchaine = !!p.enchaine
          const precEnchaine = i > 0 && !!plans[i - 1]?.enchaine
          const groupe = groupeSuperset(plans, i)
          const histo = historiqueDe(terminees, p.exoId)
          return (
            <LigneExoSeance
              key={p.exoId + i}
              seance={seance}
              plan={p}
              exo={exos[i]}
              sugg={suggestions[i]}
              numero={i + 1}
              total={totalDe(i)}
              enCours={!enEchauffement && i === enCours}
              passe={estPasse(i)}
              superset={groupe.length > 1 ? { position: groupe.indexOf(i) + 1, taille: groupe.length } : undefined}
              classeSuperset={(groupe.length > 1 ? ' en-superset' : '') + (enchaine ? ' enchaine-vers-suivant' : '') + (precEnchaine && !enchaine ? ' suite-superset' : '')}
              derniere={histo[0]}
              repere={repereDe(p.exoId)}
              noteAvant={noteAvant(p.exoId)}
              bloque={seance.deload || phaseA(catalogue.objectifs, seance.date)?.phase === 'seche' ? 0 : (blocage(exos[i], terminees, seance.date, catalogue.objectifs)?.semaines ?? 0)}
              ouvert={ouvert === i}
              onBasculer={() => setOuvert(ouvert === i ? null : i)}
              onContinuer={() => allerSaisir(i)}
              onFaireMaintenant={() => void faireMaintenant(i).then(() => allerSaisir(i))}
              onAnnulerPasser={() => void annulerPasser(i)}
              onCorriger={(id) => setCorrige(id)}
              onMachinePrise={() => setMachineDe(i)}
              onInfos={() => setInfos(p.exoId)}
              onObjectif={!seance.deload && histo.length ? () => setObjectifDe(i) : undefined}
            />
          )
        })}

        {plans.length === 0 && <div className="muted">Séance libre : ajoute tes exercices au fur et à mesure.</div>}
        <button className={'btn plein ' + (plans.length === 0 ? 'primaire grand' : 'discret')} onClick={() => setChoix({ mode: 'ajouter' })}>
          <Plus size={20} /> Ajouter un exercice
        </button>
      </div>

      {correction}
      {fenetres}
      {toast && <div className="toast">{toast}</div>}
      {objectifDe !== null && plans[objectifDe] && (
        <ObjectifApres exo={exos[objectifDe]} plan={plans[objectifDe]} terminees={terminees} onFermer={() => setObjectifDe(null)} />
      )}
      {infos && <InfosExo exo={exoAvecReglages(catalogue.exo(infos), reglages)} onFermer={() => setInfos(null)} />}
      {minuteur && <Minuteur etat={minuteur} onChange={setMinuteur} onAgrandir={() => naviguer(() => setFocus(true))} />}
    </div>
  )
}

/** Une ligne de la liste : un résumé ; un appui déplie le détail et les actions rares. */
function LigneExoSeance({
  seance,
  plan,
  exo,
  sugg,
  numero,
  total,
  enCours,
  passe,
  superset,
  classeSuperset,
  derniere,
  repere,
  noteAvant,
  bloque,
  ouvert,
  onBasculer,
  onContinuer,
  onFaireMaintenant,
  onAnnulerPasser,
  onCorriger,
  onMachinePrise,
  onInfos,
  onObjectif,
}: {
  seance: Seance
  plan: ExoPlan
  exo: Exercice
  sugg: Suggestion
  numero: number
  total: number
  enCours: boolean
  passe: boolean
  superset?: { position: number; taille: number }
  classeSuperset: string
  derniere?: Serie[]
  repere?: string
  noteAvant?: string
  bloque: number
  ouvert: boolean
  onBasculer: () => void
  onContinuer: () => void
  onFaireMaintenant: () => void
  onAnnulerPasser: () => void
  onCorriger: (id: string) => void
  onMachinePrise: () => void
  onInfos: () => void
  onObjectif?: () => void
}) {
  const [voirNote, setVoirNote] = useState(!!seance.notes[exo.id])
  const [photo, setPhoto] = useState(false)
  const faites = seance.series.filter((x) => x.exoId === exo.id)
  const termine = !passe && faites.length >= total
  const hausses = sugg.charges.map((_, n) => hausse(exo, sugg, derniere, n))
  const battre = hausses.some(Boolean)
  const ajuster = (delta: number) =>
    majSeance(seance.id, (s) => {
      s.ajustSeries[exo.id] = (s.ajustSeries[exo.id] ?? 0) + delta
    })
  // Fait : ce qui a été fait ; sinon ce qui est visé.
  const resume = passe && !faites.length ? 'Passé aujourd’hui' : faites.length >= total ? cibleTexte(exo, faites.map((x) => x.charge), faites.map((x) => x.reps)) : cibleTexte(exo, sugg.charges, sugg.reps)
  const efforts = [...new Set(plan.series.map((x) => kg(x.rpe)))]
  return (
    <div className={'carte ligne-seance' + classeSuperset + (enCours ? ' en-cours' : '') + (termine ? ' fait' : '') + (passe ? ' passe' : '')}>
      <button className="ligne-seance-tete" onClick={onBasculer} aria-expanded={ouvert}>
        <span className="ligne-seance-etat">{termine ? <Check size={16} /> : passe ? <Minus size={16} /> : enCours ? <Play size={14} fill="currentColor" /> : numero}</span>
        <span className="ligne-seance-texte">
          <strong>{exo.nom}</strong>
          {superset && (
            <span>
              <span className="badge-superset">
                <Link2 size={12} /> Superset {superset.position}/{superset.taille}
              </span>
            </span>
          )}
          <span className="faible">
            {resume}
            {plan.optionnel ? ' · optionnel' : ''}
          </span>
        </span>
        <span className="faible">{faites.length}/{total}</span>
        <ChevronDown size={20} className={'ligne-seance-chevron' + (ouvert ? ' ouvert' : '')} />
      </button>
      {enCours && (
        <div className="ligne-seance-continuer">
          <button className="btn primaire plein" onClick={onContinuer}>
            Continuer
          </button>
        </div>
      )}
      <Deplie ouvert={ouvert}>
        <div className="ligne-seance-detail">
          <div className="faible">
            {schemaPlan(exo, plan)} · effort {efforts.join(', ')}/10 · repos {reposTexte(plan)}
            {plan.finisseur && <span className="texte-finisseur"> · {FINISSEURS[typeFinisseur(plan)].nom.toLowerCase()}</span>}
          </div>
          {battre ? (
            <div className="muted">
              <span className="badge-hausse grand"><Flame size={14} className="ico-texte" /> À battre</span> {hausses.map((h, n) => (h ? `S${n + 1} ${h}` : null)).filter(Boolean).join(' · ')}
            </div>
          ) : bloque >= 3 ? (
            <div className="muted">Pas de progrès depuis {bloque} semaines : tente +1 rep ou un cran de charge, et regarde ton sommeil et tes repas.</div>
          ) : (
            /* « Comme la dernière fois » n'apprend rien : les séries le montrent. */
            sugg.decision !== 'pareil' && <div className="muted">{sugg.message}</div>
          )}
          {repere && <div className="faible">Repère, sur l’équivalent : <strong>{repere}</strong>. Les charges ne se comparent pas d’une machine à l’autre : ajuste au ressenti.</div>}
          {(plan.note || exo.notes) && <div className="faible"><Info size={14} className="ico-texte" /> {plan.note ?? exo.notes}</div>}
          {noteAvant && !seance.notes[exo.id] && <div className="faible"><StickyNote size={14} className="ico-texte" /> La dernière fois : {noteAvant}</div>}
          <ChauffesCochables seance={seance} plan={plan} exo={exo} chargeDuJour={sugg.charges[0]} />

          <div className="ligne-seance-series">
            {Array.from({ length: total }, (_, n) => {
              const f = faites[n]
              if (!f) {
                return (
                  <div key={n} className="ligne-serie a-venir">
                    <span>
                      <span className="faible">S{n + 1}</span> {cibleSerie(exo, plan, sugg, n, faites, total).replace(/ · effort .*/, '')}
                    </span>
                  </div>
                )
              }
              const e = derniere?.[n] && ecartSerie(f, derniere[n], exo)
              return (
                <button key={f.id} className="ligne-serie" onClick={() => onCorriger(f.id)} aria-label={`Corriger la série ${n + 1}`}>
                  <span>
                    <Check size={14} className="ok-texte ico-texte" /> <span className="faible">S{n + 1}</span> {serieTexte(exo, f, true)} <span className="faible">· effort {kg(f.rpe)}/10</span>
                    {f.douleur && <TriangleAlert size={14} className="ico-texte" />}
                    {e && e.sens !== 'egal' && <span className={'avant ' + e.sens}> {e.sens === 'mieux' ? '↑' : '↓'} {e.texte}</span>}
                  </span>
                  <Pencil size={16} className="ligne-seance-chevron" />
                </button>
              )
            })}
          </div>
          {derniere && sugg.decision !== 'pareil' && <div className="faible">Dernière fois : {cibleTexte(exo, derniere.map((x) => x.charge), derniere.map((x) => x.reps))}</div>}

          {voirNote && (
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
          )}

          <div className="ligne-seance-actions">
            {!enCours && !termine && !passe && (
              <button className="btn petit" onClick={onFaireMaintenant}>
                Faire maintenant
              </button>
            )}
            {passe && (
              <button className="btn petit" onClick={onAnnulerPasser}>
                Le faire quand même
              </button>
            )}
            {!termine && !passe && (
              <button className="btn petit" onClick={onMachinePrise}>
                Machine prise
              </button>
            )}
            {onObjectif && (
              <button className="btn petit" onClick={onObjectif}>
                <Pencil size={16} /> Objectif
              </button>
            )}
            {!passe && (
              <button className="btn petit" onClick={() => void ajuster(+1).then(() => termine && onFaireMaintenant())}>
                + série
              </button>
            )}
            {/* Au moins une série : pour ne pas faire l'exercice aujourd'hui, c'est « Sauter » dans « Machine prise ». */}
            {!passe && total > Math.max(faites.length, 1) && (
              <button className="btn petit" onClick={() => void ajuster(-1)}>
                − série
              </button>
            )}
            {!voirNote && (
              <button className="btn petit" onClick={() => setVoirNote(true)}>
                <StickyNote size={16} /> Note
              </button>
            )}
            <button className="btn petit" onClick={onInfos}>
              <Info size={16} /> Fiche
            </button>
            {exo.image && <Vignette exo={exo} taille={44} onClick={() => setPhoto(true)} />}
          </div>
        </div>
      </Deplie>
      {photo && exo.image && <Photo src={exo.image} titre={exo.nom} onFermer={() => setPhoto(false)} />}
    </div>
  )
}

function MachinePrise({
  nom,
  entame,
  autres,
  onEchanger,
  onRemplacer,
  onPasser,
  onDelierSuperset,
  onFermer,
}: {
  nom: string
  entame: boolean
  autres: { i: number; nom: string; entame: boolean }[]
  onEchanger: (j: number) => void
  onRemplacer: () => void
  onPasser: () => void
  onDelierSuperset?: () => void
  onFermer: () => void
}) {
  const [echange, setEchange] = useState(false)
  useRetour(true, () => (echange ? (setEchange(false), 'rester') : onFermer()))
  const option = (Icone: LucideIcon, titre: string, detail: string, fn: () => void, actif = true) =>
    actif && (
      <button className="liste-btn option-machine" onClick={fn}>
        <Icone size={20} />
        <span>
          <strong>{titre}</strong>
          <div className="faible">{detail}</div>
        </span>
        <ChevronRight size={20} />
      </button>
    )
  return (
    <div className="modal-fond" onClick={onFermer}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {echange ? (
          <>
            <h2>Échanger {nom}</h2>
            <div className="faible sous-titre-machine">Quel exercice fais-tu maintenant ? {nom} prendra sa place.</div>
            {autres.map((a) => (
              <button key={a.i} className="liste-btn option-machine" onClick={() => onEchanger(a.i)}>
                <span>
                  <strong>{a.nom}</strong>
                  <div className="faible">
                    exercice {a.i + 1}
                    {a.entame ? ' · déjà commencé' : ''}
                  </div>
                </span>
                <ChevronRight size={20} />
              </button>
            ))}
            <button className="btn discret plein" onClick={() => setEchange(false)}>
              Retour
            </button>
          </>
        ) : (
          <>
            <h2>Machine prise</h2>
            <div className="faible sous-titre-machine">{nom}</div>
            {option(ArrowLeftRight, 'Échanger', 'Faire un autre exercice maintenant, celui-ci prend sa place.', () => setEchange(true), autres.length > 0)}
            {option(Repeat, 'Remplacer', entame ? 'Les séries restantes passent sur un autre exercice.' : 'Un autre exercice du même muscle, avec son historique.', onRemplacer)}
            {onDelierSuperset && option(Unlink, 'Délier le superset', 'Faire ces exercices séparément aujourd’hui.', onDelierSuperset)}
            {option(SkipForward, 'Sauter cet exercice', 'Il reste grisé dans la séance, tu peux y revenir.', onPasser)}
            <button className="btn discret plein" onClick={onFermer}>
              Annuler
            </button>
          </>
        )}
      </div>
    </div>
  )
}

const OPTIONS_FORME = [
  { val: 1, label: 'Difficile', Icon: Frown, couleur: 'var(--danger)' },
  { val: 3, label: 'Bien', Icon: Smile, couleur: 'var(--ok)' },
  { val: 5, label: 'Au top', Icon: Flame, couleur: 'var(--accent)' },
] as const

function FinSeance({
  seance,
  terminees,
  reglages,
  catalogue,
  onRetour,
}: {
  seance: Seance
  terminees: Seance[]
  reglages: Reglage[]
  catalogue: Catalogue
  onRetour: () => void
}) {
  const modele = catalogue.modele(seance.modeleId)
  // Rien de présélectionné : une note non choisie n'est pas enregistrée.
  const [forme, setForme] = useState<number | undefined>(seance.energie ?? seance.ressenti ?? undefined)
  const [ressenti, setRessenti] = useState<number | undefined>(seance.ressenti)
  const [energie, setEnergie] = useState<number | undefined>(seance.energie)
  const [garder, setGarder] = useState(false)
  const [reliesIci, setReliesIci] = useState<string[]>([])
  const [nomModele, setNomModele] = useState('')
  const [objectifs, setObjectifs] = useState<Record<string, Objectif>>(seance.objectifs ?? {})
  const [partager, setPartager] = useState(false)
  /** Série en cours de correction : même fenêtre que pendant la séance. */
  const [corrige, setCorrige] = useState<string | null>(null)
  const libre = !modele && seance.exercices.length > 0

  // Rien ne se perd : choix et sensations partent dans la base dès qu'ils changent, pour survivre
  // à un retour dans la séance ou à une appli fermée par Android.
  const dejaVu = useRef(false)
  useEffect(() => {
    if (!dejaVu.current) {
      dejaVu.current = true
      return
    }
    void db.seances.update(seance.id, { objectifs, ressenti, energie })
  }, [seance.id, objectifs, ressenti, energie])

  const choisirForme = (v: number) => {
    const n = forme === v ? undefined : v
    setForme(n)
    setRessenti(n)
    setEnergie(n)
  }

  const nonFaits = seance.exercices.filter((p) => !seance.series.some((s) => s.exoId === p.exoId))
  const remplaces = remplacesDe(seance)
  /** Sous le nom d'un remplaçant : l'exercice prévu à sa place (il garde sa charge pour la prochaine fois). */
  const place = (exoId: string) => {
    const a = remplaces.get(exoId)
    return a ? <span className="faible legende">{textePlace(catalogue.exo(a).nom, seance.series.some((x) => x.exoId === a))}</span> : null
  }
  const seriesDuJour = (exo: Exercice) => seance.series.filter((x) => x.exoId === exo.id)
  /** Les séries du jour, en clair, comparées à la dernière fois. */
  const detailSeries = (exo: Exercice) => {
    const avant = historiqueDe(terminees, exo.id)[0] ?? []
    return (
      <div className="pile fin-detail">
        {seriesDuJour(exo).map((x, k) => {
          const e = ecartSerie(x, avant[k], exo)
          return (
            <button key={x.id} type="button" className="ligne-serie" onClick={() => setCorrige(x.id)} aria-label={`Corriger la série ${k + 1}, ${exo.nom}`}>
              <span>
                <span className="faible">S{k + 1} </span>
                {serieTexte(exo, x, true)}
                <span className="faible"> · effort {kg(x.rpe)}/10</span>
                {x.douleur && <TriangleAlert size={14} className="ico-texte" />}
                {e && e.sens !== 'egal' && <span className={'avant ' + e.sens}> {e.sens === 'mieux' ? '↑' : '↓'} {e.texte}</span>}
              </span>
              <Pencil size={16} className="ligne-seance-chevron" />
            </button>
          )
        })}
      </div>
    )
  }

  // Double appui : le second arrivait avant que l'écran ne change, et créait une 2e séance réutilisable.
  const unSeulAppui = useRef(verrou()).current
  const enregistrer = () => unSeulAppui(async () => {
    let modeleId = seance.modeleId
    if (garder && libre) {
      modeleId = 'm_' + uid()
      await db.modeles.put({ id: modeleId, nom: nomModele.trim() || 'Séance libre', sousTitre: '', exercices: structuredClone(seance.exercices) })
    }
    const heures = seance.series.map((x) => x.heure).filter((h): h is number => typeof h === 'number' && h > 0)
    const fin = Date.now() - seance.debut > 4 * 3600000 && heures.length ? Math.max(...heures) : Date.now()
    await db.seances.update(seance.id, { enCours: false, fin, ressenti, energie, modeleId, objectifs })
    oublierEtatLocal(seance.id)
  })

  const abandonner = async () => {
    const ok = seance.series.length
      ? await confirmer('Les séries déjà faites seront effacées.', { titre: 'Supprimer cette séance ?', oui: 'Supprimer la séance', non: 'Reprendre', danger: true })
      : await confirmer('Rien n’a encore été enregistré.', { titre: 'Annuler la séance ?', oui: 'Annuler la séance', non: 'Reprendre', danger: true })
    if (!ok) return
    await annulerSeance(seance.id)
  }

  const resumeForme = seance.deload ? null : resumeSeance(seance, terminees, catalogue.exo)
  // Les crans de la séance (un record battu = un cran), et où en est le disque avec eux.
  const crans = cransDeSeance(seance, terminees, catalogue.exo)
  const cransAvant = totalCrans(terminees.filter((s) => s.id !== seance.id), catalogue.exo)
  const disque = etatDisque(cransAvant + crans.length)
  const disquePlein = disque.pleins > etatDisque(cransAvant).pleins
  const cransMontres = disque.crans || (disque.total ? 12 : 0)
  // Toute première séance : rien à battre encore, on dit ce qui vient d'être posé.
  const premiereSeance = !seance.deload && seance.series.length > 0 && !terminees.some((s) => s.id !== seance.id)
  const enSeche = phaseA(catalogue.objectifs, seance.date)?.phase === 'seche'

  return (
    <div className="apparait">
      <div className="entete">
        <BoutonRetour onClick={onRetour} label="Reprendre la séance" />
        <div style={{ flex: 1 }}>
          <h1>Fin de séance</h1>
        </div>
        {seance.series.length > 0 && (
          <button type="button" className="btn petit" onClick={() => setPartager(true)}>
            <Share2 size={18} />
            Partager
          </button>
        )}
      </div>
      <div className="carte fin-resume">
        {crans.length > 0 ? (
          <>
            {disquePlein ? (
              // Le 12e cran : le seul moment qui a droit à une animation plus longue (une fois toutes les deux ou trois semaines).
              <div className="fin-disque-plein" style={{ '--apres': `${0.25 + Math.min(crans.length, 12) * 0.25}s` } as CSSProperties}>
                <Disque crans={12} nouveaux={Math.min(crans.length - disque.crans, 12)} taille={132} chiffre plein />
                <h2>Disque plein</h2>
                <div className="fin-crans-titre">
                  {crans.length} record{crans.length > 1 ? 's' : ''} battu{crans.length > 1 ? 's' : ''} aujourd’hui
                </div>
                <div className="faible petit fin-disque-suite">
                  {disque.crans ? `Ton ${disque.numero}e disque a déjà ${disque.crans} cran${disque.crans > 1 ? 's' : ''}.` : `Ton ${disque.numero}e disque commence à la prochaine séance.`}
                </div>
                <span className="pastille fin-disque-suite">
                  <Disque crans={12} taille={16} plein /> {disque.pleins} disque{disque.pleins > 1 ? 's' : ''} plein{disque.pleins > 1 ? 's' : ''}
                </span>
                <div className="faible petit fin-disque-suite">{seance.nom}</div>
              </div>
            ) : (
              <div className="fin-crans">
                <Disque crans={cransMontres} nouveaux={Math.min(crans.length, cransMontres)} taille={76} chiffre />
                <div>
                  <h2>{seance.nom}</h2>
                  <div className="fin-crans-titre">
                    {crans.length} record{crans.length > 1 ? 's' : ''} battu{crans.length > 1 ? 's' : ''}
                  </div>
                  <div className="faible petit">{`${disque.crans} cran${disque.crans > 1 ? 's' : ''} sur 12 dans ton ${disque.numero > 1 ? `${disque.numero}e ` : ''}disque`}</div>
                </div>
              </div>
            )}
            <div className="petit fin-crans-liste">
              {crans.map((c) => (
                <div key={c.exo.id}>
                  {c.exo.nom} <span className="fin-crans-gain">{texteCran(c, true)}</span>
                </div>
              ))}
            </div>
            {/* La règle, une seule fois : le jour du tout premier cran. */}
            {cransAvant === 0 && <div className="faible petit fin-crans-regle">Un cran = un record battu sur un exercice. Il ne se perd jamais. Au 12e, ton disque est plein et tu en commences un autre.</div>}
            {resumeForme && resumeForme.mieux > crans.length && (
              <div className="faible petit">
                {resumeForme.mieux} exercices mieux que la dernière fois
              </div>
            )}
          </>
        ) : (
          <h2>{seance.nom}</h2>
        )}
        {premiereSeance && (
          <div className="fin-reperes">
            <strong>
              Tes repères sont posés : {new Set(seance.series.map((x) => x.exoId)).size} exercice{new Set(seance.series.map((x) => x.exoId)).size > 1 ? 's' : ''}.
            </strong>
            <div className="faible petit">La prochaine fois, chaque record battu taille un cran dans ton disque.</div>
          </div>
        )}
        {enSeche && !seance.deload && !premiereSeance && crans.length === 0 && seance.series.length > 0 && <div className="faible petit">En sèche, on vise à tenir : garder tes charges, c’est réussi.</div>}
        {/* Le moment où on est le plus réceptif : ce qui a été mieux aujourd'hui (jamais en déload). */}
        {crans.length === 0 && resumeForme && (resumeForme.mieux > 0 || resumeForme.records > 0) && (
          <div className="mieux-titre fin-mieux">
            {resumeForme.records > 0 ? <Trophy size={16} /> : <TrendingUp size={16} />}
            <span>
              {[
                resumeForme.mieux > 0 && `${resumeForme.mieux} exercice${resumeForme.mieux > 1 ? 's' : ''} mieux que la dernière fois`,
                resumeForme.records > 0 && `${resumeForme.records} record${resumeForme.records > 1 ? 's' : ''}`,
              ]
                .filter(Boolean)
                .join(', ')}
            </span>
          </div>
        )}
        {seance.deload && <strong className="texte-finisseur">Séance allégée</strong>}
        {seance.series.length > 0 ? <ResumeSeance seance={seance} exo={catalogue.exo} enLigne /> : <div className="faible">Aucune série validée : rien à enregistrer.</div>}
        {/* Ici plutôt qu'en bas : « Enregistrer » reste toujours visible, on n'irait jamais les chercher. */}
        {seance.series.length > 0 && (
          <div className="fin-sensations">
            <div className="faible petit">Comment c’était ?</div>
            <div className="fin-sensations-choix">
              {OPTIONS_FORME.map((o) => (
                <button key={o.val} type="button" className={forme === o.val ? 'actif' : ''} aria-pressed={forme === o.val} onClick={() => choisirForme(o.val)}>
                  <o.Icon size={18} style={{ color: forme === o.val ? 'var(--texte)' : o.couleur }} />
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <ProchaineFois seance={seance} avant={terminees} catalogue={catalogue} reglages={reglages} objectifs={objectifs} onObjectifs={setObjectifs} detailSeries={detailSeries} place={place} />

      {(seance.aRelier ?? []).filter((l) => !reliesIci.includes(l.b)).map((l) => (
        <div key={l.a + l.b} className="fin-relier">
          <span className="faible petit">
            {catalogue.exo(l.a).nom} remplacé par {catalogue.exo(l.b).nom}. Les relier ? Chacun garde sa progression, l’autre sera proposé en premier.
          </span>
          <button
            className="btn petit"
            onClick={() => {
              void modifierEquivalents((eq) => relies(eq, l.a, l.b))
              setReliesIci((x) => [...x, l.b])
            }}
          >
            Relier
          </button>
        </div>
      ))}
      {seance.series.length > 0 && nonFaits.length > 0 && (
        <div className="faible petit fin-non-faits">
          Pas fait aujourd’hui : {nonFaits.map((p) => catalogue.exo(p.exoId).nom).join(', ')}
        </div>
      )}

      {libre && (
        <div className="carte pile fin-libre">
          <Interrupteur
            on={garder}
            onChange={setGarder}
            label="Enregistrer comme séance réutilisable"
            aide="Tu pourras la relancer ou l’ajouter à un programme depuis la page Programme."
          />
          {garder && <input placeholder="Nom de la séance" value={nomModele} onChange={(e) => setNomModele(e.target.value)} />}
        </div>
      )}
      {corrige &&
        (() => {
          const serie = seance.series.find((x) => x.id === corrige)
          const plan = serie && seance.exercices.find((p) => p.exoId === serie.exoId)
          if (!serie || !plan) return null
          const exo = exoAvecReglages(catalogue.exo(plan.exoId), reglages)
          return (
            <FenetreCorrection
              key={serie.id}
              seance={seance}
              plan={plan}
              exo={exo}
              sugg={suggestionPour(exo, plan, terminees)}
              serie={serie}
              total={Math.max(seriesDuJour(exo).length, plan.series.length + (seance.ajustSeries[plan.exoId] ?? 0))}
              repos={null}
              onFermer={() => setCorrige(null)}
            />
          )
        })()}
      {/* Les choix et sensations du moment, même s'ils ne sont pas encore relus de la base. */}
      {partager && <PartageSeance seance={{ ...seance, objectifs, ressenti, energie }} avant={terminees} reglages={reglages} catalogue={catalogue} onFermer={() => setPartager(false)} />}
      {seance.series.length > 0 ? (
        <>
          <div className="barre-enregistrer">
            <button className="btn primaire grand" onClick={enregistrer}>
              ✓ Enregistrer la séance
            </button>
          </div>
          <button className="btn discret danger plein fin-supprimer" onClick={abandonner}>
            Supprimer la séance
          </button>
        </>
      ) : (
        <button className="btn primaire grand fin-quitter" onClick={() => void annulerSeance(seance.id)}>
          Quitter sans enregistrer
        </button>
      )}
    </div>
  )
}

/** Toutes les séries de l'exercice sur une ligne : faites (✓), en cours (→), à venir. */
/** Corriger une série sans quitter le plein écran. Fermer (croix, appui à côté, retour) garde ce qui a changé. */
function FenetreCorrection({ seance, plan, exo, sugg, serie, total, repos, onFermer }: { seance: Seance; plan: ExoPlan; exo: Exercice; sugg: Suggestion; serie: Serie; total: number; repos: string | null; onFermer: () => void }) {
  const fermeture = useRef<(() => void) | null>(null)
  const fermer = () => (fermeture.current ? fermeture.current() : onFermer())
  useRetour(true, fermer)
  const faites = seance.series.filter((x) => x.exoId === serie.exoId)
  const index = faites.findIndex((x) => x.id === serie.id)
  return createPortal(
    <div className="modal-fond" onClick={fermer}>
      <div className="modal pile fenetre-correction" onClick={(e) => e.stopPropagation()}>
        <div className="ligne entre" style={{ alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <h2>Corriger la série {index + 1}</h2>
            <div className="faible">{exo.nom}</div>
            {repos && <div className="repos-correction">{repos}</div>}
          </div>
          <button className="btn-fermer" aria-label="Fermer" onClick={fermer}>
            <X size={22} />
          </button>
        </div>
        <Editeur seance={seance} plan={plan} exo={exo} sugg={sugg} index={index} total={total} faites={faites} edition={serie} reposRestant={0} verrou={false} compact fermeture={fermeture} onFini={onFermer} onAnnulerEdition={onFermer} />
      </div>
    </div>,
    document.body
  )
}

/**
 * Séries et note d'un exercice pendant le repos. Dans une fenêtre, pas à l'écran : un appui par erreur à côté de « Passer » changeait la séance sans le dire.
 * Tout s'écrit tout de suite, pour aujourd'hui seulement, et les séries restent sous les yeux quand on en ajoute ou en retire.
 */
function FenetreSeries({ seance, plan, exo, total, cible, repos, noteAvant, onAjuster, onRevenir, onFermer }: { seance: Seance; plan: ExoPlan; exo: Exercice; total: number; cible: (k: number) => string; repos: string | null; noteAvant?: string; onAjuster: (delta: number) => void; onRevenir: () => void; onFermer: () => void }) {
  const faites = seance.series.filter((x) => x.exoId === exo.id)
  const prevu = plan.series.length
  const ecart = total - prevu
  const [texte, setTexte] = useState(seance.notes[exo.id] ?? '')
  const ecrire = (v: string) =>
    void majSeance(seance.id, (s) => {
      s.notes[exo.id] = v
    })
  useEffect(() => {
    if (texte === (seance.notes[exo.id] ?? '')) return
    const t = setTimeout(() => ecrire(texte), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texte])
  const fermer = () => {
    if (texte !== (seance.notes[exo.id] ?? '')) ecrire(texte)
    onFermer()
  }
  useRetour(true, fermer)
  return createPortal(
    <div className="modal-fond" onClick={fermer}>
      <div className="modal pile fenetre-series" onClick={(e) => e.stopPropagation()}>
        <div className="ligne entre" style={{ alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <h2>{exo.nom}</h2>
            {repos && <div className="repos-correction">{repos}</div>}
          </div>
          <button className="btn-fermer" aria-label="Fermer" onClick={fermer}>
            <X size={22} />
          </button>
        </div>
        <LigneSeries court exo={exo} faites={faites} total={total} cible={cible} />
        <div className="stepper-series">
          <button aria-label="Retirer une série" disabled={total <= Math.max(faites.length, 1)} onClick={() => onAjuster(-1)}>
            −
          </button>
          <span>
            {total} série{total > 1 ? 's' : ''}
          </span>
          <button aria-label="Ajouter une série" onClick={() => onAjuster(1)}>
            +
          </button>
        </div>
        {ecart !== 0 && (
          <div className="ecart-series">
            <span>
              Prévu : {prevu} · {ecart > 0 ? '+' : '−'}
              {Math.abs(ecart)} aujourd’hui
            </span>
            {faites.length <= prevu && <button onClick={onRevenir}>Revenir à {prevu}</button>}
          </div>
        )}
        <label className="pile note-series">
          <span className="faible">Note</span>
          <textarea rows={2} placeholder="Réglage machine, sensation, douleur…" value={texte} onChange={(e) => setTexte(e.target.value)} />
        </label>
        {noteAvant && !texte && <div className="faible">La dernière fois : {noteAvant}</div>}
      </div>
    </div>,
    document.body
  )
}

/** « 40 kg × 10 » devient « 40×10 ». */
const compacte = (t: string) => t.replace(' kg', '').replace(' × ', '×')

function LigneSeries({ exo, faites, total, cible, onCorriger, vient, avant, court, cranId }: { exo: Exercice; faites: Serie[]; total: number; cible: (k: number) => string; onCorriger?: (s: Serie) => void; vient?: string; /** La série qui a gagné le cran de l'exercice : le disque à la place du crayon. */ cranId?: string; /** Échauffements de l'exercice, avant S1. */ avant?: ReactNode; /** Forme courte : « S1 40×10 ». */ court?: boolean }) {
  // Toutes les séries de l'exercice, chacune une seule fois : faites (✎ pour corriger), en cours (▶, sa cible est affichée en grand à côté), à venir.
  const rangee = useRef<HTMLDivElement>(null)
  // Une seule rangée qui défile : la série en cours reste visible, même sur 5 séries.
  useEffect(() => {
    const el = rangee.current
    const c = el?.querySelector<HTMLElement>('.courante')
    if (el && court) el.scrollLeft = el.scrollWidth
    if (!el || !c) return
    // Avec des échauffements : ils restent sous les yeux, la rangée ne glisse que pour garder S1 à l'écran.
    const debut = c.offsetLeft - el.offsetLeft
    el.scrollLeft = avant ? Math.max(0, debut + c.offsetWidth - el.clientWidth + 8) : debut - (el.clientWidth - c.offsetWidth) / 2
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faites.length, total])
  return (
    <div className={'ligne-series' + (avant ? ' avec-chauffes' : '')} ref={rangee}>
      {avant}
      {Array.from({ length: total }, (_, k) => {
        const f = faites[k]
        if (f)
          return onCorriger ? (
            <button key={k} className={'faite' + (vient && k === faites.length - 1 ? ' ' + vient : '')} onClick={() => onCorriger(f)} aria-label={`Corriger la série ${k + 1}`}>
              {f.id === cranId && <IconeCran taille={13} className="ico-texte cran-pastille" />} S{k + 1} {court ? compacte(serieTexte(exo, f, false, false)) : serieTexte(exo, f, false, false)} {!court && <Pencil size={13} />}
            </button>
          ) : (
            <span key={k} className="faite">
              S{k + 1} {court ? compacte(chargeQte(exo, f.charge, f.reps)) : chargeQte(exo, f.charge, f.reps)} <Check size={14} />
            </span>
          )
        return (
          <span key={k} className={k === faites.length ? 'courante' : ''}>
            S{k + 1} {k === faites.length ? <Play size={13} fill="currentColor" /> : court ? compacte(cible(k).split(' · ')[0]) : cible(k).split(' · ')[0]}
          </span>
        )
      })}
    </div>
  )
}

/** Échauffements de l'exercice, cochables directement (plein écran). */
/** Échauffements à montrer : en séance allégée, plus ceux qui atteignent presque la charge du jour. Le plan garde tout, les cases cochées gardent leur numéro. */
const chauffesDuJour = (seance: Seance, plan: ExoPlan, exo: Exercice, chargeDuJour: number | null | undefined) =>
  plan.chauffes.map((c, i) => ({ c, i })).filter(({ c }) => !(seance.deload && chauffeTropLourde(exo, c, chargeDuJour)))

function ChauffesCochables({ seance, plan, exo, chargeDuJour, enRangee = false }: { seance: Seance; plan: ExoPlan; exo: Exercice; chargeDuJour: number | null | undefined; /** Dans la rangée des séries : le mot au-dessus, sur la largeur des pastilles. */ enRangee?: boolean }) {
  const chauffes = chauffesDuJour(seance, plan, exo, chargeDuJour)
  if (!chauffes.length) return null
  const pastilles = (
    <div className="chauffes-ligne">
      {!enRangee && <span className="titre">Échauffement</span>}
      {chauffes.map(({ c, i }) => {
        const cle = `${exo.id}:${i}`
        const fait = !!seance.chauffes[cle]
        const texte = texteChauffe(exo, c, chargeDuJour)
        return (
          <button
            key={cle}
            className={fait ? 'fait' : ''}
            aria-pressed={fait}
            onClick={() =>
              void majSeance(seance.id, (x) => {
                x.chauffes[cle] = !fait
              })
            }
          >
            {fait ? <Check size={16} /> : <Square size={16} />} {enRangee && chauffes.length > 2 ? texte.replace(' kg', '') : texte}
          </button>
        )
      })}
    </div>
  )
  return enRangee ? (
    <div className="chauffes-groupe">
      <div className="chauffes-groupe-titre">Échauffement</div>
      {pastilles}
    </div>
  ) : (
    pastilles
  )
}
