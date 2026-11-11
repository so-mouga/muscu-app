/**
 * Un seul appui compte : tant que l'action tourne, et une fois qu'elle a réussi, les appuis suivants sont ignorés
 * (l'écran va changer). Si elle échoue, on peut réessayer.
 */
export function verrou() {
  let pris = false
  return async (action: () => Promise<void>) => {
    if (pris) return
    pris = true
    try {
      await action()
    } catch (e) {
      pris = false
      throw e
    }
  }
}
