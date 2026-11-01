import { conseilRepas } from './journal'

describe('journal du matin', () => {
  it('conseil d’assiette selon la phase', () => {
    expect(conseilRepas('prise', true)).toMatch(/un peu plus/)
    expect(conseilRepas(undefined, true)).toBeNull()
    expect(conseilRepas('seche', true, true)).toMatch(/Ne réduis pas tes repas/)
  })
})
