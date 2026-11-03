// --- Fenêtres : sortie animée et glissement vers le bas ---------------------------
// Tout passe ici plutôt que dans chacune des fenêtres : la sortie suit n'importe quelle fermeture
// (bouton, appui à côté, retour Android), et le geste fait exactement comme un appui à côté.

const COUCHES = '.modal-fond, .comparaison-plein, .page-dessus'
/** Éléments qui ont déjà leur propre geste : le doigt reste à eux. */
const SANS_TIRAGE = 'input[type="range"], textarea, .poignee, .photo-zoom, .superposition'
const DUREE_SORTIE = 220 // --duree-courte, plus une marge

/** Au relâchement : assez loin, ou un petit coup de doigt rapide vers le bas. */
export function fermerAuRelache(distance: number, vitesse: number, hauteur: number): boolean {
  return distance >= Math.min(120, hauteur * 0.25) || (distance >= 40 && vitesse >= 0.5)
}

const sansAnimation = () => matchMedia('(prefers-reduced-motion: reduce)').matches

// Un élément retiré de la page ne connaît plus sa position de défilement : on la note au fil de l'eau.
const defilements = new WeakMap<Element, number>()

/** Copie inerte de la couche fermée, le temps de sa sortie : React l'a déjà retirée, rien ne peut plus se perdre. */
function jouerSortie(couche: Element) {
  const copie = couche.cloneNode(true) as HTMLElement
  const avant = [couche, ...couche.querySelectorAll('*')]
  const apres = [copie, ...copie.querySelectorAll('*')]
  // Ni la valeur tapée ni le défilement ne sont copiés par cloneNode.
  avant.forEach((el, i) => {
    if (el instanceof HTMLInputElement) {
      ;(apres[i] as HTMLInputElement).value = el.value
      ;(apres[i] as HTMLInputElement).checked = el.checked
    } else if (el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
      ;(apres[i] as HTMLSelectElement).value = el.value
    }
  })
  copie.classList.add('sortie')
  copie.setAttribute('aria-hidden', 'true')
  copie.inert = true
  document.body.appendChild(copie)
  avant.forEach((el, i) => {
    const haut = defilements.get(el)
    if (haut) apres[i].scrollTop = haut
  })
  setTimeout(() => copie.remove(), DUREE_SORTIE)
}

function suivreFermetures() {
  const estCouche = (n: Node): n is Element => n instanceof Element && !n.classList.contains('sortie') && n.matches(COUCHES)
  const couches = (n: Node) => (n instanceof Element ? [...(estCouche(n) ? [n] : []), ...n.querySelectorAll(COUCHES)].filter((c) => !c.classList.contains('sortie')) : [])
  document.addEventListener('scroll', (e) => {
    if (e.target instanceof Element && e.target.closest(COUCHES)) defilements.set(e.target, e.target.scrollTop)
  }, true)
  new MutationObserver((changements) => {
    const retirees = changements.flatMap((c) => [...c.removedNodes].flatMap(couches))
    if (!retirees.length || sansAnimation()) return
    // Une fenêtre qui en remplace une autre : la nouvelle monte, l'ancienne ne descend pas en même temps.
    if (changements.some((c) => [...c.addedNodes].some((n) => couches(n).some((x) => x.matches('.modal-fond'))))) return
    retirees.forEach(jouerSortie)
  }).observe(document.body, { childList: true, subtree: true })
}

/** La fenêtre défile encore vers le haut là où le doigt est posé : le geste est un défilement. */
function defileEncore(cible: Element, modal: Element) {
  for (let el: Element | null = cible; el; el = el === modal ? null : el.parentElement) {
    if (el.scrollTop > 0) return true
  }
  return false
}

function revenir(modal: HTMLElement) {
  modal.style.transition = 'transform var(--duree-courte) var(--sortie)'
  modal.style.transform = ''
  setTimeout(() => (modal.style.transition = ''), DUREE_SORTIE)
}

type Tirage = { modal: HTMLElement; fond: HTMLElement; cible: Element; x0: number; y0: number; tire: boolean; distance: number; dernierY: number; dernierT: number; vitesse: number }

function suivreTirage() {
  let t: Tirage | null = null
  const abandonner = () => {
    if (t?.tire) revenir(t.modal)
    t = null
  }
  document.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return abandonner()
    const cible = e.target as Element
    const modal = cible.closest?.<HTMLElement>('.modal')
    const fond = modal?.parentElement
    // Pas les fenêtres de confirmation, au centre : une décision ne se prend pas d'un geste.
    if (!modal || !fond?.matches('.modal-fond:not(.dialogue)') || cible.closest(SANS_TIRAGE)) return
    const { clientX: x, clientY: y } = e.touches[0]
    t = { modal, fond, cible, x0: x, y0: y, tire: false, distance: 0, dernierY: y, dernierT: e.timeStamp, vitesse: 0 }
  }, { passive: true })

  document.addEventListener('touchmove', (e) => {
    if (!t) return
    const { clientX: x, clientY: y } = e.touches[0]
    if (!t.tire) {
      const dx = x - t.x0
      const dy = y - t.y0
      if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return
      if (dy <= 0 || Math.abs(dx) > Math.abs(dy) || defileEncore(t.cible, t.modal)) {
        t = null
        return
      }
      // La montée doit être finie, sinon elle prendrait le pas sur le doigt. `finish` ne la rejoue pas ensuite.
      t.modal.getAnimations().forEach((a) => a.finish())
      t.modal.style.transition = 'none'
      t.tire = true
      t.y0 = y
    }
    if (e.cancelable) e.preventDefault()
    t.distance = Math.max(0, y - t.y0)
    const duree = e.timeStamp - t.dernierT
    if (duree > 0) t.vitesse = (y - t.dernierY) / duree
    t.dernierY = y
    t.dernierT = e.timeStamp
    t.modal.style.transform = `translateY(${t.distance}px)`
  }, { passive: false })

  document.addEventListener('touchend', () => {
    if (!t?.tire) {
      t = null
      return
    }
    const { modal, fond, distance, vitesse } = t
    t = null
    if (!fermerAuRelache(distance, vitesse, modal.offsetHeight)) return revenir(modal)
    fond.click()
    // Une fermeture peut attendre une écriture dans la base ; si la fenêtre refuse de partir, elle revient.
    setTimeout(() => modal.isConnected && revenir(modal), 400)
  })
  document.addEventListener('touchcancel', abandonner)
}

export function installerFenetres() {
  suivreFermetures()
  suivreTirage()
}
