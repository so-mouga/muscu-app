import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import type { Catalogue } from '../catalogue'
import { parMuscle } from '../components/ChoixExo'
import ChoixExo from '../components/ChoixExo'
import FormExo from '../components/FormExo'
import Vignette from '../components/Vignette'
import { MUSCLES, ZONES, type Zone } from '../data/exercices'
import IconeMuscle from '../components/IconeMuscle'
import { db, exoAvecReglages, uid } from '../db'
import { chargeQte, dateCourte } from '../lib/calc'
import { delies, lireEquivalents, modifierEquivalents, relies } from '../lib/equivalents'
import { meilleureSerie } from '../lib/historique'
import { transition, useRetour } from '../lib/nav'
import type { Exercice, Muscle } from '../types'
import { Detail } from './Progression'
import { confirmer } from '../components/Dialogues'

type Filtre = 'tous' | 'recents' | Zone

export default function Exercices({ catalogue }: { catalogue: Catalogue }) {
  const seances = useLiveQuery(() => db.seances.orderBy('debut').reverse().filter((s) => !s.enCours).toArray(), [], [])
  const reglages = useLiveQuery(() => db.reglages.toArray(), [], [])
  const [choisi, setChoisiEtat] = useState<string | null>(null)
  const [formulaire, setFormulaire] = useState<{ exo?: Exercice } | null>(null)
  const [relier, setRelier] = useState(false)
  /** Groupes de muscles dépliés (accordéon). */
  const [ouverts, setOuverts] = useState<Set<string>>(() => new Set())
  const basculer = (m: string) =>
    setOuverts((o) => {
      const n = new Set(o)
      if (n.has(m)) n.delete(m)
      else n.add(m)
      return n
    })
  const [recherche, setRecherche] = useState('')
  const [filtre, setFiltre] = useState<Filtre>('tous')

  const setChoisi = (id: string | null) => (transition(() => setChoisiEtat(id), id ? 'avant' : 'arriere'), window.scrollTo({ top: 0 }))
  useRetour(!!choisi, () => setChoisi(null))
  useRetour(!!formulaire, () => setFormulaire(null))

  // Dernière séance et nombre de séances par exercice
  const historique = new Map<string, { n: number; date: string }>()
  for (const s of seances)
    for (const id of new Set(s.series.map((x) => x.exoId))) {
      const h = historique.get(id)
      historique.set(id, { n: (h?.n ?? 0) + 1, date: h?.date ?? s.date })
    }
  const utilisations = (id: string) => catalogue.modeles.filter((m) => m.exercices.some((e) => e.exoId === id)).map((m) => m.nom)

  const tous = Object.values(catalogue.exercices)
  const supprimes = tous.filter((e) => e.supprime)

  const supprimer = async (exo: Exercice) => {
    const seancesModeles = utilisations(exo.id)
    const msg = seancesModeles.length
      ? `« ${exo.nom} » est utilisé dans : ${seancesModeles.join(', ')}. Le supprimer de la bibliothèque ? Il restera dans ces séances et dans ton historique.`
      : `Supprimer « ${exo.nom} » ? Ton historique est conservé, tu pourras le restaurer.`
    if (!(await confirmer(msg, { oui: 'Supprimer l’exercice', danger: true }))) return
    await db.exercices.put({ ...exo, supprime: true })
    setChoisi(null)
  }

  // Copie sans historique, reliée à l'original : chacune garde sa progression, l'une sert de repère à l'autre.
  const dupliquer = async (exo: Exercice) => {
    const base = exo.nom.replace(/ \(\d+\)$/, '')
    let k = 2
    while (tous.some((e) => !e.supprime && e.nom === `${base} (${k})`)) k++
    const copie: Exercice = { ...exo, id: 'x_' + uid(), nom: `${base} (${k})`, perso: true }
    delete copie.supprime
    await db.exercices.put(copie)
    await modifierEquivalents((x) => relies(x, exo.id, copie.id))
    setChoisi(copie.id)
    // On propose tout de suite de la renommer.
    setFormulaire({ exo: copie })
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
      const m = s && meilleureSerie(s.series.filter((y) => y.exoId === id))
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
          equivalents={liste}
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

  const recents = tous
    .filter((e) => historique.has(e.id) && !e.supprime)
    .sort((a, b) => historique.get(b.id)!.date.localeCompare(historique.get(a.id)!.date))
  const groupes =
    filtre === 'recents'
      ? [{ muscle: 'recents', nom: 'Faits récemment', exos: recents.filter((e) => parMuscle([e], recherche).length) }]
      : parMuscle(tous, recherche).filter((g) => recherche.trim() || filtre === 'tous' || MUSCLES.find((m) => m.id === g.muscle)?.zone === filtre)

  // Fermés par défaut ; ouverts pendant une recherche, pour « Récents » ou quand il n'y a qu'un groupe.
  const ouvert = (m: string) => !!recherche.trim() || (m === 'recents' || groupes.length === 1) !== ouverts.has(m)

  const ligne = (e: Exercice) => {
    const h = historique.get(e.id)
    return (
      <button key={e.id} className="liste-btn" onClick={() => setChoisi(e.id)}>
        <span className="avec-vignette">
          <Vignette exo={e} taille={44} />
          <span>
            <strong>{e.nom}</strong>
            <div className="faible">
              {h ? `${h.n} séance${h.n > 1 ? 's' : ''} · dernière ${dateCourte(h.date)}` : 'jamais fait'}
              {e.perso ? ' · perso' : ''}
            </div>
          </span>
        </span>
        <span className="muted">›</span>
      </button>
    )
  }

  return (
    <div>
      <div className="entete">
        <h1>Exercices</h1>
        <button className="btn primaire" onClick={() => setFormulaire({})}>
          + Nouveau
        </button>
      </div>
      <input placeholder="Rechercher un exercice" value={recherche} onChange={(e) => setRecherche(e.target.value)} style={{ marginBottom: 10 }} />
      <div className="chips zones" style={{ marginBottom: 4 }}>
        {(
          [
            ['tous', 'Tous'],
            ['recents', 'Récents'],
            ...ZONES.map((z) => [z.id, z.nom]),
          ] as [Filtre, string][]
        ).map(([id, nom]) => (
          <button key={id} className={filtre === id ? 'actif' : ''} onClick={() => setFiltre(id)}>
            {id !== 'tous' && id !== 'recents' && <IconeMuscle zone={id} taille={24} />}
            {nom}
          </button>
        ))}
      </div>

      {groupes.map((g) => (
        <div key={g.muscle}>
          <button className="groupe-repli" onClick={() => basculer(g.muscle)} aria-expanded={ouvert(g.muscle)}>
            <span className="ligne" style={{ gap: 8 }}>
              {g.muscle !== 'recents' && <IconeMuscle muscle={g.muscle as Muscle} taille={26} />}
              <span>
                {g.nom} <span className="nb">({g.exos.length})</span>
              </span>
            </span>
            <span className="muted">{ouvert(g.muscle) ? '▾' : '▸'}</span>
          </button>
          {ouvert(g.muscle) && g.exos.map(ligne)}
        </div>
      ))}
      {groupes.every((g) => g.exos.length === 0) && <div className="carte muted" style={{ marginTop: 12 }}>Aucun exercice.</div>}

      {supprimes.length > 0 && filtre === 'tous' && !recherche && (
        <div className="carte pile" style={{ marginTop: 20 }}>
          <div className="faible">Exercices supprimés</div>
          {supprimes.map((e) => (
            <div key={e.id} className="ligne entre">
              <span>{e.nom}</span>
              <button className="btn petit" onClick={() => db.exercices.put({ ...e, supprime: undefined })}>
                Restaurer
              </button>
            </div>
          ))}
        </div>
      )}
      {form}
    </div>
  )
}
