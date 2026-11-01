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
    const base = parseFloat(valeur.trim().replace(',', '.')) || dernierPoids || 70
    const nouveau = Math.round((base + delta) * 10) / 10
    setValeur(nouveau.toFixed(1).replace('.', ','))
  }

  const enregistrer = async () => {
    // Nombre complet seulement (« 72,3 ») : un champ mal tapé (« 71,572,3 ») est refusé, pas tronqué.
    const t = valeur.trim().replace(',', '.')
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
        <div className="muted">
          {kg(duJour.poids)} kg noté {estAujourdhui ? 'aujourd’hui' : 'ce jour-là'}{' '}
          {!valeur && (
            <button
              className="btn discret petit"
              onClick={() => {
                setValeur(String(duJour.poids).replace('.', ','))
                setTouched(true)
              }}
            >
              modifier
            </button>
          )}
        </div>
      ) : null}
      {(!duJour || valeur) && (
        <div className="pile" style={{ gap: 10 }}>
          <div className="stepper">
            <button type="button" onClick={() => ajuster(-0.1)} aria-label="Diminuer de 0,1 kg">
              −
            </button>
            <div className="valeur">
              <input
                inputMode="decimal"
                enterKeyHint="done"
                placeholder={dernierPoids ? kg(dernierPoids) : 'ex. 70,4'}
                autoFocus={!!duJour}
                onFocus={(e) => e.target.select()}
                value={valeur}
                onChange={(e) => {
                  setTouched(true)
                  setValeur(e.target.value)
                }}
                onKeyDown={(e) => e.key === 'Enter' && void enregistrer()}
              />
              <span className="unite">kg · ±0,1</span>
            </div>
            <button type="button" onClick={() => ajuster(0.1)} aria-label="Augmenter de 0,1 kg">
              +
            </button>
          </div>
          <div className="ligne" style={{ gap: 8 }}>
            <button className="btn primaire plein" style={{ flex: 1 }} onClick={enregistrer}>
              {duJour ? 'Mettre à jour' : 'Enregistrer le poids'}
            </button>
            {duJour && (
              <button
                type="button"
                className="btn discret"
                onClick={() => {
                  setValeur('')
                  setTouched(false)
                }}
              >
                Annuler
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
