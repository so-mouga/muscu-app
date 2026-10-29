import { AVEC_CONSIGNE } from './consignes'
import { EXERCICES } from './exercices'

it('chaque exercice de la bibliothèque a ses consignes, et rien de plus', () => {
  expect(Object.keys(EXERCICES).filter((id) => !AVEC_CONSIGNE.has(id))).toEqual([])
  expect([...AVEC_CONSIGNE].filter((id) => !EXERCICES[id])).toEqual([])
})
