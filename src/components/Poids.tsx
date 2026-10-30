import { useState } from 'react'
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
  const [valeur, setValeur] = useState('')
  const recentes = pesees.filter((p) => Date.parse(p.date) > Date.now() - 7 * 86400000)
  const moyenne = recentes.length ? recentes.reduce((a, p) => a + p.poids, 0) / recentes.length : null

  const enregistrer = async () => {
    // Nombre complet seulement (« 72,3 ») : un champ mal tapé (« 71,572,3 ») est refusé, pas tronqué.
    const t = valeur.trim().replace(',', '.')
    const poids = /^\d{2,3}(\.\d{1,2})?$/.test(t) ? parseFloat(t) : NaN
    if (!(poids > 30 && poids < 250)) return informer('Tape par exemple 72,3.', 'Poids non reconnu')
    await db.pesees.put({ date: aujourdhui, poids })
    // Séances faites sans poids noté : on leur donne celui-ci, pour le 1RM des exercices au poids du corps.
    await db.seances.filter((s) => !s.poidsCorps).modify((s) => {
      s.poidsCorps = poids
    })
    setValeur('')
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
          <button className="btn discret petit" onClick={() => setValeur(String(duJour.poids).replace('.', ','))}>
            modifier
          </button>
        </div>
      ) : null}
      {(!duJour || valeur) && (
        <div className="ligne">
          <input
            inputMode="decimal"
            enterKeyHint="done"
            placeholder="ex. 70,4"
            autoFocus={!!duJour}
            onFocus={(e) => e.target.select()}
            value={valeur} onChange={(e) => setValeur(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void enregistrer()} />
          <button className="btn primaire" onClick={enregistrer}>
            OK
          </button>
        </div>
      )}
      {onDate && (
        <label className="ligne entre petit">
          <span className="faible">Date de la pesée</span>
          <input type="date" value={aujourdhui} max={dateISO()} style={{ width: 'auto' }} onChange={(e) => e.target.value && (onDate(e.target.value), setValeur(''))} />
        </label>
      )}
      <div className="faible">Sert aussi au calcul de l’e1RM des tractions et dips. Seule la moyenne compte, pas la variation d’un jour.</div>
    </div>
  )
}
