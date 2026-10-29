import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { ID_PROGRAMME_DEFAUT } from '../catalogue';
import ChoixExo from '../components/ChoixExo';
import EditeurExoPlan from '../components/EditeurExoPlan';
import { MODELES } from '../data/programme';
import { db, setReglage, uid } from '../db';
import { chargeTexte, dureeEstimee, dureeTexte, kg, minutes, reposTexte } from '../lib/calc';
import { transition, useRetour } from '../lib/nav';
export const JOURS = ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
/** Plan par défaut d'un exercice ajouté (modifiable juste après). */
export function planParDefaut(exo) {
    const petit = exo.muscle === 'mollets' || exo.muscle === 'abdos';
    const compose = exo.type === 'compose';
    const [min, max] = compose ? [8, 12] : [12, 15];
    return {
        exoId: exo.id,
        repos: petit ? 90 : compose ? 180 : 150,
        series: [0, 1, 2].map(() => ({ repsMin: min, repsMax: max, rpe: compose ? 8 : 9 })),
        chauffes: [],
        finisseur: false,
        charge: null,
    };
}
export function resumePlan(exo, p) {
    const s = p.series[0];
    const reps = s.repsMin === s.repsMax ? s.repsMin : `${s.repsMin}–${s.repsMax}`;
    return [
        `${p.series.length} × ${reps}`,
        `RPE ${p.series.map((x) => kg(x.rpe)).join(', ')}`,
        reposTexte(p),
        chargeTexte(exo, p.charge),
        p.finisseur ? '★' : '',
    ]
        .filter(Boolean)
        .join(' · ');
}
export const jourCourt = (j) => (j ? JOURS[j].slice(0, 3) : '');
/** Enregistre un programme ; le programme de départ (virtuel) est conservé dès qu'on en crée un autre. */
async function sauverProgramme(p, catalogue) {
    if ((await db.programmes.count()) === 0 && p.id !== ID_PROGRAMME_DEFAUT)
        await db.programmes.put(catalogue.programmes[0]);
    await db.programmes.put(p);
}
export default function Seances({ catalogue }) {
    const [pile, setPile] = useState([]);
    const masquees = useLiveQuery(() => db.modeles.filter((m) => !!m.supprime).toArray(), [], []);
    const terminees = useLiveQuery(() => db.seances.filter((s) => !s.enCours).toArray(), []);
    const vue = pile[pile.length - 1];
    const ouvrir = (v) => (transition(() => setPile((x) => [...x, v]), 'avant'), window.scrollTo({ top: 0 }));
    const fermer = (f) => (transition(() => setPile((x) => (f ? f(x.slice(0, -1)) : x.slice(0, -1))), 'arriere'), window.scrollTo({ top: 0 }));
    const ouvrirProgramme = (p, nouveau = false) => ouvrir({ type: 'programme', p: structuredClone(p), initial: structuredClone(p), nouveau });
    const ouvrirSeance = (m, nouvelle = false, pourProgramme = false) => ouvrir({ type: 'seance', m: structuredClone(m), nouvelle, pourProgramme });
    const nouvelleSeance = (pourProgramme = false) => ouvrirSeance({ id: 'm_' + uid(), nom: '', sousTitre: '', exercices: [] }, true, pourProgramme);
    if (vue?.type === 'seance')
        return (_jsx(Editeur, { catalogue: catalogue, initial: vue.m, nouvelle: vue.nouvelle, 
            // Ouverte depuis un programme : c'est lui qui gère son contenu.
            pourProgramme: pile[pile.length - 2]?.type === 'programme', onFermer: (enregistree) => fermer((reste) => {
                // Séance créée depuis un programme : on l'ajoute au brouillon du programme.
                const dessous = reste[reste.length - 1];
                if (enregistree && vue.pourProgramme && dessous?.type === 'programme')
                    return [...reste.slice(0, -1), { ...dessous, p: { ...dessous.p, seances: [...dessous.p.seances, { modeleId: enregistree.id }] } }];
                return reste;
            }) }, vue.m.id));
    if (vue?.type === 'programme')
        return (_jsx(EditeurProgramme, { catalogue: catalogue, vue: vue, terminees: terminees, setP: (p) => setPile((x) => x.map((v) => (v === vue ? { ...vue, p } : v))), onOuvrirSeance: (m) => ouvrirSeance(m), onNouvelleSeance: () => nouvelleSeance(true), onFermer: () => fermer() }, vue.initial.id));
    const utilisations = (m) => catalogue.programmes.filter((p) => p.seances.some((e) => e.modeleId === m.id)).map((p) => p.nom);
    return (_jsxs("div", { children: [_jsx("div", { className: "entete", children: _jsx("h1", { children: "Programmes" }) }), catalogue.programmes.map((p) => {
                const seances = p.seances.filter((e) => catalogue.modele(e.modeleId));
                const jours = seances.filter((e) => e.jour).sort((a, b) => a.jour - b.jour);
                return (_jsxs("button", { className: "liste-btn", style: p.id === catalogue.actif.id ? { borderColor: 'var(--accent)' } : undefined, onClick: () => ouvrirProgramme(p), children: [_jsxs("span", { children: [_jsx("strong", { children: p.nom }), " ", p.id === catalogue.actif.id && _jsx("span", { className: "pastille accent", children: "actif" }), _jsxs("div", { className: "faible", children: [seances.length, " s\u00E9ance", seances.length > 1 ? 's' : '', jours.length > 0 && ' · ' + jours.map((e) => jourCourt(e.jour)).join(', ')] })] }), _jsx("span", { className: "muted", children: "\u203A" })] }, p.id));
            }), _jsx("button", { className: "btn plein", style: { marginBottom: 24 }, onClick: () => ouvrirProgramme({ id: 'p_' + uid(), nom: '', seances: [] }, true), children: "+ Nouveau programme" }), _jsx("div", { className: "ligne entre", style: { marginBottom: 10 }, children: _jsx("h2", { children: "Biblioth\u00E8que de s\u00E9ances" }) }), _jsx("button", { className: "btn primaire plein", style: { marginBottom: 12 }, onClick: () => nouvelleSeance(), children: "+ Nouvelle s\u00E9ance" }), [...catalogue.modeles]
                .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
                .map((m) => {
                const progs = utilisations(m);
                return (_jsxs("button", { className: "liste-btn", onClick: () => ouvrirSeance(m), children: [_jsxs("span", { children: [_jsx("strong", { children: m.nom }), " ", m.sousTitre && _jsxs("span", { className: "muted", children: ["\u2014 ", m.sousTitre] }), _jsxs("div", { className: "faible", children: [m.exercices.length, " exercice", m.exercices.length > 1 ? 's' : '', " \u00B7 ", dureeTexte(m, terminees), m.varianteDe ? ` · variante de ${catalogue.modele(m.varianteDe)?.nom ?? '?'}` : '', progs.length ? ` · ${progs.join(', ')}` : ' · dans aucun programme'] })] }), _jsx("span", { className: "muted", children: "\u203A" })] }, m.id));
            }), masquees.length > 0 && (_jsxs("div", { className: "carte pile", style: { marginTop: 16 }, children: [_jsx("div", { className: "faible", children: "S\u00E9ances pr\u00E9charg\u00E9es supprim\u00E9es" }), masquees.map((m) => (_jsxs("div", { className: "ligne entre", children: [_jsx("span", { children: m.nom }), _jsx("button", { className: "btn petit", onClick: () => db.modeles.delete(m.id), children: "Restaurer" })] }, m.id)))] }))] }));
}
function EditeurProgramme({ catalogue, terminees, vue, setP, onOuvrirSeance, onNouvelleSeance, onFermer, }) {
    const { p, initial, nouveau } = vue;
    const [choix, setChoix] = useState(false);
    const modifie = JSON.stringify(p) !== JSON.stringify(initial);
    const actif = catalogue.actif.id === p.id;
    const enBase = catalogue.programmes.some((x) => x.id === p.id);
    useRetour(choix, () => setChoix(false));
    useRetour(true, () => {
        if (modifie && !confirm('Quitter sans enregistrer ?'))
            return 'rester';
        onFermer();
    });
    const maj = (f) => {
        const c = structuredClone(p);
        f(c);
        setP(c);
    };
    const entrees = p.seances.map((e, i) => ({ e, i, m: catalogue.modele(e.modeleId) })).filter((x) => x.m);
    const valide = p.nom.trim() !== '' && entrees.length > 0;
    const enregistrer = async (activer = false) => {
        const finale = { ...p, nom: p.nom.trim(), description: p.description?.trim() || undefined, seances: p.seances.filter((e) => catalogue.modele(e.modeleId)) };
        await sauverProgramme(finale, catalogue);
        if (activer)
            await setReglage('programmeActif', finale.id);
        onFermer();
    };
    const dupliquer = async () => {
        await sauverProgramme({ ...structuredClone(p), id: 'p_' + uid(), nom: `${p.nom.trim()} (copie)` }, catalogue);
        onFermer();
    };
    const supprimer = async () => {
        if (catalogue.programmes.length <= 1)
            return alert('Il faut garder au moins un programme.');
        if (!confirm(`Supprimer le programme « ${p.nom} » ? Ses séances restent dans la bibliothèque.`))
            return;
        if ((await db.programmes.count()) === 0)
            await db.programmes.bulkPut(catalogue.programmes);
        await db.programmes.delete(p.id);
        if (actif)
            await setReglage('programmeActif', catalogue.programmes.find((x) => x.id !== p.id).id);
        onFermer();
    };
    return (_jsxs("div", { children: [_jsxs("div", { className: "entete", children: [_jsx("button", { className: "btn", onClick: () => (!modifie || confirm('Quitter sans enregistrer ?')) && onFermer(), children: "\u2190" }), _jsx("h2", { style: { flex: 1 }, children: nouveau ? 'Nouveau programme' : 'Programme' }), actif && _jsx("span", { className: "pastille accent", children: "actif" })] }), _jsxs("div", { className: "carte pile", children: [_jsxs("label", { className: "champ", children: [_jsx("span", { children: "Nom" }), _jsx("input", { value: p.nom, placeholder: "ex. Recompo 4 jours", onChange: (e) => maj((x) => (x.nom = e.target.value)) })] }), _jsxs("label", { className: "champ", children: [_jsx("span", { children: "Description (optionnel)" }), _jsx("input", { value: p.description ?? '', placeholder: "ex. pecs et dos prioritaires", onChange: (e) => maj((x) => (x.description = e.target.value)) })] })] }), _jsxs("div", { className: "carte", children: [_jsx("h3", { children: "S\u00E9ances et planning" }), _jsx("div", { className: "faible", style: { marginTop: 4 }, children: "Le jour sert \u00E0 proposer la s\u00E9ance du jour. Sans jour : s\u00E9ance au choix (variante maison, s\u00E9ance d\u2019appoint\u2026)." }), entrees.length === 0 && _jsx("div", { className: "muted petit", style: { marginTop: 10 }, children: "Aucune s\u00E9ance pour l\u2019instant." }), entrees.map(({ e, i, m }, k) => (_jsxs("div", { className: "exo-ligne", children: [_jsxs("button", { className: "texte", onClick: () => onOuvrirSeance(m), children: [_jsx("strong", { children: m.nom }), _jsxs("div", { className: "faible", children: [m.sousTitre ? m.sousTitre + ' · ' : '', m.exercices.length, " exo", m.exercices.length > 1 ? 's' : '', " \u00B7 ", dureeTexte(m, terminees), " \u203A"] })] }), _jsxs("select", { value: e.jour ?? 0, style: { width: 84, padding: '8px 6px' }, onChange: (ev) => maj((x) => (x.seances[i].jour = +ev.target.value || undefined)), children: [_jsx("option", { value: 0, children: "\u2014" }), JOURS.slice(1).map((j, n) => (_jsx("option", { value: n + 1, children: j.slice(0, 3) }, j)))] }), _jsx("button", { className: "icone", disabled: k === 0, "aria-label": "Monter", onClick: () => maj((x) => {
                                    const [s] = x.seances.splice(i, 1);
                                    x.seances.splice(entrees[k - 1].i, 0, s);
                                }), children: "\u2191" }), _jsx("button", { className: "icone", "aria-label": "Retirer", onClick: () => maj((x) => x.seances.splice(i, 1)), children: "\u2715" })] }, e.modeleId + i))), _jsx("button", { className: "btn plein", style: { marginTop: 12 }, onClick: () => setChoix(true), children: "+ Ajouter une s\u00E9ance" })] }), modifie || nouveau || !enBase ? (_jsx("button", { className: "btn primaire grand", disabled: !valide, onClick: () => enregistrer(nouveau && !actif), children: nouveau ? 'CRÉER ET ACTIVER' : 'ENREGISTRER' })) : null, !valide && _jsx("div", { className: "faible", style: { marginTop: 6 }, children: "Il faut un nom et au moins une s\u00E9ance." }), !nouveau && (_jsxs("div", { className: "ligne wrap", style: { marginTop: 12 }, children: [!actif && (_jsx("button", { className: "btn primaire", disabled: !valide, onClick: () => enregistrer(true), children: "Activer ce programme" })), _jsx("button", { className: "btn", onClick: dupliquer, children: "Dupliquer" }), _jsx("button", { className: "btn danger", onClick: supprimer, children: "Supprimer" })] })), choix && (_jsx("div", { className: "modal-fond", onClick: () => setChoix(false), children: _jsxs("div", { className: "modal", onClick: (ev) => ev.stopPropagation(), children: [_jsx("h2", { style: { marginBottom: 12 }, children: "Ajouter une s\u00E9ance" }), _jsx("button", { className: "btn primaire plein", style: { marginBottom: 12 }, onClick: () => (setChoix(false), onNouvelleSeance()), children: "+ Cr\u00E9er une nouvelle s\u00E9ance" }), catalogue.modeles.map((m) => {
                            const deja = p.seances.some((e) => e.modeleId === m.id);
                            return (_jsxs("button", { className: "liste-btn", onClick: () => {
                                    setChoix(false);
                                    maj((x) => x.seances.push({ modeleId: m.id }));
                                }, children: [_jsxs("span", { children: [_jsx("strong", { children: m.nom }), " ", m.sousTitre && _jsxs("span", { className: "muted", children: ["\u2014 ", m.sousTitre] }), deja && _jsx("div", { className: "faible", children: "d\u00E9j\u00E0 dans le programme (l\u2019ajouter encore = 2 fois par semaine)" })] }), _jsx("span", { className: "muted", children: "+" })] }, m.id));
                        }), _jsx("button", { className: "btn discret plein", onClick: () => setChoix(false), children: "Annuler" })] }) }))] }));
}
function Editeur({ catalogue, initial, nouvelle, pourProgramme, onFermer, }) {
    const [m, setM] = useState(initial);
    const [choix, setChoix] = useState(false);
    const [editIdx, setEditIdx] = useState(null);
    // Programmes qui contiennent la séance ; une nouvelle séance va par défaut dans le programme actif.
    const progsInitiaux = catalogue.programmes.filter((p) => p.seances.some((e) => e.modeleId === initial.id)).map((p) => p.id);
    const [progs, setProgs] = useState(nouvelle ? [catalogue.actif.id] : progsInitiaux);
    const modifie = JSON.stringify(m) !== JSON.stringify(initial) || (!pourProgramme && [...progs].sort().join() !== [...progsInitiaux].sort().join());
    const prechargee = !!MODELES[m.id];
    const modifieeEnBase = useLiveQuery(() => db.modeles.get(m.id), [m.id]);
    useRetour(true, () => {
        if (modifie && !confirm('Quitter sans enregistrer ?'))
            return 'rester';
        onFermer();
    });
    const maj = (f) => setM((x) => {
        const c = structuredClone(x);
        f(c);
        return c;
    });
    const deplacer = (i, d) => maj((x) => {
        const [e] = x.exercices.splice(i, 1);
        x.exercices.splice(i + d, 0, e);
    });
    const finisseurs = m.exercices.filter((e) => e.finisseur).length;
    const valide = m.nom.trim() !== '' && m.exercices.length > 0;
    const enregistrer = async () => {
        const finale = { ...m, nom: m.nom.trim(), sousTitre: m.sousTitre.trim() };
        await db.modeles.put(finale);
        if (!pourProgramme)
            for (const p of catalogue.programmes) {
                const dedans = p.seances.some((e) => e.modeleId === finale.id);
                if (progs.includes(p.id) && !dedans)
                    await sauverProgramme({ ...p, seances: [...p.seances, { modeleId: finale.id }] }, catalogue);
                if (!progs.includes(p.id) && dedans)
                    await sauverProgramme({ ...p, seances: p.seances.filter((e) => e.modeleId !== finale.id) }, catalogue);
            }
        onFermer(finale);
    };
    const dupliquer = async () => {
        await db.modeles.put({ ...structuredClone(m), id: 'm_' + uid(), nom: `${m.nom.trim()} (copie)`, jour: undefined });
        onFermer();
    };
    const supprimer = async () => {
        if (!confirm(`Supprimer « ${m.nom} » ? L’historique des séances faites est conservé.`))
            return;
        if (prechargee)
            await db.modeles.put({ ...initial, supprime: true });
        else
            await db.modeles.delete(m.id);
        onFermer();
    };
    const reinitialiser = async () => {
        if (!confirm('Revenir à la version d’origine du programme ?'))
            return;
        await db.modeles.delete(m.id);
        onFermer();
    };
    return (_jsxs("div", { children: [_jsxs("div", { className: "entete", children: [_jsx("button", { className: "btn", onClick: () => {
                            if (!modifie || confirm('Quitter sans enregistrer ?'))
                                onFermer();
                        }, children: "\u2190" }), _jsx("h2", { style: { flex: 1 }, children: nouvelle ? 'Nouvelle séance' : 'Modifier la séance' })] }), _jsxs("div", { className: "carte pile", children: [_jsxs("label", { className: "champ", children: [_jsx("span", { children: "Nom" }), _jsx("input", { value: m.nom, placeholder: "ex. Haut D", onChange: (e) => maj((x) => (x.nom = e.target.value)) })] }), _jsxs("label", { className: "champ", children: [_jsx("span", { children: "Sous-titre" }), _jsx("input", { value: m.sousTitre, placeholder: "ex. \u00E9paules + bras", onChange: (e) => maj((x) => (x.sousTitre = e.target.value)) })] }), _jsxs("label", { className: "champ", children: [_jsx("span", { children: "Variante de (pour \u00AB Pas de salle \u00BB)" }), _jsxs("select", { value: m.varianteDe ?? '', onChange: (e) => maj((x) => (x.varianteDe = e.target.value || undefined)), children: [_jsx("option", { value: "", children: "Aucune" }), catalogue.modeles
                                        .filter((x) => x.id !== m.id)
                                        .map((x) => (_jsx("option", { value: x.id, children: x.nom }, x.id)))] })] }), !pourProgramme && (_jsxs("div", { className: "champ", children: [_jsxs("span", { children: ["Programme", catalogue.programmes.length > 1 ? 's' : ''] }), _jsx("div", { className: "chips", children: catalogue.programmes.map((p) => (_jsxs("button", { type: "button", className: progs.includes(p.id) ? 'actif' : '', onClick: () => setProgs((x) => (x.includes(p.id) ? x.filter((y) => y !== p.id) : [...x, p.id])), children: [progs.includes(p.id) ? '✓ ' : '', p.nom] }, p.id))) }), _jsx("span", { className: "faible", children: progs.length === 0
                                    ? 'Dans aucun programme : tu la retrouveras dans « Autre séance → Hors programme ».'
                                    : 'Le jour de la semaine se règle dans le programme (onglet Programmes).' })] }))] }), _jsxs("div", { className: "carte", children: [_jsxs("div", { className: "ligne entre", children: [_jsx("h3", { children: "Exercices" }), m.exercices.length > 0 && _jsxs("span", { className: "faible", children: ["\u2248 ", minutes(dureeEstimee(m))] })] }), m.exercices.length === 0 && _jsx("div", { className: "muted petit", style: { marginTop: 8 }, children: "Aucun exercice pour l\u2019instant." }), m.exercices.map((p, i) => {
                        const exo = catalogue.exo(p.exoId);
                        return (_jsxs("div", { className: "exo-ligne", children: [_jsxs("button", { className: "texte", onClick: () => setEditIdx(i), children: [_jsxs("strong", { children: [i + 1, ". ", exo.nom] }), p.optionnel && _jsx("span", { className: "faible", children: " (optionnel)" }), _jsx("div", { className: "faible", children: resumePlan(exo, p) })] }), _jsx("button", { className: "icone", disabled: i === 0, onClick: () => deplacer(i, -1), "aria-label": "Monter", children: "\u2191" }), _jsx("button", { className: "icone", disabled: i === m.exercices.length - 1, onClick: () => deplacer(i, 1), "aria-label": "Descendre", children: "\u2193" }), _jsx("button", { className: "icone", onClick: () => maj((x) => x.exercices.splice(i, 1)), "aria-label": "Retirer", children: "\u2715" })] }, p.exoId + i));
                    }), _jsx("button", { className: "btn plein", style: { marginTop: 12 }, onClick: () => setChoix(true), children: "+ Ajouter un exercice" }), finisseurs > 2 && (_jsxs("div", { className: "faible", style: { color: 'var(--alerte)', marginTop: 8 }, children: [finisseurs, " finisseurs dans la m\u00EAme s\u00E9ance : c\u2019est beaucoup, la qualit\u00E9 des derni\u00E8res s\u00E9ries risque d\u2019en p\u00E2tir."] }))] }), _jsx("button", { className: "btn primaire grand", disabled: !valide, onClick: enregistrer, children: "ENREGISTRER" }), !valide && _jsx("div", { className: "faible", style: { marginTop: 6 }, children: "Il faut un nom et au moins un exercice." }), !nouvelle && (_jsxs("div", { className: "ligne wrap", style: { marginTop: 12 }, children: [_jsx("button", { className: "btn", onClick: dupliquer, children: "Dupliquer" }), prechargee && modifieeEnBase && !modifieeEnBase.supprime && (_jsx("button", { className: "btn", onClick: reinitialiser, children: "Version d\u2019origine" })), _jsx("button", { className: "btn danger", onClick: supprimer, children: "Supprimer" })] })), choix && (_jsx(ChoixExo, { catalogue: catalogue, titre: "Ajouter un exercice", exclure: m.exercices.map((e) => e.exoId), onFermer: () => setChoix(false), onChoix: (id, cree) => {
                    setChoix(false);
                    const exo = cree ?? catalogue.exo(id);
                    maj((x) => x.exercices.push(planParDefaut(exo)));
                    setEditIdx(m.exercices.length);
                } })), editIdx !== null && m.exercices[editIdx] && (_jsx(EditeurExoPlan, { exo: catalogue.exo(m.exercices[editIdx].exoId), plan: m.exercices[editIdx], onFermer: () => setEditIdx(null), onValider: (p) => {
                    maj((x) => (x.exercices[editIdx] = p));
                    setEditIdx(null);
                } }, editIdx))] }));
}
