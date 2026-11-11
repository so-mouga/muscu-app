import { chargeBaisse, consigne } from './finisseur'

describe('finisseur : la consigne avant la série', () => {
  it('drop set : la charge après la baisse est écrite, au palier de la machine', () => {
    expect(chargeBaisse(20, 2)).toBe(16)
    expect(chargeBaisse(60, 5)).toBe(45)
    expect(consigne('drop', '15 kg')).toBe('Va jusqu’à l’échec, baisse à 15 kg et repars tout de suite, sans repos.')
  })
  it('drop set sans charge connue : un quart en moins', () => {
    expect(consigne('drop')).toMatch(/baisse la charge d’un quart/)
  })
  it('une phrase pour chaque technique', () => {
    expect(consigne('rest_pause')).toMatch(/15 secondes/)
    expect(consigne('partielles')).toMatch(/demi-reps/)
    expect(consigne('echec')).toMatch(/rep propre/)
  })
})
