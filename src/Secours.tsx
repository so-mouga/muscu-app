import { Component, type ReactNode } from 'react'
import { db } from './db'

/**
 * Lecture de la base qui échoue sans raison durable : vu sur iPhone le 17 nov. 2026 (« UnknownError: Unable to open
 * cursor », Safari perd parfois le fil de sa base, surtout juste après l'installation sur l'écran d'accueil ou au retour
 * dans l'appli). Les données ne sont pas touchées : rouvrir la base et relire suffit.
 */
const passagere = (e: Error) => /UnknownError|Unable to open cursor|Indexed Database server lost|DatabaseClosedError|InvalidStateError/i.test(`${e.name} ${e.message}`)
const ESSAIS = 3

/** Erreur d'affichage : un message et un bouton pour recharger, plutôt qu'un écran vide. */
export default class Secours extends Component<{ children: ReactNode }, { erreur: Error | null; reprise: boolean }> {
  state = { erreur: null as Error | null, reprise: false }
  /** Reprises déjà tentées, et l'heure de la dernière : après une minute sans erreur, on repart de zéro. */
  essais = 0
  derniere = 0

  static getDerivedStateFromError(erreur: Error) {
    return { erreur, reprise: passagere(erreur) }
  }

  componentDidCatch(erreur: Error) {
    if (!passagere(erreur)) return
    if (Date.now() - this.derniere > 60000) this.essais = 0
    this.derniere = Date.now()
    // Toujours en panne après plusieurs reprises : on le dit, avec le message.
    if (this.essais >= ESSAIS) return this.setState({ reprise: false })
    this.essais++
    setTimeout(() => {
      void (async () => {
        try {
          db.close()
          await db.open()
        } catch {
          /* la relecture dira si la base répond */
        }
        this.setState({ erreur: null, reprise: false })
      })()
    }, 300 * this.essais)
  }

  render() {
    const { erreur, reprise } = this.state
    if (!erreur) return this.props.children
    // Le temps de rouvrir la base : rien à lire, l'écran revient tout seul.
    if (reprise) return null
    return (
      <div className="carte pile" style={{ marginTop: 40 }}>
        <h2>Oups, un problème d’affichage</h2>
        <div className="faible">Tes données sont intactes. Recharge l’appli ; si ça recommence, envoie-moi ce message :</div>
        <code className="petit" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {erreur.message} · version {__VERSION__}
        </code>
        <button className="btn primaire grand" onClick={() => location.reload()}>
          Recharger
        </button>
      </div>
    )
  }
}
