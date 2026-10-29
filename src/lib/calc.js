import { EXERCICES, MUSCLES } from '../data/exercices';
export const RIR = {
    10: 'échec',
    9: '1 en réserve',
    8: '2 en réserve',
    7: '3 en réserve',
    6: '4 en réserve',
};
export const kg = (x) => x === null || x === undefined ? '—' : x.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
export function chargeTexte(exo, charge) {
    if (charge === null || charge === undefined)
        return 'à calibrer';
    if (exo.mode === 'poids_corps')
        return charge === 0 ? 'PDC' : `PDC ${charge > 0 ? '+' : '−'}${kg(Math.abs(charge))} kg`;
    if (exo.mode === 'elastique')
        return `niveau ${charge}`;
    if (exo.mode === 'par_main')
        return `${kg(charge)} kg/main`;
    return `${kg(charge)} kg`;
}
export function serieTexte(exo, s) {
    let t = `${chargeTexte(exo, s.charge)} × ${s.reps} @${kg(s.rpe)}`;
    if (s.demiReps)
        t += ` + ${s.demiReps} demi-reps`;
    if (s.suite?.length)
        t += s.type === 'drop' ? s.suite.map((x) => ` ↘ ${kg(x.charge)}×${x.reps}`).join('') : ` + ${s.suite.map((x) => x.reps).join(' + ')}`;
    return t;
}
/** Epley corrigé par le RPE. Les demi-reps ne comptent jamais. */
export function e1rm(exo, s, poidsCorps) {
    if (!exo.suivreE1rm || s.reps <= 0)
        return null;
    let charge = s.charge;
    if (exo.mode === 'poids_corps') {
        if (!poidsCorps)
            return null;
        charge = poidsCorps + s.charge;
    }
    const rtf = s.reps + (10 - s.rpe);
    return Math.round(charge * (1 + rtf / 30) * 10) / 10;
}
export const estDure = (s) => s.rpe >= 7 || s.type === 'echec' || s.type === 'serie_longue';
export function dateISO(d = new Date()) {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const j = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${j}`;
}
/** 1 = lundi … 7 = dimanche */
export const jourSemaine = (d = new Date()) => ((d.getDay() + 6) % 7) + 1;
export function lundi(d = new Date()) {
    const x = new Date(d);
    x.setDate(x.getDate() - (jourSemaine(d) - 1));
    return dateISO(x);
}
export function volumeParMuscle(seances, exercices = EXERCICES) {
    const v = Object.fromEntries(MUSCLES.map((m) => [m.id, 0]));
    for (const seance of seances)
        for (const s of seance.series) {
            const exo = exercices[s.exoId];
            if (!exo || !estDure(s))
                continue;
            v[exo.muscle] += 1;
            for (const sec of exo.secondaires ?? [])
                v[sec.muscle] += sec.coef;
        }
    return v;
}
export function duree(ms) {
    const min = Math.round(ms / 60000);
    if (min < 1)
        return '< 1 min';
    return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}
export function chrono(s) {
    const a = Math.abs(Math.round(s));
    return `${s < 0 ? '+' : ''}${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}`;
}
export const dateCourte = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
/** Repos à lancer après la série `index` (0 = première) sur `total` séries prévues aujourd'hui. */
export function reposApres(plan, index, total) {
    if (index >= total - 1 && plan.reposApres !== undefined)
        return plan.reposApres;
    return plan.series[Math.min(index, plan.series.length - 1)]?.repos ?? plan.repos;
}
/** « 2:30 », « 150 » (secondes) ou « 2 » (minutes) → secondes. null si illisible. */
export function lireDuree(texte) {
    const t = texte.trim().replace(/[.,h']/g, ':');
    const m = t.match(/^(\d+):(\d{1,2})$/);
    if (m)
        return +m[1] * 60 + +m[2];
    if (/^\d+$/.test(t))
        return +t <= 15 ? +t * 60 : +t;
    return null;
}
/** « 3:00 », ou « 2:00–3:00 » si le repos varie selon la série. */
export function reposTexte(plan) {
    const valeurs = [...new Set(plan.series.map((s) => s.repos ?? plan.repos))].sort((a, b) => a - b);
    const t = valeurs.length > 1 ? `${chrono(valeurs[0])}–${chrono(valeurs[valeurs.length - 1])}` : chrono(valeurs[0] ?? plan.repos);
    return plan.reposApres !== undefined ? `${t}, puis ${chrono(plan.reposApres)}` : t;
}
/** Durée estimée : ~1 min par série (installation comprise), les repos prévus, ~1 min par chauffe. */
/** Temps prévu (s) pour l'exercice `i` : chauffes, séries, repos entre les séries et repos qui le précède. */
export function dureePrevueExo(plans, i) {
    const p = plans[i];
    const n = p.series.length;
    let s = n * 60 + p.chauffes.length * 60;
    for (let k = 0; k < n - 1; k++)
        s += reposApres(p, k, n);
    const prec = plans[i - 1];
    if (prec)
        s += reposApres(prec, prec.series.length - 1, prec.series.length);
    return s;
}
export function dureeEstimee(m) {
    const s = m.exercices.reduce((a, _, i) => a + dureePrevueExo(m.exercices, i), 0);
    return Math.round(s / 300) * 5;
}
/** Durée réelle habituelle (min) d'une séance : médiane des 3 dernières fois, arrondie à 5 min. */
export function dureeHabituelle(modeleId, terminees) {
    const d = terminees
        .filter((s) => s.modeleId === modeleId && s.fin && s.series.length > 0)
        .sort((a, b) => b.debut - a.debut)
        .slice(0, 3)
        .map((s) => s.fin - s.debut)
        .sort((a, b) => a - b);
    if (!d.length)
        return null;
    return Math.max(5, Math.round(d[Math.floor(d.length / 2)] / 300000) * 5);
}
/** « 55 min », « 1 h 05 ». */
export const minutes = (n) => (n < 60 ? `${n} min` : `${Math.floor(n / 60)} h ${String(n % 60).padStart(2, '0')}`);
/** Durée affichée sur une séance : la durée réelle habituelle si elle existe, sinon l'estimation du plan. */
export function dureeTexte(m, terminees) {
    const h = terminees && dureeHabituelle(m.id, terminees);
    return h ? `≈ ${minutes(h)} d’habitude` : `≈ ${minutes(dureeEstimee(m))}`;
}
/** Muscu soutenue ≈ 5 MET ; poids par défaut 75 kg quand aucune pesée n'existe. */
export const MET_MUSCU = 5;
export const POIDS_DEFAUT = 75;
export function calories(ms, poids) {
    return Math.round((MET_MUSCU * (poids ?? POIDS_DEFAUT) * ms) / 3600000);
}
/**
 * Temps passé par exercice (ms) : chaque intervalle entre deux validations compte pour
 * l'exercice de la série validée (mise en place, chauffe et repos qui la précèdent compris).
 */
export function tempsParExo(seance) {
    const t = {};
    let prec = seance.debut;
    for (const s of [...seance.series].sort((a, b) => a.heure - b.heure)) {
        t[s.exoId] = (t[s.exoId] ?? 0) + Math.max(0, s.heure - prec);
        prec = Math.max(prec, s.heure);
    }
    return t;
}
/** Chauffe « 25×8 » → charge et reps ; texte libre → null. */
export function lireChauffe(c) {
    const m = /^\s*([\d.,]+)\s*(?:kg)?\s*[×x*]\s*(\d+)\s*$/i.exec(c);
    return m ? { charge: parseFloat(m[1].replace(',', '.')), reps: parseInt(m[2]) } : null;
}
/** Comparaison avec la même série la dernière fois : plus lourd, ou plus de reps à charge égale = mieux. */
export function ecartSerie(s, avant) {
    if (!avant)
        return null;
    const dc = Math.round((s.charge - avant.charge) * 100) / 100;
    const dr = s.reps - avant.reps;
    const texte = [dc ? `${dc > 0 ? '+' : '−'}${kg(Math.abs(dc))} kg` : '', dr ? `${dr > 0 ? '+' : '−'}${Math.abs(dr)} rep${Math.abs(dr) > 1 ? 's' : ''}` : '']
        .filter(Boolean)
        .join(', ');
    const sens = dc > 0 || (dc === 0 && dr > 0) ? 'mieux' : dc === 0 && dr === 0 ? 'egal' : 'moins';
    return { sens, texte: texte || 'identique' };
}
