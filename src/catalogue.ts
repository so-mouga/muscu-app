import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { EXERCICES } from './data/exercices'
import { PROGRAMME } from './data/programme'
import type { ProgrammeType } from './data/programmesTypes'
import { db, setReglage, uid } from './db'
import { dateISO, lundi } from './lib/calc'
import { avecPriorites, cibles, DUREE_DEFAUT, ecartCycle, etatCycle, nouveauCycle, type EcartCycle } from './lib/cycle'
import { CLE_DEMARRAGE, estSansProgramme } from './lib/demarrage'
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
  /** Programme qui pilote l'accueil (séance du jour, semaine). Sans programme : un programme vide, jamais affiché. */
  actif: Programme
  /** Nouvel utilisateur qui n'a encore choisi aucun programme : `programmes` et `planning` sont vides. */
  sansProgramme: boolean
  /** Séances du programme actif ayant un jour, triées par jour. */
  planning: EntreePlanning[]
  /** Cycle sans date de fin. Il pilote l'accueil avec sa propre copie du programme, jusqu'à la fin de sa dernière semaine. */
  cycle?: Cycle
  /** Programme modifié pendant le cycle : ce qui attend une réponse (appliquer, ou garder pour le prochain). */
  ecart?: EcartCycle
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
  cycles: Cycle[] = cycle ? [cycle] : [],
  sansProgramme = false
): Catalogue {
  const parId = new Map<string, SeanceModele>(PROGRAMME.map((m) => [m.id, m]))
  for (const m of modelesDb) parId.set(m.id, m)
  const tous = [...parId.values()].filter((m) => !m.supprime)
  const exercices: Record<string, Exercice> = { ...EXERCICES }
  // Une version modifiée d'un exercice de base garde son sens : une assistance reste une assistance.
  for (const e of exercicesDb) exercices[e.id] = EXERCICES[e.id]?.assistance ? { ...e, assistance: true } : e

  // Sans programme enregistré : le planning d'origine (jours portés par les séances) devient le premier programme.
  const programmes: Programme[] = programmesDb.length || sansProgramme
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
  // Cycle arrivé au bout de ses semaines : terminé, c'est de nouveau le programme qui compte.
  const pilote = cycle && !etatCycle(cycle).fini ? cycle : undefined
  const duCycle = new Map((pilote?.modeles ?? []).map((m) => [m.id, m]))
  const actif = pilote ? { ...pilote.programme, id: pilote.programmeId } : (programmes.find((p) => p.id === actifId) ?? programmes[0] ?? { id: '', nom: '', seances: [] })
  const pourPlanning = (id: string) => duCycle.get(id) ?? (pilote ? undefined : modele(id))
  const perso = (date: string) => cibles(objectifsA(objectifs, date)?.volume, cycle, actif)

  return {
    modeles,
    modele,
    exercices,
    exo: (id) =>
      exercices[id] ?? { id, nom: id, muscle: 'pecs', type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
    programmes,
    actif,
    sansProgramme,
    planning: actif.seances
      .filter((e) => e.jour && pourPlanning(e.modeleId))
      .map((e) => ({ modele: pourPlanning(e.modeleId)!, jour: e.jour! }))
      .sort((a, b) => a.jour - b.jour),
    cycle,
    ecart: pilote && ecartCycle(pilote, programmes.find((p) => p.id === pilote.programmeId), modele),
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
  const nbSeances = useLiveQuery(() => db.seances.count(), [], null)
  const demarrageVu = useLiveQuery(() => db.reglages.get(CLE_DEMARRAGE).then((r) => !!r), [], null)
  return useMemo(() => {
    if (!modeles || !exercices || !programmes || !cycles || actif === null || objectifs === null || nbSeances === null || demarrageVu === null) return null
    const sansProgramme = estSansProgramme(programmes.length, cycles.length, nbSeances, demarrageVu, modeles.some((m) => PROGRAMME.some((b) => b.id === m.id)))
    return construireCatalogue(modeles, exercices, programmes, actif?.valeur as string | undefined, cycles.find((c) => !c.fin), lireFrise(...(objectifs.map((r) => r?.valeur) as [unknown, unknown, unknown])), cycles, sansProgramme)
  }, [modeles, exercices, programmes, actif, cycles, objectifs, nbSeances, demarrageVu])
}

/**
 * Choisit un programme tout prêt : ses séances sont copiées chez l'utilisateur (modifiables), le
 * programme est ajouté et devient le programme actif (sauf pendant un cycle). Recompo pointe vers les
 * séances de base. `jours` : un jour pour chaque séance à jour fixe, dans l'ordre du programme ; sinon ceux du programme.
 */
export async function installerProgramme(t: ProgrammeType, c: Catalogue, jours?: number[]): Promise<Programme> {
  const suffixe = uid().slice(-5)
  const aJour = t.seances.filter((m) => m.jour).sort((a, b) => a.jour! - b.jour!)
  const jourDe = (m: SeanceModele) => (jours && m.jour ? jours[aJour.indexOf(m)] : m.jour)
  const seances = t.seances.map((m) => ({ ...(t.deBase ? m : structuredClone(m)), id: t.deBase ? m.id : `${m.id}_${suffixe}`, jour: jourDe(m) }))
  const p: Programme = t.deBase
    ? (c.programmes.find((x) => x.id === ID_PROGRAMME_DEFAUT) ?? { id: ID_PROGRAMME_DEFAUT, nom: t.nom, description: t.pour, seances: seances.map((m) => ({ modeleId: m.id, jour: m.jour })) })
    : { id: 'p_' + uid(), nom: t.nom, description: t.pour, seances: seances.map((m) => ({ modeleId: m.id, jour: m.jour })) }
  await db.transaction('rw', db.modeles, db.programmes, async () => {
    if (!t.deBase) await db.modeles.bulkPut(seances)
    await db.programmes.put(p)
  })
  if (!c.cycle || etatCycle(c.cycle).fini) await setReglage('programmeActif', p.id)
  return p
}

/** Lance un cycle : il termine celui d'avant (historique et bilan conservés) et fait du programme le programme en service. */
export async function lancerCycle(c: Catalogue, p: Programme, o: { debut: string; semaines?: number; deloads?: number[]; nom?: string; priorites?: Muscle[] }) {
  const semaines = o.semaines ?? DUREE_DEFAUT
  // Lu dans la base : un programme tout juste installé n'est pas encore dans le catalogue.
  const enBase = new Map((await db.modeles.toArray()).map((m) => [m.id, m]))
  const cycle: Cycle = {
    ...nouveauCycle('c_' + uid(), p, (id) => enBase.get(id) ?? c.modele(id), o.debut, semaines, [...(o.deloads ?? [semaines])].sort((a, b) => a - b)),
    ...(o.nom?.trim() && { nom: o.nom.trim() }),
    ...(o.priorites?.length && { priorites: o.priorites }),
  }
  await db.transaction('rw', db.cycles, db.reglages, db.seances, async () => {
    if (c.cycle) await db.cycles.update(c.cycle.id, { fin: dateISO() })
    await db.cycles.put(cycle)
    await setReglage('programmeActif', p.id)
    // Cycle lancé cette semaine : les séances déjà faites cette semaine en font partie (semaine 1).
    if (cycle.debut === lundi())
      await db.seances
        .where('date')
        .aboveOrEqual(cycle.debut)
        .filter((s) => !s.cycleId)
        .modify((s) => {
          s.cycleId = cycle.id
          s.semaine = 1
        })
  })
  return cycle
}

/** Change les objectifs à partir d'une date (aujourd'hui par défaut) : une étape de plus dans la frise. */
export const changerObjectifs = (c: Catalogue, changement: Parameters<typeof modifier>[2], date = dateISO()) =>
  setReglage(CLE_OBJECTIFS, modifier(c.objectifs, date, changement, c.ciblesPerso))
