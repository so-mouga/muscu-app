import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { db } from '../db';
import { alarme, tic } from '../lib/appareil';
import { chrono } from '../lib/calc';
import Anneau from './Anneau';
/** Secondes restantes d'un repos (en pause : le temps figé). */
export const resteRepos = (e, maintenant) => (e.pause ?? e.fin - maintenant) / 1000;
export const BIPS_DEFAUT = 5;
export default function Minuteur({ etat, onChange, ensuite, onAller, variante = 'barre', onAgrandir }) {
    const [maintenant, setMaintenant] = useState(Date.now());
    const sonne = useRef(null);
    const dernierTic = useRef(null);
    const reglage = useLiveQuery(() => db.reglages.get('bipsRepos'), []);
    const bips = typeof reglage?.valeur === 'number' ? reglage.valeur : BIPS_DEFAUT;
    useEffect(() => {
        const t = setInterval(() => setMaintenant(Date.now()), 250);
        return () => clearInterval(t);
    }, []);
    const enPause = etat.pause !== undefined;
    const reste = resteRepos(etat, maintenant);
    const fini = reste <= 0;
    useEffect(() => {
        // Sonne une seule fois par repos, y compris au retour au premier plan.
        if (fini && sonne.current !== etat.fin) {
            sonne.current = etat.fin;
            if (maintenant - etat.fin < 60000)
                alarme();
        }
    }, [fini, etat.fin, maintenant]);
    // Décompte sonore des dernières secondes, une fois par seconde.
    const seconde = Math.ceil(reste);
    useEffect(() => {
        if (enPause || fini || seconde > bips || dernierTic.current === seconde)
            return;
        dernierTic.current = seconde;
        tic(seconde === 1);
    }, [seconde, bips, enPause, fini]);
    const decaler = (ms) => onChange(enPause ? { ...etat, pause: Math.max(0, etat.pause + ms) } : { ...etat, fin: etat.fin + ms });
    const basculerPause = () => onChange(enPause ? { ...etat, fin: Date.now() + etat.pause, pause: undefined } : { ...etat, pause: Math.max(0, etat.fin - Date.now()) });
    const libelle = fini ? 'Repos terminé — à toi' : enPause ? 'En pause' : `Repos ${chrono(etat.duree)}`;
    const temps = fini ? chrono(reste) : chrono(seconde);
    const boutons = (_jsxs(_Fragment, { children: [!fini && (_jsxs(_Fragment, { children: [_jsx("button", { className: "btn", onClick: basculerPause, "aria-label": enPause ? 'Reprendre le repos' : 'Mettre en pause', children: enPause ? '▶' : '⏸' }), _jsx("button", { className: "btn", onClick: () => decaler(-15000), children: "\u221215" }), _jsx("button", { className: "btn", onClick: () => decaler(15000), children: "+15" })] })), _jsx("button", { className: "btn texte", onClick: () => onChange(null), children: fini ? 'OK' : 'Passer' })] }));
    if (variante === 'grand') {
        // Part du repos écoulée ; la fin bouge avec −15/+15, le début non.
        const total = etat.debut ? (etat.pause !== undefined ? maintenant - etat.debut + etat.pause : etat.fin - etat.debut) / 1000 : etat.duree;
        return (_jsxs("div", { className: 'minuteur grand' + (fini ? ' fini' : '') + (enPause ? ' en-pause' : ''), children: [_jsxs(Anneau, { valeur: fini ? 1 : 1 - reste / Math.max(1, total), taille: 210, epaisseur: 10, children: [_jsx("div", { className: "temps-grand", children: temps }), _jsx("div", { className: "libelle", children: libelle })] }), _jsx("div", { className: "ligne boutons-grand", children: boutons })] }));
    }
    const bandeau = variante === 'bandeau';
    return (_jsxs("div", { className: 'minuteur' + (bandeau ? ' bandeau' : '') + (fini ? ' fini flash' : '') + (enPause ? ' en-pause' : ''), children: [_jsxs("div", { className: "contenu", children: [_jsxs("button", { className: "temps", onClick: onAgrandir, disabled: !onAgrandir, "aria-label": onAgrandir ? 'Plein écran' : undefined, children: [temps, " ", onAgrandir && _jsx("span", { className: "agrandir", children: "\u2922" }), _jsx("div", { className: "faible", style: { color: 'inherit', opacity: 0.7, fontSize: 12, fontWeight: 600 }, children: libelle })] }), boutons] }), ensuite && !bandeau && (_jsxs("button", { className: 'ensuite' + (onAller ? ' cliquable' : '') + (fini && onAller ? ' reprendre' : ''), onClick: onAller, disabled: !onAller, children: [_jsxs("span", { children: [_jsx("span", { className: "label", children: fini ? 'À toi' : 'Ensuite' }), " ", ensuite] }), onAller && _jsx("span", { className: "aller", children: fini ? 'Reprendre ›' : 'Y aller ›' })] }))] }));
}
