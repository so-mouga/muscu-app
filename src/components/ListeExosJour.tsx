import { useLayoutEffect, useRef, useState } from 'react'

/** Hauteur d'une ligne, la même que `.exos-jour > div` dans styles.css. */
const HAUT_LIGNE = 26

/**
 * `ton` (séance du jour) : `record` = un record à ta portée, le chiffre en blanc ; `terne` = la dernière fois, en gris.
 * Sans `ton`, le gain est en orange (objectif à battre) ou en vert (séance faite).
 */
export type LigneExo = { id: string; nom: string; gain?: string; ton?: 'record' | 'terne' }

/** Un vrai gain d'abord (« +2 kg »), puis « = », puis le reste : ce qu'on garde quand tout ne tient pas. */
const rang = (l: LigneExo) => (l.ton === 'terne' ? 2 : l.gain && l.gain !== '=' ? 0 : l.gain ? 1 : 2)

/**
 * Exercices d'une séance sur l'accueil : autant de lignes que la place en laisse, le reste en « +n autres ».
 * Quand tout ne tient pas, ceux qui ont un gain (à battre, ou gagné) passent en premier.
 * `fait` : la séance faite aujourd'hui, le gain en vert ; les exercices sans gain en gris, sans reproche.
 */
export default function ListeExosJour({ lignes, fait, onClick }: { lignes: LigneExo[]; fait?: boolean; /** Un appui sur la liste (séance faite : l'ouvrir). */ onClick?: () => void }) {
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
  const montrees = tout ? lignes : [...lignes].sort((a, b) => rang(a) - rang(b)).slice(0, Math.max(1, place - 1))
  return (
    <div ref={zone} className={'exos-jour' + (fait ? ' fait' : '')} onClick={onClick} role={onClick ? 'button' : undefined}>
      <div className="exos-jour-lignes">
        {montrees.map((l) => (
          <div key={l.id} className={'exo-jour' + ((fait && rang(l) > 0) || l.ton === 'terne' ? ' terne' : '') + (l.ton === 'record' ? ' record' : '')}>
            <span className="exo-jour-nom">{l.nom}</span>
            {l.gain && <span className="exo-jour-gain">{l.gain}</span>}
          </div>
        ))}
        {!tout && <div className="exos-jour-autres">+{lignes.length - montrees.length} autres</div>}
      </div>
    </div>
  )
}
