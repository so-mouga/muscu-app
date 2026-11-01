import { useEffect, useState } from 'react'
import { db } from '../db'
import { dateCourte, dateISO, kg } from '../lib/calc'
import type { Pesee } from '../types'
import { informer } from './Dialogues'

/**
 * Pesée d'un jour (aujourd'hui par défaut), avec la moyenne sur 7 jours. `onDate` : la date se
 * change (pesée oubliée d'hier, correction d'une ancienne).
 */
export default function Poids({ pesees, aujourdhui, onDate }: { pesees: Pesee[]; aujourdhui: string; onDate?: (d: string) => void }) {
  const estAujourdhui = aujourdhui === dateISO()
  const duJour = pesees.find((p) => p.date === aujourdhui)
  const dernierPoids = [...pesees].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.poids
  const [valeur, setValeur] = useState(() => (dernierPoids && !duJour ? String(dernierPoids).replace('.', ',') : ''))
  const [touched, setTouched] = useState(false)
  const recentes = pesees.filter((p) => Date.parse(p.date) > Date.now() - 7 * 86400000)
  const moyenne = recentes.length ? recentes.reduce((a, p) => a + p.poids, 0) / recentes.length : null

  // Pré-remplir avec le dernier poids si l'utilisateur n'a pas encore touché le champ
  useEffect(() => {
    if (!touched && !valeur && dernierPoids && !duJour) {
      setValeur(String(dernierPoids).replace('.', ','))
    }
  }, [dernierPoids, duJour, touched, valeur])

  const ajuster = (delta: number) => {
    setTouched(true)
    const base = parseFloat((valeur || (dernierPoids ? String(dernierPoids) : '70')).trim().replace(',', '.')) || 70
    const nouveau = Math.round((base + delta) * 10) / 10
    setValeur(nouveau.toFixed(1).replace('.', ','))
  }

  const enregistrer = async () => {
    // Nombre complet seulement (« 72,3 ») : un champ mal tapé (« 71,572,3 ») est refusé, pas tronqué.
    const raw = valeur || (dernierPoids && !duJour ? String(dernierPoids) : '')
    const t = raw.trim().replace(',', '.')
    const poids = /^\d{2,3}(\.\d{1,2})?$/.test(t) ? parseFloat(t) : NaN
    if (!(poids > 30 && poids < 250)) return informer('Entre 30 et 250 kg, avec au plus 2 chiffres après la virgule : par exemple 72,3.', 'Poids non reconnu')
    await db.pesees.put({ date: aujourdhui, poids })
    // Séances faites sans poids noté : on leur donne celui-ci, pour le 1RM des exercices au poids du corps.
    await db.seances.filter((s) => !s.poidsCorps).modify((s) => {
      s.poidsCorps = poids
    })
    setValeur('')
    setTouched(false)
  }

  return (
    <div className="carte pile">
      <div className="ligne entre">
        <h3>{estAujourdhui ? 'Poids du jour' : `Pesée du ${dateCourte(aujourdhui)}`}</h3>
        {moyenne !== null && <span className="faible">moyenne 7 j : {kg(Math.round(moyenne * 10) / 10)} kg</span>}
      </div>
      {duJour ? (
        <div className="ligne entre">
          <span className="muted">
            <strong>{kg(duJour.poids)} kg</strong> noté {estAujourdhui ? 'aujourd’hui' : 'ce jour-là'}
          </span>
          {!valeur && (
            <button
              className="btn discret petit"
              onClick={() => {
                setValeur(String(duJour.poids).replace('.', ','))
                setTouched(true)
              }}
            >
              ✎ modifier
            </button>
          )}
        </div>
      ) : null}
      {(!duJour || valeur) && (
        <div className="ligne entre" style={{ gap: 8, alignItems: 'center' }}>
          <div className="ligne" style={{ gap: 6, alignItems: 'center' }}>
            <span className="mini-stepper compact">
              <button type="button" onClick={() => ajuster(-0.1)} aria-label="Diminuer de 0,1 kg">
                −
              </button>
              <input
                type="text"
                inputMode="decimal"
                enterKeyHint="done"
                className="duree"
                style={{ width: 68, textAlign: 'center', fontWeight: 700 }}
                placeholder={dernierPoids ? kg(dernierPoids) : 'ex. 70,4'}
                autoFocus={!!duJour}
                onFocus={(e) => {
                  if (!valeur && dernierPoids) setValeur(kg(dernierPoids))
                  e.target.select()
                }}
                value={valeur}
                onChange={(e) => {
                  setTouched(true)
                  setValeur(e.target.value)
                }}
                onKeyDown={(e) => e.key === 'Enter' && void enregistrer()}
              />
              <button type="button" onClick={() => ajuster(0.1)} aria-label="Augmenter de 0,1 kg">
                +
              </button>
            </span>
            <span className="faible" style={{ fontSize: 13 }}>kg</span>
          </div>
          <div className="ligne" style={{ gap: 6 }}>
            <button
              type="button"
              className="btn primaire petit"
              style={{ minHeight: 38, padding: '0 16px', fontWeight: 700 }}
              onClick={enregistrer}
            >
              OK
            </button>
            {duJour && (
              <button
                type="button"
                className="btn discret petit"
                style={{ minHeight: 38, padding: '0 10px' }}
                onClick={() => {
                  setValeur('')
                  setTouched(false)
                }}
                aria-label="Annuler"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}
      {onDate && (
        <label className="ligne entre petit">
          <span className="faible">Date de la pesée</span>
          <input
            type="date"
            value={aujourdhui}
            max={dateISO()}
            style={{ width: 'auto' }}
            onChange={(e) => e.target.value && (onDate(e.target.value), setValeur(''), setTouched(false))}
          />
        </label>
      )}
      <div className="faible">Sert aussi à estimer ta force (1RM estimé) aux tractions et aux dips. Seule la moyenne compte, pas la variation d’un jour.</div>
    </div>
  )
}
