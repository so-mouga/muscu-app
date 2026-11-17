/** Adresse d'un dessin : livré avec l'appli (`dessins/…`) ou photo prise par la personne (data URL). */
export const srcDessin = (image: string) => (/^(data:|blob:|https?:|\/|\.\/)/.test(image) ? image : import.meta.env.BASE_URL + image)

/** Dessin d'un mouvement, sur fond blanc (les dessins sont faits pour un fond clair) ; une case vide s'il n'y en a pas. */
export default function Dessin({ image, taille, large, onClick }: { image?: string; taille?: number; /** Bandeau sur toute la largeur. */ large?: boolean; onClick?: () => void }) {
  const style = large ? undefined : { width: taille ?? 52, height: taille ?? 52 }
  if (!image) return large ? null : <span className="dessin vide" style={style} />
  const img = <img src={srcDessin(image)} alt="" />
  return onClick ? (
    <button type="button" className={'dessin' + (large ? ' large' : '')} style={style} onClick={onClick} aria-label="Voir le dessin en grand">
      {img}
    </button>
  ) : (
    <span className={'dessin' + (large ? ' large' : '')} style={style}>
      {img}
    </span>
  )
}
