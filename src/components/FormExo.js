import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { MUSCLES } from '../data/exercices';
import { db, uid } from '../db';
import { photoReduite } from '../lib/image';
import Interrupteur from './Interrupteur';
export const MODES = [
    ['machine', 'Machine / barre / poulie'],
    ['par_main', 'Haltère par main'],
    ['poids_corps', 'Poids du corps (+ lest)'],
    ['elastique', 'Élastique (niveau)'],
];
export default function FormExo({ initial, nomInitial = '', muscleInitial, onEnregistre, onAnnuler }) {
    const [nom, setNom] = useState(initial?.nom ?? nomInitial);
    const [muscle, setMuscle] = useState(initial?.muscle ?? muscleInitial ?? 'pecs');
    const [secondaires, setSecondaires] = useState(initial?.secondaires ?? []);
    const [mode, setMode] = useState(initial?.mode ?? 'machine');
    const [pas, setPas] = useState(String(initial?.pas ?? 2.5).replace('.', ','));
    const [compose, setCompose] = useState(initial ? initial.type === 'compose' : false);
    const [notes, setNotes] = useState(initial?.notes ?? '');
    const [image, setImage] = useState(initial?.image);
    const [chargement, setChargement] = useState(false);
    const basculerSecondaire = (m) => setSecondaires((x) => (x.some((s) => s.muscle === m) ? x.filter((s) => s.muscle !== m) : [...x, { muscle: m, coef: 0.5 }]));
    const choisirPhoto = async (f) => {
        if (!f)
            return;
        setChargement(true);
        try {
            setImage(await photoReduite(f));
        }
        catch {
            alert('Impossible de lire cette image.');
        }
        finally {
            setChargement(false);
        }
    };
    const enregistrer = async () => {
        const p = parseFloat(pas.replace(',', '.'));
        const exo = {
            ...initial,
            id: initial?.id ?? 'x_' + uid(),
            nom: nom.trim(),
            muscle,
            secondaires: secondaires.filter((s) => s.muscle !== muscle),
            type: compose ? 'compose' : 'isolation',
            mode,
            pas: p > 0 ? p : mode === 'elastique' ? 1 : 2.5,
            suivreE1rm: compose,
            notes: notes.trim() || undefined,
            image,
            perso: initial ? initial.perso : true,
        };
        if (!exo.secondaires?.length)
            delete exo.secondaires;
        await db.exercices.put(exo);
        // L'ancien réglage de pas (écran Progression) est remplacé par celui de la fiche.
        await db.reglages.delete(`pas:${exo.id}`);
        onEnregistre(exo);
    };
    return (_jsxs("div", { className: "pile", children: [_jsx("h2", { children: initial ? 'Modifier l’exercice' : 'Nouvel exercice' }), _jsxs("div", { className: "ligne", style: { alignItems: 'center', gap: 12 }, children: [image ? (_jsx("img", { src: image, alt: "", style: { width: 88, height: 88, objectFit: 'cover', borderRadius: 14 } })) : (_jsx("span", { className: "vignette vide", style: { width: 88, height: 88, borderRadius: 14, fontSize: 28 }, children: "\uD83D\uDCF7" })), _jsxs("div", { className: "pile", style: { flex: 1 }, children: [_jsxs("label", { className: "btn plein", children: [chargement ? 'Chargement…' : image ? 'Changer la photo' : 'Ajouter une photo', _jsx("input", { type: "file", accept: "image/*", hidden: true, onChange: (e) => choisirPhoto(e.target.files?.[0]) })] }), image && (_jsx("button", { type: "button", className: "btn discret petit plein", onClick: () => setImage(undefined), children: "Retirer la photo" }))] })] }), _jsxs("label", { className: "champ", children: [_jsx("span", { children: "Nom" }), _jsx("input", { value: nom, onChange: (e) => setNom(e.target.value), placeholder: "ex. Pec deck prise neutre" })] }), _jsxs("label", { className: "champ", children: [_jsx("span", { children: "Muscle principal" }), _jsx("select", { value: muscle, onChange: (e) => setMuscle(e.target.value), children: MUSCLES.map((m) => (_jsx("option", { value: m.id, children: m.nom }, m.id))) })] }), _jsxs("div", { className: "champ", children: [_jsx("span", { children: "Muscles secondaires (compt\u00E9s pour 0,5 s\u00E9rie dans le volume)" }), _jsx("div", { className: "chips", children: MUSCLES.filter((m) => m.id !== muscle).map((m) => (_jsx("button", { type: "button", className: secondaires.some((s) => s.muscle === m.id) ? 'actif' : '', onClick: () => basculerSecondaire(m.id), children: m.nom }, m.id))) })] }), _jsxs("label", { className: "champ", children: [_jsx("span", { children: "Mode de charge" }), _jsx("select", { value: mode, onChange: (e) => {
                            const m = e.target.value;
                            setMode(m);
                            setPas(m === 'elastique' ? '1' : m === 'par_main' ? '2' : '2,5');
                        }, children: MODES.map(([m, n]) => (_jsx("option", { value: m, children: n }, m))) })] }), _jsxs("label", { className: "champ", children: [_jsxs("span", { children: ["Pas de charge (", mode === 'elastique' ? 'niveau' : 'kg', ") \u2014 boutons \u2212/+ et mont\u00E9e de charge"] }), _jsx("input", { inputMode: "decimal", value: pas, onChange: (e) => setPas(e.target.value) })] }), _jsx(Interrupteur, { on: compose, onChange: setCompose, label: "Exercice compos\u00E9", aide: "Plusieurs articulations (d\u00E9velopp\u00E9, rowing, squat\u2026). Active le suivi de l\u2019e1RM." }), _jsxs("label", { className: "champ", children: [_jsx("span", { children: "R\u00E9glages machine / consignes" }), _jsx("textarea", { rows: 2, value: notes, onChange: (e) => setNotes(e.target.value), placeholder: "ex. si\u00E8ge cran 4, dossier 2" })] }), _jsx("button", { className: "btn primaire grand", disabled: !nom.trim() || chargement, onClick: enregistrer, children: initial ? 'ENREGISTRER' : 'CRÉER' }), _jsx("button", { type: "button", className: "btn discret plein", onClick: onAnnuler, children: "Annuler" })] }));
}
