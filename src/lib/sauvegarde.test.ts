import { apercu, contenuSauvegarde, lire, type ClesTelephone } from './sauvegarde'

const vide: ClesTelephone = { seances: [], activites: [], cycles: [], pesees: [], mesures: [], journal: [], reglages: [], modeles: [], exercices: [], programmes: [], photos: [] }
const sauvegarde = (o: object) => JSON.stringify({ app: 'muscu', ...o })

describe('lire une sauvegarde', () => {
  it('refuse en clair ce qui n’en est pas une', () => {
    for (const t of ['bonjour', 'null', '{"a":1}']) expect(() => lire(t)).toThrow('pas une sauvegarde de Cran')
  })
  it('refuse une sauvegarde abîmée', () => {
    expect(() => lire(sauvegarde({ pesees: [{ pas: 'de date' }] }))).toThrow('abîmée')
    expect(() => lire(sauvegarde({ pesees: 'non' }))).toThrow('abîmée')
  })
  it('refuse une sauvegarde vide, même avec les réglages d’une appli vide', () => {
    expect(() => lire(sauvegarde({ seances: [], reglages: [{ cle: 'demarrage', valeur: 1 }, { cle: 'dernierExport', valeur: 1 }] }))).toThrow('vide')
  })
  it('écarte une séance restée ouverte', () => {
    const f = lire(sauvegarde({ seances: [{ id: 'a', enCours: true }, { id: 'b', enCours: false }] }))
    expect((f.data.seances as { id: string }[]).map((s) => s.id)).toEqual(['b'])
  })
  it('lit une ancienne sauvegarde sans journal', () => {
    expect(lire(sauvegarde({ pesees: [{ date: '2026-01-01', poids: 80 }] })).presentes).toEqual([{ id: 'corps', n: 1 }])
  })
})

describe('comparer au téléphone', () => {
  const f = lire(sauvegarde({ seances: [{ id: 'a' }, { id: 'b' }], pesees: [{ date: 'j1' }] }))
  it('téléphone vide : rien à choisir', () => {
    expect(apercu(f, { ...vide, reglages: ['demarrage'], programmes: ['p'] }).telephoneVide).toBe(true)
  })
  it('dit ce qui serait ajouté et ce qui serait perdu', () => {
    const a = apercu(f, { ...vide, seances: ['a', 'c', 'd'], pesees: ['j1', 'j2'] })
    expect(a.telephoneVide).toBe(false)
    expect(a.ajouts).toBe('1 séance')
    expect(a.pertes).toBe('2 séances et 1 pesée')
  })
  it('une catégorie absente du fichier ne se perd pas', () => {
    const a = apercu(f, { ...vide, seances: ['a', 'b'], pesees: ['j1'], photos: ['ph'], programmes: ['p'] })
    expect(a.pertes).toBe('')
    expect(a.avecPhotos).toBe(false)
  })
})

describe('ce que contient la sauvegarde', () => {
  const rien = { programmes: 0, seances: 0, pesees: 0, mesures: 0, exercices: 0, photos: 0 }
  it('en chiffres, sans ce qui est vide', () => {
    expect(contenuSauvegarde({ programmes: 2, seances: 14, pesees: 23, mesures: 5, exercices: 3, photos: 4 })).toBe('Contient : 2 programmes, 14 séances, 23 pesées, tes mensurations, tes exercices et tes réglages. Les photos se sauvegardent à part.')
    expect(contenuSauvegarde({ ...rien, seances: 1 })).toBe('Contient : 1 séance et tes réglages.')
    expect(contenuSauvegarde(rien)).toBe('Contient : tes réglages.')
  })
})
