import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import type { Catalogue } from '../catalogue'
import { parMuscle } from '../components/ChoixExo'
import FormExo from '../components/FormExo'
import Vignette from '../components/Vignette'
import { MUSCLES } from '../data/exercices'
import { db, exoAvecReglages } from '../db'
import { dateCourte } from '../lib/calc'
import { transition, useRetour } from '../lib/nav'
import type { Exercice, Muscle } from '../types'
import { Detail } from './Progression'

type Filtre = 'tous' | 'recents' | Muscle

export default function Exercices({ catalogue }: { catalogue: Catalogue }) {
  const seances = useLiveQuery(() => db.seances.orderBy('debut').reverse().filter((s) => !s.enCours).toArray(), [], [])
  const reglages = useLiveQuery(() => db.reglages.toArray(), [], [])
  const [choisi, setChoisiEtat] = useState<string | null>(null)
  const [formulaire, setFormulaire] = useState<{ exo?: Exercice } | null>(null)
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
    if (!confirm(msg)) return
    await db.exercices.put({ ...exo, supprime: true })
    setChoisi(null)
  }

  const form = formulaire && (
    <div className="modal-fond" onClick={() => setFormulaire(null)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <FormExo
          initial={formulaire.exo}
          muscleInitial={filtre !== 'tous' && filtre !== 'recents' ? filtre : undefined}
          nomInitial={formulaire.exo ? undefined : recherche}
          onAnnuler={() => setFormulaire(null)}
          onEnregistre={(exo) => {
            setFormulaire(null)
            if (!formulaire.exo) setChoisi(exo.id)
          }}
        />
      </div>
    </div>
  )

  if (choisi) {
    const exo = exoAvecReglages(catalogue.exo(choisi), reglages)
    return (
      <>
        <Detail exo={exo} seances={seances} onRetour={() => setChoisi(null)} onModifier={() => setFormulaire({ exo })} onSupprimer={() => supprimer(exo)} />
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
      : parMuscle(tous, recherche).filter((g) => filtre === 'tous' || g.muscle === filtre)

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
      <div className="pills" style={{ marginBottom: 4 }}>
        {(
          [
            ['tous', 'Tous'],
            ['recents', 'Récents'],
            ...MUSCLES.map((m) => [m.id, m.nom]),
          ] as [Filtre, string][]
        ).map(([id, nom]) => (
          <button key={id} className={filtre === id ? 'actif' : ''} style={{ padding: '0 12px', fontWeight: 600 }} onClick={() => setFiltre(id)}>
            {nom}
          </button>
        ))}
      </div>

      {groupes.map((g) => (
        <div key={g.muscle}>
          <div className="groupe-titre">
            {g.nom} <span style={{ fontWeight: 400 }}>· {g.exos.length}</span>
          </div>
          {g.exos.map(ligne)}
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
