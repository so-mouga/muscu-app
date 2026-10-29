import { useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'

// --- Bouton retour Android ---------------------------------------------------
// Les couches ouvertes (onglet, détail, fenêtre) forment une pile. Tant qu'elle n'est pas
// vide, une seule entrée « piège » est gardée dans l'historique : le retour la consomme,
// on ferme la couche du dessus, puis on remet le piège. Ainsi le retour ne quitte jamais
// l'appli par erreur, quel que soit l'enchaînement d'ouvertures et de fermetures.

type Gestionnaire = { fn: () => 'rester' | void }
const pile: Gestionnaire[] = []
let aIgnorer = 0

const surPiege = () => (history.state as { piege?: boolean } | null)?.piege === true

function assurerPiege() {
  if (pile.length > 0 && !surPiege()) history.pushState({ piege: true }, '')
}

function retirerPiegeSiInutile() {
  // Plusieurs couches fermées d'un coup : un seul retour, sinon on sortirait de l'appli.
  if (pile.length === 0 && surPiege() && aIgnorer === 0) {
    aIgnorer++
    history.back()
  }
}

window.addEventListener('popstate', () => {
  if (aIgnorer > 0) {
    aIgnorer--
    assurerPiege()
    return
  }
  const haut = pile.pop()
  if (haut && haut.fn() === 'rester') pile.push(haut)
  setTimeout(assurerPiege, 0)
})

/** Tant que `actif`, le bouton retour appelle `onRetour`. Renvoyer 'rester' garde la couche. */
export function useRetour(actif: boolean, onRetour: () => 'rester' | void) {
  const cb = useRef(onRetour)
  cb.current = onRetour
  useEffect(() => {
    if (!actif) return
    const g: Gestionnaire = { fn: () => cb.current() }
    pile.push(g)
    assurerPiege()
    return () => {
      const i = pile.indexOf(g)
      if (i >= 0) pile.splice(i, 1)
      // Fermée par un bouton à l'écran : on enlève le piège s'il ne sert plus (après le rendu,
      // pour ne pas le retirer quand une autre couche s'ouvre aussitôt).
      setTimeout(retirerPiegeSiInutile, 50)
    }
  }, [actif])
}

// --- Transitions entre écrans --------------------------------------------------

/** `carte-*` : seule la carte d'exercice glisse, l'en-tête de séance reste en place. */
export type Sens = 'avant' | 'arriere' | 'fondu' | 'carte-avant' | 'carte-arriere'

/** Applique un changement d'état avec une transition d'écran (View Transitions, si disponible). */
export function transition(fn: () => void, sens: Sens = 'fondu') {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
  if (!doc.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    fn()
    return
  }
  document.documentElement.dataset.sens = sens
  doc.startViewTransition(() => flushSync(fn))
}
