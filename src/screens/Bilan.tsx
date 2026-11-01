import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState, type ReactNode } from 'react'
import { Award, ChevronRight, Sparkles, TrendingUp } from 'lucide-react'
import type { Catalogue } from '../catalogue'
import { informer } from '../components/Dialogues'
import SilhouetteVolume from '../components/SilhouetteVolume'
import VolumeMuscles from '../components/VolumeMuscles'
import { db } from '../db'
import { phaseA } from '../lib/objectifs'
import { BONUS_PRIORITE, etatCycle, nomCycle } from '../lib/cycle'
import { MUSCLES } from '../data/exercices'
import { analyser, aRetenir, libelleMesure, type Analyse } from '../lib/analyse'
import { debutPeriode, genererBilan, type DonneesBilan } from '../lib/bilan'
import { dateCourte, dateISO, duree, kg, lundi, semaineType, volumePrevu } from '../lib/calc'
import { bilan, recordsParSeance, semaineDe } from '../lib/historique'
import type { Muscle, Seance } from '../types'

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
  const journal = useLiveQuery(() => db.journal.toArray(), [], [])
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
  const donnees: DonneesBilan = { seances, pesees, mesures, exo: catalogue.exo, exercices: catalogue.exercices, cibles, programme: catalogue.actif.nom, objectifs: catalogue.objectifs, journal, cycle: cycle && `Cycle « ${nomCycle(cycle)} » (${cycle.programme.nom}), semaine ${Math.max(1, etatCycle(cycle).n)}/${cycle.semaines}${cycle.priorites?.length ? `, priorité : ${cycle.priorites.map((m) => MUSCLES.find((x) => x.id === m)!.nom.toLowerCase()).join(', ')} (+${BONUS_PRIORITE} séries par semaine)` : ''}` }
  const prevues = catalogue.planning.length
  const phaseEnCours = phaseA(catalogue.objectifs, fin)
  const phaseFin = phaseEnCours?.phase
  const a = analyser(donnees, debut, fin, prevues, phaseFin)
  // La phase a commencé pendant la période : on ne la juge que depuis son début.
  const depuisPhase = phaseEnCours && phaseEnCours.debut > debut ? analyser(donnees, phaseEnCours.debut, fin, prevues, phaseFin) : undefined
  const longueur = Math.round((Date.parse(fin) - Date.parse(a.debut)) / JOUR)
  const [debutAvant, finAvant] =
    periode === 'semaine'
      ? [decaler(debut, -7), decaler(fin, -7)]
      : [decaler(decaler(a.debut, -1), -longueur), decaler(a.debut, -1)]
  const avant = analyser(donnees, debutAvant, finAvant, prevues, phaseA(catalogue.objectifs, finAvant)?.phase)
  const comparable = avant.seances > 0
  const enCours = periode === 'semaine' && aujourdhui < decaler(lundi(), 6)
  const retenir = aRetenir(a, comparable ? avant : null, cibles, enCours, phaseFin, depuisPhase)
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
      {/* Filtres de période en une seule rangée fine */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap', overflowX: 'auto', marginBottom: 6, scrollbarWidth: 'none' }}>
        {(
          [
            ['semaine', 'Semaine'],
            ['4', '4 sem.'],
            ...(cycle ? [['cycle', 'Cycle']] as [Periode, string][] : [['derniere', 'Sem. préc.']] as [Periode, string][]),
            ['12', '3 mois'],
          ] as [Periode, string][]
        ).map(([id, nom]) => {
          const actif = periode === id
          return (
            <button
              key={id}
              type="button"
              style={{
                flex: 1,
                minWidth: 'fit-content',
                padding: '6px 12px',
                fontSize: '0.82rem',
                fontWeight: actif ? 600 : 400,
                color: actif ? 'var(--accent-orange)' : 'var(--text-secondary)',
                background: actif ? 'rgba(249, 115, 22, 0.15)' : 'transparent',
                border: '1px solid ' + (actif ? 'var(--accent-orange)' : 'rgba(255, 255, 255, 0.08)'),
                borderRadius: 8,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
              onClick={() => setPeriode(id)}
            >
              {nom}
            </button>
          )
        })}
      </div>
      <div className="faible" style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
        Du {jour(a.debut)} au {jour(fin)}
        {comparable ? ` · comparé au ${jour(debutAvant)} – ${jour(finAvant)}` : ''}
      </div>

      {/* Carte À retenir masquée s'il n'y a pas assez de données */}
      {retenir.length > 0 && !retenir[0].startsWith('Pas encore assez') && (
        <div className="carte pile a-retenir" style={{ padding: '14px 16px', borderRadius: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-orange)' }}>
            <Sparkles size={16} strokeWidth={2} />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--texte)' }}>À retenir</h3>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            {retenir.map((t) => (
              <li key={t} style={{ marginTop: 4 }}>
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Carte Assiduité et travail en grille 2x2 symétrique */}
      <div className="carte" style={{ padding: '16px', borderRadius: 18 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '1.1rem', fontWeight: 700 }}>Assiduité et travail</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          <Tuile valeur={a.prevues ? `${a.faites}/${a.prevues}` : String(a.seances)} label={a.prevues ? 'séances' : 'séances'} n={a.seances} m={avant.seances} comparable={comparable} />
          <Tuile valeur={a.temps ? duree(a.temps) : '0 min'} label="d’entraînement" n={a.temps} m={avant.temps} comparable={comparable} texteAvant={avant.temps ? duree(avant.temps) : '0 min'} />
          <Tuile valeur={String(a.dures)} label={a.dures > 1 ? 'séries dures' : 'série dure'} n={a.dures} m={avant.dures} comparable={comparable} />
          <Tuile valeur={kg(Math.round(a.tonnage)) + ' kg'} label="soulevés" n={a.tonnage} m={avant.tonnage} comparable={comparable} texteAvant={kg(Math.round(avant.tonnage)) + ' kg'} />
        </div>
        {(a.enchainees > 1 || a.deloads > 0) && (
          <div className="faible" style={{ marginTop: 10, fontSize: '0.82rem', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {a.enchainees > 1 && <span>🔥 {a.enchainees} semaines d’affilée</span>}
            {a.deloads > 0 && <span>🧘 {a.deloads} séance(s) de déload</span>}
          </div>
        )}
      </div>

      {a.semaines.length > 1 && <SemaineParSemaine semaines={a.semaines} seances={seances} records={records} catalogue={catalogue} />}

      {/* Carte Volume musculaire */}
      <div className="carte" style={{ padding: '16px', borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Volume musculaire</h3>
          <div style={{ display: 'inline-flex', gap: 4, background: 'rgba(255, 255, 255, 0.04)', padding: 3, borderRadius: 8, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <button
              type="button"
              style={{
                padding: '3px 10px',
                fontSize: '0.75rem',
                fontWeight: vueMuscles === 'fait' ? 600 : 400,
                color: vueMuscles === 'fait' ? 'var(--texte)' : 'var(--text-secondary)',
                background: vueMuscles === 'fait' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
              }}
              onClick={() => setVueMuscles('fait')}
            >
              Fait
            </button>
            <button
              type="button"
              style={{
                padding: '3px 10px',
                fontSize: '0.75rem',
                fontWeight: vueMuscles === 'prevu' ? 600 : 400,
                color: vueMuscles === 'prevu' ? 'var(--texte)' : 'var(--text-secondary)',
                background: vueMuscles === 'prevu' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
              }}
              onClick={() => setVueMuscles('prevu')}
            >
              Prévu
            </button>
          </div>
        </div>
        <div style={{ maxHeight: 220, overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>
          <SilhouetteVolume volume={volMuscles} cibles={cibles} choisi={muscle} onChoisir={setMuscle} legende="objectif de la semaine" quoi={vueMuscles === 'prevu' ? 'prévues' : 'par semaine'} />
        </div>
        <button
          type="button"
          onClick={() => setDetailMuscles(!detailMuscles)}
          aria-expanded={detailMuscles}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'none',
            border: 'none',
            padding: '10px 0 2px',
            color: 'var(--accent-orange)',
            fontSize: '0.85rem',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <span>Détail par muscle</span>
          <span>{detailMuscles ? '▴' : '▾'}</span>
        </button>
        {detailMuscles && (
          <div style={{ marginTop: 8 }}>
            <VolumeMuscles volume={volMuscles} cibles={cibles} actif={muscle} onChoix={(m) => setMuscle(m === muscle ? null : m)} />
          </div>
        )}
      </div>

      <Progression a={a} onExo={onExo} />

      {(a.rpe !== null || a.ressenti !== null || a.energie !== null || a.douleurs.length > 0 || a.sommeil || a.calories.ok + a.calories.trop + a.calories.pasAssez > 0) && (
        <div className="carte pile">
          <h3>Intensité et forme</h3>
          {(a.rpe !== null || a.ressenti !== null || a.energie !== null || a.sommeil || a.calories.ok + a.calories.trop + a.calories.pasAssez > 0) && (
            <div className="tuiles">
              {a.rpe !== null && <Tuile valeur={kg(arrondi(a.rpe))} label="RPE moyen" n={a.rpe} m={avant.rpe ?? undefined} comparable={avant.rpe !== null} neutre texteAvant={avant.rpe !== null ? kg(arrondi(avant.rpe)) : ''} />}
              {a.ressenti !== null && (
                <Tuile valeur={`${kg(arrondi(a.ressenti))}/5`} label="ressenti" n={a.ressenti} m={avant.ressenti ?? undefined} comparable={avant.ressenti !== null} texteAvant={avant.ressenti !== null ? kg(arrondi(avant.ressenti)) : ''} />
              )}
              {a.energie !== null && (
                <Tuile valeur={`${kg(arrondi(a.energie))}/5`} label="énergie" n={a.energie} m={avant.energie ?? undefined} comparable={avant.energie !== null} texteAvant={avant.energie !== null ? kg(arrondi(avant.energie)) : ''} />
              )}
              {a.sommeil && (
                <Tuile
                  valeur={`${Math.floor(a.sommeil.moyenne)} h ${String(Math.round((a.sommeil.moyenne % 1) * 60)).padStart(2, '0')}`}
                  label={`sommeil moyen (${a.sommeil.nuits} nuit${a.sommeil.nuits > 1 ? 's' : ''})`}
                  n={a.sommeil.moyenne}
                  m={avant.sommeil?.moyenne}
                  comparable={!!avant.sommeil}
                  texteAvant={avant.sommeil ? `${kg(arrondi(avant.sommeil.moyenne))} h` : ''}
                />
              )}
              {a.calories.ok + a.calories.trop + a.calories.pasAssez > 0 && (
                <Tuile valeur={`${a.calories.ok}/${a.calories.ok + a.calories.trop + a.calories.pasAssez}`} label="jours dans l’objectif calories" />
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
function SemaineParSemaine({ semaines, seances, records, catalogue }: { semaines: string[]; seances: Seance[]; records: Record<string, number>; catalogue: Catalogue }) {
  const cette = lundi()
  return (
    <div className="carte">
      <h3 style={{ marginBottom: 4 }}>Semaine par semaine</h3>
      {[...semaines].reverse().map((l) => {
        const b = bilan(seances.filter((s) => semaineDe(s.date) === l), records, catalogue.exo)
        const detail = [
          b.dures ? `${b.dures} série${b.dures > 1 ? 's' : ''} dure${b.dures > 1 ? 's' : ''}` : '',
          b.records ? `🏆 ${b.records}` : '',
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

/** Records, meilleures progressions et blocages de la période. */
function Progression({ a, onExo }: { a: Analyse; onExo?: (id: string) => void }) {
  const progres = a.progressions.filter((p) => p.pct > 0).slice(0, 3)
  if (!a.records.length && !progres.length && !a.stagnations.length) return null
  return (
    <div className="carte pile" style={{ padding: '16px', borderRadius: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <TrendingUp size={18} strokeWidth={2} style={{ color: 'var(--accent-orange)' }} />
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Progression</h3>
      </div>

      {a.records.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div className="faible" style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Award size={14} style={{ color: '#f5c04a' }} />
            <span>Records battus</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[...new Set(a.records.map((r) => r.exo.id))]
              .map((id) => a.records.filter((r) => r.exo.id === id))
              .sort((x, y) => y[y.length - 1].date.localeCompare(x[x.length - 1].date))
              .map((l) => {
                const r = l[l.length - 1]
                return (
                  <div
                    key={r.exo.id}
                    role="button"
                    tabIndex={0}
                    onClick={onExo ? () => onExo(r.exo.id) : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: 12,
                      background: 'var(--subcard-gradient)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      cursor: onExo ? 'pointer' : 'default',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--texte)' }}>{r.exo.nom}</div>
                      <div className="faible" style={{ fontSize: '0.78rem', marginTop: 1 }}>
                        {l.length > 1 ? `${l.length} records · ${jour(r.date)}` : jour(r.date)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong style={{ color: '#22c55e', fontSize: '0.95rem' }}>{r.perf}</strong>
                      {onExo && <ChevronRight size={16} strokeWidth={1.75} className="muted" />}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {progres.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div className="faible" style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
            Plus fortes progressions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {progres.map((p) => (
              <div
                key={p.exo.id}
                role="button"
                tabIndex={0}
                onClick={onExo ? () => onExo(p.exo.id) : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: 'var(--subcard-gradient)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  cursor: onExo ? 'pointer' : 'default',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--texte)' }}>{p.exo.nom}</div>
                  <div className="faible" style={{ fontSize: '0.78rem', marginTop: 1 }}>
                    {p.detail ?? `1RM estimé : ${kg(arrondi(p.avant))} → ${kg(arrondi(p.apres))} kg`}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong style={{ color: '#22c55e', fontSize: '0.95rem' }}>+{kg(arrondi(p.pct))} %</strong>
                  {onExo && <ChevronRight size={16} strokeWidth={1.75} className="muted" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {a.stagnations.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div className="faible" style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
            Stagnations
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {a.stagnations.map((s) => (
              <div
                key={s.exo.id}
                role="button"
                tabIndex={0}
                onClick={onExo ? () => onExo(s.exo.id) : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: 'var(--subcard-gradient)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  cursor: onExo ? 'pointer' : 'default',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--texte)' }}>{s.exo.nom}</div>
                  <div className="faible" style={{ fontSize: '0.78rem', marginTop: 1 }}>
                    sans progrès depuis {s.semaines} sem.{s.pistes.length ? ` · ${s.pistes.join(', ')}` : ''}
                  </div>
                </div>
                {onExo && <ChevronRight size={16} strokeWidth={1.75} className="muted" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** Une valeur, et sa comparaison avec la période d'avant quand elle a du sens. */
function Tuile({ valeur, label, n, m, comparable = false, texteAvant, neutre = false }: { valeur: string; label: string; n?: number; m?: number; comparable?: boolean; texteAvant?: string; neutre?: boolean }) {
  const montre = comparable && n !== undefined && m !== undefined
  return (
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
      <div>
        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--texte)', letterSpacing: '-0.3px' }}>{valeur}</div>
        <div className="faible" style={{ fontSize: '0.8rem', marginTop: 1, color: 'var(--text-secondary)' }}>{label}</div>
      </div>
      {montre && (
        <span
          style={{
            fontSize: '0.75rem',
            marginTop: 4,
            fontWeight: 600,
            color: neutre ? 'var(--text-secondary)' : n! > m! ? '#22c55e' : n! < m! ? '#f87171' : 'var(--text-secondary)',
          }}
        >
          {n! > m! ? '↑' : n! < m! ? '↓' : '='} vs {texteAvant ?? kg(arrondi(m!))}
        </span>
      )}
    </div>
  )
}
