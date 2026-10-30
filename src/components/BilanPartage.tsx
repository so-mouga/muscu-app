import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import type { Catalogue } from '../catalogue'
import { db } from '../db'
import { debutPeriode, genererBilan } from '../lib/bilan'
import { cibles, etatCycle } from '../lib/cycle'
import { useRetour } from '../lib/nav'
import { informer } from './Dialogues'

type Periode = 4 | 8 | 12 | 'cycle'

/** Bilan détaillé d'une période, en texte, à copier ou partager (coach, outil d'analyse). */
export default function BilanPartage({ catalogue, onFermer }: { catalogue: Catalogue; onFermer: () => void }) {
  useRetour(true, onFermer)
  const cycle = catalogue.cycle
  const [periode, setPeriode] = useState<Periode>(cycle ? 'cycle' : 8)
  const seances = useLiveQuery(() => db.seances.filter((s) => !s.enCours).toArray(), [])
  const pesees = useLiveQuery(() => db.pesees.toArray(), [], [])
  const mesures = useLiveQuery(() => db.mesures.toArray(), [], [])
  const activites = useLiveQuery(() => db.activites.toArray(), [], [])
  const [copie, setCopie] = useState(false)

  if (!seances) return null
  const etat = cycle && etatCycle(cycle)
  const debut = periode === 'cycle' && cycle ? cycle.debut : debutPeriode(periode === 'cycle' ? 8 : periode)
  const texte = genererBilan(
    {
      seances,
      pesees,
      mesures,
      activites,
      exo: catalogue.exo,
      exercices: catalogue.exercices,
      cibles: cibles(cycle, catalogue.actif),
      programme: catalogue.actif.nom,
      cycle: cycle && etat ? `Cycle en cours : semaine ${Math.max(1, Math.min(etat.n, etat.total))}/${etat.total}, déload en S${cycle.deloads.join(', S') || '—'}` : undefined,
    },
    debut
  )

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(texte)
      setCopie(true)
      setTimeout(() => setCopie(false), 2000)
    } catch {
      void informer('Sélectionne le texte du bilan et copie-le à la main.', 'Copie impossible ici')
    }
  }
  const partager = async () => {
    try {
      await navigator.share({ title: 'Bilan d’entraînement', text: texte })
    } catch {
      /* partage annulé */
    }
  }

  return (
    <div className="page-dessus">
      <div className="entete">
        <button className="btn" onClick={onFermer} aria-label="Retour">
          ←
        </button>
        <div style={{ flex: 1 }}>
          <h2>Bilan détaillé</h2>
          <div className="faible">À copier pour un coach ou un outil d’analyse</div>
        </div>
      </div>
      <div className="chips" style={{ marginBottom: 10 }}>
        {cycle && (
          <button className={periode === 'cycle' ? 'actif' : ''} onClick={() => setPeriode('cycle')}>
            Cycle en cours
          </button>
        )}
        {([4, 8, 12] as const).map((n) => (
          <button key={n} className={periode === n ? 'actif' : ''} onClick={() => setPeriode(n)}>
            {n} semaines
          </button>
        ))}
      </div>
      <div className="ligne" style={{ marginBottom: 10 }}>
        <button className="btn primaire grand" style={{ flex: 1 }} onClick={copier}>
          {copie ? 'Copié ✓' : 'Copier'}
        </button>
        {'share' in navigator && (
          <button className="btn grand" style={{ flex: 1 }} onClick={partager}>
            Partager
          </button>
        )}
      </div>
      <div className="faible" style={{ marginBottom: 8 }}>
        Contenu : séances semaine par semaine, volume et RPE par muscle, chaque exercice série par série avec l’évolution du 1RM, poids et mensurations,
        autres sports, douleurs et notes.
      </div>
      <pre className="texte-bilan">{texte}</pre>
    </div>
  )
}
