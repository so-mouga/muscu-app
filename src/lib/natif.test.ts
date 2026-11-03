import { joursRappel, morceaux } from './natif'

describe('rappel de séance', () => {
  it('nom de la séance de chaque jour prévu, deux séances le même jour réunies', () => {
    const m = (nom: string) => ({ nom })
    expect(joursRappel([{ modele: m('Haut A'), jour: 1 }, { modele: m('Bas A'), jour: 3 }, { modele: m('Gainage'), jour: 3 }])).toEqual({ 1: 'Haut A', 3: 'Bas A et Gainage' })
    expect(joursRappel([])).toEqual({})
  })
})

describe('morceaux', () => {
  it('recolle le texte à l’identique', () => {
    const t = 'abc'.repeat(1000)
    expect(morceaux(t, 7).join('')).toBe(t)
    expect(morceaux(t, 7).every((m) => m.length <= 7)).toBe(true)
  })
  it('ne coupe jamais un émoji en deux', () => {
    const t = 'ab💪cd💪'.repeat(50)
    for (const taille of [2, 3, 4, 5]) {
      const parties = morceaux(t, taille)
      expect(parties.join('')).toBe(t)
      for (const m of parties) expect(new TextEncoder().encode(m).includes(0xef)).toBe(false)
    }
  })
  it('un texte vide donne quand même un morceau, pour créer le fichier', () => {
    expect(morceaux('', 10)).toEqual([''])
  })
})
