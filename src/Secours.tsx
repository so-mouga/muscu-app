import { Component, type ReactNode } from 'react'

/** Erreur d'affichage : un message et un bouton pour recharger, plutôt qu'un écran vide. */
export default class Secours extends Component<{ children: ReactNode }, { erreur: Error | null }> {
  state = { erreur: null as Error | null }

  static getDerivedStateFromError(erreur: Error) {
    return { erreur }
  }

  render() {
    const { erreur } = this.state
    if (!erreur) return this.props.children
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
