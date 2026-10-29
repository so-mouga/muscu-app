import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { EXERCICES } from './data/exercices'
import { PROGRAMME } from './data/programme'
import { db } from './db'
import type { Cycle, Exercice, Programme, SeanceModele } from './types'

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
  /** Cycle en cours : il pilote l'accueil avec sa propre copie du programme. */
  cycle?: Cycle
  /** Version d'une séance à lancer : celle du cycle si elle en fait partie, sinon la séance de la bibliothèque. */
  pourDemarrer: (m: SeanceModele) => SeanceModele
}

export function construireCatalogue(
  modelesDb: SeanceModele[],
  exercicesDb: Exercice[],
  programmesDb: Programme[],
  actifId: string | undefined,
  cycle?: Cycle
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
  const modele = (id: string | undefined) => {
    const m = id ? parId.get(id) : undefined
    return m && !m.supprime ? m : undefined
  }
  // Pendant un cycle : son programme et ses séances tels qu'au lancement (ou mis à jour à la demande).
  const duCycle = new Map((cycle?.modeles ?? []).map((m) => [m.id, m]))
  const actif = cycle ? { ...cycle.programme, id: cycle.programmeId } : (programmes.find((p) => p.id === actifId) ?? programmes[0])
  const pourPlanning = (id: string) => duCycle.get(id) ?? (cycle ? undefined : modele(id))

  return {
    modeles,
    modele,
    exercices,
    exo: (id) =>
      exercices[id] ?? { id, nom: id, muscle: 'pecs', type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
    programmes,
    actif,
    planning: actif.seances
      .filter((e) => e.jour && pourPlanning(e.modeleId))
      .map((e) => ({ modele: pourPlanning(e.modeleId)!, jour: e.jour! }))
      .sort((a, b) => a.jour - b.jour),
    cycle,
    pourDemarrer: (m) => duCycle.get(m.id) ?? m,
  }
}

/** null pendant le chargement. */
export function useCatalogue(): Catalogue | null {
  const modeles = useLiveQuery(() => db.modeles.toArray(), [])
  const exercices = useLiveQuery(() => db.exercices.toArray(), [])
  const programmes = useLiveQuery(() => db.programmes.toArray(), [])
  const actif = useLiveQuery(() => db.reglages.get('programmeActif'), [], null)
  const cycles = useLiveQuery(() => db.cycles.toArray(), [])
  return useMemo(
    () =>
      modeles && exercices && programmes && cycles && actif !== null
        ? construireCatalogue(modeles, exercices, programmes, actif?.valeur as string | undefined, cycles.find((c) => !c.fin))
        : null,
    [modeles, exercices, programmes, actif, cycles]
  )
}
