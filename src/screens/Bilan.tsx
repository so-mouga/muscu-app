import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState, type ReactNode } from 'react'
import type { Catalogue } from '../catalogue'
import { informer } from '../components/Dialogues'
import SilhouetteVolume from '../components/SilhouetteVolume'
import VolumeMuscles from '../components/VolumeMuscles'
import { db } from '../db'
import { analyser, aRetenir, libelleMesure, type Analyse } from '../lib/analyse'
import { debutPeriode, genererBilan, type DonneesBilan } from '../lib/bilan'
import { dateCourte, dateISO, duree, kg, lundi, semaineType, volumePrevu } from '../lib/calc'
import { bilan, recordsParSeance, semaineDe } from '../lib/historique'
import type { Activite, Muscle, Seance } from '../types'

type Periode = 'semaine' | 'derniere' | '4' | 'cycle' | '12'

const JOUR = 86400000
const decaler = (iso: string, jours: number) => dateISO(new Date(Date.parse(iso + 'T12:00:00') + jours * JOUR))
const arrondi = (x: number) => Math.round(x * 10) / 10
const jour = (iso: string) => dateCourte(iso).replace(/^\S+ /, '')

/** Bilan d'une période : ce qu'il faut retenir, assiduité, muscles, progression, forme et corps. */
export default function Bilan({ catalogue, onExo, onCorps }: { catalogue: Catalogue; onExo?: (id: string) => void; onCorps?: () => void }) {
  const cycle = catalogue.cycle
  const [periode, setPeriode] = useState<Periode>('semaine')
  const [vueMuscles, setVueMuscles] = useState<'fait' | 'prevu'>('fait')
  const [detailMuscles, setDetailMuscles] = useState(false)
  const [muscle, setMuscle] = useState<Muscle | null>(null)
  const seances = useLiveQuery(() => db.seances.filter((s) => !s.enCours).toArray(), [])
  const pesees = useLiveQuery(() => db.pesees.toArray(), [], [])
  const mesures = useLiveQuery(() => db.mesures.toArray(), [], [])
  const activites = useLiveQuery(() => db.activites.toArray(), [], [])
  const records = useMemo(() => (seances ? recordsParSeance(seances, catalogue.exo) : {}), [seances, catalogue])
  const prevuMuscles = useMemo(() => volumePrevu(semaineType(catalogue.actif).map((e) => catalogue.modele(e.modeleId)).filter((m) => !!m), catalogue.exercices), [catalogue])
  if (!seances) return null

  // Période choisie, et la précédente de même durée (ou à jours équivalents sur la semaine en cours) pour comparer.
  const aujourdhui = dateISO()
  const [debut, fin] =
    periode === 'semaine'
      ? [lundi(), aujourdhui]
      : periode === 'derniere'
        ? [decaler(lundi(), -7), decaler(lundi(), -1)]
        : periode === 'cycle' && cycle
          ? [cycle.debut, aujourdhui]
          : [debutPeriode(periode === '12' ? 13 : 4), aujourdhui]

  // Objectifs de volume en vigueur à la fin de la période (ils peuvent avoir changé depuis).
  const cibles = catalogue.ciblesA(fin)
  const donnees: DonneesBilan = { seances, pesees, mesures, activites, exo: catalogue.exo, exercices: catalogue.exercices, cibles, programme: catalogue.actif.nom, objectifs: catalogue.objectifs }
  const prevues = catalogue.planning.length
  const a = analyser(donnees, debut, fin, prevues)
  const longueur = Math.round((Date.parse(fin) - Date.parse(a.debut)) / JOUR)
  const [debutAvant, finAvant] =
    periode === 'semaine'
      ? [decaler(debut, -7), decaler(fin, -7)]
      : [decaler(decaler(a.debut, -1), -longueur), decaler(a.debut, -1)]
  const avant = analyser(donnees, debutAvant, finAvant, prevues)
  const comparable = avant.seances > 0
  const enCours = periode === 'semaine' && aujourdhui < decaler(lundi(), 6)
  const retenir = aRetenir(a, comparable ? avant : null, cibles, enCours)
  const volMuscles = vueMuscles === 'prevu' ? prevuMuscles : a.volume

  const partager = async () => {
    const texte = genererBilan(donnees, debut, fin)
    try {
      if (typeof navigator.share === 'function') await navigator.share({ title: 'Bilan d’entraînement', text: texte })
      else {
        await navigator.clipboard.writeText(texte)
        void informer('Le bilan complet est copié : colle-le où tu veux.', 'Copié')
      }
    } catch {
      /* partage annulé */
    }
  }

  return (
    <div>
      <div className="chips" style={{ marginBottom: 6 }}>
        {(
          [
            ['semaine', 'Cette semaine'],
            ['derniere', 'Semaine dernière'],
            ['4', '4 semaines'],
            ...(cycle ? [['cycle', 'Cycle en cours']] : []),
            ['12', '3 mois'],
          ] as [Periode, string][]
        ).map(([id, nom]) => (
          <button key={id} className={periode === id ? 'actif' : ''} onClick={() => setPeriode(id)}>
            {nom}
          </button>
        ))}
      </div>
      <div className="faible" style={{ marginBottom: 12 }}>
        Du {jour(a.debut)} au {jour(fin)}
        {comparable ? ` · comparé au ${jour(debutAvant)} – ${jour(finAvant)}` : ''}
      </div>

      <div className="carte pile a-retenir">
        <h3>À retenir</h3>
        <ul>
          {retenir.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>

      <div className="carte">
        <h3 style={{ marginBottom: 10 }}>Assiduité et travail</h3>
        <div className="tuiles">
          <Tuile valeur={a.prevues ? `${a.seances}/${a.prevues}` : String(a.seances)} label={a.prevues ? 'séances faites / prévues' : 'séances'} n={a.seances} m={avant.seances} comparable={comparable} />
          <Tuile valeur={a.temps ? duree(a.temps) : '0'} label="d’entraînement" n={a.temps} m={avant.temps} comparable={comparable} texteAvant={avant.temps ? duree(avant.temps) : '0'} />
          <Tuile valeur={String(a.dures)} label={a.dures > 1 ? 'séries dures' : 'série dure'} n={a.dures} m={avant.dures} comparable={comparable} />
          <Tuile valeur={kg(Math.round(a.tonnage))} label="kg soulevés" n={a.tonnage} m={avant.tonnage} comparable={comparable} texteAvant={kg(Math.round(avant.tonnage))} />
          {a.semaines.length > 1 && <Tuile valeur={String(a.enchainees)} label={`semaine${a.enchainees > 1 ? 's' : ''} d’affilée`} />}
          {(a.sports.n > 0 || avant.sports.n > 0) && (
            <Tuile
              valeur={a.sports.minutes ? duree(a.sports.minutes * 60000) : '0'}
              label={`d’autre sport (${a.sports.n})`}
              n={a.sports.minutes}
              m={avant.sports.minutes}
              comparable={comparable}
              texteAvant={avant.sports.minutes ? duree(avant.sports.minutes * 60000) : '0'}
            />
          )}
        </div>
        {a.deloads > 0 && <div className="faible" style={{ marginTop: 8 }}>Dont {a.deloads} séance(s) de déload.</div>}
      </div>

      {a.semaines.length > 1 && <SemaineParSemaine semaines={a.semaines} seances={seances} activites={activites} records={records} catalogue={catalogue} />}

      <div className="carte">
        <div className="ligne entre">
          <h3>Muscles</h3>
          <div className="chips mini-chips" role="tablist" aria-label="Volume affiché">
            <button role="tab" aria-selected={vueMuscles === 'fait'} className={vueMuscles === 'fait' ? 'actif' : ''} onClick={() => setVueMuscles('fait')}>
              Fait
            </button>
            <button role="tab" aria-selected={vueMuscles === 'prevu'} className={vueMuscles === 'prevu' ? 'actif' : ''} onClick={() => setVueMuscles('prevu')}>
              Prévu
            </button>
          </div>
        </div>
        <div className="faible" style={{ margin: '4px 0 8px' }}>
          {vueMuscles === 'prevu'
            ? `Séries dures prévues chaque semaine par « ${catalogue.actif.nom} », face aux objectifs.`
            : `Séries dures par semaine en moyenne${a.deloads ? ' (hors déload)' : ''}, face aux objectifs.`}
        </div>
        <SilhouetteVolume volume={volMuscles} cibles={cibles} choisi={muscle} onChoisir={setMuscle} legende="objectif de la semaine" quoi={vueMuscles === 'prevu' ? 'prévues' : 'par semaine'} />
        <button type="button" className="groupe-repli" onClick={() => setDetailMuscles(!detailMuscles)} aria-expanded={detailMuscles}>
          <span>Détail par muscle</span>
          <span className="muted">{detailMuscles ? '▾' : '▸'}</span>
        </button>
        {detailMuscles && <VolumeMuscles volume={volMuscles} cibles={cibles} actif={muscle} onChoix={(m) => setMuscle(m === muscle ? null : m)} />}
      </div>

      <Progression a={a} onExo={onExo} />

      {(a.rpe !== null || a.ressenti !== null || a.energie !== null || a.douleurs.length > 0) && (
        <div className="carte pile">
          <h3>Intensité et forme</h3>
          {(a.rpe !== null || a.ressenti !== null || a.energie !== null) && (
            <div className="tuiles">
              {a.rpe !== null && <Tuile valeur={kg(arrondi(a.rpe))} label="RPE moyen" n={a.rpe} m={avant.rpe ?? undefined} comparable={avant.rpe !== null} neutre texteAvant={avant.rpe !== null ? kg(arrondi(avant.rpe)) : ''} />}
              {a.ressenti !== null && (
                <Tuile valeur={`${kg(arrondi(a.ressenti))}/5`} label="ressenti" n={a.ressenti} m={avant.ressenti ?? undefined} comparable={avant.ressenti !== null} texteAvant={avant.ressenti !== null ? kg(arrondi(avant.ressenti)) : ''} />
              )}
              {a.energie !== null && (
                <Tuile valeur={`${kg(arrondi(a.energie))}/5`} label="énergie" n={a.energie} m={avant.energie ?? undefined} comparable={avant.energie !== null} texteAvant={avant.energie !== null ? kg(arrondi(avant.energie)) : ''} />
              )}
            </div>
          )}
          {a.douleurs.length > 0 && (
            <div>
              <div className="faible">⚠️ Douleurs signalées</div>
              {a.douleurs.map((d) => (
                <LigneExo key={d.exo.id} onClick={onExo ? () => onExo(d.exo.id) : undefined}>
                  <span>
                    {d.exo.nom}
                    {d.n > 1 && <span className="faible petit-detail">{d.n} séances · dernière le {jour(d.date)}</span>}
                  </span>
                  <span className="faible">{d.n === 1 ? jour(d.date) : ''}</span>
                </LigneExo>
              ))}
            </div>
          )}
        </div>
      )}

      {(a.poids || a.mesures.length > 0) && (
        <div className="carte">
          <div className="ligne entre">
            <h3>Corps</h3>
            {onCorps && (
              <button className="btn discret petit lien-action" onClick={onCorps}>
                Voir Corps ›
              </button>
            )}
          </div>
          {a.poids && (
            <div className="ligne-mesure">
              <span>Poids moyen</span>
              <span>
                <strong>{kg(arrondi(a.poids.fin))} kg</strong> <span className="faible">({ecart(a.poids.fin - a.poids.debut, 'kg')})</span>
              </span>
            </div>
          )}
          {a.mesures.map((m) => (
            <div key={m.cle} className="ligne-mesure">
              <span>{libelleMesure(m.cle)}</span>
              <span>
                <strong>{kg(m.fin)} cm</strong> <span className="faible">({ecart(m.fin - m.debut, 'cm')})</span>
              </span>
            </div>
          ))}
        </div>
      )}

      <button className="btn plein" style={{ marginBottom: 24 }} onClick={partager}>
        📤 Partager ce bilan (texte complet)
      </button>
    </div>
  )
}

const ecart = (d: number, u: string) => `${d > 0 ? '+' : d < 0 ? '−' : '±'}${kg(Math.abs(arrondi(d)))} ${u}`

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

/** Chaque semaine de la période en une ligne, la plus récente en premier. */
function SemaineParSemaine({ semaines, seances, activites, records, catalogue }: { semaines: string[]; seances: Seance[]; activites: Activite[]; records: Record<string, number>; catalogue: Catalogue }) {
  const cette = lundi()
  return (
    <div className="carte">
      <h3 style={{ marginBottom: 4 }}>Semaine par semaine</h3>
      {[...semaines].reverse().map((l) => {
        const b = bilan(seances.filter((s) => semaineDe(s.date) === l), records, catalogue.exo)
        const sports = activites.filter((x) => semaineDe(x.date) === l).length
        const detail = [
          b.dures ? `${b.dures} série${b.dures > 1 ? 's' : ''} dure${b.dures > 1 ? 's' : ''}` : '',
          b.records ? `🏆 ${b.records}` : '',
          sports ? (sports > 1 ? `${sports} autres sports` : '1 autre sport') : '',
        ].filter(Boolean)
        return (
          <div key={l} className="semaine-bilan">
            <span>
              {l === cette ? 'Cette semaine' : `Sem. du ${jour(l)}`}
              {detail.length > 0 && <span className="faible petit-detail">{detail.join(' · ')}</span>}
            </span>
            <strong>{b.seances ? pluriel(b.seances, 'séance') : <span className="faible">—</span>}</strong>
          </div>
        )
      })}
    </div>
  )
}

/** Ligne d'exercice dans le Bilan (cliquable pour ouvrir sa courbe dans Exercices). */
function LigneExo({ onClick, children }: { onClick?: () => void; children: [ReactNode, ReactNode] }) {
  if (!onClick) return <div className="semaine-bilan">{children}</div>
  return (
    <button type="button" className="semaine-bilan cliquable" onClick={onClick}>
      {children[0]}
      <span className="droite-bilan">
        {children[1]}
        <span className="muted">›</span>
      </span>
    </button>
  )
}

/** Records, meilleures progressions et stagnations de la période. */
function Progression({ a, onExo }: { a: Analyse; onExo?: (id: string) => void }) {
  const progres = a.progressions.filter((p) => p.pct > 0).slice(0, 3)
  if (!a.records.length && !progres.length && !a.stagnations.length) return null
  return (
    <div className="carte pile">
      <h3>Progression</h3>
      {a.records.length > 0 && (
        <div>
          <div className="faible">Records battus 🏆</div>
          {/* Un exercice par ligne : son dernier record, et combien il en a battu. */}
          {[...new Set(a.records.map((r) => r.exo.id))]
            .map((id) => a.records.filter((r) => r.exo.id === id))
            .sort((x, y) => y[y.length - 1].date.localeCompare(x[x.length - 1].date))
            .map((l) => {
              const r = l[l.length - 1]
              return (
                <LigneExo key={r.exo.id} onClick={onExo ? () => onExo(r.exo.id) : undefined}>
                  <span>
                    {r.exo.nom}
                    <span className="faible petit-detail">{l.length > 1 ? `${l.length} records · ${jour(r.date)}` : jour(r.date)}</span>
                  </span>
                  <strong>{r.perf}</strong>
                </LigneExo>
              )
            })}
        </div>
      )}
      {progres.length > 0 && (
        <div>
          <div className="faible">Plus fortes progressions</div>
          {progres.map((p) => (
            <LigneExo key={p.exo.id} onClick={onExo ? () => onExo(p.exo.id) : undefined}>
              <span>
                {p.exo.nom}
                <span className="faible petit-detail">
                  {p.detail ?? `1RM estimé : ${kg(arrondi(p.avant))} → ${kg(arrondi(p.apres))} kg`}
                </span>
              </span>
              <strong>+{kg(arrondi(p.pct))} %</strong>
            </LigneExo>
          ))}
        </div>
      )}
      {a.stagnations.length > 0 && (
        <div>
          <div className="faible">Stagnent</div>
          {a.stagnations.map((s) => (
            <LigneExo key={s.exo.id} onClick={onExo ? () => onExo(s.exo.id) : undefined}>
              <span>
                {s.exo.nom}
                <span className="faible petit-detail">identique depuis {s.n} séances</span>
              </span>
              <span />
            </LigneExo>
          ))}
        </div>
      )}
    </div>
  )
}

/** Une valeur, et sa comparaison avec la période d'avant quand elle a du sens. */
function Tuile({ valeur, label, n, m, comparable = false, texteAvant, neutre = false }: { valeur: string; label: string; n?: number; m?: number; comparable?: boolean; texteAvant?: string; neutre?: boolean }) {
  const montre = comparable && n !== undefined && m !== undefined
  return (
    <div className="tuile">
      <strong>{valeur}</strong>
      <span className="faible">{label}</span>
      {montre && (
        <span className={'delta' + (neutre ? '' : n! > m! ? ' plus' : n! < m! ? ' moins' : '')}>
          {n! > m! ? '↑' : n! < m! ? '↓' : '='} vs {texteAvant ?? kg(arrondi(m!))}
        </span>
      )}
    </div>
  )
}
