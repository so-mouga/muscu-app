import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { chrono, lireDuree } from '../lib/calc';
/** Durée libre : boutons −/+ par 5 s, ou saisie directe (« 2:30 », « 90 », « 3 »). */
export default function ChoixDuree({ valeur, onChange, pas = 5, compact = false }) {
    const [texte, setTexte] = useState(null);
    const borne = (s) => Math.max(0, Math.min(15 * 60, s));
    return (_jsxs("span", { className: 'mini-stepper' + (compact ? ' compact' : ''), children: [_jsx("button", { type: "button", onClick: () => onChange(borne(valeur - pas)), "aria-label": `Moins ${pas} secondes`, children: "\u2212" }), _jsx("input", { className: "duree", inputMode: "text", value: texte ?? chrono(valeur), onFocus: (e) => (setTexte(chrono(valeur)), e.target.select()), onChange: (e) => setTexte(e.target.value), onBlur: () => {
                    const s = texte === null ? null : lireDuree(texte);
                    if (s !== null)
                        onChange(borne(s));
                    setTexte(null);
                } }), _jsx("button", { type: "button", onClick: () => onChange(borne(valeur + pas)), "aria-label": `Plus ${pas} secondes`, children: "+" })] }));
}
