import { jsx as _jsx } from "react/jsx-runtime";
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { demanderStockagePersistant } from './db';
import './styles.css';
createRoot(document.getElementById('root')).render(_jsx(StrictMode, { children: _jsx(App, {}) }));
void demanderStockagePersistant();
// Petite vibration à chaque appui sur un bouton, comme une appli native.
document.addEventListener('pointerdown', (e) => {
    if (e.target.closest?.('button:not(:disabled), label.btn')) {
        try {
            navigator.vibrate?.(8);
        }
        catch {
            /* non disponible */
        }
    }
});
if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => void navigator.serviceWorker.register('./sw.js'));
}
