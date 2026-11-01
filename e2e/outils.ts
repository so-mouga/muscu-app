import { expect, type Page } from '@playwright/test'

/** Erreurs de la page (console et exceptions) : un test qui passe ne doit en laisser aucune. */
export function suivreErreurs(p: Page): string[] {
  const erreurs: string[] = []
  p.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()))
  p.on('pageerror', (e) => erreurs.push(String(e)))
  return erreurs
}

/** Contenu d'une table de la base `muscu`, lu directement dans IndexedDB (sans passer par l'appli). */
export const lireTable = (p: Page, table: string) =>
  p.evaluate(
    (t) =>
      new Promise<unknown[]>((ok, ko) => {
        const q = indexedDB.open('muscu')
        q.onerror = () => ko(q.error)
        q.onsuccess = () => {
          const r = q.result.transaction(t).objectStore(t).getAll()
          r.onsuccess = () => (q.result.close(), ok(r.result))
          r.onerror = () => ko(r.error)
        }
      }),
    table
  )

/** Écrit des lignes dans une table de la base existante (ouverte par l'appli). */
export const ecrire = (p: Page, table: string, lignes: unknown[]) =>
  p.evaluate(
    ([t, l]) =>
      new Promise<void>((ok, ko) => {
        const q = indexedDB.open('muscu')
        q.onsuccess = () => {
          const tx = q.result.transaction(t as string, 'readwrite')
          for (const x of l as unknown[]) tx.objectStore(t as string).put(x)
          tx.oncomplete = () => (q.result.close(), ok())
          tx.onerror = () => ko(tx.error)
        }
      }),
    [table, lignes] as const
  )

/** Date du jour (AAAA-MM-JJ) dans le navigateur, comme `dateISO` de l'appli. */
export const aujourdhui = (p: Page) =>
  p.evaluate(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })

/** Séance terminée minimale, comme l'appli l'enregistre. */
export function seance(id: string, date: string, series: { charge: number; reps: number; rpe: number }[]) {
  const debut = Date.parse(date + 'T18:00:00')
  return {
    id,
    date,
    nom: 'Séance test',
    debut,
    fin: debut + 3_600_000,
    enCours: false,
    exercices: [{ exoId: 'smith_incline', repos: 120, chauffes: [], finisseur: false, charge: 50, series: series.map(() => ({ repsMin: 8, repsMax: 12, rpe: 8 })) }],
    chauffes: {},
    notes: {},
    ajustSeries: {},
    series: series.map((s, i) => ({ id: `${id}-${i}`, exoId: 'smith_incline', type: 'normale', ...s, heure: debut + (i + 1) * 300_000 })),
  }
}

/** Ouvre un onglet de la barre du bas. */
export const onglet = (p: Page, nom: string) => p.locator('nav button, .onglets button', { hasText: nom }).first().click()

/** Ouvre le Journal sur aujourd'hui et affiche le détail de la séance `nom`. */
export async function ouvrirSeanceDuJour(p: Page, nom: string) {
  await onglet(p, 'Progression')
  await p.getByText('Journal', { exact: true }).first().click()
  await p.locator('button', { hasText: nom }).first().click()
  await expect(p.getByText('Récap par exercice')).toBeVisible()
}
