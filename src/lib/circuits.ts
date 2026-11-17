import type { CircuitPlan, Seance, SeanceModele } from '../types'

/** Décompte avant le top, en secondes. */
export const DECOMPTE = 5

/** Durée d'un circuit, en secondes. */
export const dureeCircuit = (c: CircuitPlan) => (c.type === 'minute' ? c.mouvements.length * Math.max(1, c.tours) * 60 : c.minutes * 60)

/** Durée de tous les circuits d'une séance, en secondes (une minute de battement entre deux). */
export const dureeCircuits = (m: Pick<SeanceModele, 'circuits'>) => (m.circuits ?? []).reduce((a, c) => a + dureeCircuit(c) + 60, 0)

/** Le premier circuit ni fini ni sauté. */
export const circuitAFaire = (s: Pick<Seance, 'circuits' | 'circuitsFaits'>) => (s.circuits ?? []).find((c) => !s.circuitsFaits?.[c.id])

export const circuitsRestants = (s: Pick<Seance, 'circuits' | 'circuitsFaits'>) => (s.circuits ?? []).filter((c) => !s.circuitsFaits?.[c.id]).length

/** Où on en est d'un circuit « minute par minute », `ecoule` secondes après le top. */
export function minuteDe(c: CircuitPlan, ecoule: number) {
  const n = Math.max(1, c.mouvements.length)
  const minute = Math.floor(ecoule / 60)
  return { minute, passage: Math.floor(minute / n), rang: minute % n, reste: 60 - (ecoule % 60), fini: ecoule >= dureeCircuit(c) }
}

/** « 12 min · 3 mouvements », « minute par minute · 3 fois 4 min ». */
export function resumeCircuit(c: CircuitPlan) {
  const n = c.mouvements.length
  return c.type === 'minute' ? `minute par minute · ${c.tours > 1 ? `${c.tours} fois ` : ''}${n} min` : `${c.minutes} min · ${n} mouvement${n > 1 ? 's' : ''}`
}

/** « 4 tours », « fait », « sauté » : ce qui a été fait d'un circuit, en clair. Rien s'il n'a pas été commencé. */
export function faitCircuit(s: Pick<Seance, 'circuitsFaits'>, c: CircuitPlan) {
  const f = s.circuitsFaits?.[c.id]
  if (!f) return ''
  if (c.type === 'duree' && f.tours !== undefined && !(f.passe && !f.tours)) return `${f.tours} tour${f.tours > 1 ? 's' : ''}${f.passe ? ' (arrêté avant la fin)' : ''}`
  return f.passe ? 'sauté' : 'fait'
}

/**
 * Les tours de la dernière fois sur ce circuit : même nom, même durée, fait jusqu'au bout.
 * `terminees` : de la plus récente à la plus ancienne.
 */
export function toursAvant(terminees: Pick<Seance, 'circuits' | 'circuitsFaits'>[], c: CircuitPlan): number | undefined {
  for (const s of terminees) {
    const d = (s.circuits ?? []).find((x) => x.type === 'duree' && x.nom === c.nom && x.minutes === c.minutes)
    const f = d && s.circuitsFaits?.[d.id]
    if (f && !f.passe && f.tours !== undefined) return f.tours
  }
  return undefined
}

/** Le plus de tours jamais faits sur ce circuit. */
export function recordTours(terminees: Pick<Seance, 'circuits' | 'circuitsFaits'>[], c: CircuitPlan): number | undefined {
  let max: number | undefined
  for (const s of terminees) {
    const d = (s.circuits ?? []).find((x) => x.type === 'duree' && x.nom === c.nom && x.minutes === c.minutes)
    const f = d && s.circuitsFaits?.[d.id]
    if (f && !f.passe && f.tours !== undefined && (max === undefined || f.tours > max)) max = f.tours
  }
  return max
}

/** Nom proposé pour un nouveau circuit : « Circuit 2 ». */
export const nomCircuitLibre = (circuits: CircuitPlan[]) => {
  let n = circuits.length + 1
  while (circuits.some((c) => c.nom === `Circuit ${n}`)) n++
  return `Circuit ${n}`
}

/** Les circuits d'une séance, avec ce qui a été fait et l'écart de tours face à la dernière fois (`avant` : de la plus récente à la plus ancienne). */
export function circuitsFaitsDe(s: Pick<Seance, 'circuits' | 'circuitsFaits'>, avant: Pick<Seance, 'circuits' | 'circuitsFaits'>[] = []) {
  return (s.circuits ?? []).map((c) => {
    const f = s.circuitsFaits?.[c.id]
    const hier = f && !f.passe && f.tours !== undefined ? toursAvant(avant, c) : undefined
    const ecart = hier !== undefined ? f!.tours! - hier : undefined
    return { circuit: c, fait: faitCircuit(s, c), ecart }
  })
}

/** Texte partagé d'un circuit : « Circuit 1 (12 min, autant de tours que possible) : 12 thrusters, 12 sit-ups ». */
export function texteCircuit(c: CircuitPlan) {
  const mouv = c.mouvements.map((m) => m.nom + (m.detail ? ` (${m.detail})` : ''))
  return c.type === 'minute'
    ? `${c.nom} (un mouvement par minute, ${c.tours} fois la liste, ${c.mouvements.length * c.tours} min) : ${mouv.map((m, k) => `minute ${k + 1} ${m}`).join(' ; ')}`
    : `${c.nom} (${c.minutes} min, autant de tours que possible) : ${mouv.join(', ')}`
}
