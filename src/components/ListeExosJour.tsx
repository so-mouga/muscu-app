import { useLayoutEffect, useRef, useState } from 'react'

/** Hauteur d'une ligne, la même que `.exos-jour > div` dans styles.css. */
const HAUT_LIGNE = 26

export type LigneExo = { id: string; nom: string; gain?: string }

/**
 * Exercices d'une séance sur l'accueil : autant de lignes que la place en laisse, le reste en « +n autres ».
 * Quand tout ne tient pas, ceux qui ont un objectif à battre passent en premier.
 */
export default function ListeExosJour({ lignes, entiere }: { lignes: LigneExo[]; /** Toute la liste, en secondaire : la séance qui vient, rien à lancer. */ entiere?: boolean }) {
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
  // Liste entière : la carte suit son contenu ; sur un écran peu haut, on garde « Voir la séance » à l'écran.
  const possibles = entiere ? (window.innerHeight < 720 ? 5 : lignes.length) : place
  const tout = possibles >= lignes.length
  const montrees = tout ? lignes : [...lignes.filter((l) => l.gain), ...lignes.filter((l) => !l.gain)].slice(0, Math.max(1, possibles - 1))
  return (
    <div ref={zone} className={'exos-jour' + (entiere ? ' entiere' : '')}>
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
