import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { kg } from '../lib/calc';
import { useRetour } from '../lib/nav';
import { usePasBoutons } from '../lib/pasBoutons';
const arr = (x) => Math.round(x * 100) / 100;
/** Ajuster à la main la charge et les reps de chaque série pour la prochaine séance. */
export default function EditeurObjectif({ exo, auto, actuel, onValider, onAuto, onFermer }) {
    useRetour(true, onFermer);
    const [charges, setCharges] = useState(actuel?.charges ?? auto.charges);
    const [reps, setReps] = useState(actuel?.reps ?? auto.reps);
    const [textes, setTextes] = useState(() => charges.map(() => null));
    const pas = usePasBoutons()(exo);
    const unite = exo.mode === 'elastique' ? 'niv.' : exo.mode === 'poids_corps' ? 'lest' : 'kg';
    const decaler = (dc, dr) => {
        if (dc)
            setCharges((c) => c.map((x) => arr(Math.max(0, (x ?? 0) + dc))));
        if (dr)
            setReps((r) => r.map((x) => Math.max(1, x + dr)));
        setTextes((t) => t.map(() => null));
    };
    return (_jsx("div", { className: "modal-fond", onClick: onFermer, children: _jsxs("div", { className: "modal pile", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { children: [_jsx("h2", { children: exo.nom }), _jsx("div", { className: "faible", children: "Objectif pour la prochaine s\u00E9ance" })] }), _jsxs("div", { className: "suggestion petit", children: [_jsx("div", { className: "faible", children: "Proposition automatique" }), _jsx("div", { children: auto.message })] }), _jsxs("div", { className: "ligne entre wrap", style: { gap: 6 }, children: [_jsx("span", { className: "petit", children: "Toutes les s\u00E9ries" }), _jsxs("span", { className: "ligne", style: { gap: 6 }, children: [_jsxs("button", { className: "btn petit", onClick: () => decaler(-pas, 0), children: ["\u2212", kg(pas), " ", unite] }), _jsxs("button", { className: "btn petit", onClick: () => decaler(pas, 0), children: ["+", kg(pas), " ", unite] }), _jsx("button", { className: "btn petit", onClick: () => decaler(0, -1), children: "\u22121 rep" }), _jsx("button", { className: "btn petit", onClick: () => decaler(0, 1), children: "+1 rep" })] })] }), _jsxs("div", { children: [_jsxs("div", { className: "faible", style: { marginBottom: 6 }, children: ["S\u00E9rie \u00B7 charge (", unite, ") \u00B7 reps"] }), charges.map((c, i) => (_jsxs("div", { className: "ligne", style: { marginBottom: 6, gap: 6 }, children: [_jsxs("span", { className: "faible", style: { width: 24 }, children: ["S", i + 1] }), _jsxs("span", { className: "mini-stepper compact", children: [_jsx("button", { type: "button", onClick: () => (setCharges((x) => x.map((v, k) => (k === i ? arr(Math.max(0, (v ?? 0) - pas)) : v))), setTextes((t) => t.map((v, k) => (k === i ? null : v)))), children: "\u2212" }), _jsx("input", { className: "duree", inputMode: "decimal", placeholder: "\u2014", value: textes[i] ?? (c === null ? '' : kg(c)), onFocus: (e) => e.target.select(), onChange: (e) => {
                                                const t = e.target.value;
                                                setTextes((x) => x.map((v, k) => (k === i ? t : v)));
                                                const v = parseFloat(t.replace(',', '.'));
                                                setCharges((x) => x.map((w, k) => (k === i ? (t.trim() === '' ? null : isNaN(v) ? w : v) : w)));
                                            } }), _jsx("button", { type: "button", onClick: () => (setCharges((x) => x.map((v, k) => (k === i ? arr((v ?? 0) + pas) : v))), setTextes((t) => t.map((v, k) => (k === i ? null : v)))), children: "+" })] }), _jsxs("span", { className: "mini-stepper compact", children: [_jsx("button", { type: "button", onClick: () => setReps((x) => x.map((v, k) => (k === i ? Math.max(1, v - 1) : v))), children: "\u2212" }), _jsx("strong", { children: reps[i] }), _jsx("button", { type: "button", onClick: () => setReps((x) => x.map((v, k) => (k === i ? v + 1 : v))), children: "+" })] })] }, i)))] }), _jsx("button", { className: "btn primaire grand", onClick: () => onValider({ charges, reps }), children: "FIXER CET OBJECTIF" }), actuel && (_jsx("button", { className: "btn plein", onClick: onAuto, children: "Revenir \u00E0 la proposition automatique" })), _jsx("button", { className: "btn discret plein", onClick: onFermer, children: "Annuler" })] }) }));
}
