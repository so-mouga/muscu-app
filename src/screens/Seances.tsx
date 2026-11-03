import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { changerObjectifs, ID_PROGRAMME_DEFAUT, installerProgramme, lancerCycle, type Catalogue } from '../catalogue'
import { PROGRAMMES_TYPES, type ProgrammeType } from '../data/programmesTypes'
import ChoixExo from '../components/ChoixExo'
import EditeurExoPlan from '../components/EditeurExoPlan'
import InfosExo from '../components/InfosExo'
import Vignette from '../components/Vignette'
import VolumeMuscles from '../components/VolumeMuscles'
import { Aide, AIDE_CYCLE, AvisCycle, FriseCycle, LancerCycle, VueCycle } from '../components/Cycle'
import { suiviCycle } from '../lib/motivation'
import { Check, ChevronRight, MoreHorizontal } from 'lucide-react'
import { confirmer, informer } from '../components/Dialogues'
import { debutCycle, etatCycle, lundiDe, nomCycle, reprendreSemaine } from '../lib/cycle'
import { MUSCLES } from '../data/exercices'
import { ajustee, ciblesConseillees, etatVolume } from '../lib/volume'
import { ciblesPrecedentes } from '../lib/objectifs'
import { MODELES } from '../data/programme'
import { db, setReglage, uid } from '../db'
import { chargeTexte, dateCourte, dateISO, dureeEstimee, dureeTexte, jourSemaine, kg, lundi, minutes, schemaPlan, semaineType, volumePrevu } from '../lib/calc'
import { transition, useRetour } from '../lib/nav'
import type { Exercice, ExoPlan, Programme, Seance, SeanceModele } from '../types'
import { ReglageEchauffement } from '../components/Echauffement'
import { deplacer, useGlisser } from '../lib/glisser'
import { delier, estDansSuperset, groupeSuperset, retirerDuPlan } from '../lib/superset'
import { copieProgramme, nomSeanceLibre, programmesSansSeance, reposParDefaut } from '../lib/programme'
import Deplie from '../components/Deplie'

export const JOURS = ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']

/** Plan par défaut d'un exercice ajouté (modifiable juste après). */
export function planParDefaut(exo: Exercice): ExoPlan {
  // Exercice en temps (gainage…) : 3 × 30 s, repos court.
  if (exo.mesure === 'temps')
    return { exoId: exo.id, repos: reposParDefaut(exo), series: [0, 1, 2].map(() => ({ repsMin: 30, repsMax: 30, rpe: 8 })), chauffes: [], finisseur: false, charge: 0 }
  const compose = exo.type === 'compose'
  // Un seul nombre de reps par série (3 × 10, 3 × 12) ; la fourchette reste une option avancée.
  const reps = compose ? 10 : 12
  return {
    exoId: exo.id,
    repos: reposParDefaut(exo),
    series: [0, 1, 2].map(() => ({ repsMin: reps, repsMax: reps, rpe: 8 })),
    chauffes: [],
    finisseur: false,
    charge: null,
  }
}

export function resumePlan(exo: Exercice, p: ExoPlan): string {
  // L'effort n'apparaît que s'il s'écarte du réglage par défaut (8) : on lit d'abord reps, charge, repos.
  const rpeParDefaut = p.series.every((x) => x.rpe === 8) || (p.finisseur && p.series.slice(0, -1).every((x) => x.rpe === 8))
  return [
    schemaPlan(exo, p),
    p.charge === null ? '' : chargeTexte(exo, p.charge),
    p.enchaine ? (p.repos > 0 ? `enchaîné après ${p.repos} s` : 'enchaîné direct') : '',
    rpeParDefaut ? '' : `effort ${[...new Set(p.series.map((x) => kg(x.rpe)))].join(', ')}/10`,
    p.finisseur ? 'finisseur' : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

type Vue =
  | { type: 'programme'; p: Programme }
  | { type: 'seance'; m: SeanceModele; nouvelle: boolean; /** Ouverte depuis un programme. */ entree?: { programmeId: string; index: number }; /** Séance à peine créée : on choisit tout de suite ses exercices. */ choisirExos?: boolean }
  | { type: 'cycle' }
  | { type: 'volume'; p: Programme }
  | { type: 'changer' }
  | { type: 'autresSeances' }

export const jourCourt = (j?: number) => (j ? JOURS[j].slice(0, 3) : '')

/** Enregistre un programme ; le programme de départ (virtuel) est conservé dès qu'on en crée un autre. */
async function sauverProgramme(p: Programme, catalogue: Catalogue) {
  if (!catalogue.sansProgramme && (await db.programmes.count()) === 0 && p.id !== ID_PROGRAMME_DEFAUT) await db.programmes.put(catalogue.programmes[0])
  await db.programmes.put(p)
}

/** Le programme tel qu'on le modifie : jamais la copie du cycle. */
const programmeVivant = (catalogue: Catalogue, p: Programme) => catalogue.programmes.find((x) => x.id === p.id) ?? p

export default function Seances({ catalogue, onChoisirProgramme, creer, onCreerOuvert, onBilanCycle }: { catalogue: Catalogue; onChoisirProgramme: () => void; /** Ouvre le Bilan sur la période du cycle. */ onBilanCycle: () => void; /** Ouvre tout de suite un nouveau programme (« Créer le mien » du démarrage). */ creer?: boolean; onCreerOuvert?: () => void }) {
  const [pile, setPile] = useState<Vue[]>([])
  const terminees = useLiveQuery(() => db.seances.filter((s) => !s.enCours).toArray(), [])
  const vue = pile[pile.length - 1]
  /** Message de confirmation, en haut de la page Programme. */
  const [annonce, setAnnonce] = useState('')
  const annoncer = (t: string) => {
    setAnnonce(t)
    setTimeout(() => setAnnonce(''), 3000)
  }

  const ouvrir = (v: Vue) => (transition(() => setPile((x) => [...x, v]), 'avant'), window.scrollTo({ top: 0 }))
  const fermer = () => (transition(() => setPile((x) => x.slice(0, -1)), 'arriere'), window.scrollTo({ top: 0 }))
  useRetour(vue?.type === 'programme' || vue?.type === 'volume' || vue?.type === 'changer' || vue?.type === 'autresSeances', () => {
    fermer()
    // Une seule page à la fois : tant qu'il en reste dessous, le prochain retour s'y arrête aussi.
    return pile.length > 1 ? 'rester' : undefined
  })
  const ouvrirSeance = (m: SeanceModele, entree: { programmeId: string; index: number }, choisirExos = false) => ouvrir({ type: 'seance', m: structuredClone(m), nouvelle: false, entree, choisirExos })
  const nouveauProgramme = async () => {
    const noms = new Set(catalogue.programmes.map((x) => x.nom))
    let nom = 'Mon programme'
    for (let k = 2; noms.has(nom); k++) nom = `Mon programme ${k}`
    const p: Programme = { id: 'p_' + uid(), nom, seances: [] }
    await sauverProgramme(p, catalogue)
    // Le tout premier programme devient celui de la page ; les autres s'ouvrent par-dessus.
    if (catalogue.sansProgramme) setPile([])
    else ouvrir({ type: 'programme', p })
  }
  useEffect(() => {
    if (!creer) return
    void nouveauProgramme()
    onCreerOuvert?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creer])

  if (vue?.type === 'seance')
    return (
      <>
        <AvisCycle catalogue={catalogue} fixe />
        <Editeur key={vue.m.id} catalogue={catalogue} initial={vue.m} nouvelle={vue.nouvelle} entree={vue.entree} choisirExos={!!vue.choisirExos} onFermer={() => fermer()} />
      </>
    )
  if (vue?.type === 'cycle' && catalogue.cycle) return <VueCycle catalogue={catalogue} cycle={catalogue.cycle} onFermer={fermer} onBilan={onBilanCycle} />
  if (vue?.type === 'volume') return <PageVolume catalogue={catalogue} p={programmeVivant(catalogue, vue.p)} onFermer={fermer} />
  if (vue?.type === 'changer')
    return (
      <PageChanger
        catalogue={catalogue}
        onFermer={fermer}
        onOuvrir={(p) => ouvrir({ type: 'programme', p })}
        onPris={(message) => (annoncer(message), transition(() => setPile([]), 'arriere'), window.scrollTo({ top: 0 }))}
        onCreer={() => void nouveauProgramme()}
        onAutresSeances={() => ouvrir({ type: 'autresSeances' })}
      />
    )
  if (vue?.type === 'autresSeances') return <PageAutresSeances catalogue={catalogue} terminees={terminees} onFermer={fermer} onOuvrir={(m, nouvelle) => ouvrir({ type: 'seance', m: structuredClone(m), nouvelle })} />
  if (!vue && catalogue.sansProgramme)
    return (
      <div>
        <div className="entete">
          <h1>Programme</h1>
        </div>
        <div className="carte pile">
          <strong>Pas encore de programme</strong>
          <div className="faible">Réponds à quelques questions et Cran t’en propose un. Tu peux aussi créer le tien.</div>
          <button className="btn primaire plein" onClick={onChoisirProgramme}>
            Choisis ton programme
          </button>
          <button className="btn plein" onClick={() => void nouveauProgramme()}>
            Créer le mien
          </button>
        </div>
      </div>
    )

  // La page : le programme en service, ou un autre ouvert depuis « Changer de programme ».
  const p = programmeVivant(catalogue, vue?.type === 'programme' ? vue.p : catalogue.actif)
  return (
    <PageProgramme
      key={p.id}
      catalogue={catalogue}
      p={p}
      terminees={terminees}
      onRetour={vue ? fermer : undefined}
      onSeance={ouvrirSeance}
      onCycle={() => ouvrir({ type: 'cycle' })}
      onBilan={onBilanCycle}
      onVolume={() => ouvrir({ type: 'volume', p })}
      onChanger={() => ouvrir({ type: 'changer' })}
      onOuvrirProgramme={(x) => ouvrir({ type: 'programme', p: x })}
      annonce={annonce}
      onAnnonce={annoncer}
    />
  )
}

/** Sept jours sur une ligne : un appui choisit, ou retire le jour déjà choisi. */
function ChoixJours({ jour, onJour }: { jour?: number; onJour: (j: number | undefined) => void }) {
  return (
    <div className="jours-semaine" role="group" aria-label="Jour de la séance">
      {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((nom, i) => (
        <button key={i} type="button" className={jour === i + 1 ? 'actif' : ''} aria-label={JOURS[i + 1]} aria-pressed={jour === i + 1} onClick={() => onJour(jour === i + 1 ? undefined : i + 1)}>
          {nom}
        </button>
      ))}
    </div>
  )
}

/** La page Programme : où j'en suis, quelle séance quel jour, le reste à un appui. Tout s'enregistre au fil de l'eau. */
function PageProgramme({
  catalogue,
  p,
  terminees,
  onRetour,
  onSeance,
  onCycle,
  onBilan,
  onVolume,
  onChanger,
  onOuvrirProgramme,
  annonce,
  onAnnonce,
}: {
  catalogue: Catalogue
  p: Programme
  terminees: Seance[] | undefined
  /** Absent : c'est le programme en service, la page de l'onglet. */
  onRetour?: () => void
  onSeance: (m: SeanceModele, entree: { programmeId: string; index: number }, choisirExos?: boolean) => void
  onCycle: () => void
  onBilan: () => void
  onVolume: () => void
  onChanger: () => void
  onOuvrirProgramme: (p: Programme) => void
  annonce: string
  onAnnonce: (message: string) => void
}) {
  const [lancer, setLancer] = useState(false)
  const [menu, setMenu] = useState(false)
  const [renommer, setRenommer] = useState(false)
  /** Position, dans le programme, de la séance dont on choisit le jour. */
  const [choixJour, setChoixJour] = useState<number | null>(null)
  const [ajout, setAjout] = useState<{ nom: string; jour?: number; existantes?: boolean } | null>(null)
  useRetour(menu, () => setMenu(false))
  useRetour(renommer, () => setRenommer(false))
  useRetour(choixJour !== null, () => setChoixJour(null))
  useRetour(!!ajout, () => setAjout(null))

  const maj = (f: (x: Programme) => void) => {
    const c = structuredClone(p)
    f(c)
    void sauverProgramme(c, catalogue)
  }
  const entrees = p.seances
    .map((e, i) => ({ e, i, m: catalogue.modele(e.modeleId) }))
    .filter((x) => x.m)
    .sort((a, b) => (a.e.jour ?? 8) - (b.e.jour ?? 8))
  const enService = catalogue.actif.id === p.id
  const cycle = enService ? catalogue.cycle : undefined
  const etat = cycle && etatCycle(cycle)
  const autreCycle = !enService && catalogue.cycle && !etatCycle(catalogue.cycle).fini
  const nomSeance = (x: number) => catalogue.modele(p.seances[x]?.modeleId)?.nom ?? ''

  const dupliquer = async () => {
    setMenu(false)
    const { programme: copie, seances } = copieProgramme(p, catalogue.modele, uid)
    await db.modeles.bulkPut(seances)
    await sauverProgramme(copie, catalogue)
    onOuvrirProgramme(copie)
  }
  const supprimer = async () => {
    setMenu(false)
    if (cycle && etat && !etat.fini) return informer('Ton cycle en cours s’en sert. Termine d’abord le cycle : appuie sur la ligne du cycle, puis sur ⋯. Tu pourras ensuite supprimer ce programme.', 'Ce programme est en cours')
    if (catalogue.programmes.length <= 1) return informer('Il faut garder au moins un programme.')
    if (!(await confirmer('Ses séances restent disponibles dans « Autres séances ».', { titre: `Supprimer le programme « ${p.nom} » ?`, oui: 'Supprimer le programme', danger: true }))) return
    if ((await db.programmes.count()) === 0) await db.programmes.bulkPut(catalogue.programmes)
    await db.programmes.delete(p.id)
    if (enService) await setReglage('programmeActif', catalogue.programmes.find((x) => x.id !== p.id)!.id)
    onRetour?.()
  }
  const creerSeance = async () => {
    const m: SeanceModele = { id: 'm_' + uid(), nom: ajout!.nom.trim() || nomSeanceLibre(entrees.map((x) => x.m!.nom)), sousTitre: '', exercices: [] }
    const jour = ajout!.jour
    await db.modeles.put(m)
    await sauverProgramme({ ...p, seances: [...p.seances, { modeleId: m.id, jour }] }, catalogue)
    setAjout(null)
    onSeance(m, { programmeId: p.id, index: p.seances.length }, true)
  }

  const volume = volumePrevu(semaineType(p).map((e) => catalogue.modele(e.modeleId)).filter((m) => !!m), catalogue.exercices)
  const etats = MUSCLES.map((m) => etatVolume(m.id, volume[m.id], catalogue.cibles[m.id]))
  const legers = etats.filter((e) => e === 'leger').length
  const beaucoup = etats.filter((e) => e === 'beaucoup').length
  const prochainDeload = cycle && etat ? cycle.deloads.find((d) => d >= etat.n) : undefined
  const suivi = cycle ? suiviCycle(cycle, terminees ?? [], dateISO()) : undefined
  // Les repères de la semaine : ce qui est fait, et ce qui tombe aujourd'hui.
  const enPause = !!etat?.pause && !etat.fini
  const ceLundi = lundi()
  const deLaSemaine = enService && !enPause ? (terminees ?? []).filter((s) => s.date >= ceLundi).map((s) => s.modeleId) : []
  const faiteCetteSemaine = (modeleId: string) => {
    const i = deLaSemaine.indexOf(modeleId)
    if (i < 0) return false
    deLaSemaine.splice(i, 1)
    return true
  }
  const aujourdhui = jourSemaine()

  return (
    <div>
      <div className="entete">
        {onRetour && (
          <button className="btn" onClick={onRetour} aria-label="Retour">
            ←
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="faible">{enService ? 'Ton programme' : 'Programme'}</div>
          <h1>{p.nom}</h1>
        </div>
        <button className="icone" onClick={() => setMenu(true)} aria-label="Plus d’actions">
          <MoreHorizontal size={22} />
        </button>
      </div>

      {annonce && (
        <div className="avis-cycle" role="status">
          ✓ {annonce}
        </div>
      )}
      <AvisCycle catalogue={catalogue} />

      {entrees.length > 0 && cycle && etat?.pause && !etat.fini ? (
        <div className="carte pile">
          <button type="button" className="prog-lien" onClick={onCycle}>
            <span>
              <strong className="semaine-pause prog-cycle-titre">Cycle en pause</strong>
              <span className="faible prog-sous">
                Reprend le {new Date(lundiDe(cycle, etat.n) + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} : semaine {etat.n} sur {etat.total}
              </span>
              <FriseCycle cycle={cycle} seances={terminees ?? []} />
            </span>
            <ChevronRight size={20} className="muted" />
          </button>
          <button className="btn plein" onClick={() => void db.cycles.put(reprendreSemaine(cycle, lundi()))}>
            Reprendre cette semaine
          </button>
        </div>
      ) : entrees.length > 0 &&
        (cycle && etat && !etat.fini ? (
          <button className="liste-btn prog-cycle" onClick={onCycle}>
            <span>
              <strong className="prog-cycle-titre">{etat.n <= 0 ? 'Cycle à venir' : `Semaine ${etat.n} sur ${etat.total}`}</strong>
              <span className="faible prog-sous">
                {etat.n <= 0
                  ? `Commence le ${new Date(cycle.debut + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}`
                  : [
                      `${suivi?.cetteSemaine ?? 0} sur ${suivi?.prevues ?? 0} cette semaine`,
                      etat.deload ? 'semaine allégée' : prochainDeload ? `allégée : la ${prochainDeload}e` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
              </span>
              <FriseCycle cycle={cycle} seances={terminees ?? []} />
            </span>
            <ChevronRight size={20} className="muted" />
          </button>
        ) : (
          <div className="carte pile">
            {cycle ? (
              <button type="button" className="prog-lien" onClick={onBilan}>
                <strong>Cycle terminé</strong>
                <span className="faible">
                  Voir le bilan <ChevronRight size={14} className="ico-texte" />
                </span>
              </button>
            ) : (
              <div className="ligne entre">
                <span className="faible">Suis-le semaine par semaine pendant 6 semaines : la dernière est allégée pour récupérer.</span>
                <Aide titre="Un cycle" texte={AIDE_CYCLE} />
              </div>
            )}
            <button className="btn primaire plein" onClick={() => setLancer(true)}>
              {cycle ? 'Relancer sur 6 semaines' : 'Lancer sur 6 semaines'}
            </button>
            {!enService && !autreCycle && (
              <button className="btn plein" onClick={() => void setReglage('programmeActif', p.id)}>
                Utiliser sans cycle
              </button>
            )}
          </div>
        ))}

      {entrees.map(({ e, i, m }) => {
        const faite = !!e.jour && faiteCetteSemaine(e.modeleId)
        const duJour = enService && !enPause && !faite && e.jour === aujourdhui
        return (
        <div key={e.modeleId + i} className={'prog-seance' + (enPause ? ' en-pause' : '') + (duJour ? ' du-jour' : '')}>
          <button type="button" className={'prog-jour' + (e.jour ? '' : ' sans') + (faite ? ' faite' : '')} aria-label={`Jour de ${m!.nom} : ${e.jour ? JOURS[e.jour] : 'aucun'}${faite ? ', faite cette semaine' : ''}`} onClick={() => setChoixJour(i)}>
            {faite && <Check size={18} className="prog-fait" />}
            {duJour ? 'auj.' : e.jour ? jourCourt(e.jour) : 'sans jour'}
          </button>
          <button type="button" className="prog-ligne" onClick={() => onSeance(m!, { programmeId: p.id, index: i })}>
            <span>
              {m!.nom}
              {m!.sousTitre && <span className="faible prog-sous">{m!.sousTitre}</span>}
              <span className="faible prog-sous">{[`${m!.exercices.length} exercice${m!.exercices.length > 1 ? 's' : ''}`, m!.exercices.length ? dureeTexte(m!, terminees, true) : ''].filter(Boolean).join(' · ')}</span>
            </span>
            <ChevronRight size={20} className="muted" />
          </button>
        </div>
        )
      })}
      <button className={'btn plein' + (entrees.length ? '' : ' primaire')} style={{ marginBottom: 'var(--e4)' }} onClick={() => setAjout({ nom: nomSeanceLibre(entrees.map((x) => x.m!.nom)) })}>
        + Ajouter une séance
      </button>

      {entrees.length > 0 && (
        <button className="liste-btn" onClick={onVolume}>
          <span>
            Volume par semaine
            <span className="faible prog-sous">
              {legers || beaucoup ? [legers ? `${legers} muscle${legers > 1 ? 's' : ''} un peu léger${legers > 1 ? 's' : ''}` : '', beaucoup ? `${beaucoup} avec beaucoup` : ''].filter(Boolean).join(' · ') : 'Tous les muscles sont dans la zone utile'}
            </span>
          </span>
          <ChevronRight size={20} className="muted" />
        </button>
      )}
      {!onRetour && (
        <button className="liste-btn" onClick={onChanger}>
          <span>Changer de programme</span>
          <ChevronRight size={20} className="muted" />
        </button>
      )}

      {lancer && (
        <LancerCycle
          catalogue={catalogue}
          programme={p}
          onFermer={() => setLancer(false)}
          onLance={onAnnonce}
        />
      )}
      {menu && (
        <div className="modal-fond" onClick={() => setMenu(false)}>
          <div className="modal pile" onClick={(ev) => ev.stopPropagation()}>
            <h3>{p.nom}</h3>
            <button className="liste-btn" onClick={() => (setMenu(false), setRenommer(true))}>
              <span>Renommer</span>
            </button>
            <button className="liste-btn" onClick={() => void dupliquer()}>
              <span>Dupliquer</span>
            </button>
            <button className="liste-btn" onClick={() => void supprimer()}>
              <span style={{ color: 'var(--danger)' }}>Supprimer ce programme</span>
            </button>
            <button className="btn discret plein" onClick={() => setMenu(false)}>
              Fermer
            </button>
          </div>
        </div>
      )}
      {renommer && <FenetreRenommer nom={p.nom} onFin={(nom) => (setRenommer(false), nom !== p.nom && maj((x) => (x.nom = nom)))} />}
      {choixJour !== null && (
        <div className="modal-fond" onClick={() => setChoixJour(null)}>
          <div className="modal pile" onClick={(ev) => ev.stopPropagation()}>
            <h2>Quel jour pour {nomSeance(choixJour)} ?</h2>
            <ChoixJours
              jour={p.seances[choixJour]?.jour}
              onJour={(j) => {
                const i = choixJour
                setChoixJour(null)
                maj((x) => (x.seances[i].jour = j))
              }}
            />
            <button
              className="btn plein"
              onClick={() => {
                const i = choixJour
                setChoixJour(null)
                maj((x) => (x.seances[i].jour = undefined))
              }}
            >
              Sans jour : séance au choix
            </button>
          </div>
        </div>
      )}
      {ajout && (
        <div className="modal-fond" onClick={() => setAjout(null)}>
          <div className="modal pile" onClick={(ev) => ev.stopPropagation()}>
            {ajout.existantes ? (
              <>
                <h2>Reprendre une séance</h2>
                {catalogue.modeles.map((m) => (
                  <button
                    key={m.id}
                    className="liste-btn"
                    onClick={() => {
                      setAjout(null)
                      maj((x) => x.seances.push({ modeleId: m.id, jour: ajout.jour }))
                    }}
                  >
                    <span>
                      {m.nom}
                      <span className="faible prog-sous">{p.seances.some((e) => e.modeleId === m.id) ? 'Déjà dans le programme : l’ajouter encore = 2 fois par semaine' : `${m.exercices.length} exercices`}</span>
                    </span>
                  </button>
                ))}
                <button className="btn discret plein" onClick={() => setAjout({ ...ajout, existantes: false })}>
                  Retour
                </button>
              </>
            ) : (
              <>
                <h2>Nouvelle séance</h2>
                <label className="champ">
                  <span>Nom</span>
                  <input value={ajout.nom} onChange={(ev) => setAjout({ ...ajout, nom: ev.target.value })} />
                </label>
                <div className="champ">
                  <span>Quel jour ?</span>
                  <ChoixJours jour={ajout.jour} onJour={(jour) => setAjout({ ...ajout, jour })} />
                </div>
                <button className="btn primaire plein" onClick={() => void creerSeance()}>
                  Choisir les exercices
                </button>
                {catalogue.modeles.length > 0 && (
                  <button className="btn discret plein" onClick={() => setAjout({ ...ajout, existantes: true })}>
                    Reprendre une séance existante
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** Un appui à côté ou le retour gardent le nom saisi ; vide, on garde l'ancien. */
function FenetreRenommer({ titre = 'Renommer', nom, indice, videPermis = false, onFin }: { titre?: string; nom: string; indice?: string; videPermis?: boolean; onFin: (nom: string) => void }) {
  const [texte, setTexte] = useState(nom)
  const finir = () => onFin(texte.trim() || (videPermis ? '' : nom))
  return (
    <div className="modal-fond" onClick={finir}>
      <div className="modal pile" onClick={(ev) => ev.stopPropagation()}>
        <h2>{titre}</h2>
        <input value={texte} autoFocus placeholder={indice} onChange={(ev) => setTexte(ev.target.value)} />
        <button className="btn plein" onClick={finir}>
          Terminé
        </button>
      </div>
    </div>
  )
}

/** Ce que le programme donne à chaque muscle, sur un écran : un appui sur un muscle pour ajuster sa cible. */
function PageVolume({ catalogue, p, onFermer }: { catalogue: Catalogue; p: Programme; onFermer: () => void }) {
  const volume = volumePrevu(semaineType(p).map((e) => catalogue.modele(e.modeleId)).filter((m) => !!m), catalogue.exercices)
  const perso = catalogue.ciblesPerso
  const nbAjustees = MUSCLES.filter((m) => ajustee(m.id, perso[m.id] ?? 0)).length
  const avant = ciblesPrecedentes(catalogue.objectifs, dateISO())
  const reprendre = async () => {
    if (!avant) return
    const ecarts = MUSCLES.filter((m) => (avant.volume[m.id] ?? 0) !== (perso[m.id] ?? 0)).map((m) => `${m.nom} : ${kg(perso[m.id] ?? 0)} → ${kg(avant.volume[m.id] ?? 0)}`)
    if (await confirmer(ecarts.join(' · '), { titre: `Reprendre tes cibles du ${dateCourte(avant.depuis)} ?`, oui: 'Reprendre ces cibles' })) void changerObjectifs(catalogue, { volume: avant.volume })
  }
  return (
    <div>
      <div className="entete">
        <button className="btn" onClick={onFermer} aria-label="Retour">
          ←
        </button>
        <h2 style={{ flex: 1 }}>Volume par semaine</h2>
      </div>
      <div className="faible volume-intro">
        Séries dures par semaine dans {p.nom}, face à la zone utile.{' '}
        <Aide
          titre="Volume par semaine"
          texte={`Une série dure est proche de l’échec : 7/10 d’effort ou plus.${p.seances.some((e) => e.jour) ? ' Seules les séances avec un jour comptent.' : ''} La zone verte est la zone utile pour progresser. Trop léger : ajoute une série ou un exercice pour ce muscle. Un appui sur un muscle pour voir ou ajuster sa cible.`}
        />
      </div>
      <div className="carte">
        <VolumeMuscles volume={volume} cibles={catalogue.cibles} perso={perso} onCibles={(v) => void changerObjectifs(catalogue, { volume: v })} />
      </div>
      {avant && (
        <button className="btn discret plein" onClick={() => void reprendre()}>
          Revenir à mes cibles d’avant
        </button>
      )}
      {nbAjustees > 0 && (
        <button className="btn discret plein" onClick={() => void changerObjectifs(catalogue, { volume: ciblesConseillees() })}>
          Revenir aux zones conseillées ({nbAjustees} ajustée{nbAjustees > 1 ? 's' : ''})
        </button>
      )}
    </div>
  )
}

/** Tout ce qui n'est pas le programme en service. Un appui déplie un programme sur place : on compare sans changer de page. */
function PageChanger({ catalogue, onFermer, onOuvrir, onPris, onCreer, onAutresSeances }: { catalogue: Catalogue; onFermer: () => void; onOuvrir: (p: Programme) => void; onPris: (message: string) => void; onCreer: () => void; onAutresSeances: () => void }) {
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [lancer, setLancer] = useState<Programme | null>(null)
  const autres = catalogue.programmes.filter((x) => x.id !== catalogue.actif.id)
  // Sans les séances supprimées avant que le programme ne soit nettoyé.
  const nbSeances = (x: Programme) => x.seances.filter((e) => catalogue.modele(e.modeleId)).length
  const enCours = catalogue.cycle && !etatCycle(catalogue.cycle).fini ? catalogue.cycle : undefined
  // Un tout prêt déjà pris se retrouve dans ses programmes : le reprendre ne ferait qu'une copie de plus.
  const noms = new Set(catalogue.programmes.map((x) => x.nom))
  const prendre = async (t: ProgrammeType, avecCycle: boolean) => {
    if (occupe) return
    if (avecCycle && enCours && !(await confirmer(`Le cycle « ${nomCycle(enCours)} » en cours sera terminé. Son historique et son bilan sont conservés.`, { titre: 'Lancer ce programme ?', oui: 'Lancer le nouveau cycle' }))) return
    setOccupe(true)
    try {
      const debut = debutCycle(t.seances.flatMap((m) => m.jour ?? []))
      const p = await installerProgramme(t, catalogue)
      if (avecCycle) await lancerCycle(catalogue, p, { debut })
      onPris(!avecCycle ? (enCours ? `${t.nom} est dans tes programmes. Ton cycle continue.` : `${t.nom} est ton programme`) : debut === lundi() ? 'Programme pris : semaine 1 sur 6' : 'Programme pris : il commence la semaine prochaine')
    } finally {
      setOccupe(false)
    }
  }
  const depliable = (id: string, nom: string, detail: string, seances: { jour?: number; nom: string; exos: string[] }[], actions: ReactNode) => (
    <div key={id} className="depliable">
      <button type="button" className="depliable-tete" aria-expanded={ouvert === id} onClick={() => setOuvert(ouvert === id ? null : id)}>
        <span>
          {nom}
          <span className="faible prog-sous">{detail}</span>
        </span>
        <ChevronRight size={20} className={'muted depliable-chevron' + (ouvert === id ? ' ouvert' : '')} />
      </button>
      <Deplie ouvert={ouvert === id}>
        <div className="depliable-corps pile">
          {[...seances]
            .sort((x, y) => (x.jour ?? 8) - (y.jour ?? 8))
            .map((x, i) => (
              <div key={x.nom + i}>
                <strong>
                  {x.jour ? `${jourCourt(x.jour)} · ` : ''}
                  {x.nom}
                </strong>
                <div className="faible">{x.exos.join(', ') || 'Aucun exercice pour l’instant'}</div>
              </div>
            ))}
          {actions}
        </div>
      </Deplie>
    </div>
  )
  return (
    <div>
      <div className="entete">
        <button className="btn" onClick={onFermer} aria-label="Retour">
          ←
        </button>
        <h2 style={{ flex: 1 }}>Changer de programme</h2>
      </div>
      {autres.length > 0 && <h3 className="prog-groupe">Mes autres programmes</h3>}
      {autres.map((x) =>
        depliable(
          x.id,
          x.nom,
          `${nbSeances(x)} séance${nbSeances(x) > 1 ? 's' : ''}`,
          x.seances.flatMap((e) => {
            const m = catalogue.modele(e.modeleId)
            return m ? [{ jour: e.jour, nom: m.nom, exos: m.exercices.map((p) => catalogue.exo(p.exoId).nom) }] : []
          }),
          <>
            {nbSeances(x) > 0 && (
              <button className="btn primaire plein" onClick={() => setLancer(x)}>
                Lancer sur 6 semaines
              </button>
            )}
            {!enCours && nbSeances(x) > 0 && (
              <button
                className="btn plein"
                onClick={() => {
                  void setReglage('programmeActif', x.id)
                  onPris(`${x.nom} est ton programme`)
                }}
              >
                Utiliser sans cycle
              </button>
            )}
            <button className="btn discret plein" onClick={() => onOuvrir(x)}>
              Voir et modifier
            </button>
          </>
        )
      )}
      <h3 className="prog-groupe">Tout prêts</h3>
      {PROGRAMMES_TYPES.filter((t) => !noms.has(t.nom)).map((t) =>
        depliable(
          t.id,
          t.nom,
          t.pour,
          t.seances.map((m) => ({ jour: m.jour, nom: m.nom, exos: m.exercices.map((p) => catalogue.exo(p.exoId).nom) })),
          <>
            <div className="faible">Sur 6 semaines, la dernière allégée pour récupérer{debutCycle(t.seances.flatMap((m) => m.jour ?? [])) === lundi() ? '' : ', à partir de la semaine prochaine'}. Tout se modifie ensuite.</div>
            <button className="btn primaire plein" disabled={occupe} onClick={() => void prendre(t, true)}>
              Prendre ce programme
            </button>
            <button className="btn discret plein" disabled={occupe} onClick={() => void prendre(t, false)}>
              Le prendre sans lancer de cycle
            </button>
          </>
        )
      )}
      <div style={{ height: 'var(--e3)' }} />
      <button className="liste-btn" onClick={onCreer}>
        <span>Créer le mien</span>
        <ChevronRight size={20} className="muted" />
      </button>
      <button className="liste-btn" onClick={onAutresSeances}>
        <span>
          Autres séances
          <span className="faible prog-sous">Toutes tes séances, même hors programme</span>
        </span>
        <ChevronRight size={20} className="muted" />
      </button>
      {lancer && <LancerCycle catalogue={catalogue} programme={lancer} onFermer={() => setLancer(null)} onLance={onPris} />}
    </div>
  )
}

/** Ce qui reste de la Bibliothèque : les séances, y compris celles qui ne sont dans aucun programme. */
function PageAutresSeances({ catalogue, terminees, onFermer, onOuvrir }: { catalogue: Catalogue; terminees: Seance[] | undefined; onFermer: () => void; onOuvrir: (m: SeanceModele, nouvelle: boolean) => void }) {
  const masquees = useLiveQuery(() => db.modeles.filter((m) => !!m.supprime).toArray(), [], [])
  const utilisations = (m: SeanceModele) => catalogue.programmes.filter((p) => p.seances.some((e) => e.modeleId === m.id)).map((p) => p.nom)
  return (
    <div>
      <div className="entete">
        <button className="btn" onClick={onFermer} aria-label="Retour">
          ←
        </button>
        <h2 style={{ flex: 1 }}>Autres séances</h2>
      </div>
      <button className="btn plein" style={{ marginBottom: 'var(--e3)' }} onClick={() => onOuvrir({ id: 'm_' + uid(), nom: nomSeanceLibre(catalogue.modeles.map((m) => m.nom)), sousTitre: '', exercices: [] }, true)}>
        + Nouvelle séance
      </button>
      {[...catalogue.modeles]
        .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
        .map((m) => {
          const progs = utilisations(m)
          return (
            <button key={m.id} className="liste-btn" onClick={() => onOuvrir(m, false)}>
              <span>
                {m.nom}
                <span className="faible prog-sous">
                  {[m.sousTitre, `${m.exercices.length} exercice${m.exercices.length > 1 ? 's' : ''}`, dureeTexte(m, terminees, true), m.varianteDe ? `variante de ${catalogue.modele(m.varianteDe)?.nom ?? '?'}` : '', progs.length ? progs.join(', ') : 'dans aucun programme'].filter(Boolean).join(' · ')}
                </span>
              </span>
              <ChevronRight size={20} className="muted" />
            </button>
          )
        })}
      {masquees.length > 0 && (
        <div className="carte pile" style={{ marginTop: 'var(--e4)' }}>
          <div className="faible">Séances préchargées supprimées</div>
          {masquees.map((m) => (
            <div key={m.id} className="ligne entre">
              <span>{m.nom}</span>
              <button className="btn petit" onClick={() => db.modeles.delete(m.id)}>
                Restaurer
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Editeur({
  catalogue,
  initial,
  nouvelle,
  entree,
  choisirExos,
  onFermer,
}: {
  catalogue: Catalogue
  initial: SeanceModele
  nouvelle: boolean
  /** Ouverte depuis un programme : lequel, et sa place dedans (son jour, « Retirer du programme »). */
  entree?: { programmeId: string; index: number }
  /** Séance à peine créée : on ouvre tout de suite le choix des exercices. */
  choisirExos: boolean
  onFermer: () => void
}) {
  const [m, setM] = useState(initial)
  const [choix, setChoix] = useState(choisirExos)
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [infos, setInfos] = useState<Exercice | null>(null)
  const [plus, setPlus] = useState(false)
  const [fenetre, setFenetre] = useState<'nom' | 'sousTitre' | 'planB' | 'jour' | null>(null)
  useRetour(plus, () => setPlus(false))
  useRetour(fenetre !== null, () => setFenetre(null))
  // Comparé à la dernière version écrite (pas à celle d'ouverture) : revenir en arrière s'enregistre aussi.
  const ecrit = useRef(JSON.stringify(initial))
  const modifie = JSON.stringify(m) !== ecrit.current
  const prechargee = !!MODELES[m.id]
  const programme = entree && catalogue.programmes.find((p) => p.id === entree.programmeId)
  const jour = entree && programme?.seances[entree.index]?.jour

  // Enregistrement automatique : la séance est écrite peu après chaque changement.
  const ecrire = async () => {
    ecrit.current = JSON.stringify(m)
    const finale = { ...m, nom: m.nom.trim() || initial.nom, sousTitre: m.sousTitre.trim() }
    await db.modeles.put(finale)
    return finale
  }
  useEffect(() => {
    if (!modifie) return
    const t = setTimeout(() => void ecrire(), 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m])

  // Quitté aussitôt après un changement (barre du bas) : il est écrit quand même.
  const enAttente = useRef(() => {})
  enAttente.current = () => {
    if (modifie) void ecrire()
  }
  useEffect(() => () => enAttente.current(), [])

  // En quittant : dernier enregistrement. La question du cycle est posée par AvisCycle, dès l'enregistrement.
  const quitter = async () => {
    if (modifie) await ecrire()
    onFermer()
  }
  useRetour(true, () => {
    void quitter()
    return 'rester'
  })

  const maj = (f: (x: SeanceModele) => void) =>
    setM((x) => {
      const c = structuredClone(x)
      f(c)
      return c
    })
  const [remplace, setRemplace] = useState<number | null>(null)
  const glisser = useGlisser('.exo-ligne', (de, vers) =>
    maj((x) => {
      for (const i of [de, de - 1]) if (x.exercices[i]) x.exercices[i] = delier(x.exercices[i], reposParDefaut(catalogue.exo(x.exercices[i].exoId)))
      deplacer(x.exercices, de, vers)
    })
  )

  const finisseurs = m.exercices.filter((e) => e.finisseur).length

  // Séries dures que la séance donne à chaque muscle, du plus travaillé au moins travaillé.
  const volume = volumePrevu([m], catalogue.exercices)
  const travailles = MUSCLES.filter((x) => volume[x.id] > 0).sort((a, b) => volume[b.id] - volume[a.id])
  const nbSeries = m.exercices.reduce((n, e) => n + e.series.length, 0)
  // Beaucoup de muscles : les principaux d'abord, pour que la carte laisse voir les exercices.
  const [tousMuscles, setTousMuscles] = useState(false)

  const dupliquer = async () => {
    setPlus(false)
    await db.modeles.put({ ...structuredClone(m), id: 'm_' + uid(), nom: `${m.nom.trim()} (copie)`, jour: undefined })
    await informer(`La copie est dans « Changer de programme », puis « Autres séances ».`, 'Séance dupliquée')
  }
  const retirer = async () => {
    setPlus(false)
    if (!programme || !entree) return
    if (!(await confirmer('Elle reste disponible dans « Autres séances ». L’historique ne change pas.', { titre: `Retirer « ${m.nom} » de ${programme.nom} ?`, oui: 'Retirer du programme', danger: true }))) return
    await sauverProgramme({ ...programme, seances: programme.seances.filter((_, i) => i !== entree.index) }, catalogue)
    await quitter()
  }
  const supprimer = async () => {
    setPlus(false)
    const concernes = programmesSansSeance(catalogue.programmes, m.id)
    const avertissement = concernes.length ? `Elle sera retirée de ${concernes.map((p) => `« ${p.nom} »`).join(' et de ')}. ` : ''
    if (!(await confirmer(`${avertissement}L’historique des séances faites est conservé.`, { titre: `Supprimer « ${m.nom} » ?`, oui: 'Supprimer la séance', danger: true }))) return
    for (const p of concernes) await sauverProgramme(p, catalogue)
    ecrit.current = JSON.stringify(m)
    if (prechargee) await db.modeles.put({ ...initial, supprime: true })
    else await db.modeles.delete(m.id)
    onFermer()
  }

  return (
    <div>
      <div className="entete">
        <button className="btn" onClick={() => void quitter()} aria-label="Retour">
          ←
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2>{m.nom.trim() || 'Nouvelle séance'}</h2>
          <div className="faible">
            {programme && (
              <button type="button" className="seance-jour-choix" aria-label={`Changer le jour : ${jour ? JOURS[jour] : 'aucun'}`} onClick={() => setFenetre('jour')}>
                {jour ? JOURS[jour] : 'sans jour'}
              </button>
            )}
            {programme && m.sousTitre ? ' · ' : ''}
            {m.sousTitre}
          </div>
        </div>
        <button className="icone" onClick={() => setPlus(true)} aria-label="Plus d’actions">
          <MoreHorizontal size={22} />
        </button>
      </div>

      {nouvelle && (
        <label className="champ carte">
          <span>Nom</span>
          <input value={m.nom} placeholder="ex. Haut D" onChange={(e) => maj((x) => (x.nom = e.target.value))} />
        </label>
      )}

      {m.exercices.length > 0 && (
        <div className="carte seance-resume">
          <div>
            <strong className="seance-resume-duree">≈ {minutes(dureeEstimee(m))}</strong>
            <span className="faible">
              {' '}
              · {m.exercices.length} exercice{m.exercices.length > 1 ? 's' : ''} · {nbSeries} série{nbSeries > 1 ? 's' : ''}
            </span>
          </div>
          {travailles.length > 0 && (
            <>
              <div className="ligne entre seance-resume-titre">
                <span className="faible">Séries par muscle</span>
                <Aide
                  titre="Séries par muscle"
                  texte="Ne comptent que les séries qui font vraiment travailler : proches de l’échec, à 7/10 d’effort ou plus. Un muscle qui aide (comme le triceps sur un développé) compte pour une demi-série. Le total de la semaine est dans Programme, puis Volume par semaine."
                />
              </div>
              <div className="seance-muscles">
                {(tousMuscles || travailles.length <= 5 ? travailles : travailles.slice(0, 4)).map((x, i) => (
                  <span key={x.id} className={i < 2 ? 'fort' : ''}>
                    <strong>{kg(volume[x.id])}</strong> {x.nom}
                  </span>
                ))}
                {travailles.length > 5 && (
                  <button type="button" aria-expanded={tousMuscles} aria-label={tousMuscles ? 'Montrer moins de muscles' : `Montrer les ${travailles.length - 4} autres muscles`} onClick={() => setTousMuscles(!tousMuscles)}>
                    {tousMuscles ? 'moins' : `+${travailles.length - 4}`}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
      {m.exercices.length > 0 && <ReglageEchauffement modele={m} onChange={(v) => maj((x) => (v === undefined ? delete x.echauffement : (x.echauffement = v)))} />}

      <div ref={glisser.liste}>
        {m.exercices.map((p, i) => {
          const exo = catalogue.exo(p.exoId)
          const dansSuperset = estDansSuperset(m.exercices, i)
          const groupe = groupeSuperset(m.exercices, i)
          const enchaine = !!p.enchaine
          const precEnchaine = i > 0 && !!m.exercices[i - 1]?.enchaine
          return (
            <div
              key={p.exoId + i}
              className={
                'exo-ligne' +
                glisser.classes(i, m.exercices.length) +
                (dansSuperset ? ' en-superset' : '') +
                (enchaine ? ' enchaine-vers-suivant' : '') +
                (precEnchaine && !enchaine ? ' suite-superset' : '')
              }
            >
              {m.exercices.length > 1 && (
                <button className="poignee" aria-label={`Déplacer ${exo.nom}`} {...glisser.poignee(i)}>
                  ⠿
                </button>
              )}
              <Vignette exo={exo} taille={36} />
              <button className="texte" onClick={() => setEditIdx(i)}>
                <strong>{exo.nom}</strong>
                {dansSuperset && <span className="badge-superset">Superset {groupe.indexOf(i) + 1}/{groupe.length}</span>}
                {p.optionnel && <span className="faible"> (optionnel)</span>}
                <div className="faible">{resumePlan(exo, p)}</div>
              </button>
              <ChevronRight size={20} className="muted" />
            </div>
          )
        })}
      </div>
      <button className={'btn plein' + (m.exercices.length ? '' : ' primaire')} style={{ margin: 'var(--e3) 0 var(--e4)' }} onClick={() => setChoix(true)}>
        + Ajouter un exercice
      </button>
      {finisseurs > 2 && (
        <div className="faible" style={{ color: 'var(--alerte)', marginBottom: 'var(--e3)' }}>
          {finisseurs} finisseurs dans la même séance : c’est beaucoup, la qualité des dernières séries risque d’en pâtir.
        </div>
      )}

      {plus && (
        <div className="modal-fond" onClick={() => setPlus(false)}>
          <div className="modal pile" onClick={(e) => e.stopPropagation()}>
            <h3>{m.nom}</h3>
            <button className="liste-btn" onClick={() => (setPlus(false), setFenetre('nom'))}>
              <span>Renommer</span>
            </button>
            <button className="liste-btn" onClick={() => (setPlus(false), setFenetre('sousTitre'))}>
              <span>{m.sousTitre ? 'Modifier le sous-titre' : 'Ajouter un sous-titre'}</span>
            </button>
            <button className="liste-btn" onClick={() => (setPlus(false), setFenetre('planB'))}>
              <span>
                Plan B « Pas de salle »
                <span className="faible prog-sous">{m.varianteDe ? `Variante de ${catalogue.modele(m.varianteDe)?.nom ?? '?'}` : 'Séance de repli proposée sur l’accueil'}</span>
              </span>
            </button>
            <button className="liste-btn" onClick={() => void dupliquer()}>
              <span>Dupliquer</span>
            </button>
            {programme ? (
              <button className="liste-btn" onClick={() => void retirer()}>
                <span style={{ color: 'var(--danger)' }}>Retirer du programme</span>
              </button>
            ) : (
              !nouvelle && (
                <button className="liste-btn" onClick={() => void supprimer()}>
                  <span style={{ color: 'var(--danger)' }}>Supprimer la séance</span>
                </button>
              )
            )}
            <button className="btn discret plein" onClick={() => setPlus(false)}>
              Fermer
            </button>
          </div>
        </div>
      )}
      {fenetre === 'nom' && <FenetreRenommer nom={m.nom} onFin={(nom) => (setFenetre(null), maj((x) => (x.nom = nom)))} />}
      {fenetre === 'sousTitre' && <FenetreRenommer titre="Sous-titre" nom={m.sousTitre} videPermis indice="ex. épaules + bras" onFin={(nom) => (setFenetre(null), maj((x) => (x.sousTitre = nom)))} />}
      {fenetre === 'planB' && (
        <div className="modal-fond" onClick={() => setFenetre(null)}>
          <div className="modal pile" onClick={(e) => e.stopPropagation()}>
            <h2>Plan B « Pas de salle »</h2>
            <div className="faible">Cette séance sera proposée sur l’accueil, à la place de la séance choisie ici, quand tu ne peux pas aller à la salle ce jour-là.</div>
            <select aria-label="Séance remplacée" value={m.varianteDe ?? ''} onChange={(e) => maj((x) => (x.varianteDe = e.target.value || undefined))}>
              <option value="">Aucune</option>
              {catalogue.modeles
                .filter((x) => x.id !== m.id)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nom}
                  </option>
                ))}
            </select>
            <button className="btn plein" onClick={() => setFenetre(null)}>
              Terminé
            </button>
          </div>
        </div>
      )}
      {fenetre === 'jour' && programme && entree && (
        <div className="modal-fond" onClick={() => setFenetre(null)}>
          <div className="modal pile" onClick={(ev) => ev.stopPropagation()}>
            <h2>Quel jour pour {m.nom} ?</h2>
            <ChoixJours
              jour={jour}
              onJour={(j) => {
                setFenetre(null)
                void sauverProgramme({ ...programme, seances: programme.seances.map((e, i) => (i === entree.index ? { ...e, jour: j } : e)) }, catalogue)
              }}
            />
            <button
              className="btn plein"
              onClick={() => {
                setFenetre(null)
                void sauverProgramme({ ...programme, seances: programme.seances.map((e, i) => (i === entree.index ? { ...e, jour: undefined } : e)) }, catalogue)
              }}
            >
              Sans jour : séance au choix
            </button>
          </div>
        </div>
      )}

      {choix && (
        <ChoixExo
          catalogue={catalogue}
          titre="Ajouter des exercices"
          exclure={m.exercices.map((e) => e.exoId)}
          onFermer={() => setChoix(false)}
          onChoix={(id, cree) => {
            setChoix(false)
            const exo = cree ?? catalogue.exo(id)
            maj((x) => x.exercices.push(planParDefaut(exo)))
          }}
          onChoixMultiple={(ids, crees) => {
            setChoix(false)
            maj((x) => x.exercices.push(...ids.map((id) => planParDefaut(crees.find((e) => e.id === id) ?? catalogue.exo(id)))))
          }}
        />
      )}
      {editIdx !== null && m.exercices[editIdx] && (
        <EditeurExoPlan
          key={editIdx}
          exo={catalogue.exo(m.exercices[editIdx].exoId)}
          plan={m.exercices[editIdx]}
          onValider={(p) => {
            maj((x) => (x.exercices[editIdx] = p))
            setEditIdx(null)
          }}
          onPrecedent={
            editIdx > 0
              ? (p) => {
                  maj((x) => (x.exercices[editIdx] = p))
                  setEditIdx(editIdx - 1)
                }
              : undefined
          }
          onSuivant={
            editIdx < m.exercices.length - 1
              ? (p) => {
                  maj((x) => (x.exercices[editIdx] = p))
                  setEditIdx(editIdx + 1)
                }
              : undefined
          }
          onInfos={() => setInfos(catalogue.exo(m.exercices[editIdx].exoId))}
          onRemplacer={(p) => {
            maj((x) => (x.exercices[editIdx] = p))
            setRemplace(editIdx)
            setEditIdx(null)
          }}
          onRetirer={async () => {
            const i = editIdx
            if (!(await confirmer(`Retirer « ${catalogue.exo(m.exercices[i].exoId).nom} » de la séance ?`, { oui: 'Retirer', danger: true }))) return
            setEditIdx(null)
            maj((x) => (x.exercices = retirerDuPlan(x.exercices, i, (p) => reposParDefaut(catalogue.exo(p.exoId)))))
          }}
        />
      )}
      {infos && <InfosExo exo={infos} onFermer={() => setInfos(null)} />}
      {remplace !== null && m.exercices[remplace] && (
        <ChoixExo
          catalogue={catalogue}
          titre={`Remplacer ${catalogue.exo(m.exercices[remplace].exoId).nom}`}
          muscle={catalogue.exo(m.exercices[remplace].exoId).muscle}
          exclure={m.exercices.map((e) => e.exoId)}
          onFermer={() => setRemplace(null)}
          onChoix={(id) => {
            // Même plan (séries, reps, effort, repos) ; charges et échauffements repartent de zéro (autre machine).
            maj((x) => {
              const ancien = x.exercices[remplace]
              x.exercices[remplace] = {
                ...ancien,
                exoId: id,
                charge: null,
                chauffes: [],
                series: ancien.series.map(({ charge: _c, ...s }) => s),
              }
            })
            setEditIdx(remplace)
            setRemplace(null)
          }}
        />
      )}
    </div>
  )
}
