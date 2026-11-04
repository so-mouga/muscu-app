import Dexie, { type EntityTable } from 'dexie'
import { EXERCICES } from './data/exercices'
import { MODELES } from './data/programme'
import { avantSonCycle, cycleEnFourchette } from './lib/cycle'
import { enFourchette } from './lib/programme'
import type { Activite, Cycle, Exercice, JourJournal, Mesure, Pesee, PhotoCorps, Programme, Reglage, Seance, SeanceModele } from './types'

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
  /** Sommeil et calories, jour par jour. */
  journal: EntityTable<JourJournal, 'date'>
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
db.version(7).stores({ journal: 'date' })

// Plus de nombre fixe de reps : tout passe en fourchette (choix de l'utilisateur, 4 nov. 2026). Les séances déjà faites ne changent pas.
db.version(8)
  .stores({})
  .upgrade(async (tx) => {
    const crees = new Map((await tx.table('exercices').toArray()).map((e: Exercice) => [e.id, e]))
    const enTemps = (id: string) => (crees.get(id) ?? EXERCICES[id])?.mesure === 'temps'
    // Une donnée inattendue reste telle quelle : la mise à jour ne doit jamais empêcher l'appli de s'ouvrir.
    const sansBloquer = (f: () => void) => {
      try {
        f()
      } catch {
        /* laissée telle quelle */
      }
    }
    await tx.table('modeles').toCollection().modify((m: SeanceModele) => sansBloquer(() => (m.exercices = enFourchette(m, enTemps).exercices)))
    await tx.table('cycles').toCollection().modify((c: Cycle) => sansBloquer(() => Object.assign(c, cycleEnFourchette(c, enTemps))))
  })

// Une séance faite avant le début d'un cycle à venir lui était rattachée : le cycle affichait « 1 séance faite » avant d'avoir commencé.
db.version(9)
  .stores({})
  .upgrade(async (tx) => {
    const debuts = new Map((await tx.table('cycles').toArray()).map((c: Cycle) => [c.id, c.debut]))
    await tx
      .table('seances')
      .filter((s: Seance) => avantSonCycle(s, debuts))
      .modify((s: Seance) => {
        delete s.cycleId
        delete s.semaine
      })
  })

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

export { historiqueDe } from './lib/historique'

export const setReglage = (cle: string, valeur: unknown) => db.reglages.put({ cle, valeur })

/**
 * Modifie un exercice (de base ou créé) : la version de l'utilisateur remplace celle de la bibliothèque
 * (« ↺ Revenir à l'original » l'efface). Changer le palier remplace l'ancien réglage `pas:` de l'exercice.
 */
export async function modifierExercice(id: string, changement: Partial<Exercice>) {
  const base = (await db.exercices.get(id)) ?? EXERCICES[id]
  if (!base) return
  await db.exercices.put({ ...base, ...changement })
  if (changement.pas !== undefined) await db.reglages.delete(`pas:${id}`)
}

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
