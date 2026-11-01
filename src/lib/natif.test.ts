import { joursRappel } from './natif'

describe('rappel de séance', () => {
  it('nom de la séance de chaque jour prévu, deux séances le même jour réunies', () => {
    const m = (nom: string) => ({ nom })
    expect(joursRappel([{ modele: m('Haut A'), jour: 1 }, { modele: m('Bas A'), jour: 3 }, { modele: m('Gainage'), jour: 3 }])).toEqual({ 1: 'Haut A', 3: 'Bas A et Gainage' })
    expect(joursRappel([])).toEqual({})
  })
})
