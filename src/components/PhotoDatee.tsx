import { dateCourte } from '../lib/calc'
import type { PhotoCorps } from '../types'

export default function PhotoDatee({ photo }: { photo: PhotoCorps }) {
  return (
    <figure>
      <img src={photo.image} alt={`Photo du ${dateCourte(photo.date)}`} />
      <figcaption>{dateCourte(photo.date).replace(/^\S+ /, '')}</figcaption>
    </figure>
  )
}
