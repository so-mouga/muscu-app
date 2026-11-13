import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Check, ChevronRight, CloudUpload, Download, Info, Moon, RefreshCw, Ruler, SlidersHorizontal, Target, X, Zap } from 'lucide-react'
import type { Catalogue, EntreePlanning } from '../catalogue'
import { db, dernierPoids, exoAvecReglages, historiqueDe, setReglage, uid } from '../db'
import { chargeQte, dateISO, duree, dureeEstimee, dureeSeanceEffective, dureeTexte, estDure, jourSemaine, kg, lundi, minutes } from '../lib/calc'
import { sousTitrePerso, sousTitreSeance } from '../lib/programme'
import { creneauxFaits, creneauxRates } from '../lib/historique'
import { hausse, suggestionPour } from '../lib/progression'
import { derniereSemainePhase, nomCourtPhase, nomVise, periodes, phaseAffichee } from '../lib/objectifs'
import { phaseFinie, reperesAPrendre, reperesDeFin, type Repere } from '../lib/recap'
import { PriseCorps, type PageCorps } from './Corps'
import { debloquerSon } from '../lib/appareil'
import { transition, useRetour } from '../lib/nav'
import JournalMatin from '../components/JournalMatin'
import ListeExosJour, { type LigneExo } from '../components/ListeExosJour'
import Disque from '../components/Disque'
import FenetreDisque from '../components/FenetreDisque'
import { cransDeSeance, etatDisque, totalCrans } from '../lib/crans'
import { arretCycle, contexteCycle, etatCycle, lundiDe, type ContexteCycle, planDeload, reprendreSemaine } from '../lib/cycle'
import { deloadConseille } from '../lib/blocages'
import Apercu from './Apercu'
import type { Programme, SeanceModele } from '../types'
import { informer } from '../components/Dialogues'
import { conseilsAChoisir } from '../lib/prochaineFois'
import { depuisDebut, faitesSurPrevues, gainsDeSeance, joursSansSeance, semainesTenues } from '../lib/motivation'
import { CLE_PREVUS, prevuDeSemaine, type EtapePrevu } from '../lib/prevu'
import { CLE_DEMARRAGE, NOMS_JOURS, type EtatDemarrage } from '../lib/demarrage'
import { nouvelleVersionAndroid, seanceDuJourNatif } from '../lib/natif'
import { CATEGORIES_COURANTES, sauvegarder } from '../lib/sauvegarde'
import { echauffementDe } from '../data/echauffements'
import Deplie from '../components/Deplie'

const CLE_RAPPELS_FAITS = 'rappelsFaits'

/** Sans modèle : séance libre, les exercices s'ajoutent à la volée. */
/** Contexte du cycle au démarrage : semaine en cours et déload éventuel. */
const JOURS_COURTS = ['', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']
/** Ce qu'il reste à prendre, en quelques mots : le rappel tient sur une ligne. */
const tesReperes = (manque: Repere[]) => (manque.length > 1 ? 'tes repères' : manque[0])
const ilYA = (date?: string) => (date ? `il y a ${Math.max(0, Math.floor((Date.now() - Date.parse(date + 'T12:00:00')) / 86400000))} j` : 'jamais')

async function demarrer(modele?: SeanceModele, cycle?: ContexteCycle, echauffement: string[] = [], allegee = false) {
  try {
    await creerSeance(modele, cycle, echauffement, allegee)
  } catch (e) {
    void informer(`${(e as Error).message}\n(version ${__VERSION__})`, 'Impossible de démarrer la séance')
  }
}

async function creerSeance(modele: SeanceModele | undefined, cycle: ContexteCycle | undefined, echauffement: string[], allegee: boolean) {
  debloquerSon()
  void seanceDuJourNatif(dateISO())
  const deload = !!(modele && (cycle?.deload || allegee))
  const poidsCorps = await dernierPoids()
  // Une seule séance en cours : un double appui sur « Démarrer » n'en crée pas une seconde, qui reviendrait plus tard.
  await db.transaction('rw', db.seances, async () => {
    if (await db.seances.filter((s) => s.enCours).first()) return
    await db.seances.add({
      ...(cycle && { cycleId: cycle.cycleId, semaine: cycle.semaine }),
      ...(deload && { deload: true }),
      ...(deload && !cycle?.deload && { allegeeSeule: true }),
      ...(echauffement.length && { echauffement: { ids: echauffement, faits: [] } }),
      id: uid(),
      date: dateISO(),
      modeleId: modele?.id,
      nom: modele?.nom ?? 'Séance libre',
      sousTitre: modele ? sousTitrePerso(modele) : 'exercices au choix',
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
  onAjouterExercices,
  onBilanCycle,
  onCorps,
  onChoisirProgramme,
  onObjectif,
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
  /** Séance sans exercice : ouvre son éditeur au lieu de la démarrer. */
  onAjouterExercices: (modeleId: string) => void
  onBilanCycle: () => void
  /** Ouvre l'onglet Corps, éventuellement sur une page (récap d'une phase). */
  onCorps: (page?: PageCorps) => void
  /** Sans programme : ouvre le choix du programme. */
  onChoisirProgramme: () => void
  /** Sans objectif : ouvre la question de l'objectif. */
  onObjectif: () => void
}) {
  const [choix, setChoix] = useState(false)
  const [voirDisque, setVoirDisque] = useState(false)
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
  // Dernière mesure et dernière photo ; null pendant le chargement, pour ne pas demander des repères déjà pris.
  const dernieresPrises = useLiveQuery(async () => ({ mesure: (await db.mesures.orderBy('date').last())?.date, photo: ((await db.photos.orderBy('date').uniqueKeys()) as string[]).at(-1) }), [], null)
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
  /** Début ou fin de phase : le choix entre photos et mensurations, ou la prise elle-même. */
  const [prise, setPrise] = useState<Repere | 'choix' | null>(null)
  useRetour(choix, () => setChoix(false))
  useRetour(prise === 'choix', () => setPrise(null))
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
  const reglages = useLiveQuery(() => db.reglages.toArray(), [], [])

  const { planning, actif } = catalogue
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
  const programmes = catalogue.sansProgramme ? [] : [actif, ...catalogue.programmes.filter((p) => p.id !== actif.id)]
  const dansUnProgramme = new Set(catalogue.programmes.flatMap((p) => p.seances.map((e) => e.modeleId)))
  const horsProgramme = catalogue.modeles.filter((m) => !dansUnProgramme.has(m.id))
  const groupeOuvert = ouvert ?? actif.id
  // Liste « Autre séance » : où on en est cette semaine, sans rien changer au planning.
  const premiereDuProgramme = terminees?.filter((s) => idPlanning(s.modeleId)).reduce<string | undefined>((a, s) => (!a || s.date < a ? s.date : a), undefined)
  const rates = creneauxRates(planning, coches, { jour, lundi: debutSemaine, premiere: premiereDuProgramme, pause: catalogue.cycle && etatCycle(catalogue.cycle).pause })
  const etatChoix = (duProgramme: boolean, m: SeanceModele): { rate?: number; faiteLe?: string } => {
    const faites = semaine.filter((s) => s.modeleId === m.id || catalogue.modele(s.modeleId)?.varianteDe === m.id).sort((a, b) => b.debut - a.debut)
    const leJour = faites[0] && (faites[0].date === dateISO() ? 'auj.' : `${JOURS_COURTS[jourSemaine(new Date(faites[0].date + 'T12:00:00'))]}.`)
    if (!duProgramme) return faites.length ? { faiteLe: leJour } : {}
    const creneaux = planning.flatMap((e, i) => (e.modele.id === m.id ? [{ jour: e.jour, i }] : []))
    if (!creneaux.length) return faites.length ? { faiteLe: leJour } : {}
    const rate = creneaux.find((c) => rates.has(c.i) && c.jour !== jour)
    // Une séance prévue aujourd'hui passe d'abord : elle n'a pas besoin d'être signalée comme ratée.
    if (rate && !creneaux.some((c) => c.jour === jour && !coches.has(c.i))) return { rate: rate.jour }
    return faites.length && creneaux.every((c) => coches.has(c.i)) ? { faiteLe: leJour } : {}
  }
  // Pas faites d'abord, puis ce qui reste à faire, puis ce qui est fait ; dans l'ordre de la semaine.
  const trierChoix = (l: SeanceModele[]) => {
    const rang = (m: SeanceModele) => {
      const e = etatChoix(true, m)
      return e.rate ? 0 : e.faiteLe !== undefined ? 2 : 1
    }
    const premierJour = (m: SeanceModele) => Math.min(8, ...planning.filter((e) => e.modele.id === m.id).map((e) => e.jour))
    return [...l].sort((a, b) => rang(a) - rang(b) || premierJour(a) - premierJour(b))
  }

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
  // Semaine allégée : la durée de la séance allégée, pas celle d'une séance complète.
  const dureeDe = (m: SeanceModele) => (etat?.deload && !etat.fini ? `≈ ${minutes(dureeEstimee({ ...m, exercices: m.exercices.map(planDeload) }))}` : dureeTexte(m, terminees))
  const contexte = cycle && contexteCycle(cycle)
  // On retient d'où la séance est lancée (accueil, ou « Voir ») pour y revenir si on l'annule.
  const lancer = (m?: SeanceModele, depuisApercu = false, allegee = false) => {
    try {
      localStorage.setItem('retourSeance', JSON.stringify(depuisApercu && m ? { apercu: m.id } : {}))
    } catch {
      /* stockage indisponible */
    }
    return demarrer(m && catalogue.pourDemarrer(m), contexte, m ? echauffementDe(m) : [], allegee)
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
  if (apercu) return <Apercu modele={apercu} catalogue={catalogue} deload={!!etat?.deload} onDemarrer={(allegee) => lancer(apercu, true, allegee)} onEchauffement={changerEchauffement} onAjouter={() => onAjouterExercices(apercu.id)} onFermer={() => voir(null)} />

  // Rappel des mensurations : seulement après 3 semaines sans en prendre.
  const joursMesure = derniereMesure ? Math.floor((Date.now() - Date.parse(derniereMesure.date + 'T12:00:00')) / 86400000) : null
  const mesuresEnRetard = nbSeances > 0 && (joursMesure === null || joursMesure > 21)

  // Fins de cycle et de phase, repères de départ : une fois vus ou masqués, ils ne reviennent plus (réglage `rappelsFaits`).
  const faits = (reglages.find((r) => r.cle === CLE_RAPPELS_FAITS)?.valeur as string[] | undefined) ?? []
  const fait = (cle: string) => faits.includes(cle)
  const marquer = (cle: string) => void setReglage(CLE_RAPPELS_FAITS, [...new Set([...faits, cle])])
  const seancesDuCycle = cycle && terminees ? terminees.filter((s) => s.cycleId === cycle.id).length : 0
  const arret = cycle && terminees ? arretCycle(cycle, terminees) : null
  const finDePhase = phaseFinie(catalogue.objectifs, dateISO())
  const reperesDebut = dernieresPrises ? reperesAPrendre(catalogue.objectifs, dateISO(), dernieresPrises) : null
  const reperes = reperesDebut && !fait(`reperes:${reperesDebut.debut}`) ? reperesDebut : null
  const reperesFin = dernieresPrises ? reperesDeFin(catalogue.objectifs, dateISO(), dernieresPrises) : null
  const finReperes = reperesFin && !fait(`fin-reperes:${reperesFin.debut}`) ? reperesFin : null
  const prendre = (manque: Repere[]) => setPrise(manque.length > 1 ? 'choix' : manque[0])

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

  const dateAffichee = (() => {
    const d = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })
    return d.charAt(0).toUpperCase() + d.slice(1)
  })()

  const texteCycle =
    cycle && etat
      ? etat.fini
        ? arret
          ? 'Programme arrêté'
          : 'Programme terminé'
        : etat.n <= 0
        ? `Programme · ${
            cycle.debut === dateISO(new Date(Date.now() + 86400000))
              ? 'Dès demain'
              : new Date(cycle.debut + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
          }`
        : etat.pause
        ? 'Semaine en pause'
        : etat.n === etat.total
        ? `${etat.deload ? 'Allégée' : 'Programme'} · dernière semaine`
        : etat.deload
        ? `Allégée · sem. ${etat.n}/${etat.total}`
        : `Programme · sem. ${etat.n}/${etat.total}`
      : ''
  const phaseDerniere = !!phase && !phase.aVenir && derniereSemainePhase(phase, dateISO())
  // L'objectif avec les mots du démarrage (« Prendre du muscle »), à côté du programme, sur une seule ligne (328 px à 360 de large,
  // mesuré : environ 7,2 px par lettre en gras, 6,4 sinon). Si tout ne tient pas : d'abord sans le compte des semaines (il est
  // dans Corps), sinon le mot de salle. Ce qui presse (« dernière semaine », « fin dépassée ») reste toujours écrit.
  const suitePhase = !phase
    ? ''
    : phaseDerniere
      ? ' · dernière semaine'
      : phase.aVenir
        ? ` (dès ${phase.debut === dateISO(new Date(Date.now() + 86400000)) ? 'demain' : new Date(phase.debut + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })})`
        : phase.depassee
          ? ' · fin dépassée'
          : ` · sem. ${phase.semaine}${phase.total ? `/${phase.total}` : ''}`
  const tient = (nom: string, suite: string) => nom.length * 7.2 + (suite.length + texteCycle.length) * 6.4 <= (texteCycle ? 296 : 308)
  const semainesSeules = !!phase && !phaseDerniere && !phase.aVenir && !phase.depassee
  const [nomObjectif, suiteAffichee] = !phase
    ? ['', '']
    : tient(nomVise(phase.phase), suitePhase)
      ? [nomVise(phase.phase), suitePhase]
      : semainesSeules && tient(nomVise(phase.phase), '')
        ? [nomVise(phase.phase), '']
        : [nomCourtPhase(phase.phase), suitePhase]
  const textePhase = nomObjectif + suiteAffichee

  // « dernière semaine » ressort : c'est le moment de penser à la suite.
  const avecFin = (texte: string) => {
    const i = texte.indexOf('dernière semaine')
    return i < 0 ? texte : (
      <>
        {texte.slice(0, i)}
        <span className="repere-fin">dernière semaine</span>
      </>
    )
  }

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
    cycle && etat?.fini && seancesDuCycle > 0 && !fait(`cycle:${cycle.id}`) && (
      <div key="cycle" className="rappel-ligne">
        <button type="button" className="texte" onClick={() => (marquer(`cycle:${cycle.id}`), onBilanCycle())}>
          <RefreshCw size={16} strokeWidth={2} className="rappel-ico ok" />
          <span className="rappel-texte">{arret ? 'Cycle arrêté' : 'Cycle terminé'} : voir le bilan</span>
        </button>
        <button type="button" className="fermer-rappel" aria-label="Ne plus afficher ce rappel" onClick={() => marquer(`cycle:${cycle.id}`)}>
          <X size={15} strokeWidth={2} />
        </button>
      </div>
    ),
    finDePhase && !fait(`phase:${finDePhase.debut}`) && (
      <div key="phase" className="rappel-ligne">
        <button type="button" className="texte" onClick={() => (marquer(`phase:${finDePhase.debut}`), onCorps(`recap:${finDePhase.debut}`))}>
          <Target size={16} strokeWidth={2} className="rappel-ico ok" />
          <span className="rappel-texte">Objectif terminé : voir le récap</span>
        </button>
        <button type="button" className="fermer-rappel" aria-label="Ne plus afficher ce rappel" onClick={() => marquer(`phase:${finDePhase.debut}`)}>
          <X size={15} strokeWidth={2} />
        </button>
      </div>
    ),
    deloadPlusTot && !masque('deload') && (
      <div key="deload" className="rappel-ligne">
        <button type="button" className="texte" onClick={onProgrammes}>
          <Info size={16} strokeWidth={2} className="rappel-ico info" />
          <span className="rappel-texte">
            Force en baisse sur {deloadPlusTot.baisses.length} exercices : semaine allégée conseillée ?
            <span className="faible"> · {deloadPlusTot.baisses.slice(0, 3).map((e) => e.nom).join(', ')}</span>
          </span>
        </button>
        <button type="button" className="fermer-rappel" aria-label="Masquer ce rappel une semaine" onClick={() => masquer('deload')}>
          <X size={15} strokeWidth={2} />
        </button>
      </div>
    ),
    finReperes && (
      <div key="fin-reperes" className="rappel-ligne">
        <button type="button" className="texte" onClick={() => prendre(finReperes.manque)}>
          <Ruler size={16} strokeWidth={2} className="rappel-ico info" />
          <span className="rappel-texte">{finReperes.dernierJour ? 'Dernier jour de ton objectif' : 'Ton objectif finit demain'} : {tesReperes(finReperes.manque)}</span>
        </button>
        <button type="button" className="fermer-rappel" aria-label="Ne plus afficher ce rappel pour cette fin d’objectif" onClick={() => (masquer('mesures'), marquer(`fin-reperes:${finReperes.debut}`))}>
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
    reperes ? (
      <div key="reperes" className="rappel-ligne">
        <button type="button" className="texte" onClick={() => prendre(reperes.manque)}>
          <Ruler size={16} strokeWidth={2} className="rappel-ico info" />
          <span className="rappel-texte">Nouvel objectif : {reperes.manque.length > 1 ? 'note ' : ''}{tesReperes(reperes.manque)}</span>
        </button>
        <button type="button" className="fermer-rappel" aria-label="Ne plus afficher ce rappel pour cet objectif" onClick={() => (masquer('mesures'), marquer(`reperes:${reperes.debut}`))}>
          <X size={15} strokeWidth={2} />
        </button>
      </div>
    ) : mesuresEnRetard && !masque('mesures') && !finReperes && (
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

  // 1re semaine : seuls les jours restants après avoir pris le programme comptent.
  const installeLe = (reglages.find((r) => r.cle === CLE_DEMARRAGE)?.valeur as EtatDemarrage | undefined)?.installeLe
  const enPause = !!etat?.pause && !etat.fini
  const prevusSemaine = enPause ? [] : installeLe && installeLe >= debutSemaine ? planning.filter((e) => e.jour >= jourSemaine(new Date(installeLe + 'T12:00:00'))) : planning
  // Toutes les séances de la semaine comptent, séances libres comprises : comme la page Programme et les semaines tenues.
  const nbFaites = faitesSurPrevues(semaine.length, prevusSemaine.length)
  // Semaines tenues (les trois quarts des séances prévues) : affichées à partir de 2, déloads et pauses ne cassent rien.
  const tenues = terminees ? semainesTenues(terminees, prevuDeSemaine((reglages.find((r) => r.cle === CLE_PREVUS)?.valeur as EtapePrevu[] | undefined) ?? [], cycles, terminees, planning.length), cycles, dateISO()) : 0
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

  /**
   * Les exercices de la séance, leur nom seul (13 nov. 2026, retour de l'utilisateur : l'accueil était trop chargé). La pastille
   * « À battre » sur ceux où tu as choisi de viser plus haut que la dernière fois : la même que dans « Voir ». Rien en semaine allégée.
   */
  const lignesDe = (m: SeanceModele, avecGains: boolean): LigneExo[] => {
    const aBattre = avecGains ? new Set(aBattreDe(m).map((x) => x.exo.id)) : undefined
    return m.exercices.map((p, i) => ({ id: `${p.exoId}-${i}`, nom: catalogue.exo(p.exoId).nom, aBattre: aBattre?.has(p.exoId) }))
  }
  // Le disque : seulement à partir du premier cran gagné.
  const disque = etatDisque(terminees ? totalCrans(terminees, catalogue.exo) : 0)
  // Retour après un trou : pas de reproche, on reprend où on en était.
  const joursSans = terminees ? joursSansSeance(terminees, dateISO()) : null

  const aLancer = proposee && duJour && proposee === duJour && !faite(duJour)
  const aChoisirAuj = faiteAuj && terminees ? conseilsAChoisir(faiteAuj, terminees, (id) => exoAvecReglages(catalogue.exo(id), reglages)) : 0

  /**
   * La séance qui vient, quand il n'y a rien à lancer aujourd'hui : une ligne et « Voir la séance », à la place de « Démarrer ».
   * Ni ses exercices ni sa durée (retour de l'utilisateur : la séance de vendredi prenait la moitié de l'écran mercredi soir).
   */
  const blocSuite = (e: EntreePlanning) => (
    <>
      <div className="seance-jour-ensuite">
        Ensuite, {e.jour === (jour % 7) + 1 ? 'demain' : NOMS_JOURS[e.jour!]} : <strong>{e.modele.nom}</strong>
      </div>
      <div className="seance-jour-actions">
        <button type="button" className="btn" onClick={() => (e.modele.exercices.length ? voir(e.modele) : onAjouterExercices(e.modele.id))}>
          {e.modele.exercices.length ? 'Voir la séance' : 'Ajouter des exercices'}
        </button>
      </div>
    </>
  )
  /** Séance faite aujourd'hui : chaque exercice, avec son gain face à la fois d'avant (« = » si pareil, rien si moins bien). */
  // Les records du jour (un record = un cran, la même mesure que l'écran « Séance faite ») : marqués dans la liste, comptés dans la ligne du haut.
  const recordsAuj = new Set(faiteAuj && terminees ? cransDeSeance(faiteAuj, terminees, catalogue.exo).map((c) => c.exo.id) : [])
  const lignesAuj: LigneExo[] = faiteAuj && terminees
    ? gainsDeSeance(faiteAuj, terminees, catalogue.exo).map((g) => ({ id: g.exoId, nom: catalogue.exo(g.exoId).nom, gain: recordsAuj.has(g.exoId) && (!g.gain || g.gain === '=') ? 'record' : g.gain, record: recordsAuj.has(g.exoId) }))
    : []

  return (
    <div className="accueil">
      <div className="entete accueil-entete">
        <h1>{dateAffichee}</h1>
        <button type="button" className="btn-reglages" onClick={onReglages} aria-label="Réglages">
          <SlidersHorizontal size={20} strokeWidth={1.75} />
        </button>
      </div>

      <div className="accueil-reperes">
        {phase ? (
          <button type="button" onClick={onObjectifs} aria-label={`Ton objectif : ${textePhase}`}>
            <span className={phase.aVenir ? 'repere-point a-venir' : 'repere-point'} />
            {phase.aVenir ? (
              textePhase
            ) : (
              <>
                <span className="repere-fort">{nomObjectif}</span>
                {avecFin(textePhase.slice(nomObjectif.length))}
              </>
            )}
          </button>
        ) : (
          // Toujours une porte vers l'objectif, même pour qui a répondu « pas d'objectif » : en gris, sans insister.
          !periodes(catalogue.objectifs).length &&
          (catalogue.sansObjectif ? (
            <button type="button" onClick={onObjectifs}>
              Sans objectif ›
            </button>
          ) : (
            <button type="button" onClick={onObjectif}>
              + Ton objectif
            </button>
          ))
        )}
        {cycle && etat && (
          <button type="button" onClick={onProgrammes} aria-label={`Ton programme : ${texteCycle}`}>
            {avecFin(texteCycle)}
          </button>
        )}
      </div>


      {rappels}

      <>
        <div className="accueil-tableau">
          <JournalMatin catalogue={catalogue} />
          {/* Une seule ligne : la semaine (vers le Journal) et le disque (depuis le premier cran). */}
          <div className="accueil-semaine-ligne">
            <button type="button" className="accueil-semaine" onClick={onJournal} aria-label="Cette semaine : ouvrir le Journal">
              {prevusSemaine.length > 0 && (
                <span className="semaine-points" aria-hidden="true">
                  {prevusSemaine.map((_, i) => (
                    <i key={i} className={i < nbFaites ? 'fait' : ''} />
                  ))}
                </span>
              )}
              <span className={tenues >= 2 ? 'semaine-texte tenue' : 'semaine-texte'}>
                {tenues >= 2 ? `${tenues}e semaine tenue` : prevusSemaine.length ? `${nbFaites} sur ${prevusSemaine.length} cette semaine` : `${semaine.length} faite${semaine.length > 1 ? 's' : ''} cette semaine`}
                {disque.total === 0 && ' ›'}
              </span>
            </button>
            {disque.total > 0 && (
              <button type="button" className="accueil-disque" onClick={() => setVoirDisque(true)} aria-label="Ton disque : voir tes crans">
                <Disque crans={disque.crans} taille={20} />
                {disque.crans > 0 ? `${disque.crans} cran${disque.crans > 1 ? 's' : ''}` : `${disque.pleins} disque${disque.pleins > 1 ? 's' : ''} plein${disque.pleins > 1 ? 's' : ''}`} ›
              </button>
            )}
          </div>
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
        <div className={etat?.pause ? 'seance-jour sans-action' : 'seance-jour'}>
          {cycle && etat?.pause && !etat.fini ? (
            <>
              <div className="seance-jour-haut">
                <span className="seance-jour-etat semaine-pause">Semaine en pause</span>
                <button type="button" className="seance-jour-lien" onClick={() => setChoix(true)}>
                  Faire une séance ›
                </button>
              </div>
              <p className="faible">
                Reprend le {new Date(lundiDe(cycle, etat.n) + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} : semaine {etat.n} sur {etat.total}.
              </p>
              <button type="button" className="btn plein" onClick={() => void db.cycles.put(reprendreSemaine(cycle, lundi()))}>
                Reprendre cette semaine
              </button>
            </>
          ) : catalogue.sansProgramme ? (
            <>
              <div className="seance-jour-haut">
                <span className="seance-jour-etat">Ton programme</span>
                <button type="button" className="seance-jour-lien" onClick={() => setChoix(true)}>
                  Faire une séance ›
                </button>
              </div>
              {faiteAuj && <div className="seance-jour-mieux">{faiteAuj.nom} faite aujourd’hui</div>}
              <div className="faible seance-jour-retour">Réponds à quelques questions et Cran t’en propose un. Tu peux aussi créer le tien.</div>
              <div className="seance-jour-espace" />
              <div className="seance-jour-actions">
                <button type="button" className="btn primaire" onClick={onChoisirProgramme}>
                  Choisis ton programme
                </button>
              </div>
            </>
          ) : aLancer ? (
            <>
              {/* Le nom de la séance et « Autre séance » sur une ligne ; plus d'étiquette « Séance du jour » (13 nov. 2026). */}
              {etat?.deload && <span className="seance-jour-etiquette deload">Semaine allégée · charges −10 %</span>}
              <div className="seance-jour-titre seance-jour-titre-ligne">
                <h2>{proposee.modele.nom}</h2>
                <button type="button" className="seance-jour-lien" onClick={() => setChoix(true)}>
                  Autre séance ›
                </button>
              </div>
              {variante && (
                <button type="button" className="seance-jour-lien pas-de-salle" onClick={() => voir(variante)}>
                  Pas de salle ›
                </button>
              )}
              {joursSans !== null && joursSans >= 10 && <div className="faible seance-jour-retour">Première séance depuis {joursSans} jours : mêmes charges que la dernière fois, baisse un peu si c’est trop dur.</div>}
              {proposee.modele.exercices.length ? (
                <>
                  <ListeExosJour lignes={lignesDe(proposee.modele, !etat?.deload)} />
                  <div className="seance-jour-duree-bas">{dureeDe(proposee.modele)}</div>
                  <div className="seance-jour-actions">
                    <button type="button" className="btn primaire" onClick={() => lancer(proposee.modele)}>
                      Démarrer
                    </button>
                    <button type="button" className="btn" onClick={() => voir(proposee.modele)}>
                      Voir
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="faible seance-jour-retour">Cette séance n’a pas encore d’exercice.</div>
                  <div className="seance-jour-espace" />
                  <div className="seance-jour-actions">
                    <button type="button" className="btn primaire" onClick={() => onAjouterExercices(proposee.modele.id)}>
                      Ajouter des exercices
                    </button>
                  </div>
                </>
              )}
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
              {/* Ce que tu viens de faire, pas la séance suivante : la durée, puis chaque exercice avec son gain. Un appui ouvre la séance. */}
              {faiteAuj ? (
                <>
                  <button type="button" className="seance-jour-stats" onClick={() => onVoirSeance(faiteAuj.id)}>
                    {/* Ce que tu as fait, sans fête : le grand « Record battu » est sur l'écran « Séance faite », pas sur celui qu'on revoit toute la soirée. */}
                    {[duree(dureeSeanceEffective(faiteAuj)), `${faiteAuj.series.filter(estDure).length} séries dures`].join(' · ')}
                    {recordsAuj.size > 0 && (
                      <>
                        {' · '}
                        <strong>
                          {recordsAuj.size} record{recordsAuj.size > 1 ? 's' : ''}
                        </strong>
                      </>
                    )}{' '}
                    ›
                  </button>
                  <ListeExosJour lignes={lignesAuj} fait onClick={() => onVoirSeance(faiteAuj.id)} />
                  {aChoisirAuj > 0 && (
                    <button type="button" className="seance-jour-stats seance-jour-choisir" onClick={() => onVoirSeance(faiteAuj.id)}>
                      Prochaine fois : {aChoisirAuj} conseil{aChoisirAuj > 1 ? 's' : ''} à choisir ›
                    </button>
                  )}
                </>
              ) : (
                <div className="seance-jour-espace" />
              )}
              {prochaine && prochaine !== duJour && blocSuite(prochaine)}
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
              <div className="seance-jour-espace" />
              {blocSuite(proposee)}
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

      {voirDisque && terminees && <FenetreDisque seances={terminees} exo={catalogue.exo} onFermer={() => setVoirDisque(false)} />}
      {choix && (
        <div className="modal-fond" onClick={() => setChoix(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="ligne entre choix-seance-titre">
              <h2>Choisir une séance</h2>
              <button type="button" className="btn-fermer" onClick={() => setChoix(false)} aria-label="Fermer">
                <X size={22} />
              </button>
            </div>

            {(() => {
              const groupes = [
                ...programmes.map((p) => ({ id: p.id, nom: p.nom, actif: p.id === actif.id, prog: p, seances: seancesDe(p) })),
                ...(horsProgramme.length ? [{ id: 'hors', nom: 'Hors programme', actif: false, prog: null, seances: horsProgramme }] : []),
              ]
              // Un seul programme : rien à replier, ses séances sont tout de suite là.
              const plusieurs = groupes.length > 1
              return groupes.map((g) => {
                const ouvert = !plusieurs || groupeOuvert === g.id
                const tete = (
                  <>
                    <span className="choix-groupe-nom">
                      <strong>{g.nom}</strong>
                      {g.actif && plusieurs && <span className="faible"> · en cours</span>}
                    </span>
                    <span className="faible">{g.seances.length} séance{g.seances.length > 1 ? 's' : ''}</span>
                  </>
                )
                return (
                  <section key={g.id} className="choix-groupe">
                    {plusieurs ? (
                      <button type="button" className="choix-groupe-tete" onClick={() => setOuvert(ouvert ? '' : g.id)} aria-expanded={ouvert}>
                        {tete}
                        <ChevronRight size={18} className={'muted depliable-chevron' + (ouvert ? ' ouvert' : '')} />
                      </button>
                    ) : (
                      <div className="choix-groupe-tete">{tete}</div>
                    )}
                    <Deplie ouvert={ouvert}>
                      <div className="choix-seances">
                        {g.seances.length === 0 ? (
                          <div className="faible">Aucune séance dans ce programme.</div>
                        ) : (
                          (g.actif ? trierChoix(g.seances) : g.seances).map((m) => {
                            const jours = g.prog ? g.prog.seances.filter((e) => e.modeleId === m.id && e.jour).map((e) => e.jour!) : []
                            const etat = etatChoix(g.actif, m)
                            // « auj. » seulement s'il reste à faire aujourd'hui, ou si rien d'autre n'est à dire.
                            const duJour = jours.includes(jour) && !etat.rate
                            const joursAffiches = etat.rate ? [etat.rate] : jours
                            return (
                              <button key={m.id} type="button" className={'choix-seance' + (duJour ? ' du-jour' : '')} onClick={() => voir(m)}>
                                <span className="choix-seance-jour">{duJour ? 'auj.' : joursAffiches.map((j) => JOURS_COURTS[j]).join(' ')}</span>
                                <span className="choix-seance-corps">
                                  <span className="choix-seance-nom">{m.nom}</span>
                                  {sousTitreSeance(m, (id) => catalogue.exo(id).nom) && <span className="faible choix-seance-sous">{sousTitreSeance(m, (id) => catalogue.exo(id).nom)}</span>}
                                  <span className="faible choix-seance-sous">{dureeDe(m)}</span>
                                </span>
                                {etat.rate ? (
                                  <span className="choix-seance-ratee">Pas faite</span>
                                ) : etat.faiteLe !== undefined ? (
                                  <span className="choix-seance-faite">
                                    <Check size={16} /> Faite{duJour && etat.faiteLe === 'auj.' ? '' : ` ${etat.faiteLe}`}
                                  </span>
                                ) : null}
                                <ChevronRight size={20} className="muted" />
                              </button>
                            )
                          })
                        )}
                      </div>
                    </Deplie>
                  </section>
                )
              })
            })()}

            <button type="button" className="choix-seance" onClick={() => lancer()}>
              <span className="choix-seance-jour">
                <Zap size={18} />
              </span>
              <span className="choix-seance-corps">
                <span className="choix-seance-nom">Séance libre</span>
                <span className="faible choix-seance-sous">Tu ajoutes les exercices au fur et à mesure</span>
              </span>
              <ChevronRight size={20} className="muted" />
            </button>

            <button className="btn discret plein" style={{ marginTop: 10 }} onClick={() => setChoix(false)}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {prise === 'choix' && (
        <div className="modal-fond" onClick={() => setPrise(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="ligne entre choix-seance-titre">
              <h2>{finReperes ? 'Fin de ton objectif' : 'Début de ton objectif'}</h2>
              <button type="button" className="btn-fermer" onClick={() => setPrise(null)} aria-label="Fermer">
                <X size={22} />
              </button>
            </div>
            <div className="reperes-choix">
              <button type="button" className="btn plein" onClick={() => setPrise('photos')}>
                <span>Prendre les photos</span>
                <span className="faible petit-texte">{ilYA(dernieresPrises?.photo)}</span>
              </button>
              <button type="button" className="btn plein" onClick={() => setPrise('mensurations')}>
                <span>Noter les mensurations</span>
                <span className="faible petit-texte">{ilYA(dernieresPrises?.mesure)}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {(prise === 'photos' || prise === 'mensurations') && <PriseCorps prise={prise} onFermer={() => setPrise(null)} />}


    </div>
  )
}
