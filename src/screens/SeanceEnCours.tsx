import { createPortal } from 'react-dom'
import { Check, Flame, Frown, Info, Link2, Maximize2, Pencil, Play, Smile, StickyNote, Timer, TriangleAlert, Trophy, Wind, X } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Catalogue } from '../catalogue'
import Anneau from '../components/Anneau'
import CarteExo, { cibleSerie, Editeur, majSeance } from '../components/CarteExo'
import ChoixExo from '../components/ChoixExo'
import EditeurObjectif, { ObjectifApres } from '../components/EditeurObjectif'
import InfosExo, { BoutonInfos } from '../components/InfosExo'
import Interrupteur from '../components/Interrupteur'
import Minuteur, { BIPS_DEFAUT, resteRepos, type EtatMinuteur } from '../components/Minuteur'
import { ResumeSeance } from '../components/RecapSeance'
import { resumeSeance } from '../lib/motivation'
import { db, exoAvecReglages, historiqueDe, uid } from '../db'
import { debloquerSon, ecranAllume, signalSerie } from '../lib/appareil'
import { chrono, ecartSerie, lireChauffe, chargeQte, chargeTexte, cibleTexte, e1rm, enTemps, kg, minutes, reposApres, serieTexte } from '../lib/calc'
import { transition, useRetour } from '../lib/nav'
import { lireEquivalents, modifierEquivalents, relies, repere } from '../lib/equivalents'
import { suggestionDeload } from '../lib/cycle'
import { arreterSeanceNatif, natif, pauseNatif, reposNatif, seanceNatif, suivreNatif } from '../lib/natif'
import { conseil, hausse, pareil, raisonPareil, suggestionPour, type Suggestion } from '../lib/progression'
import { blocage } from '../lib/blocages'
import { estDansSuperset, groupeSuperset, prochainExoDeSeance, reposApresSuperset } from '../lib/superset'
import { phaseA } from '../lib/objectifs'
import type { Exercice, ExoPlan, Objectif, Reglage, Seance, Serie } from '../types'
import { FINISSEURS, typeFinisseur } from '../lib/finisseur'
import { planParDefaut } from './Seances'
import { confirmer } from '../components/Dialogues'
import Echauffement, { echauffementActif } from '../components/Echauffement'

function stocke<T>(cle: string, defaut: T): T {
  try {
    const v = localStorage.getItem(cle)
    return v ? (JSON.parse(v) as T) : defaut
  } catch {
    return defaut
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
    return m?.seanceId === seance.id ? m : null
  })
  const [toast, setToast] = useState<string | null>(null)
  // Mode plein écran : il le reste d'un repos à l'autre tant qu'on ne le réduit pas.
  // Plein écran par défaut : un nouveau découvre le grand chrono dès sa 1re série ; son choix est ensuite gardé.
  // Chaque séance démarre en plein écran (on y saisit tout sans défiler) ; la vue liste sert à regarder, à un appui.
  const [focus, setFocusEtat] = useState(true)
  const setFocus = (v: boolean) => (transition(() => setFocusEtat(v), 'fondu'), window.scrollTo({ top: 0 }))
  /** Plein écran pendant le repos : afficher quand même la saisie. */
  const [saisie, setSaisie] = useState(false)
  /** Plein écran : série en cours de correction. */
  const [corrige, setCorrige] = useState<string | null>(null)
  const reglageSon = useLiveQuery(() => db.reglages.get('sonValidation'), [])
  /** Fenêtre « suite de la séance » en plein écran. */
  const [suite, setSuite] = useState(false)
  const sonValidation = reglageSon?.valeur !== false
  /** Fiche d'exécution ouverte depuis le plein écran. */
  const [infos, setInfos] = useState<string | null>(null)
  // Barre des exercices : dégradé à droite tant qu'il reste des exercices cachés.
  const pills = useRef<HTMLDivElement>(null)
  const marquerDebord = () => {
    const el = pills.current
    if (el) el.classList.toggle('deborde', el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }
  useEffect(marquerDebord)
  /** Objectif réglé sur place (index de l'exercice dans la séance). */
  const [objectifDe, setObjectifDe] = useState<number | null>(null)
  const [fin, setFin] = useState(false)
  const [choix, setChoix] = useState<Choix | null>(null)
  const [machinePrise, setMachinePrise] = useState(false)
  /** Après un remplacement : proposer de relier les deux exercices. */
  const [lien, setLien] = useState<{ a: string; b: string } | null>(null)
  const [verrou, setVerrou] = useState(false)
  const maintenant = useHorloge(1000)
  const derniereTouche = useRef(0)
  const repriseAuto = useRef<((finRepos: number) => void) | null>(null)
  const reposTraite = useRef<number | null>(null)

  const plans = seance.exercices
  // Échauffement passé sans rien cocher : plus de pastille 🤸, il n'y a rien à revoir.
  const avecEchauffement = !!seance.echauffement?.ids.length && !(seance.echauffement.fini && !seance.echauffement.faits.length)
  const idx = idxBrut === -1 && avecEchauffement ? -1 : Math.max(0, Math.min(idxBrut, plans.length - 1))
  const surEchauffement = idx === -1 || echauffementActif(seance)

  // Quand l'échauffement se termine (tout coché, « Passer », 1re série), aller au 1er exercice. Une fois
  // fini, on peut toujours y revenir par la pastille 🤸 : seul le passage actif → fini fait avancer.
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
  // Navigation faite par l'utilisateur (pastilles, Précédent/Suivant, Y aller, plein écran ↔ liste) :
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
  }, [minuteur?.fin, minuteur?.pause, seance.series.length, seance.nom, reglages])
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
    if (!terminees) return [] as Suggestion[]
    return plans.map((p, i) => {
      const sugg = suggestionPour(exos[i], p, terminees)
      return seance.deload ? suggestionDeload(exos[i], sugg) : sugg
    })
  }, [terminees, exos, plans, seance.deload])

  if (!terminees || !reglages) return null

  const equivalents = lireEquivalents(reglages)
  /** Dernière note laissée sur cet exercice (réglage machine, sensation), pour la retrouver. */
  const noteAvant = (exoId: string) => terminees.find((s) => s.notes[exoId]?.trim())?.notes[exoId]
  /** Exercice jamais fait : la dernière perf d'un équivalent relié (séance du jour comprise). */
  const repereDe = (exoId: string) => {
    if (historiqueDe(terminees, exoId).length) return undefined
    const r = repere(exoId, equivalents, [seance, ...terminees])
    if (!r) return undefined
    const ref = catalogue.exo(r.exoId)
    return `${ref.nom}, ${chargeQte(ref, r.charge, r.reps)} @${kg(r.rpe)} (${r.date})`
  }

  const valider = (s: Serie, repos: number) => {
    debloquerSon()
    // Signal : mieux que la même série la dernière fois, ou fin de l'exercice (on change de machine).
    {
      const k = seance.series.filter((x) => x.exoId === s.exoId).length
      const i = plans.findIndex((p) => p.exoId === s.exoId)
      const avantSerie = seance.deload ? undefined : historiqueDe(terminees, s.exoId)[0]?.[k]
      const fini = i >= 0 && k + 1 >= totalDe(i)
      signalSerie(fini ? 'finExercice' : avantSerie && ecartSerie(s, avantSerie)?.sens === 'mieux' ? 'mieux' : 'normale', sonValidation)
    }
    // Verrou levé quand la série est écrite (voir plus haut), au pire après 8 s.
    setVerrou(true)
    setTimeout(() => setVerrou(false), 8000)
    if (repos > 0) {
      setMinuteur({ debut: Date.now(), fin: Date.now() + repos * 1000, duree: repos })
    } else {
      setMinuteur(null)
    }
    // Navigation / enchaînement superset : toast et bascule sur l'exercice suivant
    const curIdx = plans.findIndex((p) => p.exoId === s.exoId)
    if (curIdx >= 0 && plans[curIdx]?.enchaine && curIdx < plans.length - 1) {
      const suivant = exos[curIdx + 1]?.nom
      if (suivant) setToast(`⇄ Enchaîne : ${suivant}`)
      if (idx === curIdx) setIdx(curIdx + 1)
    }
    // Records (seulement s'il existe un historique pour comparer ; jamais en déload)
    if (seance.deload) return
    const exo = exoAvecReglages(catalogue.exo(s.exoId), reglages)
    const avant = historiqueDe(terminees, s.exoId).flat()
    if (avant.length === 0) return
    const memeCharge = avant.filter((x) => x.charge === s.charge)
    const e = e1rm(exo, s, seance.poidsCorps)
    const meilleur = Math.max(0, ...avant.map((x) => e1rm(exo, x, seance.poidsCorps) ?? 0))
    if (e && meilleur && e > meilleur) setToast(`Nouveau record : 1RM estimé à ${kg(e)} ${exo.mode === 'par_main' ? 'kg/main' : 'kg'}`)
    // Sans 1RM (pas de poids noté, isolation…) : une charge jamais soulevée est aussi un record.
    else if (!enTemps(exo) && s.reps > 0 && s.charge > Math.max(...avant.map((x) => x.charge)))
      setToast(`Nouveau record de charge : ${chargeTexte(exo, s.charge)} × ${s.reps}`)
    else if (memeCharge.length && s.reps > Math.max(...memeCharge.map((x) => x.reps)))
      setToast(enTemps(exo) ? `🏆 Nouveau record de temps à ${chargeTexte(exo, s.charge)} : ${s.reps} s` : `🏆 Nouveau record de reps à ${chargeTexte(exo, s.charge)} : ${s.reps}`)
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
      if (faites === 0) {
        await majSeance(seance.id, (s) => {
          s.exercices[c.i] = substitut
        })
      } else {
        // En cours de route : les séries faites restent sur l'original, les restantes passent au substitut.
        const total = ancien.series.length + (seance.ajustSeries[ancien.exoId] ?? 0)
        const restantes = Math.max(1, total - faites)
        await majSeance(seance.id, (s) => {
          s.ajustSeries[ancien.exoId] = faites - ancien.series.length
          const series = ancien.series.slice(Math.min(faites, ancien.series.length - 1))
          while (series.length < restantes) series.push({ ...series[series.length - 1] })
          s.exercices.splice(c.i + 1, 0, { ...substitut, series: series.slice(0, restantes) })
        })
        transition(() => setIdxEtat(c.i + 1), 'carte-avant')
        range(`idx:${seance.id}`, c.i + 1)
      }
      setToast(`${nomAncien} → ${exo.nom}${chargeAncien ? ` (${kg(chargeAncien)} kg)` : ''}`)
      if (!(equivalents[ancien.exoId] ?? []).includes(exoId)) setLien({ a: ancien.exoId, b: exoId })
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
    setMachinePrise(false)
    await majSeance(seance.id, (s) => {
      const a = s.exercices[i]
      s.exercices[i] = s.exercices[j]
      s.exercices[j] = a
      s.courant = s.exercices[i].exoId
    })
    setToast(`⇄ ${exos[j].nom} maintenant, ${exos[i].nom} à sa place`)
  }

  /** Changer d'ordre volontairement : cet exercice devient l'exercice en cours. */
  const faireMaintenant = async (i: number) => {
    await majSeance(seance.id, (s) => {
      s.courant = plans[i].exoId
    })
  }
  const allerEnCours = () => (enCours >= 0 ? naviguer(() => setIdx(enCours)) : ouvrirFin(true))

  /** Passer : l'exercice reste dans la séance, grisé ; le modèle ne change pas. */
  const passer = async (i: number) => {
    setMachinePrise(false)
    const id = plans[i].exoId
    await majSeance(seance.id, (s) => {
      s.passes = [...new Set([...(s.passes ?? []), id])]
      if (s.courant === id) s.courant = undefined
    })
    if (i < plans.length - 1) setIdx(i + 1)
    setToast(`${exos[i].nom} passé pour aujourd’hui`)
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
    setMachinePrise(false)
    const g = groupeSuperset(plans, i)
    await majSeance(seance.id, (s) => {
      for (const k of g) {
        s.exercices[k].enchaine = undefined
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
  // Temps restant : ~1 min par série et le repos qui la suit.
  const resteSec = plans.reduce((a, p, i) => {
    const t = totalDe(i)
    for (let k = nbFaites(p.exoId); k < t; k++) a += 60 + reposApres(p, k, t)
    return a
  }, 0)

  const ensuite = enCours >= 0 ? `${exos[enCours]?.nom} · série ${nbFaites(plans[enCours].exoId) + 1}/${totalDe(enCours)}` : 'Fin de séance 💪'
  ensuiteRef.current = ensuite
  const reposRestant = minuteur ? Math.max(0, Math.ceil(resteRepos(minuteur, maintenant))) : 0

  // Fin du repos : sans geste pendant le repos (téléphone posé), retour sur la série à faire.
  // Si l'utilisateur regardait autre chose, on ne le déplace pas : le minuteur propose « Reprendre ».
  repriseAuto.current = (finR) => {
    if (!minuteur || fin || enCours < 0 || Date.now() - finR > 60000) return
    const debut = minuteur.debut ?? finR - minuteur.duree * 1000
    if (derniereTouche.current > debut + 500) return
    if (enCours !== idx) setIdx(enCours)
    setTimeout(() => document.querySelector('.serie-bloc')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400)
  }

  if (fin) return <FinSeance seance={seance} terminees={terminees} reglages={reglages} catalogue={catalogue} onRetour={() => ouvrirFin(false)} />

  const plan = plans[idx]

  // Mode plein écran : le repos en grand, puis la carte de l'exercice en cours pour saisir la série.
  const reposEnCours = !!minuteur && !(minuteur.pause === undefined && minuteur.fin <= maintenant)
  const vueRepos = reposEnCours && !saisie
  const pastilles = (
    <div className="pills" ref={pills} onScroll={marquerDebord}>
      {avecEchauffement && (
        <button
          className={(surEchauffement ? 'actif ' : '') + (!echauffementActif(seance) ? 'fait echauffement-fini' : 'en-cours')}
          onClick={() => naviguer(() => setIdx(-1))}
          aria-label="Échauffement (terminé, le revoir)"
        >
          🤸
        </button>
      )}
      {plans.map((p, i) => {
        const passe = estPasse(i)
        const fait = !passe && nbFaites(p.exoId) >= totalDe(i)
        const enCoursExo = !echauffementActif(seance) && i === enCours
        return (
          <button
            key={p.exoId + i}
            className={(!surEchauffement && i === idx ? 'actif ' : '') + (fait ? 'fait ' : '') + (passe ? 'passe ' : '') + (enCoursExo ? 'en-cours' : '')}
            onClick={() => naviguer(() => setIdx(i))}
            aria-label={enCoursExo ? `Exercice ${i + 1}, en cours` : undefined}
          >
            {fait ? '✓' : passe ? '–' : i + 1}
          </button>
        )
      })}
      <button onClick={() => setChoix({ mode: 'ajouter' })} aria-label="Ajouter un exercice">
        +
      </button>
    </div>
  )
  const avancementCompact = (
    <div className="focus-haut">
      <div className="ligne focus-avancement">
        <Anneau valeur={avancement} taille={46} label={`${Math.round(avancement * 100)} % de la séance fait`}>
          <span className="anneau-pct">{Math.round(avancement * 100)}%</span>
        </Anneau>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div>
            <strong>{restantes > 0 ? `Reste ${restantes} série${restantes > 1 ? 's' : ''}` : 'Tout est fait'}</strong>
            {resteSec > 0 && <span className="faible"> · ~{minutes(Math.max(1, Math.round(resteSec / 60)))}</span>}
          </div>
          <div className="faible ligne" style={{ gap: 'var(--e1)' }}>
            <Timer size={14} /> {chronoSeance(maintenant - seance.debut)}
          </div>
        </div>
      </div>
      <div className="focus-boutons">
        {/* Pendant l'échauffement : on y reste (pas de saut vers un exercice, pas de « Machine prise »). */}
        <button className="btn petit" onClick={() => naviguer(() => (!echauffementActif(seance) && enCours >= 0 && setIdx(enCours), setFocus(false)))}>
          Voir la séance
        </button>
        {enCours >= 0 && !echauffementActif(seance) && restantes > 0 && (
          <button className="btn petit" onClick={() => (setIdx(enCours), setMachinePrise(true))}>
            Machine prise
          </button>
        )}
        <button className="btn petit" onClick={() => (setFocus(false), ouvrirFin(true))}>
          Fin de séance
        </button>
      </div>
      {maintenant - seance.debut > 4 * 3600000 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 12px', background: 'var(--surface-2)', border: '1px solid var(--bord)', borderRadius: 'var(--rayon-2)', marginTop: 8 }}>
          <span className="faible" style={{ color: 'var(--texte)' }}><TriangleAlert size={14} className="ico-texte" /> Séance ouverte depuis plus de 4 h</span>
          <button className="btn primaire petit" onClick={() => (setFocus(false), ouvrirFin(true))}>
            Terminer
          </button>
        </div>
      )}
    </div>
  )

  // Fenêtres communes à la vue normale et au plein écran (Machine prise, remplacement, lien d'équivalents).
  const fenetres = (
    <>
      {sortie && (
        <SortieSeance
          series={seance.series.length}
          onContinuer={() => setSortie(false)}
          onTerminer={() => (setSortie(false), setFocus(false), ouvrirFin(true))}
          onSupprimer={async () => {
            if (await confirmer('Les séries déjà faites seront effacées.', { titre: 'Supprimer cette séance ?', oui: 'Supprimer la séance', non: 'Garder', danger: true })) void annulerSeance(seance.id)
          }}
        />
      )}
      {machinePrise && plan && (
        <MachinePrise
          nom={exos[idx].nom}
          entame={nbFaites(plan.exoId) > 0}
          autres={plans
            .map((_, j) => j)
            .filter((j) => j !== idx && !estPasse(j) && nbFaites(plans[j].exoId) < totalDe(j))
            .map((j) => ({ i: j, nom: exos[j].nom, entame: nbFaites(plans[j].exoId) > 0 }))}
          onEchanger={(j) => echanger(idx, j)}
          onRemplacer={() => (setMachinePrise(false), setChoix({ mode: 'remplacer', i: idx }))}
          onPasser={() => passer(idx)}
          onDelierSuperset={estDansSuperset(plans, idx) ? () => delierSuperset(idx) : undefined}
          onFermer={() => setMachinePrise(false)}
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
      {lien && (
        <div className="modal-fond" onClick={() => setLien(null)}>
          <div className="modal pile" onClick={(e) => e.stopPropagation()}>
            <h2>Relier ces deux exercices ?</h2>
            <div>
              <strong>{catalogue.exo(lien.a).nom}</strong> ⇄ <strong>{catalogue.exo(lien.b).nom}</strong>
            </div>
            <div className="faible">
              La prochaine fois que l’un est pris, l’autre te sera proposé en premier, et tu verras ta dernière perf sur l’un la première fois que tu fais
              l’autre. Chacun garde sa propre progression.
            </div>
            <button
              className="btn primaire grand"
              onClick={() => {
                void modifierEquivalents((eq) => relies(eq, lien.a, lien.b))
                setLien(null)
              }}
            >
              Relier
            </button>
            <button className="btn discret plein" onClick={() => setLien(null)}>
              Pas cette fois
            </button>
          </div>
        </div>
      )}
    </>
  )

  if (focus) {
    // La série qu'on vient de faire : battue (on le fête), et de quel exercice (pour la corriger s'il est fini).
    const derniere = (() => {
      if (!derniereSerie) return null
      const i = plans.findIndex((p) => p.exoId === derniereSerie.exoId)
      if (i < 0) return null
      const k = seance.series.filter((x) => x.exoId === derniereSerie.exoId).indexOf(derniereSerie)
      const avant = seance.deload ? undefined : historiqueDe(terminees, derniereSerie.exoId)[0]?.[k]
      const e = avant && ecartSerie(derniereSerie, avant, exos[i])
      return { i, k, mieux: e?.sens === 'mieux' ? e.texte : null }
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
      const groupe = groupeSuperset(plans, enCours)
      const enSuperset = groupe.length > 1
      return (
        <div className={'focus-bloc prochaine-grand' + (exoFini ? ' nouvel-exo' : '')}>
          {derniere?.mieux && <div className="mieux-titre">↑ {derniere.mieux} vs la dernière fois</div>}
          {enSuperset && (
            <div className="ligne wrap" style={{ gap: 6, marginBottom: 4, alignItems: 'center' }}>
              <span className="badge-superset"><Link2 size={14} /> Superset</span>
              <span className="faible" style={{ fontSize: 'var(--t-petit)' }}>
                {groupe.map((gIdx, k) => (
                  <span key={plans[gIdx].exoId}>
                    {k > 0 ? ' ⇄ ' : ''}
                    <span style={{ fontWeight: gIdx === enCours ? '700' : '400', color: gIdx === enCours ? 'var(--texte)' : 'inherit' }}>
                      {exos[gIdx].nom}
                    </span>
                  </span>
                ))}
              </span>
            </div>
          )}
          {exoFini ? (
            <>
              <div className="ligne entre ligne-terminee">
                <div className="nouvel-exo-titre">
                  <Check size={16} /> <span>{exoFini} terminé</span>
                </div>
                <button className="btn discret petit" onClick={() => setCorrige(derniereSerie!.id)} aria-label={`Corriger la série ${derniere!.k + 1}`}>
                  Corriger
                </button>
              </div>
              <div className="faible">Exercice suivant</div>
            </>
          ) : (
            <div className="faible">Prochaine série</div>
          )}
          <div className="ligne entre">
            <h2>{exo.nom}</h2>
            <BoutonInfos onClick={() => setInfos(exo.id)} />
          </div>
          {p.finisseur && n === t - 1 && <span className="pastille fin">★ {FINISSEURS[typeFinisseur(p)].nom}</span>}
          {enSuperset ? (
            <div className="pile" style={{ gap: 6, margin: '6px 0' }}>
              {groupe.map((gIdx) => {
                const gPlan = plans[gIdx]
                const gExo = exos[gIdx]
                const gFaites = seance.series.filter((x) => x.exoId === gPlan.exoId)
                const gTotal = totalDe(gIdx)
                const estActif = gIdx === enCours
                return (
                  <div key={gPlan.exoId} className={'ligne entre' + (estActif ? '' : ' groupe-inactif')}>
                    <span className="faible" style={{ fontSize: 'var(--t-legende)', fontWeight: estActif ? '700' : 'normal', minWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {estActif && <Play size={11} fill="currentColor" className="ico-texte" />} {gExo.nom.slice(0, 12)} :
                    </span>
                    <LigneSeries
                      exo={gExo}
                      faites={gFaites}
                      total={gTotal}
                      cible={(k) => cibleSerie(gExo, gPlan, suggestions[gIdx], k, gFaites)}
                      onCorriger={(f) => setCorrige(f.id)}
                    />
                  </div>
                )
              })}
            </div>
          ) : (
            // Rien de fait sur cet exercice : la cible dessous suffit, les pastilles ne servent qu'à corriger.
            n > 0 && <LigneSeries exo={exo} faites={seance.series.filter((x) => x.exoId === p.exoId)} total={t} cible={(k) => cibleSerie(exo, p, suggestions[enCours], k, seance.series.filter((x) => x.exoId === p.exoId))} onCorriger={(f) => setCorrige(f.id)} />
          )}
          <div className="cible-grand">{cibleSerie(exo, p, suggestions[enCours], n, seance.series.filter((x) => x.exoId === p.exoId))}</div>
          {plus && <div className="badge-hausse grand"><Flame size={16} /> ↑ {plus} par rapport à la dernière fois</div>}
          {avant && <div className="faible">Dernière fois : {serieTexte(exo, avant)}</div>}
          {n === 0 && <ChauffesCochables seance={seance} plan={p} exo={exo} />}
          {(p.note || exo.notes) && <div className="faible"><Info size={14} className="ico-texte" /> {p.note ?? exo.notes}</div>}
        </div>
      )
    })()
    // Correction : une fenêtre par-dessus le plein écran, le repos continue derrière.
    const correction = (() => {
      const serie = corrige ? seance.series.find((x) => x.id === corrige) : undefined
      const i = serie ? plans.findIndex((p) => p.exoId === serie.exoId) : -1
      if (!serie || i < 0) return null
      const reste = minuteur ? resteRepos(minuteur, maintenant) : 0
      const repos = !minuteur ? null : minuteur.pause !== undefined ? `Repos en pause · ${chrono(Math.ceil(reste))}` : reste > 0 ? `Repos ${chrono(Math.ceil(reste))}` : 'Repos terminé'
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

    return (
      <div ref={ecranFocus} className={'focus' + (vueRepos ? ' fixe' : '')}>
        {avancementCompact}
        {minuteur && <Minuteur etat={minuteur} onChange={setMinuteur} variante={vueRepos ? 'grand' : 'bandeau'} />}
        {correction}
        {vueRepos ? (
          <>
            {prochaine}
            {plans.some((pl, j) => j !== enCours && !estPasse(j) && nbFaites(pl.exoId) < totalDe(j)) && (
              <button className="btn discret plein" onClick={() => setSuite(true)}>
                Voir la suite de la séance ›
              </button>
            )}
          </>
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
            const groupe = groupeSuperset(plans, enCours)
            const enSuperset = groupe.length > 1
            return (
              <div className="focus-bloc pile saisie-focus">
                {enSuperset && (
                  <div className="ligne wrap" style={{ gap: 6, alignItems: 'center' }}>
                    <span className="badge-superset"><Link2 size={14} /> Superset</span>
                    <span className="faible" style={{ fontSize: 'var(--t-petit)' }}>
                      {groupe.map((gIdx, k) => (
                        <span key={plans[gIdx].exoId}>
                          {k > 0 ? ' ⇄ ' : ''}
                          <span style={{ fontWeight: gIdx === enCours ? '700' : '400', color: gIdx === enCours ? 'var(--texte)' : 'inherit' }}>
                            {exos[gIdx].nom}
                          </span>
                        </span>
                      ))}
                    </span>
                  </div>
                )}
                {/* Superset : le nom de l'exercice est déjà dans la ligne au-dessus. */}
                <div className="ligne entre" style={{ alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    {p.finisseur && n === t - 1 && <div className="faible">★ {FINISSEURS[typeFinisseur(p)].nom}</div>}
                    {!enSuperset && <h2>{exo.nom}</h2>}
                  </div>
                  {!enSuperset && <BoutonInfos onClick={() => setInfos(exo.id)} />}
                </div>
                {enSuperset ? (
                  <div className="pile" style={{ gap: 6, margin: '6px 0' }}>
                    {groupe.map((gIdx) => {
                      const gPlan = plans[gIdx]
                      const gExo = exos[gIdx]
                      const gFaites = seance.series.filter((x) => x.exoId === gPlan.exoId)
                      const gTotal = totalDe(gIdx)
                      const estActif = gIdx === enCours
                      return (
                        <div key={gPlan.exoId} className={'ligne entre' + (estActif ? '' : ' groupe-inactif')}>
                          <span className="faible" style={{ fontSize: 'var(--t-legende)', fontWeight: estActif ? '700' : 'normal', minWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {estActif && <Play size={11} fill="currentColor" className="ico-texte" />} {gExo.nom.slice(0, 12)} :
                          </span>
                          <LigneSeries
                            exo={gExo}
                            faites={gFaites}
                            total={gTotal}
                            cible={(k) => cibleSerie(gExo, gPlan, suggestions[gIdx], k, gFaites)}
                            onCorriger={(f) => setCorrige(f.id)}
                          />
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <LigneSeries exo={exo} faites={seance.series.filter((x) => x.exoId === p.exoId)} total={t} cible={(k) => cibleSerie(exo, p, suggestions[enCours], k, seance.series.filter((x) => x.exoId === p.exoId))} onCorriger={(f) => setCorrige(f.id)} />
                )}
                {n === 0 && <ChauffesCochables seance={seance} plan={p} exo={exo} />}
                {(derniereFois?.[n] || plus) && (
                  <div className="faible">
                    {derniereFois?.[n] && <>Dernière fois : {serieTexte(exo, derniereFois[n])}</>}
                    {plus && <span className="badge-hausse"> ↑ {plus}</span>}
                  </div>
                )}
                {noteAvant(p.exoId) && !seance.notes[p.exoId] && <div className="faible"><StickyNote size={14} className="ico-texte" /> La dernière fois : {noteAvant(p.exoId)}</div>}
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
                  onFini={(s) => valider(s, reposApresSuperset(plans, enCours, n, t))}
                  onAnnulerEdition={() => undefined}
                />
              </div>
            )
          })()
        ) : (
          <div className="focus-bloc pile">
            <h2>Toutes les séries sont faites</h2>
            <button className="btn primaire grand" onClick={() => (setFocus(false), ouvrirFin(true))}>
              Terminer la séance
            </button>
          </div>
        )}
        {fenetres}
        {suite && (
          <SuiteSeance
            exos={plans
              .map((pl, j) => ({
                j,
                nom: exos[j].nom,
                exo: exos[j],
                plan: pl,
                sugg: suggestions[j],
                faites: seance.series.filter((x) => x.exoId === pl.exoId),
                total: totalDe(j),
                passe: estPasse(j),
                derniereFois: historiqueDe(terminees, pl.exoId)[0],
                note: pl.note || exos[j].notes || noteAvant(pl.exoId),
                chauffes: pl.chauffes,
              }))
              .filter((x) => x.j !== enCours && !x.passe && x.faites.length < x.total)}
            onFermer={() => setSuite(false)}
          />
        )}
        {toast && <div className="toast">{toast}</div>}
        {objectifDe !== null && plans[objectifDe] && (
          <ObjectifApres exo={exos[objectifDe]} plan={plans[objectifDe]} terminees={terminees} onFermer={() => setObjectifDe(null)} />
        )}
        {infos && <InfosExo exo={exoAvecReglages(catalogue.exo(infos), reglages)} onFermer={() => setInfos(null)} />}
      </div>
    )
  }

  return (
    <div>
      <div className="entete colle">
        <div className="ligne entre" style={{ marginBottom: 10 }}>
          {/* Avancement et chrono ; un appui ouvre le plein écran. */}
          <button className="resume-seance" onClick={() => naviguer(() => setFocus(true))} aria-label="Plein écran">
            <Anneau valeur={avancement} taille={40} label={`${Math.round(avancement * 100)} % de la séance fait`}>
              <span className="anneau-pct">{Math.round(avancement * 100)}%</span>
            </Anneau>
            <span>
              <strong className="chrono-seance">{chronoSeance(maintenant - seance.debut)}</strong>
              <span className="faible">
                {totalSeries > 0 && (restantes > 0 ? `reste ${restantes} série${restantes > 1 ? 's' : ''}` : 'tout est fait')}
              </span>
              <span className="indice-plein-ecran"><Maximize2 size={12} className="ico-texte" /> Plein écran</span>
            </span>
          </button>
          <button className="btn" onClick={() => ouvrirFin(true)}>
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
        {seance.deload && <div className="bandeau-deload"><Wind size={16} className="ico-texte" /> Déload : charges −10 %, RPE 6-7, sans échec. Récupère, ne force pas.</div>}
        {!echauffementActif(seance) && pastilles}
        {!surEchauffement && enCours >= 0 && enCours !== idx && (
          <div className="legende-pills">
            <span>
              <i style={{ background: 'var(--accent)' }} />
              en cours : {exos[enCours]?.nom}
            </span>
            <span>
              <i style={{ border: '2px solid var(--accent)' }} />
              affiché
            </span>
          </div>
        )}
      </div>

      {surEchauffement ? (
        <Echauffement seance={seance} onPasser={() => setIdx(Math.max(0, enCours))} />
      ) : plan ? (
        <CarteExo
          key={plan.exoId + idx}
          seance={seance}
          plan={plan}
          exo={exos[idx]}
          sugg={suggestions[idx]}
          derniere={historiqueDe(terminees, plan.exoId)[0]}
          onValide={valider}
          onMachinePrise={() => setMachinePrise(true)}
          reposRestant={reposRestant}
          verrou={verrou}
          consultation={idx !== enCours}
          enCoursNom={enCours >= 0 ? exos[enCours]?.nom : undefined}
          onFaireMaintenant={() => faireMaintenant(idx)}
          passe={estPasse(idx)}
          onAnnulerPasser={() => annulerPasser(idx)}
          onAllerEnCours={allerEnCours}
          repere={repereDe(plan.exoId)}
          onObjectif={!seance.deload && historiqueDe(terminees, plan.exoId).length ? () => setObjectifDe(idx) : undefined}
          noteAvant={noteAvant(plan.exoId)}
          bloque={seance.deload || phaseA(catalogue.objectifs, seance.date)?.phase === 'seche' ? 0 : (blocage(exos[idx], terminees ?? [], seance.date)?.semaines ?? 0)}
        />
      ) : (
        <div className="carte pile">
          <h2>Séance libre</h2>
          <div className="muted">Ajoute tes exercices au fur et à mesure.</div>
          <button className="btn primaire grand" onClick={() => setChoix({ mode: 'ajouter' })}>
            + Ajouter un exercice
          </button>
        </div>
      )}

      {!surEchauffement && plan && (
        <div className="ligne entre" style={{ marginBottom: 110 }}>
          <button className="btn" disabled={idx === 0 && !avecEchauffement} onClick={() => naviguer(() => setIdx(idx - 1))}>
            ← Précédent
          </button>
          {idx < plans.length - 1 ? (
            <button className="btn primaire" onClick={() => naviguer(() => setIdx(idx + 1))}>
              Suivant →
            </button>
          ) : (
            <button className="btn primaire" onClick={() => ouvrirFin(true)}>
              Terminer la séance
            </button>
          )}
        </div>
      )}

      {fenetres}
      {toast && <div className="toast">{toast}</div>}
      {objectifDe !== null && plans[objectifDe] && (
        <ObjectifApres exo={exos[objectifDe]} plan={plans[objectifDe]} terminees={terminees} onFermer={() => setObjectifDe(null)} />
      )}
      {minuteur && (
        <Minuteur
          etat={minuteur}
          onChange={setMinuteur}
          ensuite={ensuite}
          onAller={enCours >= 0 && enCours !== idx ? () => naviguer(() => setIdx(enCours)) : enCours < 0 ? () => ouvrirFin(true) : undefined}
          onAgrandir={() => naviguer(() => setFocus(true))}
        />
      )}
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
  const option = (titre: string, detail: string, fn: () => void, actif = true) =>
    actif && (
      <button className="liste-btn" onClick={fn}>
        <span>
          <strong>{titre}</strong>
          <div className="faible">{detail}</div>
        </span>
        <span className="muted">›</span>
      </button>
    )
  return (
    <div className="modal-fond" onClick={onFermer}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {echange ? (
          <>
            <h2>Échanger {nom}</h2>
            <div className="faible" style={{ margin: '4px 0 14px' }}>
              Quel exercice fais-tu maintenant ? {nom} prendra sa place dans la séance.
            </div>
            {autres.map((a) => (
              <button key={a.i} className="liste-btn" onClick={() => onEchanger(a.i)}>
                <span>
                  <strong>{a.nom}</strong>
                  <div className="faible">
                    exercice {a.i + 1}
                    {a.entame ? ' · déjà commencé' : ''}
                  </div>
                </span>
                <span className="muted">⇄</span>
              </button>
            ))}
            <button className="btn discret plein" onClick={() => setEchange(false)}>
              Retour
            </button>
          </>
        ) : (
          <>
            <h2>Machine prise</h2>
            <div className="faible" style={{ margin: '4px 0 14px' }}>
              {nom}
            </div>
            {option('⇄ Échanger', 'Faire un autre exercice de la séance maintenant ; celui-ci prend sa place.', () => setEchange(true), autres.length > 0)}
            {option(
              '🔁 Remplacer',
              entame ? 'Les séries restantes passent sur un autre exercice.' : 'Par un exercice du même muscle, avec son propre historique.',
              onRemplacer
            )}
            {onDelierSuperset && option('🔗 Délier le superset', 'Faire les exercices séparément sans alterner les séries aujourd’hui.', onDelierSuperset)}
            {option('✕ Passer', 'Sauter cet exercice aujourd’hui. Il reste grisé dans la séance, tu peux y revenir.', onPasser)}
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
  const [nomModele, setNomModele] = useState('')
  const [objectifs, setObjectifs] = useState<Record<string, Objectif>>(seance.objectifs ?? {})
  const [ajuste, setAjuste] = useState<string | null>(null)
  /** Exercices dont on a déplié les séries. */
  const [ouverts, setOuverts] = useState<Record<string, boolean>>({})
  const basculer = (id: string) => setOuverts((x) => ({ ...x, [id]: !x[id] }))
  const libre = !modele && seance.exercices.length > 0

  const choisirForme = (v: number) => {
    const n = forme === v ? undefined : v
    setForme(n)
    setRessenti(n)
    setEnergie(n)
  }

  // « Prochaine fois » : par défaut, refaire exactement cette séance ; l'utilisateur monte lui-même.
  const avecCelleCi = [seance, ...terminees]
  const suggestionDe = (exoId: string) => {
    const p = seance.exercices.find((x) => x.exoId === exoId)!
    const exo = exoAvecReglages(catalogue.exo(exoId), reglages)
    const histo = historiqueDe(avecCelleCi, exoId)
    return { exo, s: pareil(exo, p, histo), conseil: conseil(exo, p, histo), raison: raisonPareil(exo, p, histo) }
  }
  const faits = seance.exercices.filter((p) => seance.series.some((s) => s.exoId === p.exoId))
  const lignes = faits.map((plan) => ({ plan, ...suggestionDe(plan.exoId) }))
  // En déload, rien à décider : tout passe dans la liste simple.
  const aDecider = seance.deload ? [] : lignes.filter((l) => l.conseil)
  const autres = seance.deload ? lignes : lignes.filter((l) => !l.conseil)
  const retirerObjectif = (id: string) =>
    setObjectifs((x) => {
      const { [id]: _retire, ...reste } = x
      return reste
    })
  const seriesDuJour = (exo: Exercice) => seance.series.filter((x) => x.exoId === exo.id)
  /** « 105 kg × 10/10/10 » : ce qui a été fait aujourd'hui sur l'exercice. */
  const resumeDuJour = (exo: Exercice) => {
    const l = seriesDuJour(exo)
    return cibleTexte(exo, l.map((x) => x.charge), l.map((x) => x.reps))
  }
  /** Une ligne : objectif fixé, raison de refaire pareil, ou comparaison avec la dernière fois. */
  const statut = (exo: Exercice, raison: string | null) => {
    const o = objectifs[exo.id]
    if (o) return `✎ prochaine fois ${cibleTexte(exo, o.charges, o.reps)}`
    if (seance.deload) return 'déload'
    if (raison) return raison
    const avant = historiqueDe(terminees, exo.id)[0] ?? []
    if (!avant.length) return '1re fois · prochaine fois : pareil'
    const sens = seriesDuJour(exo).map((x, k) => ecartSerie(x, avant[k], exo)?.sens)
    if (sens.includes('mieux')) return '↑ mieux que la dernière fois · prochaine fois : pareil'
    if (sens.every((x) => x === 'egal')) return '= comme la dernière fois'
    return 'un peu moins que la dernière fois · prochaine fois : pareil'
  }
  /** Les séries du jour, en clair, comparées à la dernière fois. */
  const detailSeries = (exo: Exercice) => {
    const avant = historiqueDe(terminees, exo.id)[0] ?? []
    return (
      <div className="pile fin-detail">
        {seriesDuJour(exo).map((x, k) => {
          const e = ecartSerie(x, avant[k], exo)
          return (
            <div key={x.id} className="ligne entre" style={{ gap: 8 }}>
              <span>
                <span className="faible">S{k + 1} </span>
                {serieTexte(exo, x, true)}
                <span className="faible"> · effort {kg(x.rpe)}/10</span>
                {x.douleur ? ' ⚠️' : ''}
              </span>
              {e && <span className={'avant ' + e.sens}>{e.sens === 'mieux' ? '↑ ' : e.sens === 'egal' ? '= ' : '↓ '}{e.texte}</span>}
            </div>
          )
        })}
      </div>
    )
  }

  const enregistrer = async () => {
    let modeleId = seance.modeleId
    if (garder && libre) {
      modeleId = 'm_' + uid()
      await db.modeles.put({ id: modeleId, nom: nomModele.trim() || 'Séance libre', sousTitre: '', exercices: structuredClone(seance.exercices) })
    }
    const heures = seance.series.map((x) => x.heure).filter((h): h is number => typeof h === 'number' && h > 0)
    const fin = Date.now() - seance.debut > 4 * 3600000 && heures.length ? Math.max(...heures) : Date.now()
    await db.seances.update(seance.id, { enCours: false, fin, ressenti, energie, modeleId, objectifs })
    oublierEtatLocal(seance.id)
  }

  const abandonner = async () => {
    const ok = seance.series.length
      ? await confirmer('Les séries déjà faites seront effacées.', { titre: 'Supprimer cette séance ?', oui: 'Supprimer la séance', non: 'Reprendre', danger: true })
      : await confirmer('Rien n’a encore été enregistré.', { titre: 'Annuler la séance ?', oui: 'Annuler la séance', non: 'Reprendre', danger: true })
    if (!ok) return
    await annulerSeance(seance.id)
  }

  return (
    <div className="apparait">
      <div className="entete">
        <button className="btn" onClick={onRetour} aria-label="Reprendre la séance">
          ←
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ whiteSpace: 'nowrap', fontSize: 'clamp(20px, 6vw, 28px)' }}>Fin de séance</h1>
        </div>
      </div>
      <div className="carte">
        <h2>{seance.nom}</h2>
        {(() => {
          // Le moment où on est le plus réceptif : ce qui a été mieux aujourd'hui (jamais en déload).
          const r = seance.deload ? null : resumeSeance(seance, terminees, catalogue.exo)
          if (!r || (!r.mieux && !r.records)) return null
          const morceaux = [
            r.mieux > 0 && `${r.mieux} exercice${r.mieux > 1 ? 's' : ''} mieux que la dernière fois`,
            r.records > 0 && `${r.records} record${r.records > 1 ? 's' : ''}`,
          ].filter(Boolean)
          return (
            <div className="mieux-titre" style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              {r.records > 0 && <Trophy size={14} style={{ color: 'var(--accent)' }} />}
              <span>↑ {morceaux.join(', ')}</span>
            </div>
          )
        })()}
        <ResumeSeance seance={seance} exo={catalogue.exo} />
      </div>

      {/* Ce qui compte : décider de la prochaine fois, seulement là où il y a un conseil. Le reste en une ligne. */}
      {aDecider.length > 0 && (
        <>
          <h3 style={{ margin: '18px 0 8px' }}>À décider pour la prochaine fois</h3>
          {aDecider.map(({ plan, exo, s: base, conseil: c }) => {
            const o = objectifs[exo.id]
            const choix = !o ? 'pareil' : JSON.stringify([o.charges, o.reps]) === JSON.stringify([c!.charges, c!.reps]) ? 'conseil' : 'perso'
            return (
              <div key={plan.exoId} className="carte pile decision">
                <div className="ligne entre" style={{ alignItems: 'baseline', gap: 8 }}>
                  <strong>{exo.nom}</strong>
                  <span className="faible petit">aujourd’hui {resumeDuJour(exo)}</span>
                </div>
                <div className="choix-prochaine" role="radiogroup" aria-label={`Prochaine fois, ${exo.nom}`}>
                  <button type="button" role="radio" aria-checked={choix === 'pareil'} className={choix === 'pareil' ? 'actif' : ''} onClick={() => retirerObjectif(exo.id)}>
                    <span className="faible petit">Comme aujourd’hui</span>
                    <strong>{cibleTexte(exo, base.charges, base.reps)}</strong>
                  </button>
                  <button type="button" role="radio" aria-checked={choix === 'conseil'} className={choix === 'conseil' ? 'actif' : ''} onClick={() => setObjectifs((x) => ({ ...x, [exo.id]: { charges: c!.charges, reps: c!.reps } }))}>
                    <span className="faible petit">{(c!.titre ?? 'Conseil').replace(/^💡\s*/, '')}</span>
                    <strong>{cibleTexte(exo, c!.charges, c!.reps)}</strong>
                  </button>
                </div>
                {choix === 'perso' && <div className="faible">✎ Fixé par toi : {cibleTexte(exo, o!.charges, o!.reps)}</div>}
                <div className="faible" style={{ whiteSpace: 'pre-line' }}>
                  {c!.message}
                </div>
                <div className="ligne entre">
                  <button type="button" className="btn discret petit" onClick={() => basculer(exo.id)} aria-expanded={!!ouverts[exo.id]}>
                    {ouverts[exo.id] ? 'Masquer les séries' : 'Voir les séries'}
                  </button>
                  <button type="button" className="btn discret petit" onClick={() => setAjuste(exo.id)}>
                    ✎ Autre objectif
                  </button>
                </div>
                {ouverts[exo.id] && detailSeries(exo)}
              </div>
            )
          })}
        </>
      )}

      {autres.length > 0 && (
        <>
          <h3 style={{ margin: '18px 0 8px' }}>{aDecider.length ? 'Les autres exercices' : 'Tes exercices'}</h3>
          {seance.deload && <div className="faible" style={{ marginBottom: 8 }}>Séance de déload : pas d’objectif à fixer, la prochaine vraie séance reprend là où tu en étais.</div>}
          <div className="carte pile" style={{ gap: 0, paddingTop: 4, paddingBottom: 4 }}>
            {autres.map(({ plan, exo, raison }) => (
              <div key={plan.exoId}>
                <div className="ligne-fin">
                  <button type="button" className="ligne-fin-principal" onClick={() => basculer(exo.id)} aria-expanded={!!ouverts[exo.id]}>
                    <strong>{exo.nom}</strong>
                    <span className="faible petit">
                      {resumeDuJour(exo)} · {statut(exo, raison)}
                    </span>
                  </button>
                  {!seance.deload && (
                    <button type="button" className="btn discret petit" onClick={() => setAjuste(exo.id)} aria-label={`Fixer un objectif pour ${exo.nom}`}>
                      ✎
                    </button>
                  )}
                </div>
                {ouverts[exo.id] && detailSeries(exo)}
              </div>
            ))}
          </div>
        </>
      )}

      {libre && (
        <div className="carte pile">
          <Interrupteur
            on={garder}
            onChange={setGarder}
            label="Enregistrer comme séance réutilisable"
            aide="Tu pourras la relancer ou l’ajouter à un programme depuis l’onglet Programmes."
          />
          {garder && <input placeholder="Nom de la séance" value={nomModele} onChange={(e) => setNomModele(e.target.value)} />}
        </div>
      )}
      {ajuste &&
        (() => {
          const p = suggestionDe(ajuste)
          const histo = historiqueDe(terminees, ajuste)
          const faitesExo = seance.series.filter((x) => x.exoId === ajuste)
          const record = Math.max(0, ...histo.flat().map((x) => e1rm(p.exo, x, seance.poidsCorps) ?? 0))
          const meilleur = Math.max(0, ...faitesExo.map((x) => e1rm(p.exo, x, seance.poidsCorps) ?? 0))
          return (
            <EditeurObjectif
              exo={p.exo}
              base={p.s}
              actuel={objectifs[ajuste]}
              faites={faitesExo}
              precedente={histo[0] ?? []}
              record={record > 0 && meilleur > record}
              onFermer={() => setAjuste(null)}
              onValider={(o) => (setObjectifs((x) => ({ ...x, [ajuste]: o })), setAjuste(null))}
              onDefaut={() => (retirerObjectif(ajuste), setAjuste(null))}
            />
          )
        })()}

      {seance.series.length > 0 && (
        <div className="carte pile" style={{ gap: 8, marginTop: 16 }}>
          <div className="faible" style={{ fontSize: 'var(--t-petit)' }}>
            Sensations générales · facultatif
          </div>
          <div className="ligne" style={{ gap: 8 }}>
            {OPTIONS_FORME.map((o) => {
              const actif = forme === o.val
              return (
                <button
                  key={o.val}
                  type="button"
                  className={'btn ' + (actif ? 'primaire' : 'discret')}
                  style={{
                    flex: 1,
                    padding: '10px 4px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 'var(--t-petit)',
                    fontWeight: actif ? 700 : 500,
                  }}
                  onClick={() => choisirForme(o.val)}
                >
                  <o.Icon size={20} strokeWidth={actif ? 2.5 : 2} style={{ color: actif ? 'var(--blanc)' : o.couleur }} />
                  <span>{o.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {seance.series.length > 0 ? (
        <>
          <div className="barre-enregistrer">
            <button className="btn primaire grand" onClick={enregistrer}>
              ✓ ENREGISTRER LA SÉANCE
            </button>
          </div>
          <button className="btn discret danger plein" style={{ marginTop: 8 }} onClick={abandonner}>
            Supprimer la séance
          </button>
        </>
      ) : (
        <div style={{ marginTop: 20 }}>
          <button
            className="btn primaire grand"
            style={{ width: '100%' }}
            onClick={() => void annulerSeance(seance.id)}
          >
            Quitter sans enregistrer
          </button>
        </div>
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

function LigneSeries({ exo, faites, total, cible, onCorriger }: { exo: Exercice; faites: Serie[]; total: number; cible: (k: number) => string; onCorriger?: (s: Serie) => void }) {
  // Toutes les séries de l'exercice, chacune une seule fois : faites (✎ pour corriger), en cours (▶, sa cible est affichée en grand à côté), à venir.
  const rangee = useRef<HTMLDivElement>(null)
  // Une seule rangée qui défile : la série en cours reste visible, même sur 5 séries.
  useEffect(() => {
    const el = rangee.current
    const c = el?.querySelector<HTMLElement>('.courante')
    if (el && c) el.scrollLeft = c.offsetLeft - el.offsetLeft - (el.clientWidth - c.offsetWidth) / 2
  }, [faites.length])
  return (
    <div className="ligne-series" ref={rangee}>
      {Array.from({ length: total }, (_, k) => {
        const f = faites[k]
        if (f)
          return onCorriger ? (
            <button key={k} className="faite" onClick={() => onCorriger(f)} aria-label={`Corriger la série ${k + 1}`}>
              S{k + 1} {serieTexte(exo, f)} <Pencil size={13} />
            </button>
          ) : (
            <span key={k} className="faite">
              S{k + 1} {chargeQte(exo, f.charge, f.reps)} <Check size={14} />
            </span>
          )
        return (
          <span key={k} className={k === faites.length ? 'courante' : ''}>
            S{k + 1} {k === faites.length ? <Play size={13} fill="currentColor" /> : cible(k).split(' · ')[0]}
          </span>
        )
      })}
    </div>
  )
}

/** Échauffements de l'exercice, cochables directement (plein écran). */
function ChauffesCochables({ seance, plan, exo }: { seance: Seance; plan: ExoPlan; exo: Exercice }) {
  if (!plan.chauffes.length) return null
  return (
    <div className="chauffes-ligne">
      <span className="titre">Échauffement</span>
      {plan.chauffes.map((c, i) => {
        const cle = `${exo.id}:${i}`
        const fait = !!seance.chauffes[cle]
        const l = lireChauffe(c)
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
            {fait ? '✓' : '☐'} {l ? chargeQte(exo, l.charge, l.reps) : c}
          </button>
        )
      })}
    </div>
  )
}

/** Les exercices qui restent, en plein écran, en accordéon de consultation. */
function SuiteSeance({
  exos,
  onFermer,
}: {
  exos: {
    j: number
    nom: string
    exo: Exercice
    plan: ExoPlan
    sugg: Suggestion
    faites: Serie[]
    total: number
    derniereFois?: Serie[]
    note?: string
    chauffes: string[]
  }[]
  onFermer: () => void
}) {
  useRetour(true, onFermer)
  const [ouvert, setOuvert] = useState<number | null>(exos[0]?.j ?? null)

  return (
    <div className="modal-fond" onClick={onFermer}>
      <div className="modal pile" onClick={(e) => e.stopPropagation()}>
        <div className="ligne entre" style={{ alignItems: 'baseline', marginBottom: 6 }}>
          <h2 style={{ margin: 0 }}>Suite de la séance</h2>
          <span className="faible" style={{ fontSize: 'var(--t-petit)' }}>
            {exos.length} exercice{exos.length > 1 ? 's' : ''}
          </span>
        </div>
        <div className="pile" style={{ gap: 0 }}>
          {exos.map((x) => {
            const estOuvert = ouvert === x.j
            return (
              <div key={x.j} style={{ borderBottom: '1px solid var(--bord)' }}>
                <button
                  type="button"
                  className="ligne-mesure"
                  style={{
                    width: '100%',
                    cursor: 'pointer',
                    textAlign: 'left',
                    padding: '12px 4px',
                    background: 'none',
                    border: 'none',
                    color: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                  onClick={() => setOuvert(estOuvert ? null : x.j)}
                  aria-expanded={estOuvert}
                >
                  <div style={{ minWidth: 0, paddingRight: 8 }}>
                    <strong>{x.j + 1}. {x.nom}</strong>
                    <div className="faible" style={{ fontSize: 'var(--t-petit)', marginTop: 2 }}>
                      {x.faites.length ? `${x.faites.length}/${x.total} faites` : `${x.total} série${x.total > 1 ? 's' : ''}`}
                    </div>
                  </div>
                  <span className={'muted chevron-accordeon' + (estOuvert ? ' ouvert' : '')} style={{ fontSize: 16 }}>▸</span>
                </button>
                <div className={'accordeon-tiroir' + (estOuvert ? ' ouvert' : '')}>
                  <div className="accordeon-contenu">
                    <div className="pile" style={{ gap: 8, padding: '4px 4px 14px' }}>
                      <div className="ligne-series">
                        {Array.from({ length: x.total }, (_, k) => {
                          const f = x.faites[k]
                          if (f) {
                            return (
                              <span key={k} className="faite">
                                S{k + 1} {chargeQte(x.exo, f.charge, f.reps)} ✓
                              </span>
                            )
                          }
                          return (
                            <span key={k}>
                              S{k + 1} {x.sugg ? cibleSerie(x.exo, x.plan, x.sugg, k, x.faites).split(' · ')[0] : ''}
                            </span>
                          )
                        })}
                      </div>
                      {x.chauffes && x.chauffes.length > 0 && (
                        <div className="faible" style={{ fontSize: 'var(--t-legende)' }}>
                          Échauffement : {x.chauffes.map((c) => {
                            const l = lireChauffe(c)
                            return l ? chargeQte(x.exo, l.charge, l.reps) : c
                          }).join(' · ')}
                        </div>
                      )}
                      {x.derniereFois && x.derniereFois.length > 0 && (
                        <div className="faible" style={{ fontSize: 'var(--t-legende)' }}>
                          Dernière fois : {x.derniereFois.map((s) => serieTexte(x.exo, s)).join(' · ')}
                        </div>
                      )}
                      {x.note && (
                        <div className="faible" style={{ fontSize: 'var(--t-legende)' }}>
                          📝 {x.note}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <button className="btn discret plein" style={{ marginTop: 8 }} onClick={onFermer}>
          Fermer
        </button>
      </div>
    </div>
  )
}
