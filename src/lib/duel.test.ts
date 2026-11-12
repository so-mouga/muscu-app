import { gainSerie, mieuxQueHier, titreSaisie, verdictSaisie } from './duel'
import type { Exercice, Serie } from '../types'

const exo = { id: 'presse', nom: 'Presse', muscle: 'quadriceps', type: 'compose', mode: 'machine', pas: 5, suivreE1rm: true } as Exercice
const assiste = { ...exo, id: 'tractions', assistance: true } as Exercice
const s = (charge: number, reps: number, extra: Partial<Serie> = {}): Serie => ({ id: `${charge}-${reps}`, exoId: exo.id, type: 'normale', charge, reps, rpe: 8, heure: 0, ...extra })

describe('verdictSaisie', () => {
  const hier = s(120, 12)
  const seuil = { reps: 13, record: 12 }

  it('égalité, moins bien, mieux, record', () => {
    expect(verdictSaisie(exo, { reps: 12, charge: 120, hier, seuil })).toEqual({ ton: 'egal', texte: 'Égalité. Encore une.' })
    expect(verdictSaisie(exo, { reps: 10, charge: 120, hier, seuil })).toEqual({ ton: 'moins', texte: '−2 reps sur la dernière fois' })
    expect(verdictSaisie(exo, { reps: 13, charge: 120, hier, seuil })).toEqual({ ton: 'gagne', cran: true, texte: '+1 rep · record · +1 cran' })
  })

  it('mieux que la dernière fois sans battre le record : du vert, pas un cran', () => {
    const v = verdictSaisie(exo, { reps: 12, charge: 120, hier: s(120, 11), seuil: { reps: 14, record: 13 } })
    expect(v).toEqual({ ton: 'mieux', texte: '+1 rep sur la dernière fois · record : 13' })
  })

  it('charge jamais faite : record dès la première rep', () => {
    expect(verdictSaisie(exo, { reps: 6, charge: 125, hier, seuil: { reps: 1 } })).toEqual({ ton: 'gagne', cran: true, texte: 'Charge jamais faite · record · +1 cran' })
    expect(verdictSaisie(assiste, { reps: 6, charge: 20, hier: s(25, 8), seuil: { reps: 1 } })?.texte).toBe('Jamais fait avec si peu d’aide · record · +1 cran')
  })

  it('charge plus lourde sans cran possible (déjà gagné aujourd’hui) : mieux, en kilos', () => {
    expect(verdictSaisie(exo, { reps: 8, charge: 125, hier, seuil: null })).toEqual({ ton: 'mieux', texte: '+5 kg, −4 reps sur la dernière fois' })
  })

  it('revanche : tant que le bas n’est pas atteint, on dit ce qu’il manque', () => {
    const revanche = { genre: 'reps' as const, avant: 6, vise: 8 }
    const raté = s(24, 6)
    expect(verdictSaisie(exo, { reps: 6, charge: 24, hier: raté, revanche })).toEqual({ ton: 'moins', texte: 'La dernière fois : 6' })
    expect(verdictSaisie(exo, { reps: 7, charge: 24, hier: raté, revanche })).toEqual({ ton: 'mieux', texte: '+1 · encore 1 pour la revanche' })
    expect(verdictSaisie(exo, { reps: 8, charge: 24, hier: raté, revanche })).toEqual({ ton: 'gagne', texte: 'Revanche prise.' })
    // À une autre charge, la revanche ne se joue plus : on compare comme d'habitude.
    expect(verdictSaisie(exo, { reps: 8, charge: 22, hier: raté, revanche })?.ton).toBe('moins')
  })

  it('rien à dire sans dernière fois ni record, ni à zéro rep', () => {
    expect(verdictSaisie(exo, { reps: 10, charge: 120 })).toBeNull()
    expect(verdictSaisie(exo, { reps: 0, charge: 120, hier })).toBeNull()
    expect(verdictSaisie(exo, { reps: 10, charge: 120, seuil: { reps: 13, record: 12 } })).toEqual({ ton: 'neutre', texte: 'Ton record à cette charge : 12' })
  })

  it('exercice en temps : des secondes', () => {
    const gainage = { ...exo, mesure: 'temps' } as Exercice
    expect(verdictSaisie(gainage, { reps: 50, charge: 0, hier: s(0, 45) })?.texte).toBe('+5 s sur la dernière fois')
    expect(verdictSaisie(gainage, { reps: 45, charge: 0, hier: s(0, 45) })?.texte).toBe('Égalité. Tiens encore.')
  })
})

describe('titreSaisie', () => {
  const base = { premiereFois: false, allegee: false, finisseur: false }
  it('nomme l’adversaire : la même série, la dernière fois', () => {
    expect(titreSaisie(exo, { ...base, charge: 120, hier: s(120, 12) })).toEqual({ fort: 'Bats 12.' })
  })
  it('charge plus lourde, plus légère, assistée', () => {
    expect(titreSaisie(exo, { ...base, charge: 125, hier: s(120, 12) })?.fort).toBe('Plus lourd qu’avant.')
    expect(titreSaisie(exo, { ...base, charge: 115, hier: s(120, 12) })).toBeNull()
    expect(titreSaisie(assiste, { ...base, charge: 20, hier: s(25, 8) })?.fort).toBe('Moins d’aide qu’avant.')
  })
  it('première fois, séance allégée, finisseur', () => {
    expect(titreSaisie(exo, { ...base, premiereFois: true, charge: 120 })?.fort).toBe('Première fois. ')
    expect(titreSaisie(exo, { ...base, allegee: true, charge: 120, hier: s(120, 12) })?.fort).toBe('Allégée. ')
    expect(titreSaisie(exo, { ...base, finisseur: true, charge: 120, hier: s(120, 12) })?.accent).toBe('À fond.')
  })
  it('revanche : seulement à la charge où elle se joue', () => {
    const revanche = { genre: 'reps' as const, avant: 6, vise: 8 }
    expect(titreSaisie(exo, { ...base, charge: 24, hier: s(24, 6), revanche })).toEqual({ avant: 'Tu t’étais arrêté à 6.', fort: 'Aujourd’hui, ', accent: '8.' })
    expect(titreSaisie(exo, { ...base, charge: 26, hier: s(24, 6), revanche })?.fort).toBe('Plus lourd qu’avant.')
    const charge = { genre: 'charge' as const, avant: 55, vise: 60 }
    expect(titreSaisie(exo, { ...base, charge: 60, hier: s(55, 10), revanche: charge })?.accent).toBe('60 kg.')
  })
  it('série en plus (rien la dernière fois à ce rang) : pas de titre', () => {
    expect(titreSaisie(exo, { ...base, charge: 120 })).toBeNull()
  })
})

describe('séries faites', () => {
  it('compte les séries mieux que la même série la dernière fois', () => {
    const hier = [s(120, 12), s(120, 11), s(120, 10)]
    expect(mieuxQueHier(exo, [s(120, 13), s(120, 11), s(120, 9)], hier)).toBe(1)
    expect(mieuxQueHier(exo, [s(125, 8), s(120, 12)], hier)).toBe(2)
    expect(mieuxQueHier(exo, [s(120, 13)], undefined)).toBe(0)
    // Une 4e série sans équivalent la dernière fois ne compte pas.
    expect(mieuxQueHier(exo, [s(120, 12), s(120, 11), s(120, 10), s(120, 9)], hier)).toBe(0)
  })
  it('le signe à côté d’une série faite', () => {
    expect(gainSerie(exo, s(120, 13), s(120, 12))).toEqual({ sens: 'mieux', texte: '+1' })
    expect(gainSerie(exo, s(125, 8), s(120, 12))).toEqual({ sens: 'mieux', texte: '↑' })
    expect(gainSerie(exo, s(120, 12), s(120, 12))).toEqual({ sens: 'egal', texte: '=' })
    expect(gainSerie(exo, s(120, 11), s(120, 12))).toBeNull()
    expect(gainSerie(exo, s(120, 11), undefined)).toBeNull()
  })
})
