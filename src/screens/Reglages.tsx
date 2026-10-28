import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import type { Catalogue } from '../catalogue'
import { db, exporterJSON, importerJSON, setReglage } from '../db'

function telecharger(nom: string, contenu: string, type: string) {
  const url = URL.createObjectURL(new Blob([contenu], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = nom
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function partagerOuTelecharger(nom: string, contenu: string, type: string) {
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

export default function Reglages({ catalogue }: { catalogue: Catalogue }) {
  const dernierExport = useLiveQuery(() => db.reglages.get('dernierExport'), [])
  const [persistant, setPersistant] = useState<boolean | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const jour = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersistant, () => setPersistant(null))
  }, [])

  const exporter = async () => {
    try {
      await partagerOuTelecharger(`muscu-${jour}.json`, await exporterJSON(), 'application/json')
      await setReglage('dernierExport', Date.now())
      setMessage('Export prêt ✓')
    } catch {
      /* partage annulé */
    }
  }

  const exporterCSV = async () => {
    const seances = await db.seances.orderBy('debut').filter((s) => !s.enCours).toArray()
    const lignes = [['date', 'seance', 'exercice', 'serie', 'type', 'charge', 'reps', 'rpe', 'demi_reps', 'zone'].join(';')]
    for (const s of seances) {
      const compte: Record<string, number> = {}
      for (const x of s.series) {
        compte[x.exoId] = (compte[x.exoId] ?? 0) + 1
        lignes.push(
          [s.date, s.nom, catalogue.exo(x.exoId).nom, compte[x.exoId], x.type, String(x.charge).replace('.', ','), x.reps, String(x.rpe).replace('.', ','), x.demiReps ?? '', x.zone ?? ''].join(';')
        )
      }
    }
    try {
      await partagerOuTelecharger(`muscu-series-${jour}.csv`, lignes.join('\n'), 'text/csv')
    } catch {
      /* partage annulé */
    }
  }

  const importer = async (f: File | undefined) => {
    if (!f) return
    if (!confirm('Remplacer toutes les données de ce téléphone par celles du fichier ?')) return
    try {
      await importerJSON(await f.text())
      setMessage('Import terminé ✓')
    } catch (e) {
      setMessage('Import impossible : ' + (e as Error).message)
    }
  }

  return (
    <div>
      <div className="entete">
        <h1>Réglages</h1>
      </div>

      <div className="carte pile">
        <h3>Sauvegarde</h3>
        <div className="faible">
          Tes données sont stockées uniquement sur ce téléphone. Exporte-les chaque semaine (Drive, mail…) pour ne rien perdre en cas de changement de téléphone.
        </div>
        <div className="petit muted">
          Dernier export :{' '}
          {dernierExport ? new Date(dernierExport.valeur as number).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : 'jamais'}
        </div>
        <button className="btn primaire plein" onClick={exporter}>
          Exporter tout (JSON)
        </button>
        <button className="btn plein" onClick={exporterCSV}>
          Exporter les séries (CSV)
        </button>
        <label className="btn plein">
          Importer un export JSON
          <input type="file" accept="application/json,.json" hidden onChange={(e) => importer(e.target.files?.[0])} />
        </label>
        {message && <div className="petit">{message}</div>}
      </div>

      <div className="carte pile">
        <h3>Stockage</h3>
        <div className="petit muted">
          {persistant === true && '✓ Stockage persistant accordé : le navigateur ne l’effacera pas automatiquement.'}
          {persistant === false && 'Stockage non persistant. Installe l’appli sur l’écran d’accueil (menu ⋮ → Installer) pour le renforcer.'}
          {persistant === null && 'État du stockage inconnu.'}
        </div>
      </div>

      <div className="carte pile">
        <h3>À propos</h3>
        <div className="faible">
          Les suggestions de charge sont des propositions : c’est toi qui décides. Les pas de charge se règlent par exercice dans Progression.
        </div>
        <div className="faible">Version 0.2</div>
      </div>
    </div>
  )
}
