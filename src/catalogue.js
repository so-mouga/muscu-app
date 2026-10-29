import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { EXERCICES } from './data/exercices';
import { PROGRAMME } from './data/programme';
import { db } from './db';
export const ID_PROGRAMME_DEFAUT = 'principal';
export function construireCatalogue(modelesDb, exercicesDb, programmesDb, actifId) {
    const parId = new Map(PROGRAMME.map((m) => [m.id, m]));
    for (const m of modelesDb)
        parId.set(m.id, m);
    const modeles = [...parId.values()].filter((m) => !m.supprime);
    const exercices = { ...EXERCICES };
    for (const e of exercicesDb)
        exercices[e.id] = e;
    // Sans programme enregistré : le planning d'origine (jours portés par les séances) devient le premier programme.
    const programmes = programmesDb.length
        ? programmesDb
        : [{ id: ID_PROGRAMME_DEFAUT, nom: 'Recompo 4 jours', description: 'Programme de départ', seances: modeles.map((m) => ({ modeleId: m.id, jour: m.jour })) }];
    const actif = programmes.find((p) => p.id === actifId) ?? programmes[0];
    const modele = (id) => {
        const m = id ? parId.get(id) : undefined;
        return m && !m.supprime ? m : undefined;
    };
    return {
        modeles,
        modele,
        exercices,
        exo: (id) => exercices[id] ?? { id, nom: id, muscle: 'pecs', type: 'isolation', mode: 'machine', pas: 2.5, suivreE1rm: false },
        programmes,
        actif,
        planning: actif.seances
            .filter((e) => e.jour && modele(e.modeleId))
            .map((e) => ({ modele: modele(e.modeleId), jour: e.jour }))
            .sort((a, b) => a.jour - b.jour),
    };
}
/** null pendant le chargement. */
export function useCatalogue() {
    const modeles = useLiveQuery(() => db.modeles.toArray(), []);
    const exercices = useLiveQuery(() => db.exercices.toArray(), []);
    const programmes = useLiveQuery(() => db.programmes.toArray(), []);
    const actif = useLiveQuery(() => db.reglages.get('programmeActif'), [], null);
    return useMemo(() => modeles && exercices && programmes && actif !== null
        ? construireCatalogue(modeles, exercices, programmes, actif?.valeur)
        : null, [modeles, exercices, programmes, actif]);
}
