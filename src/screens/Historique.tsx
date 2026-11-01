import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useRef, useState } from 'react'
import { Camera, ChevronLeft, ChevronRight, Dumbbell, Flame, Moon, Ruler, Scale } from 'lucide-react'
import type { Catalogue } from '../catalogue'
import { Editeur } from '../components/CarteExo'
import RecapExos, { ResumeSeance } from '../components/RecapSeance'
import { db, exoAvecReglages } from '../db'
import { dateISO, duree, estDure, kg } from '../lib/calc'
import { dureeReelle, mieuxParSeance, recordsParSeance } from '../lib/historique'
import { useRetour } from '../lib/nav'
import { suggestionPour } from '../lib/progression'
import type { JourJournal, Mesure, PhotoCorps, Reglage, Seance, Serie } from '../types'
import { CALORIES, HEURES, heures, noterJournal } from '../components/JournalMatin'
import { MESURES, clesDe, nomCle } from '../data/mesures'
import { PlanchePhotos, POSES } from './Photos'
import Bilan from './Bilan'
import { finAffichee, nomPhase, periodes, textePhase, type EtapeObjectifs } from '../lib/objectifs'
import { prevuLe } from '../lib/cycle'
import { objectifDuJour } from '../lib/nutrition'

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

export type VueProgression = 'bilan' | 'journal'

const VUES: [VueProgression, string][] = [
  ['bilan', 'Bilan'],
  ['journal', 'Journal'],
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
  /** Ouvre l'onglet Corps (poids, mensurations, photos). */
  onCorps?: () => void
}

export default function Historique({ catalogue, detail, onDetail, vue, onVue, onExo, onCorps }: Props) {
  const terminees = useLiveQuery(() => db.seances.orderBy('debut').reverse().filter((s) => !s.enCours).toArray(), [])
  const reglages = useLiveQuery(() => db.reglages.toArray(), [], [])
  /** Jour choisi dans le calendrier (aujourd'hui par défaut). */
  const [jourChoisi, setJourChoisi] = useState(dateISO())
  const mesuresJour = useLiveQuery(() => db.mesures.toArray(), [], [])
  const peseesJour = useLiveQuery(() => db.pesees.toArray(), [], [])
  const journalJour = useLiveQuery(() => db.journal.get(jourChoisi), [jourChoisi])
  // Photos du jour choisi, et celles à mettre à côté : les plus récentes, ou celles d'avant si ce sont elles.
  // Chargées à la demande : elles sont lourdes.
  const photosJour = useLiveQuery(
    async () => {
      const dates = (await db.photos.orderBy('date').uniqueKeys()) as string[]
      const derniere = dates[dates.length - 1] === jourChoisi ? dates.filter((d) => d < jourChoisi).pop() : dates[dates.length - 1]
      return { derniere, liste: await db.photos.where('date').anyOf([jourChoisi, derniere ?? jourChoisi]).toArray() }
    },
    [jourChoisi],
    { derniere: undefined, liste: [] as PhotoCorps[] },
  )
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
  if (vue === 'bilan')
    return (
      <div>
        {haut}
        <Bilan catalogue={catalogue} onExo={onExo} onCorps={onCorps} />
      </div>
    )

  return (
    <div>
      {haut}

      {terminees.length === 0 && (
        <div className="faible" style={{ marginBottom: 10 }}>
          Tes séances terminées apparaîtront ici jour par jour, avec leur récap et tes records. Avance dans les mois pour voir ce qui est prévu.
        </div>
      )}
      <>
          <Calendrier seances={terminees} frise={catalogue.objectifs} prevu={prevu} choisi={jourChoisi} onChoix={setJourChoisi} />
          <JourChoisi
            date={jourChoisi}
            catalogue={catalogue}
            prevu={prevu(jourChoisi)}
            phase={textePhase(catalogue.objectifs, jourChoisi, (iso) => jourCourt(iso).replace(/^\S+ /, ''))}
            seances={terminees.filter((x) => x.date === jourChoisi).reverse()}
            pesee={peseesJour.find((x) => x.date === jourChoisi)?.poids}
            mesure={mesuresJour.find((x) => x.date === jourChoisi)}
            mesures={mesuresJour}
            photos={photosJour.liste}
            dernieresPhotos={photosJour.derniere}
            journal={journalJour}
            records={records}
            mieux={mieux}
            onSeance={(id) => onDetail(id)}
          />
      </>
    </div>
  )
}

/** Mois en calendrier : chaque jour entraîné est marqué, la phase soulignée ; un appui choisit le jour (sa carte s'affiche dessous). */
function Calendrier({ seances, frise, prevu, choisi, onChoix }: { seances: Seance[]; frise: EtapeObjectifs[]; prevu: (iso: string) => Prevu | null; choisi: string; onChoix: (iso: string) => void }) {
  // Phase de chaque jour : jusqu'à sa vraie fin, sinon jusqu'à sa fin prévue (jours à venir en pointillé), sinon aujourd'hui.
  const phases = periodes(frise)
  const phaseDuJour = (iso: string) => phases.find((p) => p.debut <= iso && iso <= finAffichee(p, dateISO()))?.phase
  const auj = new Date()
  // Au retour d'une fiche, on revient sur le mois du jour choisi (pas sur le mois en cours).
  const [mois, setMois] = useState(() => {
    const c = new Date(choisi + 'T12:00:00')
    return new Date(c.getFullYear(), c.getMonth(), 1)
  })
  const parJour = new Map<string, Seance[]>()
  for (const s of seances) parJour.set(s.date, [...(parJour.get(s.date) ?? []), s])

  const decalage = (mois.getDay() + 6) % 7
  const nbJours = new Date(mois.getFullYear(), mois.getMonth() + 1, 0).getDate()
  const cases = [...Array(decalage).fill(null), ...Array.from({ length: nbJours }, (_, i) => new Date(mois.getFullYear(), mois.getMonth(), i + 1))]
  const duMois = seances.filter((s) => s.date.startsWith(dateISO(mois).slice(0, 7))).length
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
  const phaseMois = phases.find((p) => p.debut <= dateISO(mois) && dateISO(mois) <= finAffichee(p, dateISO()))?.phase ?? phases.find((p) => p.debut <= aujourdhui && aujourdhui <= finAffichee(p, dateISO()))?.phase

  return (
    <div className="carte calendrier" style={{ padding: '16px', borderRadius: 18 }} {...glisse}>
      <div className="ligne entre" style={{ marginBottom: 6 }}>
        <button className="icone" onClick={() => aller(-1)} aria-label="Mois précédent" style={{ color: 'var(--text-secondary)' }}>
          <ChevronLeft size={22} strokeWidth={2} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <strong style={{ textTransform: 'capitalize', fontSize: '1.1rem', color: 'var(--texte)' }}>
            {mois.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </strong>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <span className="faible" style={{ fontSize: '0.8rem' }}>
              {duMois ? pluriel(duMois, 'séance') : prevuesMois ? '' : 'aucune séance'}
              {prevuesMois ? `${duMois ? ' · ' : ''}${prevuesMois} ${duMois ? '' : prevuesMois > 1 ? 'séances ' : 'séance '}prévue${prevuesMois > 1 ? 's' : ''}` : ''}
            </span>
            {phaseMois && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.25)',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: '#22c55e',
                }}
              >
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e' }} />
                <span>{nomPhase(phaseMois)}</span>
              </span>
            )}
          </div>
        </div>
        <button className="icone" onClick={() => aller(1)} disabled={dernierMois} aria-label="Mois suivant" style={{ color: 'var(--text-secondary)' }}>
          <ChevronRight size={22} strokeWidth={2} />
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
          const ph = phaseDuJour(iso)
          const pr = prevu(iso)
          const prevue = !!pr?.seances.length
          // Séance de muscu : case pleine ; jour choisi : contour.
          return (
            <button
              key={i}
              className={'jour' + (s ? ' fait' : '') + (iso === aujourdhui ? ' aujourdhui' : '') + (iso === choisi ? ' choisi' : '') + (ph ? ` phase-${ph}` : '') + (prevue ? (pr?.deload ? ' prevu deload' : ' prevu') : '')}
              onClick={() => onChoix(iso)}
              aria-pressed={iso === choisi}
              aria-label={`${d.getDate()}${s || prevue ? ` : ${[...(s ?? []).map((x) => x.nom), ...(prevue ? pr!.seances.map((x) => `${x.nom} prévue`) : [])].join(', ')}` : ''}`}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Écart d'une valeur de mensuration avec la prise précédente de cette même mesure (« −1 cm »). */
function ecartMesure(mesures: Mesure[], date: string, cle: string) {
  const avant = mesures.filter((m) => m.date < date && m.valeurs[cle] !== undefined).sort((a, b) => b.date.localeCompare(a.date))[0]
  const ici = mesures.find((m) => m.date === date)?.valeurs[cle]
  if (!avant || ici === undefined) return null
  const d = Math.round((ici - avant.valeurs[cle]) * 10) / 10
  return { texte: `${d > 0 ? '+' : d < 0 ? '−' : '±'}${kg(Math.abs(d))}`, depuis: avant.date }
}

/** Toutes les mensurations d'un jour, avec l'écart depuis la prise précédente de chacune. */
function FenetreMesures({ date, mesures, onFermer }: { date: string; mesures: Mesure[]; onFermer: () => void }) {
  useRetour(true, onFermer)
  const valeurs = mesures.find((m) => m.date === date)?.valeurs ?? {}
  const cles = MESURES.flatMap(clesDe).filter((c) => valeurs[c] !== undefined)
  const depuis = [...new Set(cles.map((c) => ecartMesure(mesures, date, c)?.depuis).filter(Boolean))]
  return (
    <div className="modal-fond" onClick={onFermer}>
      <div className="modal pile" onClick={(e) => e.stopPropagation()}>
        <h3>📏 Mensurations · {jourCourt(date)}</h3>
        {depuis.length === 1 && <div className="faible">Écart avec la prise du {jourCourt(depuis[0]!)}</div>}
        <div>
          {cles.map((c) => {
            const e = ecartMesure(mesures, date, c)
            return (
              <div key={c} className="ligne-mesure">
                <span>{nomCle(c)}</span>
                <span>
                  <strong>{kg(valeurs[c])} cm</strong>
                  {e && (
                    <span className="faible">
                      {' '}
                      ({e.texte}
                      {depuis.length > 1 ? ` depuis le ${jourCourt(e.depuis)}` : ''})
                    </span>
                  )}
                </span>
              </div>
            )
          })}
        </div>
        <button className="btn plein" onClick={onFermer}>
          Fermer
        </button>
      </div>
    </div>
  )
}

/** Le jour choisi en court : ses séances (records, exos en progrès), activités, poids et mesures. Le détail s'ouvre en touchant. */
function JourChoisi({
  date,
  catalogue,
  prevu,
  seances,
  pesee,
  mesure,
  mesures,
  photos,
  dernieresPhotos,
  journal,
  records,
  mieux,
  onSeance,
}: {
  date: string
  catalogue: Catalogue
  /** Séances prévues (jour à venir, ou aujourd'hui sans séance faite). */
  prevu: Prevu | null
  phase: string | null
  seances: Seance[]
  pesee?: number
  mesure?: { valeurs: Record<string, number> }
  /** Toutes les mensurations, pour l'écart avec la prise d'avant. */
  mesures: Mesure[]
  /** Photos de ce jour-là et de la date à mettre à côté pour comparer (les plus récentes, ou celles d'avant). */
  photos: PhotoCorps[]
  dernieresPhotos?: string
  /** Sommeil et calories notés ce jour-là. */
  journal?: JourJournal
  records: Record<string, number>
  mieux: Record<string, number>
  onSeance: (id: string) => void
}) {
  const vide = !seances.length
  const [voirMesures, setVoirMesures] = useState(false)
  const [voirPhotos, setVoirPhotos] = useState(false)
  const [saisieSommeil, setSaisieSommeil] = useState(false)
  const [saisieCalories, setSaisieCalories] = useState(false)

  // Mensurations : la taille d'abord (la plus parlante), sinon la première prise ; l'écart avec la fois d'avant.
  const clesMesure = mesure ? MESURES.flatMap(clesDe).filter((c) => mesure.valeurs[c] !== undefined) : []
  const cleUne = clesMesure.includes('taille') ? 'taille' : clesMesure[0]
  const ecartUne = cleUne ? ecartMesure(mesures, date, cleUne) : null
  const poses = POSES.flatMap((p) => photos.filter((x) => x.date === date && x.pose === p.id))
  const objectif = objectifDuJour(catalogue.objectifs, date)
  const noter = (c: Partial<JourJournal>) => noterJournal(date, c)

  return (
    <div className="carte jour-choisi" style={{ padding: '16px', borderRadius: 18 }}>
      <div className="faible" style={{ fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 2 }}>
        Détail du jour
      </div>
      <strong style={{ textTransform: 'capitalize', fontSize: '1.25rem', fontWeight: 800, color: 'var(--texte)', display: 'block', marginBottom: 12 }}>
        {date === dateISO() ? 'Aujourd’hui' : new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
      </strong>

      {/* Séances réalisées */}
      {seances.map((s) => (
        <LigneSeance key={s.id} seance={s} records={records[s.id] ?? 0} mieux={mieux[s.id] ?? 0} onOuvrir={() => onSeance(s.id)} />
      ))}

      {/* Séances prévues */}
      {prevu?.pause && <div className="faible" style={{ padding: '8px 0' }}>Semaine en pause dans le cycle.</div>}
      {prevu?.seances.map((m) => (
        <div
          key={m.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            borderRadius: 14,
            background: 'var(--subcard-gradient)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            marginBottom: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: 'var(--text-secondary)' }}><Dumbbell size={18} strokeWidth={1.75} /></span>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--texte)' }}>{m.nom}</div>
              <div className="faible" style={{ fontSize: '0.8rem', marginTop: 1 }}>
                Prévu{prevu.semaine ? ` · Semaine ${prevu.semaine}/${prevu.total}` : ''}
              </div>
            </div>
          </div>
          {prevu.deload && (
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--finisseur)', background: 'rgba(197, 139, 255, 0.12)', padding: '2px 8px', borderRadius: 6 }}>
              Déload
            </span>
          )}
        </div>
      ))}

      {vide && !prevu?.seances.length && !prevu?.pause && (
        <div className="faible" style={{ padding: '8px 0 12px', fontSize: '0.9rem' }}>
          {date > dateISO() ? 'Repos · Rien de prévu ce jour-là.' : date === dateISO() ? 'Repos · Pas encore d’entraînement aujourd’hui.' : 'Repos ce jour-là.'}
        </div>
      )}

      {/* Grille 2x2 des métriques du jour */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 4 }}>
        {/* Tuile Poids */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '12px 14px',
            borderRadius: 14,
            background: 'var(--subcard-gradient)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            minHeight: 74,
          }}
        >
          <div style={{ color: 'var(--text-secondary)' }}><Scale size={18} strokeWidth={1.75} /></div>
          <div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--texte)' }}>
              {pesee !== undefined ? `${kg(pesee)} kg` : <span className="faible">—</span>}
            </div>
            <div className="faible" style={{ fontSize: '0.78rem', marginTop: 1, color: 'var(--text-secondary)' }}>Poids</div>
          </div>
        </div>

        {/* Tuile Mensurations (Taille) */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => cleUne && setVoirMesures(true)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '12px 14px',
            borderRadius: 14,
            background: 'var(--subcard-gradient)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            minHeight: 74,
            cursor: cleUne ? 'pointer' : 'default',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
            <Ruler size={18} strokeWidth={1.75} />
            {cleUne && <ChevronRight size={14} strokeWidth={1.75} className="muted" />}
          </div>
          <div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--texte)' }}>
              {cleUne && mesure ? `${kg(mesure.valeurs[cleUne])} cm` : <span className="faible">—</span>}
              {ecartUne && <span className="faible" style={{ fontSize: '0.78rem', fontWeight: 500, marginLeft: 4 }}>({ecartUne.texte})</span>}
            </div>
            <div className="faible" style={{ fontSize: '0.78rem', marginTop: 1, color: 'var(--text-secondary)' }}>
              {cleUne ? nomCle(cleUne) : 'Mensurations'}
            </div>
          </div>
        </div>

        {/* Tuile Sommeil */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setSaisieSommeil(!saisieSommeil)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '12px 14px',
            borderRadius: 14,
            background: 'var(--subcard-gradient)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            minHeight: 74,
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#8e8eff' }}>
            <Moon size={18} strokeWidth={1.75} />
            <span style={{ fontSize: '0.75rem', opacity: 0.6, color: 'var(--text-secondary)' }}>✎</span>
          </div>
          <div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--texte)' }}>
              {journal?.sommeil !== undefined ? heures(journal.sommeil) : <span className="faible">—</span>}
            </div>
            <div className="faible" style={{ fontSize: '0.78rem', marginTop: 1, color: 'var(--text-secondary)' }}>Sommeil</div>
          </div>
        </div>

        {/* Tuile Calories */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setSaisieCalories(!saisieCalories)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '12px 14px',
            borderRadius: 14,
            background: 'var(--subcard-gradient)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            minHeight: 74,
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#f97316' }}>
            <Flame size={18} strokeWidth={1.75} />
            <span style={{ fontSize: '0.75rem', opacity: 0.6, color: 'var(--text-secondary)' }}>✎</span>
          </div>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--texte)' }}>
              {journal?.calories ? (
                CALORIES.find(([id]) => id === journal.calories)?.[1]
              ) : objectif?.kcal ? (
                `${objectif.kcal.toLocaleString('fr-FR')} kcal`
              ) : (
                <span className="faible">—</span>
              )}
            </div>
            <div className="faible" style={{ fontSize: '0.78rem', marginTop: 1, color: 'var(--text-secondary)' }}>Calories</div>
          </div>
        </div>
      </div>

      {/* Saisie Sommeil dépliée */}
      {saisieSommeil && (
        <div style={{ marginTop: 8, padding: '10px 12px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div className="ligne entre" style={{ marginBottom: 6 }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Sommeil cette nuit</span>
            <button className="btn discret petit" style={{ padding: '0 4px', height: 24, fontSize: '0.75rem' }} onClick={() => setSaisieSommeil(false)}>
              Fermer
            </button>
          </div>
          <div className="rpe" style={{ gridTemplateColumns: `repeat(${HEURES.length}, 1fr)` }}>
            {HEURES.map(([h, txt]) => (
              <button key={h} className={journal?.sommeil === h ? 'actif' : ''} onClick={() => void noter({ sommeil: h }).then(() => setSaisieSommeil(false))}>
                {txt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Saisie Calories dépliée */}
      {saisieCalories && (
        <div style={{ marginTop: 8, padding: '10px 12px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div className="ligne entre" style={{ marginBottom: 6 }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Calories ce jour-là</span>
            <button className="btn discret petit" style={{ padding: '0 4px', height: 24, fontSize: '0.75rem' }} onClick={() => setSaisieCalories(false)}>
              Fermer
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CALORIES.map(([id, nom]) => (
              <button
                key={id}
                type="button"
                style={{
                  padding: '5px 12px',
                  borderRadius: 20,
                  fontSize: '0.8rem',
                  fontWeight: journal?.calories === id ? 600 : 400,
                  background: journal?.calories === id ? 'rgba(249, 115, 22, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid ' + (journal?.calories === id ? 'var(--accent-orange)' : 'rgba(255, 255, 255, 0.08)'),
                  color: journal?.calories === id ? 'var(--accent-orange)' : 'var(--texte)',
                  cursor: 'pointer',
                }}
                onClick={() => void noter({ calories: journal?.calories === id ? undefined : id }).then(() => setSaisieCalories(false))}
              >
                {nom}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Photos */}
      {poses.length > 0 && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setVoirPhotos(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            borderRadius: 14,
            background: 'var(--subcard-gradient)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            marginTop: 10,
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: 'var(--text-secondary)' }}><Camera size={18} strokeWidth={1.75} /></span>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--texte)' }}>Photos du jour</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {poses.map((p) => (
                <img key={p.id} src={p.image} alt={p.pose} style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} />
              ))}
            </div>
            <ChevronRight size={16} strokeWidth={1.75} className="muted" />
          </div>
        </div>
      )}

      {voirMesures && <FenetreMesures date={date} mesures={mesures} onFermer={() => setVoirMesures(false)} />}
      {voirPhotos && <PlanchePhotos photos={photos} dates={[date]} comparerAvec={dernieresPhotos} onFermer={() => setVoirPhotos(false)} />}
    </div>
  )
}

function LigneSeance({ seance, records, mieux, onOuvrir }: { seance: Seance; records: number; mieux: number; onOuvrir: () => void }) {
  const dures = seance.series.filter(estDure).length
  return (
    <button
      type="button"
      onClick={onOuvrir}
      style={{
        width: '100%',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 14px',
        borderRadius: 14,
        background: 'var(--subcard-gradient)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        marginBottom: 10,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: 'var(--accent-orange)' }}><Dumbbell size={18} strokeWidth={1.75} /></span>
        <div>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--texte)' }}>{seance.nom}</div>
          <div className="faible" style={{ fontSize: '0.8rem', marginTop: 1 }}>
            {duree(dureeReelle(seance))} · {dures} série{dures > 1 ? 's' : ''} dure{dures > 1 ? 's' : ''}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {(records > 0 || mieux > 0) && (
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#22c55e', background: 'rgba(34, 197, 94, 0.1)', padding: '2px 8px', borderRadius: 6 }}>
            {records > 0 ? `${records} record${records > 1 ? 's' : ''}` : `${mieux} mieux`}
          </span>
        )}
        <ChevronRight size={16} strokeWidth={1.75} className="muted" />
      </div>
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
  // Correction d'une série : fermer (appui à côté, retour) l'enregistre. Série oubliée : on ferme sans l'ajouter.
  const fermeture = useRef<(() => void) | null>(null)
  const fermer = () => (fermeture.current ? fermeture.current() : onFermer())
  useRetour(true, fermer)
  const id = serie?.exoId ?? exoId!
  const exo = exoAvecReglages(catalogue.exo(id), reglages)
  const plan = seance.exercices.find((p) => p.exoId === id) ?? planParDefaut(exo)
  const faites = seance.series.filter((x) => x.exoId === id)
  // Série ajoutée : juste après la dernière de l'exercice, pour ne pas fausser les durées.
  const heure = (faites[faites.length - 1]?.heure ?? seance.fin ?? seance.debut) + 60000
  return (
    <div className="modal-fond" onClick={fermer}>
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
          fermeture={serie ? fermeture : undefined}
        />
      </div>
    </div>
  )
}
