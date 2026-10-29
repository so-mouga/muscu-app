import type { Table } from 'dexie'
import { MODELES } from '../data/programme'
import { db } from '../db'
import type { Seance } from '../types'

export type Categorie = 'programmes' | 'historique' | 'exercices' | 'corps' | 'photos' | 'reglages'

export const CATEGORIES: { id: Categorie; nom: string; detail: string }[] = [
  { id: 'programmes', nom: 'Programmes et séances', detail: 'tes programmes, tes cycles et les séances que tu as créées ou modifiées' },
  { id: 'historique', nom: 'Historique', detail: 'les séances faites, série par série, les objectifs et les autres activités' },
  { id: 'exercices', nom: 'Exercices perso', detail: 'les exercices que tu as créés, avec leurs photos' },
  { id: 'corps', nom: 'Poids et mensurations', detail: 'pesées et prises de mensurations' },
  { id: 'photos', nom: 'Photos de progression', detail: 'lourd : à sauvegarder à part, de temps en temps' },
  { id: 'reglages', nom: 'Réglages', detail: 'pas de charge, bips, équivalents, programme actif…' },
]

type NomTable = 'seances' | 'activites' | 'cycles' | 'pesees' | 'mesures' | 'reglages' | 'modeles' | 'exercices' | 'programmes' | 'photos'

const TABLES: Record<Categorie, NomTable[]> = {
  programmes: ['modeles', 'programmes', 'cycles'],
  historique: ['seances', 'activites'],
  exercices: ['exercices'],
  corps: ['pesees', 'mesures'],
  photos: ['photos'],
  reglages: ['reglages'],
}

const table = (n: NomTable) => db[n] as unknown as Table<unknown, string>

/** Nombre d'éléments par catégorie sur ce téléphone. */
export async function compter(): Promise<Record<Categorie, number>> {
  const r = {} as Record<Categorie, number>
  for (const c of CATEGORIES) {
    let n = 0
    for (const t of TABLES[c.id]) n += await table(t).count()
    r[c.id] = n
  }
  return r
}

/** Fichier d'export des catégories choisies. Les exercices perso suivent toujours les programmes et
 * l'historique, sinon leurs séances afficheraient des exercices inconnus après import. */
export async function exporter(cats: Categorie[]): Promise<string> {
  const avecExos = cats.includes('exercices') || cats.includes('programmes') || cats.includes('historique')
  const tables = new Set(cats.flatMap((c) => TABLES[c]))
  if (avecExos) tables.add('exercices')
  const data: Record<string, unknown> = { app: 'muscu', version: 4, exporteLe: new Date().toISOString(), contenu: cats }
  for (const t of tables) data[t] = await table(t).toArray()
  return JSON.stringify(data)
}

export interface Fichier {
  data: Record<string, unknown[]>
  /** Catégories présentes dans le fichier, avec leur nombre d'éléments. */
  presentes: { id: Categorie; n: number }[]
  exporteLe?: string
}

/** Lit un export (y compris les anciens, qui contiennent tout). */
export function lire(texte: string): Fichier {
  const data = JSON.parse(texte)
  if (data?.app !== 'muscu') throw new Error('Fichier non reconnu')
  const presentes = CATEGORIES.filter((c) => TABLES[c.id].some((t) => Array.isArray(data[t]))).map((c) => ({
    id: c.id,
    n: TABLES[c.id].reduce((a, t) => a + (Array.isArray(data[t]) ? data[t].length : 0), 0),
  }))
  return { data, presentes, exporteLe: data.exporteLe }
}

/**
 * Importe les catégories choisies. `remplacer` : efface d'abord ces catégories sur le téléphone
 * (restauration) ; sinon ajoute et met à jour sans rien effacer.
 */
export async function importer({ data }: Fichier, cats: Categorie[], remplacer: boolean) {
  const tables = new Set(cats.flatMap((c) => TABLES[c]))
  // Exercices perso utilisés par les programmes ou l'historique importés : toujours ajoutés.
  const exosEnPlus = !tables.has('exercices') && (cats.includes('programmes') || cats.includes('historique')) && Array.isArray(data.exercices)
  const toutes = [...tables, ...(exosEnPlus ? ['exercices' as const] : [])].map(table)
  await db.transaction('rw', toutes, async () => {
    for (const t of tables) {
      const lignes = (data[t] ?? []) as unknown[]
      if (remplacer) await table(t).clear()
      await table(t).bulkPut(
        t === 'seances'
          ? (lignes as Seance[]).map((s) => ({
              ...s,
              exercices: s.exercices ?? structuredClone(MODELES[s.modeleId ?? '']?.exercices ?? []),
              ajustSeries: s.ajustSeries ?? {},
            }))
          : lignes
      )
    }
    if (exosEnPlus) await table('exercices').bulkPut(data.exercices as unknown[])
  })
}
