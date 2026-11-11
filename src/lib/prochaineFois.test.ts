import { describe, expect, it } from 'vitest'
import { EXERCICES } from '../data/exercices'
import type { ExoPlan, Seance } from '../types'
import { conseilsAChoisir, decideProchaineFois, lignesProchaineFois, seancesAvant, vraiChoix } from './prochaineFois'
import { historiqueDe } from './historique'
import { conseil, pareil, suggestionPour } from './progression'

const plan = (exoId: string, charge: number): ExoPlan => ({ exoId, repos: 120, series: [0, 1, 2].map(() => ({ repsMin: 8, repsMax: 12, rpe: 8 })), charge, chauffes: [], finisseur: false })

const seance = (date: string, faits: Record<string, [number, number[]]>, extra: Partial<Seance> = {}) =>
  ({
    id: date + (extra.nom ?? ''),
    date,
    nom: 'Haut A',
    debut: Date.parse(date + 'T18:00:00'),
    enCours: false,
    exercices: Object.keys(faits).map((id) => plan(id, faits[id][0])),
    chauffes: {},
    notes: {},
    ajustSeries: {},
    series: Object.entries(faits).flatMap(([exoId, [charge, reps]]) => reps.map((r, i) => ({ id: `${date}${exoId}${i}`, exoId, type: 'normale', charge, reps: r, rpe: 8, heure: Date.parse(date + 'T18:00:00') + i * 600000 }))),
    ...extra,
  }) as Seance

const exoDe = (id: string) => EXERCICES[id]
// Lundi : rowing au haut de la fourchette (conseil : monter) et développé militaire à 12/12/11 (conseil : +1 rep).
const lundi = seance('2026-11-09', { rowing_haltere: [30, [12, 12, 12]], dev_militaire: [20, [12, 12, 11]] })
const avantLundi = seance('2026-11-02', { rowing_haltere: [30, [11, 11, 10]], dev_militaire: [20, [11, 11, 10]] })

describe('séance enregistrée : la prochaine fois se décide encore', () => {
  it('les conseils sont exactement ceux de la fin de séance', () => {
    const lignes = lignesProchaineFois(lundi, [avantLundi], exoDe)
    for (const l of lignes) {
      const histo = historiqueDe([lundi, avantLundi], l.plan.exoId)
      expect(l.conseil).toEqual(conseil(l.exo, l.plan, histo))
      expect(l.s).toEqual(pareil(l.exo, l.plan, histo))
    }
    expect(lignes.filter(vraiChoix).map((l) => l.conseil!.titre)).toEqual(['💡 Tu peux monter', '💡 Tu peux viser plus'])
  })

  it('tant que c’est la dernière fois qu’on a fait l’exercice', () => {
    const toutes = [avantLundi, lundi]
    expect(decideProchaineFois(lundi, toutes, 'rowing_haltere')).toBe(true)
    // Plus ancienne : un choix ne servirait plus à rien.
    expect(decideProchaineFois(avantLundi, toutes, 'rowing_haltere')).toBe(false)
    // Le rowing refait jeudi dans une autre séance : il se décide jeudi ; le développé militaire reste à lundi.
    const jeudi = seance('2026-11-12', { rowing_haltere: [32, [8, 8, 8]] }, { nom: 'Haut B' })
    expect(decideProchaineFois(lundi, [...toutes, jeudi], 'rowing_haltere')).toBe(false)
    expect(decideProchaineFois(lundi, [...toutes, jeudi], 'dev_militaire')).toBe(true)
    // Une séance allégée ou encore en cours ne prend pas la place.
    expect(decideProchaineFois(lundi, [...toutes, { ...jeudi, deload: true }], 'rowing_haltere')).toBe(true)
    expect(decideProchaineFois(lundi, [...toutes, { ...jeudi, enCours: true }], 'rowing_haltere')).toBe(true)
    // Un exercice pas fait ce jour-là, une séance allégée : rien à décider.
    expect(decideProchaineFois(lundi, toutes, 'dips')).toBe(false)
    expect(decideProchaineFois({ ...lundi, deload: true }, toutes, 'rowing_haltere')).toBe(false)
  })

  it('conseils encore à choisir : ni conseil pris, ni objectif à la main, ni exercice refait depuis', () => {
    expect(conseilsAChoisir(lundi, [avantLundi, lundi], exoDe)).toBe(2)
    expect(conseilsAChoisir({ ...lundi, objectifs: { rowing_haltere: { charges: [32, 32, 32], reps: [8, 8, 8] } } }, [avantLundi, lundi], exoDe)).toBe(1)
    const jeudi = seance('2026-11-12', { rowing_haltere: [32, [8, 8, 8]] }, { nom: 'Haut B' })
    expect(conseilsAChoisir(lundi, [avantLundi, lundi, jeudi], exoDe)).toBe(1)
    expect(conseilsAChoisir({ ...lundi, deload: true }, [avantLundi, lundi], exoDe)).toBe(0)
    // « Confirme d'abord » ne propose rien de plus : pas à choisir.
    const militaire = seance('2026-11-10', { dev_militaire: [6, [12, 12, 12]] }, { nom: 'Épaules' })
    expect(conseilsAChoisir(militaire, [militaire], (id) => ({ ...EXERCICES[id], mode: 'par_main', pas: 2 }))).toBe(0)
  })

  it('le choix fait sur la séance enregistrée est l’objectif de la séance suivante', () => {
    const exo = EXERCICES.rowing_haltere
    const l = lignesProchaineFois(lundi, [avantLundi], exoDe).find((x) => x.exo.id === 'rowing_haltere')!
    const choisi = { ...lundi, objectifs: { rowing_haltere: { charges: l.conseil!.charges, reps: l.conseil!.reps } } }
    const s = suggestionPour(exo, l.plan, seancesAvant(seance('2026-11-16', {}), [avantLundi, choisi]))
    expect(s.decision).toBe('manuel')
    expect(s.charges).toEqual(l.conseil!.charges)
    expect(s.reps).toEqual(l.conseil!.reps)
  })
})
