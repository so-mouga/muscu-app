import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Check, CloudUpload, Download, Info, Moon, RefreshCw, Ruler, SlidersHorizontal, X, Zap } from 'lucide-react'
import type { Catalogue, EntreePlanning } from '../catalogue'
import { db, dernierPoids, exoAvecReglages, historiqueDe, uid } from '../db'
import { chargeQte, dateISO, duree, dureeSeanceEffective, dureeTexte, estDure, jourSemaine, kg, lundi } from '../lib/calc'
import { creneauxFaits } from '../lib/historique'
import { hausse, suggestionPour } from '../lib/progression'
import { nomPhase, periodes, phaseAffichee, type Phase } from '../lib/objectifs'
import { debloquerSon } from '../lib/appareil'
import { transition, useRetour } from '../lib/nav'
import JournalMatin from '../components/JournalMatin'
import { BilanCycle } from '../components/Cycle'
import ListeExosJour, { type LigneExo } from '../components/ListeExosJour'
import { etatCycle, planDeload } from '../lib/cycle'
import { deloadConseille } from '../lib/blocages'
import Apercu from './Apercu'
import type { Programme, Seance, SeanceModele } from '../types'
import { informer } from '../components/Dialogues'
import ChoixProgramme from '../components/ChoixProgramme'
import { depuisDebut, joursSansSeance, resumeSeance, semainesTenues } from '../lib/motivation'
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
  const poidsCorps = await dernierPoids()
  // Une seule séance en cours : un double appui sur « Démarrer » n'en crée pas une seconde, qui reviendrait plus tard.
  await db.transaction('rw', db.seances, async () => {
    if (await db.seances.filter((s) => s.enCours).first()) return
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
      poidsCorps,
      chauffes: {},
      series: [],
      notes: {},
      ajustSeries: {},
    })
  })
}

export default function Accueil({
  catalogue,
  onVoirSeance,
  onMesures,
  onReglages,
  onObjectifs,
  onJournal,
  onProgrammes,
}: {
  catalogue: Catalogue
  onVoirSeance: (id: string) => void
  onMesures: () => void
  /** Ouvre les Réglages (⚙). */
  onReglages: () => void
  /** Ouvre Corps → Objectifs (phase). */
  onObjectifs: () => void
  /** Ouvre Progrès → Journal. */
  onJournal: () => void
  /** Ouvre l'onglet Programmes (gestion du cycle). */
  onProgrammes: () => void
}) {
  const [bilan, setBilan] = useState(false)
  const [choix, setChoix] = useState(false)
  const [seanceFaiteModal, setSeanceFaiteModal] = useState<Seance | null>(null)
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
  useRetour(!!seanceFaiteModal, () => setSeanceFaiteModal(null))
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
  const cycles = useLiveQuery(() => db.cycles.toArray(), [], [])
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
  // Séance terminée aujourd'hui, prévue ou non (rattrapage un jour de repos).
  const faiteAuj = [...semaine].filter((s) => s.date === dateISO()).sort((a, b) => b.debut - a.debut)[0]
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
        ? 'Cycle terminé'
        : etat.n <= 0
        ? `Cycle · ${
            cycle.debut === dateISO(new Date(Date.now() + 86400000))
              ? 'Dès demain'
              : new Date(cycle.debut + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
          }`
        : etat.pause
        ? 'Cycle en pause'
        : etat.deload
        ? `Déload · sem. ${etat.n}/${etat.total}`
        : `Cycle · sem. ${etat.n}/${etat.total}`
      : ''

  // Au plus deux rappels à la fois (un seul sur un écran peu haut), par ordre d'importance : « Démarrer » doit rester à l'écran.
  const rappels = [
    majAndroid && !masque('android') && (
      <div key="android" className="rappel-ligne">
        {/* Le téléchargement s'ouvre dans le navigateur du téléphone ; on installe par-dessus, les données restent. */}
        <a className="texte" href={majAndroid.url}>
          <Download size={16} strokeWidth={2} className="rappel-ico info" />
          <span className="rappel-texte">
            Nouvelle version ({majAndroid.version}) : installer
            <span className="faible"> · données gardées</span>
          </span>
        </a>
        <button type="button" className="fermer-rappel" aria-label="Masquer ce rappel une semaine" onClick={() => masquer('android')}>
          <X size={15} strokeWidth={2} />
        </button>
      </div>
    ),
    !premiereFois && etat?.fini && (
      <div key="cycle" className="rappel-ligne">
        <button type="button" className="texte" onClick={() => setBilan(true)}>
          <RefreshCw size={16} strokeWidth={2} className="rappel-ico ok" />
          <span className="rappel-texte">Cycle terminé : voir le bilan</span>
        </button>
      </div>
    ),
    deloadPlusTot && !masque('deload') && (
      <div key="deload" className="rappel-ligne">
        <button type="button" className="texte" onClick={onProgrammes}>
          <Info size={16} strokeWidth={2} className="rappel-ico info" />
          <span className="rappel-texte">
            Force en baisse sur {deloadPlusTot.baisses.length} exercices : déload conseillé ?
            <span className="faible"> · {deloadPlusTot.baisses.slice(0, 3).map((e) => e.nom).join(', ')}</span>
          </span>
        </button>
        <button type="button" className="fermer-rappel" aria-label="Masquer ce rappel une semaine" onClick={() => masquer('deload')}>
          <X size={15} strokeWidth={2} />
        </button>
      </div>
    ),
    exportVieux && !masque('export') && (
      <div key="export" className="rappel-ligne">
        <button type="button" className="texte" onClick={sauvegarderTout}>
          <CloudUpload size={16} strokeWidth={2} className="rappel-ico info" />
          <span className="rappel-texte">
            Sauvegarder (Drive, mail…)
            <span className="faible"> · {joursExport === null ? 'jamais fait' : `dernière il y a ${joursExport} j`}</span>
          </span>
        </button>
        <button type="button" className="fermer-rappel" aria-label="Masquer ce rappel une semaine" onClick={() => masquer('export')}>
          <X size={15} strokeWidth={2} />
        </button>
      </div>
    ),
    mesuresEnRetard && !masque('mesures') && (
      <div key="mesures" className="rappel-ligne">
        <button type="button" className="texte" onClick={onMesures}>
          <Ruler size={16} strokeWidth={2} className="rappel-ico info" />
          <span className="rappel-texte">
            {derniereMesure ? 'Reprendre tes mensurations' : 'Prendre tes premières mensurations'}
            {joursMesure !== null && <span className="faible"> · il y a {joursMesure} j</span>}
          </span>
        </button>
        <button type="button" className="fermer-rappel" aria-label="Masquer ce rappel une semaine" onClick={() => masquer('mesures')}>
          <X size={15} strokeWidth={2} />
        </button>
      </div>
    ),
  ]
    .filter(Boolean)
    .slice(0, window.innerHeight < 720 ? 1 : 2)

  const nbFaites = planning.filter(faite).length
  // Semaines tenues (les trois quarts des séances prévues) : affichées à partir de 2, déloads et pauses ne cassent rien.
  const tenues = terminees ? semainesTenues(terminees, planning.length, cycles, dateISO()) : 0
  // Un seul vrai progrès, depuis le début du cycle en cours, sinon de la phase, sinon en 4 semaines.
  const blocEnCours = cycle && etat && etat.n >= 1 && !etat.fini ? cycle.debut : phase && !phase.aVenir ? phase.debut : undefined
  const progres = terminees ? depuisDebut(terminees, catalogue.exo, blocEnCours ?? dateISO(new Date(Date.now() - 28 * 86400000)), 1)[0] : undefined
  const gainBloc = (() => {
    if (!progres) return ''
    const dc = Math.round((progres.apres.charge - progres.avant.charge) * 100) / 100
    const dr = progres.apres.reps - progres.avant.reps
    if (progres.exo.assistance && dc < 0) return `−${kg(-dc)} kg d’assistance`
    if (dc > 0) return `+${kg(dc)} kg`
    if (dr <= 0) return ''
    return progres.exo.mesure === 'temps' ? `+${dr} s` : `+${dr} rep${dr > 1 ? 's' : ''}`
  })()

  const lignesDe = (m: SeanceModele, avecGains: boolean): LigneExo[] => {
    const gains = avecGains ? new Map(aBattreDe(m).map((x) => [x.exo.id, x.plus])) : undefined
    return m.exercices.map((p, i) => ({ id: `${p.exoId}-${i}`, nom: catalogue.exo(p.exoId).nom, gain: gains?.get(p.exoId) }))
  }
  // Retour après un trou : pas de reproche, on reprend où on en était.
  const joursSans = terminees ? joursSansSeance(terminees, dateISO()) : null
  const etiquetteProchaine = (e: EntreePlanning) => (e.jour === (jour % 7) + 1 ? 'Demain' : `Prochaine (${JOURS[e.jour!]})`)

  const aLancer = proposee && duJour && proposee === duJour && !faite(duJour)
  const mieuxAuj = faiteAuj && !faiteAuj.deload && terminees ? resumeSeance(faiteAuj, terminees, catalogue.exo) : null

  /** La séance qui vient, quand il n'y a rien à lancer aujourd'hui : on la regarde, sans orange. */
  const blocProchaine = (e: EntreePlanning) => (
    <>
      <div className="seance-jour-suite">
        <span>
          {etiquetteProchaine(e)} : {e.modele.nom}
        </span>
        <span className="seance-jour-duree">{dureeTexte(e.modele, terminees, true)}</span>
      </div>
      <ListeExosJour lignes={lignesDe(e.modele, false)} entiere />
      <div className="seance-jour-actions">
        <button type="button" className="btn" onClick={() => voir(e.modele)}>
          Voir la séance
        </button>
      </div>
    </>
  )

  return (
    <div className={premiereFois ? 'accueil premiere' : 'accueil'}>
      <div className="entete accueil-entete">
        <h1>{dateAffichee}</h1>
        <button type="button" className="btn-reglages" onClick={onReglages} aria-label="Réglages">
          <SlidersHorizontal size={20} strokeWidth={1.75} />
        </button>
      </div>

      {!premiereFois && (
        <div className="accueil-reperes">
          {phase ? (
            <button type="button" onClick={onObjectifs} aria-label={`Objectif de phase : ${textePhase}`}>
              <span className={phase.aVenir ? 'repere-point a-venir' : 'repere-point'} />
              {phase.aVenir ? (
                textePhase
              ) : (
                <>
                  <span className="repere-fort">{nomCourtPhase(phase.phase)}</span>
                  {textePhase.slice(nomCourtPhase(phase.phase).length)}
                </>
              )}
            </button>
          ) : (
            !periodes(catalogue.objectifs).length && (
              <button type="button" onClick={onObjectifs}>
                + Phase
              </button>
            )
          )}
          {cycle && etat && (
            <button type="button" onClick={onProgrammes} aria-label={`Cycle d'entraînement : ${texteCycle}`}>
              {texteCycle}
            </button>
          )}
        </div>
      )}

      {bilan && cycle && <BilanCycle cycle={cycle} catalogue={catalogue} onFermer={() => setBilan(false)} />}

      {rappels}

      {premiereFois && (
        <ChoixProgramme
          catalogue={catalogue}
          titre="Pour commencer, choisis ton programme"
          intro="Tu pourras tout modifier ensuite (exercices, séries, jours) dans l’onglet Programmes. Les charges se règlent pendant ta 1re séance."
        />
      )}

      {!premiereFois && (
        <>
          <div className="accueil-tableau">
            <JournalMatin catalogue={catalogue} />
            <button type="button" className="accueil-semaine" onClick={onJournal} aria-label="Cette semaine : ouvrir le Journal">
              <strong>Cette semaine</strong>
              {planning.length > 0 && (
                <span className="semaine-points" aria-hidden="true">
                  {planning.map((_, i) => (
                    <i key={i} className={i < nbFaites ? 'fait' : ''} />
                  ))}
                </span>
              )}
              <span className={tenues >= 2 ? 'semaine-texte tenue' : 'semaine-texte'}>
                {tenues >= 2 ? `${tenues}e semaine tenue` : planning.length ? `${nbFaites} sur ${planning.length}` : `${semaine.length} faite${semaine.length > 1 ? 's' : ''}`} ›
              </span>
            </button>
            {progres && gainBloc && (
              <div className="accueil-progres">
                <span className="accueil-progres-nom">{progres.exo.nom}</span>
                <span className="accueil-progres-gain">
                  {gainBloc} {blocEnCours ? 'sur ce bloc' : 'en 4 semaines'}
                </span>
              </div>
            )}
          </div>

          {/* La séance d'abord : elle prend la place qui reste, « Démarrer » reste au même endroit. */}
          <div className={aLancer || !proposee ? 'seance-jour' : 'seance-jour sans-action'}>
            {aLancer ? (
              <>
                <div className="seance-jour-haut">
                  <span className={etat?.deload ? 'seance-jour-etiquette deload' : 'seance-jour-etiquette'}>{etat?.deload ? 'Déload · charges allégées' : 'Séance du jour'}</span>
                  <button type="button" className="seance-jour-lien" onClick={() => setChoix(true)}>
                    Autre séance ›
                  </button>
                </div>
                <div className="seance-jour-titre">
                  <h2>{proposee.modele.nom}</h2>
                  <span className="seance-jour-duree">{dureeTexte(proposee.modele, terminees, true)}</span>
                </div>
                {variante && (
                  <button type="button" className="seance-jour-lien pas-de-salle" onClick={() => voir(variante)}>
                    Pas de salle ›
                  </button>
                )}
                {joursSans !== null && joursSans >= 10 && <div className="faible seance-jour-retour">Première séance depuis {joursSans} jours : mêmes charges que la dernière fois, baisse un peu si c’est trop dur.</div>}
                <ListeExosJour lignes={lignesDe(proposee.modele, !etat?.deload)} />
                <div className="seance-jour-actions">
                  <button type="button" className="btn primaire" onClick={() => lancer(proposee.modele)}>
                    Démarrer
                  </button>
                  <button type="button" className="btn" onClick={() => voir(proposee.modele)}>
                    Voir
                  </button>
                </div>
              </>
            ) : (duJour && faite(duJour)) || faiteAuj ? (
              <>
                <div className="seance-jour-haut">
                  <span className="seance-jour-etat">
                    <span className="seance-jour-ico ok">
                      <Check size={18} strokeWidth={2.5} />
                    </span>
                    {faiteAuj?.nom ?? duJour?.modele.nom} faite
                  </span>
                  <button type="button" className="seance-jour-lien" onClick={() => setChoix(true)}>
                    Autre séance ›
                  </button>
                </div>
                {mieuxAuj && (mieuxAuj.mieux > 0 || mieuxAuj.records > 0) && (
                  <div className="seance-jour-mieux">
                    {[mieuxAuj.mieux > 0 && `${mieuxAuj.mieux} exercice${mieuxAuj.mieux > 1 ? 's' : ''} mieux que la dernière fois`, mieuxAuj.records > 0 && `${mieuxAuj.records} record${mieuxAuj.records > 1 ? 's' : ''}`].filter(Boolean).join(', ')}
                  </div>
                )}
                {faiteAuj && (
                  <button type="button" className="seance-jour-stats" onClick={() => setSeanceFaiteModal(faiteAuj)}>
                    {duree(dureeSeanceEffective(faiteAuj))} · {faiteAuj.series.filter(estDure).length} séries dures ›
                  </button>
                )}
                {prochaine && prochaine !== duJour && blocProchaine(prochaine)}
              </>
            ) : proposee ? (
              <>
                <div className="seance-jour-haut">
                  <span className="seance-jour-etat">
                    <span className="seance-jour-ico info">
                      <Moon size={18} strokeWidth={2.5} />
                    </span>
                    Repos
                  </span>
                  <button type="button" className="seance-jour-lien" onClick={() => setChoix(true)}>
                    Faire une séance ›
                  </button>
                </div>
                {blocProchaine(proposee)}
              </>
            ) : (
              /* Programme sans jours : rien de prévu, mais on peut toujours lancer une séance. */
              <>
                <div className="seance-jour-etat">Aucune séance prévue</div>
                <div className="faible seance-jour-retour">Ton programme n’a pas de jours fixés : choisis ce que tu fais aujourd’hui.</div>
                <div className="seance-jour-espace" />
                <div className="seance-jour-actions">
                  <button type="button" className="btn primaire" onClick={() => setChoix(true)}>
                    Choisir une séance
                  </button>
                </div>
              </>
            )}
          </div>
        </>
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
                    borderRadius: 'var(--rayon-2)',
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
                      <strong style={{ fontSize: 'var(--t-texte)', color: 'var(--texte)' }}>{g.nom}</strong>
                      {g.actif && <span className="pastille ok">actif</span>}
                      <span className="faible" style={{ fontSize: 'var(--t-petit)' }}>
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
                                    <strong style={{ fontSize: 'var(--t-texte)', color: 'var(--texte)' }}>{m.nom}</strong>
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
                                  <div className="faible" style={{ marginTop: 4, fontSize: 'var(--t-legende)' }}>
                                    {dureeTexte(m, terminees)}
                                  </div>
                                </div>

                                <div className="ligne" style={{ gap: 6, alignItems: 'center', flexShrink: 0 }}>
                                  {faiteSemaine ? (
                                    <span className="pastille ok" style={{ fontSize: 'var(--t-legende)', fontWeight: 600 }}>
                                      ✓ Faite
                                    </span>
                                  ) : estAujourdhui ? (
                                    <span className="pastille accent" style={{ fontSize: 'var(--t-legende)', fontWeight: 600 }}>
                                      Aujourd'hui
                                    </span>
                                  ) : null}
                                  <span className="muted" style={{ fontSize: 'var(--t-texte)', marginLeft: 2 }}>›</span>
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
                  <strong className="seance-libre" style={{ fontSize: 'var(--t-texte)' }}>
                    <Zap size={16} strokeWidth={2} /> Séance libre
                  </strong>
                  <div className="faible" style={{ marginTop: 2, fontSize: 'var(--t-legende)' }}>
                    Exercices ajoutés au fur et à mesure sans modèle
                  </div>
                </div>
                <span className="pastille accent" style={{ fontSize: 'var(--t-texte)', padding: '2px 8px' }}>+</span>
              </button>
            </div>

            <button className="btn discret plein" style={{ marginTop: 10 }} onClick={() => setChoix(false)}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {seanceFaiteModal && (() => {
        const s = seanceFaiteModal
        const dures = s.series.filter(estDure).length
        const t = duree(dureeSeanceEffective(s))
        const d = new Date(s.debut)
        const dateTexte = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
        const dateFormatee = dateTexte.charAt(0).toUpperCase() + dateTexte.slice(1)

        const exosMap = new Map<string, typeof s.series>()
        for (const serie of s.series) {
          const list = exosMap.get(serie.exoId) ?? []
          list.push(serie)
          exosMap.set(serie.exoId, list)
        }

        return (
          <div className="modal-fond" onClick={() => setSeanceFaiteModal(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="ligne entre" style={{ marginBottom: 14, alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--ok-voile)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Check size={18} strokeWidth={2.5} style={{ color: 'var(--ok)' }} />
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 'var(--t-titre)', fontWeight: 800 }}>{s.nom}</h2>
                    <div className="faible" style={{ fontSize: 'var(--t-petit)', marginTop: 2 }}>
                      {dateFormatee}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="icone"
                  onClick={() => setSeanceFaiteModal(null)}
                  aria-label="Fermer"
                  style={{ fontSize: 18, padding: 4 }}
                >
                  ✕
                </button>
              </div>

              {/* Badges récapitulatifs */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 'var(--rayon)', background: 'var(--voile)', border: '1px solid var(--bord)', fontSize: 'var(--t-legende)', color: 'var(--texte)' }}>
                  ⏱️ {t}
                </span>
                {dures > 0 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 'var(--rayon)', background: 'var(--accent-voile)', border: '1px solid var(--accent-bord)', fontSize: 'var(--t-legende)', color: 'var(--accent)', fontWeight: 600 }}>
                    💪 {dures} série{dures > 1 ? 's' : ''} dure{dures > 1 ? 's' : ''}
                  </span>
                )}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 'var(--rayon)', background: 'var(--voile)', border: '1px solid var(--bord)', fontSize: 'var(--t-legende)', color: 'var(--texte-2)' }}>
                  🎯 {exosMap.size} exercice{exosMap.size > 1 ? 's' : ''}
                </span>
                {s.poidsCorps && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 'var(--rayon)', background: 'var(--voile)', border: '1px solid var(--bord)', fontSize: 'var(--t-legende)', color: 'var(--texte-2)' }}>
                    ⚖️ {kg(s.poidsCorps)} kg
                  </span>
                )}
              </div>

              {/* Liste des exercices et séries */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '46dvh', overflowY: 'auto', marginBottom: 16 }}>
                {Array.from(exosMap.entries()).map(([exoId, series]) => {
                  const exo = catalogue.exo(exoId)
                  return (
                    <div
                      key={exoId}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--rayon-2)',
                        background: 'var(--surface-2)',
                        border: '1px solid var(--voile)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 'var(--t-petit)', color: 'var(--texte)' }}>
                          {exo.nom}
                        </span>
                        <span className="faible" style={{ fontSize: 'var(--t-legende)' }}>
                          {series.length} série{series.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {series.map((serie, idx) => {
                          const dure = estDure(serie)
                          return (
                            <span
                              key={serie.id || idx}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '3px 8px',
                                borderRadius: 'var(--rayon-2)',
                                background: dure ? 'var(--accent-voile)' : 'var(--surface-2)',
                                border: '1px solid ' + (dure ? 'var(--accent-bord)' : 'var(--bord)'),
                                fontSize: 'var(--t-legende)',
                                color: dure ? 'var(--accent)' : 'var(--texte)',
                                fontWeight: dure ? 600 : 400,
                              }}
                            >
                              {chargeQte(exo, serie.charge, serie.reps)}
                              {serie.rpe ? <span style={{ opacity: 0.65, fontSize: 'var(--t-legende)' }}>@{serie.rpe}</span> : null}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="button"
                  className="btn discret"
                  onClick={() => {
                    const id = s.id
                    setSeanceFaiteModal(null)
                    onVoirSeance(id)
                  }}
                  style={{
                    height: 44,
                    borderRadius: 'var(--rayon-2)',
                    fontSize: 'var(--t-petit)',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  Ouvrir l'historique complet pour modifier ›
                </button>
                <button
                  type="button"
                  className="btn discret plein"
                  onClick={() => setSeanceFaiteModal(null)}
                  style={{ height: 40, borderRadius: 'var(--rayon-2)' }}
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )
      })()}

    </div>
  )
}
