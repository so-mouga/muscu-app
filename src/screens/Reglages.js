import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db, exporterJSON, importerJSON, setReglage } from '../db';
import { PAS_BOUTONS, PAS_BOUTONS_DEFAUT } from '../lib/pasBoutons';
import { BIPS_DEFAUT } from '../components/Minuteur';
import { debloquerSon, tic } from '../lib/appareil';
function telecharger(nom, contenu, type) {
    const url = URL.createObjectURL(new Blob([contenu], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nom;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function partagerOuTelecharger(nom, contenu, type) {
    const fichier = new File([contenu], nom, { type });
    try {
        if (navigator.canShare?.({ files: [fichier] })) {
            await navigator.share({ files: [fichier], title: nom });
            return;
        }
    }
    catch (e) {
        if (e.name === 'AbortError')
            throw e;
    }
    telecharger(nom, contenu, type);
}
export default function Reglages({ catalogue }) {
    const dernierExport = useLiveQuery(() => db.reglages.get('dernierExport'), []);
    const pasBoutons = useLiveQuery(() => db.reglages.get('pasBoutons'), []);
    const pasActuel = typeof pasBoutons?.valeur === 'number' ? pasBoutons.valeur : PAS_BOUTONS_DEFAUT;
    const bipsReglage = useLiveQuery(() => db.reglages.get('bipsRepos'), []);
    const bips = typeof bipsReglage?.valeur === 'number' ? bipsReglage.valeur : BIPS_DEFAUT;
    const [persistant, setPersistant] = useState(null);
    const [message, setMessage] = useState(null);
    const jour = new Date().toISOString().slice(0, 10);
    useEffect(() => {
        navigator.storage?.persisted?.().then(setPersistant, () => setPersistant(null));
    }, []);
    const exporter = async () => {
        try {
            await partagerOuTelecharger(`muscu-${jour}.json`, await exporterJSON(), 'application/json');
            await setReglage('dernierExport', Date.now());
            setMessage('Export prêt ✓');
        }
        catch {
            /* partage annulé */
        }
    };
    const exporterCSV = async () => {
        const seances = await db.seances.orderBy('debut').filter((s) => !s.enCours).toArray();
        const lignes = [['date', 'seance', 'exercice', 'serie', 'type', 'charge', 'reps', 'rpe', 'demi_reps', 'zone'].join(';')];
        for (const s of seances) {
            const compte = {};
            for (const x of s.series) {
                compte[x.exoId] = (compte[x.exoId] ?? 0) + 1;
                lignes.push([s.date, s.nom, catalogue.exo(x.exoId).nom, compte[x.exoId], x.type, String(x.charge).replace('.', ','), x.reps, String(x.rpe).replace('.', ','), x.demiReps ?? '', x.zone ?? ''].join(';'));
            }
        }
        try {
            await partagerOuTelecharger(`muscu-series-${jour}.csv`, lignes.join('\n'), 'text/csv');
        }
        catch {
            /* partage annulé */
        }
    };
    const importer = async (f) => {
        if (!f)
            return;
        if (!confirm('Remplacer toutes les données de ce téléphone par celles du fichier ?'))
            return;
        try {
            await importerJSON(await f.text());
            setMessage('Import terminé ✓');
        }
        catch (e) {
            setMessage('Import impossible : ' + e.message);
        }
    };
    return (_jsxs("div", { children: [_jsx("div", { className: "entete", children: _jsx("h1", { children: "R\u00E9glages" }) }), _jsxs("div", { className: "carte pile", children: [_jsx("h3", { children: "Saisie de la charge" }), _jsx("div", { className: "faible", children: "Pas des boutons \u2212/+ en s\u00E9ance et dans l\u2019objectif de la prochaine fois." }), _jsx("div", { className: "chips", children: PAS_BOUTONS.map((p) => (_jsx("button", { className: pasActuel === p ? 'actif' : '', onClick: () => setReglage('pasBoutons', p), children: p === 0 ? 'Pas de l’exercice' : `${String(p).replace('.', ',')} kg` }, p))) }), _jsx("div", { className: "faible", children: "La mont\u00E9e de charge automatique, elle, suit le pas propre \u00E0 chaque exercice (fiche de l\u2019exercice \u2192 Modifier), pour ne proposer que des charges qui existent sur la machine. \u00C9lastiques : toujours 1 niveau." })] }), _jsxs("div", { className: "carte pile", children: [_jsx("h3", { children: "Fin du repos" }), _jsx("div", { className: "faible", children: "Un bip \u00E0 chaque seconde sur les derni\u00E8res secondes du repos, pour te remettre en place avant la sonnerie." }), _jsx("div", { className: "chips", children: [0, 3, 5, 10].map((n) => (_jsx("button", { className: bips === n ? 'actif' : '', onClick: () => {
                                void setReglage('bipsRepos', n);
                                debloquerSon();
                                if (n)
                                    tic();
                            }, children: n ? `${n} dernières s` : 'Aucun bip' }, n))) })] }), _jsxs("div", { className: "carte pile", children: [_jsx("h3", { children: "Sauvegarde" }), _jsx("div", { className: "faible", children: "Tes donn\u00E9es sont stock\u00E9es uniquement sur ce t\u00E9l\u00E9phone. Exporte-les chaque semaine (Drive, mail\u2026) pour ne rien perdre en cas de changement de t\u00E9l\u00E9phone." }), _jsxs("div", { className: "petit muted", children: ["Dernier export :", ' ', dernierExport ? new Date(dernierExport.valeur).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : 'jamais'] }), _jsx("button", { className: "btn primaire plein", onClick: exporter, children: "Exporter tout (JSON)" }), _jsx("button", { className: "btn plein", onClick: exporterCSV, children: "Exporter les s\u00E9ries (CSV)" }), _jsxs("label", { className: "btn plein", children: ["Importer un export JSON", _jsx("input", { type: "file", accept: "application/json,.json", hidden: true, onChange: (e) => importer(e.target.files?.[0]) })] }), message && _jsx("div", { className: "petit", children: message })] }), _jsxs("div", { className: "carte pile", children: [_jsx("h3", { children: "Stockage" }), _jsxs("div", { className: "petit muted", children: [persistant === true && '✓ Stockage persistant accordé : le navigateur ne l’effacera pas automatiquement.', persistant === false && 'Stockage non persistant. Installe l’appli sur l’écran d’accueil (menu ⋮ → Installer) pour le renforcer.', persistant === null && 'État du stockage inconnu.'] })] }), _jsxs("div", { className: "carte pile", children: [_jsx("h3", { children: "\u00C0 propos" }), _jsx("div", { className: "faible", children: "Les suggestions de charge sont des propositions : c\u2019est toi qui d\u00E9cides. Les pas de charge se r\u00E8glent par exercice dans Progression." }), _jsx("div", { className: "faible", children: "Version 0.2" })] })] }));
}
