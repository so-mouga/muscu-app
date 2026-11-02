import { useLayoutEffect, useRef, useState } from 'react'

/** Hauteur d'une ligne, la même que `.exos-jour > div` dans styles.css. */
const HAUT_LIGNE = 26

export type LigneExo = { id: string; nom: string; gain?: string }

/**
 * Exercices d'une séance sur l'accueil : autant de lignes que la place en laisse, le reste en « +n autres ».
 * Quand tout ne tient pas, ceux qui ont un objectif à battre passent en premier.
 */
export default function ListeExosJour({ lignes, faible }: { lignes: LigneExo[]; faible?: boolean }) {
  const zone = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState(lignes.length)
  useLayoutEffect(() => {
    const el = zone.current
    if (!el) return
    const mesurer = () => setPlace(Math.floor(el.clientHeight / HAUT_LIGNE))
    mesurer()
    const o = new ResizeObserver(mesurer)
    o.observe(el)
    return () => o.disconnect()
  }, [])
  const tout = place >= lignes.length
  const montrees = tout ? lignes : [...lignes.filter((l) => l.gain), ...lignes.filter((l) => !l.gain)].slice(0, Math.max(1, place - 1))
  return (
    <div ref={zone} className={'exos-jour' + (faible ? ' faibles' : '')}>
      <div className="exos-jour-lignes">
        {montrees.map((l) => (
          <div key={l.id} className="exo-jour">
            <span className="exo-jour-nom">{l.nom}</span>
            {l.gain && <span className="exo-jour-gain">{l.gain}</span>}
          </div>
        ))}
        {!tout && <div className="exos-jour-autres">+{lignes.length - montrees.length} autres</div>}
      </div>
    </div>
  )
}
