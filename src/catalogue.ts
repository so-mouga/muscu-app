import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { EXERCICES } from './data/exercices'
import { PROGRAMME } from './data/programme'
import type { ProgrammeType } from './data/programmesTypes'
import { db, setReglage, uid } from './db'
import { dateISO } from './lib/calc'
import { avecPriorites, cibles } from './lib/cycle'
import { CLE_OBJECTIFS, CLE_PHASES, CLE_VOLUME, lireFrise, modifier, objectifsA, type EtapeObjectifs } from './lib/objectifs'
import type { Cycle, Exercice, Muscle, Programme, SeanceModele } from './types'

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
  /** Objectifs dans le temps (phase, fin prévue, volume), les mêmes pour tous les programmes. */
  objectifs: EtapeObjectifs[]
  /** Objectifs de séries dures par semaine, par muscle, en vigueur aujourd'hui (priorités du cycle comprises). */
  cibles: Record<Muscle, number>
  /** Les mêmes, sans les priorités du cycle : ce que l'utilisateur a réglé dans Objectifs. */
  ciblesPerso: Record<Muscle, number>
  /** Objectifs de volume en vigueur à une date (bilan d'une période passée). */
  ciblesA: (date: string) => Record<Muscle, number>
  /** Version d'une séance à lancer : celle du cycle si elle en fait partie, sinon la séance de la bibliothèque. */
  pourDemarrer: (m: SeanceModele) => SeanceModele
}

export function construireCatalogue(
  modelesDb: SeanceModele[],
  exercicesDb: Exercice[],
  programmesDb: Programme[],
  actifId: string | undefined,
  cycle?: Cycle,
  objectifs: EtapeObjectifs[] = [],
  cycles: Cycle[] = cycle ? [cycle] : []
): Catalogue {
  const parId = new Map<string, SeanceModele>(PROGRAMME.map((m) => [m.id, m]))
  for (const m of modelesDb) parId.set(m.id, m)
  const tous = [...parId.values()].filter((m) => !m.supprime)
  const exercices: Record<string, Exercice> = { ...EXERCICES }
  for (const e of exercicesDb) exercices[e.id] = e

  // Sans programme enregistré : le planning d'origine (jours portés par les séances) devient le premier programme.
  const programmes: Programme[] = programmesDb.length
    ? programmesDb
    : [{ id: ID_PROGRAMME_DEFAUT, nom: 'Recompo 4 jours', description: 'Programme de départ', seances: tous.map((m) => ({ modeleId: m.id, jour: m.jour })) }]
  // Séances de base (programme Recompo) : dans la bibliothèque seulement si un programme s'en sert ou si l'utilisateur les a touchées.
  const servent = new Set([...programmes.flatMap((p) => p.seances.map((e) => e.modeleId)), ...(cycle?.modeles ?? []).map((m) => m.id)])
  const enDb = new Set(modelesDb.map((m) => m.id))
  const modeles = tous.filter((m) => enDb.has(m.id) || servent.has(m.id) || !PROGRAMME.some((b) => b.id === m.id))
  const modele = (id: string | undefined) => {
    const m = id ? parId.get(id) : undefined
    return m && !m.supprime ? m : undefined
  }
  // Pendant un cycle : son programme et ses séances tels qu'au lancement (ou mis à jour à la demande).
  const duCycle = new Map((cycle?.modeles ?? []).map((m) => [m.id, m]))
  const actif = cycle ? { ...cycle.programme, id: cycle.programmeId } : (programmes.find((p) => p.id === actifId) ?? programmes[0])
  const pourPlanning = (id: string) => duCycle.get(id) ?? (cycle ? undefined : modele(id))
  const perso = (date: string) => cibles(objectifsA(objectifs, date)?.volume, cycle, actif)

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
    objectifs,
    cibles: avecPriorites(perso(dateISO()), cycles, dateISO()),
    ciblesPerso: perso(dateISO()),
    ciblesA: (date) => avecPriorites(perso(date), cycles, date),
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
  const objectifs = useLiveQuery(() => db.reglages.bulkGet([CLE_OBJECTIFS, CLE_PHASES, CLE_VOLUME]), [], null)
  return useMemo(
    () =>
      modeles && exercices && programmes && cycles && actif !== null && objectifs !== null
        ? construireCatalogue(modeles, exercices, programmes, actif?.valeur as string | undefined, cycles.find((c) => !c.fin), lireFrise(...(objectifs.map((r) => r?.valeur) as [unknown, unknown, unknown])), cycles)
        : null,
    [modeles, exercices, programmes, actif, cycles, objectifs]
  )
}

/**
 * Choisit un programme tout prêt : ses séances sont copiées chez l'utilisateur (modifiables), le
 * programme est ajouté et devient le programme actif (sauf pendant un cycle). Recompo pointe vers les
 * séances de base.
 */
export async function installerProgramme(t: ProgrammeType, c: Catalogue): Promise<Programme> {
  const suffixe = uid().slice(-5)
  const seances = t.deBase ? t.seances : t.seances.map((m) => ({ ...structuredClone(m), id: `${m.id}_${suffixe}` }))
  const p: Programme = t.deBase
    ? (c.programmes.find((x) => x.id === ID_PROGRAMME_DEFAUT) ?? { id: ID_PROGRAMME_DEFAUT, nom: t.nom, description: t.pour, seances: seances.map((m) => ({ modeleId: m.id, jour: m.jour })) })
    : { id: 'p_' + uid(), nom: t.nom, description: t.pour, seances: seances.map((m) => ({ modeleId: m.id, jour: m.jour })) }
  await db.transaction('rw', db.modeles, db.programmes, async () => {
    if (!t.deBase) await db.modeles.bulkPut(seances)
    await db.programmes.put(p)
  })
  if (!c.cycle) await setReglage('programmeActif', p.id)
  return p
}

/** Change les objectifs à partir d'une date (aujourd'hui par défaut) : une étape de plus dans la frise. */
export const changerObjectifs = (c: Catalogue, changement: Parameters<typeof modifier>[2], date = dateISO()) =>
  setReglage(CLE_OBJECTIFS, modifier(c.objectifs, date, changement, c.ciblesPerso))
