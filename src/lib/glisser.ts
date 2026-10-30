import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { vibrer } from './appareil'

/**
 * Glisser-déposer dans une liste : on maintient la poignée ⠿ un instant, on glisse, l'élément s'insère
 * là où on relâche. Un doigt qui bouge avant le délai fait défiler la page, sans rien déplacer.
 * `selecteur` : la classe des lignes dans `liste` ; `onDeposer(de, vers)` avec vers = position 0 … n.
 */
export function useGlisser(selecteur: string, onDeposer: (de: number, vers: number) => void) {
  const liste = useRef<HTMLDivElement>(null)
  const [glisse, setGlisse] = useState<{ de: number; vers: number } | null>(null)
  const prise = useRef<{ y: number; minuterie: number } | null>(null)
  const glisseRef = useRef(glisse)
  glisseRef.current = glisse
  useEffect(() => {
    // Pendant un déplacement, le doigt ne fait plus défiler la page.
    const bloquer = (e: TouchEvent) => glisseRef.current && e.preventDefault()
    document.addEventListener('touchmove', bloquer, { passive: false })
    return () => document.removeEventListener('touchmove', bloquer)
  }, [])
  const lacher = () => {
    if (prise.current) clearTimeout(prise.current.minuterie)
    prise.current = null
  }
  /** Position d'insertion (0 … n) sous le doigt. */
  const positionSous = (y: number) => {
    const lignes = [...(liste.current?.querySelectorAll<HTMLElement>(selecteur) ?? [])]
    const k = lignes.findIndex((l) => {
      const r = l.getBoundingClientRect()
      return y < r.top + r.height / 2
    })
    return k < 0 ? lignes.length : k
  }

  /** Gestes de la poignée de la ligne i. */
  const poignee = (i: number) => ({
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      const cible = e.currentTarget
      const pointeur = e.pointerId
      lacher()
      prise.current = {
        y: e.clientY,
        minuterie: window.setTimeout(() => {
          prise.current = null
          if (cible.isConnected) cible.setPointerCapture(pointeur)
          vibrer(25)
          setGlisse({ de: i, vers: i })
        }, 300),
      }
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (prise.current && Math.abs(e.clientY - prise.current.y) > 8) lacher()
      if (!glisse) return
      // Défilement automatique près des bords de l'écran
      if (e.clientY < 90) window.scrollBy(0, -12)
      else if (e.clientY > innerHeight - 110) window.scrollBy(0, 12)
      setGlisse({ ...glisse, vers: positionSous(e.clientY) })
    },
    onPointerUp: () => {
      lacher()
      if (glisse && glisse.vers !== glisse.de && glisse.vers !== glisse.de + 1) onDeposer(glisse.de, glisse.vers)
      setGlisse(null)
    },
    onPointerCancel: () => (lacher(), setGlisse(null)),
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  })

  /** Classes de la ligne i sur n : élément attrapé, repère d'insertion. */
  const classes = (i: number, n: number) =>
    (glisse?.de === i ? ' glisse' : '') +
    (glisse && glisse.vers === i && glisse.vers !== glisse.de && glisse.vers !== glisse.de + 1 ? ' depot-avant' : '') +
    (glisse && i === n - 1 && glisse.vers === n && glisse.de !== i ? ' depot-apres' : '')

  return { liste, poignee, classes }
}

/** Déplace l'élément `de` à la position d'insertion `vers` (0 … n). */
export function deplacer<T>(l: T[], de: number, vers: number) {
  const [e] = l.splice(de, 1)
  l.splice(vers > de ? vers - 1 : vers, 0, e)
}
