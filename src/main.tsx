import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { demanderStockagePersistant } from './db'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

void demanderStockagePersistant()

// Petite vibration à chaque appui sur un bouton, comme une appli native.
document.addEventListener('pointerdown', (e) => {
  if ((e.target as Element).closest?.('button:not(:disabled), label.btn')) {
    try {
      navigator.vibrate?.(8)
    } catch {
      /* non disponible */
    }
  }
})

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('./sw.js'))
}
