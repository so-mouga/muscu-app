import { chiffresImage, type ContenuImage } from './imageBilan'

const base: ContenuImage = { periode: '5 oct. → 1 nov.', seances: 11, tenues: { n: 3, sur: 4 }, montent: 5, lignes: [] }

describe('chiffres de l’image du bilan', () => {
  it('montre séances, semaines tenues et exercices qui montent, ces derniers en vert', () => {
    expect(chiffresImage(base)).toEqual([
      { valeur: '11', nom: 'séances' },
      { valeur: '3 sur 4', nom: 'semaines tenues' },
      { valeur: '5', nom: 'exercices montent', vert: true },
    ])
  })
  it('sans progrès ni semaine comptée : rien en vert, aucun zéro affiché', () => {
    expect(chiffresImage({ ...base, seances: 1, tenues: { n: 0, sur: 0 }, montent: 0 })).toEqual([{ valeur: '1', nom: 'séance' }])
  })
})
