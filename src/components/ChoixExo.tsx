import { useState } from 'react'
import type { Catalogue } from '../catalogue'
import { MUSCLES } from '../data/exercices'
import { useRetour } from '../lib/nav'
import type { Exercice, Muscle } from '../types'
import FormExo from './FormExo'
import Vignette from './Vignette'

export const nomMuscle = (m: Muscle) => MUSCLES.find((x) => x.id === m)?.nom ?? m
export const sansAccents = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** Exercices visibles, filtrés par recherche, regroupés par muscle principal (ordre de MUSCLES). */
export function parMuscle(exercices: Exercice[], recherche: string) {
  const r = sansAccents(recherche.trim())
  const visibles = exercices
    .filter((e) => !e.supprime)
    .filter((e) => !r || sansAccents(e.nom + ' ' + nomMuscle(e.muscle)).includes(r))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  return MUSCLES.map((m) => ({ muscle: m.id, nom: m.nom, exos: visibles.filter((e) => e.muscle === m.id) })).filter((g) => g.exos.length)
}

interface Props {
  catalogue: Catalogue
  titre: string
  /** Muscle de l'exercice remplacé : son groupe passe en premier. */
  muscle?: Muscle
  exclure?: string[]
  /** Exercices équivalents (remplacement) : proposés en tête, en un appui. */
  equivalents?: string[]
  /** `exo` est fourni quand il vient d'être créé (pas encore dans le catalogue). */
  onChoix: (exoId: string, exo?: Exercice) => void
  onFermer: () => void
}

export default function ChoixExo({ catalogue, titre, muscle, exclure = [], equivalents = [], onChoix, onFermer }: Props) {
  const [recherche, setRecherche] = useState('')
  const [creation, setCreation] = useState(false)
  // Groupes fermés par défaut ; celui du même muscle (remplacement) ouvert.
  const [ouverts, setOuverts] = useState<Set<Muscle>>(() => new Set(muscle ? [muscle] : []))
  const basculer = (m: Muscle) =>
    setOuverts((o) => {
      const n = new Set(o)
      if (n.has(m)) n.delete(m)
      else n.add(m)
      return n
    })
  useRetour(true, () => (creation ? (setCreation(false), 'rester') : onFermer()))

  const groupes = parMuscle(
    Object.values(catalogue.exercices).filter((e) => !exclure.includes(e.id)),
    recherche
  )
  // Pendant une recherche, tout ce qui correspond est visible.
  const ouvert = (m: Muscle) => !!recherche.trim() || ouverts.has(m)
  // Remplacement : le groupe du même muscle en tête.
  if (muscle) groupes.sort((a, b) => Number(b.muscle === muscle) - Number(a.muscle === muscle))

  const ligne = (e: Exercice, detail?: string) => (
    <button key={e.id} className="liste-btn" onClick={() => onChoix(e.id)}>
      <span className="avec-vignette">
        <Vignette exo={e} taille={40} />
        <span>
          <strong>{e.nom}</strong>
          <div className="faible">
            {detail ?? (e.type === 'compose' ? 'composé' : 'isolation')}
            {e.perso ? ' · perso' : ''}
          </div>
        </span>
      </span>
      <span className="muted">+</span>
    </button>
  )
  const equivalentsVisibles = recherche.trim()
    ? []
    : equivalents.filter((id) => !exclure.includes(id) && catalogue.exercices[id] && !catalogue.exercices[id].supprime)

  return (
    <div className="modal-fond" onClick={onFermer}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {creation ? (
          <FormExo nomInitial={recherche} muscleInitial={muscle} onEnregistre={(exo) => onChoix(exo.id, exo)} onAnnuler={() => setCreation(false)} />
        ) : (
          <div className="pile">
            <h2>{titre}</h2>
            <input placeholder="Rechercher (nom ou muscle)" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
            <button className="btn primaire plein" onClick={() => setCreation(true)}>
              + Créer un exercice{recherche ? ` « ${recherche} »` : ''}
            </button>
            {equivalentsVisibles.length > 0 && (
              <div>
                <div className="faible" style={{ marginBottom: 4 }}>
                  ⇄ Équivalents
                </div>
                {equivalentsVisibles.map((id) => ligne(catalogue.exercices[id], 'équivalent relié'))}
              </div>
            )}
            <div>
              {groupes.map((g) => (
                <div key={g.muscle}>
                  <button className="groupe-repli" onClick={() => basculer(g.muscle)} aria-expanded={ouvert(g.muscle)}>
                    <span>
                      {g.nom}
                      {g.muscle === muscle ? ' · même muscle' : ''} <span className="nb">({g.exos.length})</span>
                    </span>
                    <span className="muted">{ouvert(g.muscle) ? '▾' : '▸'}</span>
                  </button>
                  {ouvert(g.muscle) && g.exos.map((e) => ligne(e))}
                </div>
              ))}
              {groupes.length === 0 && <div className="muted">Aucun exercice trouvé.</div>}
            </div>
            <button className="btn discret plein" onClick={onFermer}>
              Annuler
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
