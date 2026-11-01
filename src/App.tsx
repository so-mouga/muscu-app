import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { useCatalogue } from './catalogue'
import { db } from './db'
import { transition, useRetour } from './lib/nav'
import { dateISO } from './lib/calc'
import { CLE_RAPPEL, joursRappel, natif, RAPPEL_DEFAUT, reglerRappel, seanceDuJourNatif, type Rappel } from './lib/natif'
import IconeOnglet from './components/IconeOnglet'
import Accueil from './screens/Accueil'
import Corps from './screens/Corps'
import Exercices from './screens/Exercices'
import Historique, { type VueProgression } from './screens/Historique'
import Reglages from './screens/Reglages'
import SeanceEnCours from './screens/SeanceEnCours'
import Seances from './screens/Seances'

// Réglages n'est plus un onglet : ⚙ en haut à droite de l'accueil.
const ONGLETS = [
  ['accueil', 'Accueil'],
  ['historique', 'Progression'],
  ['corps', 'Corps'],
  ['seances', 'Programmes'],
  ['exercices', 'Exercices'],
] as const
type Onglet = (typeof ONGLETS)[number][0]

export default function App() {
  const [onglet, setOngletEtat] = useState<Onglet>('accueil')
  /** Séance ouverte dans l'historique. */
  const [detail, setDetailEtat] = useState<string | null>(null)
  /** Réglages ouverts par ⚙ (page au-dessus de l'onglet). */
  const [reglages, setReglages] = useState(false)
  /** Exercice ouvert depuis le Bilan dans l'onglet Exercices. */
  const [exoInitial, setExoInitial] = useState<string | null>(null)
  /** Partie de Progression affichée (mémorisée d'une ouverture à l'autre). */
  const [vue, setVueEtat] = useState<VueProgression>(() => {
    try {
      // Anciens noms : « seances » = Journal ; Corps et Objectifs sont sortis de Progression.
      const v = localStorage.getItem('vueProgression')
      return v === 'journal' || v === 'seances' ? 'journal' : 'bilan'
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

  // Rappel de séance (appli Android) : Android garde le planning et l'heure ; on les lui renvoie quand ils changent.
  const rappel = useLiveQuery(() => db.reglages.get(CLE_RAPPEL), [], null)
  const jours = catalogue ? JSON.stringify(joursRappel(catalogue.planning)) : null
  useEffect(() => {
    if (!natif || rappel === null || jours === null) return
    void reglerRappel((rappel?.valeur as Rappel | undefined) ?? RAPPEL_DEFAUT, JSON.parse(jours))
  }, [rappel, jours])
  // Une séance déjà faite (ou commencée) aujourd'hui : pas de rappel ce soir.
  const faiteAujourdhui = useLiveQuery(() => db.seances.where('date').equals(dateISO()).count(), [], 0)
  useEffect(() => void (natif && faiteAujourdhui > 0 && seanceDuJourNatif(dateISO())), [faiteAujourdhui])

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
  const fermerReglages = () => (transition(() => setReglages(false), 'arriere'), window.scrollTo({ top: 0 }))
  useRetour(!enCours && reglages, fermerReglages)

  if (enCours === null || !catalogue) return null // chargement
  if (enCours) return <SeanceEnCours key={enCours.id} seance={enCours} catalogue={catalogue} />

  return (
    <>
      <div key={reglages ? 'reglages' : onglet}>
        {reglages && <Reglages catalogue={catalogue} onFermer={fermerReglages} />}
        {!reglages && onglet === 'accueil' && (
          <Accueil
            catalogue={catalogue}
            onVoirSeance={setDetail}
            onMesures={() => setOnglet('corps')}
            onReglages={() => (transition(() => setReglages(true), 'avant'), window.scrollTo({ top: 0 }))}
            onBilan={() => (setVue('bilan'), setOnglet('historique'))}
            onProgrammes={() => setOnglet('seances')}
          />
        )}
        {!reglages && onglet === 'historique' && (
          <Historique
            catalogue={catalogue}
            detail={detail}
            onDetail={setDetail}
            vue={vue}
            onVue={setVue}
            onExo={(id) => (setExoInitial(id), setOnglet('exercices'))}
            onCorps={() => setOnglet('corps')}
          />
        )}
        {!reglages && onglet === 'corps' && <Corps catalogue={catalogue} />}
        {!reglages && onglet === 'seances' && <Seances catalogue={catalogue} />}
        {!reglages && onglet === 'exercices' && (
          <Exercices
            catalogue={catalogue}
            initial={exoInitial}
            onRetourInitial={() => (setExoInitial(null), setOnglet('historique'))}
          />
        )}
      </div>
      <nav className="onglets">
        {ONGLETS.map(([id, nom]) => (
          <button key={id} className={onglet === id && !reglages ? 'actif' : ''} onClick={() => (setDetailEtat(null), setExoInitial(null), setReglages(false), setOnglet(id))}>
            <IconeOnglet nom={id} />
            {nom}
          </button>
        ))}
      </nav>
    </>
  )
}
