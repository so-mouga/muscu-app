import { expect, test } from '@playwright/test'
import { aujourdhui, ecrire, lireTable, onglet, ouvrirReglages, ouvrirSeanceDuJour, premierProgramme, seance, suivreErreurs } from './outils'

/**
 * Parcours qui feraient perdre des données s'ils cassaient : faire une séance, l'enregistrer et la
 * retrouver après rechargement ; exporter puis importer ; ouvrir une base d'une ancienne version.
 */

test('séance : valider, corriger une série, enregistrer, tout est là après rechargement', async ({ page: p }) => {
  const erreurs = suivreErreurs(p)
  await p.goto('/')
  await premierProgramme(p)
  // Si c'est un jour d'entraînement (comme lundi), l'accueil affiche « Démarrer ». Si c'est repos, « Voir la séance ».
  const btnDemarrer = p.getByRole('button', { name: 'Démarrer', exact: true })
  const btnVoirRepos = p.getByRole('button', { name: 'Voir la séance' })
  await expect(btnDemarrer.or(btnVoirRepos)).toBeVisible()
  if (await btnDemarrer.isVisible()) {
    await btnDemarrer.click()
  } else {
    await btnVoirRepos.click()
    await p.getByRole('button', { name: /démarrer/i }).click()
  }

  // Plein écran : 1re série à 40 kg. Les reps visées dépendent de la séance, donc du jour du test.
  const charge = p.locator('.stepper input').first()
  await charge.fill('40')
  await charge.blur()
  const repsVisees = Number(await p.locator('.stepper input').nth(1).inputValue())
  await p.getByRole('button', { name: 'VALIDER LA SÉRIE' }).click()

  // Corriger la série faite : une rep de plus.
  await p.getByRole('button', { name: /Corriger la série 1|✎ S1/ }).first().click()
  const reps = p.locator('.stepper').nth(1)
  await reps.getByRole('button', { name: '+' }).click()
  await p.getByRole('button', { name: 'METTRE À JOUR' }).click()

  await p.getByRole('button', { name: 'Fin de séance' }).first().click()
  await p.getByRole('button', { name: '✓ ENREGISTRER LA SÉANCE' }).click()
  await expect(
    p
      .getByRole('button', { name: 'Démarrer', exact: true })
      .or(p.getByRole('button', { name: /Démarrer une séance/ }))
      .or(p.getByRole('button', { name: 'Voir la séance' }))
      .first()
  ).toBeVisible()

  // Rechargement : la séance est enregistrée, terminée, avec la série corrigée.
  // Après la fermeture, l'appli retire son entrée d'historique (`lib/nav.ts`) : ce retour annulerait le rechargement.
  await p.waitForFunction(() => !history.state?.piege)
  await p.reload()
  const [s] = (await lireTable(p, 'seances')) as { enCours: boolean; series: { charge: number; reps: number }[] }[]
  expect(s.enCours).toBe(false)
  expect(s.series).toHaveLength(1)
  expect(s.series[0]).toMatchObject({ charge: 40, reps: repsVisees + 1 })
  await ouvrirSeanceDuJour(p, 'Full body')
  await expect(p.locator('.recap-serie').first()).toContainText(new RegExp(`40 kg(/main)? × ${repsVisees + 1}`))
  expect(erreurs).toEqual([])
})

test('exporter puis importer dans une appli vide : tout revient à l’identique', async ({ page: p, browser }) => {
  const erreurs = suivreErreurs(p)
  // Pas de menu de partage dans le navigateur de test : l'export se télécharge.
  await p.addInitScript(() => Object.defineProperty(navigator, 'canShare', { value: undefined }))
  await p.goto('/')
  await premierProgramme(p)
  const jour = await aujourdhui(p)
  await ecrire(p, 'seances', [seance('s1', jour, [{ charge: 50, reps: 10, rpe: 8 }, { charge: 50, reps: 9, rpe: 9 }])])
  await ecrire(p, 'pesees', [{ date: jour, poids: 77.4 }])
  await ecrire(p, 'journal', [{ date: jour, sommeil: 7, calories: 'ok' }])
  await p.reload()
  const avant = { seances: await lireTable(p, 'seances'), pesees: await lireTable(p, 'pesees'), journal: await lireTable(p, 'journal'), programmes: await lireTable(p, 'programmes') }

  await ouvrirReglages(p)
  await p.getByRole('button', { name: 'Exporter…' }).click()
  const telechargement = p.waitForEvent('download')
  await p.getByRole('button', { name: 'EXPORTER', exact: true }).click()
  const fichier = await (await telechargement).path()

  // Une autre appli, vide (autre contexte = autre stockage).
  const ctx = await browser.newContext()
  const q = await ctx.newPage()
  const erreursQ = suivreErreurs(q)
  await q.goto('/')
  // Appli vide : les questions d'abord ; la croix mène à l'accueil, puis aux Réglages pour importer.
  await q.getByRole('button', { name: 'Quitter' }).click()
  await ouvrirReglages(q)
  await q.locator('input[type=file]').setInputFiles(fichier)
  await q.getByRole('button', { name: 'AJOUTER', exact: true }).click()
  await expect(q.getByText('Import terminé ✓')).toBeVisible()
  expect({ seances: await lireTable(q, 'seances'), pesees: await lireTable(q, 'pesees'), journal: await lireTable(q, 'journal'), programmes: await lireTable(q, 'programmes') }).toEqual(avant)

  // Et l'appli importée les montre.
  await q.reload()
  await ouvrirSeanceDuJour(q, 'Séance test')
  await expect(q.locator('.recap-serie').first()).toContainText('50 kg × 10')
  await ctx.close()
  expect([...erreurs, ...erreursQ]).toEqual([])
})

test('base d’une ancienne version (avant le journal) : l’appli la met à jour sans rien perdre', async ({ page: p }) => {
  const erreurs = suivreErreurs(p)
  // Une page du site qui ne lance pas l'appli, pour créer la base comme une ancienne version (Dexie 6 = IndexedDB 60).
  await p.goto('/manifest.webmanifest')
  const jour = await aujourdhui(p)
  const ancienne = seance('ancienne', jour, [{ charge: 52.5, reps: 8, rpe: 8 }])
  await p.evaluate(
    (s) =>
      new Promise<void>((ok, ko) => {
        const q = indexedDB.open('muscu', 60)
        q.onupgradeneeded = () => {
          const db = q.result
          const t = (nom: string, cle: string, index: string[] = []) => {
            const o = db.createObjectStore(nom, { keyPath: cle })
            for (const i of index) o.createIndex(i, i)
          }
          t('seances', 'id', ['date', 'debut', 'enCours'])
          t('pesees', 'date')
          t('reglages', 'cle')
          t('modeles', 'id')
          t('exercices', 'id')
          t('programmes', 'id')
          t('mesures', 'date')
          t('photos', 'id', ['date'])
          t('activites', 'id', ['date'])
          t('cycles', 'id')
          const tx = q.transaction!
          tx.objectStore('seances').put(s)
          tx.objectStore('pesees').put({ date: s.date, poids: 76.2 })
        }
        q.onsuccess = () => (q.result.close(), ok())
        q.onerror = () => ko(q.error)
      }),
    ancienne
  )

  await p.goto('/')
  await expect(p.getByText('76,2 kg')).toBeVisible()
  // Base passée à la version actuelle, avec la nouvelle table, et les anciennes données intactes.
  const version = await p.evaluate(() => new Promise<number>((ok) => (indexedDB.open('muscu').onsuccess = (e) => ok((e.target as IDBOpenDBRequest).result.version))))
  expect(version).toBeGreaterThanOrEqual(70)
  expect(await lireTable(p, 'journal')).toEqual([])
  expect(await lireTable(p, 'seances')).toEqual([ancienne])
  expect(await lireTable(p, 'pesees')).toEqual([{ date: jour, poids: 76.2 }])
  await ouvrirSeanceDuJour(p, 'Séance test')
  await expect(p.locator('.recap-serie').first()).toContainText('52,5 kg × 8')
  expect(erreurs).toEqual([])
})

test('programme modifié pendant un cycle : la question ne se perd pas, et le cycle ne change que si on accepte', async ({ page: p }) => {
  const erreurs = suivreErreurs(p)
  await p.goto('/')
  await premierProgramme(p)
  await onglet(p, 'Programme')
  await p.getByRole('button', { name: 'Lancer sur 6 semaines' }).click()
  await p.getByRole('button', { name: 'Lancer le cycle' }).click()
  const joursDuCycle = async () => ((await lireTable(p, 'cycles')) as { programme: { seances: { jour?: number }[] } }[])[0].programme.seances.map((e) => e.jour)
  const avant = await joursDuCycle()

  // Un jour change, puis on sort par la barre du bas et on ferme l'appli, sans passer par ←.
  await p.locator('.prog-jour').first().click()
  await p.getByRole('button', { name: 'dimanche' }).click()
  await expect(p.getByText('Ton cycle garde l’ancienne version')).toBeVisible()
  await onglet(p, 'Accueil')
  await expect(p.getByText('Programme modifié : appliquer au cycle ?')).toBeVisible()
  await p.waitForFunction(() => !history.state?.piege)
  await p.reload()
  expect(await joursDuCycle()).toEqual(avant)

  // La question est toujours là ; le rappel y mène ; répondre applique.
  await p.getByText('Programme modifié : appliquer au cycle ?').click()
  await p.getByRole('button', { name: 'Appliquer aux semaines qui restent' }).click()
  await expect(p.getByText('Appliqué aux semaines qui restent')).toBeVisible()
  await expect.poll(joursDuCycle).toContain(7)
  expect(erreurs).toEqual([])
})
