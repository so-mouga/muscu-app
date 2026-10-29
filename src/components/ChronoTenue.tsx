import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { alarme, debloquerSon, tic, vibrer } from '../lib/appareil'
import { chrono } from '../lib/calc'
import { useRetour } from '../lib/nav'
import Anneau from './Anneau'

interface Props {
  /** Temps visé, en secondes. */
  objectif: number
  nom: string
  onStop: (secondes: number) => void
  onAnnuler: () => void
}

/** Chrono plein écran d'une série en temps (gainage…) : 3, 2, 1, puis le temps tenu jusqu'à « Stop ». */
export default function ChronoTenue({ objectif, nom, onStop, onAnnuler }: Props) {
  useRetour(true, onAnnuler)
  // Départ après le décompte : horodatage, pour un temps juste même si l'écran se met en veille.
  const [depart] = useState(() => Date.now() + 3000)
  const [maintenant, setMaintenant] = useState(Date.now())
  const sonne = useRef(false)
  const dernierTic = useRef<number | null>(null)

  useEffect(() => {
    debloquerSon()
    const t = setInterval(() => setMaintenant(Date.now()), 100)
    return () => clearInterval(t)
  }, [])

  const avant = Math.ceil((depart - maintenant) / 1000)
  const tenu = Math.max(0, Math.floor((maintenant - depart) / 1000))
  const atteint = tenu >= objectif

  // Décompte sonore, puis une sonnerie à l'objectif.
  useEffect(() => {
    if (avant > 0 && avant <= 3 && dernierTic.current !== avant) {
      dernierTic.current = avant
      tic(false)
      vibrer(30)
    } else if (avant <= 0 && dernierTic.current !== 0) {
      dernierTic.current = 0
      tic(true)
      vibrer(80)
    }
  }, [avant])
  useEffect(() => {
    if (atteint && !sonne.current) {
      sonne.current = true
      alarme()
    }
  }, [atteint])

  // Directement sous <body> : la carte d'exercice ne doit pas contenir l'écran du chrono.
  return createPortal(
    <div className="chrono-tenue">
      <div className="faible">{nom}</div>
      {avant > 0 ? (
        <>
          <div className="decompte-tenue">{avant}</div>
          <div className="faible">Mets-toi en place…</div>
        </>
      ) : (
        <>
          <Anneau valeur={Math.min(1, tenu / Math.max(1, objectif))} taille={240} epaisseur={12} couleur={atteint ? 'var(--ok)' : 'var(--accent)'}>
            <div className="temps-grand">{chrono(tenu)}</div>
            <div className="libelle">{atteint ? `Objectif ${objectif} s atteint 💪` : `objectif ${objectif} s`}</div>
          </Anneau>
          <div className="faible">{atteint ? 'Continue si tu peux, puis Stop.' : 'Tiens bon : appuie sur Stop quand tu lâches.'}</div>
        </>
      )}
      <button className={'btn grand' + (avant > 0 ? '' : ' primaire')} style={{ width: '100%' }} onClick={() => (avant > 0 ? onAnnuler() : onStop(tenu))}>
        {avant > 0 ? 'Annuler' : '■ STOP'}
      </button>
    </div>,
    document.body
  )
}
