import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState, type ReactNode } from 'react'
import { Award, ChevronRight, Sparkles, TrendingUp } from 'lucide-react'
import type { Catalogue } from '../catalogue'
import Aide from '../components/Aide'
import { informer } from '../components/Dialogues'
import SilhouetteVolume from '../components/SilhouetteVolume'
import VolumeMuscles from '../components/VolumeMuscles'
import { db } from '../db'
import { phaseA } from '../lib/objectifs'
import { BONUS_PRIORITE, etatCycle, nomCycle } from '../lib/cycle'
import { MUSCLES } from '../data/exercices'
import { analyser, aRetenir, libelleMesure, type Analyse } from '../lib/analyse'
import { debutPeriode, genererBilan, type DonneesBilan } from '../lib/bilan'
import { dateCourte, dateISO, duree, kg, lundi, niveauSensation, semaineType, volumePrevu } from '../lib/calc'
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
                fontSize: 'var(--t-petit)',
                fontWeight: actif ? 600 : 400,
                color: actif ? 'var(--accent)' : 'var(--texte-2)',
                background: actif ? 'var(--accent-voile)' : 'transparent',
                border: '1px solid ' + (actif ? 'var(--accent)' : 'var(--bord)'),
                borderRadius: 'var(--rayon-2)',
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
      <div className="faible" style={{ fontSize: 12, color: 'var(--texte-2)', marginBottom: 12 }}>
        Du {jour(a.debut)} au {jour(fin)}
        {comparable ? ` · comparé au ${jour(debutAvant)} – ${jour(finAvant)}` : ''}
      </div>

      {/* Carte À retenir : compacte si données insuffisantes, mise en valeur si insights */}
      {retenir.length > 0 && (
        retenir[0].startsWith('Pas encore assez') ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              fontSize: 'var(--t-legende)',
              color: 'var(--texte-2)',
              background: 'var(--surface-2)',
              borderRadius: 'var(--rayon-2)',
              border: '1px solid var(--voile)',
              marginBottom: 12,
            }}
          >
            <Sparkles size={14} strokeWidth={2} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span>{retenir[0]}</span>
          </div>
        ) : (
          <div
            className="carte pile a-retenir"
            style={{
              padding: '14px 16px',
              borderRadius: 'var(--rayon-2)',
              background: 'linear-gradient(145deg, var(--accent-voile) 0%, var(--surface-2) 100%)',
              border: '1px solid var(--accent-bord)',
              boxShadow: '0 4px 20px var(--accent-voile)',
              marginBottom: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent)' }}>
              <Sparkles size={16} strokeWidth={2} />
              <h3 style={{ margin: 0, fontSize: 'var(--t-texte)', fontWeight: 700, color: 'var(--texte)' }}>À retenir</h3>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--texte-2)', fontSize: 'var(--t-petit)' }}>
              {retenir.map((t) => (
                <li key={t} style={{ marginTop: 4 }}>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        )
      )}

      {/* Carte Assiduité et travail en grille 2x2 symétrique */}
      <div className="carte" style={{ padding: '16px', borderRadius: 'var(--rayon)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 'var(--t-texte)', fontWeight: 700 }}>Assiduité et travail</h3>
          <Aide titre="Assiduité & séries dures" texte="Une série dure est une série effective (RPE 7 ou plus, proche de l'échec). C'est ce travail de qualité qui stimule le muscle et déclenche la progression." />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          <Tuile valeur={a.prevues ? `${a.faites}/${a.prevues}` : String(a.seances)} label={a.prevues ? 'séances' : 'séances'} n={a.seances} m={avant.seances} comparable={comparable} />
          <Tuile valeur={a.temps ? duree(a.temps) : '0 min'} label="d’entraînement" n={a.temps} m={avant.temps} comparable={comparable} texteAvant={avant.temps ? duree(avant.temps) : '0 min'} />
          <Tuile valeur={String(a.dures)} label={a.dures > 1 ? 'séries dures' : 'série dure'} n={a.dures} m={avant.dures} comparable={comparable} />
          <Tuile valeur={kg(Math.round(a.tonnage)) + ' kg'} label="soulevés" n={a.tonnage} m={avant.tonnage} comparable={comparable} texteAvant={kg(Math.round(avant.tonnage)) + ' kg'} />
        </div>
        {(a.enchainees > 1 || a.deloads > 0) && (
          <div className="faible" style={{ marginTop: 10, fontSize: 'var(--t-petit)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {a.enchainees > 1 && <span>🔥 {a.enchainees} semaines d’affilée</span>}
            {a.deloads > 0 && <span>🧘 {a.deloads} séance(s) de déload</span>}
          </div>
        )}
      </div>

      {a.semaines.length > 1 && <SemaineParSemaine semaines={a.semaines} seances={seances} records={records} catalogue={catalogue} />}

      {/* Carte Volume musculaire */}
      <div className="carte" style={{ padding: '16px', borderRadius: 'var(--rayon)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <h3 style={{ margin: 0, fontSize: 'var(--t-texte)', fontWeight: 700 }}>Volume musculaire</h3>
            <Aide titre="Volume musculaire" texte="Nombre de séries effectives (dures) par groupe musculaire sur la période. L'idéal se situe généralement entre 10 et 20 séries par semaine selon le groupe." />
          </div>
          <div style={{ display: 'inline-flex', gap: 4, background: 'var(--surface-2)', padding: 3, borderRadius: 'var(--rayon-2)', border: '1px solid var(--voile)' }}>
            <button
              type="button"
              style={{
                padding: '3px 10px',
                fontSize: 'var(--t-legende)',
                fontWeight: vueMuscles === 'fait' ? 600 : 400,
                color: vueMuscles === 'fait' ? 'var(--texte)' : 'var(--texte-2)',
                background: vueMuscles === 'fait' ? 'var(--voile-fort)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--rayon-2)',
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
                fontSize: 'var(--t-legende)',
                fontWeight: vueMuscles === 'prevu' ? 600 : 400,
                color: vueMuscles === 'prevu' ? 'var(--texte)' : 'var(--texte-2)',
                background: vueMuscles === 'prevu' ? 'var(--voile-fort)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--rayon-2)',
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
            color: 'var(--accent)',
            fontSize: 'var(--t-petit)',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Intensité et forme</h3>
            <Aide titre="Intensité & forme" texte="Le RPE évalue l'effort ressenti de 6 à 10 (10 = échec, 8 = 2 reps en réserve). Le sommeil et la régularité nutritionnelle complètent ton niveau de forme." />
          </div>
          {(a.rpe !== null || a.ressenti !== null || a.energie !== null || a.sommeil || a.calories.ok + a.calories.trop + a.calories.pasAssez > 0) && (
            <div className="tuiles">
              {a.rpe !== null && <Tuile valeur={kg(arrondi(a.rpe))} label="RPE moyen" n={a.rpe} m={avant.rpe ?? undefined} comparable={avant.rpe !== null} neutre texteAvant={avant.rpe !== null ? kg(arrondi(avant.rpe)) : ''} />}
              {(() => {
                const formes = [a.energie, a.ressenti].filter((x): x is number => x !== null && x !== undefined)
                if (!formes.length) return null
                const forme = formes.reduce((x, y) => x + y, 0) / formes.length
                const formesAvant = [avant.energie, avant.ressenti].filter((x): x is number => x !== null && x !== undefined)
                const formeAvant = formesAvant.length ? formesAvant.reduce((x, y) => x + y, 0) / formesAvant.length : undefined
                const labelActuel = niveauSensation(forme)
                const labelAvant = formeAvant !== undefined ? niveauSensation(formeAvant) : ''
                return (
                  <Tuile
                    valeur={labelActuel}
                    label={`sensation moy. (${kg(arrondi(forme))}/5)`}
                    n={forme}
                    m={formeAvant}
                    comparable={formeAvant !== undefined}
                    texteAvant={labelAvant}
                  />
                )
              })()}
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
    <div className="carte pile" style={{ padding: '16px', borderRadius: 'var(--rayon)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <TrendingUp size={18} strokeWidth={2} style={{ color: 'var(--accent)' }} />
        <h3 style={{ margin: 0, fontSize: 'var(--t-texte)', fontWeight: 700 }}>Progression</h3>
        <Aide titre="Progression & 1RM" texte="Le 1RM estimé (charge théorique maximale sur 1 répétition) est calculé d'après tes séries pour mesurer tes gains réels même si tes répétitions changent." />
      </div>

      {a.records.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div className="faible" style={{ fontSize: 'var(--t-legende)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Award size={14} style={{ color: 'var(--alerte)' }} />
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
                      borderRadius: 'var(--rayon-2)',
                      background: 'var(--sous-carte)',
                      border: '1px solid var(--voile)',
                      cursor: onExo ? 'pointer' : 'default',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 'var(--t-petit)', fontWeight: 600, color: 'var(--texte)' }}>{r.exo.nom}</div>
                      <div className="faible" style={{ fontSize: 'var(--t-legende)', marginTop: 1 }}>
                        {l.length > 1 ? `${l.length} records · ${jour(r.date)}` : jour(r.date)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong style={{ color: 'var(--ok)', fontSize: 'var(--t-texte)' }}>{r.perf}</strong>
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
          <div className="faible" style={{ fontSize: 'var(--t-legende)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
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
                  borderRadius: 'var(--rayon-2)',
                  background: 'var(--sous-carte)',
                  border: '1px solid var(--voile)',
                  cursor: onExo ? 'pointer' : 'default',
                }}
              >
                <div>
                  <div style={{ fontSize: 'var(--t-petit)', fontWeight: 600, color: 'var(--texte)' }}>{p.exo.nom}</div>
                  <div className="faible" style={{ fontSize: 'var(--t-legende)', marginTop: 1 }}>
                    {p.detail ?? `1RM estimé : ${kg(arrondi(p.avant))} → ${kg(arrondi(p.apres))} kg`}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong style={{ color: 'var(--ok)', fontSize: 'var(--t-texte)' }}>+{kg(arrondi(p.pct))} %</strong>
                  {onExo && <ChevronRight size={16} strokeWidth={1.75} className="muted" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {a.stagnations.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div className="faible" style={{ fontSize: 'var(--t-legende)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
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
                  borderRadius: 'var(--rayon-2)',
                  background: 'var(--sous-carte)',
                  border: '1px solid var(--voile)',
                  cursor: onExo ? 'pointer' : 'default',
                }}
              >
                <div>
                  <div style={{ fontSize: 'var(--t-petit)', fontWeight: 600, color: 'var(--texte)' }}>{s.exo.nom}</div>
                  <div className="faible" style={{ fontSize: 'var(--t-legende)', marginTop: 1 }}>
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
        borderRadius: 'var(--rayon-2)',
        background: 'var(--sous-carte)',
        border: '1px solid var(--voile)',
        minHeight: 74,
      }}
    >
      <div>
        <div style={{ fontSize: 'var(--t-titre)', fontWeight: 800, color: 'var(--texte)', letterSpacing: '-0.3px' }}>{valeur}</div>
        <div className="faible" style={{ fontSize: 'var(--t-legende)', marginTop: 1, color: 'var(--texte-2)' }}>{label}</div>
      </div>
      {montre && (
        <span
          style={{
            fontSize: 'var(--t-legende)',
            marginTop: 4,
            fontWeight: 600,
            color: neutre ? 'var(--texte-2)' : n! > m! ? 'var(--ok)' : n! < m! ? 'var(--danger)' : 'var(--texte-2)',
          }}
        >
          {n! > m! ? '↑' : n! < m! ? '↓' : '='} vs {texteAvant ?? kg(arrondi(m!))}
        </span>
      )}
    </div>
  )
}
