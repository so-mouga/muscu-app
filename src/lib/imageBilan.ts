/** Ce que montre l'image à partager : l'entraînement seulement, jamais le poids ni le corps. */
export interface LigneImage {
  nom: string
  detail: string
  valeur?: string
}

export interface ContenuImage {
  periode: string
  /** Nom du cycle, si le bilan porte sur un cycle. */
  titre?: string
  seances: number
  tenues?: { n: number; sur: number }
  montent: number
  lignes: LigneImage[]
}

const LARGEUR = 360
const ECHELLE = 3
const MARGE = 24
/** Tracé de `public/icon.svg`, sur 512 unités. */
const LOGO = 'M220.36,91.82 A168,168 0 1,0 291.64,91.82 L291.64,154.18 L220.36,154.18 Z M256,215.27 a40.73,40.73 0 1,0 0,81.45 a40.73,40.73 0 1,0 0,-81.45 Z'

/** Les chiffres de l'image, dans l'ordre : rien ne s'affiche à zéro. */
export function chiffresImage(c: ContenuImage): { valeur: string; nom: string; vert?: boolean }[] {
  return [
    { valeur: String(c.seances), nom: c.seances > 1 ? 'séances' : 'séance' },
    ...(c.tenues && c.tenues.sur > 0 ? [{ valeur: `${c.tenues.n} sur ${c.tenues.sur}`, nom: c.tenues.sur > 1 ? 'semaines tenues' : 'semaine tenue' }] : []),
    ...(c.montent > 0 ? [{ valeur: String(c.montent), nom: c.montent > 1 ? 'exercices montent' : 'exercice monte', vert: true }] : []),
  ]
}

/** Coupe un texte trop long pour sa place, avec des points de suspension. */
function ajuster(ctx: CanvasRenderingContext2D, texte: string, largeur: number) {
  if (ctx.measureText(texte).width <= largeur) return texte
  let t = texte
  while (t.length > 1 && ctx.measureText(t + '…').width > largeur) t = t.slice(0, -1)
  return t.trimEnd() + '…'
}

/** Dessine l'image du bilan aux couleurs de l'appli (PNG de 1080 px de large). */
export async function dessinerBilan(c: ContenuImage): Promise<Blob> {
  await Promise.all(['400', '600', '700'].map((g) => document.fonts.load(`${g} 16px Barlow`)))
  const css = getComputedStyle(document.documentElement)
  const couleur = (nom: string) => css.getPropertyValue(nom).trim()
  const hauteur = MARGE + 28 + (c.titre ? 28 : 0) + 72 + c.lignes.length * 56 + MARGE
  const canvas = document.createElement('canvas')
  canvas.width = LARGEUR * ECHELLE
  canvas.height = hauteur * ECHELLE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Le téléphone n’a pas pu créer l’image.')
  ctx.scale(ECHELLE, ECHELLE)
  ctx.fillStyle = couleur('--bg')
  ctx.fillRect(0, 0, LARGEUR, hauteur)
  ctx.textBaseline = 'alphabetic'

  const police = (taille: number, graisse = 400) => (ctx.font = `${graisse} ${taille}px Barlow`)
  const droite = LARGEUR - MARGE
  const largeurUtile = droite - MARGE

  ctx.save()
  ctx.translate(MARGE, MARGE)
  ctx.scale(24 / 512, 24 / 512)
  ctx.fillStyle = couleur('--accent')
  ctx.fill(new Path2D(LOGO), 'evenodd')
  ctx.restore()
  police(16, 600)
  ctx.fillStyle = couleur('--texte')
  ctx.fillText('Cran', MARGE + 30, MARGE + 18)
  police(14)
  ctx.fillStyle = couleur('--texte-2')
  ctx.textAlign = 'right'
  ctx.fillText(c.periode, droite, MARGE + 18)
  ctx.textAlign = 'left'
  let y = MARGE + 28

  if (c.titre) {
    police(16, 600)
    ctx.fillStyle = couleur('--texte')
    ctx.fillText(ajuster(ctx, c.titre, largeurUtile), MARGE, y + 20)
    y += 28
  }

  const chiffres = chiffresImage(c)
  const colonne = largeurUtile / chiffres.length
  chiffres.forEach((x, i) => {
    police(20, 700)
    ctx.fillStyle = x.vert ? couleur('--ok') : couleur('--texte')
    ctx.fillText(x.valeur, MARGE + i * colonne, y + 36)
    police(12)
    ctx.fillStyle = couleur('--texte-2')
    ctx.fillText(ajuster(ctx, x.nom, colonne - 6), MARGE + i * colonne, y + 54)
  })
  y += 72

  for (const l of c.lignes) {
    let place = largeurUtile
    if (l.valeur) {
      police(16, 600)
      ctx.fillStyle = couleur('--ok')
      ctx.textAlign = 'right'
      ctx.fillText(l.valeur, droite, y + 30)
      ctx.textAlign = 'left'
      place -= ctx.measureText(l.valeur).width + 12
    }
    police(16)
    ctx.fillStyle = couleur('--texte')
    ctx.fillText(ajuster(ctx, l.nom, place), MARGE, y + 20)
    police(14)
    ctx.fillStyle = couleur('--texte-2')
    ctx.fillText(ajuster(ctx, l.detail, place), MARGE, y + 39)
    y += 56
  }

  return new Promise((ok, non) => canvas.toBlob((b) => (b ? ok(b) : non(new Error('Le téléphone n’a pas pu créer l’image.'))), 'image/png'))
}
