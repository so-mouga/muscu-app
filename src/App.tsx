import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useCatalogue } from './catalogue'
import { db } from './db'
import { transition, useRetour } from './lib/nav'
import IconeOnglet from './components/IconeOnglet'
import Accueil from './screens/Accueil'
import Exercices from './screens/Exercices'
import Historique, { type VueProgression } from './screens/Historique'
import Reglages from './screens/Reglages'
import SeanceEnCours from './screens/SeanceEnCours'
import Seances from './screens/Seances'

const ONGLETS = [
  ['accueil', 'Accueil'],
  ['historique', 'Progression'],
  ['seances', 'Programmes'],
  ['exercices', 'Exercices'],
  ['reglages', 'Réglages'],
] as const
type Onglet = (typeof ONGLETS)[number][0]

export default function App() {
  const [onglet, setOngletEtat] = useState<Onglet>('accueil')
  /** Séance ouverte dans l'historique. */
  const [detail, setDetailEtat] = useState<string | null>(null)
  /** Exercice ouvert depuis le Bilan dans l'onglet Exercices. */
  const [exoInitial, setExoInitial] = useState<string | null>(null)
  /** Partie de Progression affichée (mémorisée d'une ouverture à l'autre). */
  const [vue, setVueEtat] = useState<VueProgression>(() => {
    try {
      // Anciens noms : « seances » = Journal ; Mesures, Photos et Poids sont regroupés dans Corps.
      const v = localStorage.getItem('vueProgression')
      return !v ? 'bilan' : v === 'seances' ? 'journal' : v === 'mesures' || v === 'photos' || v === 'poids' ? 'corps' : (v as VueProgression)
    } catch {
      return 'bilan'
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
      if (id) (setOngletEtat('historique'), setVue('journal'))
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
        {onglet === 'accueil' && (
          <Accueil
            catalogue={catalogue}
            onVoirSeance={setDetail}
            onMesures={() => (setVue('corps'), setOnglet('historique'))}
            onBilan={() => (setVue('bilan'), setOnglet('historique'))}
            onProgrammes={() => setOnglet('seances')}
          />
        )}
        {onglet === 'historique' && (
          <Historique
            catalogue={catalogue}
            detail={detail}
            onDetail={setDetail}
            vue={vue}
            onVue={setVue}
            onExo={(id) => (setExoInitial(id), setOnglet('exercices'))}
          />
        )}
        {onglet === 'seances' && <Seances catalogue={catalogue} />}
        {onglet === 'exercices' && (
          <Exercices
            catalogue={catalogue}
            initial={exoInitial}
            onRetourInitial={() => (setExoInitial(null), setOnglet('historique'))}
          />
        )}
        {onglet === 'reglages' && <Reglages catalogue={catalogue} />}
      </div>
      <nav className="onglets">
        {ONGLETS.map(([id, nom]) => (
          <button key={id} className={onglet === id ? 'actif' : ''} onClick={() => (setDetailEtat(null), setExoInitial(null), setOnglet(id))}>
            <IconeOnglet nom={id} />
            {nom}
          </button>
        ))}
      </nav>
    </>
  )
}
