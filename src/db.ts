import Dexie, { type EntityTable } from 'dexie'
import { MODELES } from './data/programme'
import type { Activite, Cycle, Exercice, Mesure, Pesee, PhotoCorps, Programme, Reglage, Seance, SeanceModele, Serie } from './types'

export const db = new Dexie('muscu') as Dexie & {
  seances: EntityTable<Seance, 'id'>
  pesees: EntityTable<Pesee, 'date'>
  reglages: EntityTable<Reglage, 'cle'>
  /** Séances créées ou modifiées (remplacent la séance préchargée de même id). */
  modeles: EntityTable<SeanceModele, 'id'>
  /** Exercices créés par l'utilisateur. */
  exercices: EntityTable<Exercice, 'id'>
  programmes: EntityTable<Programme, 'id'>
  mesures: EntityTable<Mesure, 'date'>
  photos: EntityTable<PhotoCorps, 'id'>
  activites: EntityTable<Activite, 'id'>
  cycles: EntityTable<Cycle, 'id'>
}

db.version(1).stores({
  seances: 'id, date, debut, enCours',
  pesees: 'date',
  reglages: 'cle',
})

db.version(2)
  .stores({ modeles: 'id', exercices: 'id' })
  .upgrade((tx) =>
    tx
      .table('seances')
      .toCollection()
      .modify((s: Seance) => {
        s.exercices ??= structuredClone(MODELES[s.modeleId ?? '']?.exercices ?? [])
        s.ajustSeries ??= {}
      })
  )

db.version(3).stores({ programmes: 'id' })
db.version(4).stores({ mesures: 'date', photos: 'id, date' })
db.version(5).stores({ activites: 'id, date' })
db.version(6).stores({ cycles: 'id' })

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

/** Séries de travail d'un exercice, par séance terminée, la plus récente en premier. */
export function historiqueDe(seances: Seance[], exoId: string): Serie[][] {
  return seances.map((s) => s.series.filter((x) => x.exoId === exoId)).filter((h) => h.length > 0)
}

export const setReglage = (cle: string, valeur: unknown) => db.reglages.put({ cle, valeur })

/** Exercice avec le pas de charge personnalisé éventuel. */
export function exoAvecReglages(exo: Exercice, reglages: Reglage[]): Exercice {
  const pas = reglages.find((r) => r.cle === `pas:${exo.id}`)?.valeur
  return typeof pas === 'number' && pas > 0 ? { ...exo, pas } : exo
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
