import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import Anneau from '../components/Anneau';
import CarteExo, { cibleSerie, Ecart, Editeur, majSeance } from '../components/CarteExo';
import ChoixExo from '../components/ChoixExo';
import EditeurObjectif from '../components/EditeurObjectif';
import Interrupteur from '../components/Interrupteur';
import Minuteur, { resteRepos } from '../components/Minuteur';
import { db, exoAvecReglages, historiqueDe, uid } from '../db';
import { debloquerSon, ecranAllume } from '../lib/appareil';
import { calories, chargeTexte, chrono, duree, dureePrevueExo, e1rm, ecartSerie, estDure, kg, minutes, POIDS_DEFAUT, reposApres, reposTexte, serieTexte, tempsParExo, } from '../lib/calc';
import { transition, useRetour } from '../lib/nav';
import { suggere, suggestionPour } from '../lib/progression';
import { planParDefaut } from './Seances';
function stocke(cle, defaut) {
    try {
        const v = localStorage.getItem(cle);
        return v ? JSON.parse(v) : defaut;
    }
    catch {
        return defaut;
    }
}
function range(cle, v) {
    try {
        if (v === null)
            localStorage.removeItem(cle);
        else
            localStorage.setItem(cle, JSON.stringify(v));
    }
    catch {
        /* stockage indisponible */
    }
}
/** Minuteur et exercice affiché d'une séance terminée ou abandonnée. */
function oublierEtatLocal(seanceId) {
    range('minuteur', null);
    range(`idx:${seanceId}`, null);
}
/** Heure courante, rafraîchie à intervalle régulier. */
function useHorloge(ms) {
    const [t, setT] = useState(Date.now());
    useEffect(() => {
        const id = setInterval(() => setT(Date.now()), ms);
        return () => clearInterval(id);
    }, [ms]);
    return t;
}
function chronoSeance(ms) {
    const t = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(t / 3600);
    const m = String(Math.floor((t % 3600) / 60)).padStart(h ? 2 : 1, '0');
    const sec = String(t % 60).padStart(2, '0');
    return h ? `${h}:${m}:${sec}` : `${m}:${sec}`;
}
export default function SeanceEnCours({ seance, catalogue }) {
    const terminees = useLiveQuery(() => db.seances.orderBy('debut').reverse().filter((s) => !s.enCours).toArray(), []);
    const reglages = useLiveQuery(() => db.reglages.toArray(), []);
    const [idxBrut, setIdxEtat] = useState(() => stocke(`idx:${seance.id}`, 0));
    const [minuteur, setMinuteurEtat] = useState(() => {
        const m = stocke('minuteur', null);
        return m?.seanceId === seance.id ? m : null;
    });
    const [toast, setToast] = useState(null);
    // Mode plein écran : il le reste d'un repos à l'autre tant qu'on ne le réduit pas.
    const [focus, setFocusEtat] = useState(() => stocke('modeFocus', false));
    const setFocus = (v) => (transition(() => setFocusEtat(v), 'fondu'), range('modeFocus', v), window.scrollTo({ top: 0 }));
    /** Plein écran pendant le repos : afficher quand même la saisie. */
    const [saisie, setSaisie] = useState(false);
    /** Plein écran : série en cours de correction. */
    const [corrige, setCorrige] = useState(null);
    const [fin, setFin] = useState(false);
    const [choix, setChoix] = useState(null);
    const [machinePrise, setMachinePrise] = useState(false);
    const [verrou, setVerrou] = useState(false);
    const maintenant = useHorloge(1000);
    const derniereTouche = useRef(0);
    const repriseAuto = useRef(null);
    const reposTraite = useRef(null);
    const plans = seance.exercices;
    const idx = Math.max(0, Math.min(idxBrut, plans.length - 1));
    const setIdx = (i) => {
        if (i === idx)
            return;
        transition(() => setIdxEtat(i), i > idx ? 'carte-avant' : 'carte-arriere');
        range(`idx:${seance.id}`, i);
        window.scrollTo({ top: 0 });
    };
    const setMinuteur = (m) => {
        const avecSeance = m && { ...m, seanceId: seance.id };
        setMinuteurEtat(avecSeance);
        range('minuteur', avecSeance);
    };
    const ouvrirFin = (v) => (transition(() => setFin(v), v ? 'avant' : 'arriere'), window.scrollTo({ top: 0 }));
    // Retour Android : fin → séance, puis exercice précédent. Ne quitte jamais une séance en cours.
    useRetour(true, () => {
        if (fin)
            ouvrirFin(false);
        else if (focus)
            setFocus(false);
        else if (idx > 0)
            setIdx(idx - 1);
        return 'rester';
    });
    useEffect(() => {
        ecranAllume(true);
        return () => ecranAllume(false);
    }, []);
    // Dernier geste hors minuteur : sert à savoir si l'utilisateur regarde autre chose pendant le repos.
    useEffect(() => {
        const noter = (e) => {
            if (!(e.target instanceof Element && e.target.closest('.minuteur')))
                derniereTouche.current = Date.now();
        };
        window.addEventListener('pointerdown', noter, true);
        window.addEventListener('keydown', noter, true);
        return () => {
            window.removeEventListener('pointerdown', noter, true);
            window.removeEventListener('keydown', noter, true);
        };
    }, []);
    const finRepos = minuteur && minuteur.pause === undefined && minuteur.fin <= maintenant ? minuteur.fin : null;
    useEffect(() => {
        if (finRepos === null || reposTraite.current === finRepos)
            return;
        reposTraite.current = finRepos;
        repriseAuto.current?.(finRepos);
    }, [finRepos]);
    // Nouveau repos : le plein écran revient sur le minuteur.
    useEffect(() => {
        setSaisie(false);
        setCorrige(null);
    }, [minuteur?.debut]);
    useEffect(() => {
        if (!toast)
            return;
        const t = setTimeout(() => setToast(null), 4000);
        return () => clearTimeout(t);
    }, [toast]);
    const exos = useMemo(() => (reglages ? plans.map((p) => exoAvecReglages(catalogue.exo(p.exoId), reglages)) : []), [plans, reglages, catalogue]);
    const suggestions = useMemo(() => {
        if (!terminees)
            return [];
        return plans.map((p, i) => suggestionPour(exos[i], p, terminees));
    }, [terminees, exos, plans]);
    if (!terminees || !reglages)
        return null;
    const valider = (s, repos) => {
        debloquerSon();
        setVerrou(true);
        setTimeout(() => setVerrou(false), 1500);
        setMinuteur({ debut: Date.now(), fin: Date.now() + repos * 1000, duree: repos });
        // Records (seulement s'il existe un historique pour comparer)
        const exo = exoAvecReglages(catalogue.exo(s.exoId), reglages);
        const avant = historiqueDe(terminees, s.exoId).flat();
        if (avant.length === 0)
            return;
        const memeCharge = avant.filter((x) => x.charge === s.charge);
        const e = e1rm(exo, s, seance.poidsCorps);
        const meilleur = Math.max(0, ...avant.map((x) => e1rm(exo, x, seance.poidsCorps) ?? 0));
        if (e && meilleur && e > meilleur)
            setToast(`🏆 Nouveau record e1RM : ${kg(e)} kg`);
        else if (memeCharge.length && s.reps > Math.max(...memeCharge.map((x) => x.reps)))
            setToast(`🏆 Nouveau record de reps à ${chargeTexte(exo, s.charge)} : ${s.reps}`);
    };
    const choisir = async (exoId, cree) => {
        const c = choix;
        setChoix(null);
        const exo = cree ?? catalogue.exo(exoId);
        if (c?.mode === 'remplacer') {
            // Le substitut garde son propre historique ; sans historique, il est « à calibrer ».
            const ancien = plans[c.i];
            const faites = nbFaites(ancien.exoId);
            const substitut = { ...ancien, exoId, charge: null, chauffes: [], finisseur: ancien.finisseur && exo.type === 'isolation', note: undefined };
            if (faites === 0) {
                await majSeance(seance.id, (s) => {
                    s.exercices[c.i] = substitut;
                });
            }
            else {
                // En cours de route : les séries faites restent sur l'original, les restantes passent au substitut.
                const total = ancien.series.length + (seance.ajustSeries[ancien.exoId] ?? 0);
                const restantes = Math.max(1, total - faites);
                await majSeance(seance.id, (s) => {
                    s.ajustSeries[ancien.exoId] = faites - ancien.series.length;
                    const series = ancien.series.slice(Math.min(faites, ancien.series.length - 1));
                    while (series.length < restantes)
                        series.push({ ...series[series.length - 1] });
                    s.exercices.splice(c.i + 1, 0, { ...substitut, series: series.slice(0, restantes) });
                });
                transition(() => setIdxEtat(c.i + 1), 'carte-avant');
                range(`idx:${seance.id}`, c.i + 1);
            }
            setToast(`🔁 ${catalogue.exo(ancien.exoId).nom} → ${exo.nom}`);
        }
        else {
            await majSeance(seance.id, (s) => {
                s.exercices.push(planParDefaut(exo));
            });
            transition(() => setIdxEtat(plans.length), 'carte-avant');
            range(`idx:${seance.id}`, plans.length);
        }
    };
    /** Machine prise : un autre exercice prend sa place, celui-ci se fera à la place de l'autre. */
    const echanger = async (i, j) => {
        setMachinePrise(false);
        await majSeance(seance.id, (s) => {
            const a = s.exercices[i];
            s.exercices[i] = s.exercices[j];
            s.exercices[j] = a;
            s.courant = s.exercices[i].exoId;
        });
        setToast(`⇄ ${exos[j].nom} maintenant, ${exos[i].nom} à sa place`);
    };
    /** Changer d'ordre volontairement : cet exercice devient l'exercice en cours. */
    const faireMaintenant = async (i) => {
        await majSeance(seance.id, (s) => {
            s.courant = plans[i].exoId;
        });
    };
    const allerEnCours = () => (enCours >= 0 ? setIdx(enCours) : ouvrirFin(true));
    /** Passer : l'exercice reste dans la séance, grisé ; le modèle ne change pas. */
    const passer = async (i) => {
        setMachinePrise(false);
        const id = plans[i].exoId;
        await majSeance(seance.id, (s) => {
            s.passes = [...new Set([...(s.passes ?? []), id])];
            if (s.courant === id)
                s.courant = undefined;
        });
        if (i < plans.length - 1)
            setIdx(i + 1);
        setToast(`${exos[i].nom} passé pour aujourd’hui`);
    };
    const annulerPasser = async (i) => {
        const id = plans[i].exoId;
        await majSeance(seance.id, (s) => {
            s.passes = (s.passes ?? []).filter((x) => x !== id);
            s.courant = id;
        });
    };
    const estPasse = (i) => !!seance.passes?.includes(plans[i].exoId);
    const nbFaites = (exoId) => seance.series.filter((s) => s.exoId === exoId).length;
    const totalDe = (i) => estPasse(i) ? nbFaites(plans[i].exoId) : Math.max(nbFaites(plans[i].exoId), plans[i].series.length + (seance.ajustSeries[plans[i].exoId] ?? 0));
    // Exercice en cours : celui choisi explicitement s'il n'est pas fini ; sinon celui de la dernière
    // série s'il en reste, sinon le prochain exercice pas fini.
    const enCours = (() => {
        const choisi = seance.courant ? plans.findIndex((p) => p.exoId === seance.courant) : -1;
        if (choisi >= 0 && nbFaites(plans[choisi].exoId) < totalDe(choisi))
            return choisi;
        const derniere = seance.series.reduce((a, s) => (!a || s.heure > a.heure ? s : a), null);
        const i0 = derniere ? plans.findIndex((p) => p.exoId === derniere.exoId) : -1;
        if (i0 >= 0 && nbFaites(plans[i0].exoId) < totalDe(i0))
            return i0;
        const ordre = [...plans.keys()].slice(i0 + 1).concat([...plans.keys()].slice(0, i0 + 1));
        return ordre.find((j) => nbFaites(plans[j].exoId) < totalDe(j)) ?? -1;
    })();
    // Avancement : séries faites sur le total prévu (un exercice passé ne compte que ses séries faites).
    const totalSeries = plans.reduce((a, _, i) => a + totalDe(i), 0);
    const seriesFaites = plans.reduce((a, p) => a + nbFaites(p.exoId), 0);
    const avancement = totalSeries ? seriesFaites / totalSeries : 0;
    const restantes = totalSeries - seriesFaites;
    // Temps restant : ~1 min par série et le repos qui la suit.
    const resteSec = plans.reduce((a, p, i) => {
        const t = totalDe(i);
        for (let k = nbFaites(p.exoId); k < t; k++)
            a += 60 + reposApres(p, k, t);
        return a;
    }, 0);
    const kcal = calories(maintenant - seance.debut, seance.poidsCorps);
    const ensuite = enCours >= 0 ? `${exos[enCours]?.nom} · série ${nbFaites(plans[enCours].exoId) + 1}/${totalDe(enCours)}` : 'Fin de séance 💪';
    const reposRestant = minuteur ? Math.max(0, Math.ceil(resteRepos(minuteur, maintenant))) : 0;
    // Fin du repos : sans geste pendant le repos (téléphone posé), retour sur la série à faire.
    // Si l'utilisateur regardait autre chose, on ne le déplace pas : le minuteur propose « Reprendre ».
    repriseAuto.current = (finR) => {
        if (!minuteur || fin || enCours < 0 || Date.now() - finR > 60000)
            return;
        const debut = minuteur.debut ?? finR - minuteur.duree * 1000;
        if (derniereTouche.current > debut + 500)
            return;
        if (enCours !== idx)
            setIdx(enCours);
        setTimeout(() => document.querySelector('.serie-bloc')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400);
    };
    if (fin)
        return _jsx(FinSeance, { seance: seance, terminees: terminees, reglages: reglages, catalogue: catalogue, onRetour: () => ouvrirFin(false) });
    const plan = plans[idx];
    // Mode plein écran : le repos en grand, puis la carte de l'exercice en cours pour saisir la série.
    const reposEnCours = !!minuteur && !(minuteur.pause === undefined && minuteur.fin <= maintenant);
    const vueRepos = reposEnCours && !saisie && !corrige;
    const derniereSerie = seance.series.reduce((a, x) => (!a || x.heure > a.heure ? x : a), null);
    const avancementCompact = (_jsxs("div", { className: "ligne focus-avancement", children: [_jsx(Anneau, { valeur: avancement, taille: 46, label: `${Math.round(avancement * 100)} % de la séance fait`, children: _jsxs("span", { className: "anneau-pct", children: [Math.round(avancement * 100), "%"] }) }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsxs("div", { children: [_jsx("strong", { children: restantes > 0 ? `Reste ${restantes} série${restantes > 1 ? 's' : ''}` : 'Tout est fait 💪' }), resteSec > 0 && _jsxs("span", { className: "faible", children: [" \u00B7 ~", minutes(Math.max(1, Math.round(resteSec / 60)))] })] }), _jsxs("div", { className: "faible", children: ["\u23F1 ", chronoSeance(maintenant - seance.debut), " \u00B7 \uD83D\uDD25 \u2248 ", kcal, " kcal"] })] }), _jsx("button", { className: "btn", onClick: () => setFocus(false), children: "\u2304 R\u00E9duire" })] }));
    if (focus) {
        const derniereInfo = (() => {
            if (!derniereSerie)
                return null;
            const i = plans.findIndex((p) => p.exoId === derniereSerie.exoId);
            if (i < 0)
                return null;
            const k = seance.series.filter((x) => x.exoId === derniereSerie.exoId).indexOf(derniereSerie);
            const avant = historiqueDe(terminees, derniereSerie.exoId)[0]?.[k];
            return (_jsxs("div", { className: "focus-bloc", children: [_jsxs("div", { className: "ligne entre", children: [_jsxs("span", { className: "faible", children: ["Tu viens de faire \u00B7 ", exos[i].nom] }), _jsx("button", { className: "btn discret petit", onClick: () => setCorrige(derniereSerie.id), children: "\u270E Corriger" })] }), _jsxs("div", { children: [_jsxs("strong", { children: ["S", k + 1, " ", serieTexte(exos[i], derniereSerie)] }), avant && _jsx(Ecart, { s: derniereSerie, avant: avant, exo: exos[i] })] })] }));
        })();
        const prochaine = (() => {
            if (enCours < 0)
                return null;
            const p = plans[enCours];
            const exo = exos[enCours];
            const n = nbFaites(p.exoId);
            const t = totalDe(enCours);
            const avant = historiqueDe(terminees, p.exoId)[0]?.[n];
            return (_jsxs("div", { className: "focus-bloc prochaine-grand", children: [_jsx("div", { className: "faible", children: "Prochaine s\u00E9rie" }), _jsx("h2", { children: exo.nom }), _jsxs("div", { className: "ligne wrap", style: { gap: 6 }, children: [_jsxs("span", { className: "pastille accent", children: ["S\u00E9rie ", n + 1, "/", t] }), p.finisseur && n === t - 1 && _jsx("span", { className: "pastille fin", children: "\u2605 finisseur" })] }), _jsx("div", { className: "cible-grand", children: cibleSerie(exo, p, suggestions[enCours], n) }), avant && _jsxs("div", { className: "faible", children: ["Derni\u00E8re fois : ", serieTexte(exo, avant)] }), n === 0 && p.chauffes.length > 0 && _jsxs("div", { className: "faible", children: ["\u00C9chauffement : ", p.chauffes.join(' · ')] }), (p.note || exo.notes) && _jsxs("div", { className: "faible", children: ["\u2139\uFE0F ", p.note ?? exo.notes] })] }));
        })();
        const planFocus = plans[enCours];
        // Correction : seulement la série concernée, rien d'autre.
        const correction = (() => {
            const serie = corrige ? seance.series.find((x) => x.id === corrige) : undefined;
            const i = serie ? plans.findIndex((p) => p.exoId === serie.exoId) : -1;
            if (!serie || i < 0)
                return null;
            const faites = seance.series.filter((x) => x.exoId === serie.exoId);
            return (_jsxs("div", { className: "focus-bloc pile", children: [_jsx("div", { className: "faible", children: exos[i].nom }), _jsx(Editeur, { seance: seance, plan: plans[i], exo: exos[i], sugg: suggestions[i], index: faites.indexOf(serie), total: totalDe(i), faites: faites, edition: serie, reposRestant: 0, verrou: false, onFini: () => setCorrige(null), onAnnulerEdition: () => setCorrige(null) })] }));
        })();
        return (_jsxs("div", { className: "focus apparait", children: [avancementCompact, minuteur && _jsx(Minuteur, { etat: minuteur, onChange: setMinuteur, variante: vueRepos ? 'grand' : 'bandeau' }), correction ? (correction) : vueRepos ? (_jsxs(_Fragment, { children: [derniereInfo, prochaine, enCours >= 0 && (_jsx("button", { className: "btn plein", onClick: () => setSaisie(true), children: "Voir la s\u00E9rie \u00B7 valider maintenant \u203A" }))] })) : enCours >= 0 ? (_jsx(CarteExo, { seance: seance, plan: planFocus, exo: exos[enCours], sugg: suggestions[enCours], derniere: historiqueDe(terminees, planFocus.exoId)[0], onValide: valider, onMachinePrise: () => undefined, reposRestant: reposRestant, verrou: verrou, consultation: false, enCoursNom: exos[enCours]?.nom, onFaireMaintenant: () => faireMaintenant(enCours), passe: estPasse(enCours), onAnnulerPasser: () => annulerPasser(enCours), onAllerEnCours: () => undefined, focus: true }, planFocus.exoId + enCours)) : (_jsxs("div", { className: "focus-bloc pile", children: [_jsx("h2", { children: "Toutes les s\u00E9ries sont faites \uD83D\uDCAA" }), _jsx("button", { className: "btn primaire grand", onClick: () => (setFocus(false), ouvrirFin(true)), children: "Terminer la s\u00E9ance" })] })), !correction && (_jsx("button", { className: "btn discret plein", style: { marginBottom: 24 }, onClick: () => setFocus(false), children: "Carte compl\u00E8te (machine prise, photo\u2026) \u203A" })), toast && _jsx("div", { className: "toast", children: toast })] }));
    }
    return (_jsxs("div", { className: "apparait", children: [_jsxs("div", { className: "entete colle", children: [_jsxs("div", { className: "ligne entre", style: { marginBottom: 10 }, children: [_jsxs("button", { className: "resume-seance", onClick: () => setFocus(true), "aria-label": "Plein \u00E9cran", children: [_jsx(Anneau, { valeur: avancement, taille: 40, label: `${Math.round(avancement * 100)} % de la séance fait`, children: _jsxs("span", { className: "anneau-pct", children: [Math.round(avancement * 100), "%"] }) }), _jsxs("span", { children: [_jsx("strong", { className: "chrono-seance", children: chronoSeance(maintenant - seance.debut) }), _jsx("span", { className: "faible", children: totalSeries > 0 && (restantes > 0 ? `reste ${restantes} série${restantes > 1 ? 's' : ''}` : 'tout est fait 💪') })] })] }), _jsx("button", { className: "btn", onClick: () => ouvrirFin(true), children: "Terminer" })] }), _jsxs("div", { className: "pills", children: [plans.map((p, i) => {
                                const passe = estPasse(i);
                                const fait = !passe && nbFaites(p.exoId) >= totalDe(i);
                                return (_jsx("button", { className: (i === idx ? 'actif ' : '') + (fait ? 'fait ' : '') + (passe ? 'passe ' : '') + (i === enCours ? 'en-cours' : ''), onClick: () => setIdx(i), "aria-label": i === enCours ? `Exercice ${i + 1}, en cours` : undefined, children: fait ? '✓' : passe ? '–' : i + 1 }, p.exoId + i));
                            }), _jsx("button", { onClick: () => setChoix({ mode: 'ajouter' }), "aria-label": "Ajouter un exercice", children: "+" })] }), enCours >= 0 && enCours !== idx && (_jsxs("div", { className: "legende-pills", children: [_jsxs("span", { children: [_jsx("i", { style: { background: 'var(--accent)' } }), "en cours : ", exos[enCours]?.nom] }), _jsxs("span", { children: [_jsx("i", { style: { border: '2px solid var(--accent)' } }), "affich\u00E9"] })] }))] }), plan ? (_jsx(CarteExo, { seance: seance, plan: plan, exo: exos[idx], sugg: suggestions[idx], derniere: historiqueDe(terminees, plan.exoId)[0], onValide: valider, onMachinePrise: () => setMachinePrise(true), reposRestant: reposRestant, verrou: verrou, consultation: idx !== enCours, enCoursNom: enCours >= 0 ? exos[enCours]?.nom : undefined, onFaireMaintenant: () => faireMaintenant(idx), passe: estPasse(idx), onAnnulerPasser: () => annulerPasser(idx), onAllerEnCours: allerEnCours }, plan.exoId + idx)) : (_jsxs("div", { className: "carte pile", children: [_jsx("h2", { children: "S\u00E9ance libre" }), _jsx("div", { className: "muted", children: "Ajoute tes exercices au fur et \u00E0 mesure." }), _jsx("button", { className: "btn primaire grand", onClick: () => setChoix({ mode: 'ajouter' }), children: "+ Ajouter un exercice" })] })), plan && (_jsxs("div", { className: "ligne entre", style: { marginBottom: 110 }, children: [_jsx("button", { className: "btn", disabled: idx === 0, onClick: () => setIdx(idx - 1), children: "\u2190 Pr\u00E9c\u00E9dent" }), idx < plans.length - 1 ? (_jsx("button", { className: "btn primaire", onClick: () => setIdx(idx + 1), children: "Suivant \u2192" })) : (_jsx("button", { className: "btn primaire", onClick: () => ouvrirFin(true), children: "Terminer la s\u00E9ance" }))] })), machinePrise && plan && (_jsx(MachinePrise, { nom: exos[idx].nom, entame: nbFaites(plan.exoId) > 0, autres: plans
                    .map((_, j) => j)
                    .filter((j) => j !== idx && !estPasse(j) && nbFaites(plans[j].exoId) < totalDe(j))
                    .map((j) => ({ i: j, nom: exos[j].nom, entame: nbFaites(plans[j].exoId) > 0 })), onEchanger: (j) => echanger(idx, j), onRemplacer: () => (setMachinePrise(false), setChoix({ mode: 'remplacer', i: idx })), onPasser: () => passer(idx), onFermer: () => setMachinePrise(false) })), choix && (_jsx(ChoixExo, { catalogue: catalogue, titre: choix.mode === 'remplacer' ? `Remplacer ${exos[choix.i].nom}` : 'Ajouter un exercice', muscle: choix.mode === 'remplacer' ? exos[choix.i].muscle : undefined, exclure: plans.map((p) => p.exoId), onChoix: choisir, onFermer: () => setChoix(null) })), toast && _jsx("div", { className: "toast", children: toast }), minuteur && (_jsx(Minuteur, { etat: minuteur, onChange: setMinuteur, ensuite: ensuite, onAller: enCours >= 0 && enCours !== idx ? () => setIdx(enCours) : enCours < 0 ? () => ouvrirFin(true) : undefined, onAgrandir: () => setFocus(true) }))] }));
}
function MachinePrise({ nom, entame, autres, onEchanger, onRemplacer, onPasser, onFermer, }) {
    const [echange, setEchange] = useState(false);
    useRetour(true, () => (echange ? (setEchange(false), 'rester') : onFermer()));
    const option = (titre, detail, fn, actif = true) => actif && (_jsxs("button", { className: "liste-btn", onClick: fn, children: [_jsxs("span", { children: [_jsx("strong", { children: titre }), _jsx("div", { className: "faible", children: detail })] }), _jsx("span", { className: "muted", children: "\u203A" })] }));
    return (_jsx("div", { className: "modal-fond", onClick: onFermer, children: _jsx("div", { className: "modal", onClick: (e) => e.stopPropagation(), children: echange ? (_jsxs(_Fragment, { children: [_jsxs("h2", { children: ["\u00C9changer ", nom] }), _jsxs("div", { className: "faible", style: { margin: '4px 0 14px' }, children: ["Quel exercice fais-tu maintenant ? ", nom, " prendra sa place dans la s\u00E9ance."] }), autres.map((a) => (_jsxs("button", { className: "liste-btn", onClick: () => onEchanger(a.i), children: [_jsxs("span", { children: [_jsx("strong", { children: a.nom }), _jsxs("div", { className: "faible", children: ["exercice ", a.i + 1, a.entame ? ' · déjà commencé' : ''] })] }), _jsx("span", { className: "muted", children: "\u21C4" })] }, a.i))), _jsx("button", { className: "btn discret plein", onClick: () => setEchange(false), children: "Retour" })] })) : (_jsxs(_Fragment, { children: [_jsx("h2", { children: "Machine prise" }), _jsx("div", { className: "faible", style: { margin: '4px 0 14px' }, children: nom }), option('⇄ Échanger', 'Faire un autre exercice de la séance maintenant ; celui-ci prend sa place.', () => setEchange(true), autres.length > 0), option('🔁 Remplacer', entame ? 'Les séries restantes passent sur un autre exercice.' : 'Par un exercice du même muscle, avec son propre historique.', onRemplacer), option('✕ Passer', 'Sauter cet exercice aujourd’hui. Il reste grisé dans la séance, tu peux y revenir.', onPasser), _jsx("button", { className: "btn discret plein", onClick: onFermer, children: "Annuler" })] })) }) }));
}
function FinSeance({ seance, terminees, reglages, catalogue, onRetour, }) {
    const modele = catalogue.modele(seance.modeleId);
    const [ressenti, setRessenti] = useState(3);
    const [energie, setEnergie] = useState(3);
    const [garder, setGarder] = useState(false);
    const [nomModele, setNomModele] = useState('');
    const [objectifs, setObjectifs] = useState(seance.objectifs ?? {});
    const [ajuste, setAjuste] = useState(null);
    const dures = seance.series.filter(estDure).length;
    const tonnage = seance.series.reduce((a, s) => a + s.charge * s.reps, 0);
    const finisseurs = seance.series.filter((s) => s.type === 'serie_longue' || s.type === 'drop' || s.type === 'rest_pause').length;
    const chauffes = Object.values(seance.chauffes).filter(Boolean).length;
    const libre = !modele && seance.exercices.length > 0;
    const passe = tempsParExo(seance);
    // « Prévoir la prochaine séance » : proposition automatique calculée avec cette séance incluse,
    // remplaçable par un objectif fixé à la main.
    const avecCelleCi = [seance, ...terminees];
    const prochaines = seance.exercices
        .filter((p) => seance.series.some((s) => s.exoId === p.exoId))
        .map((p) => {
        const exo = exoAvecReglages(catalogue.exo(p.exoId), reglages);
        const i = seance.exercices.indexOf(p);
        const avant = historiqueDe(terminees, p.exoId);
        return {
            exo,
            plan: p,
            record: Math.max(0, ...avant.flat().map((x) => e1rm(exo, x, seance.poidsCorps) ?? 0)),
            s: suggere(exo, p, historiqueDe(avecCelleCi, p.exoId)),
            series: seance.series.filter((x) => x.exoId === p.exoId),
            avant: avant[0] ?? [],
            ms: passe[p.exoId] ?? 0,
            prevu: dureePrevueExo(seance.exercices, i),
        };
    });
    const enregistrer = async () => {
        let modeleId = seance.modeleId;
        if (garder && libre) {
            modeleId = 'm_' + uid();
            await db.modeles.put({ id: modeleId, nom: nomModele.trim() || 'Séance libre', sousTitre: '', exercices: structuredClone(seance.exercices) });
        }
        await db.seances.update(seance.id, { enCours: false, fin: Date.now(), ressenti, energie, modeleId, objectifs });
        oublierEtatLocal(seance.id);
    };
    const abandonner = async () => {
        if (!confirm(seance.series.length ? 'Supprimer cette séance et ses séries ?' : 'Annuler la séance ?'))
            return;
        await db.seances.delete(seance.id);
        oublierEtatLocal(seance.id);
    };
    const echelle = (v, set, label) => (_jsxs("div", { children: [_jsx("div", { className: "faible", style: { marginBottom: 6 }, children: label }), _jsx("div", { className: "rpe", style: { gridTemplateColumns: 'repeat(5, 1fr)' }, children: [1, 2, 3, 4, 5].map((n) => (_jsx("button", { className: v === n ? 'actif' : '', onClick: () => set(n), children: n }, n))) })] }));
    return (_jsxs("div", { children: [_jsxs("div", { className: "entete", children: [_jsx("h1", { children: "Fin de s\u00E9ance" }), _jsx("button", { className: "btn", onClick: onRetour, children: "\u2190 Reprendre" })] }), _jsxs("div", { className: "carte", children: [_jsx("h2", { children: seance.nom }), _jsxs("div", { className: "ligne wrap", style: { marginTop: 8 }, children: [_jsxs("span", { className: "pastille", children: ["\u23F1 ", duree(Date.now() - seance.debut)] }), _jsxs("span", { className: "pastille", children: ["\uD83D\uDD25 \u2248 ", calories(Date.now() - seance.debut, seance.poidsCorps), " kcal"] }), _jsxs("span", { className: "pastille", children: [dures, " s\u00E9ries dures"] }), _jsxs("span", { className: "pastille", children: [kg(Math.round(tonnage)), " kg soulev\u00E9s"] }), finisseurs > 0 && _jsxs("span", { className: "pastille fin", children: ["\u2605 ", finisseurs, " finisseur(s)"] }), chauffes > 0 && _jsxs("span", { className: "pastille", children: [chauffes, " \u00E9chauffement(s)"] })] }), _jsxs("div", { className: "faible", style: { marginTop: 8 }, children: ["Calories estim\u00E9es d\u2019apr\u00E8s la dur\u00E9e et ", seance.poidsCorps ? `ton poids (${kg(seance.poidsCorps)} kg)` : `un poids de ${POIDS_DEFAUT} kg : note ton poids sur l’accueil pour affiner`, ". C\u2019est un ordre de grandeur, pas une mesure."] })] }), prochaines.length > 0 && (_jsxs(_Fragment, { children: [_jsx("h3", { style: { margin: '18px 0 4px' }, children: "R\u00E9cap par exercice" }), _jsx("div", { className: "faible", style: { marginBottom: 10 }, children: "Tes s\u00E9ries compar\u00E9es \u00E0 la derni\u00E8re fois, puis l\u2019objectif de la prochaine s\u00E9ance : l\u2019appli le propose, tu peux le changer." }), prochaines.map(({ exo, plan, record, s, series, avant, ms, prevu }) => {
                        const o = objectifs[exo.id];
                        const charges = o?.charges ?? s.charges;
                        const reps = o?.reps ?? s.reps;
                        const r0 = plan.series[0];
                        const ch = plan.chauffes.filter((_, k) => seance.chauffes[`${exo.id}:${k}`]).length;
                        const volumeExo = series.reduce((a, x) => a + x.charge * x.reps, 0);
                        const meilleur = Math.max(0, ...series.map((x) => e1rm(exo, x, seance.poidsCorps) ?? 0));
                        return (_jsxs("div", { className: "carte pile recap", children: [_jsxs("div", { children: [_jsxs("div", { className: "ligne entre", style: { alignItems: 'baseline' }, children: [_jsx("strong", { children: exo.nom }), ms > 0 && (_jsxs("span", { className: "faible", style: { whiteSpace: 'nowrap' }, children: ["\u23F1 ", duree(ms), " ", _jsxs("span", { className: "muted", children: ["/ pr\u00E9vu ", duree(prevu * 1000)] })] }))] }), _jsxs("div", { className: "faible", children: ["Vis\u00E9 : ", plan.series.length, " \u00D7 ", r0.repsMin === r0.repsMax ? r0.repsMin : `${r0.repsMin}–${r0.repsMax}`, " \u00B7 RPE", ' ', plan.series.map((x) => kg(x.rpe)).join(', '), " \u00B7 repos ", reposTexte(plan)] })] }), _jsx("div", { children: series.map((x, k) => {
                                        const e = ecartSerie(x, avant[k]);
                                        const ecartRpe = x.rpeCible !== undefined ? x.rpe - x.rpeCible : 0;
                                        return (_jsxs("div", { className: "recap-serie", children: [_jsxs("div", { className: "ligne entre", children: [_jsxs("span", { children: [_jsxs("span", { className: "faible", children: ["S", k + 1] }), " ", serieTexte(exo, x), x.douleur ? ' ⚠️' : ''] }), e ? (_jsxs("span", { className: 'avant ' + e.sens, style: { display: 'inline', marginTop: 0 }, children: [e.sens === 'mieux' ? '↑' : e.sens === 'egal' ? '=' : '↓', " ", e.texte] })) : (_jsx("span", { className: "faible", children: avant.length ? '' : '1re fois' }))] }), _jsxs("div", { className: "faible petit-info", children: [x.rpeCible !== undefined && (_jsxs("span", { style: ecartRpe > 0.5 ? { color: 'var(--alerte)' } : undefined, children: ["RPE vis\u00E9 ", kg(x.rpeCible), ecartRpe ? ` (${ecartRpe > 0 ? '+' : '−'}${kg(Math.abs(ecartRpe))})` : ' ✓'] })), k > 0 && _jsxs("span", { children: ["\u23F1 ", chrono((x.heure - series[k - 1].heure) / 1000), " depuis S", k] }), avant[k] && _jsxs("span", { children: ["avant : ", serieTexte(exo, avant[k])] })] })] }, x.id));
                                    }) }), _jsxs("div", { className: "ligne wrap", style: { gap: 6 }, children: [plan.chauffes.length > 0 && (_jsxs("span", { className: "pastille", children: ["\u00C9chauffement ", ch, "/", plan.chauffes.length] })), volumeExo > 0 && _jsxs("span", { className: "pastille", children: [kg(Math.round(volumeExo)), " kg soulev\u00E9s"] }), meilleur > 0 && (_jsxs("span", { className: 'pastille' + (record && meilleur > record ? ' ok' : ''), children: ["1RM estim\u00E9 ", kg(Math.round(meilleur * 2) / 2), " kg", record && meilleur > record ? ' · record 🏆' : ''] }))] }), seance.notes[exo.id] && _jsxs("div", { className: "faible", children: ["\uD83D\uDCDD ", seance.notes[exo.id]] }), _jsxs("button", { className: "prochaine", onClick: () => setAjuste(exo.id), children: [_jsxs("span", { children: [_jsx("span", { className: "label", children: "Prochaine fois" }), _jsxs("strong", { children: [chargeTexte(exo, charges[0]), charges.some((c) => c !== charges[0]) && ` → ${chargeTexte(exo, charges[charges.length - 1])}`, " \u00D7 ", reps.join('/')] }), _jsx("span", { className: "faible", style: { display: 'block' }, children: o ? '✎ Fixé par toi.' : s.message })] }), _jsx("span", { className: "modifier", children: "\u270E Modifier" })] })] }, exo.id));
                    })] })), _jsxs("div", { className: "carte pile", children: [echelle(ressenti, setRessenti, 'Ressenti global (1 = dur, 5 = excellent)'), echelle(energie, setEnergie, 'Énergie (1 = vidé, 5 = au top)')] }), libre && (_jsxs("div", { className: "carte pile", children: [_jsx(Interrupteur, { on: garder, onChange: setGarder, label: "Enregistrer comme s\u00E9ance r\u00E9utilisable", aide: "Tu pourras la relancer ou l\u2019ajouter \u00E0 un programme depuis l\u2019onglet Programmes." }), garder && _jsx("input", { placeholder: "Nom de la s\u00E9ance", value: nomModele, onChange: (e) => setNomModele(e.target.value) })] })), ajuste &&
                (() => {
                    const p = prochaines.find((x) => x.exo.id === ajuste);
                    return (_jsx(EditeurObjectif, { exo: p.exo, auto: p.s, actuel: objectifs[ajuste], onFermer: () => setAjuste(null), onValider: (o) => (setObjectifs((x) => ({ ...x, [ajuste]: o })), setAjuste(null)), onAuto: () => {
                            setObjectifs((x) => {
                                const { [ajuste]: _retire, ...reste } = x;
                                return reste;
                            });
                            setAjuste(null);
                        } }));
                })(), _jsx("button", { className: "btn primaire grand", onClick: enregistrer, disabled: seance.series.length === 0, children: "ENREGISTRER" }), _jsx("button", { className: "btn discret danger plein", style: { marginTop: 12, marginBottom: 24 }, onClick: abandonner, children: seance.series.length ? 'Supprimer la séance' : 'Annuler la séance' })] }));
}
