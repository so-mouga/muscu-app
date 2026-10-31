import { EXERCICES } from '../data/exercices'
import { MODELES } from '../data/programme'
import type { Serie, TypeSerie } from '../types'
import { aBattre, conseil, hausse, monterMaintenant, pareil, raisonPareil, suggere, suggestionPour } from './progression'

const planDe = (modele: string, exoId: string) => MODELES[modele].exercices.find((e) => e.exoId === exoId)!

/** "15@8" → série normale ; "!11@10" → série d'échec. */
function seance(charge: number | number[], ...series: string[]): Serie[] {
  return series.map((txt, i) => {
    const echec = txt.startsWith('!')
    const [reps, rpe] = txt.replace('!', '').split('@').map(Number)
    return {
      id: String(i),
      exoId: 'x',
      type: (echec ? 'echec' : 'normale') as TypeSerie,
      charge: Array.isArray(charge) ? charge[i] : charge,
      reps,
      rpe,
      heure: 0,
    }
  })
}

const butterfly = (...s: Serie[][]) => suggere(EXERCICES.butterfly, planDe('haut_a', 'butterfly'), s)
const smith = (...s: Serie[][]) => suggere(EXERCICES.smith_incline, planDe('haut_a', 'smith_incline'), s)

describe('cas de test du cahier des charges (5.6)', () => {
  it('butterfly au sommet, échec correct → augmenter', () => {
    const r = butterfly(seance(30, '15@8', '15@8', '15@9', '!11@10'))
    expect(r.decision).toBe('augmenter')
    expect(r.charges).toEqual([32.5, 32.5, 32.5, 32.5])
    expect(r.reps).toEqual([12, 12, 12, 12])
  })

  it('butterfly en cours de fourchette → +1 rep, même charge', () => {
    const r = butterfly(seance(30, '14@8', '13@8', '12@9', '!10@10'))
    expect(r.decision).toBe('plus_une_rep')
    expect(r.charges).toEqual([30, 30, 30, 30])
    expect(r.reps).toEqual([14, 14, 13, 10])
  })

  it('butterfly RPE trop haut → consolider', () => {
    expect(butterfly(seance(30, '15@9', '14@9', '13@9', '!10@10')).decision).toBe('consolider')
  })

  it('butterfly garde-fou d’échec → consolider', () => {
    const r = butterfly(seance(30, '15@8', '15@8', '15@9', '!8@10'))
    expect(r.decision).toBe('consolider')
    expect(r.message).toMatch(/échec/)
  })

  it('smith au sommet au RPE visé → augmenter (charge par série conservée)', () => {
    const r = smith(seance([50, 52.5, 52.5], '10@7', '10@8', '10@8'))
    expect(r.decision).toBe('augmenter')
    expect(r.charges).toEqual([52.5, 55, 55])
    expect(r.reps).toEqual([8, 8, 8])
  })

  it('smith écart d’un point toléré → augmenter', () => {
    expect(smith(seance(52.5, '10@8', '10@8', '10@8')).decision).toBe('augmenter')
  })

  it('smith RPE trop haut → consolider', () => {
    expect(smith(seance(52.5, '9@9', '8@9', '8@9')).decision).toBe('consolider')
  })

  it('smith sous la borne basse une fois → consolider', () => {
    expect(smith(seance(52.5, '7@9', '7@9', '6@10')).decision).toBe('consolider')
  })

  it('smith sous la borne basse deux séances de suite → baisser', () => {
    const r = smith(seance(52.5, '7@9', '7@9', '6@10'), seance(52.5, '7@9', '7@8', '7@9'))
    expect(r.decision).toBe('baisser')
    expect(r.charges).toEqual([50, 50, 50])
  })
})

describe('règles complémentaires', () => {
  it('sans historique, charge à calibrer → aucune charge proposée', () => {
    const r = suggere(EXERCICES.butterfly_haut, planDe('haut_c', 'butterfly_haut'), [])
    expect(r.decision).toBe('calibrer')
    expect(r.charges).toEqual([null, null, null])
  })

  it('sans historique → charges de départ du programme', () => {
    expect(smith().charges).toEqual([50, 52.5, 52.5])
  })

  it('gros saut de charge (15 kg, pas 2,5) → confirmation sur deux séances', () => {
    const plan = planDe('haut_a', 'elevation_poulie')
    const top = seance(15, '15@9', '15@9', '15@9')
    expect(suggere(EXERCICES.elevation_poulie, plan, [top]).decision).toBe('consolider')
    expect(suggere(EXERCICES.elevation_poulie, plan, [top, top]).decision).toBe('augmenter')
  })

  it('poids du corps : +2,5 kg de lest au sommet', () => {
    const r = suggere(EXERCICES.tractions, planDe('haut_b', 'tractions'), [seance(0, '12@8', '12@8', '12@8')])
    expect(r.decision).toBe('augmenter')
    expect(r.charges).toEqual([2.5, 2.5, 2.5])
  })

  it('haltères fixes à 24 kg → pas de montée au-delà du matériel', () => {
    const r = suggere(EXERCICES.squat_bulgare, planDe('bas_maison', 'squat_bulgare'), [seance(24, '10@8', '10@8', '10@8')])
    expect(r.decision).toBe('consolider')
    expect(r.charges).toEqual([24, 24, 24])
  })
})

describe('objectif manuel', () => {
  const seanceAvec = (series: Serie[], objectifs?: Record<string, { charges: (number | null)[]; reps: number[] }>) => ({
    id: 's',
    date: '2026-10-28',
    nom: 'Haut A',
    debut: 0,
    enCours: false,
    exercices: [],
    chauffes: {},
    notes: {},
    ajustSeries: {},
    series: series.map((x) => ({ ...x, exoId: 'butterfly' })),
    objectifs,
  })
  const plan = planDe('haut_a', 'butterfly')

  it('remplace la proposition automatique', () => {
    const s = seanceAvec(seance(30, '14@8', '13@8', '12@9', '!10@10'), { butterfly: { charges: [32.5, 32.5, 32.5], reps: [12, 12, 12] } })
    const r = suggestionPour(EXERCICES.butterfly, plan, [s])
    expect(r.decision).toBe('manuel')
    // Le plan a 4 séries : la dernière valeur saisie est reprise.
    expect(r.charges).toEqual([32.5, 32.5, 32.5, 32.5])
    expect(r.reps).toEqual([12, 12, 12, 12])
  })

  it('sans objectif, on refait exactement pareil', () => {
    const s = seanceAvec(seance([30, 30, 32.5, 32.5], '14@8', '13@8', '12@9', '!10@10'))
    const r = suggestionPour(EXERCICES.butterfly, plan, [s])
    expect(r.decision).toBe('pareil')
    expect(r.charges).toEqual([30, 30, 32.5, 32.5])
    expect(r.reps).toEqual([14, 13, 12, 10])
  })

  it('sans objectif ni historique → charges de départ du programme', () => {
    expect(suggestionPour(EXERCICES.butterfly, plan, []).decision).not.toBe('pareil')
  })

  it('progression automatique (réglage) : la double progression s’applique', () => {
    const s = seanceAvec(seance(30, '14@8', '13@8', '12@9', '!10@10'))
    expect(suggestionPour(EXERCICES.butterfly, plan, [s], true).decision).toBe('plus_une_rep')
  })

  it('seul l’objectif de la dernière séance compte', () => {
    const ancienne = seanceAvec(seance(30, '14@8'), { butterfly: { charges: [40], reps: [8] } })
    const recente = seanceAvec(seance(30, '15@8', '15@8', '15@9', '!11@10'))
    expect(suggestionPour(EXERCICES.butterfly, plan, [recente, ancienne], true).decision).toBe('augmenter')
  })
})

describe('objectif à battre', () => {
  const derniere = seance(30, '12@8', '12@8')
  const sugg = (charges: number[], reps: number[]) => ({ decision: 'manuel' as const, charges, reps, message: '' })
  it('charge en hausse', () => {
    expect(hausse(EXERCICES.butterfly, sugg([32.5, 30], [10, 12]), derniere, 0)).toBe('+2,5 kg')
    expect(hausse(EXERCICES.butterfly, sugg([32.5, 30], [10, 12]), derniere, 1)).toBeNull()
  })
  it('reps en hausse à charge égale', () => {
    expect(hausse(EXERCICES.butterfly, sugg([30, 30], [12, 13]), derniere, 1)).toBe('+1 rep')
  })
  it('refaire pareil : rien à battre', () => {
    expect(aBattre(EXERCICES.butterfly, sugg([30, 30], [12, 12]), derniere)).toBe(false)
    expect(aBattre(EXERCICES.butterfly, sugg([30, 30], [12, 12]), undefined)).toBe(false)
  })
})

describe('déload', () => {
  it('une séance de déload ne sert pas de référence', () => {
    const base = { id: 's', date: '2026-10-28', nom: 'H', debut: 0, enCours: false, exercices: [], chauffes: {}, notes: {}, ajustSeries: {} }
    const avant = { ...base, series: seance(30, '12@8', '12@8').map((x) => ({ ...x, exoId: 'butterfly' })) }
    const deload = { ...base, id: 'd', deload: true, series: seance(27.5, '12@6').map((x) => ({ ...x, exoId: 'butterfly' })) }
    expect(suggestionPour(EXERCICES.butterfly, planDe('haut_a', 'butterfly'), [deload, avant]).charges[0]).toBe(30)
  })
})

describe('séance incomplète', () => {
  it('les séries pas faites gardent la fois d’avant, pas la dernière série faite', () => {
    const plan = planDe('haut_a', 'butterfly')
    const incomplete = seance(30, '9@8')
    const avant = seance(30, '12@8', '11@8', '10@9', '!9@10')
    const r = pareil(EXERCICES.butterfly, plan, [incomplete, avant])
    expect(r.reps).toEqual([9, 11, 10, 9])
  })
  it('charge des séries pas faites = dernière série faite (pas de retour au poids du corps)', () => {
    const plan = planDe('haut_a', 'butterfly')
    const r = pareil(EXERCICES.butterfly, plan, [seance(40, '8@8', '8@8')])
    expect(r.charges).toEqual([40, 40, 40, 40])
    expect(r.reps.slice(0, 2)).toEqual([8, 8])
  })

  it('sans fois d’avant : le programme pour les séries manquantes', () => {
    const plan = planDe('haut_a', 'butterfly')
    const r = pareil(EXERCICES.butterfly, plan, [seance(30, '9@8')])
    expect(r.reps[0]).toBe(9)
    expect(r.reps[1]).toBe(plan.series[1].repsMin)
  })
})

describe('conseil de surcharge (proposition, jamais automatique)', () => {
  const plan = planDe('haut_a', 'butterfly')
  const fixe = { ...plan, series: plan.series.map((x) => ({ ...x, repsMax: x.repsMin })) }

  it('fourchette atteinte partout → monter la charge', () => {
    const r = conseil(EXERCICES.butterfly, plan, [seance(30, '15@8', '15@8', '15@9', '!11@10')])
    expect(r?.decision).toBe('augmenter')
    expect(r?.message).toMatch(/monte la charge/)
  })

  it('reps fixes, rien de fait ou on consolide → pas de conseil', () => {
    expect(conseil(EXERCICES.butterfly, fixe, [seance(30, '15@8', '15@8', '15@9', '!11@10')])).toBeNull()
    expect(conseil(EXERCICES.butterfly, plan, [])).toBeNull()
    expect(conseil(EXERCICES.butterfly, plan, [seance(30, '14@10', '13@10', '12@10', '!10@10')])).toBeNull()
  })

  it('montée de plus de 10 % : conseil de confirmer d’abord au haut de la fourchette', () => {
    const plan3 = { ...plan, charge: 15, finisseur: false, series: plan.series.slice(0, 3) }
    const r = conseil(EXERCICES.butterfly, plan3, [seance(15, '20@7')])
    expect(r?.decision).toBe('consolider')
    expect(r?.reps).toEqual([15, 15, 15])
    expect(r?.message).toMatch(/pour confirmer/)
  })

  it('série ratée sous le bas → même charge, vise le bas (même sans fourchette)', () => {
    const bas = plan.series[0].repsMin
    const r = conseil(EXERCICES.butterfly, plan, [seance(30, `${bas}@8`, `${bas - 3}@10`, `${bas - 4}@10`, '!8@10')])
    expect(r?.charges.slice(0, 3)).toEqual([30, 30, 30])
    expect(r?.reps.slice(0, 3)).toEqual([bas, bas, bas])
    expect(r?.message).toMatch(new RegExp(`vise ${bas}`))
    expect(conseil(EXERCICES.butterfly, fixe, [seance(30, `${bas - 2}@10`, `${bas - 2}@10`, `${bas - 2}@10`, '!8@10')])?.reps[0]).toBe(bas)
  })

  it('pas de conseil : la raison est dite', () => {
    expect(raisonPareil(EXERCICES.butterfly, plan, [seance(30, '14@10', '13@10', '12@10', '!10@10')])).toMatch(/Plus dur que prévu/)
    expect(raisonPareil(EXERCICES.butterfly, plan, [seance(30, '15@8', '15@8', '15@9', '!8@10')])).toMatch(/échec trop courte/)
    expect(raisonPareil(EXERCICES.butterfly, plan, [seance(30, '14@8', '13@8', '12@9', '!10@10')])).toBeNull()
  })

  it('en séance : 3 reps au-dessus du haut de la fourchette → un cran de plus', () => {
    const [s] = seance(15, '20@7')
    expect(monterMaintenant(EXERCICES.butterfly, plan, s, 1)).toBe(17.5)
    expect(monterMaintenant(EXERCICES.butterfly, plan, seance(15, '16@8')[0], 1)).toBeNull()
    expect(monterMaintenant(EXERCICES.butterfly, fixe, s, 1)).toBeNull()
  })
})
