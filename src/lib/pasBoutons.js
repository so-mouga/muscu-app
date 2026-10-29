import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
/** Pas des boutons −/+ de charge (kg) ; 0 = le pas de l'exercice. */
export const PAS_BOUTONS = [0.5, 1, 2.5, 0];
export const PAS_BOUTONS_DEFAUT = 1;
/**
 * Pas des boutons −/+ de saisie. Distinct du pas de l'exercice, qui sert à la montée de charge
 * automatique : on saisit finement ce qu'on a soulevé, la progression suit le vrai pas de la machine.
 */
export function usePasBoutons() {
    const r = useLiveQuery(() => db.reglages.get('pasBoutons'), []);
    const reglage = typeof r?.valeur === 'number' ? r.valeur : PAS_BOUTONS_DEFAUT;
    return (exo) => (exo.mode === 'elastique' || reglage === 0 ? exo.pas : reglage);
}
