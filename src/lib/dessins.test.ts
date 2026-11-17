import { describe, expect, it } from 'vitest'
import { construireCatalogue } from '../catalogue'
import { EXERCICES } from '../data/exercices'
import type { Exercice } from '../types'
import { dessinsLivres, estPhotoPerso, imageDeCopie } from './dessins'

describe('dessins', () => {
  it('une photo prise par la personne reste la sienne, un dessin vient toujours de la base', () => {
    expect(imageDeCopie('data:image/jpeg;base64,xx', '/dessins/presse.jpg')).toBe('data:image/jpeg;base64,xx')
    expect(imageDeCopie(undefined, '/dessins/presse.jpg')).toBe('/dessins/presse.jpg')
    expect(imageDeCopie('/dessins/ancien.jpg', '/dessins/presse.jpg')).toBe('/dessins/presse.jpg')
    expect(imageDeCopie(undefined, undefined)).toBeUndefined()
    expect(estPhotoPerso('data:image/png;base64,xx')).toBe(true)
    expect(estPhotoPerso('dessins/chat.jpg')).toBe(false)
    expect(estPhotoPerso(undefined)).toBe(false)
  })

  it("un exercice de base modifié avant l'arrivée du dessin le reçoit quand même", () => {
    const copie: Exercice = { ...EXERCICES.presse, nom: 'Presse de ma salle', image: undefined }
    const c = construireCatalogue([], [copie], [], undefined)
    expect(c.exo('presse').nom).toBe('Presse de ma salle')
    expect(c.exo('presse').image).toBe(EXERCICES.presse.image)
  })

  it('la liste préchargée contient chaque dessin livré, une seule fois', () => {
    const liste = dessinsLivres()
    expect(liste.length).toBe(new Set(liste).size)
    for (const e of Object.values(EXERCICES)) if (e.image) expect(liste).toContain(e.image)
    expect(liste.some((s) => s.endsWith('dessins/chat.jpg'))).toBe(true)
    expect(liste.some((s) => s.endsWith('dessins/thrusters.jpg'))).toBe(true)
  })
})
