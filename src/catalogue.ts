import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { ANCIENS_NOMS, EXERCICES, MUSCLES } from './data/exercices'
import { PROGRAMME } from './data/programme'
import type { ProgrammeType } from './data/programmesTypes'
import { db, setReglage, uid } from './db'
import { dateISO, lundi, semaineType } from './lib/calc'
import { ciblesEnVigueur, ciblesLues } from './lib/volume'
import { avecPriorites, cibles, DUREE_DEFAUT, sourceCibles, ecartCycle, etatCycle, finReelle, nouveauCycle, type EcartCycle } from './lib/cycle'
import { CLE_DEMARRAGE, estSansProgramme } from './lib/demarrage'
import { CLE_OBJECTIFS, CLE_PHASES, CLE_SANS_OBJECTIF, CLE_VOLUME, lireFrise, modifier, objectifsA, type EtapeObjectifs } from './lib/objectifs'
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
  /** La personne a dit qu'elle ne vise rien pour l'instant. */
  sansObjectif?: boolean
  /** Objectifs de séries dures par semaine, par muscle, en vigueur aujourd'hui (priorités du cycle comprises). */
  cibles: Record<Muscle, number>
  /** La personne a masqué les conseils de volume : `cibles` et `ciblesA` sont à 0, `ciblesPerso` garde ses choix. */
  conseilsVolumeMasques?: boolean
  /** Les mêmes, sans les priorités du cycle : les niveaux choisis par la personne. */
  ciblesPerso: Record<Muscle, number>
  /** Objectifs de volume en vigueur à une date (bilan d'une période passée). */
  ciblesA: (date: string) => Record<Muscle, number>
  /** Séances par semaine du programme en service : la Priorité d'un muscle en dépend. */
  seancesParSemaine: number
  /** Version d'une séance à lancer : celle du cycle si elle en fait partie, sinon la séance de la bibliothèque. */
  pourDemarrer: (m: SeanceModele) => SeanceModele
}

/** Id sans exercice (retiré de la bibliothèque, séance d'essai) : son nom se lit quand même. */
const nomLisible = (id: string) => (id.charAt(0).toUpperCase() + id.slice(1)).replace(/_/g, ' ')

export const CLE_CONSEILS_VOLUME_MASQUES = 'conseilsVolumeMasques'
/** Date fixe, pas « aujourd'hui » : une semaine finie plus tard relirait sinon une ancienne cible en chiffre. */
const DEBUT_NIVEAUX = '2026-11-05'

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
  // Elle suit aussi le nouveau nom si elle a encore l'ancien. Sans exercice de base (retiré de la liste) : elle appartient à la personne.
  for (const e of exercicesDb) {
    const base = EXERCICES[e.id]
    exercices[e.id] = base
      ? { ...e, nom: ANCIENS_NOMS[e.id]?.includes(e.nom) ? base.nom : e.nom, ...(base.assistance ? { assistance: true } : {}) }
      : { ...e, perso: true }
  }

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
  // Depuis l'arrivée des niveaux : celui de chaque muscle. Avant, les cibles de l'époque (la frise n'est jamais réécrite).
  const perso = (date: string) => {
    const v = objectifsA(objectifs, date)?.volume
    return date >= DEBUT_NIVEAUX ? ciblesEnVigueur(sourceCibles(v, cycle, actif)) : cibles(v, cycle, actif)
  }

  // La Priorité se lit avec le nombre de séances du programme en service : 16 à 20 séries ne tiennent pas en 2 séances.
  const seancesParSemaine = semaineType(actif).filter((e) => pourPlanning(e.modeleId)).length
  const lues = (date: string) => (date >= DEBUT_NIVEAUX ? ciblesLues(perso(date), seancesParSemaine) : perso(date))

  return {
    modeles,
    modele,
    exercices,
    exo: (id) =>
      exercices[id] ?? { id, nom: nomLisible(id), muscle: 'pecs', type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
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
    cibles: avecPriorites(lues(dateISO()), cycles, dateISO()),
    ciblesPerso: perso(dateISO()),
    ciblesA: (date) => avecPriorites(lues(date), cycles, date),
    seancesParSemaine,
    pourDemarrer: (m) => duCycle.get(m.id) ?? m,
  }
}

/** Conseils de volume masqués : plus aucune cible à lire, partout ; les choix de la personne restent pour le jour où elle les rallume. */
export const sansConseilsVolume = (c: Catalogue): Catalogue => {
  const zero = Object.fromEntries(MUSCLES.map((m) => [m.id, 0])) as Record<Muscle, number>
  return { ...c, conseilsVolumeMasques: true, cibles: zero, ciblesA: () => zero }
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
  const sansObjectif = useLiveQuery(() => db.reglages.get(CLE_SANS_OBJECTIF).then((r) => !!r?.valeur), [], null)
  const masques = useLiveQuery(() => db.reglages.get(CLE_CONSEILS_VOLUME_MASQUES).then((r) => !!r?.valeur), [], null)
  return useMemo(() => {
    if (!modeles || !exercices || !programmes || !cycles || actif === null || objectifs === null || nbSeances === null || demarrageVu === null || sansObjectif === null || masques === null) return null
    const sansProgramme = estSansProgramme(programmes.length, cycles.length, nbSeances, demarrageVu, modeles.some((m) => PROGRAMME.some((b) => b.id === m.id)))
    const c = { ...construireCatalogue(modeles, exercices, programmes, actif?.valeur as string | undefined, cycles.find((c) => !c.fin), lireFrise(...(objectifs.map((r) => r?.valeur) as [unknown, unknown, unknown])), cycles, sansProgramme), sansObjectif }
    return masques ? sansConseilsVolume(c) : c
  }, [modeles, exercices, programmes, actif, cycles, objectifs, nbSeances, demarrageVu, sansObjectif, masques])
}

/**
 * Choisit un programme tout prêt : ses séances sont copiées chez l'utilisateur (modifiables), le
 * programme est ajouté et devient le programme actif (sauf pendant un cycle). `jours` : un jour pour chaque séance à jour fixe, dans l'ordre du programme ; sinon ceux du programme.
 */
export async function installerProgramme(t: ProgrammeType, c: Catalogue, jours?: number[]): Promise<Programme> {
  const suffixe = uid().slice(-5)
  const aJour = t.seances.filter((m) => m.jour).sort((a, b) => a.jour! - b.jour!)
  const jourDe = (m: SeanceModele) => (jours && m.jour ? jours[aJour.indexOf(m)] : m.jour)
  const seances = t.seances.map((m) => ({ ...structuredClone(m), id: `${m.id}_${suffixe}`, jour: jourDe(m) }))
  const p: Programme = { id: 'p_' + uid(), nom: t.nom, description: t.pour, seances: seances.map((m) => ({ modeleId: m.id, jour: m.jour })) }
  await db.transaction('rw', db.modeles, db.programmes, async () => {
    await db.modeles.bulkPut(seances)
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
    if (c.cycle) await db.cycles.update(c.cycle.id, { fin: finReelle(c.cycle) })
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
