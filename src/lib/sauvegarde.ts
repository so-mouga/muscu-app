import type { Table } from 'dexie'
import { MODELES } from '../data/programme'
import { db, setReglage } from '../db'
import { avantSonCycle, finReelle } from './cycle'
import { dateISO } from './calc'
import { CLE_OBJECTIFS, CLE_PHASES, CLE_VOLUME } from './objectifs'
import { CLE_PREVUS } from './prevu'
import { natif, partageFichierDisponible, partagerFichierNatif } from './natif'
import type { Cycle, JourJournal, Seance } from '../types'

export type Categorie = 'programmes' | 'historique' | 'exercices' | 'corps' | 'photos' | 'reglages'

type NomTable = 'seances' | 'activites' | 'cycles' | 'pesees' | 'mesures' | 'journal' | 'reglages' | 'modeles' | 'exercices' | 'programmes' | 'photos'

const TABLES: Record<Categorie, NomTable[]> = {
  programmes: ['modeles', 'programmes', 'cycles'],
  historique: ['seances', 'activites'],
  exercices: ['exercices'],
  corps: ['pesees', 'mesures', 'journal'],
  photos: ['photos'],
  reglages: ['reglages'],
}

export const CATEGORIES = Object.keys(TABLES) as Categorie[]

const table = (n: NomTable) => db[n] as unknown as Table<unknown, string>

/** Fichier d'export des catégories choisies. Les exercices perso suivent toujours les programmes et
 * l'historique, sinon leurs séances afficheraient des exercices inconnus après import. */
export async function exporter(cats: Categorie[]): Promise<string> {
  const avecExos = cats.includes('exercices') || cats.includes('programmes') || cats.includes('historique')
  const tables = new Set(cats.flatMap((c) => TABLES[c]))
  if (avecExos) tables.add('exercices')
  const data: Record<string, unknown> = { app: 'muscu', version: 5, exporteLe: new Date().toISOString(), contenu: cats }
  for (const t of tables) data[t] = await table(t).toArray()
  return JSON.stringify(data)
}

function telecharger(nom: string, contenu: string, type: string) {
  const url = URL.createObjectURL(new Blob([contenu], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = nom
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Menu de partage (Drive, mail…), sinon téléchargement. Lève `AbortError` si l'utilisateur annule, et une
 * erreur si aucun fichier n'a pu être créé : l'appli Android ne doit jamais annoncer une sauvegarde qui n'existe pas.
 */
export async function partagerOuTelecharger(nom: string, contenu: string, type: string) {
  if (natif) {
    if (!(await partageFichierDisponible())) throw new Error('Ta version de l’appli ne sait pas créer de fichier : rien n’a été sauvegardé. Installe la nouvelle version depuis le bandeau de l’accueil, tes données sont gardées.')
    if (!(await partagerFichierNatif(nom, contenu, type))) throw new DOMException('Partage annulé', 'AbortError')
    return
  }
  const fichier = new File([contenu], nom, { type })
  try {
    if (navigator.canShare?.({ files: [fichier] })) {
      await navigator.share({ files: [fichier], title: nom })
      return
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
  }
  telecharger(nom, contenu, type)
}

/** Exporte puis partage les catégories choisies ; le rappel de l'Accueil ne se calme que si l'historique est sauvegardé, et les photos ont leur propre date. */
export async function sauvegarder(cats: Categorie[]) {
  const jour = new Date().toISOString().slice(0, 10)
  await partagerOuTelecharger(`cran-${jour}${cats.length === 1 ? '-' + cats[0] : ''}.json`, await exporter(cats), 'application/json')
  if (cats.includes('historique')) await setReglage('dernierExport', Date.now())
  if (cats.includes('photos')) await setReglage('dernierExportPhotos', Date.now())
}

/** Tout sauf les photos, trop lourdes pour une sauvegarde régulière. */
export const CATEGORIES_COURANTES = CATEGORIES.filter((c) => c !== 'photos')

/** Ce que contient « Sauvegarder », en chiffres : « Contient : 2 programmes, 14 séances, tes réglages… ». */
export function contenuSauvegarde(n: { programmes: number; seances: number; pesees: number; mesures: number; exercices: number; photos: number }): string {
  const pluriel = (k: number, mot: string) => `${k} ${mot}${k > 1 ? 's' : ''}`
  const parties = [
    n.programmes ? pluriel(n.programmes, 'programme') : '',
    n.seances ? pluriel(n.seances, 'séance') : '',
    n.pesees ? pluriel(n.pesees, 'pesée') : '',
    n.mesures ? 'tes mensurations' : '',
    n.exercices ? 'tes exercices' : '',
    'tes réglages',
  ].filter(Boolean)
  const liste = parties.length > 1 ? `${parties.slice(0, -1).join(', ')} et ${parties[parties.length - 1]}` : parties[0]
  return `Contient : ${liste}.${n.photos ? ' Les photos se sauvegardent à part.' : ''}`
}

export interface Fichier {
  data: Record<string, unknown[]>
  /** Catégories qui ont quelque chose à récupérer, avec leur nombre d'éléments. */
  presentes: { id: Categorie; n: number }[]
  exporteLe?: string
}

/** Clé de chaque ligne, par table. */
const CLES: Record<NomTable, string> = { seances: 'id', activites: 'id', cycles: 'id', pesees: 'date', mesures: 'date', journal: 'date', reglages: 'cle', modeles: 'id', exercices: 'id', programmes: 'id', photos: 'id' }

/** Réglages présents même dans une appli vide : ils ne font pas une sauvegarde. */
const REGLAGES_SANS_DONNEES = ['demarrage', 'dernierExport', 'dernierExportPhotos', 'prevusParSemaine']

const nbDonnees = (t: NomTable, lignes: unknown[]) => (t === 'reglages' ? (lignes as { cle: string }[]).filter((l) => !REGLAGES_SANS_DONNEES.includes(l.cle)).length : lignes.length)

/** Lit une sauvegarde (y compris les anciennes). Lève une erreur en clair si elle n'est pas utilisable. */
export function lire(texte: string): Fichier {
  let data
  try {
    data = JSON.parse(texte)
  } catch {
    data = null
  }
  if (data?.app !== 'muscu') throw new Error('Ce fichier n’est pas une sauvegarde de Cran.')
  for (const t of Object.keys(CLES) as NomTable[]) {
    if (data[t] === undefined) continue
    if (!Array.isArray(data[t]) || data[t].some((l: Record<string, unknown> | null) => l?.[CLES[t]] === undefined)) throw new Error('Cette sauvegarde est abîmée.')
  }
  // Une séance restée ouverte dans le fichier rouvrirait l'écran de séance : elle n'a pas à revenir.
  if (data.seances) data.seances = (data.seances as Seance[]).filter((s) => !s.enCours)
  const presentes = CATEGORIES.map((id) => ({ id, n: TABLES[id].reduce((a, t) => a + (data[t] ? nbDonnees(t, data[t]) : 0), 0) })).filter((c) => c.n > 0)
  if (!presentes.length) throw new Error('Cette sauvegarde est vide : il n’y a rien à récupérer.')
  return { data, presentes, exporteLe: data.exporteLe }
}

/** Ce qui se compte et se comprend à l'écran. */
const RUBRIQUES: { table: NomTable; nom: string; un: string; plusieurs: string }[] = [
  { table: 'seances', nom: 'Séances', un: 'séance', plusieurs: 'séances' },
  { table: 'pesees', nom: 'Pesées', un: 'pesée', plusieurs: 'pesées' },
  { table: 'mesures', nom: 'Mensurations', un: 'mensuration', plusieurs: 'mensurations' },
  { table: 'journal', nom: 'Jours notés', un: 'jour noté', plusieurs: 'jours notés' },
  { table: 'photos', nom: 'Photos', un: 'photo', plusieurs: 'photos' },
  { table: 'programmes', nom: 'Programmes', un: 'programme', plusieurs: 'programmes' },
  { table: 'exercices', nom: 'Exercices perso', un: 'exercice perso', plusieurs: 'exercices perso' },
]

export type ClesTelephone = Record<NomTable, unknown[]>

/** Clés de tout ce qui est sur le téléphone. */
export async function clesTelephone(): Promise<ClesTelephone> {
  const r = {} as ClesTelephone
  for (const t of Object.keys(CLES) as NomTable[]) r[t] = await table(t).toCollection().primaryKeys()
  return r
}

export interface ApercuImport {
  lignes: { nom: string; fichier: number; telephone: number }[]
  /** Rien à perdre sur ce téléphone : pas besoin de choisir. */
  telephoneVide: boolean
  /** Ce que « Compléter » ajouterait, et ce que « Remplacer » ferait disparaître, en clair (vide = rien). */
  ajouts: string
  pertes: string
  /** Le fichier a des photos : « Remplacer » y touche. */
  avecPhotos: boolean
}

const enClair = (l: { n: number; un: string; plusieurs: string }[]) => {
  const t = l.filter((x) => x.n > 0).map((x) => `${x.n} ${x.n > 1 ? x.plusieurs : x.un}`)
  return t.length > 1 ? `${t.slice(0, -1).join(', ')} et ${t[t.length - 1]}` : (t[0] ?? '')
}

/** Les phases (frise, ou ses anciens réglages) et le prévu par semaine qui va avec : ils tiennent chacun dans une seule ligne de réglages. */
const REGLAGES_PHASES = [CLE_OBJECTIFS, CLE_PHASES, CLE_VOLUME]

/**
 * « Compléter » : le fichier apporte-t-il ses phases ? Oui tant que le téléphone n'a aucune séance : celles qu'il a
 * viennent des questions du démarrage, alors que le fichier porte l'histoire (calories et poids visés, volume). Dès
 * qu'il y a une séance, les phases du téléphone sont les vraies et ne changent pas.
 */
export const phasesDuFichier = (data: Record<string, unknown>, nbSeancesTelephone: number) =>
  nbSeancesTelephone === 0 && ((data.reglages ?? []) as { cle: string }[]).some((r) => REGLAGES_PHASES.includes(r.cle))

/**
 * « Compléter » un jour du journal déjà présent : les champs qui manquent sont ajoutés (note du jour, nuit ou
 * calories notées à la main), ceux qui existent ne changent jamais. Null s'il n'y a rien à ajouter.
 */
export function completerJour(telephone: JourJournal, fichier: JourJournal): JourJournal | null {
  const manque = (Object.keys(fichier) as (keyof JourJournal)[]).filter((k) => fichier[k] !== undefined && fichier[k] !== '' && (telephone[k] === undefined || telephone[k] === ''))
  if (!manque.length) return null
  return { ...telephone, ...Object.fromEntries(manque.map((k) => [k, fichier[k]])) }
}

/**
 * Jamais deux cycles ouverts : un seul reste en cours, les autres sont terminés (à leur vrai dernier jour). On garde
 * de préférence un cycle `prioritaires` (ceux du fichier si le téléphone n'avait aucune séance, sinon ceux du
 * téléphone), et parmi eux le plus récent. Renvoie les cycles à réécrire.
 */
export function fermerCyclesEnTrop(cycles: Cycle[], prioritaires: Set<string>, date = dateISO()): Cycle[] {
  const ouverts = cycles.filter((c) => !c.fin)
  if (ouverts.length < 2) return []
  const candidats = ouverts.some((c) => prioritaires.has(c.id)) ? ouverts.filter((c) => prioritaires.has(c.id)) : ouverts
  const garde = candidats.reduce((a, c) => (c.debut > a.debut ? c : a))
  return ouverts.filter((c) => c !== garde).map((c) => ({ ...c, fin: finReelle(c, date) }))
}

/**
 * Compare le fichier au téléphone. Une catégorie sans rien dans le fichier ne change jamais. `journal` : les jours
 * déjà notés sur le téléphone, pour dire combien « Compléter » en complétera.
 */
export function apercu({ data, presentes }: Fichier, cles: ClesTelephone, journal: JourJournal[] = []): ApercuImport {
  const touchees = new Set(presentes.flatMap((c) => TABLES[c.id]))
  const dansFichier = (t: NomTable) => ((data[t] ?? []) as Record<string, unknown>[]).map((l) => l[CLES[t]])
  const ajoutes = (t: NomTable) => dansFichier(t).filter((k) => !cles[t].includes(k)).length
  const perdus = (t: NomTable) => (touchees.has(t) ? cles[t].filter((k) => !dansFichier(t).includes(k)).length : 0)
  const duFichier = new Map(((data.journal ?? []) as unknown as JourJournal[]).map((j) => [j.date, j]))
  const joursCompletes = journal.filter((j) => duFichier.has(j.date) && completerJour(j, duFichier.get(j.date)!)).length
  const ajoutsBase = RUBRIQUES.some((r) => ajoutes(r.table) > 0)
  return {
    lignes: RUBRIQUES.map((r) => ({ nom: r.nom, fichier: dansFichier(r.table).length, telephone: cles[r.table].length })).filter((l) => l.fichier || l.telephone),
    // Un programme pris ou un cycle lancé, c'est déjà quelque chose à perdre : on demande avant de remplacer.
    telephoneVide: (['seances', 'pesees', 'mesures', 'journal', 'photos', 'exercices', 'programmes', 'cycles'] as NomTable[]).every((t) => !cles[t].length),
    ajouts: enClair([
      ...RUBRIQUES.map((r) => ({ ...r, n: ajoutes(r.table) })),
      { n: joursCompletes, un: 'jour complété', plusieurs: 'jours complétés' },
    ]) + (phasesDuFichier(data, cles.seances.length) ? (ajoutsBase || joursCompletes ? ', et tes phases' : 'tes phases') : ''),
    pertes: enClair(RUBRIQUES.map((r) => ({ ...r, n: perdus(r.table) }))),
    avecPhotos: touchees.has('photos'),
  }
}

/**
 * Récupère une sauvegarde, tout ou rien (si ça échoue, le téléphone ne change pas).
 * `completer` : ajoute ce qui manque, ne touche à rien de ce qui existe. Deux précisions : un jour du journal déjà
 * présent reçoit les champs qui lui manquent (`completerJour`), et les phases du fichier sont reprises tant que le
 * téléphone n'a aucune séance (`phasesDuFichier`).
 * `remplacer` : efface les catégories présentes dans le fichier et remet les siennes.
 * Dans les deux cas, il ne reste jamais deux cycles ouverts (`fermerCyclesEnTrop`).
 */
export async function importer({ data, presentes }: Fichier, mode: 'completer' | 'remplacer') {
  const tables = presentes.flatMap((c) => TABLES[c.id])
  const sansSeance = (await db.seances.count()) === 0
  const cyclesDuTelephone = new Set((await db.cycles.toCollection().primaryKeys()) as string[])
  const cyclesDuFichier = new Set(((data.cycles ?? []) as unknown as Cycle[]).map((c) => c.id))
  const phases = mode === 'completer' && phasesDuFichier(data, sansSeance ? 0 : 1)
  await db.transaction('rw', tables.map(table), async () => {
    for (const t of tables) {
      const cle = CLES[t]
      let lignes = (data[t] ?? []) as Record<string, unknown>[]
      if (t === 'seances') {
        const debuts = new Map(((data.cycles ?? []) as unknown as Cycle[]).map((c) => [c.id, c.debut]))
        lignes = (lignes as unknown as Seance[]).map((s) => {
          const propre = { ...s, exercices: s.exercices ?? structuredClone(MODELES[s.modeleId ?? '']?.exercices ?? []), ajustSeries: s.ajustSeries ?? {} }
          if (avantSonCycle(s, debuts)) {
            delete propre.cycleId
            delete propre.semaine
          }
          return propre
        }) as unknown as Record<string, unknown>[]
      }
      if (mode === 'remplacer') {
        // Une vieille sauvegarde sans cette marque ne doit pas relancer les questions du démarrage.
        const demarrage = t === 'reglages' && !lignes.some((l) => l.cle === 'demarrage') ? await table(t).get('demarrage') : undefined
        await table(t).clear()
        if (demarrage) await table(t).put(demarrage)
      } else {
        // Phases du fichier : ses lignes remplacent celles du démarrage (les anciennes clés aussi, sinon elles reprendraient la main).
        if (t === 'reglages' && phases) await table(t).bulkDelete([...REGLAGES_PHASES, CLE_PREVUS])
        const existe = new Set(await table(t).toCollection().primaryKeys())
        if (t === 'journal') {
          const complets: JourJournal[] = []
          for (const l of lignes as unknown as JourJournal[]) {
            if (!existe.has(l.date)) continue
            const c = completerJour((await db.journal.get(l.date))!, l)
            if (c) complets.push(c)
          }
          await db.journal.bulkPut(complets)
        }
        lignes = lignes.filter((l) => !existe.has(l[cle] as string))
      }
      await table(t).bulkPut(lignes)
    }
    if (tables.includes('cycles')) {
      const prioritaires = mode === 'completer' && !sansSeance ? cyclesDuTelephone : cyclesDuFichier
      await db.cycles.bulkPut(fermerCyclesEnTrop(await db.cycles.toArray(), prioritaires))
    }
  })
}
