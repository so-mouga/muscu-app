import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Check, ChevronDown, ChevronRight, ChevronUp, CloudUpload, Download, Dumbbell, Info, Moon, RefreshCw, Ruler, SlidersHorizontal, X } from 'lucide-react'
import type { Catalogue, EntreePlanning } from '../catalogue'
import { db, dernierPoids, exoAvecReglages, historiqueDe, uid } from '../db'
import { chargeQte, dateISO, duree, dureeSeanceEffective, dureeTexte, estDure, jourSemaine, lundi } from '../lib/calc'
import { creneauxFaits } from '../lib/historique'
import { hausse, suggestionPour } from '../lib/progression'
import { nomPhase, periodes, phaseAffichee, type Phase } from '../lib/objectifs'
import { debloquerSon } from '../lib/appareil'
import { transition, useRetour } from '../lib/nav'
import JournalMatin from '../components/JournalMatin'
import { BandeauCycle, BilanCycle } from '../components/Cycle'
import { etatCycle, planDeload } from '../lib/cycle'
import { deloadConseille } from '../lib/blocages'
import Apercu from './Apercu'
import type { Programme, SeanceModele } from '../types'
import { informer } from '../components/Dialogues'
import ChoixProgramme from '../components/ChoixProgramme'
import { joursSansSeance } from '../lib/motivation'
import { nouvelleVersionAndroid, seanceDuJourNatif } from '../lib/natif'
import { CATEGORIES_COURANTES, sauvegarder } from '../lib/sauvegarde'
import { echauffementDe } from '../data/echauffements'

const JOURS = ['', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']

/** Sans modèle : séance libre, les exercices s'ajoutent à la volée. */
/** Contexte du cycle au démarrage : semaine en cours et déload éventuel. */
type ContexteCycle = { cycleId: string; semaine?: number; deload: boolean }

async function demarrer(modele?: SeanceModele, cycle?: ContexteCycle, echauffement: string[] = []) {
  try {
    await creerSeance(modele, cycle, echauffement)
  } catch (e) {
    void informer(`${(e as Error).message}\n(version ${__VERSION__})`, 'Impossible de démarrer la séance')
  }
}

async function creerSeance(modele: SeanceModele | undefined, cycle: ContexteCycle | undefined, echauffement: string[]) {
  debloquerSon()
  void seanceDuJourNatif(dateISO())
  const deload = !!(modele && cycle?.deload)
  await db.seances.add({
    ...(cycle && { cycleId: cycle.cycleId, semaine: cycle.semaine }),
    ...(deload && { deload: true }),
    ...(echauffement.length && { echauffement: { ids: echauffement, faits: [] } }),
    id: uid(),
    date: dateISO(),
    modeleId: modele?.id,
    nom: modele?.nom ?? 'Séance libre',
    sousTitre: modele?.sousTitre ?? 'exercices au choix',
    // Déload : plan allégé (moitié des séries, RPE 6-7, sans finisseur).
    exercices: structuredClone(modele?.exercices ?? []).map((p) => (deload ? planDeload(p) : p)),
    debut: Date.now(),
    enCours: true,
    poidsCorps: await dernierPoids(),
    chauffes: {},
    series: [],
    notes: {},
    ajustSeries: {},
  })
}

export default function Accueil({
  catalogue,
  onVoirSeance,
  onMesures,
  onReglages,
  onObjectifs,
  onBilan,
  onProgrammes,
}: {
  catalogue: Catalogue
  onVoirSeance: (id: string) => void
  onMesures: () => void
  /** Ouvre les Réglages (⚙). */
  onReglages: () => void
  /** Ouvre Corps → Objectifs (phase). */
  onObjectifs: () => void
  /** Ouvre Progression → Bilan. */
  onBilan: () => void
  /** Ouvre l'onglet Programmes (gestion du cycle). */
  onProgrammes: () => void
}) {
  const [bilan, setBilan] = useState(false)
  const [choix, setChoix] = useState(false)
  const [semaineDepliee, setSemaineDepliee] = useState(false)
  const [ouvert, setOuvert] = useState<string | null>(null)
  // Retour d'une séance annulée ou supprimée qu'on avait lancée depuis « Voir » : on y revient.
  const [apercu, setApercuEtat] = useState<SeanceModele | null>(() => {
    try {
      const o = JSON.parse(localStorage.getItem('retourSeance') ?? 'null') as { apercu?: string } | null
      localStorage.removeItem('retourSeance')
      const m = o?.apercu ? catalogue.modele(o.apercu) : undefined
      return m ? catalogue.pourDemarrer(m) : null
    } catch {
      return null
    }
  })
  const derniereMesure = useLiveQuery(() => db.mesures.orderBy('date').last(), [])
  // Rappels masqués par l'utilisateur : réapparaissent au bout d'une semaine.
  const [masques, setMasques] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem('rappelsMasques') ?? '{}')
    } catch {
      return {}
    }
  })
  const masque = (cle: string) => Date.now() - (masques[cle] ?? 0) < 7 * 86400000
  const masquer = (cle: string) => {
    const m = { ...masques, [cle]: Date.now() }
    setMasques(m)
    try {
      localStorage.setItem('rappelsMasques', JSON.stringify(m))
    } catch {
      /* stockage indisponible */
    }
  }
  useRetour(choix, () => setChoix(false))
  const voir = (m: SeanceModele | null) => {
    setChoix(false)
    transition(() => setApercuEtat(m && catalogue.pourDemarrer(m)), m ? 'avant' : 'arriere')
    window.scrollTo({ top: 0 })
  }
  const debutSemaine = lundi()
  const semaine = useLiveQuery(
    () => db.seances.where('date').aboveOrEqual(debutSemaine).filter((s) => !s.enCours).toArray(),
    [debutSemaine],
    []
  )
  const dernierExport = useLiveQuery(() => db.reglages.get('dernierExport'), [])
  const nbSeances = useLiveQuery(() => db.seances.count(), [], 0)
  const terminees = useLiveQuery(() => db.seances.filter((s) => !s.enCours).toArray(), [])
  // Appli Android : un APK plus récent publié ? (le site, lui, se met à jour tout seul)
  const [majAndroid, setMajAndroid] = useState<{ version: string; url: string } | null>(null)
  useEffect(() => void nouvelleVersionAndroid().then(setMajAndroid), [])
  // Toute première ouverture : pas encore de programme à soi ni de séance, on propose d'en choisir un.
  const nbProgrammes = useLiveQuery(() => db.programmes.count(), [], null)
  const premiereFois = nbProgrammes === 0 && terminees?.length === 0
  const reglages = useLiveQuery(() => db.reglages.toArray(), [], [])

  const { planning, actif } = catalogue
  // Séances faites cette semaine pour un modèle (sa variante maison compte aussi).
  const realisees = (m: SeanceModele) =>
    semaine.filter((s) => s.modeleId === m.id || catalogue.modele(s.modeleId)?.varianteDe === m.id).length
  // Chaque séance faite coche le créneau le plus proche de son jour (une séance peut revenir deux fois).
  const idPlanning = (id?: string) => planning.find((e) => e.modele.id === id || catalogue.modele(id)?.varianteDe === e.modele.id)?.modele.id
  const coches = creneauxFaits(
    planning.map((e) => ({ id: e.modele.id, jour: e.jour })),
    semaine.flatMap((s) => {
      const id = idPlanning(s.modeleId)
      return id ? [{ id, jour: jourSemaine(new Date(s.date + 'T12:00:00')) }] : []
    })
  )
  const faite = (e: EntreePlanning) => coches.has(planning.indexOf(e))
  const jour = jourSemaine()
  const duJour = planning.find((e) => e.jour === jour)
  const prochaine = planning.find((e) => !faite(e) && e.jour >= jour) ?? planning.find((e) => !faite(e)) ?? planning[0]
  const variante = duJour && catalogue.modeles.find((m) => m.varianteDe === duJour.modele.id)
  const proposee = duJour && !faite(duJour) ? duJour : prochaine
  const seancesDe = (p: Programme) => [...new Set(p.seances.map((e) => e.modeleId))].map((id) => catalogue.modele(id)).filter((m) => !!m)
  // Programme actif en tête, puis les autres ; les séances d'aucun programme à la fin.
  const programmes = [actif, ...catalogue.programmes.filter((p) => p.id !== actif.id)]
  const dansUnProgramme = new Set(catalogue.programmes.flatMap((p) => p.seances.map((e) => e.modeleId)))
  const horsProgramme = catalogue.modeles.filter((m) => !dansUnProgramme.has(m.id))
  const groupeOuvert = ouvert ?? actif.id

  // Exercices où l'objectif dépasse la dernière fois : « à battre », avec la série visée et ce qu'elle demande de plus.
  const recentes = terminees && [...terminees].filter((s) => !s.deload).sort((a, b) => b.debut - a.debut)
  const aBattreDe = (m: SeanceModele) =>
    recentes
      ? m.exercices.flatMap((p) => {
          const exo = exoAvecReglages(catalogue.exo(p.exoId), reglages)
          const sugg = suggestionPour(exo, p, recentes)
          const der = historiqueDe(recentes, p.exoId)[0]
          const i = sugg.charges.findIndex((_, k) => hausse(exo, sugg, der, k) !== null)
          return i < 0 ? [] : [{ exo, cible: chargeQte(exo, sugg.charges[i], sugg.reps[i]), plus: hausse(exo, sugg, der, i)! }]
        })
      : []

  const phase = phaseAffichee(catalogue.objectifs, dateISO())

  // Cycle en cours : semaine, déload, pause ; chaque séance lancée y est rattachée.
  const cycle = catalogue.cycle
  const etat = cycle && etatCycle(cycle)
  const contexte: ContexteCycle | undefined =
    cycle && etat ? { cycleId: cycle.id, semaine: etat.n >= 1 && !etat.fini && !etat.pause ? etat.n : undefined, deload: etat.deload } : undefined
  // On retient d'où la séance est lancée (accueil, ou « Voir ») pour y revenir si on l'annule.
  const lancer = (m?: SeanceModele, depuisApercu = false) => {
    try {
      localStorage.setItem('retourSeance', JSON.stringify(depuisApercu && m ? { apercu: m.id } : {}))
    } catch {
      /* stockage indisponible */
    }
    return demarrer(m && catalogue.pourDemarrer(m), contexte, m ? echauffementDe(m) : [])
  }
  const duresSemaine = semaine.reduce((a, s) => a + s.series.filter(estDure).length, 0)

  // Échauffement activé depuis « Voir » : enregistré sur la séance (comme dans Programmes) et pris en compte tout de suite.
  const changerEchauffement = (v: SeanceModele['echauffement']) => {
    if (!apercu) return
    const base = catalogue.modele(apercu.id)
    const avec = <T extends SeanceModele>(m: T): T => {
      const c = structuredClone(m)
      if (v === undefined) delete c.echauffement
      else c.echauffement = v
      return c
    }
    if (base) void db.modeles.put(avec(base))
    // Pendant un cycle, la séance lancée est sa copie : elle suit aussi (sinon le réglage serait oublié).
    const c = catalogue.cycle
    if (c?.modeles.some((m) => m.id === apercu.id)) void db.cycles.update(c.id, { modeles: c.modeles.map((m) => (m.id === apercu.id ? avec(m) : m)) })
    setApercuEtat(avec(apercu))
  }
  if (apercu) return <Apercu modele={apercu} catalogue={catalogue} deload={!!etat?.deload} onDemarrer={() => lancer(apercu, true)} onEchauffement={changerEchauffement} onFermer={() => voir(null)} />

  // Rappel des mensurations : seulement après 3 semaines sans en prendre.
  const joursMesure = derniereMesure ? Math.floor((Date.now() - Date.parse(derniereMesure.date + 'T12:00:00')) / 86400000) : null
  const mesuresEnRetard = nbSeances > 0 && (joursMesure === null || joursMesure > 21)

  const joursExport = dernierExport ? Math.floor((Date.now() - (dernierExport.valeur as number)) / 86400000) : null
  const exportVieux = nbSeances > 0 && (joursExport === null || joursExport >= 7)
  // Déload à avancer : seulement pendant une semaine de travail du cycle (le bouton est dans le cycle).
  const deloadPlusTot = cycle && etat && etat.n >= 1 && !etat.fini && !etat.deload && !etat.pause && terminees ? deloadConseille(terminees, catalogue.exo, dateISO()) : null
  const sauvegarderTout = async () => {
    try {
      await sauvegarder(CATEGORIES_COURANTES)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') void informer((e as Error).message, 'Sauvegarde impossible')
    }
  }

  const nomCourtPhase = (p: Phase) => {
    if (p === 'prise') return 'Prise'
    if (p === 'seche') return 'Sèche'
    if (p === 'maintien') return 'Maintien'
    return nomPhase(p)
  }

  const dateAffichee = (() => {
    const d = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })
    return d.charAt(0).toUpperCase() + d.slice(1)
  })()

  const textePhase = phase
    ? phase.aVenir
      ? `${nomCourtPhase(phase.phase)} (dès ${
          phase.debut === dateISO(new Date(Date.now() + 86400000))
            ? 'demain'
            : new Date(phase.debut + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
        })`
      : `${nomCourtPhase(phase.phase)} · sem. ${phase.semaine}${phase.total ? `/${phase.total}` : ''}`
    : ''

  const texteCycle =
    cycle && etat
      ? etat.fini
        ? 'Bilan cycle'
        : etat.n <= 0
        ? `Cycle · ${
            cycle.debut === dateISO(new Date(Date.now() + 86400000))
              ? 'Dès demain'
              : new Date(cycle.debut + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
          }`
        : etat.pause
        ? 'Cycle en pause'
        : etat.deload
        ? `Déload · Semaine ${etat.n}/${etat.total}`
        : `Cycle · Semaine ${etat.n}/${etat.total}`
      : ''

  return (
    <div style={{ paddingBottom: 95 }}>
      <div className="entete" style={{ alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <h1 style={{ textTransform: 'capitalize', fontSize: '1.45rem', fontWeight: 800, margin: 0, letterSpacing: '-0.3px' }}>
              {dateAffichee}
            </h1>
            <button
              type="button"
              className="btn-reglages"
              onClick={onReglages}
              aria-label="Réglages"
              style={{ background: 'none', border: 'none', padding: 4, color: 'var(--texte-faible)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <SlidersHorizontal size={20} strokeWidth={1.75} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
            {phase ? (
              <button
                type="button"
                onClick={onObjectifs}
                aria-label={`Objectif de phase : ${textePhase}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  borderRadius: 20,
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'var(--texte)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#34c759', flexShrink: 0 }} />
                <span>{textePhase}</span>
              </button>
            ) : (
              !premiereFois &&
              !periodes(catalogue.objectifs).length && (
                <button
                  type="button"
                  className="faible"
                  onClick={onObjectifs}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '5px 12px',
                    fontSize: '0.8rem',
                    borderRadius: 20,
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: 'var(--texte-faible)',
                    cursor: 'pointer',
                  }}
                >
                  + Phase
                </button>
              )
            )}
            {cycle && etat && (
              <button
                type="button"
                onClick={etat.fini ? () => setBilan(true) : onProgrammes}
                aria-label={`Cycle d'entraînement : ${texteCycle}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  borderRadius: 20,
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'var(--texte)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <RefreshCw size={13} strokeWidth={1.75} style={{ flexShrink: 0 }} />
                <span>{texteCycle}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {bilan && cycle && <BilanCycle cycle={cycle} catalogue={catalogue} onFermer={() => setBilan(false)} />}

      {/* En haut, sur une ligne : nouvelle version de l'appli Android, sauvegarde à faire (rares, et ce qu'on perdrait). */}
      {majAndroid && !masque('android') && (
        <div
          className="rappel-ligne"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            whiteSpace: 'nowrap',
            padding: '10px 14px',
            border: '1px solid rgba(86, 180, 233, 0.3)',
            background: 'rgba(86, 180, 233, 0.08)',
          }}
        >
          {/* Le téléchargement s'ouvre dans le navigateur du téléphone ; on installe par-dessus, les données restent. */}
          <a
            className="texte"
            href={majAndroid.url}
            style={{
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <Download size={16} strokeWidth={2} style={{ color: '#56b4e9', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Nouvelle version ({majAndroid.version}) : installer
              <span className="faible"> · données gardées</span>
            </span>
          </a>
          <button
            type="button"
            className="fermer-rappel"
            aria-label="Masquer ce rappel une semaine"
            onClick={() => masquer('android')}
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>
      )}
      {exportVieux && !masque('export') && (
        <div
          className="rappel-ligne"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            whiteSpace: 'nowrap',
            padding: '10px 14px',
            border: '1px solid rgba(249, 115, 22, 0.3)',
            background: 'rgba(249, 115, 22, 0.08)',
          }}
        >
          <button
            type="button"
            className="texte"
            onClick={sauvegarderTout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              background: 'none',
              border: 'none',
              color: 'inherit',
              padding: 0,
              cursor: 'pointer',
              textAlign: 'left',
              flex: 1,
              minWidth: 0,
            }}
          >
            <CloudUpload size={16} strokeWidth={2} style={{ color: '#f97316', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Sauvegarder (Drive, mail…)
              <span className="faible"> · {joursExport === null ? 'jamais fait' : `dernière il y a ${joursExport} j`}</span>
            </span>
          </button>
          <button
            type="button"
            className="fermer-rappel"
            aria-label="Masquer ce rappel une semaine"
            onClick={() => masquer('export')}
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>
      )}

      {premiereFois && (
        <ChoixProgramme
          catalogue={catalogue}
          titre="Pour commencer, choisis ton programme"
          intro="Tu pourras tout modifier ensuite (exercices, séries, jours) dans l’onglet Programmes. Les charges se règlent pendant ta 1re séance."
        />
      )}

      {/* Si le cycle est terminé, le bilan est mis en avant juste au-dessus de la séance */}
      {!premiereFois && cycle && etat?.fini && (
        <div style={{ marginBottom: 12 }}>
          <BandeauCycle cycle={cycle} etat={etat} onBilan={() => setBilan(true)} onProgrammes={onProgrammes} />
        </div>
      )}

      {/* La séance d'abord : c'est l'action principale de l'écran. */}
      {!premiereFois && (
      <div className="carte pile" style={{ padding: '16px', borderRadius: 16 }}>
        {proposee && duJour && proposee === duJour && !faite(duJour) ? (
          <>
            <div>
              <div className="faible" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Dumbbell size={16} strokeWidth={1.75} />
                <span>Séance du jour</span>
              </div>
              <h2 style={{ margin: '4px 0 0' }}>{proposee.modele.nom}</h2>
              {proposee.modele.sousTitre && (
                <div className="faible" style={{ fontSize: '0.95rem', margin: '2px 0 6px' }}>
                  {proposee.modele.sousTitre}
                </div>
              )}
              {(() => {
                // Retour après un trou : pas de reproche, on reprend où on en était.
                const n = terminees ? joursSansSeance(terminees, dateISO()) : null
                return n !== null && n >= 10 ? (
                  <div className="faible" style={{ margin: '4px 0 6px' }}>
                    Première séance depuis {n} jours : mêmes charges que la dernière fois, baisse un peu si c’est trop dur.
                  </div>
                ) : null
              })()}
              {!etat?.deload &&
                (() => {
                  const l = aBattreDe(proposee.modele)
                  if (!l.length) return null
                  return (
                    <div
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: 10,
                        padding: '8px 12px',
                        margin: '10px 0',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#f97316' }}>
                          À battre aujourd’hui
                        </span>
                        {l.length > 3 && (
                          <span className="faible" style={{ fontSize: '0.75rem' }}>
                            +{l.length - 3} autre{l.length > 4 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {l.slice(0, 3).map((x) => (
                          <div
                            key={x.exo.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: 8,
                              fontSize: '0.85rem',
                            }}
                          >
                            <span style={{ color: 'var(--texte)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {x.exo.nom}
                            </span>
                            <span style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                              <strong style={{ color: 'var(--texte)' }}>{x.cible}</strong>{' '}
                              <span style={{ color: '#f97316', fontWeight: 600, fontSize: '0.82rem' }}>({x.plus})</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
            </div>
            <div className="ligne" style={{ gap: 10, marginTop: 12 }}>
              <button
                type="button"
                className="btn primaire"
                style={{
                  flex: 2,
                  height: 44,
                  minHeight: 44,
                  borderRadius: 12,
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                }}
                onClick={() => lancer(proposee.modele)}
              >
                Démarrer
              </button>
              <button
                type="button"
                className="btn"
                style={{
                  flex: 1,
                  height: 44,
                  minHeight: 44,
                  borderRadius: 12,
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                }}
                onClick={() => voir(proposee.modele)}
              >
                Voir
              </button>
            </div>
          </>
        ) : duJour && faite(duJour) ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(52, 199, 89, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Check size={14} strokeWidth={2.5} style={{ color: '#34c759' }} />
              </div>
              <span style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--texte)' }}>
                {duJour.modele.nom} faite aujourd’hui
              </span>
            </div>
            {prochaine && prochaine !== duJour && (
              <div
                role="button"
                tabIndex={0}
                aria-label="Voir la séance"
                onClick={() => voir(prochaine.modele)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  borderRadius: 12,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  cursor: 'pointer',
                  marginTop: 8,
                }}
              >
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--texte)' }}>
                    Prochaine ({JOURS[prochaine.jour!]}) : {prochaine.modele.nom}
                  </div>
                  {prochaine.modele.sousTitre && (
                    <div className="faible" style={{ fontSize: '0.82rem', marginTop: 2 }}>
                      {prochaine.modele.sousTitre}
                    </div>
                  )}
                </div>
                <ChevronRight size={18} strokeWidth={1.75} className="muted" />
              </div>
            )}
          </>
        ) : (
          /* Jour de repos (comme dans la maquette) */
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(86, 180, 233, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Moon size={16} strokeWidth={2.2} style={{ color: '#56b4e9' }} />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--texte)' }}>
                Repos aujourd’hui
              </h2>
            </div>
            {proposee && (
              <div
                role="button"
                tabIndex={0}
                aria-label="Voir la séance"
                onClick={() => voir(proposee.modele)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  borderRadius: 14,
                  background: 'var(--subcard-gradient)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  cursor: 'pointer',
                  marginTop: 4,
                }}
              >
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--texte)' }}>
                    {proposee.jour === (jour % 7) + 1 ? 'Demain' : `Prochaine (${JOURS[proposee.jour!]})`} : {proposee.modele.nom}
                  </div>
                  {proposee.modele.sousTitre && (
                    <div className="faible" style={{ fontSize: '0.82rem', marginTop: 2 }}>
                      {proposee.modele.sousTitre}
                    </div>
                  )}
                </div>
                <ChevronRight size={18} strokeWidth={1.75} className="muted" />
              </div>
            )}
          </>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
          {proposee && (
            <button
              type="button"
              className="btn texte"
              onClick={() => setChoix(true)}
              style={{
                color: 'var(--accent)',
                fontSize: 13,
                fontWeight: 500,
                padding: '6px 0',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Choisir une séance à faire aujourd’hui ›
            </button>
          )}
          {variante && proposee === duJour && (
            <button
              type="button"
              className="btn texte"
              onClick={() => voir(variante)}
              style={{
                color: 'var(--texte-faible)',
                fontSize: 13,
                fontWeight: 500,
                padding: '6px 0',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Pas de salle ›
            </button>
          )}
        </div>
      </div>
      )}

      {/* Rappels contextuels sous la séance : déload avancé ou mensurations > 21j */}
      {deloadPlusTot && !masque('deload') && (
        <div
          className="rappel-ligne"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderRadius: 10,
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: 10,
            gap: 8,
            whiteSpace: 'nowrap',
          }}
        >
          <button
            type="button"
            className="texte"
            onClick={onProgrammes}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'none',
              border: 'none',
              color: 'inherit',
              padding: 0,
              cursor: 'pointer',
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: '0.85rem',
            }}
          >
            <Info size={15} strokeWidth={2} style={{ color: '#56b4e9', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Force en baisse sur {deloadPlusTot.baisses.length} exercices : déload conseillé ?
              <span className="faible"> · {deloadPlusTot.baisses.slice(0, 3).map((e) => e.nom).join(', ')}</span>
            </span>
          </button>
          <button
            type="button"
            className="fermer-rappel"
            aria-label="Masquer ce rappel une semaine"
            onClick={() => masquer('deload')}
            style={{
              width: 24,
              height: 24,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              color: 'var(--texte-faible)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      )}
      {mesuresEnRetard && !masque('mesures') && (
        <div
          className="rappel-ligne"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderRadius: 10,
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: 10,
            gap: 8,
            whiteSpace: 'nowrap',
          }}
        >
          <button
            type="button"
            className="texte"
            onClick={onMesures}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'none',
              border: 'none',
              color: 'inherit',
              padding: 0,
              cursor: 'pointer',
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: '0.85rem',
            }}
          >
            <Ruler size={15} strokeWidth={2} style={{ color: '#38bdf8', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {derniereMesure ? 'Reprendre tes mensurations' : 'Prendre tes premières mensurations'}
              {joursMesure !== null && <span className="faible"> · il y a {joursMesure} j</span>}
            </span>
          </button>
          <button
            type="button"
            className="fermer-rappel"
            aria-label="Masquer ce rappel une semaine"
            onClick={() => masquer('mesures')}
            style={{
              width: 24,
              height: 24,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              color: 'var(--texte-faible)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      )}

      {/* Journal du matin : de quoi se mettre en route (pesée, sommeil, calories, un vrai progrès). */}
      {!premiereFois && <JournalMatin catalogue={catalogue} terminees={terminees} entrainement={!!duJour} deload={!!etat?.deload && !etat.pause} />}

      {!premiereFois && (
      <div className="carte pile" style={{ padding: '16px', borderRadius: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Cette semaine</h3>
          <span className="faible" style={{ fontSize: '0.9rem' }}>
            {planning.length ? `${planning.filter(faite).length}/${planning.length}` : `${semaine.length} faite${semaine.length > 1 ? 's' : ''}`}
          </span>
        </div>

        {/* Frise 7 jours alignés */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, textAlign: 'center' }}>
          {[
            { id: 1, nomCourt: 'lun', lettre: 'L' },
            { id: 2, nomCourt: 'mar', lettre: 'M' },
            { id: 3, nomCourt: 'mer', lettre: 'M' },
            { id: 4, nomCourt: 'jeu', lettre: 'J' },
            { id: 5, nomCourt: 'ven', lettre: 'V' },
            { id: 6, nomCourt: 'sam', lettre: 'S' },
            { id: 7, nomCourt: 'dim', lettre: 'D' },
          ].map((d) => {
            const ent = planning.find((e) => e.jour === d.id)
            const faiteSemaine = semaine.find((s) => jourSemaine(new Date(s.debut)) === d.id)
            const estFait = ent ? faite(ent) : !!faiteSemaine
            const estAujourdhui = d.id === jour
            return (
              <div
                key={d.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  cursor: faiteSemaine || ent ? 'pointer' : 'default',
                }}
                onClick={() => {
                  if (faiteSemaine) onVoirSeance(faiteSemaine.id)
                  else if (ent) voir(ent.modele)
                }}
              >
                <span
                  style={{
                    fontSize: '0.78rem',
                    color: estAujourdhui ? 'var(--texte)' : 'var(--texte-faible)',
                    fontWeight: estAujourdhui ? 700 : 400,
                  }}
                >
                  {d.nomCourt}
                </span>

                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    background: estFait
                      ? 'rgba(34, 197, 94, 0.08)'
                      : ent
                      ? 'rgba(255, 255, 255, 0.03)'
                      : 'rgba(255, 255, 255, 0.02)',
                    border: estFait
                      ? '1.5px solid #22c55e'
                      : ent
                      ? estAujourdhui
                        ? '2px solid var(--accent)'
                        : '1.5px solid rgba(255, 255, 255, 0.2)'
                      : '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: estFait ? '0 0 10px rgba(34, 197, 94, 0.25)' : 'none',
                    color: estFait ? '#22c55e' : ent ? 'var(--texte)' : 'var(--texte-faible)',
                  }}
                >
                  {d.lettre}
                </div>

                <div style={{ height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {estFait ? (
                    <Check size={14} strokeWidth={2.5} style={{ color: '#22c55e' }} />
                  ) : ent ? (
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.2)' }} />
                  ) : (
                    <span style={{ color: 'rgba(255, 255, 255, 0.2)', fontSize: '0.8rem' }}>—</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Ligne bilan en bas avec accordéon des séances de la semaine */}
        {semaine.length > 0 && (
          <div style={{ marginTop: 8, paddingTop: 10, borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <button
              type="button"
              onClick={() => setSemaineDepliee(!semaineDepliee)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'none',
                border: 'none',
                padding: '4px 0',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span className="faible" style={{ fontSize: '0.88rem' }}>
                Bilan <strong style={{ color: 'var(--texte)' }}>{semaine.length} séance{semaine.length > 1 ? 's' : ''}</strong>
                {duresSemaine > 0 ? ` · ${duresSemaine} séries` : ''}
              </span>
              <span style={{ color: 'var(--texte-faible)', display: 'flex', alignItems: 'center' }}>
                {semaineDepliee ? <ChevronUp size={18} strokeWidth={1.75} /> : <ChevronDown size={18} strokeWidth={1.75} />}
              </span>
            </button>

            {semaineDepliee && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10, paddingTop: 4 }}>
                {[...semaine]
                  .sort((a, b) => b.debut - a.debut)
                  .map((s) => {
                    const dures = s.series.filter(estDure).length
                    const t = duree(dureeSeanceEffective(s))
                    const d = new Date(s.debut)
                    const jourNom = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
                    return (
                      <div
                        key={s.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => onVoirSeance(s.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          borderRadius: 10,
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                          cursor: 'pointer',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--texte)' }}>
                            {s.nom}
                          </div>
                          <div className="faible" style={{ fontSize: '0.8rem', marginTop: 1 }}>
                            <span style={{ textTransform: 'capitalize' }}>{jourNom}</span> · {t}{dures > 0 ? ` · ${dures} séries dures` : ''}
                          </div>
                        </div>
                        <ChevronRight size={16} strokeWidth={1.75} className="muted" />
                      </div>
                    )
                  })}

                <button
                  type="button"
                  className="btn texte"
                  onClick={onBilan}
                  style={{
                    color: 'var(--accent)',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    marginTop: 4,
                    padding: '6px 0',
                    textAlign: 'center',
                    width: '100%',
                  }}
                >
                  Voir les statistiques complètes ›
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      )}


      {choix && (
        <div className="modal-fond" onClick={() => setChoix(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="ligne entre" style={{ marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>Choisir une séance</h2>
              <button
                type="button"
                className="icone"
                onClick={() => setChoix(false)}
                aria-label="Fermer"
                style={{ fontSize: 18 }}
              >
                ✕
              </button>
            </div>

            {[
              ...programmes.map((p) => ({
                id: p.id,
                nom: p.nom,
                actif: p.id === actif.id,
                prog: p,
                seances: seancesDe(p),
              })),
              ...(horsProgramme.length
                ? [{ id: 'hors', nom: 'Hors programme', actif: false, prog: null, seances: horsProgramme }]
                : []),
            ].map((g) => {
              const ouvert = groupeOuvert === g.id
              return (
                <div
                  key={g.id}
                  className={'carte pile' + (g.actif ? ' carte-programme-actif' : '')}
                  style={{
                    marginBottom: 12,
                    padding: 12,
                    background: 'var(--surface)',
                    border: g.actif ? '1.5px solid var(--accent)' : '1px solid var(--bord)',
                    borderRadius: 16,
                  }}
                >
                  <button
                    type="button"
                    className="ligne entre"
                    style={{
                      width: '100%',
                      background: 'none',
                      border: 'none',
                      padding: '4px 2px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      alignItems: 'center',
                    }}
                    onClick={() => setOuvert(ouvert ? '' : g.id)}
                    aria-expanded={ouvert}
                  >
                    <div className="ligne wrap" style={{ gap: 8, alignItems: 'center' }}>
                      <strong style={{ fontSize: '1.05rem', color: 'var(--texte)' }}>{g.nom}</strong>
                      {g.actif && <span className="pastille ok">actif</span>}
                      <span className="faible" style={{ fontSize: '0.85rem' }}>
                        ({g.seances.length} séance{g.seances.length > 1 ? 's' : ''})
                      </span>
                    </div>
                    <span className={'muted chevron-accordeon' + (ouvert ? ' ouvert' : '')} style={{ fontSize: 16 }}>▸</span>
                  </button>

                  <div className={'accordeon-tiroir' + (ouvert ? ' ouvert' : '')}>
                    <div className="accordeon-contenu">
                      <div
                        className="pile"
                        style={{
                          gap: 8,
                          marginTop: 10,
                          paddingTop: 10,
                          borderTop: '1px solid var(--bord)',
                        }}
                      >
                        {g.seances.length === 0 ? (
                          <div className="faible" style={{ fontStyle: 'italic', padding: '6px 2px' }}>
                            Aucune séance dans ce programme.
                          </div>
                        ) : (
                          g.seances.map((m) => {
                            const creneauxJours = g.prog
                              ? g.prog.seances.filter((e) => e.modeleId === m.id && e.jour).map((e) => e.jour!)
                              : []
                            const estAujourdhui = creneauxJours.includes(jour)
                            const faiteSemaine = realisees(m) > 0

                            return (
                              <button
                                key={m.id}
                                type="button"
                                className="sous-seance-item"
                                style={{
                                  padding: '12px 14px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 12,
                                }}
                                onClick={() => voir(m)}
                              >
                                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                                  <div className="ligne wrap" style={{ gap: 6, alignItems: 'center' }}>
                                    <strong style={{ fontSize: '1rem', color: 'var(--texte)' }}>{m.nom}</strong>
                                    {creneauxJours.map((j) => (
                                      <span key={j} className={'badge-jour' + (j === jour ? ' aujourdhui' : '')}>
                                        {['', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][j]}
                                      </span>
                                    ))}
                                  </div>
                                  {m.sousTitre && (
                                    <div
                                      className="muted petit"
                                      style={{
                                        marginTop: 2,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {m.sousTitre}
                                    </div>
                                  )}
                                  <div className="faible" style={{ marginTop: 4, fontSize: '0.8rem' }}>
                                    {dureeTexte(m, terminees)}
                                  </div>
                                </div>

                                <div className="ligne" style={{ gap: 6, alignItems: 'center', flexShrink: 0 }}>
                                  {faiteSemaine ? (
                                    <span className="pastille ok" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                                      ✓ Faite
                                    </span>
                                  ) : estAujourdhui ? (
                                    <span className="pastille accent" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                                      Aujourd'hui
                                    </span>
                                  ) : null}
                                  <span className="muted" style={{ fontSize: '1.1rem', marginLeft: 2 }}>›</span>
                                </div>
                              </button>
                            )
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--bord)' }}>
              <button
                type="button"
                className="sous-seance-item"
                style={{
                  padding: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                }}
                onClick={() => lancer()}
              >
                <div style={{ textAlign: 'left' }}>
                  <strong style={{ fontSize: '0.98rem' }}>⚡ Séance libre</strong>
                  <div className="faible" style={{ marginTop: 2, fontSize: '0.8rem' }}>
                    Exercices ajoutés au fur et à mesure sans modèle
                  </div>
                </div>
                <span className="pastille accent" style={{ fontSize: '1rem', padding: '2px 8px' }}>+</span>
              </button>
            </div>

            <button className="btn discret plein" style={{ marginTop: 10 }} onClick={() => setChoix(false)}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
