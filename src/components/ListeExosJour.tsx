import { Flame } from 'lucide-react'
import { IconeCran } from './Disque'
import { useLayoutEffect, useRef, useState } from 'react'

/** Hauteur d'une ligne, la même que `.exos-jour > div` dans styles.css. */
const HAUT_LIGNE = 26

/**
 * Séance du jour : le nom seul, et la pastille « À battre » (`aBattre`) quand un objectif plus haut que la dernière fois a été choisi.
 * Séance faite (`fait`) : le gain face à la fois d'avant, en vert.
 */
export type LigneExo = { id: string; nom: string; gain?: string; aBattre?: boolean; /** Séance faite : un record battu (petit disque, gain en blanc). */ record?: boolean }

/** À battre ou un vrai gain d'abord (« +2 kg »), puis « = », puis le reste : ce qu'on garde quand tout ne tient pas. */
const rang = (l: LigneExo) => (l.record ? -1 : l.aBattre || (l.gain && l.gain !== '=') ? 0 : l.gain ? 1 : 2)

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
          <div key={l.id} className={'exo-jour' + (fait && rang(l) > 0 ? ' terne' : '') + (!fait && !l.aBattre ? ' simple' : '') + (l.record ? ' record' : '')}>
            <span className="exo-jour-nom">{l.nom}</span>
            {l.gain && (
              <span className="exo-jour-gain">
                {l.record && <IconeCran taille={14} />}
                {l.gain}
              </span>
            )}
            {l.aBattre && (
              <span className="badge-hausse exo-jour-battre">
                <Flame size={12} className="ico-texte" /> À battre
              </span>
            )}
          </div>
        ))}
        {!tout && (
          <div className="exos-jour-autres">
            +{lignes.length - montrees.length} {fait && lignes.filter((l) => !montrees.includes(l)).every((l) => rang(l) > 0) ? 'sans progrès' : 'autres'}
          </div>
        )}
      </div>
    </div>
  )
}
