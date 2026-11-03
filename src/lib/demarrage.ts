/** Réglage du parcours de démarrage ; sa présence dit que la personne a commencé par ce parcours. */
export const CLE_DEMARRAGE = 'demarrage'

/**
 * Personne qui n'a encore choisi aucun programme. Quelqu'un qui a déjà des séances sans programme
 * enregistré (ancienne version) garde le programme de départ : il ne doit pas perdre son planning.
 */
export const estSansProgramme = (nbProgrammes: number, nbCycles: number, nbSeances: number, demarrageVu: boolean, seanceDeBaseModifiee: boolean) =>
  nbProgrammes === 0 && nbCycles === 0 && !seanceDeBaseModifiee && (nbSeances === 0 || demarrageVu)
