import { construireCatalogue, ID_PROGRAMME_DEFAUT, sansConseilsVolume } from './catalogue'
import { ANCIENS_NOMS, EXERCICES, texteRecherche } from './data/exercices'
import { nouveauCycle } from './lib/cycle'

describe('programmes', () => {
  it('sans programme enregistré, le planning d’origine devient le programme de départ', () => {
    const c = construireCatalogue([], [], [], undefined)
    expect(c.actif.id).toBe(ID_PROGRAMME_DEFAUT)
    expect(c.planning.map((e) => [e.jour, e.modele.id])).toEqual([
      [1, 'haut_a'],
      [2, 'bas'],
      [3, 'haut_b'],
      [5, 'haut_c'],
    ])
    // La variante maison reste dans le programme, sans jour.
    expect(c.actif.seances.some((e) => e.modeleId === 'bas_maison' && !e.jour)).toBe(true)
  })

  it('sans programme : aucun planning, ni Recompo proposé d’office', () => {
    const c = construireCatalogue([], [], [], undefined, undefined, [], [], true)
    expect(c.sansProgramme).toBe(true)
    expect(c.programmes).toEqual([])
    expect(c.planning).toEqual([])
    expect(c.modeles).toEqual([])
  })

  it('le programme actif pilote le planning ; une séance peut revenir deux fois', () => {
    const programmes = [
      { id: 'a', nom: 'A', seances: [{ modeleId: 'haut_a', jour: 1 }] },
      { id: 'b', nom: 'B', seances: [{ modeleId: 'haut_b', jour: 4 }, { modeleId: 'haut_b', jour: 2 }, { modeleId: 'bas' }] },
    ]
    const c = construireCatalogue([], [], programmes, 'b')
    expect(c.actif.nom).toBe('B')
    expect(c.planning.map((e) => [e.jour, e.modele.id])).toEqual([
      [2, 'haut_b'],
      [4, 'haut_b'],
    ])
  })

  it('une séance supprimée disparaît du planning', () => {
    const programmes = [{ id: 'a', nom: 'A', seances: [{ modeleId: 'haut_a', jour: 1 }, { modeleId: 'bas', jour: 2 }] }]
    const masquee = { id: 'bas', nom: 'Bas', sousTitre: '', exercices: [], supprime: true }
    const c = construireCatalogue([masquee], [], programmes, 'a')
    expect(c.planning.map((e) => e.modele.id)).toEqual(['haut_a'])
  })
})

describe('cycle en cours', () => {
  it('le planning suit la copie du cycle, pas la séance modifiée ensuite', () => {
    const base = construireCatalogue([], [], [], undefined)
    const m = base.planning[0].modele
    const cycle = nouveauCycle('c', base.actif, base.modele, '2026-11-02')
    const modifiee = { ...m, nom: 'Modifiée', exercices: [] }
    const c = construireCatalogue([modifiee], [], [], undefined, cycle)
    expect(c.planning[0].modele.nom).toBe(m.nom)
    expect(c.pourDemarrer(modifiee).exercices.length).toBe(m.exercices.length)
    expect(c.modele(m.id)?.nom).toBe('Modifiée')
  })
  it('une fois ses semaines passées, c’est le programme qui compte, et plus rien n’attend de réponse', () => {
    const base = construireCatalogue([], [], [], undefined)
    const m = base.planning[0].modele
    const expire = nouveauCycle('c', base.actif, base.modele, '2020-01-06')
    const modifiee = { ...m, nom: 'Modifiée' }
    const c = construireCatalogue([modifiee], [], [], undefined, expire)
    expect(c.planning[0].modele.nom).toBe('Modifiée')
    expect(c.pourDemarrer(modifiee).nom).toBe('Modifiée')
    expect(c.ecart).toBeUndefined()
    expect(c.cycle).toBe(expire)
  })

  it('une séance du cycle modifiée attend une réponse', () => {
    const base = construireCatalogue([], [], [], undefined)
    const m = base.planning[0].modele
    const cycle = nouveauCycle('c', base.actif, base.modele, new Date().toISOString().slice(0, 10))
    const c = construireCatalogue([{ ...m, nom: 'Modifiée' }], [], [], undefined, cycle)
    expect(c.ecart?.seances.map((s) => s.nom)).toEqual(['Modifiée'])
  })
})

describe('niveaux de volume', () => {
  const frise = [{ depuis: '2020-01-01', volume: { quadriceps: 5, pecs: 18, ischios: 8, biceps: 6 } }]
  it('à partir d’aujourd’hui les niveaux, le passé garde ses cibles, la frise ne change pas', () => {
    const c = construireCatalogue([], [], [], undefined, undefined, frise)
    expect(c.ciblesPerso).toMatchObject({ quadriceps: 4, pecs: 16, ischios: 8, biceps: 6, dos: 10 })
    expect(c.ciblesA('2020-06-01')).toMatchObject({ quadriceps: 5, pecs: 18, ischios: 8, biceps: 6, dos: 0 })
    expect(c.objectifs).toEqual(frise)
    expect(c.ciblesA('2026-11-08')).toMatchObject({ quadriceps: 4, pecs: 16 })
  })
  it('conseils masqués : plus aucune cible à lire, les choix restent', () => {
    const c = sansConseilsVolume(construireCatalogue([], [], [], undefined, undefined, frise))
    expect(Object.values(c.cibles).every((v) => v === 0)).toBe(true)
    expect(Object.values(c.ciblesA('2020-06-01')).every((v) => v === 0)).toBe(true)
    expect(c.ciblesPerso.quadriceps).toBe(4)
  })
})

describe('bibliothèque d’exercices', () => {
  const copie = (id: string, nom: string) => ({ ...EXERCICES[id], nom, pas: 10 })

  it('aucun nom en double, et aucun ancien nom repris par un autre exercice', () => {
    const noms = Object.values(EXERCICES).map((e) => e.nom)
    expect(new Set(noms).size).toBe(noms.length)
    for (const [id, anciens] of Object.entries(ANCIENS_NOMS)) {
      expect(EXERCICES[id], id).toBeDefined()
      for (const a of anciens) expect(noms.filter((n) => n === a && n !== EXERCICES[id].nom)).toEqual([])
    }
  })

  it('une copie restée à l’ancien nom affiche le nouveau et garde ses réglages ; un nom choisi reste', () => {
    const c = construireCatalogue([], [copie('presse', 'Presse à cuisse'), copie('rowing_barre', 'Mon rowing')], [], undefined)
    expect(c.exo('presse').nom).toBe('Presse à cuisses')
    expect(c.exo('presse').pas).toBe(10)
    expect(c.exo('rowing_barre').nom).toBe('Mon rowing')
  })

  it('l’assistance reste une assistance sur une copie', () => {
    const id = Object.values(EXERCICES).find((e) => e.assistance)!.id
    const { assistance: _, ...sans } = EXERCICES[id]
    expect(construireCatalogue([], [sans], [], undefined).exo(id).assistance).toBe(true)
  })

  it('un exercice retiré : sa copie devient un exercice à soi, et un id seul reste lisible', () => {
    const c = construireCatalogue([], [{ id: 'dev_arnold', nom: 'Développé Arnold', muscle: 'epaule_avant', type: 'compose', mode: 'par_main', pas: 2, suivreE1rm: true }], [], undefined)
    expect(c.exo('dev_arnold')).toMatchObject({ nom: 'Développé Arnold', muscle: 'epaule_avant', perso: true })
    expect(c.exo('fentes_arriere').nom).toBe('Fentes arriere')
  })

  it('la recherche trouve aussi les anciens noms et les noms anglais', () => {
    const noms = (r: string) => Object.values(EXERCICES).filter((e) => texteRecherche(e).toLowerCase().includes(r.toLowerCase())).map((e) => e.id)
    expect(noms('Tirage poitrine prise large')).toContain('tirage_large')
    expect(noms('larry scott')).toEqual(['curl_pupitre'])
    expect(noms('leg extension')).toEqual(['extension_jambes'])
    expect(noms('planche')).toContain('gainage')
    expect(noms('jambes tendues')).toContain('rdl')
  })
})
