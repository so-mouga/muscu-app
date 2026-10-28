import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from './db'
import Accueil from './screens/Accueil'
import Progression from './screens/Progression'
import Reglages from './screens/Reglages'
import SeanceEnCours from './screens/SeanceEnCours'

type Onglet = 'accueil' | 'progression' | 'reglages'

export default function App() {
  const [onglet, setOnglet] = useState<Onglet>('accueil')
  const enCours = useLiveQuery(() => db.seances.filter((s) => s.enCours).first(), [], null)

  if (enCours === null) return null // chargement
  if (enCours) return <SeanceEnCours seance={enCours} />

  return (
    <>
      {onglet === 'accueil' && <Accueil />}
      {onglet === 'progression' && <Progression />}
      {onglet === 'reglages' && <Reglages />}
      <nav className="onglets">
        {(
          [
            ['accueil', '🏠', 'Accueil'],
            ['progression', '📈', 'Progression'],
            ['reglages', '⚙️', 'Réglages'],
          ] as const
        ).map(([id, ico, nom]) => (
          <button key={id} className={onglet === id ? 'actif' : ''} onClick={() => setOnglet(id)}>
            <span className="ico">{ico}</span>
            {nom}
          </button>
        ))}
      </nav>
    </>
  )
}
