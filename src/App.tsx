import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { useCatalogue } from './catalogue'
import { db } from './db'
import { transition, useRetour } from './lib/nav'
import { dateISO } from './lib/calc'
import { CLE_DEMARRAGE, type EtatDemarrage } from './lib/demarrage'
import { CLE_RAPPEL, joursRappel, natif, RAPPEL_DEFAUT, reglerRappel, seanceDuJourNatif, type Rappel } from './lib/natif'
import Accueil from './screens/Accueil'
import Corps, { type PageCorps } from './screens/Corps'
import Demarrage, { type ModeDemarrage } from './components/Demarrage'
import IconeOnglet from './components/IconeOnglet'
import Historique, { type VueProgression } from './screens/Historique'
import { voirPeriodeCycle } from './screens/Bilan'
import Reglages from './screens/Reglages'
import SeanceEnCours from './screens/SeanceEnCours'
import Seances from './screens/Seances'

// Réglages n'est plus un onglet : ⚙ en haut à droite de l'accueil.
const ONGLETS = [
  ['accueil', 'Accueil'],
  ['historique', 'Progrès'],
  ['corps', 'Corps'],
  ['seances', 'Programme'],
] as const
type Onglet = (typeof ONGLETS)[number][0]

export default function App() {
  const [onglet, setOngletEtat] = useState<Onglet>('accueil')
  /** Séance ouverte dans l'historique. */
  const [detail, setDetailEtat] = useState<string | null>(null)
  const [provenanceDetail, setProvenanceDetail] = useState<Onglet | null>(null)
  /** Réglages ouverts par ⚙ (page au-dessus de l'onglet). */
  const [reglages, setReglages] = useState(false)
  /** Exercice ouvert depuis le Bilan, dans Progrès. */
  const [exoInitial, setExoInitial] = useState<string | null>(null)
  /** Page de détail ouverte dans Corps (phases, pesées, mensurations, photos). */
  const [pageCorps, setPageCorps] = useState<PageCorps | null>(null)
  /** Partie de Progrès affichée (mémorisée d'une ouverture à l'autre). */
  const [vue, setVueEtat] = useState<VueProgression>(() => {
    try {
      // Anciens noms : « seances » = Journal ; Corps et Objectifs sont sortis de Progrès.
      const v = localStorage.getItem('vueProgression')
      return v === 'journal' || v === 'seances' ? 'journal' : v === 'exercices' ? 'exercices' : 'bilan'
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
  const demarrage = useLiveQuery(() => db.reglages.get(CLE_DEMARRAGE), [], null)
  /** Démarrage rouvert depuis l'accueil ou l'onglet Programme. */
  const [demarrageOuvert, setDemarrageOuvert] = useState<ModeDemarrage | null>(null)
  /** « Créer le mien » : ouvre un nouveau programme dans l'onglet Programme. */
  const [creerProgramme, setCreerProgramme] = useState(false)

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

  const ouvrirCorps = (page?: PageCorps) => {
    setPageCorps(page ?? null)
    setOnglet('corps')
  }
  const setOnglet = (o: Onglet) => {
    if (o === onglet) return
    const sens = ONGLETS.findIndex((x) => x[0] === o) > ONGLETS.findIndex((x) => x[0] === onglet) ? 'avant' : 'arriere'
    transition(() => setOngletEtat(o), sens)
    window.scrollTo({ top: 0 })
  }
  const setDetail = (id: string | null, provenance?: Onglet) => {
    transition(() => {
      setDetailEtat(id)
      if (id) {
        if (provenance) setProvenanceDetail(provenance)
        setOngletEtat('historique')
        setVue('journal')
      } else {
        if (provenanceDetail) {
          setOngletEtat(provenanceDetail)
          setProvenanceDetail(null)
        }
      }
    }, id ? 'avant' : 'arriere')
    window.scrollTo({ top: 0 })
  }
  const ouvrirBilanCycle = () => {
    voirPeriodeCycle()
    setDetailEtat(null)
    setVue('bilan')
    setOnglet('historique')
  }
  // Retour Android : depuis un autre onglet, on revient à l'accueil ; depuis l'accueil, on quitte.
  useRetour(!enCours && onglet !== 'accueil', () => transition(() => setOngletEtat('accueil'), 'arriere'))
  const fermerReglages = () => (transition(() => setReglages(false), 'arriere'), window.scrollTo({ top: 0 }))
  useRetour(!enCours && reglages, fermerReglages)

  if (enCours === null || !catalogue || demarrage === null) return null // chargement
  if (enCours) return <SeanceEnCours key={enCours.id} seance={enCours} catalogue={catalogue} />

  const etatDemarrage = demarrage?.valeur as EtatDemarrage | undefined
  const modeDemarrage = demarrageOuvert ?? (catalogue.sansProgramme && !etatDemarrage?.quitte ? 'parcours' : null)
  if (modeDemarrage)
    return (
      <Demarrage
        key={modeDemarrage}
        catalogue={catalogue}
        mode={modeDemarrage}
        initial={etatDemarrage}
        onFermer={() => setDemarrageOuvert(null)}
        onCreer={() => (setDemarrageOuvert(null), setOngletEtat('seances'), setCreerProgramme(true))}
        onInstalle={() => (setDemarrageOuvert(null), setOngletEtat('accueil'), window.scrollTo({ top: 0 }))}
      />
    )

  return (
    <>
      <div key={reglages ? 'reglages' : onglet}>
        {reglages && <Reglages catalogue={catalogue} onFermer={fermerReglages} />}
        {!reglages && onglet === 'accueil' && (
          <Accueil
            catalogue={catalogue}
            onVoirSeance={(id) => setDetail(id, 'accueil')}
            onMesures={() => ouvrirCorps('mensurations')}
            onObjectifs={() => ouvrirCorps('phases')}
            onObjectif={() => setDemarrageOuvert('objectif')}
            onReglages={() => (transition(() => setReglages(true), 'avant'), window.scrollTo({ top: 0 }))}
            onJournal={() => (setVue('journal'), setOnglet('historique'))}
            onProgrammes={() => setOnglet('seances')}
            onBilanCycle={ouvrirBilanCycle}
            onChoisirProgramme={() => setDemarrageOuvert('programme')}
          />
        )}
        {!reglages && onglet === 'historique' && (
          <Historique
            catalogue={catalogue}
            detail={detail}
            onDetail={setDetail}
            vue={vue}
            onVue={setVue}
            onExo={(id) => (setExoInitial(id), setVue('exercices'))}
            exoInitial={exoInitial}
            onRetourExo={() => (setExoInitial(null), setVue('bilan'))}
            onCorps={ouvrirCorps}
          />
        )}
        {!reglages && onglet === 'corps' && <Corps catalogue={catalogue} page={pageCorps} onPage={setPageCorps} />}
        {!reglages && onglet === 'seances' && <Seances catalogue={catalogue} onChoisirProgramme={() => setDemarrageOuvert('programme')} creer={creerProgramme} onCreerOuvert={() => setCreerProgramme(false)} onBilanCycle={ouvrirBilanCycle} />}
      </div>
      <nav className="onglets">
        {ONGLETS.map(([id, nom]) => (
          <button key={id} className={onglet === id && !reglages ? 'actif' : ''} onClick={() => (setPageCorps(null), setDetailEtat(null), setProvenanceDetail(null), setExoInitial(null), setReglages(false), setOnglet(id))}>
            <IconeOnglet nom={id} />
            {nom}
          </button>
        ))}
      </nav>
    </>
  )
}
