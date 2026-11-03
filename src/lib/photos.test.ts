import { paireDepart, poseCommune } from './photos'

describe('photos à comparer', () => {
  it('la première photo de la phase face à la dernière', () => {
    expect(paireDepart(['2026-05-04', '2026-07-27', '2026-11-02'], '2026-07-27')).toEqual({ depart: '2026-07-27', derniere: '2026-11-02' })
  })
  it('sans photo pendant la phase, ou sans phase : la toute première', () => {
    expect(paireDepart(['2026-05-04', '2026-11-02'], '2026-07-27').depart).toBe('2026-05-04')
    expect(paireDepart(['2026-05-04', '2026-11-02']).depart).toBe('2026-05-04')
  })
  it('une seule date : rien à comparer', () => {
    expect(paireDepart(['2026-11-02'])).toEqual({ derniere: '2026-11-02' })
  })
  it('une pose présente aux deux dates, sinon aucune', () => {
    expect(poseCommune(['face', 'dos'], ['dos'])).toBe('dos')
    expect(poseCommune(['profil', 'face'], ['face', 'profil'])).toBe('face')
    expect(poseCommune(['face'], ['dos'])).toBeUndefined()
  })
})
