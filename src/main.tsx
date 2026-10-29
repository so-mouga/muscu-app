import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { db, demanderStockagePersistant } from './db'
import Secours from './Secours'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Secours>
      <App />
    </Secours>
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

// Android reprend souvent l'appli déjà en mémoire, avec l'ancien code : en revenant dessus, on
// regarde si une nouvelle version est en ligne et on recharge (jamais pendant une séance).
async function verifierMiseAJour() {
  try {
    const html = await (await fetch('./index.html', { cache: 'no-store' })).text()
    const script = document.querySelector('script[type="module"][src]')?.getAttribute('src')
    if (!script || html.includes(script)) return
    if (await db.seances.filter((s) => s.enCours).count()) return
    location.reload()
  } catch {
    /* hors ligne */
  }
}
if (import.meta.env.PROD) {
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void verifierMiseAJour())
  window.addEventListener('load', () => void verifierMiseAJour())
}
