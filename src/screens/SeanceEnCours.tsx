import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Catalogue } from '../catalogue'
import Anneau from '../components/Anneau'
import CarteExo, { cibleSerie, Ecart, Editeur, majSeance } from '../components/CarteExo'
import ChoixExo from '../components/ChoixExo'
import EditeurObjectif, { ObjectifApres } from '../components/EditeurObjectif'
import InfosExo, { BoutonInfos } from '../components/InfosExo'
import Interrupteur from '../components/Interrupteur'
import Minuteur, { resteRepos, type EtatMinuteur } from '../components/Minuteur'
import RecapExos, { ResumeSeance } from '../components/RecapSeance'
import { db, exoAvecReglages, historiqueDe, uid } from '../db'
import { debloquerSon, ecranAllume, signalSerie } from '../lib/appareil'
import { ecartSerie, lireChauffe, volumeParMuscle, calories, chargeQte, chargeTexte, cibleTexte, e1rm, enTemps, kg, minutes, reposApres, serieTexte } from '../lib/calc'
import { transition, useRetour } from '../lib/nav'
import { lireEquivalents, modifierEquivalents, relies, repere } from '../lib/equivalents'
import { suggestionDeload } from '../lib/cycle'
import { conseil, hausse, pareil, suggestionPour, type Suggestion } from '../lib/progression'
import { blocage } from '../lib/blocages'
import { phaseA } from '../lib/objectifs'
import type { Exercice, ExoPlan, Objectif, Reglage, Seance, Serie } from '../types'
import { FINISSEURS, typeFinisseur } from '../lib/finisseur'
import { planParDefaut } from './Seances'
import { confirmer } from '../components/Dialogues'
import SilhouetteVolume from '../components/SilhouetteVolume'
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

/** Minuteur et exercice affiché d'une séance terminée ou abandonnée. */
function oublierEtatLocal(seanceId: string) {
  range('minuteur', null)
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
  const [focus, setFocusEtat] = useState<boolean>(() => stocke('modeFocus', false))
  const setFocus = (v: boolean) => (transition(() => setFocusEtat(v), 'fondu'), range('modeFocus', v), window.scrollTo({ top: 0 }))
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
  const avecEchauffement = !!seance.echauffement?.ids.length
  const idx = idxBrut === -1 && avecEchauffement ? -1 : Math.max(0, Math.min(idxBrut, plans.length - 1))
  const surEchauffement = idx === -1 || echauffementActif(seance)

  // Quand l'échauffement se termine (tout coché, « Passer », 1re série), aller au 1er exercice. Une fois
  // fini, on peut toujours y revenir par la pastille 🔥 : seul le passage actif → fini fait avancer.
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
  const setMinuteur = (m: EtatMinuteur | null) => {
    const avecSeance = m && { ...m, seanceId: seance.id }
    setMinuteurEtat(avecSeance)
    range('minuteur', avecSeance)
  }
  const ouvrirFin = (v: boolean) => (transition(() => setFin(v), v ? 'avant' : 'arriere'), window.scrollTo({ top: 0 }))

  // Retour Android : fin → séance, puis exercice précédent. Ne quitte jamais une séance en cours.
  useRetour(true, () => {
    if (fin) ouvrirFin(false)
    else if (focus) setFocus(false)
    else if (idx === -1) setIdx(0)
    else if (idx > 0) setIdx(idx - 1)
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
    setMinuteur({ debut: Date.now(), fin: Date.now() + repos * 1000, duree: repos })
    // Records (seulement s'il existe un historique pour comparer ; jamais en déload)
    if (seance.deload) return
    const exo = exoAvecReglages(catalogue.exo(s.exoId), reglages)
    const avant = historiqueDe(terminees, s.exoId).flat()
    if (avant.length === 0) return
    const memeCharge = avant.filter((x) => x.charge === s.charge)
    const e = e1rm(exo, s, seance.poidsCorps)
    const meilleur = Math.max(0, ...avant.map((x) => e1rm(exo, x, seance.poidsCorps) ?? 0))
    if (e && meilleur && e > meilleur) setToast(`🏆 Nouveau record e1RM : ${kg(e)} ${exo.mode === 'par_main' ? 'kg/main' : 'kg'}`)
    // Sans 1RM (pas de poids noté, isolation…) : une charge jamais soulevée est aussi un record.
    else if (!enTemps(exo) && s.reps > 0 && s.charge > Math.max(...avant.map((x) => x.charge)))
      setToast(`🏆 Nouveau record de charge : ${chargeTexte(exo, s.charge)} × ${s.reps}`)
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
      const substitut = { ...ancien, exoId, charge: null, chauffes: [], finisseur: ancien.finisseur && exo.type === 'isolation', note: undefined }
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
      setToast(`🔁 ${catalogue.exo(ancien.exoId).nom} → ${exo.nom}`)
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
  const allerEnCours = () => (enCours >= 0 ? setIdx(enCours) : ouvrirFin(true))

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

  const nbFaites = (exoId: string) => seance.series.filter((s) => s.exoId === exoId).length
  const totalDe = (i: number) => estPasse(i) ? nbFaites(plans[i].exoId) : Math.max(nbFaites(plans[i].exoId), plans[i].series.length + (seance.ajustSeries[plans[i].exoId] ?? 0))
  // Exercice en cours : celui choisi explicitement s'il n'est pas fini ; sinon celui de la dernière
  // série s'il en reste, sinon le prochain exercice pas fini.
  const enCours = (() => {
    const choisi = seance.courant ? plans.findIndex((p) => p.exoId === seance.courant) : -1
    if (choisi >= 0 && nbFaites(plans[choisi].exoId) < totalDe(choisi)) return choisi
    const derniere = seance.series.reduce<Serie | null>((a, s) => (!a || s.heure > a.heure ? s : a), null)
    const i0 = derniere ? plans.findIndex((p) => p.exoId === derniere.exoId) : -1
    if (i0 >= 0 && nbFaites(plans[i0].exoId) < totalDe(i0)) return i0
    const ordre = [...plans.keys()].slice(i0 + 1).concat([...plans.keys()].slice(0, i0 + 1))
    return ordre.find((j) => nbFaites(plans[j].exoId) < totalDe(j)) ?? -1
  })()
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
  const kcal = calories(maintenant - seance.debut, seance.poidsCorps)

  const ensuite = enCours >= 0 ? `${exos[enCours]?.nom} · série ${nbFaites(plans[enCours].exoId) + 1}/${totalDe(enCours)}` : 'Fin de séance 💪'
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
  const vueRepos = reposEnCours && !saisie && !corrige
  const derniereSerie = seance.series.reduce<Serie | null>((a, x) => (!a || x.heure > a.heure ? x : a), null)
  const pastilles = (
    <div className="pills" ref={pills} onScroll={marquerDebord}>
      {avecEchauffement && (
        <button
          className={(surEchauffement ? 'actif ' : '') + (!echauffementActif(seance) ? 'fait ' : 'en-cours')}
          onClick={() => setIdx(-1)}
          aria-label="Échauffement"
        >
          🔥
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
            onClick={() => setIdx(i)}
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
            <strong>{restantes > 0 ? `Reste ${restantes} série${restantes > 1 ? 's' : ''}` : 'Tout est fait 💪'}</strong>
            {resteSec > 0 && <span className="faible"> · ~{minutes(Math.max(1, Math.round(resteSec / 60)))}</span>}
          </div>
          <div className="faible">
            ⏱ {chronoSeance(maintenant - seance.debut)} · 🔥 ≈ {kcal} kcal
          </div>
        </div>
      </div>
      <div className="focus-boutons">
        <button className="btn petit" onClick={() => (enCours >= 0 && setIdx(enCours), setFocus(false))}>
          ⌄ Réduire
        </button>
        {enCours >= 0 && (
          <button className="btn petit" onClick={() => (setIdx(enCours), setMachinePrise(true))}>
            Machine prise
          </button>
        )}
        <button className="btn petit" onClick={() => (setFocus(false), ouvrirFin(true))}>
          Terminer
        </button>
      </div>
    </div>
  )

  // Fenêtres communes à la vue normale et au plein écran (Machine prise, remplacement, lien d'équivalents).
  const fenetres = (
    <>
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
    const derniereInfo = (() => {
      if (!derniereSerie) return null
      const i = plans.findIndex((p) => p.exoId === derniereSerie.exoId)
      if (i < 0) return null
      const k = seance.series.filter((x) => x.exoId === derniereSerie.exoId).indexOf(derniereSerie)
      const avant = seance.deload ? undefined : historiqueDe(terminees, derniereSerie.exoId)[0]?.[k]
      const e = avant && ecartSerie(derniereSerie, avant, exos[i])
      const mieux = e?.sens === 'mieux'
      return (
        <div className={'focus-bloc' + (mieux ? ' mieux' : '')}>
          {mieux && <div className="mieux-titre">↑ {e!.texte} vs la dernière fois 💪</div>}
          <div className="ligne entre">
            <span className="faible">Tu viens de faire · {exos[i].nom}</span>
            <button className="btn discret petit" onClick={() => setCorrige(derniereSerie.id)}>
              ✎ Corriger
            </button>
          </div>
          <div>
            <strong>
              S{k + 1} {serieTexte(exos[i], derniereSerie)}
            </strong>
            {avant && !mieux && <Ecart s={derniereSerie} avant={avant} exo={exos[i]} />}
          </div>
        </div>
      )
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
      return (
        <div className={'focus-bloc prochaine-grand' + (exoFini ? ' nouvel-exo' : '')}>
          {exoFini ? <div className="nouvel-exo-titre">✓ {exoFini} terminé · exercice suivant</div> : <div className="faible">Prochaine série</div>}
          <div className="ligne entre">
            <h2>{exo.nom}</h2>
            <BoutonInfos onClick={() => setInfos(exo.id)} />
          </div>
          <div className="ligne wrap" style={{ gap: 6 }}>
            <span className="pastille accent">
              Série {n + 1}/{t}
            </span>
            {p.finisseur && n === t - 1 && <span className="pastille fin">★ {FINISSEURS[typeFinisseur(p)].nom}</span>}
          </div>
          <LigneSeries exo={exo} faites={seance.series.filter((x) => x.exoId === p.exoId)} total={t} cible={(k) => cibleSerie(exo, p, suggestions[enCours], k, seance.series.filter((x) => x.exoId === p.exoId))} />
          <div className="cible-grand">{cibleSerie(exo, p, suggestions[enCours], n, seance.series.filter((x) => x.exoId === p.exoId))}</div>
          {plus && <div className="badge-hausse grand">🔥 ↑ {plus} par rapport à la dernière fois</div>}
          {avant && <div className="faible">Dernière fois : {serieTexte(exo, avant)}</div>}
          {n === 0 && <ChauffesCochables seance={seance} plan={p} exo={exo} />}
          {(p.note || exo.notes) && <div className="faible">ℹ️ {p.note ?? exo.notes}</div>}
        </div>
      )
    })()
    // Correction : seulement la série concernée, rien d'autre.
    const correction = (() => {
      const serie = corrige ? seance.series.find((x) => x.id === corrige) : undefined
      const i = serie ? plans.findIndex((p) => p.exoId === serie.exoId) : -1
      if (!serie || i < 0) return null
      const faites = seance.series.filter((x) => x.exoId === serie.exoId)
      return (
        <div className="focus-bloc pile">
          <div className="faible">{exos[i].nom}</div>
          <Editeur
            seance={seance}
            plan={plans[i]}
            exo={exos[i]}
            sugg={suggestions[i]}
            index={faites.indexOf(serie)}
            total={totalDe(i)}
            faites={faites}
            edition={serie}
            reposRestant={0}
            verrou={false}
            onFini={() => setCorrige(null)}
            onAnnulerEdition={() => setCorrige(null)}
          />
        </div>
      )
    })()

    return (
      <div className={'focus apparait' + (vueRepos && !correction ? ' fixe' : '')}>
        {avancementCompact}
        {minuteur && <Minuteur etat={minuteur} onChange={setMinuteur} variante={vueRepos ? 'grand' : 'bandeau'} />}
        {correction ? (
          correction
        ) : vueRepos ? (
          <>
            {derniereInfo}
            {prochaine}
            {plans.some((pl, j) => j !== enCours && !estPasse(j) && nbFaites(pl.exoId) < totalDe(j)) && (
              <button className="btn discret plein" onClick={() => setSuite(true)}>
                Voir la suite de la séance ›
              </button>
            )}
          </>
        ) : surEchauffement ? (
          <Echauffement seance={seance} onPasser={() => setIdx(0)} />
        ) : enCours >= 0 ? (
          // Saisie en plein écran : l'essentiel seulement (exercice, cible, dernière fois, saisie, Valider).
          (() => {
            const p = plans[enCours]
            const exo = exos[enCours]
            const n = nbFaites(p.exoId)
            const t = totalDe(enCours)
            const derniereFois = historiqueDe(terminees, p.exoId)[0]
            const plus = hausse(exo, suggestions[enCours], derniereFois, n)
            return (
              <div className="focus-bloc pile saisie-focus">
                <div className="ligne entre" style={{ alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="faible">
                      Série {n + 1}/{t}
                      {p.finisseur && n === t - 1 ? ` · ★ ${FINISSEURS[typeFinisseur(p)].nom}` : ''}
                    </div>
                    <h2>{exo.nom}</h2>
                  </div>
                  <BoutonInfos onClick={() => setInfos(exo.id)} />
                </div>
                <LigneSeries exo={exo} faites={seance.series.filter((x) => x.exoId === p.exoId)} total={t} cible={(k) => cibleSerie(exo, p, suggestions[enCours], k, seance.series.filter((x) => x.exoId === p.exoId))} />
                {n === 0 && <ChauffesCochables seance={seance} plan={p} exo={exo} />}
                <div>
                  <strong className="cible-focus">{cibleSerie(exo, p, suggestions[enCours], n, seance.series.filter((x) => x.exoId === p.exoId))}</strong>
                  {plus && <span className="badge-hausse">↑ {plus}</span>}
                  {derniereFois?.[n] && <div className="faible">Dernière fois : {serieTexte(exo, derniereFois[n])}</div>}
                  {noteAvant(p.exoId) && !seance.notes[p.exoId] && <div className="faible">📝 La dernière fois : {noteAvant(p.exoId)}</div>}
                </div>
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
                  onFini={(s) => valider(s, reposApres(p, n, t))}
                  onAnnulerEdition={() => undefined}
                />
              </div>
            )
          })()
        ) : (
          <div className="focus-bloc pile">
            <h2>Toutes les séries sont faites 💪</h2>
            <button className="btn primaire grand" onClick={() => (setFocus(false), ouvrirFin(true))}>
              Terminer la séance
            </button>
          </div>
        )}
        {fenetres}
        {suite && (
          <SuiteSeance
            exos={plans
              .map((pl, j) => ({ j, nom: exos[j].nom, faites: nbFaites(pl.exoId), total: totalDe(j), passe: estPasse(j) }))
              .filter((x) => x.j !== enCours && !x.passe && x.faites < x.total)}
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
    <div className="apparait">
      <div className="entete colle">
        <div className="ligne entre" style={{ marginBottom: 10 }}>
          {/* Avancement et chrono ; un appui ouvre le plein écran. */}
          <button className="resume-seance" onClick={() => setFocus(true)} aria-label="Plein écran">
            <Anneau valeur={avancement} taille={40} label={`${Math.round(avancement * 100)} % de la séance fait`}>
              <span className="anneau-pct">{Math.round(avancement * 100)}%</span>
            </Anneau>
            <span>
              <strong className="chrono-seance">{chronoSeance(maintenant - seance.debut)}</strong>
              <span className="faible">
                {totalSeries > 0 && (restantes > 0 ? `reste ${restantes} série${restantes > 1 ? 's' : ''}` : 'tout est fait 💪')}
              </span>
            </span>
          </button>
          <button className="btn" onClick={() => ouvrirFin(true)}>
            Terminer
          </button>
        </div>
        {seance.deload && <div className="bandeau-deload">🧘 Déload : charges −10 %, RPE 6-7, sans échec. Récupère, ne force pas.</div>}
        {pastilles}
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
        <Echauffement seance={seance} onPasser={() => setIdx(0)} />
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
          <button className="btn" disabled={idx === 0 && !avecEchauffement} onClick={() => setIdx(idx - 1)}>
            ← Précédent
          </button>
          {idx < plans.length - 1 ? (
            <button className="btn primaire" onClick={() => setIdx(idx + 1)}>
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
          onAller={enCours >= 0 && enCours !== idx ? () => setIdx(enCours) : enCours < 0 ? () => ouvrirFin(true) : undefined}
          onAgrandir={() => setFocus(true)}
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
  onFermer,
}: {
  nom: string
  entame: boolean
  autres: { i: number; nom: string; entame: boolean }[]
  onEchanger: (j: number) => void
  onRemplacer: () => void
  onPasser: () => void
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
  const [ressenti, setRessenti] = useState<number | undefined>(undefined)
  const [energie, setEnergie] = useState<number | undefined>(undefined)
  const [garder, setGarder] = useState(false)
  const [nomModele, setNomModele] = useState('')
  const [objectifs, setObjectifs] = useState<Record<string, Objectif>>(seance.objectifs ?? {})
  const [ajuste, setAjuste] = useState<string | null>(null)
  const libre = !modele && seance.exercices.length > 0

  // « Prochaine fois » : par défaut, refaire exactement cette séance ; l'utilisateur monte lui-même.
  const avecCelleCi = [seance, ...terminees]
  const suggestionDe = (exoId: string) => {
    const p = seance.exercices.find((x) => x.exoId === exoId)!
    const exo = exoAvecReglages(catalogue.exo(exoId), reglages)
    const histo = historiqueDe(avecCelleCi, exoId)
    return { exo, s: pareil(exo, p, histo), conseil: conseil(exo, p, histo) }
  }
  const faits = seance.exercices.filter((p) => seance.series.some((s) => s.exoId === p.exoId))

  const enregistrer = async () => {
    let modeleId = seance.modeleId
    if (garder && libre) {
      modeleId = 'm_' + uid()
      await db.modeles.put({ id: modeleId, nom: nomModele.trim() || 'Séance libre', sousTitre: '', exercices: structuredClone(seance.exercices) })
    }
    await db.seances.update(seance.id, { enCours: false, fin: Date.now(), ressenti, energie, modeleId, objectifs })
    oublierEtatLocal(seance.id)
  }

  const abandonner = async () => {
    const ok = seance.series.length
      ? await confirmer('Les séries déjà faites seront effacées.', { titre: 'Supprimer cette séance ?', oui: 'Supprimer la séance', non: 'Reprendre', danger: true })
      : await confirmer('Rien n’a encore été enregistré.', { titre: 'Annuler la séance ?', oui: 'Annuler la séance', non: 'Reprendre', danger: true })
    if (!ok) return
    await db.seances.delete(seance.id)
    oublierEtatLocal(seance.id)
  }

  const echelle = (v: number | undefined, set: (n: number | undefined) => void, label: string) => (
    <div>
      <div className="faible" style={{ marginBottom: 6 }}>
        {label}
      </div>
      <div className="rpe" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} className={v === n ? 'actif' : ''} onClick={() => set(v === n ? undefined : n)}>
            {n}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div>
      <div className="entete">
        <h1>Fin de séance</h1>
        <button className="btn" onClick={onRetour}>
          ← Reprendre
        </button>
      </div>
      <div className="carte">
        <h2>{seance.nom}</h2>
        <ResumeSeance seance={seance} explication exo={catalogue.exo} />
      </div>
      {seance.series.length > 0 && (
        <div className="carte">
          <h3 style={{ marginBottom: 8 }}>Muscles travaillés</h3>
          <SilhouetteVolume
            volume={volumeParMuscle([seance], catalogue.exercices)}
            cibles={catalogue.cibles}
            legende="objectif de la semaine"
          />
        </div>
      )}

      {faits.length > 0 && (
        <>
          <h3 style={{ margin: '18px 0 4px' }}>Récap par exercice</h3>
          <div className="faible" style={{ marginBottom: 10 }}>
            {seance.deload
              ? 'Séance de déload : pas d’objectif à fixer. La prochaine vraie séance reprend là où tu en étais avant le déload.'
              : 'Tes séries comparées à la dernière fois. La prochaine fois, tu refais pareil, sauf si tu appliques un conseil 💡 (exercices avec une fourchette de reps) ; ✎ pour régler toi-même.'}
          </div>
          <RecapExos
            seance={seance}
            avant={terminees}
            reglages={reglages}
            catalogue={catalogue}
            basExo={(exo) => {
              if (seance.deload) return null
              const { s, conseil: c } = suggestionDe(exo.id)
              const o = objectifs[exo.id]
              const charges = o?.charges ?? s.charges
              const reps = o?.reps ?? s.reps
              const monte = o && charges.some((c, k) => (c ?? 0) > (s.charges[k] ?? 0) || (c === s.charges[k] && reps[k] > s.reps[k]))
              // Conseil de surcharge : affiché tant qu'il n'est pas déjà l'objectif retenu.
              const applique = c && JSON.stringify([c.charges, c.reps]) === JSON.stringify([charges, reps])
              return (
                <>
                <button className="prochaine" onClick={() => setAjuste(exo.id)}>
                  <span>
                    <span className="label">Prochaine fois</span>
                    <strong>
                      {cibleTexte(exo, charges, reps)}
                    </strong>
                    <span className="faible" style={{ display: 'block' }}>
                      {!o ? 'Comme aujourd’hui.' : monte ? '↑ Tu as prévu de monter.' : '✎ Fixé par toi.'}
                    </span>
                  </span>
                  <span className="modifier">✎ Modifier</span>
                </button>
                {c && !applique && (
                  <div className="conseil-surcharge">
                    <span>
                      <span className="label">💡 Conseil</span>
                      <strong>{cibleTexte(exo, c.charges, c.reps)}</strong>
                      <span className="faible" style={{ display: 'block' }}>
                        {c.message}
                      </span>
                    </span>
                    <button className="btn petit" onClick={() => setObjectifs((x) => ({ ...x, [exo.id]: { charges: c.charges, reps: c.reps } }))}>
                      Appliquer
                    </button>
                  </div>
                )}
                </>
              )
            }}
          />
        </>
      )}

      <div className="carte pile">
        {echelle(ressenti, setRessenti, 'Ressenti global (1 = dur, 5 = excellent) · facultatif')}
        {echelle(energie, setEnergie, 'Énergie (1 = vidé, 5 = au top) · facultatif')}
      </div>

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
              onDefaut={() => {
                setObjectifs((x) => {
                  const { [ajuste]: _retire, ...reste } = x
                  return reste
                })
                setAjuste(null)
              }}
            />
          )
        })()}

      {seance.series.length > 0 ? (
        <button className="btn primaire grand" onClick={enregistrer}>
          ENREGISTRER
        </button>
      ) : (
        <div className="carte pile" style={{ textAlign: 'center', background: 'var(--surface-2)' }}>
          <div className="faible">Aucune série validée. Valide au moins une série ou annule la séance.</div>
          <button className="btn plein" onClick={onRetour}>
            ← Reprendre et valider une série
          </button>
        </div>
      )}
      <button
        className={'btn ' + (seance.series.length ? 'discret danger plein' : 'danger-plein grand')}
        style={{ marginTop: 12, marginBottom: 24 }}
        onClick={abandonner}
      >
        {seance.series.length ? 'Supprimer la séance' : 'Quitter la séance (sans enregistrer)'}
      </button>
    </div>
  )
}

/** Toutes les séries de l'exercice sur une ligne : faites (✓), en cours (→), à venir. */
function LigneSeries({ exo, faites, total, cible }: { exo: Exercice; faites: Serie[]; total: number; cible: (k: number) => string }) {
  return (
    <div className="ligne-series">
      {Array.from({ length: total }, (_, k) => {
        const f = faites[k]
        return (
          <span key={k} className={f ? 'faite' : k === faites.length ? 'courante' : ''}>
            S{k + 1} {f ? `${chargeQte(exo, f.charge, f.reps)} ✓` : k === faites.length ? `→ ${cible(k).split(' · ')[0]}` : cible(k).split(' · ')[0]}
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
    <div>
      {plan.chauffes.map((c, i) => {
        const cle = `${exo.id}:${i}`
        const fait = !!seance.chauffes[cle]
        const l = lireChauffe(c)
        return (
          <button
            key={cle}
            className={'serie-chauffe' + (fait ? ' fait' : '')}
            onClick={() =>
              void majSeance(seance.id, (x) => {
                x.chauffes[cle] = !fait
              })
            }
          >
            <span className="case">{fait ? '✓' : ''}</span>
            <span>
              <span className="faible">Échauffement {i + 1}</span> {l ? `${chargeQte(exo, l.charge, l.reps)}` : c}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Les exercices qui restent, en plein écran, sans quitter le repos. */
function SuiteSeance({ exos, onFermer }: { exos: { j: number; nom: string; faites: number; total: number }[]; onFermer: () => void }) {
  useRetour(true, onFermer)
  return (
    <div className="modal-fond" onClick={onFermer}>
      <div className="modal pile" onClick={(e) => e.stopPropagation()}>
        <h2>Suite de la séance</h2>
        {exos.map((x) => (
          <div key={x.j} className="ligne-mesure">
            <span>
              {x.j + 1}. {x.nom}
            </span>
            <span className="faible">
              {x.faites ? `${x.faites}/${x.total} séries` : `${x.total} série${x.total > 1 ? 's' : ''}`}
            </span>
          </div>
        ))}
        <button className="btn discret plein" onClick={onFermer}>
          Fermer
        </button>
      </div>
    </div>
  )
}
