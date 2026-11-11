import type { Cycle } from '../types'
import { apercu, completerJour, contenuSauvegarde, fermerCyclesEnTrop, lire, phasesDuFichier, type ClesTelephone } from './sauvegarde'

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
    expect(apercu(f, { ...vide, reglages: ['demarrage'] }).telephoneVide).toBe(true)
  })
  it('un programme pris ou un cycle lancé : le téléphone n’est pas vide, on demande avant de remplacer', () => {
    expect(apercu(f, { ...vide, reglages: ['demarrage'], programmes: ['p'] }).telephoneVide).toBe(false)
    expect(apercu(f, { ...vide, cycles: ['c'] }).telephoneVide).toBe(false)
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

describe('« Compléter » : les phases du fichier et les jours du journal', () => {
  const avecPhases = { reglages: [{ cle: 'objectifs', valeur: [{ depuis: '2026-09-01', phase: 'seche', volume: {} }] }], seances: [{ id: 'a' }] }
  it('téléphone sans séance : les phases du fichier sont reprises ; dès une séance, celles du téléphone restent', () => {
    expect(phasesDuFichier(avecPhases, 0)).toBe(true)
    expect(phasesDuFichier(avecPhases, 3)).toBe(false)
    expect(phasesDuFichier({ reglages: [{ cle: 'bipsRepos', valeur: 3 }] }, 0)).toBe(false)
    // Anciennes sauvegardes : les phases étaient dans « phases ».
    expect(phasesDuFichier({ reglages: [{ cle: 'phases', valeur: [] }] }, 0)).toBe(true)
  })
  it('l’aperçu l’annonce, et « Compléter » n’est plus « rien à ajouter » quand il n’y a que ça', () => {
    const f = lire(sauvegarde({ reglages: avecPhases.reglages }))
    expect(apercu(f, { ...vide, programmes: ['p'], reglages: ['objectifs'] }).ajouts).toBe('tes phases')
    expect(apercu(f, { ...vide, seances: ['s'], reglages: ['objectifs'] }).ajouts).toBe('')
  })
  it('un jour déjà là reçoit ce qui lui manque, sans rien écraser', () => {
    const telephone = { date: '2026-11-09', pas: 12000, sommeil: 7.2, sommeilMontre: true }
    const fichier = { date: '2026-11-09', pas: 9000, sommeil: 6, note: 'resto, 4 bières', calories: 'trop' as const }
    expect(completerJour(telephone, fichier)).toEqual({ date: '2026-11-09', pas: 12000, sommeil: 7.2, sommeilMontre: true, note: 'resto, 4 bières', calories: 'trop' })
    expect(completerJour({ date: 'j', sommeil: 7, note: 'x' }, { date: 'j', sommeil: 6, note: 'y' })).toBeNull()
    expect(completerJour({ date: 'j', note: '' }, { date: 'j', note: 'resto' })).toEqual({ date: 'j', note: 'resto' })
  })
  it('l’aperçu compte les jours complétés', () => {
    const f = lire(sauvegarde({ journal: [{ date: 'j1', note: 'resto' }, { date: 'j2', sommeil: 7 }, { date: 'j3', sommeil: 7 }] }))
    const a = apercu(f, { ...vide, seances: ['s'], journal: ['j1', 'j2'] }, [{ date: 'j1', pas: 9000 }, { date: 'j2', sommeil: 8 }])
    expect(a.ajouts).toBe('1 jour noté et 1 jour complété')
  })
})

describe('après une récupération, jamais deux cycles ouverts', () => {
  const cycle = (id: string, debut: string, fin?: string) => ({ id, debut, semaines: 6, deloads: [], pauses: [], fin }) as unknown as Cycle
  it('le cycle du fichier reste, celui du démarrage est terminé (téléphone sans séance)', () => {
    const r = fermerCyclesEnTrop([cycle('fichier', '2026-10-05'), cycle('demarrage', '2026-11-09')], new Set(['fichier']), '2026-11-11')
    expect(r.map((c) => [c.id, c.fin])).toEqual([['demarrage', '2026-11-11']])
  })
  it('le cycle du téléphone reste quand il a déjà des séances', () => {
    const r = fermerCyclesEnTrop([cycle('fichier', '2026-08-03'), cycle('telephone', '2026-11-02')], new Set(['telephone']), '2026-11-11')
    // Le cycle du fichier est fini depuis longtemps : il prend son vrai dernier jour, pas aujourd'hui.
    expect(r.map((c) => [c.id, c.fin])).toEqual([['fichier', '2026-09-13']])
  })
  it('deux cycles ouverts dans le fichier lui-même : le plus récent reste', () => {
    expect(fermerCyclesEnTrop([cycle('a', '2026-09-07'), cycle('b', '2026-11-02')], new Set(), '2026-11-11').map((c) => c.id)).toEqual(['a'])
  })
  it('un seul cycle ouvert : rien ne change', () => {
    expect(fermerCyclesEnTrop([cycle('a', '2026-09-07', '2026-10-18'), cycle('b', '2026-11-02')], new Set(['a']))).toEqual([])
  })
})
