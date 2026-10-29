import { useState } from 'react'
import type { Catalogue } from '../catalogue'
import { MUSCLES, ZONES, type Zone } from '../data/exercices'
import { useRetour } from '../lib/nav'
import type { Exercice, Muscle } from '../types'
import FormExo from './FormExo'
import IconeMuscle from './IconeMuscle'
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

const MODE_COURT: Record<Exercice['mode'], string> = { machine: 'machine / barre', par_main: 'haltères', poids_corps: 'poids du corps', elastique: 'élastique' }

interface Props {
  catalogue: Catalogue
  titre: string
  /** Muscle de l'exercice remplacé : sa zone est filtrée et son groupe passe en premier. */
  muscle?: Muscle
  exclure?: string[]
  /** Exercices équivalents (remplacement) : proposés en tête, en un appui. */
  equivalents?: string[]
  /** `exo` est fourni quand il vient d'être créé (pas encore dans le catalogue). */
  onChoix: (exoId: string, exo?: Exercice) => void
  /** Sélection de plusieurs exercices (cases à cocher, bouton « Ajouter (n) ») au lieu d'un seul. */
  onChoixMultiple?: (ids: string[]) => void
  onFermer: () => void
}

export default function ChoixExo({ catalogue, titre, muscle, exclure = [], equivalents = [], onChoix, onChoixMultiple, onFermer }: Props) {
  const [recherche, setRecherche] = useState('')
  const [creation, setCreation] = useState(false)
  const [zone, setZone] = useState<Zone | 'tous'>(() => MUSCLES.find((m) => m.id === muscle)?.zone ?? 'tous')
  const [choisis, setChoisis] = useState<string[]>([])
  // Groupes fermés par défaut, sauf celui du muscle remplacé ou le seul groupe d'une zone.
  const [bascules, setBascules] = useState<Set<Muscle>>(() => new Set())
  const basculer = (m: Muscle) =>
    setBascules((o) => {
      const n = new Set(o)
      if (n.has(m)) n.delete(m)
      else n.add(m)
      return n
    })
  useRetour(true, () => (creation ? (setCreation(false), 'rester') : onFermer()))

  const zoneDe = (m: Muscle) => MUSCLES.find((x) => x.id === m)?.zone
  const groupes = parMuscle(
    Object.values(catalogue.exercices).filter((e) => !exclure.includes(e.id)),
    recherche
  ).filter((g) => recherche.trim() || zone === 'tous' || zoneDe(g.muscle) === zone)
  const ouvertParDefaut = (m: Muscle) => m === muscle || (zone !== 'tous' && groupes.length === 1)
  // Pendant une recherche, tout ce qui correspond est visible.
  const ouvert = (m: Muscle) => !!recherche.trim() || ouvertParDefaut(m) !== bascules.has(m)
  // Remplacement : le groupe du même muscle en tête.
  if (muscle) groupes.sort((a, b) => Number(b.muscle === muscle) - Number(a.muscle === muscle))

  const cocher = (id: string) => setChoisis((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]))
  const ligne = (e: Exercice, detail?: string) => {
    const coche = choisis.includes(e.id)
    return (
      <button key={e.id} className={'liste-btn' + (coche ? ' coche' : '')} onClick={() => (onChoixMultiple ? cocher(e.id) : onChoix(e.id))}>
        <span className="avec-vignette">
          <Vignette exo={e} taille={40} />
          <span>
            <strong>{e.nom}</strong>
            <div className="faible">
              {detail ?? `${nomMuscle(e.muscle)} · ${MODE_COURT[e.mode]}`}
              {e.perso ? ' · perso' : ''}
            </div>
          </span>
        </span>
        {onChoixMultiple ? <span className="case">{coche ? '✓' : ''}</span> : <span className="muted">+</span>}
      </button>
    )
  }
  const equivalentsVisibles = recherche.trim()
    ? []
    : equivalents.filter((id) => !exclure.includes(id) && catalogue.exercices[id] && !catalogue.exercices[id].supprime)

  return (
    <div className="modal-fond" onClick={onFermer}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {creation ? (
          <FormExo
            nomInitial={recherche}
            muscleInitial={muscle}
            onEnregistre={(exo) => {
              if (!onChoixMultiple) return onChoix(exo.id, exo)
              setChoisis((x) => [...x, exo.id])
              setCreation(false)
              setRecherche('')
            }}
            onAnnuler={() => setCreation(false)}
          />
        ) : (
          <div className="pile">
            <h2>{titre}</h2>
            <input placeholder="Rechercher (nom ou muscle)" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
            {!recherche.trim() && (
              <div className="chips zones">
                <button className={zone === 'tous' ? 'actif' : ''} onClick={() => setZone('tous')}>
                  Tous
                </button>
                {ZONES.map((z) => (
                  <button key={z.id} className={zone === z.id ? 'actif' : ''} onClick={() => (setZone(z.id), setBascules(new Set()))}>
                    <IconeMuscle zone={z.id} taille={24} />
                    {z.nom}
                  </button>
                ))}
              </div>
            )}
            <button className="btn plein" onClick={() => setCreation(true)}>
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
                    <span className="ligne" style={{ gap: 8 }}>
                      <IconeMuscle muscle={g.muscle} taille={26} />
                      <span>
                        {g.nom}
                        {g.muscle === muscle ? ' · même muscle' : ''} <span className="nb">({g.exos.length})</span>
                      </span>
                    </span>
                    <span className="muted">{ouvert(g.muscle) ? '▾' : '▸'}</span>
                  </button>
                  {ouvert(g.muscle) && g.exos.map((e) => ligne(e))}
                </div>
              ))}
              {groupes.length === 0 && <div className="muted">Aucun exercice trouvé.</div>}
            </div>
            {onChoixMultiple ? (
              <div className="barre-ajout">
                <button className="btn primaire grand" disabled={!choisis.length} onClick={() => onChoixMultiple(choisis)}>
                  {choisis.length ? `AJOUTER (${choisis.length})` : 'Coche des exercices'}
                </button>
                <button className="btn discret plein" onClick={onFermer}>
                  Annuler
                </button>
              </div>
            ) : (
              <button className="btn discret plein" onClick={onFermer}>
                Annuler
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
