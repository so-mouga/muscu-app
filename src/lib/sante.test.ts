import { describe, expect, it } from 'vitest'
import { jugerCalories, majJour, nuitsParJour, repasDisparus } from './sante'

const h = (iso: string) => new Date(iso).getTime()

describe('nuits de la montre rangées par jour', () => {
  it('une nuit compte pour le jour du réveil, éveils déjà retirés', () => {
    expect(nuitsParJour([{ debut: h('2026-11-08T23:40:00'), fin: h('2026-11-09T07:10:00'), minutes: 430 }])).toEqual({ '2026-11-09': 7.17 })
  })

  it('une sieste qui commence à 10 h ou plus ne s’ajoute pas à la nuit, même finie avant 15 h', () => {
    const nuits = [
      { debut: h('2026-11-08T23:00:00'), fin: h('2026-11-09T07:00:00'), minutes: 480 },
      { debut: h('2026-11-09T13:30:00'), fin: h('2026-11-09T14:30:00'), minutes: 60 },
    ]
    expect(nuitsParJour(nuits)).toEqual({ '2026-11-09': 8 })
    // Un rendormissement du matin reste dans la nuit.
    expect(nuitsParJour([{ debut: h('2026-11-09T00:10:00'), fin: h('2026-11-09T05:00:00'), minutes: 290 }, { debut: h('2026-11-09T05:30:00'), fin: h('2026-11-09T08:00:00'), minutes: 150 }])).toEqual({ '2026-11-09': 7.33 })
  })

  it('une nuit coupée en deux s’additionne, une sieste l’après-midi ne compte pas', () => {
    const nuits = [
      { debut: h('2026-11-09T23:00:00'), fin: h('2026-11-10T03:00:00'), minutes: 240 },
      { debut: h('2026-11-10T03:30:00'), fin: h('2026-11-10T07:00:00'), minutes: 200 },
      { debut: h('2026-11-10T15:00:00'), fin: h('2026-11-10T15:40:00'), minutes: 40 },
    ]
    expect(nuitsParJour(nuits)).toEqual({ '2026-11-10': 7.33 })
  })

  it('une nuit écrite plusieurs fois par la montre ne compte qu’une fois : la version la plus longue', () => {
    // Vu le 11 nov. 2026 : Mi Fitness avait laissé 4 versions de la même nuit, Cran affichait 16 h 29.
    const nuits = [
      { debut: h('2026-11-11T00:08:00'), fin: h('2026-11-11T00:37:00'), minutes: 29 },
      { debut: h('2026-11-11T00:08:00'), fin: h('2026-11-11T02:59:00'), minutes: 165 },
      { debut: h('2026-11-11T00:08:00'), fin: h('2026-11-11T07:34:00'), minutes: 420 },
      { debut: h('2026-11-11T00:08:00'), fin: h('2026-11-11T06:36:00'), minutes: 375 },
    ]
    expect(nuitsParJour(nuits)).toEqual({ '2026-11-11': 7 })
  })
})

describe('ce que la montre change dans le journal', () => {
  it('les pas sont toujours mis à jour', () => {
    expect(majJour({ date: 'x', pas: 4000 }, 9000, undefined)).toEqual({ pas: 9000 })
    expect(majJour({ date: 'x', pas: 9000 }, 9000, undefined)).toBeNull()
  })

  it('le sommeil de la montre remplit une case vide et se met à jour', () => {
    expect(majJour(undefined, undefined, 7.2)).toEqual({ sommeil: 7.2, sommeilMontre: true })
    expect(majJour({ date: 'x', sommeil: 6.5, sommeilMontre: true }, undefined, 7.2)).toEqual({ sommeil: 7.2, sommeilMontre: true })
  })

  it('la montre fait foi : sa nuit remplace celle notée à la main', () => {
    expect(majJour({ date: 'x', sommeil: 6 }, undefined, 7.2)).toEqual({ sommeil: 7.2, sommeilMontre: true })
    expect(majJour({ date: 'x', sommeil: 6, sommeilMontre: false }, 12000, 7.2)).toEqual({ pas: 12000, sommeil: 7.2, sommeilMontre: true })
    expect(majJour({ date: 'x', sommeil: 7.2, sommeilMontre: true }, undefined, 7.2)).toBeNull()
  })

  it('sans nuit de la montre, la note à la main reste', () => {
    expect(majJour({ date: 'x', sommeil: 6 }, 9000, undefined)).toEqual({ pas: 9000 })
  })
})

describe('repas lus dans l’appli de repas', () => {
  it('tenu à 150 kcal près de l’objectif, sinon trop ou pas assez', () => {
    expect(jugerCalories(2870, 3000)).toBe('ok')
    expect(jugerCalories(3150, 3000)).toBe('ok')
    expect(jugerCalories(3151, 3000)).toBe('trop')
    expect(jugerCalories(2849, 3000)).toBe('pasAssez')
  })

  it('le total fait foi : il remplace le verdict noté à la main et donne le sien', () => {
    const c = majJour({ date: '2026-11-09', calories: 'ok' }, undefined, undefined, { date: '2026-11-09', kcal: 2412.6, proteines: 151.2, glucides: 280.4, lipides: 70.9 }, 3000, true)
    expect(c).toEqual({ kcal: 2413, proteines: 151, glucides: 280, lipides: 71, kcalAppli: true, calories: 'pasAssez' })
  })

  it('pas de verdict sur la journée en cours ni sans objectif', () => {
    expect(majJour(undefined, undefined, undefined, { date: 'x', kcal: 1200 }, 3000, false)?.calories).toBeUndefined()
    expect(majJour(undefined, undefined, undefined, { date: 'x', kcal: 2900 }, null, true)?.calories).toBeUndefined()
  })

  it('rien ne change si le total est le même', () => {
    const j = { date: 'x', kcal: 2900, kcalAppli: true, calories: 'ok' as const }
    expect(majJour(j, undefined, undefined, { date: 'x', kcal: 2900 }, 3000, true)).toBeNull()
  })

  it('un jour sans repas lus garde ce qui est noté à la main', () => {
    expect(majJour({ date: 'x', calories: 'trop' }, 8000, undefined, undefined, 3000, true)).toEqual({ pas: 8000 })
  })
})

describe('un repas supprimé dans l’appli de repas', () => {
  const journal = [
    { date: '2026-11-08', kcal: 400, proteines: 20, glucides: 50, lipides: 10, sodium: 900, kcalAppli: true, calories: 'pasAssez' as const, note: 'resto', pas: 9000, sommeil: 7 },
    { date: '2026-11-09', kcal: 2900, kcalAppli: true, calories: 'ok' as const },
    { date: '2026-11-10', calories: 'trop' as const },
    { date: '2026-10-01', kcal: 2500, kcalAppli: true, calories: 'ok' as const },
  ]
  const lus = { '2026-11-09': {} }
  it('le jour disparu de Health Connect perd son total et son verdict, et garde le reste', () => {
    expect(repasDisparus(journal, lus, '2026-10-29', '2026-11-11', true)).toEqual([{ date: '2026-11-08', note: 'resto', pas: 9000, sommeil: 7 }])
  })
  it('un verdict noté à la main et un jour hors de la fenêtre relue ne bougent pas', () => {
    const r = repasDisparus(journal, {}, '2026-10-29', '2026-11-11', true).map((j) => j.date)
    expect(r).toEqual(['2026-11-08', '2026-11-09'])
  })
  it('autorisation retirée ou lecture ratée : rien ne s’efface, même si tout semble avoir disparu', () => {
    expect(repasDisparus(journal, {}, '2026-10-29', '2026-11-11', false)).toEqual([])
  })
})
