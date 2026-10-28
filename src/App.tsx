import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useCatalogue } from './catalogue'
import { db } from './db'
import { transition, useRetour } from './lib/nav'
import Accueil from './screens/Accueil'
import Progression from './screens/Progression'
import Reglages from './screens/Reglages'
import SeanceEnCours from './screens/SeanceEnCours'
import Seances from './screens/Seances'

const ONGLETS = [
  ['accueil', '🏠', 'Accueil'],
  ['seances', '📋', 'Séances'],
  ['progression', '📈', 'Progression'],
  ['reglages', '⚙️', 'Réglages'],
] as const
type Onglet = (typeof ONGLETS)[number][0]

export default function App() {
  const [onglet, setOngletEtat] = useState<Onglet>('accueil')
  const enCours = useLiveQuery(() => db.seances.filter((s) => s.enCours).first(), [], null)
  const catalogue = useCatalogue()

  const setOnglet = (o: Onglet) => {
    if (o === onglet) return
    const sens = ONGLETS.findIndex((x) => x[0] === o) > ONGLETS.findIndex((x) => x[0] === onglet) ? 'avant' : 'arriere'
    transition(() => setOngletEtat(o), sens)
    window.scrollTo({ top: 0 })
  }
  // Retour Android : depuis un autre onglet, on revient à l'accueil ; depuis l'accueil, on quitte.
  useRetour(!enCours && onglet !== 'accueil', () => transition(() => setOngletEtat('accueil'), 'arriere'))

  if (enCours === null || !catalogue) return null // chargement
  if (enCours) return <SeanceEnCours key={enCours.id} seance={enCours} catalogue={catalogue} />

  return (
    <>
      <div key={onglet}>
        {onglet === 'accueil' && <Accueil catalogue={catalogue} />}
        {onglet === 'seances' && <Seances catalogue={catalogue} />}
        {onglet === 'progression' && <Progression catalogue={catalogue} />}
        {onglet === 'reglages' && <Reglages catalogue={catalogue} />}
      </div>
      <nav className="onglets">
        {ONGLETS.map(([id, ico, nom]) => (
          <button key={id} className={onglet === id ? 'actif' : ''} onClick={() => setOnglet(id)}>
            <span className="ico">{ico}</span>
            {nom}
          </button>
        ))}
      </nav>
    </>
  )
}
