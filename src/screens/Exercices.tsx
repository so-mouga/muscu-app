import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight } from 'lucide-react'
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Catalogue } from '../catalogue'
import { nomMuscle, parMuscle } from '../components/ChoixExo'
import ChoixExo from '../components/ChoixExo'
import FormExo from '../components/FormExo'
import Vignette from '../components/Vignette'
import { MUSCLES, ZONES, type Zone } from '../data/exercices'
import IconeMuscle from '../components/IconeMuscle'
import { db, exoAvecReglages, uid } from '../db'
import { diagnostic } from '../lib/blocages'
import { chargeQte, dateCourte, dateISO } from '../lib/calc'
import { phaseA } from '../lib/objectifs'
import { delies, lireEquivalents, modifierEquivalents, relies } from '../lib/equivalents'
import { meilleureSerie } from '../lib/historique'
import { transition, useRetour } from '../lib/nav'
import type { Exercice, Seance } from '../types'
import { Detail, lectureExo } from './Progression'
import { confirmer } from '../components/Dialogues'

type Filtre = 'tous' | Zone

/** Partie Exercices de Progrès : est-ce que je progresse sur cet exercice ? Le titre et les parties sont dans `haut`. */
export default function Exercices({ catalogue, haut, initial, onRetourInitial }: { catalogue: Catalogue; haut: ReactNode; /** Fiche ouverte depuis le Bilan : le retour y revient. */ initial?: string | null; onRetourInitial?: () => void }) {
  const seances = useLiveQuery(() => db.seances.orderBy('debut').reverse().filter((s) => !s.enCours).toArray(), [], [])
  const reglages = useLiveQuery(() => db.reglages.toArray(), [], [])
  const [choisi, setChoisiEtat] = useState<string | null>(initial ?? null)
  const [formulaire, setFormulaire] = useState<{ exo?: Exercice } | null>(null)
  const [relier, setRelier] = useState(false)
  const [voirAutres, setVoirAutres] = useState(false)
  const journal = useLiveQuery(() => db.journal.toArray(), [], [])
  const pesees = useLiveQuery(() => db.pesees.toArray(), [], [])
  const [recherche, setRecherche] = useState('')
  const [filtre, setFiltre] = useState<Filtre>('tous')

  // Le retour d'une fiche retrouve la liste à la même position.
  const defilement = useRef(0)
  const setChoisi = (id: string | null) => {
    if (!id && initial && choisi === initial && onRetourInitial) {
      onRetourInitial()
      return
    }
    if (id) defilement.current = window.scrollY
    transition(() => setChoisiEtat(id), id ? 'avant' : 'arriere')
    if (id) window.scrollTo({ top: 0 })
  }
  useLayoutEffect(() => {
    if (!choisi && defilement.current) window.scrollTo({ top: defilement.current })
  }, [choisi])
  useRetour(!!choisi, () => setChoisi(null))
  useRetour(!!formulaire, () => setFormulaire(null))

  // Dernière séance et nombre de séances par exercice
  const historique = new Map<string, { n: number; date: string }>()
  for (const s of seances)
    for (const id of new Set(s.series.map((x) => x.exoId))) {
      const h = historique.get(id)
      historique.set(id, { n: (h?.n ?? 0) + 1, date: h?.date ?? s.date })
    }
  // Dernière performance et constat de chaque exercice fait : les mêmes règles que la fiche.
  const phaseEnCours = phaseA(catalogue.objectifs, dateISO())
  const phase = phaseEnCours?.phase
  const enSeche = phase === 'seche'
  const resumes = useMemo(() => {
    const parExo = new Map<string, Seance[]>()
    for (const s of seances)
      for (const id of new Set(s.series.map((x) => x.exoId))) parExo.set(id, [...(parExo.get(id) ?? []), s])
    return new Map(
      [...parExo].map(([id, l]) => {
        const e = catalogue.exo(id)
        const derniere = l.find((s) => !s.deload) ?? l[0]
        const m = meilleureSerie(derniere.series.filter((x) => x.exoId === id), e.assistance)
        return [id, { perf: m ? chargeQte(e, m.charge, m.reps) : '', lecture: lectureExo(e, [...l].reverse(), enSeche) }]
      })
    )
  }, [seances, catalogue, enSeche])
  const utilisations = (id: string) => catalogue.modeles.filter((m) => m.exercices.some((e) => e.exoId === id)).map((m) => m.nom)

  const tous = Object.values(catalogue.exercices)
  const supprimes = tous.filter((e) => e.supprime)

  const supprimer = async (exo: Exercice) => {
    const seancesModeles = utilisations(exo.id)
    // Créé par l'utilisateur, jamais fait et utilisé nulle part : on l'efface vraiment (rien à restaurer).
    const enCycle = catalogue.cycle?.modeles.some((m) => m.exercices.some((e) => e.exoId === exo.id))
    if (exo.perso && !historique.has(exo.id) && !seancesModeles.length && !enCycle) {
      if (!(await confirmer(`Supprimer « ${exo.nom} » ? Tu ne l’as jamais fait : il sera effacé.`, { oui: 'Supprimer l’exercice', danger: true }))) return
      await db.exercices.delete(exo.id)
      await modifierEquivalents((x) => Object.fromEntries(Object.entries(x).filter(([k]) => k !== exo.id).map(([k, l]) => [k, l.filter((y) => y !== exo.id)])))
      setChoisi(null)
      return
    }
    // Exercice de base : on le masque seulement. Exercice perso déjà fait : supprimé, mais l'historique garde son nom.
    const verbe = exo.perso ? 'Supprimer' : 'Masquer'
    const msg = seancesModeles.length
      ? `« ${exo.nom} » est utilisé dans : ${seancesModeles.join(', ')}. ${exo.perso ? 'Le supprimer' : 'Le masquer de la bibliothèque'} ? Il restera dans ces séances et dans ton historique.`
      : exo.perso
        ? `Supprimer « ${exo.nom} » ? Ton historique est conservé, tu pourras le restaurer.`
        : `Masquer « ${exo.nom} » de la bibliothèque ? Tu pourras le réafficher en bas de la liste.`
    if (!(await confirmer(msg, { oui: `${verbe} l’exercice`, danger: exo.perso }))) return
    await db.exercices.put({ ...exo, supprime: true })
    setChoisi(null)
  }

  // Copie sans historique, reliée à l'original : chacune garde sa progression, l'une sert de repère à l'autre.
  /** Copie qui vient d'être créée (bandeau sur sa fiche). */
  const [copieDe, setCopieDe] = useState<{ id: string; nom: string } | null>(null)
  const dupliquer = async (exo: Exercice) => {
    const base = exo.nom.replace(/ \(\d+\)$/, '')
    let k = 2
    while (tous.some((e) => !e.supprime && e.nom === `${base} (${k})`)) k++
    const copie: Exercice = { ...exo, id: 'x_' + uid(), nom: `${base} (${k})`, perso: true }
    delete copie.supprime
    await db.exercices.put(copie)
    await modifierEquivalents((x) => relies(x, exo.id, copie.id))
    // Fiche de la copie, avec un bandeau qui le dit (ouvrir directement le formulaire faisait croire qu'on modifiait l'original).
    setChoisi(copie.id)
    setCopieDe({ id: copie.id, nom: exo.nom })
  }

  const form = formulaire && (
    <FormExo
      fenetre
      initial={formulaire.exo}
      // Muscle proposé seulement quand la zone filtrée n'en a qu'un (Pecs, Abdos).
      muscleInitial={MUSCLES.filter((m) => m.zone === filtre).length === 1 ? MUSCLES.find((m) => m.zone === filtre)?.id : undefined}
      nomInitial={formulaire.exo ? undefined : recherche}
      onAnnuler={() => setFormulaire(null)}
      onEnregistre={(exo) => {
        setFormulaire(null)
        if (!formulaire.exo) setChoisi(exo.id)
      }}
    />
  )

  if (choisi) {
    const exo = exoAvecReglages(catalogue.exo(choisi), reglages)
    const eq = lireEquivalents(reglages)
    const liste = (eq[exo.id] ?? []).map((id) => {
      const autre = catalogue.exo(id)
      const s = seances.find((x) => x.series.some((y) => y.exoId === id))
      const m = s && meilleureSerie(s.series.filter((y) => y.exoId === id), autre.assistance)
      return { exo: autre, derniere: s && m ? `${chargeQte(autre, m.charge, m.reps)} (${dateCourte(s.date)})` : undefined }
    })
    return (
      <>
        <Detail
          exo={exo}
          seances={seances}
          onRetour={() => setChoisi(null)}
          onModifier={() => setFormulaire({ exo })}
          onSupprimer={() => supprimer(exo)}
          onDupliquer={() => void dupliquer(exo)}
          copieDe={copieDe?.id === exo.id ? copieDe.nom : undefined}
          equivalents={liste}
          enSeche={enSeche}
          pistes={diagnostic(exo, { seances, journal, pesees, phase, debutPhase: phaseEnCours?.debut }, dateISO())?.pistes}
          suggestions={tous
            .filter((e) => e.muscle === exo.muscle && e.id !== exo.id && !e.supprime && !(eq[exo.id] ?? []).includes(e.id))
            .sort((a, b) => Number(b.type === exo.type) - Number(a.type === exo.type) || (historique.get(b.id)?.n ?? 0) - (historique.get(a.id)?.n ?? 0))
            .slice(0, 3)}
          onRelier={() => setRelier(true)}
          onRelierExo={(id) => void modifierEquivalents((x) => relies(x, exo.id, id))}
          onDelier={(id) => void modifierEquivalents((x) => delies(x, exo.id, id))}
        />
        {relier && (
          <ChoixExo
            catalogue={catalogue}
            titre={`Relier à ${exo.nom}`}
            muscle={exo.muscle}
            exclure={[exo.id, ...(eq[exo.id] ?? [])]}
            onFermer={() => setRelier(false)}
            onChoix={(id) => {
              setRelier(false)
              void modifierEquivalents((x) => relies(x, exo.id, id))
            }}
          />
        )}
        {form}
      </>
    )
  }

  // Tes exercices d'abord, du plus récent au plus ancien ; les autres seulement quand on les cherche.
  const correspond = (e: Exercice) => filtre === 'tous' || !!recherche.trim() || MUSCLES.find((m) => m.id === e.muscle)?.zone === filtre
  const visibles = parMuscle(tous, recherche).flatMap((g) => g.exos).filter(correspond)
  const tiens = visibles.filter((e) => historique.has(e.id)).sort((a, b) => historique.get(b.id)!.date.localeCompare(historique.get(a.id)!.date))
  const autres = visibles.filter((e) => !historique.has(e.id))
  const montrerAutres = voirAutres || !!recherche.trim() || filtre !== 'tous' || tiens.length === 0

  const ligne = (e: Exercice) => {
    const r = resumes.get(e.id)
    return (
      <button key={e.id} className="liste-btn" onClick={() => setChoisi(e.id)}>
        <span className="avec-vignette">
          <Vignette exo={e} taille={44} />
          <span>
            {e.nom}
            <span className="faible prog-sous">
              {r ? (
                <>
                  {r.perf}
                  {r.lecture && (
                    <>
                      {' · '}
                      <span className={r.lecture.classe}>{r.lecture.texte.toLowerCase()}</span>
                    </>
                  )}
                </>
              ) : (
                `${nomMuscle(e.muscle)} · jamais fait`
              )}
            </span>
          </span>
        </span>
        <ChevronRight size={20} className="muted" />
      </button>
    )
  }

  return (
    <div>
      {haut}
      <input placeholder="Rechercher un exercice" value={recherche} onChange={(e) => setRecherche(e.target.value)} style={{ marginBottom: 'var(--e2)' }} />
      {!recherche.trim() && (
        <div className="chips zones zones-defile" style={{ marginBottom: 'var(--e2)' }}>
          {(
            [
              ['tous', 'Tous'],
              ...ZONES.map((z) => [z.id, z.nom]),
            ] as [Filtre, string][]
          ).map(([id, nom]) => (
            <button key={id} className={filtre === id ? 'actif' : ''} onClick={() => setFiltre(id)}>
              {id !== 'tous' && <IconeMuscle zone={id} taille={24} />}
              {nom}
            </button>
          ))}
        </div>
      )}

      {tiens.length > 0 && <h3 className="prog-groupe">Tes exercices</h3>}
      {tiens.map(ligne)}

      {montrerAutres ? (
        <>
          {tiens.length > 0 && autres.length > 0 && <h3 className="prog-groupe">Les autres</h3>}
          {autres.map(ligne)}
        </>
      ) : (
        autres.length > 0 && (
          <button className="btn plein" style={{ marginBottom: 'var(--e2)' }} onClick={() => setVoirAutres(true)}>
            Voir les {autres.length} autres
          </button>
        )
      )}
      {visibles.length === 0 && <div className="carte muted">Aucun exercice.</div>}
      <button className="btn plein" style={{ marginTop: 'var(--e2)' }} onClick={() => setFormulaire({})}>
        + Créer {recherche.trim() ? `« ${recherche.trim()} »` : 'un exercice'}
      </button>

      {supprimes.length > 0 && filtre === 'tous' && !recherche && (
        <div className="carte pile" style={{ marginTop: 20 }}>
          <div className="faible">Exercices masqués ou supprimés</div>
          {supprimes.map((e) => (
            <div key={e.id} className="ligne entre">
              <span>{e.nom}</span>
              <button className="btn petit" onClick={() => db.exercices.put({ ...e, supprime: undefined })}>
                Réafficher
              </button>
            </div>
          ))}
        </div>
      )}
      {form}
    </div>
  )
}
