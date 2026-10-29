import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { nomMuscle } from '../components/ChoixExo';
import { MODES } from '../components/FormExo';
import { chargeTexte, dateCourte, duree, e1rm, kg, serieTexte, tempsParExo } from '../lib/calc';
/** Fiche d'un exercice : photo, réglages, progression et historique. */
export function Detail({ exo, seances, onRetour, onModifier, onSupprimer, }) {
    const avec = seances.filter((s) => s.series.some((x) => x.exoId === exo.id));
    const chrono = [...avec].reverse();
    // Point par séance : e1RM (composés) ou charge de travail max (isolation)
    const points = chrono.map((s) => {
        const series = s.series.filter((x) => x.exoId === exo.id);
        const valeur = exo.suivreE1rm
            ? Math.max(0, ...series.map((x) => e1rm(exo, x, s.poidsCorps) ?? 0))
            : Math.max(...series.map((x) => x.charge));
        return { date: s.date, valeur, series };
    }).filter((p) => !exo.suivreE1rm || p.valeur > 0);
    // Records
    const toutes = avec.flatMap((s) => s.series.filter((x) => x.exoId === exo.id).map((x) => ({ x, s })));
    const meilleurE1rm = exo.suivreE1rm ? Math.max(0, ...toutes.map(({ x, s }) => e1rm(exo, x, s.poidsCorps) ?? 0)) : 0;
    const repsParCharge = new Map();
    for (const { x } of toutes)
        repsParCharge.set(x.charge, Math.max(repsParCharge.get(x.charge) ?? 0, x.reps));
    const demiReps = chrono.flatMap((s) => s.series.filter((x) => x.exoId === exo.id && x.type === 'serie_longue').map((x) => ({ date: s.date, x })));
    return (_jsxs("div", { children: [_jsxs("div", { className: "entete", children: [_jsx("button", { className: "btn", onClick: onRetour, children: "\u2190" }), _jsx("h2", { style: { flex: 1 }, children: exo.nom }), _jsx("button", { className: "btn", onClick: onModifier, children: "Modifier" })] }), _jsxs("div", { className: "carte pile", children: [exo.image && _jsx("img", { src: exo.image, alt: exo.nom, className: "photo-grande" }), _jsx("table", { children: _jsxs("tbody", { children: [_jsxs("tr", { children: [_jsx("td", { children: "Muscle" }), _jsxs("td", { children: [nomMuscle(exo.muscle), exo.secondaires?.length ? ` (+ ${exo.secondaires.map((x) => nomMuscle(x.muscle).toLowerCase()).join(', ')})` : ''] })] }), _jsxs("tr", { children: [_jsx("td", { children: "Type" }), _jsx("td", { children: exo.type === 'compose' ? 'composé (suivi e1RM)' : 'isolation' })] }), _jsxs("tr", { children: [_jsx("td", { children: "Charge" }), _jsxs("td", { children: [MODES.find((m) => m[0] === exo.mode)?.[1], " \u00B7 pas ", kg(exo.pas), exo.mode === 'elastique' ? '' : ' kg'] })] })] }) }), exo.notes && _jsxs("div", { className: "petit muted", children: ["\uD83D\uDCDD ", exo.notes] })] }), _jsxs("div", { className: "carte", children: [_jsx("h3", { children: exo.suivreE1rm ? 'e1RM estimé (kg)' : 'Charge de travail max' }), points.length >= 2 ? (_jsx(Courbe, { points: points.map((p) => ({ date: p.date, valeur: p.valeur })), format: (v) => (exo.suivreE1rm ? `${kg(v)} kg` : chargeTexte(exo, v)) })) : (_jsxs("div", { className: "faible", style: { marginTop: 8 }, children: ["La courbe appara\u00EEt \u00E0 partir de 2 s\u00E9ances", exo.suivreE1rm && exo.mode === 'poids_corps' ? ' (et avec ton poids du jour noté)' : '', "."] }))] }), _jsxs("div", { className: "carte", children: [_jsx("h3", { style: { marginBottom: 6 }, children: "Records" }), _jsx("table", { children: _jsxs("tbody", { children: [meilleurE1rm > 0 && (_jsxs("tr", { children: [_jsx("td", { children: "Meilleur e1RM" }), _jsxs("td", { children: [kg(meilleurE1rm), " kg"] })] })), [...repsParCharge.entries()]
                                    .sort((a, b) => b[0] - a[0])
                                    .slice(0, 6)
                                    .map(([c, r]) => (_jsxs("tr", { children: [_jsxs("td", { children: ["Max reps \u00E0 ", chargeTexte(exo, c)] }), _jsx("td", { children: r })] }, c)))] }) })] }), demiReps.length > 0 && (_jsxs("div", { className: "carte", children: [_jsx("h3", { style: { marginBottom: 6 }, children: "Demi-reps de finisseur" }), _jsx("div", { className: "petit", children: demiReps.map(({ date, x }, i) => (_jsxs("span", { children: [i > 0 && ' → ', _jsx("strong", { children: x.demiReps }), " ", _jsxs("span", { className: "faible", children: ["(", chargeTexte(exo, x.charge), ", ", dateCourte(date), ")"] })] }, i))) })] })), _jsxs("div", { className: "carte", children: [_jsx("h3", { style: { marginBottom: 6 }, children: "S\u00E9ances" }), avec.map((s) => (_jsxs("div", { style: { marginBottom: 10 }, children: [_jsxs("div", { className: "faible", children: [dateCourte(s.date), " \u00B7 ", s.nom, tempsParExo(s)[exo.id] > 0 && ` · ⏱ ${duree(tempsParExo(s)[exo.id])}`] }), _jsx("div", { className: "petit", children: s.series
                                    .filter((x) => x.exoId === exo.id)
                                    .map((x) => serieTexte(exo, x))
                                    .join(' · ') }), s.notes[exo.id] && _jsxs("div", { className: "faible", children: ["\uD83D\uDCDD ", s.notes[exo.id]] })] }, s.id)))] }), _jsx("button", { className: "btn discret danger plein", style: { marginBottom: 24 }, onClick: onSupprimer, children: "Supprimer l\u2019exercice" })] }));
}
/** Courbe à une seule série : ligne 2 px, points 8 px, valeur au toucher. */
function Courbe({ points, format }) {
    const [actif, setActif] = useState(points.length - 1);
    const L = 320;
    const H = 140;
    const m = { g: 8, d: 8, h: 12, b: 22 };
    const vals = points.map((p) => p.valeur);
    let min = Math.min(...vals);
    let max = Math.max(...vals);
    if (max - min < 1)
        (min -= 1), (max += 1);
    const x = (i) => m.g + (i / (points.length - 1)) * (L - m.g - m.d);
    const y = (v) => m.h + (1 - (v - min) / (max - min)) * (H - m.h - m.b);
    const p = points[actif];
    return (_jsxs("div", { style: { marginTop: 8 }, children: [_jsxs("div", { className: "ligne entre petit", style: { marginBottom: 4 }, children: [_jsx("strong", { children: format(p.valeur) }), _jsx("span", { className: "faible", children: dateCourte(p.date) })] }), _jsxs("svg", { className: "graph", viewBox: `0 0 ${L} ${H}`, width: "100%", role: "img", "aria-label": "\u00C9volution par s\u00E9ance", children: [[min, (min + max) / 2, max].map((v) => (_jsx("line", { x1: m.g, x2: L - m.d, y1: y(v), y2: y(v), stroke: "var(--bord)", strokeWidth: "1" }, v))), _jsx("polyline", { fill: "none", stroke: "var(--accent)", strokeWidth: "2", strokeLinejoin: "round", points: points.map((q, i) => `${x(i)},${y(q.valeur)}`).join(' ') }), _jsx("line", { x1: x(actif), x2: x(actif), y1: m.h, y2: H - m.b, stroke: "var(--texte-3)", strokeWidth: "1", strokeDasharray: "3 3" }), points.map((q, i) => (_jsxs("g", { onClick: () => setActif(i), style: { cursor: 'pointer' }, children: [_jsx("rect", { x: x(i) - 14, y: 0, width: 28, height: H, fill: "transparent" }), _jsx("circle", { cx: x(i), cy: y(q.valeur), r: i === actif ? 5 : 4, fill: "var(--accent)", stroke: "var(--surface)", strokeWidth: "2" })] }, i))), _jsx("text", { x: m.g, y: H - 6, children: dateCourte(points[0].date) }), _jsx("text", { x: L - m.d, y: H - 6, textAnchor: "end", children: dateCourte(points[points.length - 1].date) })] })] }));
}
