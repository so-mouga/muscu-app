import type { Cycle, Seance } from '../types'
import { noterPrevu, prevuDeSemaine } from './prevu'

const seance = (date: string) => ({ id: date, date, enCours: false, series: [] }) as unknown as Seance

describe('nombre de séances prévues dans le temps', () => {
  it('ne note que les changements ; deux changements le même jour font une seule étape', () => {
    const a = noterPrevu([], '2026-10-05', 2)
    expect(a).toEqual([{ depuis: '2026-10-05', n: 2 }])
    expect(noterPrevu(a, '2026-10-12', 2)).toBe(a)
    const b = noterPrevu(a, '2026-10-12', 4)
    expect(noterPrevu(b, '2026-10-12', 3)).toEqual([{ depuis: '2026-10-05', n: 2 }, { depuis: '2026-10-12', n: 3 }])
    expect(noterPrevu(b, '2026-10-12', 2)).toEqual(a)
  })
  it('chaque semaine garde le prévu de son époque ; un changement en cours de semaine vaut pour cette semaine', () => {
    const f = prevuDeSemaine([{ depuis: '2026-10-05', n: 2 }, { depuis: '2026-10-21', n: 4 }], [], [], 4)
    expect(f('2026-10-12')).toBe(2)
    expect(f('2026-10-19')).toBe(4)
    expect(f('2026-10-26')).toBe(4)
  })
  it('avant la première étape : le cycle de l’époque, sinon les séances réellement faites', () => {
    const cycle = { debut: '2026-09-07', semaines: 2, pauses: [], deloads: [], programme: { seances: [{ modeleId: 'a', jour: 1 }, { modeleId: 'b', jour: 3 }, { modeleId: 'c', jour: 5 }] } } as unknown as Cycle
    const l = [{ depuis: '2026-10-21', n: 4 }]
    const f = prevuDeSemaine(l, [cycle], [seance('2026-10-05'), seance('2026-10-07'), seance('2026-10-12')], 4)
    expect(f('2026-09-07')).toBe(3)
    expect(f('2026-10-05')).toBe(2)
  })
  it('l’estimation ne dépasse jamais la première valeur connue', () => {
    const f = prevuDeSemaine([{ depuis: '2026-10-21', n: 1 }], [], [seance('2026-10-05'), seance('2026-10-07')], 1)
    expect(f('2026-10-05')).toBe(1)
  })
  it('rien de noté encore : le programme actuel', () => {
    expect(prevuDeSemaine([], [], [], 3)('2026-10-05')).toBe(3)
  })
})
