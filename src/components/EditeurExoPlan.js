import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { kg, lireChauffe } from '../lib/calc';
import { FINISSEURS, typeFinisseur, ZONES } from '../lib/finisseur';
import { useRetour } from '../lib/nav';
import ChoixDuree from './ChoixDuree';
import Interrupteur from './Interrupteur';
const RPES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
const PALIERS = [
    [0.5, 8],
    [0.7, 4],
    [0.85, 2],
    [0.9, 1],
];
/** Chauffe auto : ~50 % × 8, ~70 % × 4, ~85 % × 2, arrondie au pas. */
export function chauffeAuto(charge, pas, n = 3) {
    const arr = (x) => Math.round(x / pas) * pas;
    return PALIERS.slice(0, n).map(([pct, reps]) => `${kg(arr(charge * pct))}×${reps}`);
}
const versLigne = (c) => {
    const l = lireChauffe(c);
    return l ? { charge: kg(l.charge), reps: l.reps } : { texte: c };
};
const depuisLigne = (l) => ('texte' in l ? l.texte.trim() : l.charge.trim() ? `${l.charge.trim()}×${l.reps}` : '');
function MiniStepper({ valeur, min = 0, max = 99, onChange }) {
    return (_jsxs("span", { className: "mini-stepper", children: [_jsx("button", { type: "button", onClick: () => onChange(Math.max(min, valeur - 1)), children: "\u2212" }), _jsx("strong", { children: valeur }), _jsx("button", { type: "button", onClick: () => onChange(Math.min(max, valeur + 1)), children: "+" })] }));
}
const lireCharge = (t) => {
    const v = parseFloat(t.replace(',', '.'));
    return t.trim() === '' || isNaN(v) ? undefined : v;
};
export default function EditeurExoPlan({ exo, plan, onValider, onFermer }) {
    useRetour(true, onFermer);
    const [p, setP] = useState(() => structuredClone(plan));
    const [chargeTxt, setChargeTxt] = useState(p.charge === null ? '' : kg(p.charge));
    const [chargesSerie, setChargesSerie] = useState(() => plan.series.map((s) => (s.charge === undefined ? '' : kg(s.charge))));
    const [chauffes, setChauffes] = useState(() => plan.chauffes.map(versLigne));
    const [aideFin, setAideFin] = useState(false);
    const [detail, setDetail] = useState(() => plan.series.some((s) => s.charge !== undefined || s.repos !== undefined));
    const n = p.series.length;
    const repsMin = p.series[0].repsMin;
    const repsMax = p.series[0].repsMax;
    const maj = (f) => setP((q) => {
        const c = structuredClone(q);
        f(c);
        return c;
    });
    const setNombre = (k) => {
        maj((q) => {
            while (q.series.length < k)
                q.series.push({ ...q.series[q.series.length - 1] });
            q.series.length = k;
            if (q.finisseur)
                q.series[k - 1].rpe = 10;
        });
        setChargesSerie((c) => {
            const x = [...c];
            while (x.length < k)
                x.push(x[x.length - 1] ?? '');
            return x.slice(0, k);
        });
    };
    const setReps = (min, max) => maj((q) => q.series.forEach((s) => ((s.repsMin = min), (s.repsMax = Math.max(min, max)))));
    const valider = () => {
        const chargeGenerale = lireCharge(chargeTxt);
        onValider({
            ...p,
            charge: chargeGenerale ?? null,
            series: p.series.map((s, i) => {
                const { charge: _c, repos: _r, ...base } = s;
                if (!detail)
                    return base;
                const charge = lireCharge(chargesSerie[i] ?? '');
                return {
                    ...base,
                    ...(charge !== undefined && charge !== chargeGenerale ? { charge } : {}),
                    ...(s.repos !== undefined && s.repos !== p.repos ? { repos: s.repos } : {}),
                };
            }),
            chauffes: chauffes.map(depuisLigne).filter(Boolean),
            note: p.note?.trim() || undefined,
        });
    };
    const unite = exo.mode === 'poids_corps' ? 'lest kg' : exo.mode === 'elastique' ? 'niveau' : exo.mode === 'par_main' ? 'kg/main' : 'kg';
    const libelleCharge = exo.mode === 'poids_corps' ? 'Lest de départ (kg, 0 = poids du corps)' : exo.mode === 'elastique' ? 'Niveau d’élastique' : exo.mode === 'par_main' ? 'Charge par main (kg)' : 'Charge de départ (kg)';
    return (_jsx("div", { className: "modal-fond", onClick: onFermer, children: _jsxs("div", { className: "modal pile", onClick: (e) => e.stopPropagation(), children: [_jsx("h2", { children: exo.nom }), _jsxs("div", { className: "ligne entre", children: [_jsx("span", { children: "S\u00E9ries" }), _jsx(MiniStepper, { valeur: n, min: 1, max: 10, onChange: setNombre })] }), _jsxs("div", { className: "ligne entre", children: [_jsx("span", { children: "Reps min" }), _jsx(MiniStepper, { valeur: repsMin, min: 1, onChange: (v) => setReps(v, Math.max(v, repsMax)) })] }), _jsxs("div", { className: "ligne entre", children: [_jsx("span", { children: "Reps max" }), _jsx(MiniStepper, { valeur: repsMax, min: repsMin, onChange: (v) => setReps(repsMin, v) })] }), _jsxs("div", { className: "ligne entre", children: [_jsx("span", { children: "Repos entre les s\u00E9ries" }), _jsx(ChoixDuree, { valeur: p.repos, onChange: (v) => maj((q) => (q.repos = v)) })] }), _jsxs("label", { className: "champ", children: [_jsx("span", { children: libelleCharge }), _jsx("input", { inputMode: "decimal", value: chargeTxt, placeholder: "je ne sais pas encore", onChange: (e) => setChargeTxt(e.target.value) }), _jsx("span", { className: "faible", children: "Sert seulement la toute premi\u00E8re fois. Ensuite, l\u2019appli repart de ce que tu as fait la derni\u00E8re fois. Pas d\u2019id\u00E9e ? Laisse vide : tu trouveras la bonne charge pendant la s\u00E9ance, d\u00E8s la 1re s\u00E9rie." })] }), _jsxs("div", { children: [_jsx(Interrupteur, { on: detail, onChange: setDetail, label: "R\u00E9gler s\u00E9rie par s\u00E9rie", aide: "Charge et repos diff\u00E9rents selon la s\u00E9rie (ex. 1re s\u00E9rie plus l\u00E9g\u00E8re)." }), _jsx("div", { className: "faible", style: { margin: '6px 0' }, children: detail ? `Série · RPE · charge (${unite}) · repos après` : 'RPE visé par série' }), p.series.map((s, i) => (_jsxs("div", { className: "ligne", style: { marginBottom: 6, gap: 6 }, children: [_jsxs("span", { className: "faible", style: { width: 22, flex: '0 0 auto' }, children: ["S", i + 1] }), _jsx("select", { value: s.rpe, style: detail ? { width: 74, padding: '8px 4px', flex: '0 0 auto' } : undefined, disabled: p.finisseur && i === n - 1, onChange: (e) => maj((q) => (q.series[i].rpe = parseFloat(e.target.value))), children: RPES.map((r) => (_jsx("option", { value: r, children: detail ? kg(r) : `RPE ${kg(r)}${r === 10 ? ' (échec)' : ''}` }, r))) }), detail && (_jsxs(_Fragment, { children: [_jsx("input", { inputMode: "decimal", style: { width: 62, padding: '8px 4px', textAlign: 'center', flex: '0 0 auto' }, placeholder: chargeTxt || '—', value: chargesSerie[i] ?? '', onChange: (e) => setChargesSerie((c) => c.map((x, k) => (k === i ? e.target.value : x))) }), _jsx(ChoixDuree, { compact: true, valeur: s.repos ?? p.repos, onChange: (v) => maj((q) => (q.series[i].repos = v)) })] }))] }, i)))] }), _jsxs("div", { children: [_jsx(Interrupteur, { on: p.reposApres !== undefined, onChange: (v) => maj((q) => (q.reposApres = v ? q.repos : undefined)), label: "Repos sp\u00E9cifique avant l\u2019exercice suivant", aide: "Lanc\u00E9 apr\u00E8s la derni\u00E8re s\u00E9rie (changer de machine, souffler)." }), p.reposApres !== undefined && (_jsxs("div", { className: "ligne entre", style: { marginTop: 6 }, children: [_jsx("span", { className: "petit", children: "Repos apr\u00E8s l\u2019exercice" }), _jsx(ChoixDuree, { valeur: p.reposApres, onChange: (v) => maj((q) => (q.reposApres = v)) })] }))] }), _jsxs("div", { children: [_jsxs("div", { className: "ligne entre", children: [_jsx("span", { children: "S\u00E9ries d\u2019\u00E9chauffement" }), _jsx(MiniStepper, { valeur: chauffes.length, max: 4, onChange: (k) => setChauffes((c) => {
                                        const base = lireCharge(chargeTxt);
                                        if (k < c.length)
                                            return c.slice(0, k);
                                        // Nouvelle ligne : palier suivant de la chauffe auto si la charge est connue.
                                        const auto = base ? chauffeAuto(base, exo.pas, k).map(versLigne) : [];
                                        return [...c, ...Array.from({ length: k - c.length }, (_, j) => auto[c.length + j] ?? { charge: '', reps: 8 })];
                                    }) })] }), _jsx("div", { className: "faible", style: { margin: '4px 0 6px' }, children: "S\u00E9ries l\u00E9g\u00E8res avant les vraies, coch\u00E9es pendant la s\u00E9ance. Elles ne comptent ni dans le volume ni dans la progression." }), chauffes.map((l, i) => (_jsxs("div", { className: "ligne", style: { marginBottom: 6, gap: 6 }, children: [_jsxs("span", { className: "faible", style: { width: 22, flex: '0 0 auto' }, children: ["\u00C9", i + 1] }), 'texte' in l ? (_jsx("input", { value: l.texte, onChange: (e) => setChauffes((c) => c.map((x, k) => (k === i ? { texte: e.target.value } : x))) })) : (_jsxs(_Fragment, { children: [_jsx("input", { inputMode: "decimal", style: { width: 70, padding: '8px 4px', textAlign: 'center', flex: '0 0 auto' }, placeholder: unite, value: l.charge, onChange: (e) => setChauffes((c) => c.map((x, k) => (k === i ? { ...l, charge: e.target.value } : x))) }), _jsxs("span", { className: "faible", children: [unite, " \u00D7"] }), _jsx(MiniStepper, { valeur: l.reps, min: 1, onChange: (v) => setChauffes((c) => c.map((x, k) => (k === i ? { ...l, reps: v } : x))) })] }))] }, i))), chauffes.length > 0 && lireCharge(chargeTxt) > 0 && (_jsx("button", { type: "button", className: "btn discret petit", onClick: () => setChauffes(chauffeAuto(lireCharge(chargeTxt), exo.pas, chauffes.length).map(versLigne)), children: "Calculer depuis la charge de d\u00E9part (50 %, 70 %, 85 %)" }))] }), _jsx(Interrupteur, { on: p.finisseur, onChange: (v) => maj((q) => {
                        q.finisseur = v;
                        if (v)
                            q.series[q.series.length - 1].rpe = 10;
                    }), label: "\u2605 Finisseur sur la derni\u00E8re s\u00E9rie", aide: "Une technique d\u2019intensit\u00E9 sur la derni\u00E8re s\u00E9rie. Plut\u00F4t sur de l\u2019isolation, un ou deux par s\u00E9ance." }), p.finisseur && (_jsxs("div", { className: "pile", style: { gap: 8 }, children: [_jsx("div", { className: "chips", children: Object.keys(FINISSEURS).map((t) => (_jsx("button", { className: typeFinisseur(p) === t ? 'actif' : '', onClick: () => maj((q) => (q.typeFinisseur = t)), children: FINISSEURS[t].nom }, t))) }), _jsx("div", { className: "suggestion petit", children: FINISSEURS[typeFinisseur(p)].aide }), typeFinisseur(p) === 'partielles' && (_jsxs("div", { className: "ligne entre wrap", children: [_jsx("span", { className: "petit", children: "Zone des demi-reps" }), _jsx("div", { className: "chips", children: ZONES.map(([z, nom]) => (_jsx("button", { className: (p.zone ?? 'etiree') === z ? 'actif' : '', onClick: () => maj((q) => (q.zone = z)), children: nom }, z))) })] })), _jsxs("button", { type: "button", className: "btn discret petit", onClick: () => setAideFin(!aideFin), children: [aideFin ? '▾' : '▸', " C\u2019est quoi, chaque technique ?"] }), aideFin && (_jsx("div", { className: "pile petit", style: { gap: 6 }, children: Object.values(FINISSEURS).map((f) => (_jsxs("div", { children: [_jsx("strong", { children: f.nom }), " ", _jsxs("span", { className: "muted", children: ["\u2014 ", f.aide] })] }, f.nom))) }))] })), _jsx(Interrupteur, { on: !!p.optionnel, onChange: (v) => maj((q) => (q.optionnel = v || undefined)), label: "Optionnel" }), _jsxs("label", { className: "champ", children: [_jsx("span", { children: "Note (consigne pour cette s\u00E9ance)" }), _jsx("input", { value: p.note ?? '', onChange: (e) => maj((q) => (q.note = e.target.value)) })] }), _jsx("button", { className: "btn primaire grand", onClick: valider, children: "OK" }), _jsx("button", { className: "btn discret plein", onClick: onFermer, children: "Annuler" })] }) }));
}
