import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import type { Catalogue } from '../catalogue'
import { Editeur } from '../components/CarteExo'
import RecapExos, { ResumeSeance } from '../components/RecapSeance'
import { db, exoAvecReglages } from '../db'
import { chargeQte, dateISO, kgSouleves, duree, estDure, kg, lundi } from '../lib/calc'
import { bilan, dureeReelle, meilleureSerie, parSemaine, recordsParSeance, semaineDe, type Bilan } from '../lib/historique'
import { useRetour } from '../lib/nav'
import { suggestionPour } from '../lib/progression'
import type { Activite, Reglage, Seance, Serie } from '../types'
import BilanPartage from '../components/BilanPartage'
import FormActivite from '../components/FormActivite'
import { kcalActivite, typeActivite, INTENSITES } from '../data/activites'
import { Mesures, OngletPoids } from './Corps'
import Photos from './Photos'
import { planParDefaut } from './Seances'
import { confirmer } from '../components/Dialogues'

const JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const dateLongue = (s: Seance) =>
  new Date(s.debut).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) +
  ' · ' +
  new Date(s.debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
const jourCourt = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

export type VueProgression = 'seances' | 'mesures' | 'photos' | 'poids'

const VUES: [VueProgression, string][] = [
  ['seances', 'Séances'],
  ['mesures', 'Mesures'],
  ['photos', 'Photos'],
  ['poids', 'Poids'],
]

interface Props {
  catalogue: Catalogue
  vue: VueProgression
  onVue: (v: VueProgression) => void
  /** Séance ouverte en détail (aussi depuis l'accueil). */
  detail: string | null
  onDetail: (id: string | null) => void
}

export default function Historique({ catalogue, detail, onDetail, vue, onVue }: Props) {
  const terminees = useLiveQuery(() => db.seances.orderBy('debut').reverse().filter((s) => !s.enCours).toArray(), [])
  const reglages = useLiveQuery(() => db.reglages.toArray(), [], [])
  const [semaines, setSemaines] = useState(6)
  const activites = useLiveQuery(() => db.activites.orderBy('date').reverse().toArray(), [], [])
  const poids = useLiveQuery(() => db.pesees.orderBy('date').last(), [])
  /** Activité ouverte (ou 'nouvelle'). */
  const [activite, setActivite] = useState<Activite | 'nouvelle' | null>(null)
  const [bilanPartage, setBilanPartage] = useState(false)
  const records = useMemo(() => (terminees ? recordsParSeance(terminees, catalogue.exo) : {}), [terminees, catalogue])

  if (!terminees) return null
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
  if (vue !== 'seances')
    return (
      <div>
        {haut}
        {vue === 'mesures' && <Mesures />}
        {vue === 'photos' && <Photos />}
        {vue === 'poids' && <OngletPoids />}
      </div>
    )

  // Semaines avec des séances ou des activités, de la plus récente à la plus ancienne.
  const parSem = parSemaine(terminees)
  const groupes = [...new Set([...parSem.map((g) => g.lundi), ...activites.map((a) => semaineDe(a.date))])]
    .sort((a, b) => b.localeCompare(a))
    .map((l) => ({ lundi: l, seances: parSem.find((g) => g.lundi === l)?.seances ?? [], activites: activites.filter((a) => semaineDe(a.date) === l) }))
  const cetteSemaine = lundi()
  const precedente = dateISO(new Date(Date.parse(cetteSemaine + 'T12:00:00') - 7 * 86400000))
  const bilanDe = (l: string) => bilan(groupes.find((g) => g.lundi === l)?.seances ?? [], records, catalogue.exo)
  const activitesDe = (l: string) => activites.filter((a) => semaineDe(a.date) === l)

  return (
    <div>
      {haut}

      <div className="ligne" style={{ marginBottom: 12 }}>
        <button className="btn" style={{ flex: 1 }} onClick={() => setActivite('nouvelle')}>
          + Autre activité
        </button>
        <button className="btn" style={{ flex: 1 }} onClick={() => setBilanPartage(true)}>
          📋 Bilan détaillé
        </button>
      </div>
      {bilanPartage && <BilanPartage catalogue={catalogue} onFermer={() => setBilanPartage(false)} />}
      {activite && <FormActivite initial={activite === 'nouvelle' ? undefined : activite} onFermer={() => setActivite(null)} />}

      {terminees.length === 0 && activites.length === 0 ? (
        <div className="carte pile">
          <h3>Pas encore de séance</h3>
          <div className="faible">Tes séances terminées apparaîtront ici, avec leur récap complet et tes records.</div>
        </div>
      ) : (
        <>
          <Calendrier seances={terminees} activites={activites} onSeance={(s) => onDetail(s.id)} onActivite={setActivite} />
          <BilanSemaine actuel={bilanDe(cetteSemaine)} avant={bilanDe(precedente)} activites={activitesDe(cetteSemaine)} activitesAvant={activitesDe(precedente)} />

          {groupes.slice(0, semaines).map((g) => {
            const b = bilan(g.seances, records, catalogue.exo)
            return (
              <div key={g.lundi}>
                <div className="semaine-titre">
                  <strong>{g.lundi === cetteSemaine ? 'Cette semaine' : `Semaine du ${jourCourt(g.lundi).replace(/^\S+ /, '')}`}</strong>
                  <span className="faible">
                    {[b.seances ? pluriel(b.seances, 'séance') : '', g.activites.length ? pluriel(g.activites.length, 'activité') : ''].filter(Boolean).join(' · ')} ·{' '}
                    {duree(b.temps + g.activites.reduce((a, x) => a + x.duree * 60000, 0))}
                  </span>
                </div>
                {[...g.seances.map((s) => ({ date: s.date, t: s.debut, s })), ...g.activites.map((a) => ({ date: a.date, t: 0, a }))]
                  .sort((x, y) => y.date.localeCompare(x.date) || y.t - x.t)
                  .map((e) =>
                    'a' in e ? (
                      <CarteActivite key={e.a.id} activite={e.a} poids={poids?.poids} onOuvrir={() => setActivite(e.a)} />
                    ) : (
                      <CarteSeance key={e.s.id} seance={e.s} records={records[e.s.id] ?? 0} reglages={reglages} catalogue={catalogue} onOuvrir={() => onDetail(e.s.id)} />
                    )
                  )}
              </div>
            )
          })}
          {groupes.length > semaines && (
            <button className="btn plein" style={{ marginBottom: 16 }} onClick={() => setSemaines((n) => n + 8)}>
              Semaines précédentes
            </button>
          )}
        </>
      )}
    </div>
  )
}

/** Mois en calendrier : chaque jour entraîné est marqué, un appui ouvre la séance. */
function Calendrier({
  seances,
  activites,
  onSeance,
  onActivite,
}: {
  seances: Seance[]
  activites: Activite[]
  onSeance: (s: Seance) => void
  onActivite: (a: Activite) => void
}) {
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
  const estMoisCourant = mois.getFullYear() === auj.getFullYear() && mois.getMonth() === auj.getMonth()
  const aller = (d: number) => setMois(new Date(mois.getFullYear(), mois.getMonth() + d, 1))
  const aujourdhui = dateISO()

  return (
    <div className="carte calendrier">
      <div className="ligne entre">
        <button className="icone" onClick={() => aller(-1)} aria-label="Mois précédent">
          ‹
        </button>
        <div style={{ textAlign: 'center' }}>
          <strong style={{ textTransform: 'capitalize' }}>{mois.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</strong>
          <div className="faible">
            {duMois ? pluriel(duMois, 'séance') : 'aucune séance'}
            {activitesMois ? ` · ${pluriel(activitesMois, 'activité')}` : ''}
          </div>
        </div>
        <button className="icone" onClick={() => aller(1)} disabled={estMoisCourant} aria-label="Mois suivant">
          ›
        </button>
      </div>
      <div className="grille-mois">
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
          // Séance de muscu : case pleine ; autre activité : point en dessous.
          return (
            <button
              key={i}
              className={'jour' + (s ? ' fait' : '') + (a ? ' activite' : '') + (iso === aujourdhui ? ' aujourdhui' : '')}
              disabled={!s && !a}
              onClick={() => (s ? onSeance(s[0]) : a && onActivite(a[0]))}
              aria-label={s || a ? `${d.getDate()} : ${[...(s ?? []).map((x) => x.nom), ...(a ?? []).map((x) => typeActivite(x.type).nom)].join(', ')}` : undefined}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Cette semaine comparée à la précédente. */
function BilanSemaine({ actuel, avant, activites, activitesAvant }: { actuel: Bilan; avant: Bilan; activites: Activite[]; activitesAvant: Activite[] }) {
  const minutes = (l: Activite[]) => l.reduce((a, x) => a + x.duree, 0)
  // Corps : poids moyen de la semaine et dernière taille mesurée, comparés à la semaine d'avant.
  const pesees = useLiveQuery(() => db.pesees.toArray(), [], [])
  const mesures = useLiveQuery(() => db.mesures.orderBy('date').toArray(), [], [])
  const cetteSemaine = lundi()
  const precedente = dateISO(new Date(Date.parse(cetteSemaine + 'T12:00:00') - 7 * 86400000))
  const moyenne = (debut: string, fin: string) => {
    const l = pesees.filter((p) => p.date >= debut && p.date < fin)
    return l.length ? l.reduce((a, p) => a + p.poids, 0) / l.length : null
  }
  const poids = moyenne(cetteSemaine, '9999')
  const poidsAvant = moyenne(precedente, cetteSemaine)
  const tailles = mesures.filter((m) => m.valeurs.taille !== undefined)
  const taille = tailles.filter((m) => m.date >= cetteSemaine).pop()
  const tailleAvant = taille && [...tailles].reverse().find((m) => m.date < taille.date)
  const ecart = (d: number, u: string) => ` (${d > 0 ? '+' : d < 0 ? '−' : '±'}${kg(Math.abs(Math.round(d * 10) / 10))} ${u})`
  // Semaine dernière vide : rien à comparer, on n'affiche pas de « ↑ vs 0 ».
  const comparable = avant.seances > 0 || activitesAvant.length > 0
  const tuile = (valeur: string, label: string, n: number, m: number, texteAvant: string) => (
    <div className="tuile">
      <strong>{valeur}</strong>
      <span className="faible">{label}</span>
      {comparable && (
        <span className={'delta' + (n > m ? ' plus' : n < m ? ' moins' : '')}>
          {n > m ? '↑' : n < m ? '↓' : '='} vs {texteAvant}
        </span>
      )}
    </div>
  )
  return (
    <div className="carte">
      <div className="ligne entre" style={{ marginBottom: 10 }}>
        <h3>Bilan de la semaine</h3>
        {comparable && <span className="faible">vs semaine dernière</span>}
      </div>
      <div className="tuiles">
        {tuile(String(actuel.seances), actuel.seances > 1 ? 'séances' : 'séance', actuel.seances, avant.seances, String(avant.seances))}
        {tuile(actuel.temps ? duree(actuel.temps) : '0', 'de muscu', actuel.temps, avant.temps, avant.temps ? duree(avant.temps) : '0')}
        {tuile(String(actuel.dures), actuel.dures > 1 ? 'séries dures' : 'série dure', actuel.dures, avant.dures, String(avant.dures))}
        {tuile(kg(Math.round(actuel.tonnage)), 'kg soulevés', actuel.tonnage, avant.tonnage, kg(Math.round(avant.tonnage)))}
        {tuile(String(actuel.records), actuel.records > 1 ? 'records 🏆' : 'record 🏆', actuel.records, avant.records, String(avant.records))}
        {(activites.length > 0 || activitesAvant.length > 0) &&
          tuile(
            minutes(activites) ? duree(minutes(activites) * 60000) : '0',
            `d’autre sport (${activites.length})`,
            minutes(activites),
            minutes(activitesAvant),
            minutes(activitesAvant) ? duree(minutes(activitesAvant) * 60000) : '0'
          )}
      </div>
      {(poids !== null || taille) && (
        <div className="faible corps-semaine">
          {poids !== null && (
            <span>
              Poids moyen <strong>{kg(Math.round(poids * 10) / 10)} kg</strong>
              {poidsAvant !== null && ecart(poids - poidsAvant, 'kg')}
            </span>
          )}
          {taille && (
            <span>
              Taille <strong>{kg(taille.valeurs.taille)} cm</strong>
              {tailleAvant && ecart(taille.valeurs.taille - tailleAvant.valeurs.taille, 'cm')}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function CarteSeance({
  seance,
  records,
  reglages,
  catalogue,
  onOuvrir,
}: {
  seance: Seance
  records: number
  reglages: Reglage[]
  catalogue: Catalogue
  onOuvrir: () => void
}) {
  const dures = seance.series.filter(estDure).length
  const tonnage = seance.series.reduce((a, s) => a + kgSouleves(s, catalogue.exo(s.exoId)), 0)
  const exos = seance.exercices.filter((p) => seance.series.some((s) => s.exoId === p.exoId))
  return (
    <button className="liste-btn carte-seance" onClick={onOuvrir}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="faible">{jourCourt(seance.date)}</span>
        <span className="ligne entre" style={{ alignItems: 'baseline' }}>
          <strong>{seance.nom}</strong>
          {seance.ressenti && <span className="faible">ressenti {seance.ressenti}/5</span>}
        </span>
        <span className="ligne wrap" style={{ gap: 6, margin: '6px 0' }}>
          <span className="pastille">⏱ {duree(dureeReelle(seance))}</span>
          <span className="pastille">
            {dures} série{dures > 1 ? 's' : ''} dure{dures > 1 ? 's' : ''}
          </span>
          <span className="pastille">{kg(Math.round(tonnage))} kg</span>
          {records > 0 && <span className="pastille ok">🏆 {records}</span>}
        </span>
        {exos.map((p) => {
          const exo = exoAvecReglages(catalogue.exo(p.exoId), reglages)
          const m = meilleureSerie(seance.series.filter((s) => s.exoId === p.exoId))
          return (
            <span key={p.exoId} className="exo-resume">
              <span>{exo.nom}</span>
              {m && (
                <span className="faible">
                  {chargeQte(exo, m.charge, m.reps)}
                </span>
              )}
            </span>
          )
        })}
      </span>
      <span className="muted">›</span>
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
      <RecapExos seance={seance} avant={avant} reglages={reglages} catalogue={catalogue} onSerie={setEdition} />

      <button className="btn discret danger plein" style={{ margin: '12px 0 24px' }} onClick={supprimer}>
        Supprimer cette séance
      </button>

      {edition && (
        <CorrectionSerie seance={seance} serie={edition} avant={avant} reglages={reglages} catalogue={catalogue} onFermer={() => setEdition(null)} />
      )}
    </div>
  )
}

/** Corriger une série d'une séance passée : la même saisie qu'en séance. */
function CorrectionSerie({
  seance,
  serie,
  avant,
  reglages,
  catalogue,
  onFermer,
}: {
  seance: Seance
  serie: Serie
  avant: Seance[]
  reglages: Reglage[]
  catalogue: Catalogue
  onFermer: () => void
}) {
  useRetour(true, onFermer)
  const exo = exoAvecReglages(catalogue.exo(serie.exoId), reglages)
  const plan = seance.exercices.find((p) => p.exoId === serie.exoId) ?? planParDefaut(exo)
  const faites = seance.series.filter((x) => x.exoId === serie.exoId)
  return (
    <div className="modal-fond" onClick={onFermer}>
      <div className="modal pile" onClick={(e) => e.stopPropagation()}>
        <div className="faible">
          {exo.nom} · {jourCourt(seance.date)}
        </div>
        <Editeur
          seance={seance}
          plan={plan}
          exo={exo}
          sugg={suggestionPour(exo, plan, avant)}
          index={faites.findIndex((x) => x.id === serie.id)}
          total={faites.length}
          faites={faites}
          edition={serie}
          reposRestant={0}
          verrou={false}
          onFini={onFermer}
          onAnnulerEdition={onFermer}
        />
      </div>
    </div>
  )
}

function CarteActivite({ activite, poids, onOuvrir }: { activite: Activite; poids?: number; onOuvrir: () => void }) {
  const t = typeActivite(activite.type)
  return (
    <button className="liste-btn carte-seance carte-activite" onClick={onOuvrir}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="faible">{jourCourt(activite.date)}</span>
        <span className="ligne entre" style={{ alignItems: 'baseline' }}>
          <strong>
            {t.emoji} {t.nom}
          </strong>
          <span className="faible">intensité {activite.intensite}/10</span>
        </span>
        <span className="ligne wrap" style={{ gap: 6, marginTop: 6 }}>
          <span className="pastille">⏱ {duree(activite.duree * 60000)}</span>
          <span className="pastille">🔥 ≈ {kcalActivite(activite, poids)} kcal</span>
          <span className="pastille">{INTENSITES[activite.intensite]}</span>
        </span>
        {activite.note && <span className="faible" style={{ display: 'block', marginTop: 4 }}>📝 {activite.note}</span>}
      </span>
      <span className="muted">✎</span>
    </button>
  )
}
