import { useRef, useState } from 'react'
import type { Catalogue } from '../catalogue'
import { consigne } from '../data/consignes'
import { MUSCLES, ZONES, type Zone } from '../data/exercices'
import { useRetour } from '../lib/nav'
import type { Exercice, Muscle } from '../types'
import FormExo from './FormExo'
import IconeMuscle from './IconeMuscle'
import InfosExo, { BoutonInfos } from './InfosExo'
import Vignette from './Vignette'

export const nomMuscle = (m: Muscle) => MUSCLES.find((x) => x.id === m)?.nom ?? m
export const sansAccents = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** Exercices visibles, filtrés par recherche, regroupés par muscle principal (ordre de MUSCLES). */
export function parMuscle(exercices: Exercice[], recherche: string) {
  const r = sansAccents(recherche.trim())
  const visibles = exercices
    .filter((e) => !e.supprime)
    .filter((e) => !r || sansAccents(e.nom + ' ' + nomMuscle(e.muscle)).includes(r))
    .sort((a, b) => {
      // Les exercices polyarticulaires (composés) d'abord, puis isolation
      if (a.type !== b.type) return a.type === 'compose' ? -1 : 1
      return a.nom.localeCompare(b.nom, 'fr')
    })
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
  onChoixMultiple?: (ids: string[], crees: Exercice[]) => void
  onFermer: () => void
}

export default function ChoixExo({ catalogue, titre, muscle, exclure = [], equivalents = [], onChoix, onChoixMultiple, onFermer }: Props) {
  const [recherche, setRecherche] = useState('')
  const [creation, setCreation] = useState(false)
  const [zone, setZone] = useState<Zone | 'tous'>(() => MUSCLES.find((m) => m.id === muscle)?.zone ?? 'tous')
  const [choisis, setChoisis] = useState<string[]>([])
  const [infos, setInfos] = useState<Exercice | null>(null)
  /** Exercices créés ici : pas encore dans le catalogue au moment d'ajouter. */
  const [crees, setCrees] = useState<Exercice[]>([])
  const champ = useRef<HTMLInputElement>(null)
  // Retour, appui à côté ou glissement : les exercices cochés sont ajoutés. Seul « Annuler » ne garde rien.
  const fermerEnGardant = () => (onChoixMultiple && choisis.length ? onChoixMultiple(choisis, crees) : onFermer())
  useRetour(true, () => (creation ? (setCreation(false), 'rester') : fermerEnGardant()))

  const zoneDe = (m: Muscle) => MUSCLES.find((x) => x.id === m)?.zone
  const groupes = parMuscle(
    Object.values(catalogue.exercices).filter((e) => !exclure.includes(e.id)),
    recherche
  ).filter((g) => recherche.trim() || zone === 'tous' || zoneDe(g.muscle) === zone)
  // Remplacement : le groupe du même muscle en tête.
  if (muscle) groupes.sort((a, b) => Number(b.muscle === muscle) - Number(a.muscle === muscle))

  const cocher = (id: string) => {
    setChoisis((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]))
    // Après une recherche : le champ se vide et reste actif, pour taper le suivant sans y retoucher.
    if (recherche.trim()) {
      setRecherche('')
      champ.current?.focus()
    }
  }
  const ligne = (e: Exercice, detail?: string) => {
    const coche = choisis.includes(e.id)
    // Appui sur la ligne : choisir ; le ⓘ à côté ouvre seulement la fiche d'exécution.
    return (
      <div key={e.id} className="ligne-exo">
      <button className={'liste-btn' + (coche ? ' coche' : '')} onClick={() => (onChoixMultiple ? cocher(e.id) : onChoix(e.id))}>
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
      {/* Rien à montrer sur un exercice créé sans consignes, ni note, ni photo. */}
      {(consigne(e.id) || e.notes || e.image) && <BoutonInfos onClick={() => setInfos(e)} />}
      </div>
    )
  }
  const equivalentsVisibles = recherche.trim()
    ? []
    : equivalents.filter((id) => !exclure.includes(id) && catalogue.exercices[id] && !catalogue.exercices[id].supprime)

  const equivalentsProches =
    recherche.trim() || equivalentsVisibles.length > 0 || !muscle
      ? []
      : Object.values(catalogue.exercices)
          .filter((e) => !e.supprime && !exclure.includes(e.id) && e.muscle === muscle && e.type === 'compose')
          .slice(0, 4)

  return (
    <div className="modal-fond" onClick={fermerEnGardant}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {creation ? (
          <FormExo
            nomInitial={recherche}
            muscleInitial={muscle}
            onEnregistre={(exo) => {
              if (!onChoixMultiple) return onChoix(exo.id, exo)
              setChoisis((x) => [...x, exo.id])
              setCrees((x) => [...x, exo])
              setCreation(false)
              setRecherche('')
            }}
            onAnnuler={() => setCreation(false)}
          />
        ) : (
          <div className="pile">
            <h2>{titre}</h2>
            <input ref={champ} placeholder="Rechercher (nom ou muscle)" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
            {!recherche.trim() && (
              <div className="chips zones une-rangee">
                <button className={zone === 'tous' ? 'actif' : ''} onClick={() => setZone('tous')}>
                  Tous
                </button>
                {ZONES.map((z) => (
                  <button key={z.id} className={zone === z.id ? 'actif' : ''} onClick={() => setZone(z.id)}>
                    <IconeMuscle zone={z.id} taille={24} />
                    {z.nom}
                  </button>
                ))}
              </div>
            )}
            {equivalentsVisibles.length > 0 ? (
              <div>
                <div className="faible" style={{ marginBottom: 4 }}>
                  ⇄ Équivalents reliés
                </div>
                {equivalentsVisibles.map((id) => ligne(catalogue.exercices[id], 'équivalent relié'))}
              </div>
            ) : equivalentsProches.length > 0 ? (
              <div>
                <div className="faible" style={{ marginBottom: 4 }}>
                  ⇄ Équivalents proches recommandés
                </div>
                {equivalentsProches.map((e) => ligne(e, `${nomMuscle(e.muscle)} · ${MODE_COURT[e.mode]}`))}
              </div>
            ) : null}
            <div>
              {groupes.map((g) => (
                <div key={g.muscle}>
                  <h3 className="choix-exo-groupe">
                    {g.nom}
                    {g.muscle === muscle ? ' · même muscle' : ''}
                  </h3>
                  {g.exos.map((e) => ligne(e))}
                </div>
              ))}
              {groupes.length === 0 && <div className="muted">Aucun exercice trouvé.</div>}
            </div>
            {/* Après la liste : les exercices d'abord. Une recherche sans résultat l'amène juste sous le champ. */}
            <button className="btn plein" onClick={() => setCreation(true)}>
              + Créer un exercice{recherche ? ` « ${recherche} »` : ''}
            </button>
            {onChoixMultiple ? (
              <div className="barre-ajout">
                <button className="btn primaire grand" disabled={!choisis.length} onClick={() => onChoixMultiple(choisis, crees)}>
                  {choisis.length ? `Ajouter (${choisis.length})` : 'Coche des exercices'}
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
      {/* Fiche par-dessus la liste ; un appui sur son fond ne ferme qu'elle. */}
      {infos && (
        <div onClick={(e) => e.stopPropagation()}>
          <InfosExo
            exo={infos}
            onFermer={() => setInfos(null)}
            action={
              onChoixMultiple
                ? {
                    texte: choisis.includes(infos.id) ? 'Retirer de ma sélection' : 'Ajouter à la séance',
                    faire: () => {
                      setChoisis((x) => (x.includes(infos.id) ? x.filter((y) => y !== infos.id) : [...x, infos.id]))
                      setInfos(null)
                    },
                  }
                : { texte: 'Choisir cet exercice', faire: () => onChoix(infos.id) }
            }
          />
        </div>
      )}
    </div>
  )
}
