import { useState } from 'react'
import { db } from '../db'
import { kg } from '../lib/calc'
import type { Pesee } from '../types'

/** Poids du jour (moyenne sur 7 jours) ; sur l'accueil, avec le lien vers la page Corps. */
export default function Poids({ pesees, aujourdhui, onCorps, derniereMesure }: { pesees: Pesee[]; aujourdhui: string; onCorps?: () => void; derniereMesure?: string }) {
  const duJour = pesees.find((p) => p.date === aujourdhui)
  const [valeur, setValeur] = useState('')
  const recentes = pesees.filter((p) => Date.parse(p.date) > Date.now() - 7 * 86400000)
  const moyenne = recentes.length ? recentes.reduce((a, p) => a + p.poids, 0) / recentes.length : null

  const enregistrer = async () => {
    const poids = parseFloat(valeur.replace(',', '.'))
    if (!(poids > 30 && poids < 250)) return
    await db.pesees.put({ date: aujourdhui, poids })
    setValeur('')
  }

  return (
    <div className="carte pile">
      <div className="ligne entre">
        <h3>Poids du jour</h3>
        {moyenne !== null && <span className="faible">moyenne 7 j : {kg(Math.round(moyenne * 10) / 10)} kg</span>}
      </div>
      {duJour ? (
        <div className="muted">
          {kg(duJour.poids)} kg noté aujourd’hui{' '}
          <button className="btn discret petit" onClick={() => setValeur(String(duJour.poids))}>
            modifier
          </button>
        </div>
      ) : null}
      {(!duJour || valeur) && (
        <div className="ligne">
          <input inputMode="decimal" placeholder="ex. 70,4" value={valeur} onChange={(e) => setValeur(e.target.value)} />
          <button className="btn primaire" onClick={enregistrer}>
            OK
          </button>
        </div>
      )}
      <div className="faible">Sert aussi au calcul de l’e1RM des tractions et dips. Seule la moyenne compte, pas la variation d’un jour.</div>
      {onCorps && <LienCorps onCorps={onCorps} derniereMesure={derniereMesure} />}
    </div>
  )
}

/** Rappel des mensurations au-delà de 3 semaines, et accès à la page Corps. */
function LienCorps({ onCorps, derniereMesure }: { onCorps: () => void; derniereMesure?: string }) {
  const jours = derniereMesure ? Math.floor((Date.now() - Date.parse(derniereMesure + 'T12:00:00')) / 86400000) : null
  const enRetard = jours === null || jours > 21
  return (
    <button className="liste-btn" style={{ marginBottom: 0 }} onClick={onCorps}>
      <span>
        <strong>📏 Mensurations et photos</strong>
        <div className="faible" style={enRetard ? { color: 'var(--alerte)' } : undefined}>
          {jours === null
            ? 'Pas encore prises : un repère utile en plus du poids'
            : jours === 0
              ? 'Prises aujourd’hui'
              : `Il y a ${jours} jour${jours > 1 ? 's' : ''}${enRetard ? ' · pense à les reprendre' : ''}`}
        </div>
      </span>
      <span className="muted">›</span>
    </button>
  )
}
