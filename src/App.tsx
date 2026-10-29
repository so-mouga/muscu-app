import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useCatalogue } from './catalogue'
import { db } from './db'
import { transition, useRetour } from './lib/nav'
import Accueil from './screens/Accueil'
import Exercices from './screens/Exercices'
import Historique, { type VueProgression } from './screens/Historique'
import Reglages from './screens/Reglages'
import SeanceEnCours from './screens/SeanceEnCours'
import Seances from './screens/Seances'

const ONGLETS = [
  ['accueil', '🏠', 'Accueil'],
  ['historique', '📈', 'Progression'],
  ['seances', '📋', 'Programmes'],
  ['exercices', '💪', 'Exercices'],
  ['reglages', '⚙️', 'Réglages'],
] as const
type Onglet = (typeof ONGLETS)[number][0]

export default function App() {
  const [onglet, setOngletEtat] = useState<Onglet>('accueil')
  /** Séance ouverte dans l'historique. */
  const [detail, setDetailEtat] = useState<string | null>(null)
  /** Partie de Progression affichée (mémorisée d'une ouverture à l'autre). */
  const [vue, setVueEtat] = useState<VueProgression>(() => {
    try {
      return (localStorage.getItem('vueProgression') as VueProgression | null) ?? 'seances'
    } catch {
      return 'seances'
    }
  })
  const setVue = (v: VueProgression) => {
    setVueEtat(v)
    try {
      localStorage.setItem('vueProgression', v)
    } catch {
      /* stockage indisponible */
    }
  }
  const enCours = useLiveQuery(() => db.seances.filter((s) => s.enCours).first(), [], null)
  const catalogue = useCatalogue()

  const setOnglet = (o: Onglet) => {
    if (o === onglet) return
    const sens = ONGLETS.findIndex((x) => x[0] === o) > ONGLETS.findIndex((x) => x[0] === onglet) ? 'avant' : 'arriere'
    transition(() => setOngletEtat(o), sens)
    window.scrollTo({ top: 0 })
  }
  const setDetail = (id: string | null) => {
    transition(() => {
      setDetailEtat(id)
      if (id) (setOngletEtat('historique'), setVue('seances'))
    }, id ? 'avant' : 'arriere')
    window.scrollTo({ top: 0 })
  }
  // Retour Android : depuis un autre onglet, on revient à l'accueil ; depuis l'accueil, on quitte.
  useRetour(!enCours && onglet !== 'accueil', () => transition(() => setOngletEtat('accueil'), 'arriere'))

  if (enCours === null || !catalogue) return null // chargement
  if (enCours) return <SeanceEnCours key={enCours.id} seance={enCours} catalogue={catalogue} />

  return (
    <>
      <div key={onglet}>
        {onglet === 'accueil' && <Accueil catalogue={catalogue} onVoirSeance={setDetail} onMesures={() => (setVue('mesures'), setOnglet('historique'))} onProgrammes={() => setOnglet('seances')} />}
        {onglet === 'historique' && <Historique catalogue={catalogue} detail={detail} onDetail={setDetail} vue={vue} onVue={setVue} />}
        {onglet === 'seances' && <Seances catalogue={catalogue} />}
        {onglet === 'exercices' && <Exercices catalogue={catalogue} />}
        {onglet === 'reglages' && <Reglages catalogue={catalogue} />}
      </div>
      <nav className="onglets">
        {ONGLETS.map(([id, ico, nom]) => (
          <button key={id} className={onglet === id ? 'actif' : ''} onClick={() => (setDetailEtat(null), setOnglet(id))}>
            <span className="ico">{ico}</span>
            {nom}
          </button>
        ))}
      </nav>
    </>
  )
}
