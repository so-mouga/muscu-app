import { changerPhase, phaseA } from './objectifs'

describe('phases', () => {
  const h = changerPhase(changerPhase([], 'prise', '2026-09-01'), 'seche', '2026-10-15')

  it('la phase d’une date est la dernière commencée avant', () => {
    expect(phaseA(h, '2026-10-01')?.phase).toBe('prise')
    expect(phaseA(h, '2026-10-20')?.phase).toBe('seche')
    expect(phaseA(h, '2026-08-01')).toBeNull()
  })

  it('changer deux fois le même jour garde le dernier choix', () => {
    expect(changerPhase(h, 'maintien', '2026-10-15')).toEqual([
      { phase: 'prise', depuis: '2026-09-01' },
      { phase: 'maintien', depuis: '2026-10-15' },
    ])
  })
})
