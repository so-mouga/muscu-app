import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import type { Catalogue } from '../catalogue'
import { db } from '../db'
import { dateISO, kg } from '../lib/calc'
import { conseilRepas, meilleureProgression } from '../lib/journal'
import { CLE_PROFIL, objectifDuJour, type Profil } from '../lib/nutrition'
import { avancePoids, nomPhase, phaseA, poidsDepart } from '../lib/objectifs'
import type { JourJournal, Seance } from '../types'

const JOUR = 86400000
export const heures = (h: number) => `${Math.floor(h)} h${h % 1 ? ` ${String(Math.round((h % 1) * 60)).padStart(2, '0')}` : ''}`
/** Choix du sommeil en un appui : de 5 h (ou moins) à 9 h (ou plus), par demi-heure jusqu'à 8 h. */
const HEURES: [number, string][] = [[5, '≤5'], [5.5, '5½'], [6, '6'], [6.5, '6½'], [7, '7'], [7.5, '7½'], [8, '8'], [9, '9+']]
export const CALORIES: [NonNullable<JourJournal['calories']>, string][] = [
  ['ok', '✓ Dans l’objectif'],
  ['trop', 'Trop'],
  ['pasAssez', 'Pas assez'],
]

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
  // Poids au départ de la phase : pour situer l'objectif (± kg) en poids réel.
  const depart = useLiveQuery(async () => (phase?.ecartVise ? poidsDepart(await db.pesees.toArray(), phase.debut) : null), [phase?.debut, phase?.ecartVise], null)
  const [nuit, setNuit] = useState<number | null>(null)
  if (journal === null || profil === null) return null

  const duJour = journal.find((j) => j.date === aujourdhui)
  const dHier = journal.find((j) => j.date === hier)
  const noter = noterJournal

  const pesee = pesees.find((p) => p.date === aujourdhui)
  const semaine = pesees.filter((p) => p.date > dateISO(new Date(Date.now() - 7 * JOUR)))
  const moyenne = semaine.length ? semaine.reduce((a, p) => a + p.poids, 0) / semaine.length : null
  const cible = depart !== null && phase?.ecartVise ? Math.round((depart + phase.ecartVise) * 10) / 10 : null
  const vise = cible !== null && moyenne !== null ? avancePoids(phase!.phase, moyenne, cible, aujourdhui, phase!.finPrevue) : null
  const poids = pesees[pesees.length - 1]?.poids
  const objectif = objectifDuJour(catalogue.objectifs, aujourdhui, profil?.valeur as Profil | undefined, poids, catalogue.planning.length)
  const objectifHier = objectifDuJour(catalogue.objectifs, hier, profil?.valeur as Profil | undefined, poids, catalogue.planning.length)
  const repas = conseilRepas(phase?.phase, entrainement, deload)
  const progres = terminees ? meilleureProgression(terminees, catalogue.exo, phase ? phase.debut : dateISO(new Date(Date.now() - 28 * JOUR))) : null
  const peser = phase?.phase === 'seche' || phase?.phase === 'prise' || pesees.length > 0
  // Sommeil : rien de pré-rempli (un appui distrait noterait une fausse nuit) ; on choisit, ça enregistre.
  const enSaisie = nuit !== null || duJour?.sommeil === undefined

  return (
    <div className="carte pile journal-matin">
      <h3>Aujourd’hui</h3>
      {peser && (
        <button className="ligne-jour" onClick={onCorps}>
          <span>
            ⚖️ {pesee ? <strong>{kg(pesee.poids)} kg ce matin</strong> : 'Pèse-toi ce matin, à jeun'}
            {moyenne !== null && <span className="faible"> · moyenne 7 j {kg(Math.round(moyenne * 10) / 10)} kg</span>}
            {vise && <span className="faible"> · visé {kg(cible!)} kg{vise.atteint ? ' ✓' : ` (encore ${vise.reste > 0 ? '+' : '−'}${kg(Math.abs(vise.reste))})`}</span>}
          </span>
          <span className="muted">›</span>
        </button>
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
          <span>
            🍽 Hier{objectifHier && <span className="faible"> · objectif {objectifHier.kcal.toLocaleString('fr-FR')} kcal</span>}
          </span>
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
                {repas ? '' : '🥗 '}Objectif aujourd’hui : {objectif.kcal.toLocaleString('fr-FR')} kcal{objectif.proteines ? ` · ${objectif.proteines} g de protéines` : ''}
              </span>
            )}
          </span>
        </div>
      )}

      {progres && (
        <div className="ligne-jour">
          <span>
            📈 {phase ? `Depuis le début de ta ${nomPhase(phase.phase).toLowerCase()}` : 'En 4 semaines'} : <strong>{progres.exo.nom}</strong>{' '}
            <span className="plus">+{kg(Math.round(progres.pct * 10) / 10)} %</span>
          </span>
        </div>
      )}
    </div>
  )
}
