import { EXERCICES } from '../data/exercices'
import type { Cycle } from '../types'
import { appliquerEcart, avecPriorites, changerSemaine, debutCycle, regimeSemaine, cibles, deloadMaintenant, ecartCycle, garderEcart, prevuLe, etatCycle, lundiDe, mettreEnPause, nomCycle, nouveauCycle, planDeload, suggestionDeload } from './cycle'

const cycle = (x: Partial<Cycle> = {}): Cycle => ({
  id: 'c',
  programmeId: 'p',
  programme: { id: 'p', nom: 'P', seances: [] },
  modeles: [],
  debut: '2026-11-02',
  semaines: 6,
  deloads: [6],
  pauses: [],
  volume: {},
  ...x,
})

describe('semaine du cycle', () => {
  it('nom : le sien, sinon celui du programme', () => {
    expect(nomCycle(cycle({ nom: 'Bloc bras' }))).toBe('Bloc bras')
    expect(nomCycle(cycle({ nom: '  ' }))).toBe('P')
    expect(nomCycle(cycle())).toBe('P')
  })
  it('compte les semaines depuis le lundi de départ', () => {
    expect(etatCycle(cycle(), '2026-11-02').n).toBe(1)
    expect(etatCycle(cycle(), '2026-11-08').n).toBe(1)
    expect(etatCycle(cycle(), '2026-11-09').n).toBe(2)
    expect(etatCycle(cycle(), '2026-12-07')).toMatchObject({ n: 6, deload: true, fini: false })
    expect(etatCycle(cycle(), '2026-12-14').fini).toBe(true)
    expect(etatCycle(cycle(), '2026-10-30').n).toBe(0)
  })
  it('une semaine en pause décale la suite', () => {
    const c = mettreEnPause(cycle(), '2026-11-18')
    expect(etatCycle(c, '2026-11-18')).toMatchObject({ pause: true, deload: false })
    expect(etatCycle(c, '2026-11-23').n).toBe(3)
    expect(lundiDe(c, 3)).toBe('2026-11-23')
    expect(etatCycle(c, '2026-12-14')).toMatchObject({ n: 6, deload: true })
  })
  it('déload maintenant : la semaine devient un déload et la suite glisse', () => {
    const c = deloadMaintenant(cycle(), '2026-11-16')
    expect(c.semaines).toBe(7)
    expect(c.deloads).toEqual([3, 7])
    expect(etatCycle(c, '2026-11-16').deload).toBe(true)
  })
})

describe('déload', () => {
  it('moitié des séries, RPE 6-7, sans finisseur', () => {
    const p = planDeload({ exoId: 'x', repos: 120, series: [9, 9, 9, 10].map((rpe) => ({ repsMin: 8, repsMax: 12, rpe })), chauffes: [], finisseur: true, charge: 40 })
    expect(p.series.map((s) => s.rpe)).toEqual([7, 7])
    expect(p.finisseur).toBe(false)
  })
  it('charges −10 % arrondies au pas', () => {
    const s = suggestionDeload(EXERCICES.butterfly, { decision: 'pareil', charges: [50, 32.5, null], reps: [10, 10, 10], message: '' })
    expect(s.charges).toEqual([45, 30, null])
  })
  it('petits haltères : jamais 0 kg ni la moitié de la charge ; le message le dit', () => {
    const allege = (c: number) => suggestionDeload(EXERCICES.elevation_laterale_halteres, { decision: 'pareil', charges: [c], reps: [15], message: '' })
    expect(allege(2).charges).toEqual([2])
    expect(allege(2).message).toContain('même charge')
    expect(allege(4).charges).toEqual([4])
    expect(allege(8).charges).toEqual([6])
    expect(allege(12).charges).toEqual([10])
    expect(allege(12).message).toContain('−10 %')
  })
  it('lest au poids du corps : peut revenir à zéro', () => {
    expect(suggestionDeload(EXERCICES.tractions, { decision: 'pareil', charges: [2.5], reps: [6], message: '' }).charges).toEqual([0])
  })
})

describe('objectifs de volume', () => {
  it('priorité du cycle : +4 séries le temps du cycle, objectifs perso intacts', () => {
    const v = cibles({ biceps: 6, pecs: 16 })
    const c = cycle({ priorites: ['biceps'] })
    expect(avecPriorites(v, [c], '2026-11-10')).toMatchObject({ biceps: 10, pecs: 16 })
    expect(avecPriorites(v, [c], '2026-12-13').biceps).toBe(10)
    expect(avecPriorites(v, [c], '2026-12-14').biceps).toBe(6)
    expect(avecPriorites(v, [cycle({ priorites: ['biceps'], fin: '2026-11-20' })], '2026-11-21').biceps).toBe(6)
    expect(v.biceps).toBe(6)
  })
  it('personnels ; avant tout réglage, ceux du cycle ou du programme actif', () => {
    const p = { id: 'p', nom: 'P', seances: [], volume: { pecs: 12, dos: 14 } }
    const c = nouveauCycle('c', p, () => undefined, '2026-11-02')
    expect(cibles({ pecs: 10 }, c, p)).toMatchObject({ pecs: 10, dos: 0 })
    expect(cibles(undefined, c).pecs).toBe(12)
    expect(cibles(undefined, undefined, p).biceps).toBe(0)
    // Rien de réglé nulle part : valeurs par défaut de l'appli
    expect(cibles(undefined, undefined, { id: 'q', nom: 'Q', seances: [] }).pecs).toBe(10)
  })
})

describe('prévu un jour donné', () => {
  const m = { id: 'a', nom: 'Haut A', sousTitre: '', exercices: [] }
  const planning = [{ modele: m, jour: 1 }]
  const c = nouveauCycle('c', { id: 'p', nom: 'P', seances: [] }, () => undefined, '2026-11-02', 6, [6])

  it('séance du lundi, semaine du cycle et déload', () => {
    expect(prevuLe(planning, c, '2026-11-02')).toMatchObject({ seances: [m], semaine: 1, total: 6, deload: false })
    expect(prevuLe(planning, c, '2026-12-07')).toMatchObject({ seances: [m], semaine: 6, deload: true })
    expect(prevuLe(planning, c, '2026-11-03').seances).toEqual([])
  })

  it('rien avant ni après le cycle ; sans cycle, le planning du programme', () => {
    expect(prevuLe(planning, c, '2026-10-26').seances).toEqual([])
    expect(prevuLe(planning, c, '2026-12-14').seances).toEqual([])
    expect(prevuLe(planning, undefined, '2027-03-01').seances).toEqual([m])
  })
})

describe('programme modifié pendant le cycle', () => {
  const seance = (id: string, nom = id) => ({ id, nom, sousTitre: '', exercices: [] })
  const base = { id: 'p', nom: 'Prog', seances: [{ modeleId: 'a', jour: 1 }, { modeleId: 'b', jour: 2 }] }
  const biblio = { a: seance('a'), b: seance('b') } as Record<string, ReturnType<typeof seance>>
  const lire = (l: Record<string, ReturnType<typeof seance>>) => (id: string) => l[id]
  const cycle = () => nouveauCycle('c', base, lire(biblio), '2026-10-19')

  it('rien de changé : aucun écart, même si les champs ou les séances sont dans un autre ordre', () => {
    expect(ecartCycle(cycle(), base, lire(biblio))).toBeUndefined()
    const ordre = { ...base, seances: [...base.seances].reverse() }
    const champs = { a: { exercices: [], sousTitre: '', nom: 'a', id: 'a' }, b: seance('b') }
    expect(ecartCycle(cycle(), ordre, lire(champs))).toBeUndefined()
  })

  it('un jour ou une séance modifiée se voit, un jour revenu en arrière ne se voit plus', () => {
    const c = cycle()
    const jeudi = { ...base, seances: [{ modeleId: 'a', jour: 1 }, { modeleId: 'b', jour: 4 }] }
    expect(ecartCycle(c, jeudi, lire(biblio))).toEqual({ planning: true, seances: [] })
    expect(ecartCycle(c, base, lire({ ...biblio, a: seance('a', 'Haut') }))?.seances.map((s) => s.nom)).toEqual(['Haut'])
    expect(ecartCycle(c, base, lire(biblio))).toBeUndefined()
  })

  it('une séance retirée du programme se voit ; une séance supprimée de la bibliothèque ne compte pas', () => {
    const sansB = { ...base, seances: [{ modeleId: 'a', jour: 1 }] }
    expect(ecartCycle(cycle(), sansB, lire(biblio))?.planning).toBe(true)
    expect(ecartCycle(cycle(), base, lire({ a: seance('a') }))).toBeUndefined()
  })

  it('un changement refusé n’est plus proposé et n’entre pas quand on en accepte un autre', () => {
    let c = cycle()
    const modifiee = { ...biblio, a: seance('a', 'Haut') }
    c = { ...c, ...garderEcart(c, ecartCycle(c, base, lire(modifiee))!, base) }
    expect(ecartCycle(c, base, lire(modifiee))).toBeUndefined()

    const jeudi = { ...base, seances: [{ modeleId: 'a', jour: 1 }, { modeleId: 'b', jour: 4 }] }
    const e = ecartCycle(c, jeudi, lire(modifiee))!
    expect(e).toEqual({ planning: true, seances: [] })
    c = { ...c, ...appliquerEcart(c, e, jeudi, lire(modifiee)) }
    expect(c.programme.seances[1].jour).toBe(4)
    expect(c.modeles.find((m) => m.id === 'a')!.nom).toBe('a')
    expect(ecartCycle(c, jeudi, lire(modifiee))).toBeUndefined()
  })

  it('une séance refusée puis modifiée encore est proposée de nouveau, et le refus s’efface une fois appliquée', () => {
    let c = cycle()
    const v1 = { ...biblio, a: seance('a', 'Haut') }
    c = { ...c, ...garderEcart(c, ecartCycle(c, base, lire(v1))!, base) }
    const v2 = { ...biblio, a: seance('a', 'Haut 2') }
    const e = ecartCycle(c, base, lire(v2))!
    expect(e.seances[0].nom).toBe('Haut 2')
    c = { ...c, ...appliquerEcart(c, e, base, lire(v2)) }
    expect(c.modeles.find((m) => m.id === 'a')!.nom).toBe('Haut 2')
    expect(c.refus).toBeUndefined()
  })

  it('appliquer ajoute la copie d’une nouvelle séance et retire celle qui n’y est plus', () => {
    const c = cycle()
    const l = { ...biblio, n: seance('n') }
    const autre = { ...base, seances: [{ modeleId: 'a', jour: 1 }, { modeleId: 'n', jour: 3 }] }
    const r = appliquerEcart(c, ecartCycle(c, autre, lire(l))!, autre, lire(l))
    expect(r.modeles.map((m) => m.id)).toEqual(['a', 'n'])
  })
})

describe('début d’un cycle', () => {
  // Mardi 3 novembre 2026 : le lundi de la semaine est le 2.
  it('cette semaine s’il reste un jour de séance, aujourd’hui compris', () => {
    expect(debutCycle([1, 3, 5], '2026-11-03')).toBe('2026-11-02')
    expect(debutCycle([1, 2], '2026-11-03')).toBe('2026-11-02')
  })
  it('la semaine suivante si tous les jours sont passés', () => {
    expect(debutCycle([1, 3], '2026-11-07')).toBe('2026-11-09')
  })
  it('sans jour : cette semaine', () => {
    expect(debutCycle([], '2026-11-08')).toBe('2026-11-02')
  })
})

describe('changer une semaine', () => {
  const seance = { id: 'a', nom: 'A', sousTitre: '', exercices: [] }
  const c0 = () => nouveauCycle('c', { id: 'p', nom: 'P', seances: [{ modeleId: 'a', jour: 1 }] }, () => seance, '2026-10-19', 6, [6])

  it('une pause à venir décale la suite, l’annuler remet tout comme avant', () => {
    const a = c0()
    const b = changerSemaine(a, '2026-11-09', 'pause')
    expect(regimeSemaine(b, '2026-11-09')).toBe('pause')
    expect(etatCycle(b, '2026-11-16').n).toBe(4)
    expect(etatCycle(b, '2026-11-30')).toMatchObject({ n: 6, deload: true, fini: false })
    const r = changerSemaine(b, '2026-11-09', 'normale')
    expect(r.pauses).toEqual([])
    expect(etatCycle(r, '2026-11-23').n).toBe(6)
  })

  it('alléger puis annuler revient au cycle de départ', () => {
    const a = c0()
    const b = changerSemaine(a, '2026-11-02', 'allegee')
    expect(b).toMatchObject({ semaines: 7, deloads: [3, 7] })
    expect(changerSemaine(b, '2026-11-02', 'normale')).toMatchObject({ semaines: 6, deloads: [6] })
  })

  it('la dernière semaine allégée redevient normale sans raccourcir le cycle', () => {
    expect(changerSemaine(c0(), '2026-11-23', 'normale')).toMatchObject({ semaines: 6, deloads: [] })
  })

  it('passer d’allégée à pause, et de pause à allégée', () => {
    const b = changerSemaine(changerSemaine(c0(), '2026-11-02', 'allegee'), '2026-11-02', 'pause')
    expect(b).toMatchObject({ semaines: 6, deloads: [6], pauses: ['2026-11-02'] })
    expect(changerSemaine(b, '2026-11-02', 'allegee')).toMatchObject({ semaines: 7, deloads: [3, 7], pauses: [] })
  })

  it('même régime : rien ne change', () => {
    const a = c0()
    expect(changerSemaine(a, '2026-11-02', 'normale')).toBe(a)
  })
})
