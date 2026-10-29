import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { db, uid } from '../db';
import { chargeTexte, chrono, ecartSerie, kg, lireChauffe, reposApres, reposTexte, RIR, serieTexte } from '../lib/calc';
import { FINISSEURS, typeFinisseur, ZONES } from '../lib/finisseur';
import { useRetour } from '../lib/nav';
import { usePasBoutons } from '../lib/pasBoutons';
import Vignette from './Vignette';
import { vibrer } from '../lib/appareil';
const TYPES = [
    ['normale', 'Normale', 'Série classique, arrêtée avant l’échec.'],
    ['echec', 'Échec', 'Poussée jusqu’à ne plus pouvoir faire une rep propre.'],
    ['serie_longue', 'Partielles', 'Échec puis demi-reps sans reposer la charge.'],
    ['drop', 'Drop set', 'Échec, charge baissée, puis à nouveau jusqu’à l’échec.'],
    ['rest_pause', 'Rest-pause', 'Échec, courte pause, puis quelques reps de plus.'],
];
const RPES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
/** Heure de la dernière validation : bloque un double appui avant même le rafraîchissement de l'écran. */
let derniereValidation = 0;
/** Objectif de la série `n` : « 60 kg × 10 · RPE 8 ». */
export function cibleSerie(exo, plan, sugg, n) {
    const j = Math.min(n, sugg.charges.length - 1);
    const p = plan.series[Math.min(n, plan.series.length - 1)];
    return `${chargeTexte(exo, sugg.charges[j])} × ${sugg.reps[j] ?? p.repsMin} · RPE ${kg(p.rpe)}`;
}
export function majSeance(id, fn) {
    return db.seances.where('id').equals(id).modify(fn);
}
export default function CarteExo({ seance, plan, exo, sugg, derniere, onValide, onMachinePrise, reposRestant, verrou, consultation, enCoursNom, onFaireMaintenant, onAllerEnCours, passe, onAnnulerPasser, focus, editInitial, }) {
    const faites = seance.series.filter((s) => s.exoId === exo.id);
    const total = passe ? faites.length : Math.max(faites.length, plan.series.length + (seance.ajustSeries[exo.id] ?? 0));
    const [editId, setEditId] = useState(editInitial ?? null);
    const [photo, setPhoto] = useState(false);
    const enEdition = faites.find((s) => s.id === editId);
    const index = enEdition ? faites.indexOf(enEdition) : faites.length;
    const termine = !enEdition && faites.length >= total;
    // Série à saisir maintenant (aucune quand l'exercice est fini ou seulement consulté).
    const enSaisie = termine || consultation ? -1 : faites.length;
    const cible = (n) => cibleSerie(exo, plan, sugg, n);
    // Même série à la séance précédente (la plus proche si elle en avait moins).
    const avant = (n) => derniere?.[n];
    // Saisie collée sous la série concernée : celle en cours, ou une série faite qu'on corrige.
    const editeur = (_jsx(Editeur, { seance: seance, plan: plan, exo: exo, sugg: sugg, index: index, total: total, faites: faites, edition: enEdition, reposRestant: reposRestant, verrou: verrou, onFini: (s) => {
            if (enEdition)
                setEditId(null);
            else
                onValide(s, reposApres(plan, index, total));
        }, onAnnulerEdition: () => setEditId(null) }, `${exo.id}-${index}-${editId ?? ''}`));
    const ajuster = (delta) => majSeance(seance.id, (s) => {
        s.ajustSeries[exo.id] = (s.ajustSeries[exo.id] ?? 0) + delta;
    });
    return (_jsxs("div", { className: 'carte pile carte-exo' + (passe ? ' exo-passe' : ''), children: [_jsxs("div", { children: [_jsxs("div", { className: "ligne entre", style: { alignItems: 'flex-start' }, children: [exo.image && _jsx(Vignette, { exo: exo, taille: 52, onClick: () => setPhoto(true) }), _jsxs("h2", { style: { flex: 1 }, children: [exo.nom, plan.optionnel && (_jsx("span", { className: "pastille", style: { marginLeft: 8, verticalAlign: 'middle' }, children: "optionnel" }))] }), !focus && (_jsx("button", { className: "btn petit", style: { minHeight: 40, flex: '0 0 auto' }, onClick: onMachinePrise, children: "Machine prise" }))] }), _jsxs("div", { className: "faible", children: [plan.series.length, " \u00D7 ", plan.series[0].repsMin === plan.series[0].repsMax ? plan.series[0].repsMin : `${plan.series[0].repsMin}–${plan.series[0].repsMax}`, " \u00B7 RPE", ' ', plan.series.map((p) => kg(p.rpe)).join(', '), " \u00B7 repos ", reposTexte(plan), plan.finisseur && _jsxs("span", { style: { color: 'var(--finisseur)' }, children: [" \u00B7 \u2605 ", FINISSEURS[typeFinisseur(plan)].nom.toLowerCase()] })] })] }), _jsxs("div", { className: "suggestion petit", children: [_jsx("div", { children: _jsxs("strong", { children: ["Cible : ", chargeTexte(exo, sugg.charges[0]), sugg.charges.some((c) => c !== sugg.charges[0]) && ` → ${chargeTexte(exo, sugg.charges[sugg.charges.length - 1])}`, " \u00D7", ' ', sugg.reps.join('/')] }) }), _jsx("div", { className: "muted", children: sugg.message })] }), (plan.note || exo.notes) && _jsxs("div", { className: "faible", children: ["\u2139\uFE0F ", plan.note ?? exo.notes] }), _jsxs("div", { children: [plan.chauffes.map((c, i) => {
                        const cle = `${exo.id}:${i}`;
                        const fait = !!seance.chauffes[cle];
                        const l = lireChauffe(c);
                        return (_jsxs("button", { className: 'serie-chauffe' + (fait ? ' fait' : ''), onClick: () => {
                                vibrer();
                                void majSeance(seance.id, (x) => {
                                    x.chauffes[cle] = !fait;
                                });
                            }, children: [_jsx("span", { className: "case", children: fait ? '✓' : '' }), _jsxs("span", { children: [_jsxs("span", { className: "faible", children: ["\u00C9chauffement ", i + 1] }), " ", l ? `${chargeTexte(exo, l.charge)} × ${l.reps}` : c] })] }, cle));
                    }), Array.from({ length: total }, (_, n) => {
                        const s = faites[n];
                        if (s) {
                            const ligne = (_jsxs("button", { className: 'serie-faite' + (s.id === editId ? ' edition' : ''), onClick: () => setEditId(s.id === editId ? null : s.id), children: [_jsxs("span", { children: [_jsx("span", { className: "ok-texte", children: "\u2713" }), " ", _jsxs("span", { className: "faible", children: ["S", n + 1] }), " ", serieTexte(exo, s), avant(n) && _jsx(Ecart, { s: s, avant: avant(n), exo: exo })] }), _jsxs("span", { className: "faible", children: [s.type === 'serie_longue' ? '★' : s.type !== 'normale' ? TYPES.find((t) => t[0] === s.type)?.[1] : '', s.douleur ? ' ⚠️' : '', " \u270E"] })] }, s.id));
                            return s.id === editId ? (_jsxs("div", { className: "serie-bloc", children: [ligne, editeur] }, s.id)) : (ligne);
                        }
                        const ligne = (_jsxs("div", { className: 'serie-prevue ' + (n === enSaisie ? 'en-cours' : 'a-venir'), children: [_jsxs("span", { children: [n === enSaisie ? '▶' : '○', " ", _jsxs("span", { className: "faible", children: ["S", n + 1] }), " ", cible(n), plan.finisseur && n === total - 1 ? ' ★' : '', avant(n) && _jsxs("span", { className: "avant", children: ["derni\u00E8re fois : ", serieTexte(exo, avant(n))] })] }), _jsxs("span", { className: "faible", children: ["repos ", chrono(reposApres(plan, n, total))] })] }, n));
                        return n === enSaisie && !enEdition ? (_jsxs("div", { className: "serie-bloc", children: [ligne, editeur] }, n)) : (ligne);
                    })] }), termine && (_jsxs("div", { className: "pile", children: [_jsxs("div", { className: "ligne entre", children: [passe ? (_jsxs("span", { className: "pastille", children: ["\u293C Pass\u00E9 aujourd\u2019hui", faites.length ? ` après ${faites.length} série${faites.length > 1 ? 's' : ''}` : ''] })) : (_jsx("span", { className: "pastille ok", children: "\u2713 Exercice termin\u00E9" })), _jsx("button", { className: "btn discret petit", onClick: () => (passe ? onAnnulerPasser() : (ajuster(+1), onFaireMaintenant())), children: passe ? 'Le faire quand même' : '+ série' })] }), _jsx("button", { className: "btn primaire grand", onClick: onAllerEnCours, children: enCoursNom ? `Continuer : ${enCoursNom} →` : 'Terminer la séance' })] })), !termine && consultation && !enEdition && (_jsxs("div", { className: "consultation pile", children: [_jsxs("div", { className: "petit", children: ["\uD83D\uDC40 ", _jsx("strong", { children: "Consultation." }), ' ', _jsxs("span", { className: "muted", children: ["L\u2019exercice en cours est ", _jsx("strong", { children: enCoursNom }), "."] })] }), _jsxs("button", { className: "btn primaire grand", onClick: onAllerEnCours, children: ["\u21A9 Revenir \u00E0 ", enCoursNom] }), _jsx("button", { className: "btn plein", onClick: onFaireMaintenant, children: "Faire cet exercice maintenant" })] })), !termine && !enEdition && (_jsxs("div", { className: "ligne entre", children: [_jsx("button", { className: "btn discret petit", onClick: () => ajuster(+1), children: "+ s\u00E9rie" }), total > faites.length && (_jsx("button", { className: "btn discret petit", onClick: () => ajuster(-1), children: "\u2212 retirer une s\u00E9rie" }))] })), photo && exo.image && _jsx(Photo, { src: exo.image, titre: exo.nom, onFermer: () => setPhoto(false) }), _jsx("textarea", { rows: 2, placeholder: "Note (r\u00E9glage machine, sensation, douleur\u2026)", defaultValue: seance.notes[exo.id] ?? '', onBlur: (e) => {
                    const v = e.target.value;
                    void majSeance(seance.id, (s) => {
                        s.notes[exo.id] = v;
                    });
                } })] }));
}
export function Ecart({ s, avant, exo }) {
    const e = ecartSerie(s, avant);
    return (_jsxs("span", { className: 'avant ' + e.sens, children: [e.sens === 'mieux' ? '↑' : e.sens === 'egal' ? '=' : '↓', " ", e.texte, " ", _jsxs("span", { className: "faible", children: ["(avant ", serieTexte(exo, avant), ")"] })] }));
}
function Photo({ src, titre, onFermer }) {
    useRetour(true, onFermer);
    return (_jsx("div", { className: "modal-fond", onClick: onFermer, children: _jsxs("div", { className: "modal pile", onClick: onFermer, children: [_jsx("h3", { children: titre }), _jsx("img", { src: src, alt: titre, className: "photo-grande" }), _jsx("button", { className: "btn discret plein", children: "Fermer" })] }) }));
}
function Editeur({ seance, plan, exo, sugg, index, total, faites, edition, reposRestant, verrou, onFini, onAnnulerEdition }) {
    const p = plan.series[Math.min(index, plan.series.length - 1)];
    const i = Math.min(index, sugg.charges.length - 1);
    const finisseur = !edition && plan.finisseur && index === total - 1;
    // Charge proposée : la suggestion, décalée du même écart que l'utilisateur a appliqué à la série précédente.
    const chargeInitiale = () => {
        const prec = faites[index - 1];
        const s = sugg.charges[i];
        if (s === null)
            return prec?.charge ?? (exo.mode === 'elastique' ? 1 : 0);
        const sPrec = sugg.charges[Math.min(index - 1, sugg.charges.length - 1)];
        return prec && sPrec !== null && index > 0 ? Math.max(0, s + (prec.charge - sPrec)) : s;
    };
    const [charge, setCharge] = useState(edition?.charge ?? chargeInitiale());
    const [chargeTxt, setChargeTxt] = useState(null);
    const [reps, setReps] = useState(edition?.reps ?? sugg.reps[i] ?? p.repsMin);
    const [rpe, setRpe] = useState(edition?.rpe ?? (finisseur ? 10 : p.rpe));
    const [type, setType] = useState(edition?.type ?? (finisseur ? 'echec' : 'normale'));
    const [douleur, setDouleur] = useState(edition?.douleur ?? false);
    const [options, setOptions] = useState(false);
    const [panneau, setPanneau] = useState(false);
    const [demi, setDemi] = useState(edition?.demiReps ?? 6);
    const zone = edition?.zone ?? plan.zone ?? 'etiree';
    const [suite, setSuite] = useState(edition?.suite ?? []);
    const tf = typeFinisseur(plan);
    const info = FINISSEURS[tf];
    const [aideRpe, setAideRpe] = useState(false);
    const pasBoutons = usePasBoutons();
    // Pendant le repos, la validation reste possible mais passe au second plan.
    const enRepos = !edition && reposRestant > 0;
    const pas = pasBoutons(exo);
    const unite = exo.mode === 'elastique' ? 'niveau' : exo.mode === 'poids_corps' ? 'kg de lest (− = assistance)' : exo.mode === 'par_main' ? 'kg par main' : 'kg';
    const arr = (x) => Math.round(x * 100) / 100;
    const construire = (t, extra = {}) => ({
        id: edition?.id ?? uid(),
        exoId: exo.id,
        type: t,
        charge,
        reps,
        rpe: t === 'serie_longue' ? 10 : rpe,
        rpeCible: p.rpe,
        repsMin: p.repsMin,
        repsMax: p.repsMax,
        douleur: douleur || undefined,
        heure: edition?.heure ?? Date.now(),
        ...extra,
    });
    const enregistrer = async (s) => {
        if (!edition) {
            if (Date.now() - derniereValidation < 1500)
                return;
            derniereValidation = Date.now();
        }
        vibrer(40);
        await majSeance(seance.id, (x) => {
            const k = x.series.findIndex((y) => y.id === s.id);
            if (k >= 0)
                x.series[k] = s;
            else
                x.series.push(s);
        });
        onFini(s);
    };
    const supprimer = async () => {
        if (!edition)
            return;
        await majSeance(seance.id, (x) => {
            x.series = x.series.filter((y) => y.id !== edition.id);
        });
        onAnnulerEdition();
    };
    const ouvrirPanneau = () => {
        // Drop set : ~25 % de moins, arrondi au pas ; rest-pause : même charge, deux mini-séries.
        if (tf === 'drop')
            setSuite([{ charge: Math.max(0, Math.round((charge * 0.75) / exo.pas) * exo.pas), reps: 6 }]);
        if (tf === 'rest_pause')
            setSuite([{ charge, reps: 4 }, { charge, reps: 2 }]);
        setPanneau(true);
    };
    const majSuite = (k, champ, v) => setSuite((x) => x.map((y, j) => (j === k ? { ...y, [champ]: Math.max(0, arr(v)) } : y)));
    if (panneau) {
        return (_jsxs("div", { className: "pile", children: [_jsxs("div", { className: "bandeau-fin", children: ["\u2605 ", info.nom, " \u00B7 ", tf === 'partielles' ? 'enchaîne sans reposer la charge' : tf === 'drop' ? 'baisse la charge et repars, sans repos' : 'pose la charge 15 s, puis repars'] }), tf === 'partielles' && (_jsx(_Fragment, { children: _jsxs("div", { className: "stepper", children: [_jsx("button", { onClick: () => setDemi(Math.max(0, demi - 1)), children: "\u2212" }), _jsxs("div", { className: "valeur", children: [_jsx("input", { inputMode: "numeric", value: demi, onChange: (e) => setDemi(parseInt(e.target.value) || 0) }), _jsxs("span", { className: "unite", children: ["demi-reps (5\u20138), zone ", ZONES.find((z) => z[0] === zone)?.[1]] })] }), _jsx("button", { onClick: () => setDemi(demi + 1), children: "+" })] }) })), suite.map((x, k) => (_jsxs("div", { className: "pile", style: { gap: 6 }, children: [_jsx("div", { className: "faible", children: tf === 'drop' ? 'Après la baisse' : `Après la pause ${k + 1}` }), tf === 'drop' && (_jsxs("div", { className: "stepper", children: [_jsx("button", { onClick: () => majSuite(k, 'charge', x.charge - pas), children: "\u2212" }), _jsxs("div", { className: "valeur", children: [_jsx("strong", { children: kg(x.charge) }), _jsx("span", { className: "unite", children: unite })] }), _jsx("button", { onClick: () => majSuite(k, 'charge', x.charge + pas), children: "+" })] })), _jsxs("div", { className: "stepper", children: [_jsx("button", { onClick: () => majSuite(k, 'reps', x.reps - 1), children: "\u2212" }), _jsxs("div", { className: "valeur", children: [_jsx("strong", { children: x.reps }), _jsx("span", { className: "unite", children: "reps" })] }), _jsx("button", { onClick: () => majSuite(k, 'reps', x.reps + 1), children: "+" })] })] }, k))), _jsx("button", { className: "btn finisseur grand", onClick: () => enregistrer(construire(info.typeSerie, tf === 'partielles' ? { demiReps: demi, zone } : { suite, rpe: 10 })), children: "VALIDER LE FINISSEUR" }), _jsx("button", { className: "btn plein", onClick: () => enregistrer(construire('echec')), children: "Je me suis arr\u00EAt\u00E9 \u00E0 l\u2019\u00E9chec" }), _jsx("div", { className: "faible", children: "Stoppe si douleur articulaire (une br\u00FBlure musculaire, c\u2019est normal)." })] }));
    }
    return (_jsxs("div", { className: "pile", children: [_jsxs("div", { className: "ligne entre", children: [edition && _jsxs("h3", { children: ["Modifier la s\u00E9rie ", index + 1] }), _jsxs("span", { className: "faible", children: ["fourchette ", p.repsMin === p.repsMax ? p.repsMin : `${p.repsMin}–${p.repsMax}`, " reps \u00B7 RPE ", kg(p.rpe)] })] }), finisseur && (_jsxs("div", { className: "bandeau-fin", children: ["\u2605 FINISSEUR \u00B7 ", info.nom, " : ", info.court] })), _jsxs("div", { className: "stepper", children: [_jsx("button", { onClick: () => (setCharge(arr(charge - pas)), setChargeTxt(null)), children: "\u2212" }), _jsxs("div", { className: "valeur", children: [_jsx("input", { inputMode: "decimal", value: chargeTxt ?? kg(charge), onFocus: (e) => e.target.select(), onChange: (e) => {
                                    setChargeTxt(e.target.value);
                                    const v = parseFloat(e.target.value.replace(',', '.'));
                                    if (!isNaN(v))
                                        setCharge(v);
                                }, onBlur: () => setChargeTxt(null) }), _jsx("span", { className: "unite", children: unite })] }), _jsx("button", { onClick: () => (setCharge(arr(charge + pas)), setChargeTxt(null)), children: "+" })] }), _jsxs("div", { className: "stepper", children: [_jsx("button", { onClick: () => setReps(Math.max(0, reps - 1)), children: "\u2212" }), _jsxs("div", { className: "valeur", children: [_jsx("input", { inputMode: "numeric", value: reps, onFocus: (e) => e.target.select(), onChange: (e) => setReps(parseInt(e.target.value) || 0) }), _jsx("span", { className: "unite", children: "reps" })] }), _jsx("button", { onClick: () => setReps(reps + 1), children: "+" })] }), !finisseur && (_jsxs("div", { children: [_jsx("div", { className: "rpe", children: RPES.map((r) => (_jsx("button", { className: (rpe === r ? 'actif ' : '') + (p.rpe === r ? 'cible ' : '') + (r % 1 ? 'demi' : ''), onClick: () => setRpe(r), onContextMenu: (e) => (e.preventDefault(), setAideRpe(true)), children: r % 1 ? '½' : r }, r))) }), _jsxs("div", { className: "ligne entre faible", style: { marginTop: 4 }, children: [_jsxs("span", { children: ["RPE ", kg(rpe), " \u00B7 ", RIR[Math.floor(rpe)] ?? '', rpe > p.rpe + 0.5 && _jsx("span", { style: { color: 'var(--alerte)' }, children: " \u00B7 plus dur que pr\u00E9vu" })] }), _jsx("button", { className: "btn discret petit", style: { minHeight: 0, padding: 0 }, onClick: () => setAideRpe(!aideRpe), children: "aide RPE" })] }), aideRpe && (_jsx("table", { className: "note-rpe", style: { marginTop: 6 }, children: _jsx("tbody", { children: [10, 9, 8, 7, 6].map((r) => (_jsxs("tr", { children: [_jsx("td", { children: _jsx("strong", { children: r }) }), _jsx("td", { children: ['4 en réserve, très facile', '3 en réserve', '2 en réserve', '1 rep de plus possible', 'échec technique'][r - 6] })] }, r))) }) }))] })), verrou && !edition ? (_jsx("button", { className: "btn grand", disabled: true, style: { opacity: 1, color: 'var(--ok)' }, children: "\u2713 S\u00C9RIE ENREGISTR\u00C9E" })) : finisseur ? (_jsxs("button", { className: 'btn grand' + (enRepos ? '' : ' finisseur'), onClick: () => (tf === 'echec' ? enregistrer(construire('echec')) : ouvrirPanneau()), children: [tf === 'echec' ? 'VALIDER (ÉCHEC)' : 'ÉCHEC ATTEINT', enRepos ? ` · repos ${chrono(reposRestant)}` : ''] })) : (_jsx("button", { className: 'btn grand' + (enRepos ? '' : ' primaire'), onClick: () => enregistrer(construire(type, type === 'serie_longue' ? { demiReps: demi, zone } : { demiReps: undefined, zone: undefined })), children: edition ? 'METTRE À JOUR' : enRepos ? `Valider maintenant · repos ${chrono(reposRestant)}` : 'VALIDER LA SÉRIE' })), _jsxs("div", { className: "ligne entre", children: [_jsxs("button", { className: "btn discret petit", onClick: () => setOptions(!options), children: [options ? '▾' : '▸', " Autre type de s\u00E9rie, douleur"] }), edition && (_jsxs("div", { className: "ligne", children: [_jsx("button", { className: "btn discret petit", onClick: onAnnulerEdition, children: "Annuler" }), _jsx("button", { className: "btn discret petit danger", onClick: supprimer, children: "Supprimer" })] }))] }), options && (_jsxs("div", { className: "pile options-serie", children: [_jsxs("div", { children: [_jsxs("div", { className: "petit", style: { marginBottom: 6 }, children: [_jsx("strong", { children: "Type de s\u00E9rie" }), " ", _jsx("span", { className: "muted", children: "\u2014 \u00E0 changer seulement si ce n\u2019\u00E9tait pas une s\u00E9rie classique" })] }), _jsx("div", { className: "chips", children: TYPES.map(([t, nom]) => (_jsx("button", { className: type === t ? 'actif' : '', onClick: () => {
                                        setType(t);
                                        if (t !== 'normale')
                                            setRpe(10);
                                    }, children: nom }, t))) }), _jsx("div", { className: "faible", style: { marginTop: 4 }, children: TYPES.find((t) => t[0] === type)?.[2] })] }), type === 'serie_longue' && (_jsxs("div", { className: "ligne", children: [_jsx("span", { className: "petit", children: "Demi-reps" }), _jsx("button", { className: "btn", onClick: () => setDemi(Math.max(0, demi - 1)), children: "\u2212" }), _jsx("strong", { children: demi }), _jsx("button", { className: "btn", onClick: () => setDemi(demi + 1), children: "+" })] })), _jsxs("div", { children: [_jsxs("div", { className: "petit", style: { marginBottom: 6 }, children: [_jsx("strong", { children: "Douleur articulaire ?" }), ' ', _jsx("span", { className: "muted", children: "\u2014 not\u00E9e dans l\u2019historique pour la surveiller. Une br\u00FBlure musculaire est normale : ne la signale pas." })] }), _jsx("div", { className: "chips", children: _jsxs("button", { className: douleur ? 'actif' : '', onClick: () => setDouleur(!douleur), children: ["\u26A0\uFE0F ", douleur ? 'Douleur signalée' : 'Signaler une douleur'] }) }), douleur && _jsx("div", { className: "faible", children: "All\u00E8ge ou passe l\u2019exercice. Si elle persiste, consulte." })] })] }))] }));
}
