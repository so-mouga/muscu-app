import Dexie from 'dexie';
import { MODELES } from './data/programme';
export const db = new Dexie('muscu');
db.version(1).stores({
    seances: 'id, date, debut, enCours',
    pesees: 'date',
    reglages: 'cle',
});
db.version(2)
    .stores({ modeles: 'id', exercices: 'id' })
    .upgrade((tx) => tx
    .table('seances')
    .toCollection()
    .modify((s) => {
    s.exercices ??= structuredClone(MODELES[s.modeleId ?? '']?.exercices ?? []);
    s.ajustSeries ??= {};
}));
db.version(3).stores({ programmes: 'id' });
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
/** Séries de travail d'un exercice, par séance terminée, la plus récente en premier. */
export function historiqueDe(seances, exoId) {
    return seances.map((s) => s.series.filter((x) => x.exoId === exoId)).filter((h) => h.length > 0);
}
export const setReglage = (cle, valeur) => db.reglages.put({ cle, valeur });
/** Exercice avec le pas de charge personnalisé éventuel. */
export function exoAvecReglages(exo, reglages) {
    const pas = reglages.find((r) => r.cle === `pas:${exo.id}`)?.valeur;
    return typeof pas === 'number' && pas > 0 ? { ...exo, pas } : exo;
}
export async function dernierPoids() {
    const p = await db.pesees.orderBy('date').last();
    return p?.poids;
}
export async function demanderStockagePersistant() {
    try {
        if (navigator.storage?.persist && !(await navigator.storage.persisted()))
            await navigator.storage.persist();
    }
    catch {
        /* non disponible */
    }
}
// --- Export / import -------------------------------------------------------
export async function exporterJSON() {
    const data = {
        app: 'muscu',
        version: 3,
        exporteLe: new Date().toISOString(),
        seances: await db.seances.toArray(),
        pesees: await db.pesees.toArray(),
        reglages: await db.reglages.toArray(),
        modeles: await db.modeles.toArray(),
        exercices: await db.exercices.toArray(),
        programmes: await db.programmes.toArray(),
    };
    return JSON.stringify(data);
}
export async function importerJSON(texte) {
    const data = JSON.parse(texte);
    if (data?.app !== 'muscu' || !Array.isArray(data.seances))
        throw new Error('Fichier non reconnu');
    const tables = [db.seances, db.pesees, db.reglages, db.modeles, db.exercices, db.programmes];
    await db.transaction('rw', tables, async () => {
        await Promise.all(tables.map((t) => t.clear()));
        await db.seances.bulkPut(data.seances.map((s) => ({
            ...s,
            exercices: s.exercices ?? structuredClone(MODELES[s.modeleId ?? '']?.exercices ?? []),
            ajustSeries: s.ajustSeries ?? {},
        })));
        await db.pesees.bulkPut(data.pesees ?? []);
        await db.reglages.bulkPut(data.reglages ?? []);
        await db.modeles.bulkPut(data.modeles ?? []);
        await db.exercices.bulkPut(data.exercices ?? []);
        await db.programmes.bulkPut(data.programmes ?? []);
    });
}
