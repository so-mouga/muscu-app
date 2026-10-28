import Dexie, { type EntityTable } from 'dexie'
import { EXERCICES } from './data/exercices'
import type { Exercice, Pesee, Reglage, Seance, Serie } from './types'

export const db = new Dexie('muscu') as Dexie & {
  seances: EntityTable<Seance, 'id'>
  pesees: EntityTable<Pesee, 'date'>
  reglages: EntityTable<Reglage, 'cle'>
}

db.version(1).stores({
  seances: 'id, date, debut, enCours',
  pesees: 'date',
  reglages: 'cle',
})

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

export async function seancesTerminees(): Promise<Seance[]> {
  const toutes = await db.seances.orderBy('debut').reverse().toArray()
  return toutes.filter((s) => !s.enCours)
}

/** Séries de travail d'un exercice, par séance terminée, la plus récente en premier. */
export function historiqueDe(seances: Seance[], exoId: string): Serie[][] {
  return seances.map((s) => s.series.filter((x) => x.exoId === exoId)).filter((h) => h.length > 0)
}

export async function reglage<T>(cle: string, defaut: T): Promise<T> {
  const r = await db.reglages.get(cle)
  return r ? (r.valeur as T) : defaut
}

export const setReglage = (cle: string, valeur: unknown) => db.reglages.put({ cle, valeur })

/** Exercice avec le pas de charge personnalisé éventuel. */
export function exoAvecReglages(id: string, reglages: Reglage[]): Exercice {
  const base = EXERCICES[id]
  const pas = reglages.find((r) => r.cle === `pas:${id}`)?.valeur
  return typeof pas === 'number' && pas > 0 ? { ...base, pas } : base
}

export async function dernierPoids(): Promise<number | undefined> {
  const p = await db.pesees.orderBy('date').last()
  return p?.poids
}

export async function demanderStockagePersistant() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist()
  } catch {
    /* non disponible */
  }
}

// --- Export / import -------------------------------------------------------

export async function exporterJSON(): Promise<string> {
  const data = {
    app: 'muscu',
    version: 1,
    exporteLe: new Date().toISOString(),
    seances: await db.seances.toArray(),
    pesees: await db.pesees.toArray(),
    reglages: await db.reglages.toArray(),
  }
  return JSON.stringify(data)
}

export async function importerJSON(texte: string) {
  const data = JSON.parse(texte)
  if (data?.app !== 'muscu' || !Array.isArray(data.seances)) throw new Error('Fichier non reconnu')
  await db.transaction('rw', db.seances, db.pesees, db.reglages, async () => {
    await Promise.all([db.seances.clear(), db.pesees.clear(), db.reglages.clear()])
    await db.seances.bulkPut(data.seances)
    await db.pesees.bulkPut(data.pesees ?? [])
    await db.reglages.bulkPut(data.reglages ?? [])
  })
}
