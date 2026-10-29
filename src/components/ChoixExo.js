import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { MUSCLES } from '../data/exercices';
import { useRetour } from '../lib/nav';
import FormExo from './FormExo';
import Vignette from './Vignette';
export const nomMuscle = (m) => MUSCLES.find((x) => x.id === m)?.nom ?? m;
export const sansAccents = (t) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
/** Exercices visibles, filtrés par recherche, regroupés par muscle principal (ordre de MUSCLES). */
export function parMuscle(exercices, recherche) {
    const r = sansAccents(recherche.trim());
    const visibles = exercices
        .filter((e) => !e.supprime)
        .filter((e) => !r || sansAccents(e.nom + ' ' + nomMuscle(e.muscle)).includes(r))
        .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    return MUSCLES.map((m) => ({ muscle: m.id, nom: m.nom, exos: visibles.filter((e) => e.muscle === m.id) })).filter((g) => g.exos.length);
}
export default function ChoixExo({ catalogue, titre, muscle, exclure = [], onChoix, onFermer }) {
    const [recherche, setRecherche] = useState('');
    const [creation, setCreation] = useState(false);
    // Groupes fermés par défaut ; celui du même muscle (remplacement) ouvert.
    const [ouverts, setOuverts] = useState(() => new Set(muscle ? [muscle] : []));
    const basculer = (m) => setOuverts((o) => {
        const n = new Set(o);
        if (n.has(m))
            n.delete(m);
        else
            n.add(m);
        return n;
    });
    useRetour(true, () => (creation ? (setCreation(false), 'rester') : onFermer()));
    const groupes = parMuscle(Object.values(catalogue.exercices).filter((e) => !exclure.includes(e.id)), recherche);
    // Pendant une recherche, tout ce qui correspond est visible.
    const ouvert = (m) => !!recherche.trim() || ouverts.has(m);
    // Remplacement : le groupe du même muscle en tête.
    if (muscle)
        groupes.sort((a, b) => Number(b.muscle === muscle) - Number(a.muscle === muscle));
    return (_jsx("div", { className: "modal-fond", onClick: onFermer, children: _jsx("div", { className: "modal", onClick: (e) => e.stopPropagation(), children: creation ? (_jsx(FormExo, { nomInitial: recherche, muscleInitial: muscle, onEnregistre: (exo) => onChoix(exo.id, exo), onAnnuler: () => setCreation(false) })) : (_jsxs("div", { className: "pile", children: [_jsx("h2", { children: titre }), _jsx("input", { placeholder: "Rechercher (nom ou muscle)", value: recherche, onChange: (e) => setRecherche(e.target.value) }), _jsxs("button", { className: "btn primaire plein", onClick: () => setCreation(true), children: ["+ Cr\u00E9er un exercice", recherche ? ` « ${recherche} »` : ''] }), _jsxs("div", { children: [groupes.map((g) => (_jsxs("div", { children: [_jsxs("button", { className: "groupe-repli", onClick: () => basculer(g.muscle), "aria-expanded": ouvert(g.muscle), children: [_jsxs("span", { children: [g.nom, g.muscle === muscle ? ' · même muscle' : '', " ", _jsxs("span", { className: "nb", children: ["(", g.exos.length, ")"] })] }), _jsx("span", { className: "muted", children: ouvert(g.muscle) ? '▾' : '▸' })] }), ouvert(g.muscle) && g.exos.map((e) => (_jsxs("button", { className: "liste-btn", onClick: () => onChoix(e.id), children: [_jsxs("span", { className: "avec-vignette", children: [_jsx(Vignette, { exo: e, taille: 40 }), _jsxs("span", { children: [_jsx("strong", { children: e.nom }), _jsxs("div", { className: "faible", children: [e.type === 'compose' ? 'composé' : 'isolation', e.perso ? ' · perso' : ''] })] })] }), _jsx("span", { className: "muted", children: "+" })] }, e.id)))] }, g.muscle))), groupes.length === 0 && _jsx("div", { className: "muted", children: "Aucun exercice trouv\u00E9." })] }), _jsx("button", { className: "btn discret plein", onClick: onFermer, children: "Annuler" })] })) }) }));
}
