import { describe, expect, it } from 'vitest'
import type { EtapeObjectifs } from './objectifs'
import { datesPhotosPhase, phaseFinie, recapMesures, recapPoids, repere, reperesAPrendre, reperesDeFin } from './recap'

describe('repère du début de phase', () => {
  const l = (...d: string[]) => d.map((date) => ({ date }))
  it('la dernière prise des 14 jours avant, sinon la première ensuite', () => {
    expect(repere(l('2026-03-01', '2026-03-28', '2026-04-20'), '2026-04-01')?.date).toBe('2026-03-28')
    expect(repere(l('2026-03-01', '2026-04-20'), '2026-04-01')?.date).toBe('2026-04-20')
  })
  it('une prise de plusieurs mois avant n’est jamais le début de la phase', () => {
    expect(repere(l('2026-03-01'), '2026-09-07')).toBeUndefined()
  })
})

describe('récap du corps', () => {
  it('poids : moyenne autour du début et 7 derniers jours', () => {
    const r = recapPoids([{ date: '2026-04-01', poids: 84 }, { date: '2026-04-03', poids: 83 }, { date: '2026-06-28', poids: 82 }, { date: '2026-06-30', poids: 81 }], '2026-04-01', '2026-06-30')
    expect(r).toMatchObject({ depart: 83.5, arrivee: 81.5, ecart: -2 })
  })
  it('poids : une seule pesée ne fait pas un récap', () => {
    expect(recapPoids([{ date: '2026-05-01', poids: 80 }], '2026-04-01', '2026-06-30')).toBeNull()
  })
  it('mesures : début et fin réels, avec la prise faite juste après la fin', () => {
    const r = recapMesures([{ date: '2026-04-01', valeurs: { taille: 90 } }, { date: '2026-05-10', valeurs: { taille: 88, bras_g: 33 } }, { date: '2026-07-01', valeurs: { taille: 86 } }], '2026-04-01', '2026-06-30')
    expect(r.lignes).toHaveLength(1)
    expect(r.lignes[0]).toMatchObject({ cle: 'taille', depart: { valeur: 90 }, arrivee: { valeur: 86 } })
    expect(r.debut).toBe('2026-04-01')
    expect(r.fin).toBe('2026-07-01')
  })
  it('mesures : une prise ancienne ne donne pas de faux écart', () => {
    expect(recapMesures([{ date: '2026-03-01', valeurs: { taille: 92 } }, { date: '2026-10-30', valeurs: { taille: 86 } }], '2026-09-07', '2026-11-01').lignes).toEqual([])
  })
  it('photos : celles de la phase, sans les anciennes', () => {
    expect(datesPhotosPhase(['2026-01-01', '2026-03-25', '2026-05-01', '2026-07-02', '2026-09-01'], '2026-04-01', '2026-06-30')).toEqual(['2026-03-25', '2026-05-01', '2026-07-02'])
  })
})

describe('fin et début de phase', () => {
  const frise = (x: Omit<EtapeObjectifs, 'volume'>[]): EtapeObjectifs[] => x.map((e) => ({ volume: {}, ...e }))
  it('fin prévue passée : la phase est finie et encore en cours', () => {
    expect(phaseFinie(frise([{ depuis: '2026-08-03', phase: 'prise', finPrevue: '2026-10-26' }]), '2026-11-03')).toEqual({ debut: '2026-08-03', enCours: true })
    expect(phaseFinie(frise([{ depuis: '2026-08-03', phase: 'prise', finPrevue: '2026-11-26' }]), '2026-11-03')).toBeNull()
  })
  it('phase suivante déjà commencée : le récap de celle d’avant reste proposé 14 jours', () => {
    const f = frise([{ depuis: '2026-08-03', phase: 'prise' }, { depuis: '2026-10-26', phase: 'seche' }])
    expect(phaseFinie(f, '2026-11-03')).toEqual({ debut: '2026-08-03', enCours: false })
    expect(phaseFinie(f, '2026-12-01')).toBeNull()
  })
  it('une phase de quelques jours, vite corrigée, ne déclenche rien', () => {
    expect(phaseFinie(frise([{ depuis: '2026-10-20', phase: 'prise' }, { depuis: '2026-10-25', phase: 'seche' }]), '2026-11-03')).toBeNull()
  })
  it('repères : 7 premiers jours, et le rappel reste pour ce qui manque', () => {
    const f = frise([{ depuis: '2026-11-01', phase: 'seche' }])
    expect(reperesAPrendre(f, '2026-11-03', {})).toEqual({ debut: '2026-11-01', manque: ['photos', 'mensurations'] })
    expect(reperesAPrendre(f, '2026-11-03', { photo: '2026-10-28' })?.manque).toEqual(['mensurations'])
    expect(reperesAPrendre(f, '2026-11-03', { mesure: '2026-11-02' })?.manque).toEqual(['photos'])
    expect(reperesAPrendre(f, '2026-11-03', { photo: '2026-10-28', mesure: '2026-11-02' })).toBeNull()
    expect(reperesAPrendre(f, '2026-11-03', { photo: '2026-10-20', mesure: '2026-10-20' })?.manque).toEqual(['photos', 'mensurations'])
    expect(reperesAPrendre(f, '2026-11-08', {})).toBeNull()
    expect(reperesAPrendre([], '2026-11-03', {})).toBeNull()
  })
  it('fin de phase : la veille et le dernier jour seulement', () => {
    // finPrevue = 1er jour d'après : le dernier jour est le 21.
    const f = frise([{ depuis: '2026-11-01', phase: 'seche', finPrevue: '2026-11-22' }])
    expect(reperesDeFin(f, '2026-11-19', {})).toBeNull()
    expect(reperesDeFin(f, '2026-11-20', {})).toEqual({ debut: '2026-11-01', manque: ['photos', 'mensurations'], dernierJour: false })
    expect(reperesDeFin(f, '2026-11-21', {})?.dernierJour).toBe(true)
    expect(reperesDeFin(f, '2026-11-22', {})).toBeNull()
  })
  it('fin de phase : il reste pour ce qui manque, et une prise des 7 derniers jours compte', () => {
    const f = frise([{ depuis: '2026-11-01', phase: 'seche', finPrevue: '2026-11-22' }])
    expect(reperesDeFin(f, '2026-11-21', { photo: '2026-11-21' })?.manque).toEqual(['mensurations'])
    expect(reperesDeFin(f, '2026-11-21', { photo: '2026-11-14', mesure: '2026-11-21' })).toBeNull()
    expect(reperesDeFin(f, '2026-11-21', { photo: '2026-11-13', mesure: '2026-11-21' })?.manque).toEqual(['photos'])
  })
  it('fin de phase : rien sans date de fin, ni pour une phase de moins de 14 jours', () => {
    expect(reperesDeFin(frise([{ depuis: '2026-11-01', phase: 'seche' }]), '2026-11-21', {})).toBeNull()
    expect(reperesDeFin(frise([{ depuis: '2026-11-01', phase: 'seche', finPrevue: '2026-11-14' }]), '2026-11-13', {})).toBeNull()
    expect(reperesDeFin(frise([{ depuis: '2026-11-01', phase: 'seche', finPrevue: '2026-11-15' }]), '2026-11-14', {})?.dernierJour).toBe(true)
  })
  it('fin de phase : une phase suivante déjà prévue donne le dernier jour', () => {
    const f = frise([{ depuis: '2026-11-01', phase: 'seche', finPrevue: '2026-11-22' }, { depuis: '2026-11-22', phase: 'maintien' }])
    expect(reperesDeFin(f, '2026-11-21', {})?.dernierJour).toBe(true)
    expect(reperesDeFin(f, '2026-11-22', {})).toBeNull()
  })
})
