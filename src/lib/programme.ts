import type { Exercice, Programme, SeanceModele } from '../types'

/** Copie indépendante d'un programme : ses séances sont copiées aussi, modifier l'une ne change pas l'autre. */
export function copieProgramme(p: Programme, modele: (id: string) => SeanceModele | undefined, id: () => string): { programme: Programme; seances: SeanceModele[] } {
  const nouveauxIds = new Map<string, string>()
  const seances: SeanceModele[] = []
  for (const modeleId of new Set(p.seances.map((e) => e.modeleId))) {
    const m = modele(modeleId)
    if (!m) continue
    const nouvel = 'm_' + id()
    nouveauxIds.set(modeleId, nouvel)
    seances.push({ ...structuredClone(m), id: nouvel, jour: undefined })
  }
  return {
    programme: { ...structuredClone(p), id: 'p_' + id(), nom: `${p.nom.trim()} (copie)`, seances: p.seances.flatMap((e) => (nouveauxIds.has(e.modeleId) ? [{ ...e, modeleId: nouveauxIds.get(e.modeleId)! }] : [])) },
    seances,
  }
}

/** Nom proposé pour une nouvelle séance : la première lettre libre parmi les noms déjà pris. */
export function nomSeanceLibre(noms: string[]): string {
  const pris = new Set(noms.map((n) => n.trim()))
  for (const lettre of 'ABCDEFGHIJ') if (!pris.has(`Séance ${lettre}`)) return `Séance ${lettre}`
  let k = 11
  while (pris.has(`Séance ${k}`)) k++
  return `Séance ${k}`
}

/** Une séance supprimée sort de tous les programmes qui la contenaient : seuls ceux-là sont renvoyés, à enregistrer. */
export const programmesSansSeance = (programmes: Programme[], modeleId: string): Programme[] =>
  programmes.filter((p) => p.seances.some((e) => e.modeleId === modeleId)).map((p) => ({ ...p, seances: p.seances.filter((e) => e.modeleId !== modeleId) }))

/** Repos entre les séries d'un exercice ajouté : court en temps, sur les mollets et les abdos, plus long sur les exercices à plusieurs articulations. */
export const reposParDefaut = (exo: Exercice): number => (exo.mesure === 'temps' ? 60 : exo.muscle === 'mollets' || exo.muscle === 'abdos' ? 90 : exo.type === 'compose' ? 180 : 150)
