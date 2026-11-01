import { secondairesProposes } from './secondaires'

describe('muscles secondaires proposés', () => {
  const noms = (l: { muscle: string }[]) => l.map((s) => s.muscle).sort()
  it('comme les exercices de base de même muscle et même type', () => {
    expect(noms(secondairesProposes('pecs', 'compose'))).toEqual(['epaule_avant', 'triceps'])
    expect(noms(secondairesProposes('quadriceps', 'compose'))).toEqual(['fessiers'])
    expect(noms(secondairesProposes('ischios', 'compose'))).toEqual(['fessiers', 'lombaires'])
  })
  it('tirage dos et isolation : rien', () => {
    expect(secondairesProposes('dos', 'compose')).toEqual([])
    expect(secondairesProposes('biceps', 'isolation')).toEqual([])
    expect(secondairesProposes('mollets', 'compose')).toEqual([])
  })
  it('chaque secondaire compte pour une demi-série', () => {
    expect(secondairesProposes('pecs', 'compose').every((s) => s.coef === 0.5)).toBe(true)
  })
})
