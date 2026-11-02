import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { Catalogue } from '../catalogue'
import { db } from '../db'
import { informer } from './Dialogues'
import { dateISO, kg } from '../lib/calc'
import { useRetour } from '../lib/nav'
import { objectifDuJour } from '../lib/nutrition'
import type { JourJournal } from '../types'

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

const TEXTE_CALORIES: Record<NonNullable<JourJournal['calories']>, string> = { ok: 'Tenu', trop: 'Trop', pasAssez: 'Pas assez' }

type Saisie = 'poids' | 'sommeil' | 'calories'

/**
 * Journal du matin sur l'accueil : poids, sommeil et calories d'hier (si un objectif est fixé), toujours
 * au même endroit, la valeur en grand ou « Noter ». Un appui ouvre la saisie dans une fenêtre, rien ne
 * bouge dans l'écran et rien n'est jamais pré-rempli pour le sommeil ou les calories.
 */
function CaseJour({ valeur, nom, onClick }: { valeur?: string; nom: string; onClick: () => void }) {
  return (
    <button type="button" className="case-jour" onClick={onClick}>
      <span className={valeur ? 'case-jour-valeur' : 'case-jour-valeur a-noter'}>{valeur ?? 'Noter ›'}</span>
      <span className="case-jour-nom">{nom}</span>
    </button>
  )
}

export default function JournalMatin({ catalogue }: { catalogue: Catalogue }) {
  const aujourdhui = dateISO()
  const hier = dateISO(new Date(Date.now() - JOUR))
  const dernierePesee = useLiveQuery(() => db.pesees.orderBy('date').last(), [])
  const peseeDuJour = useLiveQuery(() => db.pesees.get(aujourdhui), [aujourdhui])
  const duJour = useLiveQuery(() => db.journal.get(aujourdhui), [aujourdhui])
  const dHier = useLiveQuery(() => db.journal.get(hier), [hier])
  const [saisie, setSaisie] = useState<Saisie | null>(null)
  const [valPoids, setValPoids] = useState('')
  const [poidsDepart, setPoidsDepart] = useState('')
  const objectif = objectifDuJour(catalogue.objectifs, aujourdhui)

  const ouvrirPoids = () => {
    const v = kg(peseeDuJour?.poids ?? dernierePesee?.poids ?? 70)
    setValPoids(v)
    setPoidsDepart(v)
    setSaisie('poids')
  }

  const enregistrerPoids = async () => {
    const t = valPoids.trim().replace(',', '.')
    const val = /^\d{2,3}(\.\d{1,2})?$/.test(t) ? parseFloat(t) : NaN
    if (!(val > 30 && val < 250)) return informer('Entre 30 et 250 kg, avec au plus 2 chiffres après la virgule : par exemple 72,3.', 'Poids non reconnu')
    const arr = Math.round(val * 10) / 10
    await db.pesees.put({ date: aujourdhui, poids: arr })
    await db.seances.filter((s) => !s.poidsCorps).modify((s) => {
      s.poidsCorps = arr
    })
    setSaisie(null)
  }

  const ajusterPoids = (delta: number) => {
    const cur = parseFloat(valPoids.trim().replace(',', '.'))
    if (Number.isFinite(cur)) setValPoids(kg(Math.round((cur + delta) * 10) / 10))
  }

  // Un appui à côté ou le retour Android gardent le poids réglé ; sans changement, rien n'est noté.
  const fermer = () => {
    if (saisie === 'poids' && valPoids !== poidsDepart) return void enregistrerPoids()
    setSaisie(null)
  }
  useRetour(saisie !== null, fermer)

  const avecCalories = !!objectif
  return (
    <div className="journal-matin">
      <CaseJour nom="Poids" valeur={peseeDuJour && `${kg(peseeDuJour.poids)} kg`} onClick={ouvrirPoids} />
      <CaseJour nom="Sommeil" valeur={duJour?.sommeil !== undefined ? heures(duJour.sommeil) : undefined} onClick={() => setSaisie('sommeil')} />
      {avecCalories && <CaseJour nom="Calories d’hier" valeur={dHier?.calories && TEXTE_CALORIES[dHier.calories]} onClick={() => setSaisie('calories')} />}

      {saisie &&
        createPortal(
          <div className="modal-fond" onClick={fermer}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              {saisie === 'poids' && (
                <div className="pile">
                  <h2>Poids du jour</h2>
                  <div className="stepper">
                    <button type="button" onClick={() => ajusterPoids(-0.1)} aria-label="Moins 0,1 kg">
                      −
                    </button>
                    <div className="valeur">
                      <input type="text" inputMode="decimal" enterKeyHint="done" aria-label="Poids en kg" value={valPoids} onFocus={(e) => e.target.select()} onChange={(e) => setValPoids(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void enregistrerPoids()} />
                      <span className="unite">kg</span>
                    </div>
                    <button type="button" onClick={() => ajusterPoids(0.1)} aria-label="Plus 0,1 kg">
                      +
                    </button>
                  </div>
                  <button type="button" className="btn primaire plein" onClick={() => void enregistrerPoids()}>
                    Noter ce poids
                  </button>
                  <button type="button" className="btn discret plein" onClick={() => setSaisie(null)}>
                    Annuler
                  </button>
                </div>
              )}
              {saisie === 'sommeil' && (
                <div className="pile">
                  <h2>Sommeil cette nuit</h2>
                  <div className="rpe" style={{ gridTemplateColumns: `repeat(${HEURES.length}, 1fr)` }}>
                    {HEURES.map(([h, txt]) => (
                      <button key={h} type="button" className={duJour?.sommeil === h ? 'actif' : ''} onClick={() => void noterJournal(aujourdhui, { sommeil: h }).then(() => setSaisie(null))}>
                        {txt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {saisie === 'calories' && objectif && (
                <div className="pile">
                  <div>
                    <h2>Calories d’hier</h2>
                    <div className="faible">Objectif : {objectif.kcal.toLocaleString('fr-FR')} kcal</div>
                  </div>
                  <div className="rpe" style={{ gridTemplateColumns: `repeat(${CALORIES.length}, 1fr)` }}>
                    {CALORIES.map(([id, nom]) => (
                      <button key={id} type="button" className={dHier?.calories === id ? 'actif' : ''} onClick={() => void noterJournal(hier, { calories: dHier?.calories === id ? undefined : id }).then(() => setSaisie(null))}>
                        {nom}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
