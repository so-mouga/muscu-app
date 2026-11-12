import { expect, test } from '@playwright/test'
import { aujourdhui, ecrire, lireTable, onglet, ouvrirReglages, ouvrirSauvegarde, ouvrirSeanceDuJour, premierProgramme, seance, suivreErreurs } from './outils'

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
  // Deux temps : la récompense, puis les choix pour la prochaine fois, où l'on enregistre.
  await p.getByRole('button', { name: /La prochaine fois/i }).click()
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
  const telechargement = p.waitForEvent('download')
  await p.getByRole('button', { name: 'Sauvegarder', exact: true }).click()
  const fichier = await (await telechargement).path()

  // Une autre appli, vide (autre contexte = autre stockage).
  const ctx = await browser.newContext()
  const q = await ctx.newPage()
  const erreursQ = suivreErreurs(q)
  await q.goto('/')
  // Appli vide : les questions d'abord ; la croix mène à l'accueil, puis aux Réglages pour importer.
  await q.getByRole('button', { name: 'Quitter' }).click()
  await ouvrirSauvegarde(q)
  await q.locator('input[type=file]').setInputFiles(fichier)
  await q.getByRole('button', { name: 'Récupérer', exact: true }).click()
  await expect(q.getByText('Sauvegarde récupérée ✓')).toBeVisible()
  expect({ seances: await lireTable(q, 'seances'), pesees: await lireTable(q, 'pesees'), journal: await lireTable(q, 'journal'), programmes: await lireTable(q, 'programmes') }).toEqual(avant)

  // Et l'appli importée les montre.
  await q.reload()
  await ouvrirSeanceDuJour(q, 'Séance test')
  await expect(q.locator('.recap-serie').first()).toContainText('50 kg × 10')
  await ctx.close()
  expect([...erreurs, ...erreursQ]).toEqual([])
})

test('récupérer une sauvegarde : « Compléter » ne change rien de ce qui existe, « Remplacer » annonce les pertes, un fichier vide est refusé', async ({ page: p }) => {
  const erreurs = suivreErreurs(p)
  await p.addInitScript(() => Object.defineProperty(navigator, 'canShare', { value: undefined }))
  await p.goto('/')
  await premierProgramme(p)
  const jour = await aujourdhui(p)
  await ecrire(p, 'pesees', [{ date: jour, poids: 70 }])
  await ecrire(p, 'seances', [seance('s1', jour, [{ charge: 50, reps: 10, rpe: 8 }])])
  await p.reload()
  await ouvrirReglages(p)
  const telechargement = p.waitForEvent('download')
  await p.getByRole('button', { name: 'Sauvegarder', exact: true }).click()
  const fichier = await (await telechargement).path()

  // Après cet export : une pesée corrigée, et une séance de plus.
  await ecrire(p, 'pesees', [{ date: jour, poids: 71.5 }])
  await ecrire(p, 'seances', [seance('s2', jour, [{ charge: 55, reps: 8, rpe: 8 }])])

  // Compléter avec ce vieux fichier : rien à ajouter, et rien n'a bougé.
  await p.getByRole('button', { name: 'Récupérer, photos, tableur' }).click()
  await p.locator('input[type=file]').setInputFiles(fichier)
  await expect(p.getByText('rien à ajouter')).toBeVisible()
  await expect(p.getByRole('button', { name: 'Compléter', exact: true }).last()).toBeDisabled()

  // Remplacer annonce la perte et demande confirmation ; annuler ne touche à rien.
  await p.locator('.choix-prochaine button', { hasText: 'Remplacer' }).click()
  await expect(p.getByText('Perdu : 1 séance.')).toBeVisible()
  await p.locator('.modal > .btn.danger').click()
  await p.getByRole('button', { name: 'Annuler' }).last().click()
  expect(await lireTable(p, 'seances')).toHaveLength(2)
  expect(await lireTable(p, 'pesees')).toEqual([{ date: jour, poids: 71.5 }])

  await p.locator('.modal > .btn.danger').click()
  await p.getByRole('button', { name: 'Remplacer mes données' }).click()
  await expect(p.getByText('Sauvegarde récupérée ✓')).toBeVisible()
  expect(await lireTable(p, 'seances')).toHaveLength(1)
  expect(await lireTable(p, 'pesees')).toEqual([{ date: jour, poids: 70 }])

  // Le fichier d'une appli vide est refusé, sans rien effacer.
  await p.locator('input[type=file]').setInputFiles({ name: 'vide.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ app: 'muscu', seances: [], pesees: [], reglages: [{ cle: 'demarrage', valeur: {} }] })) })
  await expect(p.getByText('Cette sauvegarde est vide')).toBeVisible()
  expect(await lireTable(p, 'seances')).toHaveLength(1)
  expect(erreurs).toEqual([])
})

test('« Compléter » sur un téléphone qui n’a que le programme du démarrage : les phases du fichier reviennent, le jour du journal est complété, un seul cycle reste ouvert', async ({ page: p }) => {
  const erreurs = suivreErreurs(p)
  await p.goto('/')
  await premierProgramme(p)
  const jour = await aujourdhui(p)
  // Ce que la montre a déjà écrit pour aujourd'hui.
  await ecrire(p, 'journal', [{ date: jour, pas: 9000 }])
  const duDemarrage = (await lireTable(p, 'cycles')) as { id: string; fin?: string }[]
  expect(duDemarrage.filter((c) => !c.fin)).toHaveLength(1)

  const fichier = {
    app: 'muscu',
    seances: [seance('s1', '2026-10-06', [{ charge: 50, reps: 10, rpe: 8 }])],
    journal: [{ date: jour, pas: 4000, note: 'resto', sommeil: 6.5 }],
    reglages: [{ cle: 'objectifs', valeur: [{ depuis: '2026-09-01', phase: 'prise', calories: 3000, volume: {} }] }],
    cycles: [{ id: 'c_ancien', programmeId: 'p_ancien', programme: { id: 'p_ancien', nom: 'Ancien', seances: [] }, modeles: [], debut: '2026-10-05', semaines: 12, deloads: [], pauses: [], volume: {} }],
  }
  await ouvrirSauvegarde(p)
  await p.locator('input[type=file]').setInputFiles({ name: 'cran.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fichier)) })
  // Un programme et un cycle : le téléphone n'est pas « vide », on choisit.
  await expect(p.getByText('et tes objectifs')).toBeVisible()
  await p.getByRole('button', { name: 'Compléter', exact: true }).last().click()
  await expect(p.getByText('Ajouté ✓')).toBeVisible()

  const reglages = (await lireTable(p, 'reglages')) as { cle: string; valeur: { phase?: string; calories?: number }[] }[]
  expect(reglages.find((r) => r.cle === 'objectifs')?.valeur[0]).toMatchObject({ phase: 'prise', calories: 3000 })
  expect(await lireTable(p, 'journal')).toEqual([{ date: jour, pas: 9000, note: 'resto', sommeil: 6.5 }])
  const cycles = (await lireTable(p, 'cycles')) as { id: string; fin?: string }[]
  expect(cycles).toHaveLength(2)
  expect(cycles.filter((c) => !c.fin).map((c) => c.id)).toEqual(['c_ancien'])
  await p.reload()
  await expect(p.getByRole('button', { name: 'Réglages' })).toBeVisible()
  expect(erreurs).toEqual([])
})

test('base d’une ancienne version (avant le journal) : l’appli la met à jour sans rien perdre', async ({ page: p }) => {
  const erreurs = suivreErreurs(p)
  // Une page du site qui ne lance pas l'appli, pour créer la base comme une ancienne version (Dexie 6 = IndexedDB 60).
  await p.goto('/manifest.webmanifest')
  const jour = await aujourdhui(p)
  const ancienne = seance('ancienne', jour, [{ charge: 52.5, reps: 8, rpe: 8 }])
  // Rattachée par erreur à un cycle qui n'a pas encore commencé : la mise à jour retire ce lien, et rien d'autre.
  const avantCycle = { ...seance('avant-cycle', '2020-01-06', [{ charge: 40, reps: 10, rpe: 8 }]), cycleId: 'a-venir' }
  const cycleAVenir = { id: 'a-venir', debut: '2099-01-05', semaines: 6, deloads: [6], pauses: [], programmeId: 'p', programme: { id: 'p', nom: 'P', seances: [] }, modeles: [], volume: {} }
  // Bibliothèque réduite : un programme avec un exercice retiré passe sur celui qu'on garde, une copie à l'ancien nom ne bouge pas en base.
  const avecMollets = { id: 'hb', nom: 'Bas B', exercices: [{ exoId: 'mollets_debout', series: [{ reps: 10, charge: null }] }] }
  const copie = { id: 'presse', nom: 'Presse à cuisse', muscle: 'quadriceps', type: 'compose', mode: 'machine', pas: 10, suivreE1rm: true }
  await p.evaluate(
    ({ s, avant, c, m, e }) =>
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
          tx.objectStore('seances').put(avant)
          tx.objectStore('cycles').put({ ...c, modeles: [m] })
          tx.objectStore('modeles').put(m)
          tx.objectStore('exercices').put(e)
          tx.objectStore('pesees').put({ date: s.date, poids: 76.2 })
        }
        q.onsuccess = () => (q.result.close(), ok())
        q.onerror = () => ko(q.error)
      }),
    { s: ancienne, avant: avantCycle, c: cycleAVenir, m: avecMollets, e: copie }
  )

  await p.goto('/')
  await expect(p.getByText('76,2 kg')).toBeVisible()
  // Base passée à la version actuelle, avec la nouvelle table, et les anciennes données intactes.
  const version = await p.evaluate(() => new Promise<number>((ok) => (indexedDB.open('muscu').onsuccess = (e) => ok((e.target as IDBOpenDBRequest).result.version))))
  expect(version).toBeGreaterThanOrEqual(70)
  expect(await lireTable(p, 'journal')).toEqual([])
  const { cycleId: _, ...sansLien } = avantCycle
  expect(await lireTable(p, 'seances')).toEqual(expect.arrayContaining([ancienne, sansLien]))
  expect(await lireTable(p, 'pesees')).toEqual([{ date: jour, poids: 76.2 }])
  const exosDe = (m: unknown) => (m as typeof avecMollets).exercices.map((x) => x.exoId)
  expect((await lireTable(p, 'modeles')).map(exosDe)).toEqual([['mollets_machine']])
  expect((await lireTable(p, 'cycles')).flatMap((c) => (c as { modeles: unknown[] }).modeles.map(exosDe))).toEqual([['mollets_machine']])
  expect(await lireTable(p, 'exercices')).toEqual([copie])
  await ouvrirSeanceDuJour(p, 'Séance test')
  await expect(p.locator('.recap-serie').first()).toContainText('52,5 kg × 8')
  expect(erreurs).toEqual([])
})

test('programme modifié pendant un cycle : le cycle suit tout de suite, sans question, même en fermant l’appli', async ({ page: p }) => {
  const erreurs = suivreErreurs(p)
  await p.goto('/')
  await premierProgramme(p)
  await onglet(p, 'Programme')
  const joursDuCycle = async () => ((await lireTable(p, 'cycles')) as { programme: { seances: { jour?: number }[] } }[])[0].programme.seances.map((e) => e.jour)
  expect(await joursDuCycle()).not.toContain(7)

  // Un jour change, puis on ferme l'appli aussitôt, sans passer par ← : le cycle l'a déjà pris.
  await p.locator('.prog-jour').first().click()
  await p.getByRole('button', { name: 'dimanche' }).click()
  await expect.poll(joursDuCycle).toContain(7)
  await p.reload()
  expect(await joursDuCycle()).toContain(7)
  await onglet(p, 'Accueil')
  await expect(p.getByText('appliquer au cycle')).toHaveCount(0)
  expect(erreurs).toEqual([])
})
