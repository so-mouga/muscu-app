import { useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
const pile = [];
let aIgnorer = 0;
const surPiege = () => history.state?.piege === true;
function assurerPiege() {
    if (pile.length > 0 && !surPiege())
        history.pushState({ piege: true }, '');
}
function retirerPiegeSiInutile() {
    if (pile.length === 0 && surPiege()) {
        aIgnorer++;
        history.back();
    }
}
window.addEventListener('popstate', () => {
    if (aIgnorer > 0) {
        aIgnorer--;
        assurerPiege();
        return;
    }
    const haut = pile.pop();
    if (haut && haut.fn() === 'rester')
        pile.push(haut);
    setTimeout(assurerPiege, 0);
});
/** Tant que `actif`, le bouton retour appelle `onRetour`. Renvoyer 'rester' garde la couche. */
export function useRetour(actif, onRetour) {
    const cb = useRef(onRetour);
    cb.current = onRetour;
    useEffect(() => {
        if (!actif)
            return;
        const g = { fn: () => cb.current() };
        pile.push(g);
        assurerPiege();
        return () => {
            const i = pile.indexOf(g);
            if (i >= 0)
                pile.splice(i, 1);
            // Fermée par un bouton à l'écran : on enlève le piège s'il ne sert plus (après le rendu,
            // pour ne pas le retirer quand une autre couche s'ouvre aussitôt).
            setTimeout(retirerPiegeSiInutile, 50);
        };
    }, [actif]);
}
/** Applique un changement d'état avec une transition d'écran (View Transitions, si disponible). */
export function transition(fn, sens = 'fondu') {
    const doc = document;
    if (!doc.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
        fn();
        return;
    }
    document.documentElement.dataset.sens = sens;
    doc.startViewTransition(() => flushSync(fn));
}
