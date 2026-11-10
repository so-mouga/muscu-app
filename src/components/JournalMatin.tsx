import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { Catalogue } from '../catalogue'
import { db } from '../db'
import { informer } from './Dialogues'
import { dateISO, kg, lirePoids, poidsDecale } from '../lib/calc'
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

export const TEXTE_CALORIES: Record<NonNullable<JourJournal['calories']>, string> = { ok: 'Tenu', trop: 'Trop', pasAssez: 'Pas assez' }

export type SaisieJour = 'poids' | 'sommeil' | 'calories'

/**
 * Journal du matin sur l'accueil : poids, sommeil et calories d'hier (si un objectif est fixé), toujours
 * au même endroit, la valeur en grand ou « Noter ». Un appui ouvre la saisie dans une fenêtre, rien ne
 * bouge dans l'écran et rien n'est jamais pré-rempli pour le sommeil ou les calories.
 */
export function CaseJour({ valeur, nom, onClick }: { valeur?: string; nom: string; onClick: () => void }) {
  return (
    <button type="button" className="case-jour" onClick={onClick}>
      <span className={valeur ? 'case-jour-valeur' : 'case-jour-valeur a-noter'}>{valeur ?? 'Noter ›'}</span>
      <span className="case-jour-nom">{nom}</span>
    </button>
  )
}

/**
 * La saisie d'un jour, la même à l'accueil et dans le Journal. Poids : un appui à côté ou le retour Android
 * gardent ce qui a changé, sans changement rien n'est noté, « Annuler » ne garde rien.
 */
export function FenetreJour({
  saisie,
  date,
  catalogue,
  journal,
  poidsDuJour,
  poidsRepere,
  onFermer,
}: {
  saisie: SaisieJour
  date: string
  catalogue: Catalogue
  journal?: JourJournal
  poidsDuJour?: number
  /** Dernier poids connu : point de départ quand ce jour n'a pas de pesée. */
  poidsRepere?: number
  onFermer: () => void
}) {
  const depart = kg(poidsDuJour ?? poidsRepere ?? 70)
  const [valPoids, setValPoids] = useState(depart)
  const objectif = objectifDuJour(catalogue.objectifs, date)
  const aujourdhui = dateISO()
  const court = new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  const titrePoids = date === aujourdhui ? 'Poids du jour' : `Poids du ${court}`
  const titreSommeil = date === aujourdhui ? 'Sommeil cette nuit' : `Sommeil du ${court}`
  const hier = dateISO(new Date(Date.now() - JOUR))
  const titreCalories = date === hier ? 'Calories d’hier' : date === aujourdhui ? 'Calories du jour' : `Calories du ${court}`

  const enregistrerPoids = async () => {
    const arr = lirePoids(valPoids)
    if (arr === null) return informer('Entre 30 et 250 kg, avec au plus 2 chiffres après la virgule : par exemple 72,3.', 'Poids non reconnu')
    await db.pesees.put({ date, poids: arr })
    await db.seances.filter((s) => !s.poidsCorps && (s.date === date || (date === aujourdhui && s.enCours))).modify((s) => {
      s.poidsCorps = arr
    })
    onFermer()
  }

  const ajusterPoids = (delta: number) => {
    const cur = parseFloat(valPoids.trim().replace(',', '.'))
    if (Number.isFinite(cur)) setValPoids(kg(poidsDecale(cur, delta)))
  }

  const fermer = () => {
    if (saisie === 'poids' && valPoids !== depart) return void enregistrerPoids()
    onFermer()
  }
  useRetour(true, fermer)

  return createPortal(
    <div className="modal-fond" onClick={fermer}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {saisie === 'poids' && (
          <div className="pile">
            <h2>{titrePoids}</h2>
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
            <button type="button" className="btn discret plein" onClick={onFermer}>
              Annuler
            </button>
            {poidsDuJour !== undefined && (
              <button type="button" className="btn discret danger plein" onClick={() => void db.pesees.delete(date).then(onFermer)}>
                Effacer cette pesée
              </button>
            )}
          </div>
        )}
        {saisie === 'sommeil' && (
          <div className="pile">
            <h2>{titreSommeil}</h2>
            {journal?.sommeilMontre && journal.sommeil !== undefined ? (
              // La montre fait foi : sa nuit ne se modifie pas (choix de l'utilisateur, 10 nov. 2026).
              <>
                <div>
                  Mesuré par ta montre : <strong>{heures(journal.sommeil)}</strong>
                </div>
                <div className="faible">Éveils retirés, lu dans Health Connect. C’est ce chiffre qui compte dans ton Bilan et ce que tu partages.</div>
                <button type="button" className="btn plein" onClick={onFermer}>
                  Fermer
                </button>
              </>
            ) : (
              <div className="rpe" style={{ gridTemplateColumns: `repeat(${HEURES.length}, 1fr)` }}>
                {HEURES.map(([h, txt]) => (
                  <button key={h} type="button" className={journal?.sommeil === h ? 'actif' : ''} onClick={() => void noterJournal(date, { sommeil: h, sommeilMontre: false }).then(onFermer)}>
                    {txt}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {saisie === 'calories' && (
          <div className="pile">
            <div>
              <h2>{titreCalories}</h2>
              {objectif && <div className="faible">Objectif : {objectif.kcal.toLocaleString('fr-FR')} kcal</div>}
            </div>
            <div className="rpe" style={{ gridTemplateColumns: `repeat(${CALORIES.length}, 1fr)` }}>
              {CALORIES.map(([id, nom]) => (
                <button key={id} type="button" className={journal?.calories === id ? 'actif' : ''} onClick={() => void noterJournal(date, { calories: journal?.calories === id ? undefined : id }).then(onFermer)}>
                  {nom}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

export default function JournalMatin({ catalogue }: { catalogue: Catalogue }) {
  const aujourdhui = dateISO()
  const hier = dateISO(new Date(Date.now() - JOUR))
  const dernierePesee = useLiveQuery(() => db.pesees.orderBy('date').last(), [])
  const peseeDuJour = useLiveQuery(() => db.pesees.get(aujourdhui), [aujourdhui])
  const duJour = useLiveQuery(() => db.journal.get(aujourdhui), [aujourdhui])
  const dHier = useLiveQuery(() => db.journal.get(hier), [hier])
  const [saisie, setSaisie] = useState<SaisieJour | null>(null)
  const objectif = objectifDuJour(catalogue.objectifs, aujourdhui)

  return (
    <div className="journal-matin">
      <CaseJour nom="Poids" valeur={peseeDuJour && `${kg(peseeDuJour.poids)} kg`} onClick={() => setSaisie('poids')} />
      <CaseJour nom="Sommeil" valeur={duJour?.sommeil !== undefined ? heures(duJour.sommeil) : undefined} onClick={() => setSaisie('sommeil')} />
      {objectif && <CaseJour nom="Calories d’hier" valeur={dHier?.calories && TEXTE_CALORIES[dHier.calories]} onClick={() => setSaisie('calories')} />}
      {saisie && <FenetreJour saisie={saisie} date={saisie === 'calories' ? hier : aujourdhui} catalogue={catalogue} journal={saisie === 'calories' ? dHier : duJour} poidsDuJour={peseeDuJour?.poids} poidsRepere={dernierePesee?.poids} onFermer={() => setSaisie(null)} />}
    </div>
  )
}
