import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useCatalogue } from './catalogue';
import { db } from './db';
import { transition, useRetour } from './lib/nav';
import Accueil from './screens/Accueil';
import Exercices from './screens/Exercices';
import Reglages from './screens/Reglages';
import SeanceEnCours from './screens/SeanceEnCours';
import Seances from './screens/Seances';
const ONGLETS = [
    ['accueil', '🏠', 'Accueil'],
    ['seances', '📋', 'Programmes'],
    ['exercices', '💪', 'Exercices'],
    ['reglages', '⚙️', 'Réglages'],
];
export default function App() {
    const [onglet, setOngletEtat] = useState('accueil');
    const enCours = useLiveQuery(() => db.seances.filter((s) => s.enCours).first(), [], null);
    const catalogue = useCatalogue();
    const setOnglet = (o) => {
        if (o === onglet)
            return;
        const sens = ONGLETS.findIndex((x) => x[0] === o) > ONGLETS.findIndex((x) => x[0] === onglet) ? 'avant' : 'arriere';
        transition(() => setOngletEtat(o), sens);
        window.scrollTo({ top: 0 });
    };
    // Retour Android : depuis un autre onglet, on revient à l'accueil ; depuis l'accueil, on quitte.
    useRetour(!enCours && onglet !== 'accueil', () => transition(() => setOngletEtat('accueil'), 'arriere'));
    if (enCours === null || !catalogue)
        return null; // chargement
    if (enCours)
        return _jsx(SeanceEnCours, { seance: enCours, catalogue: catalogue }, enCours.id);
    return (_jsxs(_Fragment, { children: [_jsxs("div", { children: [onglet === 'accueil' && _jsx(Accueil, { catalogue: catalogue }), onglet === 'seances' && _jsx(Seances, { catalogue: catalogue }), onglet === 'exercices' && _jsx(Exercices, { catalogue: catalogue }), onglet === 'reglages' && _jsx(Reglages, { catalogue: catalogue })] }, onglet), _jsx("nav", { className: "onglets", children: ONGLETS.map(([id, ico, nom]) => (_jsxs("button", { className: onglet === id ? 'actif' : '', onClick: () => setOnglet(id), children: [_jsx("span", { className: "ico", children: ico }), nom] }, id))) })] }));
}
