import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Moon, Flame, Check } from 'lucide-react'
import type { Catalogue } from '../catalogue'
import { db } from '../db'
import { informer } from './Dialogues'
import { dateISO, kg } from '../lib/calc'
import { objectifDuJour } from '../lib/nutrition'
import type { JourJournal, Seance } from '../types'

const JOUR = 86400000
export const heures = (h: number) => `${Math.floor(h)} h${h % 1 ? ` ${String(Math.round((h % 1) * 60)).padStart(2, '0')}` : ''}`
export const HEURES: [number, string][] = [
  [5, '≤5h'],
  [6, '6h'],
  [7, '7h'],
  [8, '8h'],
  [9, '9h+'],
]
export const CALORIES: [NonNullable<JourJournal['calories']>, string][] = [
  ['ok', '✓ Tenu'],
  ['trop', '+ Trop'],
  ['pasAssez', '− Pas assez'],
]

/** Relu en base : sommeil et calories notés coup sur coup ne s'écrasent pas. */
export const noterJournal = (date: string, c: Partial<JourJournal>) =>
  db.transaction('rw', db.journal, async () => db.journal.put({ ...(await db.journal.get(date)), ...c, date }))

/**
 * Carte Aujourd'hui de l'accueil :
 * Grille compacte Poids / Sommeil (style Linear), suivi des calories.
 */
export default function JournalMatin({
  catalogue,
}: {
  catalogue: Catalogue
  terminees?: Seance[]
  entrainement: boolean
  deload?: boolean
}) {
  const aujourdhui = dateISO()
  const hier = dateISO(new Date(Date.now() - JOUR))
  const pesees = useLiveQuery(() => db.pesees.where('date').aboveOrEqual(dateISO(new Date(Date.now() - 14 * JOUR))).sortBy('date'), [], [])
  const journal = useLiveQuery(() => db.journal.where('date').aboveOrEqual(dateISO(new Date(Date.now() - 30 * JOUR))).sortBy('date'), [], null)
  const [saisieSommeil, setSaisieSommeil] = useState(false)
  const [saisiePoids, setSaisiePoids] = useState(false)
  const [valPoids, setValPoids] = useState<string>('')
  if (journal === null) return null

  const duJour = journal.find((j) => j.date === aujourdhui)
  const dHier = journal.find((j) => j.date === hier)
  const noter = noterJournal

  const pesee = pesees.find((p) => p.date === aujourdhui)
  const poids = pesees[pesees.length - 1]?.poids
  const objectif = objectifDuJour(catalogue.objectifs, aujourdhui)

  const toggleSaisiePoids = () => {
    if (saisiePoids) {
      setSaisiePoids(false)
    } else {
      const init = pesee ? pesee.poids : poids ?? 70
      setValPoids(kg(init))
      setSaisiePoids(true)
      setSaisieSommeil(false)
    }
  }

  const toggleSaisieSommeil = () => {
    if (saisieSommeil) {
      setSaisieSommeil(false)
    } else {
      setSaisieSommeil(true)
      setSaisiePoids(false)
    }
  }

  const enregistrerPoids = async () => {
    const t = (valPoids || (poids ? kg(poids) : '70')).trim().replace(',', '.')
    const val = /^\d{2,3}(\.\d{1,2})?$/.test(t) ? parseFloat(t) : NaN
    if (!(val > 30 && val < 250)) return informer('Entre 30 et 250 kg, avec au plus 2 chiffres après la virgule : par exemple 72,3.', 'Poids non reconnu')
    {
      const arr = Math.round(val * 10) / 10
      await db.pesees.put({ date: aujourdhui, poids: arr })
      await db.seances.filter((s) => !s.poidsCorps).modify((s) => {
        s.poidsCorps = arr
      })
      setSaisiePoids(false)
    }
  }

  const ajusterPoids = (delta: number) => {
    const t = (valPoids || (poids ? kg(poids) : '70')).trim().replace(',', '.')
    const cur = /^\d{2,3}(\.\d{1,2})?$/.test(t) ? parseFloat(t) : (poids ?? 70)
    const nouv = Math.round((cur + delta) * 10) / 10
    setValPoids(kg(nouv))
  }

  return (
    <div className="carte pile journal-matin" style={{ padding: '16px', borderRadius: 16, gap: 12 }}>
      <h3 style={{ margin: '0 0 2px', fontSize: '1.15rem', fontWeight: 700 }}>Aujourd’hui</h3>

      {/* Grille Poids & Sommeil (2 colonnes) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {/* Tuile Poids */}
        <button
          type="button"
          onClick={toggleSaisiePoids}
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            padding: '14px',
            borderRadius: 14,
            background: 'var(--subcard-gradient)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            cursor: 'pointer',
            textAlign: 'left',
            width: '100%',
            minHeight: 88,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', color: 'var(--texte-faible)' }}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="18" x="3" y="3" rx="4" />
              <path d="M8 7h8" />
              <path d="M12 7v3" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--texte)' }}>
              {pesee ? `${kg(pesee.poids)} kg` : <span className="faible" style={{ fontSize: '0.95rem' }}>—</span>}
            </div>
            <div className="faible" style={{ fontSize: '0.82rem', marginTop: 1 }}>Poids</div>
          </div>
        </button>

        {/* Tuile Sommeil */}
        <button
          type="button"
          onClick={toggleSaisieSommeil}
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            padding: '14px',
            borderRadius: 14,
            background: 'var(--subcard-gradient)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            cursor: 'pointer',
            textAlign: 'left',
            width: '100%',
            minHeight: 88,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span style={{ color: '#8e8eff', display: 'flex', alignItems: 'center' }}><Moon size={18} strokeWidth={1.75} /></span>
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--texte)' }}>
              {duJour?.sommeil !== undefined ? heures(duJour.sommeil) : <span className="faible" style={{ fontSize: '0.95rem' }}>—</span>}
            </div>
            <div className="faible" style={{ fontSize: '0.82rem', marginTop: 1 }}>Sommeil</div>
          </div>
        </button>
      </div>

      {/* Saisie Poids dépliée */}
      {saisiePoids && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 12px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 8, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--texte-faible)' }}>Poids du jour</span>
          <div className="ligne" style={{ gap: 6, alignItems: 'center' }}>
            <span className="mini-stepper compact">
              <button type="button" onClick={() => ajusterPoids(-0.1)} aria-label="Moins 0,1 kg">
                −
              </button>
              <input
                type="text"
                inputMode="decimal"
                enterKeyHint="done"
                className="duree"
                value={valPoids || (poids ? kg(poids) : '70')}
                onFocus={(e) => {
                  if (!valPoids) setValPoids(poids ? kg(poids) : '70')
                  e.target.select()
                }}
                onChange={(e) => setValPoids(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void enregistrerPoids()}
              />
              <button type="button" onClick={() => ajusterPoids(0.1)} aria-label="Plus 0,1 kg">
                +
              </button>
            </span>
            <button
              type="button"
              className="btn primaire petit"
              style={{ width: 34, height: 34, minHeight: 34, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => void enregistrerPoids()}
              aria-label="Valider"
            >
              <Check size={18} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              className="btn discret petit"
              style={{ width: 30, height: 34, minHeight: 34, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => setSaisiePoids(false)}
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Saisie Sommeil dépliée */}
      {saisieSommeil && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 8, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--texte-faible)' }}>Sommeil cette nuit</span>
          <div className="rpe" style={{ gridTemplateColumns: `repeat(${HEURES.length}, 1fr)` }}>
            {HEURES.map(([h, txt]) => (
              <button
                key={h}
                className={duJour?.sommeil === h ? 'actif' : ''}
                onClick={() => void noter(aujourdhui, { sommeil: h }).then(() => setSaisieSommeil(false))}
              >
                {txt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Inset Box Calories (comme dans la maquette) */}
      <div
        style={{
          marginTop: 6,
          padding: '14px 16px',
          borderRadius: 14,
          background: 'var(--subcard-gradient)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.88rem', color: 'var(--texte-faible)' }}>
            Hier : <strong style={{ color: 'var(--texte)' }}>Calories</strong>
          </span>
          <div style={{ display: 'inline-flex', gap: 6 }}>
            {CALORIES.map(([id, nom]) => {
              const actif = dHier?.calories === id
              return (
                <button
                  key={id}
                  type="button"
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.78rem',
                    fontWeight: actif ? 600 : 400,
                    color: actif ? 'var(--texte)' : 'var(--texte-faible)',
                    background: actif ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid ' + (actif ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.06)'),
                    borderRadius: 20,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onClick={() => void noter(hier, { calories: actif ? undefined : id })}
                >
                  {nom}
                </button>
              )
            })}
          </div>
        </div>

        {objectif && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, paddingTop: 8, borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--texte-faible)' }}>
              Cible : <strong style={{ color: 'var(--texte)' }}>{objectif.kcal.toLocaleString('fr-FR')} kcal</strong>
            </span>
            <Flame size={16} strokeWidth={1.75} style={{ color: '#ff6b00' }} />
          </div>
        )}
      </div>
    </div>
  )
}
