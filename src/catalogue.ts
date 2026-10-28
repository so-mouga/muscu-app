import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { EXERCICES } from './data/exercices'
import { PROGRAMME } from './data/programme'
import { db } from './db'
import type { Exercice, Programme, SeanceModele } from './types'

export const ID_PROGRAMME_DEFAUT = 'principal'

export interface EntreePlanning {
  modele: SeanceModele
  jour: number
}

export interface Catalogue {
  /** Bibliothèque de séances visibles : préchargées (éventuellement modifiées) puis créées. */
  modeles: SeanceModele[]
  modele: (id: string | undefined) => SeanceModele | undefined
  exercices: Record<string, Exercice>
  /** Exercice connu, ou un exercice de secours pour un id disparu. */
  exo: (id: string) => Exercice
  programmes: Programme[]
  /** Programme qui pilote l'accueil (séance du jour, semaine). */
  actif: Programme
  /** Séances du programme actif ayant un jour, triées par jour. */
  planning: EntreePlanning[]
}

export function construireCatalogue(
  modelesDb: SeanceModele[],
  exercicesDb: Exercice[],
  programmesDb: Programme[],
  actifId: string | undefined
): Catalogue {
  const parId = new Map<string, SeanceModele>(PROGRAMME.map((m) => [m.id, m]))
  for (const m of modelesDb) parId.set(m.id, m)
  const modeles = [...parId.values()].filter((m) => !m.supprime)
  const exercices: Record<string, Exercice> = { ...EXERCICES }
  for (const e of exercicesDb) exercices[e.id] = e

  // Sans programme enregistré : le planning d'origine (jours portés par les séances) devient le premier programme.
  const programmes: Programme[] = programmesDb.length
    ? programmesDb
    : [{ id: ID_PROGRAMME_DEFAUT, nom: 'Recompo 4 jours', description: 'Programme de départ', seances: modeles.map((m) => ({ modeleId: m.id, jour: m.jour })) }]
  const actif = programmes.find((p) => p.id === actifId) ?? programmes[0]
  const modele = (id: string | undefined) => {
    const m = id ? parId.get(id) : undefined
    return m && !m.supprime ? m : undefined
  }

  return {
    modeles,
    modele,
    exercices,
    exo: (id) =>
      exercices[id] ?? { id, nom: id, muscle: 'pecs', type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
    programmes,
    actif,
    planning: actif.seances
      .filter((e) => e.jour && modele(e.modeleId))
      .map((e) => ({ modele: modele(e.modeleId)!, jour: e.jour! }))
      .sort((a, b) => a.jour - b.jour),
  }
}

/** null pendant le chargement. */
export function useCatalogue(): Catalogue | null {
  const modeles = useLiveQuery(() => db.modeles.toArray(), [])
  const exercices = useLiveQuery(() => db.exercices.toArray(), [])
  const programmes = useLiveQuery(() => db.programmes.toArray(), [])
  const actif = useLiveQuery(() => db.reglages.get('programmeActif'), [], null)
  return useMemo(
    () =>
      modeles && exercices && programmes && actif !== null
        ? construireCatalogue(modeles, exercices, programmes, actif?.valeur as string | undefined)
        : null,
    [modeles, exercices, programmes, actif]
  )
}
