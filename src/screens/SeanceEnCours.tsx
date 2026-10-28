import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Catalogue } from '../catalogue'
import CarteExo, { majSeance } from '../components/CarteExo'
import ChoixExo from '../components/ChoixExo'
import EditeurObjectif from '../components/EditeurObjectif'
import Interrupteur from '../components/Interrupteur'
import Minuteur, { type EtatMinuteur } from '../components/Minuteur'
import { db, exoAvecReglages, historiqueDe, uid } from '../db'
import { debloquerSon, ecranAllume } from '../lib/appareil'
import { chargeTexte, duree, dureePrevueExo, e1rm, ecartSerie, estDure, kg, serieTexte, tempsParExo } from '../lib/calc'
import { transition, useRetour } from '../lib/nav'
import { suggere, suggestionPour, type Suggestion } from '../lib/progression'
import type { ExoPlan, Objectif, Reglage, Seance, Serie } from '../types'
import { planParDefaut } from './Seances'

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
  const terminees = useLiveQuery(() => db.seances.orderBy('debut').reverse().filter((s) => !s.enCours).toArray(), [])
  const reglages = useLiveQuery(() => db.reglages.toArray(), [])
  const [idxBrut, setIdxEtat] = useState<number>(() => stocke(`idx:${seance.id}`, 0))
  const [minuteur, setMinuteurEtat] = useState<EtatMinuteur | null>(() => {
    const m = stocke<EtatMinuteur | null>('minuteur', null)
    return m?.seanceId === seance.id ? m : null
  })
  const [toast, setToast] = useState<string | null>(null)
  const [fin, setFin] = useState(false)
  const [choix, setChoix] = useState<Choix | null>(null)
  const [machinePrise, setMachinePrise] = useState(false)
  const [verrou, setVerrou] = useState(false)
  const maintenant = useHorloge(1000)
  const derniereTouche = useRef(0)
  const repriseAuto = useRef<((finRepos: number) => void) | null>(null)
  const reposTraite = useRef<number | null>(null)

  const plans = seance.exercices
  const idx = Math.max(0, Math.min(idxBrut, plans.length - 1))

  const setIdx = (i: number) => {
    if (i === idx) return
    transition(() => setIdxEtat(i), i > idx ? 'avant' : 'arriere')
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

  const finRepos = minuteur && minuteur.fin <= maintenant ? minuteur.fin : null
  useEffect(() => {
    if (finRepos === null || reposTraite.current === finRepos) return
    reposTraite.current = finRepos
    repriseAuto.current?.(finRepos)
  }, [finRepos])

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
    return plans.map((p, i) => suggestionPour(exos[i], p, terminees))
  }, [terminees, exos, plans])

  if (!terminees || !reglages) return null

  const valider = (s: Serie, repos: number) => {
    debloquerSon()
    setVerrou(true)
    setTimeout(() => setVerrou(false), 1500)
    setMinuteur({ debut: Date.now(), fin: Date.now() + repos * 1000, duree: repos })
    // Records (seulement s'il existe un historique pour comparer)
    const exo = exoAvecReglages(catalogue.exo(s.exoId), reglages)
    const avant = historiqueDe(terminees, s.exoId).flat()
    if (avant.length === 0) return
    const memeCharge = avant.filter((x) => x.charge === s.charge)
    const e = e1rm(exo, s, seance.poidsCorps)
    const meilleur = Math.max(0, ...avant.map((x) => e1rm(exo, x, seance.poidsCorps) ?? 0))
    if (e && meilleur && e > meilleur) setToast(`🏆 Nouveau record e1RM : ${kg(e)} kg`)
    else if (memeCharge.length && s.reps > Math.max(...memeCharge.map((x) => x.reps)))
      setToast(`🏆 Nouveau record de reps à ${chargeTexte(exo, s.charge)} : ${s.reps}`)
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
        transition(() => setIdxEtat(c.i + 1), 'avant')
        range(`idx:${seance.id}`, c.i + 1)
      }
      setToast(`🔁 ${catalogue.exo(ancien.exoId).nom} → ${exo.nom}`)
    } else {
      await majSeance(seance.id, (s) => {
        s.exercices.push(planParDefaut(exo))
      })
      transition(() => setIdxEtat(plans.length), 'avant')
      range(`idx:${seance.id}`, plans.length)
    }
  }

  /** Machine prise : l'exercice passe en fin de séance, on enchaîne sur le suivant. */
  const plusTard = async (i: number) => {
    setMachinePrise(false)
    const etaitEnCours = i === enCours
    await majSeance(seance.id, (s) => {
      const [p] = s.exercices.splice(i, 1)
      s.exercices.push(p)
      // L'exercice suivant prend la main, même si celui-ci avait déjà des séries.
      if (etaitEnCours) s.courant = s.exercices[i]?.exoId
    })
    setToast(`⏭ ${exos[i].nom} déplacé en fin de séance`)
  }

  /** Changer d'ordre volontairement : cet exercice devient l'exercice en cours. */
  const faireMaintenant = async (i: number) => {
    await majSeance(seance.id, (s) => {
      s.courant = plans[i].exoId
    })
  }
  const allerEnCours = () => (enCours >= 0 ? setIdx(enCours) : ouvrirFin(true))

  /** Passer : sans série faite, l'exercice sort de la séance du jour ; sinon il s'arrête là. */
  const passer = async (i: number) => {
    setMachinePrise(false)
    const p = plans[i]
    const faites = nbFaites(p.exoId)
    await majSeance(seance.id, (s) => {
      if (faites === 0) s.exercices.splice(i, 1)
      else s.ajustSeries[p.exoId] = faites - p.series.length
    })
    if (faites === 0 && idx >= plans.length - 1) setIdxEtat(Math.max(0, plans.length - 2))
    else if (faites > 0 && i < plans.length - 1) setIdx(i + 1)
    setToast(`${exos[i].nom} passé pour aujourd’hui`)
  }

  const nbFaites = (exoId: string) => seance.series.filter((s) => s.exoId === exoId).length
  const totalDe = (i: number) => Math.max(nbFaites(plans[i].exoId), plans[i].series.length + (seance.ajustSeries[plans[i].exoId] ?? 0))
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
  const ensuite = enCours >= 0 ? `${exos[enCours]?.nom} · série ${nbFaites(plans[enCours].exoId) + 1}/${totalDe(enCours)}` : 'Fin de séance 💪'
  const reposRestant = minuteur ? Math.max(0, Math.ceil((minuteur.fin - maintenant) / 1000)) : 0

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

  return (
    <div className="apparait">
      <div className="entete colle">
        <div className="ligne entre" style={{ marginBottom: 10 }}>
          <div>
            <div className="faible">{seance.nom}</div>
            <h3>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>⏱ {chronoSeance(maintenant - seance.debut)}</span>
              <span className="muted" style={{ fontWeight: 400 }}>
                {' '}
                · {seance.sousTitre}
              </span>
            </h3>
          </div>
          <button className="btn" onClick={() => ouvrirFin(true)}>
            Terminer
          </button>
        </div>
        <div className="pills">
          {plans.map((p, i) => {
            const fait = nbFaites(p.exoId) >= p.series.length + (seance.ajustSeries[p.exoId] ?? 0)
            return (
              <button
                key={p.exoId + i}
                className={(i === idx ? 'actif ' : '') + (fait ? 'fait ' : '') + (i === enCours ? 'en-cours' : '')}
                onClick={() => setIdx(i)}
                aria-label={i === enCours ? `Exercice ${i + 1}, en cours` : undefined}
              >
                {fait ? '✓' : i + 1}
              </button>
            )
          })}
          <button onClick={() => setChoix({ mode: 'ajouter' })} aria-label="Ajouter un exercice">
            +
          </button>
        </div>
        {enCours >= 0 && enCours !== idx && (
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

      {plan ? (
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
          onAllerEnCours={allerEnCours}
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

      {plan && (
        <div className="ligne entre" style={{ marginBottom: 150 }}>
          <button className="btn" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>
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

      {machinePrise && plan && (
        <MachinePrise
          nom={exos[idx].nom}
          dernier={idx === plans.length - 1}
          entame={nbFaites(plan.exoId) > 0}
          onPlusTard={() => plusTard(idx)}
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
          exclure={plans.map((p) => p.exoId)}
          onChoix={choisir}
          onFermer={() => setChoix(null)}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
      {minuteur && (
        <Minuteur
          etat={minuteur}
          onChange={setMinuteur}
          ensuite={ensuite}
          onAller={enCours >= 0 && enCours !== idx ? () => setIdx(enCours) : enCours < 0 ? () => ouvrirFin(true) : undefined}
        />
      )}
    </div>
  )
}

function MachinePrise({
  nom,
  dernier,
  entame,
  onPlusTard,
  onRemplacer,
  onPasser,
  onFermer,
}: {
  nom: string
  dernier: boolean
  entame: boolean
  onPlusTard: () => void
  onRemplacer: () => void
  onPasser: () => void
  onFermer: () => void
}) {
  useRetour(true, onFermer)
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
        <h2>Machine prise</h2>
        <div className="faible" style={{ margin: '4px 0 14px' }}>
          {nom}
        </div>
        {option('⏭ Faire plus tard', 'Passe en fin de séance, tu y reviens quand la machine se libère.', onPlusTard, !dernier)}
        {option(
          '🔁 Remplacer',
          entame ? 'Les séries restantes passent sur un autre exercice.' : 'Par un exercice du même muscle, avec son propre historique.',
          onRemplacer
        )}
        {option('✕ Passer', entame ? 'Arrêter cet exercice ici pour aujourd’hui.' : 'Sauter cet exercice aujourd’hui (le modèle ne change pas).', onPasser)}
        <button className="btn discret plein" onClick={onFermer}>
          Annuler
        </button>
      </div>
    </div>
  )
}

/** Ce qui a changé aujourd'hui par rapport à la séance enregistrée, en clair. */
function changements(avant: ExoPlan[], apres: ExoPlan[], nom: (id: string) => string): string[] {
  const ids = (l: ExoPlan[]) => l.map((p) => p.exoId)
  const out: string[] = []
  const retires = avant.filter((p) => !ids(apres).includes(p.exoId))
  const ajoutes = apres.filter((p) => !ids(avant).includes(p.exoId))
  if (retires.length && retires.length === ajoutes.length)
    retires.forEach((r, i) => out.push(`${nom(r.exoId)} remplacé par ${nom(ajoutes[i].exoId)}`))
  else {
    retires.forEach((r) => out.push(`${nom(r.exoId)} retiré`))
    ajoutes.forEach((a) => out.push(`${nom(a.exoId)} ajouté`))
  }
  for (const p of apres) {
    const q = avant.find((x) => x.exoId === p.exoId)
    if (q && q.series.length !== p.series.length) out.push(`${nom(p.exoId)} : ${p.series.length} séries au lieu de ${q.series.length}`)
  }
  const communs = (l: ExoPlan[], autre: ExoPlan[]) => ids(l).filter((id) => ids(autre).includes(id))
  if (communs(avant, apres).join() !== communs(apres, avant).join()) out.push('Ordre des exercices changé')
  return out
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
  const [ressenti, setRessenti] = useState(3)
  const [energie, setEnergie] = useState(3)
  const [garder, setGarder] = useState(false)
  const [nomModele, setNomModele] = useState('')
  const [objectifs, setObjectifs] = useState<Record<string, Objectif>>(seance.objectifs ?? {})
  const [ajuste, setAjuste] = useState<string | null>(null)
  const dures = seance.series.filter(estDure).length
  const tonnage = seance.series.reduce((a, s) => a + s.charge * s.reps, 0)
  const finisseurs = seance.series.filter((s) => s.type === 'serie_longue').length
  const chauffes = Object.values(seance.chauffes).filter(Boolean).length
  const adaptee = !!modele && JSON.stringify(seance.exercices) !== JSON.stringify(modele.exercices)
  const libre = !modele && seance.exercices.length > 0
  const passe = tempsParExo(seance)
  const modifs = adaptee && modele ? changements(modele.exercices, seance.exercices, (id) => catalogue.exo(id).nom) : []

  // « Prévoir la prochaine séance » : proposition automatique calculée avec cette séance incluse,
  // remplaçable par un objectif fixé à la main.
  const avecCelleCi = [seance, ...terminees]
  const prochaines = seance.exercices
    .filter((p) => seance.series.some((s) => s.exoId === p.exoId))
    .map((p) => {
      const exo = exoAvecReglages(catalogue.exo(p.exoId), reglages)
      const i = seance.exercices.indexOf(p)
      return {
        exo,
        s: suggere(exo, p, historiqueDe(avecCelleCi, p.exoId)),
        series: seance.series.filter((x) => x.exoId === p.exoId),
        avant: historiqueDe(terminees, p.exoId)[0] ?? [],
        ms: passe[p.exoId] ?? 0,
        prevu: dureePrevueExo(seance.exercices, i),
      }
    })

  const enregistrer = async () => {
    let modeleId = seance.modeleId
    if (garder && adaptee && modele) await db.modeles.put({ ...modele, exercices: structuredClone(seance.exercices) })
    if (garder && libre) {
      modeleId = 'm_' + uid()
      await db.modeles.put({ id: modeleId, nom: nomModele.trim() || 'Séance libre', sousTitre: '', exercices: structuredClone(seance.exercices) })
    }
    await db.seances.update(seance.id, { enCours: false, fin: Date.now(), ressenti, energie, modeleId, objectifs })
    oublierEtatLocal(seance.id)
  }

  const abandonner = async () => {
    if (!confirm(seance.series.length ? 'Supprimer cette séance et ses séries ?' : 'Annuler la séance ?')) return
    await db.seances.delete(seance.id)
    oublierEtatLocal(seance.id)
  }

  const echelle = (v: number, set: (n: number) => void, label: string) => (
    <div>
      <div className="faible" style={{ marginBottom: 6 }}>
        {label}
      </div>
      <div className="rpe" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} className={v === n ? 'actif' : ''} onClick={() => set(n)}>
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
        <div className="ligne wrap" style={{ marginTop: 8 }}>
          <span className="pastille">⏱ {duree(Date.now() - seance.debut)}</span>
          <span className="pastille">{dures} séries dures</span>
          <span className="pastille">{kg(Math.round(tonnage))} kg soulevés</span>
          {finisseurs > 0 && <span className="pastille fin">★ {finisseurs} finisseur(s)</span>}
          {chauffes > 0 && <span className="pastille">{chauffes} échauffement(s)</span>}
        </div>
      </div>

      {prochaines.length > 0 && (
        <>
          <h3 style={{ margin: '18px 0 4px' }}>Récap par exercice</h3>
          <div className="faible" style={{ marginBottom: 10 }}>
            Tes séries comparées à la dernière fois, puis l’objectif de la prochaine séance : l’appli le propose, tu peux le changer.
          </div>
          {prochaines.map(({ exo, s, series, avant, ms, prevu }) => {
            const o = objectifs[exo.id]
            const charges = o?.charges ?? s.charges
            const reps = o?.reps ?? s.reps
            return (
              <div key={exo.id} className="carte pile recap">
                <div className="ligne entre" style={{ alignItems: 'baseline' }}>
                  <strong>{exo.nom}</strong>
                  {ms > 0 && (
                    <span className="faible" style={{ whiteSpace: 'nowrap' }}>
                      ⏱ {duree(ms)} <span className="muted">/ prévu {duree(prevu * 1000)}</span>
                    </span>
                  )}
                </div>
                <div>
                  {series.map((x, k) => {
                    const e = ecartSerie(x, avant[k])
                    return (
                      <div key={x.id} className="recap-serie">
                        <span>
                          <span className="faible">S{k + 1}</span> {serieTexte(exo, x)}
                        </span>
                        {e ? (
                          <span className={'avant ' + e.sens} style={{ display: 'inline', marginTop: 0 }}>
                            {e.sens === 'mieux' ? '↑' : e.sens === 'egal' ? '=' : '↓'} {e.texte}
                          </span>
                        ) : (
                          <span className="faible">{avant.length ? '' : '1re fois'}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
                <button className="prochaine" onClick={() => setAjuste(exo.id)}>
                  <span>
                    <span className="label">Prochaine fois</span>
                    <strong>
                      {chargeTexte(exo, charges[0])}
                      {charges.some((c) => c !== charges[0]) && ` → ${chargeTexte(exo, charges[charges.length - 1])}`} × {reps.join('/')}
                    </strong>
                    <span className="faible" style={{ display: 'block' }}>
                      {o ? '✎ Fixé par toi.' : s.message}
                    </span>
                  </span>
                  <span className="modifier">✎ Modifier</span>
                </button>
              </div>
            )
          })}
        </>
      )}

      <div className="carte pile">
        {echelle(ressenti, setRessenti, 'Ressenti global (1 = dur, 5 = excellent)')}
        {echelle(energie, setEnergie, 'Énergie (1 = vidé, 5 = au top)')}
      </div>

      {adaptee && modele && (
        <div className="carte pile">
          <div>
            <h3>Tu as modifié la séance aujourd’hui</h3>
            {modifs.length > 0 && (
              <ul className="petit muted" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {modifs.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="petit">Que faire de ces changements pour les prochaines « {modele.nom} » ?</div>
          <button className={'choix' + (!garder ? ' actif' : '')} onClick={() => setGarder(false)}>
            <strong>Seulement aujourd’hui</strong>
            <span className="faible">La séance « {modele.nom} » reste comme avant.</span>
          </button>
          <button className={'choix' + (garder ? ' actif' : '')} onClick={() => setGarder(true)}>
            <strong>Garder pour les prochaines fois</strong>
            <span className="faible">La séance « {modele.nom} » est mise à jour avec ces changements.</span>
          </button>
        </div>
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
          const p = prochaines.find((x) => x.exo.id === ajuste)!
          return (
            <EditeurObjectif
              exo={p.exo}
              auto={p.s}
              actuel={objectifs[ajuste]}
              onFermer={() => setAjuste(null)}
              onValider={(o) => (setObjectifs((x) => ({ ...x, [ajuste]: o })), setAjuste(null))}
              onAuto={() => {
                setObjectifs((x) => {
                  const { [ajuste]: _retire, ...reste } = x
                  return reste
                })
                setAjuste(null)
              }}
            />
          )
        })()}

      <button className="btn primaire grand" onClick={enregistrer} disabled={seance.series.length === 0}>
        ENREGISTRER
      </button>
      <button className="btn discret danger plein" style={{ marginTop: 12, marginBottom: 24 }} onClick={abandonner}>
        {seance.series.length ? 'Supprimer la séance' : 'Annuler la séance'}
      </button>
    </div>
  )
}
