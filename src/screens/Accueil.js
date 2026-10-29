import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { MUSCLES } from '../data/exercices';
import { db, dernierPoids, uid } from '../db';
import { dateISO, dureeTexte, jourSemaine, kg, lundi, volumeParMuscle } from '../lib/calc';
import { debloquerSon } from '../lib/appareil';
import { transition, useRetour } from '../lib/nav';
import Apercu from './Apercu';
const JOURS = ['', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
const exercices = (n) => `${n} exercice${n > 1 ? 's' : ''}`;
/** Sans modèle : séance libre, les exercices s'ajoutent à la volée. */
async function demarrer(modele) {
    debloquerSon();
    await db.seances.add({
        id: uid(),
        date: dateISO(),
        modeleId: modele?.id,
        nom: modele?.nom ?? 'Séance libre',
        sousTitre: modele?.sousTitre ?? 'exercices au choix',
        exercices: structuredClone(modele?.exercices ?? []),
        debut: Date.now(),
        enCours: true,
        poidsCorps: await dernierPoids(),
        chauffes: {},
        series: [],
        notes: {},
        ajustSeries: {},
    });
}
export default function Accueil({ catalogue }) {
    const [choix, setChoix] = useState(false);
    const [ouvert, setOuvert] = useState(null);
    const [apercu, setApercuEtat] = useState(null);
    useRetour(choix, () => setChoix(false));
    const voir = (m) => {
        setChoix(false);
        transition(() => setApercuEtat(m), m ? 'avant' : 'arriere');
        window.scrollTo({ top: 0 });
    };
    const aujourdhui = dateISO();
    const debutSemaine = lundi();
    const semaine = useLiveQuery(() => db.seances.where('date').aboveOrEqual(debutSemaine).filter((s) => !s.enCours).toArray(), [debutSemaine], []);
    const pesees = useLiveQuery(() => db.pesees.orderBy('date').reverse().limit(14).toArray(), [], []);
    const dernierExport = useLiveQuery(() => db.reglages.get('dernierExport'), []);
    const nbSeances = useLiveQuery(() => db.seances.count(), [], 0);
    const terminees = useLiveQuery(() => db.seances.filter((s) => !s.enCours).toArray(), []);
    const { planning, actif } = catalogue;
    // Séances faites cette semaine pour un modèle (sa variante maison compte aussi).
    const realisees = (m) => semaine.filter((s) => s.modeleId === m.id || catalogue.modele(s.modeleId)?.varianteDe === m.id).length;
    // Une même séance peut revenir deux fois dans la semaine : la k-ième est faite s'il y en a eu au moins k.
    const faite = (e) => realisees(e.modele) > planning.filter((x) => x.modele.id === e.modele.id && x.jour < e.jour).length;
    const jour = jourSemaine();
    const duJour = planning.find((e) => e.jour === jour);
    const prochaine = planning.find((e) => !faite(e) && e.jour >= jour) ?? planning.find((e) => !faite(e));
    const variante = duJour && catalogue.modeles.find((m) => m.varianteDe === duJour.modele.id);
    const proposee = duJour && !faite(duJour) ? duJour : prochaine;
    const seancesDe = (p) => [...new Set(p.seances.map((e) => e.modeleId))].map((id) => catalogue.modele(id)).filter((m) => !!m);
    // Programme actif en tête, puis les autres ; les séances d'aucun programme à la fin.
    const programmes = [actif, ...catalogue.programmes.filter((p) => p.id !== actif.id)];
    const dansUnProgramme = new Set(catalogue.programmes.flatMap((p) => p.seances.map((e) => e.modeleId)));
    const horsProgramme = catalogue.modeles.filter((m) => !dansUnProgramme.has(m.id));
    const groupeOuvert = ouvert ?? actif.id;
    const volume = volumeParMuscle(semaine, catalogue.exercices);
    if (apercu)
        return _jsx(Apercu, { modele: apercu, catalogue: catalogue, onDemarrer: () => demarrer(apercu), onFermer: () => voir(null) });
    const exportVieux = nbSeances > 0 && (!dernierExport || Date.now() - dernierExport.valeur > 7 * 86400000);
    return (_jsxs("div", { children: [_jsx("div", { className: "entete", children: _jsxs("div", { children: [_jsx("div", { className: "faible", children: new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) }), _jsx("h1", { children: "Muscu" }), _jsxs("div", { className: "faible", children: ["Programme : ", actif.nom] })] }) }), exportVieux && (_jsx("div", { className: "carte petit", style: { borderColor: 'var(--alerte)' }, children: "\uD83D\uDCBE Pense \u00E0 exporter tes donn\u00E9es (R\u00E9glages) : elles ne sont que sur ce t\u00E9l\u00E9phone." })), _jsxs("div", { className: "carte pile", children: [duJour && faite(duJour) && _jsxs("div", { className: "pastille ok", children: ["\u2713 ", duJour.modele.nom, " faite aujourd\u2019hui"] }), !duJour && _jsx("div", { className: "muted", children: "Repos pr\u00E9vu aujourd\u2019hui." }), proposee ? (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("div", { className: "faible", children: proposee === duJour ? 'Séance du jour' : `Prochaine · prévue ${JOURS[proposee.jour]}` }), _jsxs("h2", { children: [proposee.modele.nom, " ", proposee.modele.sousTitre && _jsxs("span", { className: "muted", children: ["\u2014 ", proposee.modele.sousTitre] })] }), _jsxs("div", { className: "faible", children: [exercices(proposee.modele.exercices.length), " \u00B7 ", dureeTexte(proposee.modele, terminees)] })] }), _jsxs("div", { className: "ligne", children: [_jsx("button", { className: "btn primaire grand", style: { flex: 2 }, onClick: () => demarrer(proposee.modele), children: "D\u00E9marrer" }), _jsx("button", { className: "btn grand", style: { flex: 1 }, onClick: () => voir(proposee.modele), children: "Voir" })] })] })) : (_jsx("div", { children: "Semaine compl\u00E8te \uD83D\uDCAA" })), _jsxs("div", { className: "ligne wrap", children: [_jsx("button", { className: "btn", onClick: () => setChoix(true), children: "Autre s\u00E9ance" }), variante && proposee === duJour && (_jsx("button", { className: "btn", onClick: () => voir(variante), children: "\uD83C\uDFE0 Pas de salle" }))] })] }), _jsxs("div", { className: "carte", children: [_jsxs("div", { className: "ligne entre", style: { marginBottom: 10 }, children: [_jsx("h3", { children: "Cette semaine" }), _jsxs("span", { className: "faible", children: ["S\u00E9ances ", semaine.length, "/", planning.length] })] }), _jsx("div", { className: "ligne wrap", style: { marginBottom: 14 }, children: planning.map((e) => (_jsxs("span", { className: 'pastille' + (faite(e) ? ' ok' : e.jour === jour ? ' accent' : ''), children: [JOURS[e.jour], " \u00B7 ", e.modele.nom, " ", faite(e) ? '✓' : ''] }, e.modele.id + e.jour))) }), MUSCLES.map((m) => {
                        const v = volume[m.id];
                        const pct = Math.min(100, (v / m.cible) * 100);
                        const etat = v > m.cible * 1.25 ? 'trop' : v >= m.cible ? 'ok' : '';
                        return (_jsxs("div", { style: { marginBottom: 8 }, children: [_jsxs("div", { className: "ligne entre petit", children: [_jsx("span", { children: m.nom }), _jsxs("span", { className: "muted", children: [kg(v), "/", kg(m.cible)] })] }), _jsx("div", { className: 'barre ' + etat, children: _jsx("div", { style: { width: pct + '%' } }) })] }, m.id));
                    }), _jsx("div", { className: "faible", children: "S\u00E9ries dures (RPE \u2265 7). Triceps : d\u00E9velopp\u00E9s et dips compt\u00E9s \u00E0 0,5." })] }), _jsx(Poids, { pesees: pesees, aujourdhui: aujourdhui }), choix && (_jsx("div", { className: "modal-fond", onClick: () => setChoix(false), children: _jsxs("div", { className: "modal", onClick: (e) => e.stopPropagation(), children: [_jsx("h2", { style: { marginBottom: 12 }, children: "Choisir une s\u00E9ance" }), [...programmes.map((p) => ({ id: p.id, nom: p.nom, actif: p.id === actif.id, prog: p, seances: seancesDe(p) })), ...(horsProgramme.length ? [{ id: 'hors', nom: 'Hors programme', actif: false, prog: null, seances: horsProgramme }] : [])].map((g) => (_jsxs("div", { children: [_jsxs("button", { className: "groupe-repli", onClick: () => setOuvert(groupeOuvert === g.id ? '' : g.id), "aria-expanded": groupeOuvert === g.id, children: [_jsxs("span", { children: [g.nom, " ", g.actif && _jsx("span", { className: "pastille ok", style: { marginLeft: 4 }, children: "actif" }), " ", _jsxs("span", { className: "nb", children: ["(", g.seances.length, ")"] })] }), _jsx("span", { className: "muted", children: groupeOuvert === g.id ? '▾' : '▸' })] }), groupeOuvert === g.id &&
                                    g.seances.map((m) => {
                                        const jours = g.prog ? g.prog.seances.filter((e) => e.modeleId === m.id && e.jour).map((e) => JOURS[e.jour]) : [];
                                        return (_jsxs("button", { className: "liste-btn", onClick: () => voir(m), children: [_jsxs("span", { children: [_jsx("strong", { children: m.nom }), " ", m.sousTitre && _jsxs("span", { className: "muted", children: ["\u2014 ", m.sousTitre] }), _jsx("div", { className: "faible", children: dureeTexte(m, terminees) })] }), _jsx("span", { className: "faible", children: realisees(m) ? '✓' : jours.join(', ') })] }, m.id));
                                    })] }, g.id))), _jsx("div", { style: { height: 8 } }), _jsxs("button", { className: "liste-btn", onClick: () => demarrer(), children: [_jsxs("span", { children: [_jsx("strong", { children: "S\u00E9ance libre" }), " ", _jsx("span", { className: "muted", children: "\u2014 exercices ajout\u00E9s au fur et \u00E0 mesure" })] }), _jsx("span", { className: "faible", children: "+" })] }), _jsx("button", { className: "btn discret plein", onClick: () => setChoix(false), children: "Annuler" })] }) }))] }));
}
function Poids({ pesees, aujourdhui }) {
    const duJour = pesees.find((p) => p.date === aujourdhui);
    const [valeur, setValeur] = useState('');
    const recentes = pesees.filter((p) => Date.parse(p.date) > Date.now() - 7 * 86400000);
    const moyenne = recentes.length ? recentes.reduce((a, p) => a + p.poids, 0) / recentes.length : null;
    const enregistrer = async () => {
        const poids = parseFloat(valeur.replace(',', '.'));
        if (!(poids > 30 && poids < 250))
            return;
        await db.pesees.put({ date: aujourdhui, poids });
        setValeur('');
    };
    return (_jsxs("div", { className: "carte pile", children: [_jsxs("div", { className: "ligne entre", children: [_jsx("h3", { children: "Poids du jour" }), moyenne !== null && _jsxs("span", { className: "faible", children: ["moyenne 7 j : ", kg(Math.round(moyenne * 10) / 10), " kg"] })] }), duJour ? (_jsxs("div", { className: "muted", children: [kg(duJour.poids), " kg not\u00E9 aujourd\u2019hui", ' ', _jsx("button", { className: "btn discret petit", onClick: () => setValeur(String(duJour.poids)), children: "modifier" })] })) : null, (!duJour || valeur) && (_jsxs("div", { className: "ligne", children: [_jsx("input", { inputMode: "decimal", placeholder: "ex. 70,4", value: valeur, onChange: (e) => setValeur(e.target.value) }), _jsx("button", { className: "btn primaire", onClick: enregistrer, children: "OK" })] })), _jsx("div", { className: "faible", children: "Sert aussi au calcul de l\u2019e1RM des tractions et dips. Seule la moyenne compte, pas la variation d\u2019un jour." })] }));
}
