import { natif, partageBilanDisponible, partagerImageNatif, partagerTexteNatif } from './natif'

const APK_ANCIEN = 'Ta version de l’appli ne sait pas encore partager une image. Installe la nouvelle version depuis le bandeau de l’accueil, tes données sont gardées.'

/** Menu de partage, sinon téléchargement. Lève `AbortError` si l'utilisateur annule. */
export async function partagerImage(nom: string, image: Blob) {
  if (natif) {
    if (!(await partageBilanDisponible())) throw new Error(APK_ANCIEN)
    if (!(await partagerImageNatif(nom, image))) throw new DOMException('Partage annulé', 'AbortError')
    return
  }
  const fichier = new File([image], nom, { type: image.type })
  if (navigator.canShare?.({ files: [fichier] })) {
    await navigator.share({ files: [fichier], title: nom })
    return
  }
  const url = URL.createObjectURL(image)
  const a = document.createElement('a')
  a.href = url
  a.download = nom
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Menu de partage ; sans menu (ancien APK, ordinateur), le texte est copié : renvoie alors `copie`. */
export async function partagerTexte(titre: string, texte: string): Promise<'partage' | 'copie'> {
  if (natif && (await partageBilanDisponible())) {
    await partagerTexteNatif(titre, texte)
    return 'partage'
  }
  if (typeof navigator.share === 'function') {
    await navigator.share({ title: titre, text: texte })
    return 'partage'
  }
  await navigator.clipboard.writeText(texte)
  return 'copie'
}
