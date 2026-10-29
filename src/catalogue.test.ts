import { construireCatalogue, ID_PROGRAMME_DEFAUT } from './catalogue'
import { nouveauCycle } from './lib/cycle'

describe('programmes', () => {
  it('sans programme enregistré, le planning d’origine devient le programme de départ', () => {
    const c = construireCatalogue([], [], [], undefined)
    expect(c.actif.id).toBe(ID_PROGRAMME_DEFAUT)
    expect(c.planning.map((e) => [e.jour, e.modele.id])).toEqual([
      [1, 'haut_a'],
      [2, 'bas'],
      [3, 'haut_b'],
      [5, 'haut_c'],
    ])
    // La variante maison reste dans le programme, sans jour.
    expect(c.actif.seances.some((e) => e.modeleId === 'bas_maison' && !e.jour)).toBe(true)
  })

  it('le programme actif pilote le planning ; une séance peut revenir deux fois', () => {
    const programmes = [
      { id: 'a', nom: 'A', seances: [{ modeleId: 'haut_a', jour: 1 }] },
      { id: 'b', nom: 'B', seances: [{ modeleId: 'haut_b', jour: 4 }, { modeleId: 'haut_b', jour: 2 }, { modeleId: 'bas' }] },
    ]
    const c = construireCatalogue([], [], programmes, 'b')
    expect(c.actif.nom).toBe('B')
    expect(c.planning.map((e) => [e.jour, e.modele.id])).toEqual([
      [2, 'haut_b'],
      [4, 'haut_b'],
    ])
  })

  it('une séance supprimée disparaît du planning', () => {
    const programmes = [{ id: 'a', nom: 'A', seances: [{ modeleId: 'haut_a', jour: 1 }, { modeleId: 'bas', jour: 2 }] }]
    const masquee = { id: 'bas', nom: 'Bas', sousTitre: '', exercices: [], supprime: true }
    const c = construireCatalogue([masquee], [], programmes, 'a')
    expect(c.planning.map((e) => e.modele.id)).toEqual(['haut_a'])
  })
})

describe('cycle en cours', () => {
  it('le planning suit la copie du cycle, pas la séance modifiée ensuite', () => {
    const base = construireCatalogue([], [], [], undefined)
    const m = base.planning[0].modele
    const cycle = nouveauCycle('c', base.actif, base.modele, '2026-11-02')
    const modifiee = { ...m, nom: 'Modifiée', exercices: [] }
    const c = construireCatalogue([modifiee], [], [], undefined, cycle)
    expect(c.planning[0].modele.nom).toBe(m.nom)
    expect(c.pourDemarrer(modifiee).exercices.length).toBe(m.exercices.length)
    expect(c.modele(m.id)?.nom).toBe('Modifiée')
  })
})
