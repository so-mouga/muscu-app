import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useRef, useState } from 'react'
import type { Catalogue } from '../catalogue'
import { Editeur } from '../components/CarteExo'
import RecapExos, { ResumeSeance } from '../components/RecapSeance'
import { db, exoAvecReglages } from '../db'
import { dateISO, duree, estDure, kg } from '../lib/calc'
import { dureeReelle, mieuxParSeance, recordsParSeance } from '../lib/historique'
import { useRetour } from '../lib/nav'
import { suggestionPour } from '../lib/progression'
import type { Activite, JourJournal, Reglage, Seance, Serie } from '../types'
import { CALORIES, heures, noterJournal } from '../components/JournalMatin'
import FormActivite from '../components/FormActivite'
import { typeActivite } from '../data/activites'
import Bilan from './Bilan'
import Corps from './Corps'
import Objectifs from './Objectifs'
import { finAffichee, periodes, PHASES, textePhase, type EtapeObjectifs } from '../lib/objectifs'
import { prevuLe } from '../lib/cycle'

type Prevu = ReturnType<typeof prevuLe>
import { planParDefaut } from './Seances'
import { confirmer } from '../components/Dialogues'

const JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const dateLongue = (s: Seance) =>
  new Date(s.debut).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) +
  ' · ' +
  new Date(s.debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
const jourCourt = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

export type VueProgression = 'bilan' | 'journal' | 'corps' | 'objectifs'

const VUES: [VueProgression, string][] = [
  ['bilan', 'Bilan'],
  ['journal', 'Journal'],
  ['corps', 'Corps'],
  ['objectifs', 'Objectifs'],
]

interface Props {
  catalogue: Catalogue
  vue: VueProgression
  onVue: (v: VueProgression) => void
  /** Séance ouverte en détail (aussi depuis l'accueil). */
  detail: string | null
  onDetail: (id: string | null) => void
  /** Ouvre la fiche / courbe d'un exercice dans l'onglet Exercices. */
  onExo?: (id: string) => void
}

export default function Historique({ catalogue, detail, onDetail, vue, onVue, onExo }: Props) {
  const terminees = useLiveQuery(() => db.seances.orderBy('debut').reverse().filter((s) => !s.enCours).toArray(), [])
  const reglages = useLiveQuery(() => db.reglages.toArray(), [], [])
  const activites = useLiveQuery(() => db.activites.orderBy('date').reverse().toArray(), [], [])
  /** Activité ouverte (ou 'nouvelle'). */
  const [activite, setActivite] = useState<Activite | 'nouvelle' | null>(null)
  /** Jour choisi dans le calendrier (aujourd'hui par défaut). */
  const [jourChoisi, setJourChoisi] = useState(dateISO())
  /** Nouvelle activité : sa date (jour vide choisi dans le calendrier). */
  const [dateActivite, setDateActivite] = useState<string | undefined>(undefined)
  const mesuresJour = useLiveQuery(() => db.mesures.toArray(), [], [])
  const peseesJour = useLiveQuery(() => db.pesees.toArray(), [], [])
  const journalJour = useLiveQuery(() => db.journal.get(jourChoisi), [jourChoisi])
  const records = useMemo(() => (terminees ? recordsParSeance(terminees, catalogue.exo) : {}), [terminees, catalogue])
  const mieux = useMemo(() => (terminees ? mieuxParSeance(terminees, catalogue.exo) : {}), [terminees, catalogue])

  if (!terminees) return null
  // Prévu à venir (et aujourd'hui tant que rien n'est fait) : planning du cycle en cours ou du programme actif.
  const prevu = (iso: string) => (iso > dateISO() || (iso === dateISO() && !terminees.some((s) => s.date === iso)) ? prevuLe(catalogue.planning, catalogue.cycle, iso) : null)
  const ouverte = detail ? terminees.find((s) => s.id === detail) : undefined
  if (ouverte)
    return (
      <DetailSeance
        seance={ouverte}
        avant={terminees.filter((s) => s.debut < ouverte.debut)}
        records={records[ouverte.id] ?? 0}
        reglages={reglages}
        catalogue={catalogue}
        onRetour={() => onDetail(null)}
      />
    )

  const haut = (
    <>
      <div className="entete">
        <h1>Progression</h1>
      </div>
      <div className="segments" role="tablist">
        {VUES.map(([id, nom]) => (
          <button key={id} role="tab" aria-selected={vue === id} className={vue === id ? 'actif' : ''} onClick={() => onVue(id)}>
            {nom}
          </button>
        ))}
      </div>
    </>
  )
  if (vue !== 'journal')
    return (
      <div>
        {haut}
        {vue === 'bilan' && <Bilan catalogue={catalogue} onExo={onExo} onCorps={() => onVue('corps')} />}
        {vue === 'corps' && <Corps />}
        {vue === 'objectifs' && <Objectifs catalogue={catalogue} />}
      </div>
    )

  return (
    <div>
      {haut}

      {activite && (
        <FormActivite
          initial={activite === 'nouvelle' ? undefined : activite}
          date={activite === 'nouvelle' ? dateActivite : undefined}
          onFermer={() => (setActivite(null), setDateActivite(undefined))}
        />
      )}

      {terminees.length === 0 && activites.length === 0 && (
        <div className="faible" style={{ marginBottom: 10 }}>
          Tes séances terminées apparaîtront ici jour par jour, avec leur récap et tes records. Avance dans les mois pour voir ce qui est prévu.
        </div>
      )}
      <>
          <Calendrier seances={terminees} activites={activites} frise={catalogue.objectifs} prevu={prevu} choisi={jourChoisi} onChoix={setJourChoisi} />
          <JourChoisi
            date={jourChoisi}
            prevu={prevu(jourChoisi)}
            phase={textePhase(catalogue.objectifs, jourChoisi, (iso) => jourCourt(iso).replace(/^\S+ /, ''))}
            seances={terminees.filter((x) => x.date === jourChoisi).reverse()}
            activites={activites.filter((x) => x.date === jourChoisi)}
            pesee={peseesJour.find((x) => x.date === jourChoisi)?.poids}
            mesure={mesuresJour.find((x) => x.date === jourChoisi)}
            journal={journalJour}
            records={records}
            mieux={mieux}
            onSeance={(id) => onDetail(id)}
            onActivite={setActivite}
            onAjouter={() => (setDateActivite(jourChoisi), setActivite('nouvelle'))}
          />
      </>
    </div>
  )
}

/** Mois en calendrier : chaque jour entraîné est marqué, la phase soulignée ; un appui choisit le jour (sa carte s'affiche dessous). */
function Calendrier({ seances, activites, frise, prevu, choisi, onChoix }: { seances: Seance[]; activites: Activite[]; frise: EtapeObjectifs[]; prevu: (iso: string) => Prevu | null; choisi: string; onChoix: (iso: string) => void }) {
  // Phase de chaque jour : jusqu'à sa vraie fin, sinon jusqu'à sa fin prévue (jours à venir en pointillé), sinon aujourd'hui.
  const phases = periodes(frise)
  const phaseDuJour = (iso: string) => phases.find((p) => p.debut <= iso && iso <= finAffichee(p, dateISO()))?.phase
  const auj = new Date()
  const [mois, setMois] = useState(() => new Date(auj.getFullYear(), auj.getMonth(), 1))
  const parJour = new Map<string, Seance[]>()
  for (const s of seances) parJour.set(s.date, [...(parJour.get(s.date) ?? []), s])
  const activitesDuJour = new Map<string, Activite[]>()
  for (const a of activites) activitesDuJour.set(a.date, [...(activitesDuJour.get(a.date) ?? []), a])

  const decalage = (mois.getDay() + 6) % 7
  const nbJours = new Date(mois.getFullYear(), mois.getMonth() + 1, 0).getDate()
  const cases = [...Array(decalage).fill(null), ...Array.from({ length: nbJours }, (_, i) => new Date(mois.getFullYear(), mois.getMonth(), i + 1))]
  const duMois = seances.filter((s) => s.date.startsWith(dateISO(mois).slice(0, 7))).length
  const activitesMois = activites.filter((a) => a.date.startsWith(dateISO(mois).slice(0, 7))).length
  // Vers l'avenir : un an, pour voir le cycle, ses déloads et les phases prévues.
  const dernierMois = mois.getFullYear() * 12 + mois.getMonth() >= auj.getFullYear() * 12 + auj.getMonth() + 12
  const aller = (d: number) => {
    if (d > 0 && dernierMois) return
    setSens(d > 0 ? 'avant' : 'arriere')
    setMois(new Date(mois.getFullYear(), mois.getMonth() + d, 1))
  }
  // Glisser à gauche / à droite pour changer de mois (geste surtout horizontal).
  const depart = useRef<{ x: number; y: number } | null>(null)
  const [sens, setSens] = useState<'avant' | 'arriere' | null>(null)
  const glisse = {
    onTouchStart: (e: React.TouchEvent) => (depart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }),
    onTouchEnd: (e: React.TouchEvent) => {
      const d = depart.current
      depart.current = null
      if (!d) return
      const dx = e.changedTouches[0].clientX - d.x
      const dy = e.changedTouches[0].clientY - d.y
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) aller(dx < 0 ? 1 : -1)
    },
  }
  const aujourdhui = dateISO()
  const prevuesMois = cases.reduce((n, d) => n + (d ? (prevu(dateISO(d))?.seances.length ?? 0) : 0), 0)

  return (
    <div className="carte calendrier" {...glisse}>
      <div className="ligne entre">
        <button className="icone" onClick={() => aller(-1)} aria-label="Mois précédent">
          ‹
        </button>
        <div style={{ textAlign: 'center' }}>
          <strong style={{ textTransform: 'capitalize' }}>{mois.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</strong>
          <div className="faible">
            {duMois ? pluriel(duMois, 'séance') : prevuesMois ? '' : 'aucune séance'}
            {prevuesMois ? `${duMois ? ' · ' : ''}${prevuesMois} ${duMois ? '' : prevuesMois > 1 ? 'séances ' : 'séance '}prévue${prevuesMois > 1 ? 's' : ''}` : ''}
            {activitesMois ? ` · ${pluriel(activitesMois, 'activité')}` : ''}
          </div>
        </div>
        <button className="icone" onClick={() => aller(1)} disabled={dernierMois} aria-label="Mois suivant">
          ›
        </button>
      </div>
      <div key={dateISO(mois)} className={'grille-mois' + (sens ? ` glisse-${sens}` : '')}>
        {JOURS.map((j, i) => (
          <span key={i} className="jour-nom">
            {j}
          </span>
        ))}
        {cases.map((d, i) => {
          if (!d) return <span key={i} />
          const iso = dateISO(d)
          const s = parJour.get(iso)
          const a = activitesDuJour.get(iso)
          const ph = phaseDuJour(iso)
          const pr = prevu(iso)
          const prevue = !!pr?.seances.length
          // Séance de muscu : case pleine ; autre activité : point en dessous ; jour choisi : contour ; phase : trait sous la case.
          return (
            <button
              key={i}
              className={'jour' + (s ? ' fait' : '') + (a ? ' activite' : '') + (iso === aujourdhui ? ' aujourdhui' : '') + (iso === choisi ? ' choisi' : '') + (ph ? ` phase-${ph}` : '') + (prevue ? (pr?.deload ? ' prevu deload' : ' prevu') : '')}
              onClick={() => onChoix(iso)}
              aria-pressed={iso === choisi}
              aria-label={`${d.getDate()}${s || a || prevue ? ` : ${[...(s ?? []).map((x) => x.nom), ...(a ?? []).map((x) => typeActivite(x.type).nom), ...(prevue ? pr!.seances.map((x) => `${x.nom} prévue`) : [])].join(', ')}` : ''}`}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>
      {(() => {
        // Légende de ce qui est visible ce mois-ci : phases, séances prévues, déload.
        const debutMois = dateISO(mois)
        const finMois = dateISO(new Date(mois.getFullYear(), mois.getMonth() + 1, 0))
        const isos = cases.filter((d): d is Date => !!d).map((d) => dateISO(d))
        const prevus = isos.map(prevu).filter((p) => p?.seances.length)
        const phasesMois = PHASES.filter((x) => phases.some((p) => p.phase === x.id && p.debut <= finMois && finAffichee(p, dateISO()) >= debutMois))
        if (!phasesMois.length && !prevus.length) return null
        return (
          <div className="legende-phases faible">
            {phasesMois.map((x) => (
              <span key={x.id} className={`phase-${x.id}`}>
                {x.nom}
              </span>
            ))}
            {prevus.some((p) => !p!.deload) && <span className="legende-prevu">prévue</span>}
            {prevus.some((p) => p!.deload) && <span className="legende-prevu deload">déload</span>}
          </div>
        )
      })()}
    </div>
  )
}

/** Sommeil de la nuit d'avant et calories du jour : vus et corrigés ici, enregistrés à chaque appui. */
function NotesDuJour({ date, journal }: { date: string; journal?: JourJournal }) {
  const sommeil = journal?.sommeil
  const noter = (c: Partial<JourJournal>) => void noterJournal(date, c)
  return (
    <>
      <div className="ligne-jour">
        <span>😴 Sommeil</span>
        {sommeil === undefined ? (
          <button className="btn petit" onClick={() => noter({ sommeil: 7.5 })}>
            + Noter
          </button>
        ) : (
          <span className="ligne" style={{ gap: 6 }}>
            <button className="btn petit" aria-label="Moins" onClick={() => noter({ sommeil: Math.max(0, sommeil - 0.5) })}>
              −
            </button>
            <strong style={{ minWidth: 56, textAlign: 'center' }}>{heures(sommeil)}</strong>
            <button className="btn petit" aria-label="Plus" onClick={() => noter({ sommeil: Math.min(14, sommeil + 0.5) })}>
              +
            </button>
            <button className="btn petit discret" aria-label="Effacer le sommeil" onClick={() => noter({ sommeil: undefined })}>
              ✕
            </button>
          </span>
        )}
      </div>
      <div className="ligne-jour calories-hier">
        <span>🍽 Calories</span>
        <div className="chips">
          {CALORIES.map(([id, nom]) => (
            <button key={id} className={journal?.calories === id ? 'actif' : ''} onClick={() => noter({ calories: journal?.calories === id ? undefined : id })}>
              {nom}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

/** Le jour choisi en court : ses séances (records, exos en progrès), activités, poids et mesures. Le détail s'ouvre en touchant. */
function JourChoisi({
  date,
  prevu,
  phase,
  seances,
  activites,
  pesee,
  mesure,
  journal,
  records,
  mieux,
  onSeance,
  onActivite,
  onAjouter,
}: {
  date: string
  /** Séances prévues (jour à venir, ou aujourd'hui sans séance faite). */
  prevu: Prevu | null
  /** « Sèche depuis le 3 nov. (semaine 3 sur 12…) » */
  phase: string | null
  seances: Seance[]
  activites: Activite[]
  pesee?: number
  mesure?: { valeurs: Record<string, number> }
  /** Sommeil et calories notés ce jour-là. */
  journal?: JourJournal
  records: Record<string, number>
  mieux: Record<string, number>
  onSeance: (id: string) => void
  onActivite: (a: Activite) => void
  onAjouter: () => void
}) {
  const vide = !seances.length && !activites.length
  const nbMesures = mesure ? Object.keys(mesure.valeurs).length : 0
  return (
    <div className="carte jour-choisi">
      <strong style={{ textTransform: 'capitalize' }}>
        {date === dateISO() ? 'Aujourd’hui' : new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
      </strong>
      {phase && <div className="faible">🎯 {phase}</div>}
      {seances.map((s) => (
        <LigneSeance key={s.id} seance={s} records={records[s.id] ?? 0} mieux={mieux[s.id] ?? 0} onOuvrir={() => onSeance(s.id)} />
      ))}
      {activites.map((a) => (
        <LigneActivite key={a.id} activite={a} onOuvrir={() => onActivite(a)} />
      ))}
      {prevu?.pause && <div className="faible ligne-jour">Semaine en pause dans le cycle.</div>}
      {prevu?.seances.map((m) => (
        <div key={m.id} className="ligne-jour prevue">
          <span style={{ minWidth: 0 }}>
            <span className="faible">Prévu · </span>
            <strong>{m.nom}</strong>
            {prevu.semaine && (
              <span className="faible">
                {' '}
                · semaine {prevu.semaine} sur {prevu.total} du cycle
              </span>
            )}
          </span>
          {prevu.deload && <span className="pastille deload">Déload</span>}
        </div>
      ))}
      {vide && !prevu?.seances.length && !prevu?.pause && <div className="faible ligne-jour">{date > dateISO() ? 'Rien de prévu ce jour-là.' : 'Pas d’entraînement ce jour-là.'}</div>}
      {pesee !== undefined && (
        <div className="ligne-jour">
          <span>⚖️ Poids</span>
          <strong>{kg(pesee)} kg</strong>
        </div>
      )}
      {nbMesures > 0 && (
        <div className="ligne-jour">
          <span>📏 Mensurations</span>
          <span className="faible">{pluriel(nbMesures, 'mesure')}</span>
        </div>
      )}
      {date <= dateISO() && <NotesDuJour date={date} journal={journal} />}
      {date <= dateISO() && (
        <button className="btn discret petit lien-action" onClick={onAjouter}>
          + Ajouter une activité ce jour-là
        </button>
      )}
    </div>
  )
}

function LigneSeance({ seance, records, mieux, onOuvrir }: { seance: Seance; records: number; mieux: number; onOuvrir: () => void }) {
  const dures = seance.series.filter(estDure).length
  return (
    <button className="ligne-jour" onClick={onOuvrir}>
      <span style={{ minWidth: 0 }}>
        <strong>{seance.nom}</strong>
        <span className="faible">
          {' '}
          · {duree(dureeReelle(seance))} · {dures} série{dures > 1 ? 's' : ''} dure{dures > 1 ? 's' : ''}
        </span>
        {(records > 0 || mieux > 0 || seance.deload) && (
          <span className="ligne wrap" style={{ gap: 6, marginTop: 4 }}>
            {records > 0 && <span className="pastille ok">🏆 {pluriel(records, 'record')}</span>}
            {mieux > 0 && <span className="pastille">↑ {mieux} exo{mieux > 1 ? 's' : ''} mieux que la dernière fois</span>}
            {seance.deload && <span className="pastille">Déload</span>}
          </span>
        )}
      </span>
      <span className="muted">›</span>
    </button>
  )
}

function LigneActivite({ activite, onOuvrir }: { activite: Activite; onOuvrir: () => void }) {
  const t = typeActivite(activite.type)
  return (
    <button className="ligne-jour" onClick={onOuvrir}>
      <span style={{ minWidth: 0 }}>
        <strong>
          {t.emoji} {t.nom}
        </strong>
        <span className="faible">
          {' '}
          · {duree(activite.duree * 60000)} · intensité {activite.intensite}/10
        </span>
      </span>
      <span className="muted">✎</span>
    </button>
  )
}

function DetailSeance({
  seance,
  avant,
  records,
  reglages,
  catalogue,
  onRetour,
}: {
  seance: Seance
  avant: Seance[]
  records: number
  reglages: Reglage[]
  catalogue: Catalogue
  onRetour: () => void
}) {
  const [edition, setEdition] = useState<Serie | null>(null)
  /** Exercice auquel on ajoute une série oubliée. */
  const [ajout, setAjout] = useState<string | null>(null)
  useRetour(true, onRetour)
  const passes = (seance.passes ?? []).map((id) => catalogue.exo(id).nom)

  const supprimer = async () => {
    if (!(await confirmer('La séance et toutes ses séries seront effacées de ton historique.', { titre: `Supprimer « ${seance.nom} » du ${jourCourt(seance.date)} ?`, oui: 'Supprimer la séance', danger: true }))) return
    await db.seances.delete(seance.id)
    onRetour()
  }

  return (
    <div>
      <div className="entete">
        <button className="btn" onClick={onRetour} aria-label="Retour">
          ←
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2>{seance.nom}</h2>
          <div className="faible" style={{ textTransform: 'capitalize' }}>
            {dateLongue(seance)}
          </div>
        </div>
      </div>

      <div className="carte">
        <ResumeSeance seance={seance} exo={catalogue.exo} />
        <div className="ligne wrap" style={{ gap: 6, marginTop: 6 }}>
          {records > 0 && <span className="pastille ok">🏆 {pluriel(records, 'record')}</span>}
          {seance.ressenti && <span className="pastille">Ressenti {seance.ressenti}/5</span>}
          {seance.energie && <span className="pastille">Énergie {seance.energie}/5</span>}
        </div>
        {passes.length > 0 && <div className="faible" style={{ marginTop: 8 }}>Passés ce jour-là : {passes.join(', ')}</div>}
      </div>

      <h3 style={{ margin: '18px 0 4px' }}>Récap par exercice</h3>
      <div className="faible" style={{ marginBottom: 10 }}>
        Comparé à la séance d’avant. Touche une série pour la corriger.
      </div>
      <RecapExos
        seance={seance}
        avant={avant}
        reglages={reglages}
        catalogue={catalogue}
        onSerie={setEdition}
        basExo={(exo) => (
          <button className="btn discret petit lien-action" onClick={() => setAjout(exo.id)}>
            + Ajouter une série oubliée
          </button>
        )}
      />

      <button className="btn discret danger plein" style={{ margin: '12px 0 24px' }} onClick={supprimer}>
        Supprimer cette séance
      </button>

      {edition && (
        <CorrectionSerie seance={seance} serie={edition} avant={avant} reglages={reglages} catalogue={catalogue} onFermer={() => setEdition(null)} />
      )}
      {ajout && <CorrectionSerie seance={seance} exoId={ajout} avant={avant} reglages={reglages} catalogue={catalogue} onFermer={() => setAjout(null)} />}
    </div>
  )
}

/** Corriger une série d'une séance passée, ou en ajouter une oubliée (`exoId` sans `serie`) : la même saisie qu'en séance. */
function CorrectionSerie({
  seance,
  serie,
  exoId,
  avant,
  reglages,
  catalogue,
  onFermer,
}: {
  seance: Seance
  serie?: Serie
  exoId?: string
  avant: Seance[]
  reglages: Reglage[]
  catalogue: Catalogue
  onFermer: () => void
}) {
  useRetour(true, onFermer)
  const id = serie?.exoId ?? exoId!
  const exo = exoAvecReglages(catalogue.exo(id), reglages)
  const plan = seance.exercices.find((p) => p.exoId === id) ?? planParDefaut(exo)
  const faites = seance.series.filter((x) => x.exoId === id)
  // Série ajoutée : juste après la dernière de l'exercice, pour ne pas fausser les durées.
  const heure = (faites[faites.length - 1]?.heure ?? seance.fin ?? seance.debut) + 60000
  return (
    <div className="modal-fond" onClick={onFermer}>
      <div className="modal pile" onClick={(e) => e.stopPropagation()}>
        <div className="faible">
          {exo.nom} · {jourCourt(seance.date)}
        </div>
        {!serie && <h3>Série oubliée · S{faites.length + 1}</h3>}
        <Editeur
          seance={seance}
          plan={plan}
          exo={exo}
          sugg={suggestionPour(exo, plan, avant)}
          index={serie ? faites.findIndex((x) => x.id === serie.id) : faites.length}
          total={serie ? faites.length : faites.length + 1}
          faites={faites}
          edition={serie}
          heure={heure}
          reposRestant={0}
          verrou={false}
          onFini={onFermer}
          onAnnulerEdition={onFermer}
        />
      </div>
    </div>
  )
}
