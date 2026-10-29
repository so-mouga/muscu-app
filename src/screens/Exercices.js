import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { parMuscle } from '../components/ChoixExo';
import FormExo from '../components/FormExo';
import Vignette from '../components/Vignette';
import { MUSCLES } from '../data/exercices';
import { db, exoAvecReglages } from '../db';
import { dateCourte } from '../lib/calc';
import { transition, useRetour } from '../lib/nav';
import { Detail } from './Progression';
export default function Exercices({ catalogue }) {
    const seances = useLiveQuery(() => db.seances.orderBy('debut').reverse().filter((s) => !s.enCours).toArray(), [], []);
    const reglages = useLiveQuery(() => db.reglages.toArray(), [], []);
    const [choisi, setChoisiEtat] = useState(null);
    const [formulaire, setFormulaire] = useState(null);
    const [recherche, setRecherche] = useState('');
    const [filtre, setFiltre] = useState('tous');
    const setChoisi = (id) => (transition(() => setChoisiEtat(id), id ? 'avant' : 'arriere'), window.scrollTo({ top: 0 }));
    useRetour(!!choisi, () => setChoisi(null));
    useRetour(!!formulaire, () => setFormulaire(null));
    // Dernière séance et nombre de séances par exercice
    const historique = new Map();
    for (const s of seances)
        for (const id of new Set(s.series.map((x) => x.exoId))) {
            const h = historique.get(id);
            historique.set(id, { n: (h?.n ?? 0) + 1, date: h?.date ?? s.date });
        }
    const utilisations = (id) => catalogue.modeles.filter((m) => m.exercices.some((e) => e.exoId === id)).map((m) => m.nom);
    const tous = Object.values(catalogue.exercices);
    const supprimes = tous.filter((e) => e.supprime);
    const supprimer = async (exo) => {
        const seancesModeles = utilisations(exo.id);
        const msg = seancesModeles.length
            ? `« ${exo.nom} » est utilisé dans : ${seancesModeles.join(', ')}. Le supprimer de la bibliothèque ? Il restera dans ces séances et dans ton historique.`
            : `Supprimer « ${exo.nom} » ? Ton historique est conservé, tu pourras le restaurer.`;
        if (!confirm(msg))
            return;
        await db.exercices.put({ ...exo, supprime: true });
        setChoisi(null);
    };
    const form = formulaire && (_jsx("div", { className: "modal-fond", onClick: () => setFormulaire(null), children: _jsx("div", { className: "modal", onClick: (e) => e.stopPropagation(), children: _jsx(FormExo, { initial: formulaire.exo, muscleInitial: filtre !== 'tous' && filtre !== 'recents' ? filtre : undefined, nomInitial: formulaire.exo ? undefined : recherche, onAnnuler: () => setFormulaire(null), onEnregistre: (exo) => {
                    setFormulaire(null);
                    if (!formulaire.exo)
                        setChoisi(exo.id);
                } }) }) }));
    if (choisi) {
        const exo = exoAvecReglages(catalogue.exo(choisi), reglages);
        return (_jsxs(_Fragment, { children: [_jsx(Detail, { exo: exo, seances: seances, onRetour: () => setChoisi(null), onModifier: () => setFormulaire({ exo }), onSupprimer: () => supprimer(exo) }), form] }));
    }
    const recents = tous
        .filter((e) => historique.has(e.id) && !e.supprime)
        .sort((a, b) => historique.get(b.id).date.localeCompare(historique.get(a.id).date));
    const groupes = filtre === 'recents'
        ? [{ muscle: 'recents', nom: 'Faits récemment', exos: recents.filter((e) => parMuscle([e], recherche).length) }]
        : parMuscle(tous, recherche).filter((g) => filtre === 'tous' || g.muscle === filtre);
    const ligne = (e) => {
        const h = historique.get(e.id);
        return (_jsxs("button", { className: "liste-btn", onClick: () => setChoisi(e.id), children: [_jsxs("span", { className: "avec-vignette", children: [_jsx(Vignette, { exo: e, taille: 44 }), _jsxs("span", { children: [_jsx("strong", { children: e.nom }), _jsxs("div", { className: "faible", children: [h ? `${h.n} séance${h.n > 1 ? 's' : ''} · dernière ${dateCourte(h.date)}` : 'jamais fait', e.perso ? ' · perso' : ''] })] })] }), _jsx("span", { className: "muted", children: "\u203A" })] }, e.id));
    };
    return (_jsxs("div", { children: [_jsxs("div", { className: "entete", children: [_jsx("h1", { children: "Exercices" }), _jsx("button", { className: "btn primaire", onClick: () => setFormulaire({}), children: "+ Nouveau" })] }), _jsx("input", { placeholder: "Rechercher un exercice", value: recherche, onChange: (e) => setRecherche(e.target.value), style: { marginBottom: 10 } }), _jsx("div", { className: "pills", style: { marginBottom: 4 }, children: [
                    ['tous', 'Tous'],
                    ['recents', 'Récents'],
                    ...MUSCLES.map((m) => [m.id, m.nom]),
                ].map(([id, nom]) => (_jsx("button", { className: filtre === id ? 'actif' : '', style: { padding: '0 12px', fontWeight: 600 }, onClick: () => setFiltre(id), children: nom }, id))) }), groupes.map((g) => (_jsxs("div", { children: [_jsxs("div", { className: "groupe-titre", children: [g.nom, " ", _jsxs("span", { style: { fontWeight: 400 }, children: ["\u00B7 ", g.exos.length] })] }), g.exos.map(ligne)] }, g.muscle))), groupes.every((g) => g.exos.length === 0) && _jsx("div", { className: "carte muted", style: { marginTop: 12 }, children: "Aucun exercice." }), supprimes.length > 0 && filtre === 'tous' && !recherche && (_jsxs("div", { className: "carte pile", style: { marginTop: 20 }, children: [_jsx("div", { className: "faible", children: "Exercices supprim\u00E9s" }), supprimes.map((e) => (_jsxs("div", { className: "ligne entre", children: [_jsx("span", { children: e.nom }), _jsx("button", { className: "btn petit", onClick: () => db.exercices.put({ ...e, supprime: undefined }), children: "Restaurer" })] }, e.id)))] })), form] }));
}
