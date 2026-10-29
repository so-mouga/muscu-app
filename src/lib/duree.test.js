import { MODELES } from '../data/programme';
import { dureeEstimee } from '../lib/calc';
describe('durée estimée', () => {
    it('cohérente avec le cahier des charges', () => {
        const d = (id) => dureeEstimee(MODELES[id]);
        console.log('durées :', ['haut_a', 'bas', 'haut_b', 'haut_c'].map((id) => `${id} ${d(id)} min`).join(', '));
        expect(d('haut_a')).toBeGreaterThanOrEqual(60);
        expect(d('haut_a')).toBeLessThanOrEqual(80);
        expect(d('bas')).toBeGreaterThanOrEqual(45);
        expect(d('bas')).toBeLessThanOrEqual(65);
    });
});
