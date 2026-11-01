import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import type { Catalogue } from '../catalogue'
import { db } from '../db'
import { informer } from './Dialogues'
import { chargeQte, dateISO, kg } from '../lib/calc'
import { conseilRepas } from '../lib/journal'
import { depuisDebut } from '../lib/motivation'
import { etatCycle } from '../lib/cycle'
import { CLE_PROFIL, objectifDuJour, type Profil } from '../lib/nutrition'
import { nomPhase, phaseA } from '../lib/objectifs'
import type { JourJournal, Seance } from '../types'

const JOUR = 86400000
export const heures = (h: number) => `${Math.floor(h)} h${h % 1 ? ` ${String(Math.round((h % 1) * 60)).padStart(2, '0')}` : ''}`
/** Choix du sommeil en un appui : de 5 h (ou moins) à 9 h (ou plus) en heures pleines. */
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

/** Pèse-personne de salle de bain avec écran digital. */
export function PictoPesePersonne({ taille = 18 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: -3, marginRight: 6 }}>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <rect x="8" y="6" width="8" height="4" rx="1" strokeWidth="1.5" />
    </svg>
  )
}

/** Relu en base : sommeil et calories notés coup sur coup ne s'écrasent pas. */
export const noterJournal = (date: string, c: Partial<JourJournal>) => db.transaction('rw', db.journal, async () => db.journal.put({ ...(await db.journal.get(date)), ...c, date }))

/** de l'accueil : pesée, sommeil de la nuit, calories de la veille (un appui
 * chacun, tout facultatif), l'assiette du jour selon la phase et un vrai progrès. Ce qui est noté va
 * dans la table `journal`, pour le Bilan.
 */
export default function JournalMatin({ catalogue, terminees, entrainement, deload = false, onCorps }: { catalogue: Catalogue; terminees?: Seance[]; entrainement: boolean; deload?: boolean; onCorps: () => void }) {
  const aujourdhui = dateISO()
  const hier = dateISO(new Date(Date.now() - JOUR))
  const pesees = useLiveQuery(() => db.pesees.where('date').aboveOrEqual(dateISO(new Date(Date.now() - 14 * JOUR))).sortBy('date'), [], [])
  const journal = useLiveQuery(() => db.journal.where('date').aboveOrEqual(dateISO(new Date(Date.now() - 30 * JOUR))).sortBy('date'), [], null)
  const profil = useLiveQuery(() => db.reglages.get(CLE_PROFIL), [], null)
  const phase = phaseA(catalogue.objectifs, aujourdhui)
  const [nuit, setNuit] = useState<number | null>(null)
  const [saisiePoids, setSaisiePoids] = useState(false)
  const [valPoids, setValPoids] = useState<string>('')
  if (journal === null || profil === null) return null

  const duJour = journal.find((j) => j.date === aujourdhui)
  const dHier = journal.find((j) => j.date === hier)
  const noter = noterJournal

  const pesee = pesees.find((p) => p.date === aujourdhui)
  const poids = pesees[pesees.length - 1]?.poids
  const objectif = objectifDuJour(catalogue.objectifs, aujourdhui, profil?.valeur as Profil | undefined, poids, catalogue.planning.length)
  const objectifHier = objectifDuJour(catalogue.objectifs, hier, profil?.valeur as Profil | undefined, poids, catalogue.planning.length)
  const repas = conseilRepas(phase?.phase, entrainement, deload)
  // Progrès du bloc en charge × reps : depuis le début du cycle en cours, sinon de la phase, sinon 4 semaines.
  const etatC = catalogue.cycle && etatCycle(catalogue.cycle)
  const blocCycle = catalogue.cycle && etatC && etatC.n >= 1 && !etatC.fini ? catalogue.cycle.debut : undefined
  const depuis = blocCycle ?? phase?.debut ?? dateISO(new Date(Date.now() - 28 * JOUR))
  const progres = terminees ? depuisDebut(terminees, catalogue.exo, depuis) : []

  const ouvrirSaisiePoids = () => {
    const init = pesee ? pesee.poids : poids ?? 70
    setValPoids(kg(init))
    setSaisiePoids(true)
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

  // Sommeil : rien de pré-rempli (un appui distrait noterait une fausse nuit) ; on choisit, ça enregistre.
  const enSaisie = nuit !== null || duJour?.sommeil === undefined

  return (
    <div className="carte pile journal-matin">
      <h3>Aujourd’hui</h3>
      {saisiePoids || !pesee ? (
          <div className="ligne-jour" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '4px 0', width: '100%' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', flexShrink: 0 }}>
              <PictoPesePersonne /> <strong>Poids</strong>
            </span>
            <div className="ligne" style={{ gap: 6, alignItems: 'center', flexShrink: 0 }}>
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
                style={{ width: 34, height: 34, minHeight: 34, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 700 }}
                onClick={() => void enregistrerPoids()}
                aria-label="Valider"
              >
                ✓
              </button>
              {pesee && (
                <button
                  type="button"
                  className="btn discret petit"
                  style={{ width: 30, height: 34, minHeight: 34, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}
                  onClick={() => setSaisiePoids(false)}
                  aria-label="Annuler"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="ligne entre" style={{ width: '100%' }}>
            <button
              type="button"
              className="ligne-jour"
              style={{ flex: 1, padding: 0, background: 'none', border: 'none', textAlign: 'left', display: 'inline-flex', alignItems: 'center' }}
              onClick={ouvrirSaisiePoids}
            >
              <span>
                <PictoPesePersonne /> <strong>{kg(pesee.poids)} kg ce matin</strong>
              </span>
            </button>
            <div className="ligne" style={{ gap: 2 }}>
              <button
                type="button"
                className="btn discret petit"
                aria-label="Modifier la pesée"
                onClick={ouvrirSaisiePoids}
                style={{ padding: '4px 8px' }}
              >
                ✎
              </button>
              {onCorps && (
                <button
                  type="button"
                  className="btn discret petit"
                  aria-label="Voir les courbes de poids"
                  onClick={onCorps}
                  style={{ padding: '4px 8px' }}
                >
                  ›
                </button>
              )}
            </div>
          </div>
        )}

      {enSaisie ? (
        <div className="pile" style={{ gap: 6 }}>
          <span>😴 Cette nuit, tu as dormi (heures) :</span>
          <div className="rpe" style={{ gridTemplateColumns: `repeat(${HEURES.length}, 1fr)` }}>
            {HEURES.map(([h, txt]) => (
              <button key={h} className={duJour?.sommeil === h ? 'actif' : ''} onClick={() => void noter(aujourdhui, { sommeil: h }).then(() => setNuit(null))}>
                {txt}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button className="ligne-jour" onClick={() => setNuit(duJour!.sommeil!)}>
          <span>
            😴 Cette nuit : <strong>{heures(duJour!.sommeil!)}</strong>
          </span>
          <span className="faible">✎</span>
        </button>
      )}

      {(objectifHier || dHier?.calories) && (
        <div className="ligne-jour calories-hier">
          <span>🍽 Calories hier</span>
          <div className="chips">
            {CALORIES.map(([id, nom]) => (
              <button key={id} className={dHier?.calories === id ? 'actif' : ''} onClick={() => void noter(hier, { calories: dHier?.calories === id ? undefined : id })}>
                {nom}
              </button>
            ))}
          </div>
        </div>
      )}

      {(repas || objectif) && (
        <div className="ligne-jour">
          <span>
            {repas && <>🥗 {repas}</>}
            {objectif && (
              <span className={repas ? 'faible' : ''} style={{ display: 'block', marginTop: repas ? 2 : 0 }}>
                {repas ? '' : '🥗 '}Cible aujourd’hui : {objectif.kcal.toLocaleString('fr-FR')} kcal{objectif.proteines ? ` · ${objectif.proteines} g de protéines` : ''}
              </span>
            )}
          </span>
        </div>
      )}

      {progres.length > 0 && (
        <div className="ligne-jour" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
          <span className="faible">📈 {blocCycle ? 'Depuis le début de ton cycle' : phase ? `Depuis le début de ta ${nomPhase(phase.phase).toLowerCase()}` : 'En 4 semaines'}</span>
          {progres.map((p) => (
            <span key={p.exo.id}>
              <strong>{p.exo.nom}</strong> : {chargeQte(p.exo, p.avant.charge, p.avant.reps)} → <span className="plus">{chargeQte(p.exo, p.apres.charge, p.apres.reps)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
