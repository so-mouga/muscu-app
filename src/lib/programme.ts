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
/** Fourchette d'un exercice ajouté, comme dans les programmes tout prêts : sans elle, l'appli ne conseille jamais de monter. */
export const fourchetteParDefaut = (exo: Exercice) => (exo.type === 'compose' ? { repsMin: 8, repsMax: 12 } : { repsMin: 12, repsMax: 15 })

export const reposParDefaut = (exo: Exercice): number => (exo.mesure === 'temps' ? 60 : exo.muscle === 'mollets' || exo.muscle === 'abdos' ? 90 : exo.type === 'compose' ? 180 : 150)

/**
 * Cette ligne du programme est-elle la séance du jour ? Comme l'Accueil, on suit le planning en vigueur : pendant un cycle, celui du cycle.
 * Si la même séance revient plusieurs fois dans le programme, seule la ligne de ce jour est marquée.
 */
export function estDuJour(ligne: { modeleId: string; jour?: number }, seances: { modeleId: string; jour?: number }[], planning: { modele: { id: string }; jour: number }[], jour: number): boolean {
  if (!planning.some((x) => x.modele.id === ligne.modeleId && x.jour === jour)) return false
  return ligne.jour === jour || !seances.some((x) => x.modeleId === ligne.modeleId && x.jour === jour)
}

/** Programmes créés puis laissés vides sous leur nom proposé : ni le programme en service, ni un programme encore ouvert. */
export function programmesAbandonnes(programmes: Programme[], actifId: string, ouverts: string[]): string[] {
  if (programmes.length <= 1) return []
  return programmes.filter((p) => !p.seances.length && /^Mon programme( \d+)?$/.test(p.nom) && p.id !== actifId && !ouverts.includes(p.id)).map((p) => p.id)
}
