import { useEffect, useState, type ReactNode } from 'react'

/**
 * Une seule fenêtre active à la fois (onglet Chrome ou appli installée) : la dernière ouverte prend
 * la main, les autres se mettent en veille. Deux fenêtres, dont une à l'ancienne version, écrivant
 * dans la même base, bloquaient la validation des séries.
 */
export default function UneFenetre({ children }: { children: ReactNode }) {
  const [ailleurs, setAilleurs] = useState(false)

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const canal = new BroadcastChannel('muscu-fenetre')
    canal.onmessage = (e) => e.data === 'ici' && setAilleurs(true)
    canal.postMessage('ici')
    return () => canal.close()
  }, [])

  if (!ailleurs) return children
  return (
    <div className="carte pile" style={{ marginTop: 40 }}>
      <h2>Muscu est ouverte ailleurs</h2>
      <div className="faible">
        L’appli est ouverte dans une autre fenêtre (onglet Chrome ou appli installée). Une seule à la fois, pour ne pas mélanger les enregistrements.
      </div>
      {/* Recharger : cette fenêtre reprend la main, avec la dernière version. */}
      <button className="btn primaire grand" onClick={() => location.reload()}>
        Utiliser ici
      </button>
    </div>
  )
}
