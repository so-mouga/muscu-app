import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { EXERCICES } from './data/exercices'
import { PROGRAMME } from './data/programme'
import { db } from './db'
import type { Exercice, SeanceModele } from './types'

export interface Catalogue {
  /** Séances visibles : préchargées (éventuellement modifiées) puis créées. */
  modeles: SeanceModele[]
  modele: (id: string | undefined) => SeanceModele | undefined
  exercices: Record<string, Exercice>
  /** Exercice connu, ou un exercice de secours pour un id disparu. */
  exo: (id: string) => Exercice
}

export function construireCatalogue(modelesDb: SeanceModele[], exercicesDb: Exercice[]): Catalogue {
  const parId = new Map<string, SeanceModele>(PROGRAMME.map((m) => [m.id, m]))
  for (const m of modelesDb) parId.set(m.id, m)
  const tous = [...parId.values()]
  const exercices: Record<string, Exercice> = { ...EXERCICES }
  for (const e of exercicesDb) exercices[e.id] = e
  return {
    modeles: tous.filter((m) => !m.supprime),
    modele: (id) => (id ? parId.get(id) : undefined),
    exercices,
    exo: (id) =>
      exercices[id] ?? { id, nom: id, muscle: 'pecs', type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
  }
}

/** null pendant le chargement. */
export function useCatalogue(): Catalogue | null {
  const modeles = useLiveQuery(() => db.modeles.toArray(), [])
  const exercices = useLiveQuery(() => db.exercices.toArray(), [])
  return useMemo(() => (modeles && exercices ? construireCatalogue(modeles, exercices) : null), [modeles, exercices])
}
