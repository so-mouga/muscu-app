import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronRight, Share } from 'lucide-react'
import type { Catalogue } from '../catalogue'
import Aide from '../components/Aide'
import { PisteCap, useCaps } from '../components/Caps'
import Disque from '../components/Disque'
import FenetreDisque from '../components/FenetreDisque'
import ChoixDates from '../components/ChoixDates'
import PartageBilan from '../components/PartageBilan'
import { NiveauJauge } from '../components/VolumeMuscles'
import { db } from '../db'
import { phaseA } from '../lib/objectifs'
import { arretCycle, BONUS_PRIORITE, cycleDuBilan, etatCycle, finArret, finReelle, lundiDe, nomCycle } from '../lib/cycle'
import BoutonRetour from '../components/BoutonRetour'
import { VueCycle } from '../components/Cycle'
import { transition, useRetour } from '../lib/nav'
import { MUSCLES } from '../data/exercices'
import { analyser, analyserDates, aRetenir, ceQuiMonte, erreurDates, essentiel, phraseBilan, semaineOuverte, semainesFinies, type LigneExercice } from '../lib/analyse'
import { capsEnCours, dureeCap, etatCap, texteCap, texteReste } from '../lib/caps'
import { DEBUT_CRANS, etatDisque, totalCrans } from '../lib/crans'
import { gain } from '../lib/constat'
import { genererBilan, type DonneesBilan } from '../lib/bilan'
import type { ContenuImage } from '../lib/imageBilan'
import { chargeQte, dateCourte, dateISO, kg, milliers } from '../lib/calc'
import { depuisDebut, exercicesDuBloc, semainesTenues, suiviCycle, tenuesSurPeriode, type LigneBloc } from '../lib/motivation'
import { CLE_PREVUS, prevuDeSemaine, type EtapePrevu } from '../lib/prevu'
import { etatVolume, LIBELLE_VOLUME, zone } from '../lib/volume'
import type { Cycle, Muscle, Seance } from '../types'

type Periode = '4' | '12' | 'cycle' | 'dates'
/** Dates au choix : la semaine en cours peut y entrer, puisqu'on la demande. */
interface Dates {
  du: string
  au: string
}

const JOUR = 86400000
const decaler = (iso: string, jours: number) => dateISO(new Date(Date.parse(iso + 'T12:00:00') + jours * JOUR))
const arrondi = (x: number) => Math.round(x * 10) / 10
const jour = (iso: string) => dateCourte(iso).replace(/^\S+ /, '')
const ecart = (d: number, u: string) => `${d > 0 ? '+' : d < 0 ? '−' : '±'}${kg(Math.abs(arrondi(d)))} ${u}`

const CLE_DATES = 'bilanDates'
const datesRetenues = (): Dates | null => {
  try {
    return JSON.parse(localStorage.getItem(CLE_DATES) ?? 'null') as Dates | null
  } catch {
    return null
  }
}

/** Ce qu'on retrouve au retour d'une fiche d'exercice : le Bilan est démonté pendant qu'elle est ouverte. */
const memoire = { periode: '4' as Periode, defilement: 0, cycleId: undefined as string | undefined, sous: null as SousVue | null, dates: datesRetenues() }
/** Détail du cycle affiché : ses exercices, ou ses séances. */
type SousVue = 'exercices' | 'seances'

/** « Voir le bilan » d'un cycle : le Bilan s'ouvrira sur sa période. */
export const voirPeriodeCycle = () => {
  memoire.periode = 'cycle'
  memoire.defilement = 0
  memoire.cycleId = undefined
}

/**
 * Bilan des semaines finies : la réponse d'abord (À retenir), puis les exercices, la régularité, les
 * muscles et la forme. La semaine en cours n'y entre pas (l'accueil s'en occupe, et un lundi ne juge rien), sauf le dimanche : on fait son point avant la nouvelle.
 */
export default function Bilan({ catalogue, haut, onExo, onTousExos, onCorps, onProgramme, onSeance }: { catalogue: Catalogue; haut: ReactNode; onExo?: (id: string) => void; onTousExos?: () => void; onCorps?: () => void; onProgramme?: () => void; /** Ouvre le détail d'une séance : le retour revient ici. */ onSeance: (id: string) => void }) {
  const [periodeChoisie, setPeriodeChoisie] = useState(memoire.periode)
  const [cycleChoisi, setCycleChoisi] = useState(memoire.cycleId)
  const [choixCycle, setChoixCycle] = useState(false)
  const [dates, setDates] = useState(memoire.dates)
  // Ce qui est dans les champs : le bilan ne suit que des dates correctes.
  const [saisieDates, setSaisieDates] = useState<Dates>(() => memoire.dates ?? { du: '', au: dateISO() })
  const [partage, setPartage] = useState(false)
  const [voirDisque, setVoirDisque] = useState(false)
  const [sous, setSous] = useState<SousVue | null>(() => {
    const s = memoire.sous
    memoire.sous = null
    return s
  })
  const defilementAvantSous = useRef(0)
  const ouvrirSous = (s: SousVue) => {
    defilementAvantSous.current = window.scrollY
    transition(() => setSous(s), 'avant')
    window.scrollTo({ top: 0 })
  }
  const fermerSous = () => {
    transition(() => setSous(null), 'arriere')
    requestAnimationFrame(() => window.scrollTo({ top: defilementAvantSous.current }))
  }
  useRetour(choixCycle, () => setChoixCycle(false))
  // La page du cycle a son propre retour.
  useRetour(sous === 'exercices', fermerSous)
  const seances = useLiveQuery(() => db.seances.filter((s) => !s.enCours).toArray(), [])
  const pesees = useLiveQuery(() => db.pesees.toArray(), [], [])
  const mesures = useLiveQuery(() => db.mesures.toArray(), [], [])
  const journal = useLiveQuery(() => db.journal.toArray(), [], [])
  const cycles = useLiveQuery(() => db.cycles.toArray(), [], [])
  const prevusNotes = useLiveQuery(() => db.reglages.get(CLE_PREVUS), [])
  const caps = useCaps() ?? []
  const donneesPretes = !!seances

  useEffect(() => {
    if (!donneesPretes || !memoire.defilement) return
    const y = memoire.defilement
    memoire.defilement = 0
    requestAnimationFrame(() => window.scrollTo({ top: y }))
  }, [donneesPretes])

  if (!seances) return sous ? null : <div>{haut}</div>

  const ouvrirCorps = () => {
    memoire.defilement = window.scrollY
    onCorps?.()
  }
  const ouvrirExo = onExo
    ? (id: string) => {
        memoire.defilement = window.scrollY
        onExo(id)
      }
    : undefined

  // Le dimanche, la semaine qui s'achève compte déjà : on fait son point avant la nouvelle.
  const cetteSemaine = semaineOuverte()
  // Le cycle en cours, sinon le dernier terminé, y compris quand un nouveau vient d'être lancé : son bilan reste consultable.
  const cycleParDefaut = cycleDuBilan(cycles, cetteSemaine)
  const cycle = cycles.find((c) => c.id === cycleChoisi && c.debut < cetteSemaine) ?? cycleParDefaut
  const seancesDe = (id: string) => seances.filter((s) => s.cycleId === id)
  // Tous les cycles qui ont eu des séances, du plus récent au plus ancien.
  const cyclesPasses = [...cycles].filter((c) => c.debut < cetteSemaine && seancesDe(c.id).length).sort((a, b) => b.debut.localeCompare(a.debut))
  const arret = cycle ? arretCycle(cycle, seances) : null
  const cycleDispo = !!cycle && cycle.debut < cetteSemaine
  const erreurSaisie = saisieDates.du ? erreurDates(saisieDates.du, saisieDates.au, dateISO()) : 'à choisir'
  // Rien à montrer sur la période choisie : la page le dit, le bouton reste sélectionné, et les calculs portent sur 4 semaines.
  const sansCycle = periodeChoisie === 'cycle' && !cycleDispo
  const sansDates = periodeChoisie === 'dates' && (!dates || !!erreurSaisie)
  const periode: Periode = sansCycle || sansDates ? '4' : periodeChoisie
  const surDates = periode === 'dates' && !!dates
  const finSemaines = decaler(cetteSemaine, -1)
  const finPrevueCycle = cycle?.fin ?? (cycle ? decaler(lundiDe(cycle, cycle.semaines), 6) : finSemaines)
  // Arrêté en route : on le juge sur les semaines qu'il a vraiment duré.
  const finCycle = (cycle && finArret(cycle, seances)) || finPrevueCycle
  const fin = surDates ? dates.au : periode === 'cycle' && finCycle < finSemaines ? finCycle : finSemaines
  const debut = surDates ? dates.du : periode === 'cycle' && cycle ? cycle.debut : decaler(cetteSemaine, periode === '12' ? -91 : -28)

  // Le texte partagé parle du cycle de la période : un cycle choisi avant n'a rien à y faire, ni un cycle commencé après.
  const cycleTexte = periode === 'cycle' ? cycle : cycleParDefaut && cycleParDefaut.debut <= fin ? cycleParDefaut : undefined
  // Objectifs de volume en vigueur à la fin de la période (ils peuvent avoir changé depuis).
  const cibles = catalogue.ciblesA(fin)
  const donnees: DonneesBilan = { seances, cycles, pesees, mesures, exo: catalogue.exo, exercices: catalogue.exercices, cibles, programme: catalogue.actif.nom, objectifs: catalogue.objectifs, journal, caps, cycle: cycleTexte && `Cycle « ${nomCycle(cycleTexte)} » (${cycleTexte.programme.nom}), ${etatCycle(cycleTexte).fini ? 'terminé' : `semaine ${Math.max(1, etatCycle(cycleTexte).n)}/${cycleTexte.semaines}`}${cycleTexte.priorites?.length ? `, priorité : ${cycleTexte.priorites.map((m) => MUSCLES.find((x) => x.id === m)!.nom.toLowerCase()).join(', ')} (+${BONUS_PRIORITE} séries par semaine)` : ''}` }
  const etapesPrevues = (prevusNotes?.valeur as EtapePrevu[] | undefined) ?? []
  const prevues = prevuDeSemaine(etapesPrevues, cycles, seances, catalogue.planning.length)
  const phaseEnCours = phaseA(catalogue.objectifs, fin)
  const phaseFin = phaseEnCours?.phase
  const surChoix = surDates ? analyserDates(donnees, debut, fin, prevues, phaseFin) : null
  const a = surChoix?.analyse ?? analyser(donnees, debut, fin, prevues, phaseFin)
  // La phase a commencé pendant la période : on ne la juge que depuis son début.
  const depuisPhase = phaseEnCours && phaseEnCours.debut > debut ? analyser(donnees, phaseEnCours.debut, fin, prevues, phaseFin) : undefined
  const longueur = Math.round((Date.parse(fin) - Date.parse(a.debut)) / JOUR)
  const finAvant = decaler(a.debut, -1)
  const avant = analyser(donnees, decaler(finAvant, -longueur), finAvant, prevues, phaseA(catalogue.objectifs, finAvant)?.phase)
  const surCycle = periode === 'cycle' && !!cycle
  const lignes = essentiel(a, avant.seances > 0 ? avant : null, phaseFin, depuisPhase, surCycle && !!arret)
  // Sur un cycle : ce qui monte se lit en charges, de la 1re séance à la dernière.
  const parCharges = surCycle ? depuisDebut(seances.filter((s) => s.date <= fin), catalogue.exo, cycle.debut, 8) : []
  const seancesCycle = surCycle ? seancesDe(cycle.id).filter((s) => !s.enCours) : []
  const blocCycle = surCycle ? exercicesDuBloc(seancesCycle.filter((s) => s.date <= fin), catalogue.exo) : null
  const nbExosCycle = blocCycle ? Object.values(blocCycle).reduce((n, l) => n + l.length, 0) : 0
  // Le dimanche, la semaine qui s'achève compte déjà, comme dans l'image partagée.
  const tenuesCycle = surCycle ? suiviCycle(cycle, seances, cetteSemaine, etapesPrevues).tenues : 0

  if (sous === 'seances' && cycle)
    return (
      <VueCycle
        catalogue={catalogue}
        cycle={cycle}
        onFermer={fermerSous}
        onSeance={(id) => {
          memoire.sous = 'seances'
          memoire.cycleId = cycle.id
          onSeance(id)
        }}
      />
    )
  if (sous === 'exercices' && blocCycle)
    return (
      <div>
        <div className="entete">
          <BoutonRetour onClick={fermerSous} label="Retour au Bilan" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2>Exercices du cycle</h2>
            <div className="faible">De la 1re séance à la dernière</div>
          </div>
        </div>
        <section className="carte bilan-carte">
          {(
            [
              ['Ça monte', blocCycle.monte],
              ['Stable', blocCycle.stable],
              ['Un peu en dessous', blocCycle.baisse],
              ['Fait une seule fois', blocCycle.uneFois],
            ] as [string, LigneBloc[]][]
          ).map(
            ([titre, liste]) =>
              liste.length > 0 && (
                <div key={titre}>
                  <div className="bilan-intertitre">{titre}</div>
                  {liste.map((l) => {
                    const avant = chargeQte(l.exo, l.avant.charge, l.avant.reps)
                    const apres = chargeQte(l.exo, l.apres.charge, l.apres.reps)
                    return (
                      <LigneExo
                        key={l.exo.id}
                        id={l.exo.id}
                        nom={l.exo.nom}
                        detail={avant === apres ? apres : `${avant} → ${apres}`}
                        onClick={
                          onExo &&
                          (() => {
                            memoire.sous = 'exercices'
                            memoire.cycleId = cycle?.id
                            onExo(l.exo.id)
                          })
                        }
                      />
                    )
                  })}
                </div>
              )
          )}
        </section>
      </div>
    )
  const exercices = ceQuiMonte(a, parCharges.map((p) => ({ id: p.exo.id, nom: p.exo.nom, detail: `${chargeQte(p.exo, p.avant.charge, p.avant.reps)} → ${chargeQte(p.exo, p.apres.charge, p.apres.reps)}`, valeur: gain(p.exo, [p.avant], [p.apres])?.court })))

  const texteComplet = (question = '') => genererBilan(donnees, a.debut, fin, aRetenir(a, avant.seances > 0 ? avant : null, cibles, false, phaseFin, depuisPhase), !!surChoix?.coupees, question)
  const debutEcrit = surDates ? debut : a.debut
  const contenuImage: ContenuImage = {
    periode: `${jour(debutEcrit)} → ${jour(fin)}`,
    titre: surCycle ? nomCycle(cycle) : undefined,
    seances: a.seances,
    // Sur un cycle, le même compte que « Régularité » et que sa page ; un cycle arrêté ne compte que ce qu'il a duré.
    tenues: surCycle ? tenuesDuCycle(cycle, seances, fin, cetteSemaine, etapesPrevues) : tenuesSurPeriode(seances, prevues, cycles, debut, fin),
    montent: exercices.montent.length,
    lignes: exercices.montent.slice(0, 3),
  }

  const choisirPeriode = (p: Periode) => {
    memoire.periode = p
    setPeriodeChoisie(p)
  }
  const choisirCycle = (id: string) => {
    memoire.cycleId = id
    setCycleChoisi(id)
    choisirPeriode('cycle')
    setChoixCycle(false)
    window.scrollTo({ top: 0 })
  }
  // « Cycles » affiche le cycle tout de suite : le dernier, ou celui choisi avant. La liste reste derrière « Changer ».
  const ouvrirCycles = () => {
    const c = cyclesPasses.find((x) => x.id === cycleChoisi) ?? cyclesPasses[0]
    if (c) choisirCycle(c.id)
    else choisirPeriode('cycle')
  }
  const changerDates = (du: string, au: string) => {
    const d = { du, au }
    setSaisieDates(d)
    if (!du || erreurDates(du, au, dateISO())) return
    memoire.dates = d
    try {
      localStorage.setItem(CLE_DATES, JSON.stringify(d))
    } catch {
      /* gardées seulement jusqu'à la fermeture de l'appli */
    }
    setDates(d)
  }

  // Aucune semaine finie avec une séance : le bilan n'a encore rien à dire. Sinon, les périodes restent là, même vides.
  if (!seances.some((s) => s.date <= finSemaines))
    return (
      <div>
        {haut}
        <div className="carte bilan-carte">
          <h3>Ton bilan arrive après ta première semaine</h3>
          <p className="faible petit-texte">Tu verras ici ce qui monte, ce qui bloque, ta régularité et les muscles à renforcer.</p>
        </div>
      </div>
    )

  const choixPeriode = (
    <>
      <div className="bilan-periodes">
        {(
          [
            ['4', '4 sem.', () => choisirPeriode('4')],
            ['12', '3 mois', () => choisirPeriode('12')],
            ['cycle', 'Cycles', ouvrirCycles],
            ['dates', 'Dates', () => choisirPeriode('dates')],
          ] as [Periode, string, () => void][]
        ).map(([id, nom, choisir]) => (
          <button key={id} type="button" className={periodeChoisie === id ? 'actif' : ''} aria-pressed={periodeChoisie === id} onClick={choisir}>
            {nom}
          </button>
        ))}
      </div>
      {periodeChoisie === 'dates' ? (
        <ChoixDates du={saisieDates.du} au={saisieDates.au} erreur={erreurSaisie} dates={seances.map((s) => s.date)} onChange={changerDates} />
      ) : sansCycle ? null : surCycle && cyclesPasses.length >= 2 ? (
        <button type="button" className="liste-btn bilan-choix-cycle" aria-label="Choisir un autre cycle" onClick={() => setChoixCycle(true)}>
          <span>
            {nomCycle(cycle)}
            <span className="faible prog-sous">
              {arret ? `Arrêté après ${arret} semaine${arret > 1 ? 's' : ''} · ` : ''}
              {jour(a.debut)} → {jour(fin)}
            </span>
          </span>
          <span className="faible petit-texte bilan-changer">Changer ›</span>
        </button>
      ) : (
        <p className="faible bilan-periode">
          {surCycle && `${nomCycle(cycle)} · `}
          {surCycle && arret ? `arrêté après ${arret} semaine${arret > 1 ? 's' : ''}, du ` : surCycle ? 'du ' : 'Du '}
          {jour(a.debut)} au {jour(fin)}
        </p>
      )}
      {choixCycle && (
        <div className="modal-fond" onClick={() => setChoixCycle(false)}>
          <div className="modal modal-colonne" onClick={(e) => e.stopPropagation()}>
            <h2>Choisir un cycle</h2>
            <div className="modal-defile pile">
              {cyclesPasses.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="liste-btn"
                  aria-pressed={surCycle && c.id === cycle?.id}
                  onClick={() => choisirCycle(c.id)}
                >
                  <span>
                    {nomCycle(c)}
                    <span className="faible prog-sous">
                      {etatCycle(c).fini ? `${jour(c.debut)} → ${jour(finArret(c, seances) ?? finReelle(c))}${c.debut.slice(0, 4) !== cetteSemaine.slice(0, 4) ? ` ${c.debut.slice(0, 4)}` : ''}` : `Depuis le ${jour(c.debut)}`} · {seancesDe(c.id).length} séance{seancesDe(c.id).length > 1 ? 's' : ''}
                    </span>
                  </span>
                  {surCycle && c.id === cycle?.id && <Check size={20} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )

  if (sansDates)
    return (
      <div>
        {haut}
        {choixPeriode}
        <div className="carte bilan-carte">
          <h3>{saisieDates.du ? 'Dates à corriger' : 'Choisis la date de début'}</h3>
          <p className="faible petit-texte">{saisieDates.du ? erreurSaisie : 'Au moins 7 jours. Le bilan s’affiche ici dès que les dates sont bonnes : pas de bouton à toucher.'}</p>
        </div>
      </div>
    )

  if (sansCycle) {
    const prochain = [...cycles].filter((c) => c.debut >= cetteSemaine).sort((x, y) => x.debut.localeCompare(y.debut))[0]
    return (
      <div>
        {haut}
        {choixPeriode}
        <div className="carte bilan-carte">
          <h3>{prochain ? 'Pas encore de cycle à lire' : 'Pas encore de cycle'}</h3>
          <p className="faible petit-texte">
            {!prochain
              ? 'Lance un cycle depuis la page Programme : son bilan s’affichera ici.'
              : prochain.debut === cetteSemaine
                ? `Ton cycle a commencé lundi ${jour(prochain.debut).replace(/\.$/, '')}. Son bilan s’affiche ici dès dimanche, à la fin de sa première semaine.`
                : `Ton cycle commence lundi ${jour(prochain.debut).replace(/\.$/, '')}. Son bilan s’affichera ici à la fin de sa première semaine.`}
          </p>
          {onProgramme && (
            <button type="button" className="btn plein" onClick={onProgramme}>
              Voir mon programme
            </button>
          )}
        </div>
      </div>
    )
  }

  if (!a.seances)
    return (
      <div>
        {haut}
        {choixPeriode}
        <div className="carte bilan-carte">
          <h3>Pas de séance sur cette période</h3>
          <p className="faible petit-texte">Tes séances d’avant restent là : choisis une autre période, ou retrouve-les dans le Journal.</p>
        </div>
      </div>
    )

  const tenues = semainesTenues(seances, prevues, cycles, dateISO())
  const muscles = MUSCLES.filter((m) => zone(m.id, cibles[m.id]))
  const horsZone = muscles
    .filter((m) => etatVolume(m.id, a.volume[m.id], cibles[m.id]) !== 'optimal')
    .sort((x, y) => a.volume[x.id] / cibles[x.id] - a.volume[y.id] / cibles[y.id])
  const dansZone = muscles.filter((m) => etatVolume(m.id, a.volume[m.id], cibles[m.id]) === 'optimal')
  const sansConseil = MUSCLES.filter((m) => m.cible > 0 && cibles[m.id] <= 0 && a.volume[m.id] > 0)
  const notesCalories = a.calories.ok + a.calories.trop + a.calories.pasAssez
  // Le disque et les caps disent où tu en es aujourd'hui : seulement sur une période qui va jusqu'à la dernière semaine finie.
  const actuelle = fin >= finSemaines
  const disque = etatDisque(totalCrans(seances, catalogue.exo))
  const capsAffiches = actuelle
    ? capsEnCours(caps, seances)
        .map((c) => ({ c, exo: catalogue.exo(c.exoId), etat: etatCap(c, seances) }))
        .filter((x) => !x.exo.supprime)
    : []
  // Un cap franchi pendant la période passe avant tout : le plus récent.
  const capFranchi = caps
    .map((c) => ({ c, f: etatCap(c, seances).franchi }))
    .filter((x) => x.f && x.f.date >= a.debut && x.f.date <= fin)
    .sort((x, y) => y.f!.date.localeCompare(x.f!.date))[0]
  // Un record = un cran : comptés depuis le même jour que les crans (avant, des séances d'essai).
  const phrase = phraseBilan(
    { ...a, records: a.records.filter((r) => r.date >= DEBUT_CRANS) },
    exercices.montent.length,
    phaseFin,
    capFranchi && { charge: texteCap(catalogue.exo(capFranchi.c.exoId), capFranchi.c, capFranchi.c.cible), exo: catalogue.exo(capFranchi.c.exoId).nom, duree: dureeCap(capFranchi.c.depuis, capFranchi.f!.date) }
  )

  return (
    <div>
      {haut}
      {choixPeriode}

      {/* En tête : une phrase avec les chiffres de la période, la régularité, le disque, et Partager (c'est ce qu'on vient faire le dimanche). */}
      <section className="bilan-tete">
        <div className="bilan-tete-haut">
          <h2 className="voix">{phrase.texte}</h2>
          <button type="button" className="bilan-partage" aria-label="Partager ce bilan" onClick={() => setPartage(true)}>
            <Share size={20} strokeWidth={1.75} />
          </button>
        </div>
        {phrase.sous && <div className="faible petit-texte">{phrase.sous}</div>}
        <p className="petit-texte">
          <strong>{a.prevues ? `${a.faites} séance${a.faites > 1 ? 's' : ''} sur ${a.prevues}` : `${a.seances} séance${a.seances > 1 ? 's' : ''}`}</strong>
          {a.enPlus > 0 && <span className="faible"> (+{a.enPlus} en plus)</span>}
          {surDates ? null : surCycle ? tenuesCycle >= 2 && <span className="tenue"> · {tenuesCycle} semaines tenues</span> : tenues >= 2 && <span className="tenue"> · {tenues}e semaine tenue</span>}
        </p>
        {surChoix?.coupees && surChoix.entieres > 0 && (
          <p className="faible petit-texte">
            Comptée sur {surChoix.entieres > 1 ? `les ${surChoix.entieres} semaines entières` : 'la semaine entière'} de ces dates : les semaines coupées n’entrent pas ici.
          </p>
        )}
        {actuelle && disque.total > 0 && (
          <button type="button" className="accueil-disque bilan-disque" onClick={() => setVoirDisque(true)} aria-label="Ton disque : voir tes crans">
            <Disque crans={disque.crans} taille={20} />
            <span>
              {disque.crans > 0 ? (
                <>
                  <strong>
                    {disque.crans} cran{disque.crans > 1 ? 's' : ''} sur 12
                  </strong>{' '}
                  · plus que {disque.reste}
                </>
              ) : (
                <strong>
                  {disque.pleins} disque{disque.pleins > 1 ? 's' : ''} plein{disque.pleins > 1 ? 's' : ''}
                </strong>
              )}{' '}
              ›
            </span>
          </button>
        )}
      </section>

      {lignes.length > 0 && (
        <section className="carte bilan-carte">
          <h3>À retenir</h3>
          {lignes.map((l) =>
            l.exoId || l.blocages ? (
              <button key={l.texte} type="button" className="bilan-retenir" onClick={() => (l.exoId ? ouvrirExo?.(l.exoId) : onTousExos?.())}>
                <span>{l.texte}</span>
                <ChevronRight size={16} strokeWidth={1.75} className="muted" />
              </button>
            ) : (
              <p key={l.texte} className="bilan-retenir">
                {l.texte}
              </p>
            )
          )}
        </section>
      )}

      {exercices.montent.length + exercices.bloques.length + capsAffiches.length > 0 && (
        <section className="carte bilan-carte">
          <h3>Exercices</h3>
          {exercices.montent.length > 0 && <div className="bilan-intertitre">Ce qui monte</div>}
          {exercices.montent.slice(0, 2).map((l) => (
            <LigneExo key={l.id} {...l} onClick={ouvrirExo && (() => ouvrirExo(l.id))} />
          ))}
          {exercices.bloques.length > 0 && <div className="bilan-intertitre">Ce qui bloque</div>}
          {exercices.bloques.slice(0, 2).map((l) => (
            <LigneExo key={l.id} {...l} onClick={ouvrirExo && (() => ouvrirExo(l.id))} />
          ))}
          {capsAffiches.length > 0 && <div className="bilan-intertitre">{capsAffiches.length > 1 ? 'Tes caps' : 'Ton cap'}</div>}
          {capsAffiches.map(({ c, exo, etat }) => (
            <button key={c.exoId} type="button" className="bilan-cap" onClick={() => ouvrirExo?.(c.exoId)} disabled={!ouvrirExo}>
              <div className="cap-tete">
                <span>{exo.nom}</span>
                <span className="cap-but">
                  {texteCap(exo, c, c.cible)}
                  <ChevronRight size={16} strokeWidth={1.75} className="muted" />
                </span>
              </div>
              <PisteCap part={etat.part} />
              <div className="faible cap-legende">
                Tu es à {texteCap(exo, c, etat.niveau)}. {texteReste(c, etat.reste)}
              </div>
            </button>
          ))}
          {!surCycle && exercices.montent.length + exercices.bloques.length > 2 && (
            <button type="button" className="bilan-tous" onClick={() => onTousExos?.()}>
              <span>Voir tous les exercices</span>
              <ChevronRight size={16} strokeWidth={1.75} className="muted" />
            </button>
          )}
        </section>
      )}

      {surCycle && nbExosCycle > 0 && (
        <button type="button" className="liste-btn bilan-lien-detail" onClick={() => ouvrirSous('exercices')}>
          <span>
            Voir {nbExosCycle > 1 ? `les ${nbExosCycle} exercices` : 'l’exercice'}
          </span>
          <ChevronRight size={18} className="muted" />
        </button>
      )}


      {seancesCycle.length > 0 && (
        <button type="button" className="liste-btn bilan-lien-detail" onClick={() => ouvrirSous('seances')}>
          <span>
            {/* Cycle en cours : le compte de « Régularité » s'arrête à la dernière semaine finie, pas celui de sa page. */}
            {!etatCycle(cycle!).fini ? 'Voir les séances du cycle' : seancesCycle.length > 1 ? `Voir les ${seancesCycle.length} séances` : 'Voir la séance'}
          </span>
          <ChevronRight size={18} className="muted" />
        </button>
      )}

      {muscles.length > 0 && semainesFinies(seances.map((s) => s.date), cetteSemaine) < 2 && (
        <section className="carte bilan-carte bilan-regularite">
          <h3>Muscles</h3>
          <p className="faible petit-texte">Tes muscles apparaîtront ici après 2 semaines d’entraînement.</p>
        </section>
      )}

      {muscles.length > 0 && semainesFinies(seances.map((s) => s.date), cetteSemaine) >= 2 && (
        <section className="carte bilan-carte">
          <div className="ligne entre">
            <h3 className="avec-aide">
              Muscles
              <Aide titre="Séries dures" texte="Une série dure est une série proche de l’échec (effort 7/10 ou plus). C’est ce travail qui fait progresser le muscle. Barre pleine : le conseil est atteint." />
            </h3>
            <span className="faible petit-texte">séries dures par semaine</span>
          </div>
          {horsZone.map((m) => (
            <JaugeMuscle key={m.id} muscle={m.id} nom={m.nom} valeur={a.volume[m.id]} cible={cibles[m.id]} />
          ))}
          {dansZone.length > 0 && (
            <p className="petit-texte">
              <span className="tenue">Optimal : </span>
              {dansZone.map((m) => `${m.nom} ${kg(arrondi(a.volume[m.id]))}`).join(' · ')}
            </p>
          )}
          {sansConseil.length > 0 && (
            <p className="petit-texte">
              <span className="faible">Sans conseil : </span>
              {sansConseil.map((m) => `${m.nom} ${kg(arrondi(a.volume[m.id]))}`).join(' · ')}
            </p>
          )}
        </section>
      )}

      {catalogue.conseilsVolumeMasques && semainesFinies(seances.map((s) => s.date), cetteSemaine) >= 2 && (
        <section className="carte bilan-carte">
          <div className="ligne entre">
            <h3>Muscles</h3>
            <span className="faible petit-texte">séries dures par semaine</span>
          </div>
          <p className="petit-texte">
            {MUSCLES.filter((m) => a.volume[m.id] > 0)
              .map((m) => `${m.nom} ${kg(arrondi(a.volume[m.id]))}`)
              .join(' · ')}
          </p>
        </section>
      )}

      {(a.sommeil || a.pas || notesCalories > 0 || a.poids) && (
        <section className="carte bilan-carte">
          <h3>Forme</h3>
          {a.sommeil && (
            <div className="ligne entre bilan-forme">
              <span>Sommeil moyen</span>
              <strong>
                {Math.floor(a.sommeil.moyenne)} h {String(Math.round((a.sommeil.moyenne % 1) * 60)).padStart(2, '0')}
              </strong>
            </div>
          )}
          {a.pas && (
            <div className="ligne entre bilan-forme">
              <span>Pas par jour</span>
              <strong>{milliers(a.pas.moyenne)}</strong>
            </div>
          )}
          {notesCalories > 0 && (
            <div className="ligne entre bilan-forme">
              <span>Calories tenues</span>
              <strong>
                {a.calories.ok} jour{a.calories.ok > 1 ? 's' : ''} sur {notesCalories}
              </strong>
            </div>
          )}
          {a.poids && (
            <button type="button" className="ligne entre bilan-forme bilan-lien" onClick={ouvrirCorps}>
              <span>Poids moyen</span>
              <span>
                <strong>{kg(arrondi(a.poids.fin))} kg</strong> <span className="faible">{ecart(a.poids.fin - a.poids.debut, 'kg')}</span>
                <ChevronRight size={16} strokeWidth={1.75} className="muted" />
              </span>
            </button>
          )}
        </section>
      )}

      {partage && <PartageBilan contenu={contenuImage} texte={texteComplet} onFermer={() => setPartage(false)} />}
      {voirDisque && <FenetreDisque seances={seances} exo={catalogue.exo} onFermer={() => setVoirDisque(false)} />}
    </div>
  )
}


/** Semaines tenues du cycle jusqu'à `fin`. Lues depuis le lundi de la semaine ouverte : le dimanche, celle qui s'achève compte. */
function tenuesDuCycle(c: Cycle, seances: Seance[], fin: string, ouverte: string, prevus: EtapePrevu[]) {
  const lignes = suiviCycle(c, seances, ouverte, prevus).semaines.filter((x) => x.lundi <= fin && (x.etat === 'tenue' || x.etat === 'manquee'))
  return { n: lignes.filter((x) => x.etat === 'tenue').length, sur: lignes.length }
}

function LigneExo({ nom, detail, valeur, onClick }: LigneExercice & { onClick?: () => void }) {
  return (
    <button type="button" className="bilan-exo" onClick={onClick} disabled={!onClick}>
      <span className="bilan-exo-texte">
        <span>{nom}</span>
        <span className="faible">{detail}</span>
      </span>
      {valeur && <strong className="tenue">{valeur}</strong>}
      <ChevronRight size={16} strokeWidth={1.75} className="muted" />
    </button>
  )
}

function JaugeMuscle({ muscle, nom, valeur, cible }: { muscle: Muscle; nom: string; valeur: number; cible: number }) {
  const etat = etatVolume(muscle, valeur, cible)
  return (
    <div className="bilan-jauge">
      <div className="ligne entre">
        <span>{nom}</span>
        <span>
          <strong>{kg(arrondi(valeur))}</strong> <span className="faible">sur {kg(cible)}</span> <span className={`etat-volume ${etat}`}>· {LIBELLE_VOLUME[etat]}</span>
        </span>
      </div>
      <div className="jauge">
        <NiveauJauge muscle={muscle} etat={etat} valeur={valeur} max={cible} />
      </div>
    </div>
  )
}
