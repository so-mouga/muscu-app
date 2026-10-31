import { MUSCLES } from '../data/exercices'
import { typeActivite } from '../data/activites'
import { nomCle } from '../data/mesures'
import type { Activite, Exercice, JourJournal, Mesure, Muscle, Pesee, Seance } from '../types'
import { dateCourte, dateISO, duree, e1rm, estDure, kg, lundi, serieTexte, volumeParMuscle } from './calc'
import { dureeReelle, recordsParSeance, semaineDe } from './historique'
import { periodes, phaseA, textePhase, type EtapeObjectifs } from './objectifs'
import { diagnostic, texteBlocage } from './blocages'

export interface DonneesBilan {
  /** Séances terminées (toutes : les plus anciennes servent de référence aux records). */
  seances: Seance[]
  pesees: Pesee[]
  mesures: Mesure[]
  activites: Activite[]
  exo: (id: string) => Exercice
  exercices: Record<string, Exercice>
  /** Objectif de séries dures par semaine, par muscle. */
  cibles: Record<Muscle, number>
  programme?: string
  /** Sommeil et calories, jour par jour. */
  journal?: JourJournal[]
  /** Objectifs dans le temps (phase, fin prévue, volume). */
  objectifs?: EtapeObjectifs[]
  /** « Cycle Recompo 4 jours, semaine 3/6 » */
  cycle?: string
}

const SEMAINE = 7 * 86400000
const arrondi = (x: number, d = 1) => Math.round(x * 10 ** d) / 10 ** d
const moyenne = (l: number[]) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : null)
const ecart = (d: number, u: string) => `${d > 0 ? '+' : d < 0 ? '−' : '±'}${kg(Math.abs(arrondi(d)))} ${u}`
const jour = (iso: string) => dateCourte(iso).replace(/^\S+ /, '')

/** Lundi de début pour « les N dernières semaines » (semaine en cours comprise). */
export const debutPeriode = (semaines: number, aujourdhui = dateISO()) =>
  dateISO(new Date(Date.parse(lundi(new Date(aujourdhui + 'T12:00:00')) + 'T12:00:00') - (semaines - 1) * SEMAINE))

/**
 * Bilan d'entraînement en texte, à partager (coach, outil d'analyse) : vue d'ensemble, semaine par
 * semaine, volume et RPE par muscle, exercice par exercice, corps, autres sports, douleurs et notes.
 */
export function genererBilan(d: DonneesBilan, debut: string, fin = dateISO()): string {
  const periode = d.seances.filter((s) => s.date >= debut && s.date <= fin).sort((a, b) => a.debut - b.debut)
  const travail = periode.filter((s) => !s.deload)
  const records = recordsParSeance(d.seances, d.exo)
  const lignes: string[] = []
  const titre = (t: string) => lignes.push('', `== ${t} ==`)

  // En-tête
  // Semaines de la période, toutes (même sans séance : une semaine manquée compte), à partir de la
  // première séance enregistrée si elle est plus récente que le début demandé.
  const premiere = d.seances.reduce<string | null>((a, s) => (!a || s.date < a ? s.date : a), null)
  const depart = premiere && semaineDe(premiere) > semaineDe(debut) ? semaineDe(premiere) : semaineDe(debut)
  const semaines: string[] = []
  for (let l = depart; l <= semaineDe(fin); l = dateISO(new Date(Date.parse(l + 'T12:00:00') + SEMAINE))) semaines.push(l)
  const nbSemaines = semaines.length
  lignes.push(`BILAN D'ENTRAÎNEMENT · du ${jour(depart)} au ${jour(fin)} (${nbSemaines} semaine${nbSemaines > 1 ? 's' : ''})`)
  if (d.programme) lignes.push(`Programme : ${d.programme}`)
  if (d.cycle) lignes.push(d.cycle)
  // Phase(s) de la période : en cours à la fin, et celles qui ont commencé ou fini pendant.
  if (d.objectifs?.length) {
    const phase = textePhase(d.objectifs, fin, jour)
    if (phase) lignes.push(`Phase : ${phase}`)
    const autres = periodes(d.objectifs).filter((p) => p.debut <= fin && (p.fin ?? fin) >= depart && !(p.debut <= fin && !p.fin))
    for (const p of autres) lignes.push(`Phase précédente pendant la période : ${p.phase === 'seche' ? 'sèche' : p.phase === 'prise' ? 'prise de muscle' : 'maintien'} du ${jour(p.debut)} au ${jour(p.fin!)}`)
  }
  const dernierPoids = [...d.pesees].filter((p) => p.date <= fin).sort((a, b) => b.date.localeCompare(a.date))[0]
  if (dernierPoids) lignes.push(`Poids actuel : ${kg(dernierPoids.poids)} kg`)
  lignes.push('Séries dures = RPE ≥ 7 (ou échec). RPE 10 = échec, 8 = 2 reps en réserve. PDC = poids du corps (+ lest).')

  // Vue d'ensemble
  titre('Vue d’ensemble')
  if (!periode.length) {
    lignes.push('Aucune séance sur la période.')
    return lignes.join('\n')
  }
  const dures = travail.reduce((a, s) => a + s.series.filter(estDure).length, 0)
  const ressentis = periode.map((s) => s.ressenti).filter((x): x is number => x !== undefined)
  const energies = periode.map((s) => s.energie).filter((x): x is number => x !== undefined)
  lignes.push(
    `${periode.length} séance${periode.length > 1 ? 's' : ''}${periode.length > travail.length ? ` dont ${periode.length - travail.length} en déload` : ''} · ` +
      `durée moyenne ${duree(moyenne(periode.map(dureeReelle))!)} · ${dures} séries dures`
  )
  if (ressentis.length) lignes.push(`Ressenti moyen ${kg(arrondi(moyenne(ressentis)!))}/5 (sur ${ressentis.length} séance${ressentis.length > 1 ? 's' : ''})`)
  if (energies.length) lignes.push(`Énergie moyenne ${kg(arrondi(moyenne(energies)!))}/5`)
  const nbRecords = periode.reduce((a, s) => a + (records[s.id] ?? 0), 0)
  if (nbRecords) lignes.push(`${nbRecords} record${nbRecords > 1 ? 's' : ''} battu${nbRecords > 1 ? 's' : ''}`)

  // Semaine par semaine
  titre('Semaine par semaine')
  for (const l of semaines) {
    const ss = periode.filter((s) => semaineDe(s.date) === l)
    if (!ss.length) {
      lignes.push(`Sem. du ${jour(l)} : aucune séance`)
      continue
    }
    const r = moyenne(ss.map((s) => s.ressenti).filter((x): x is number => x !== undefined))
    const sports = d.activites.filter((a) => semaineDe(a.date) === l)
    lignes.push(
      `Sem. du ${jour(l)} : ${ss.length} séance${ss.length > 1 ? 's' : ''} (${ss.map((s) => s.nom).join(', ')}) · ` +
        `${ss.filter((s) => !s.deload).reduce((a, s) => a + s.series.filter(estDure).length, 0)} séries dures` +
        (ss.some((s) => s.deload) ? ' · déload' : '') +
        (r !== null ? ` · ressenti ${kg(arrondi(r))}/5` : '') +
        (sports.length ? ` · + ${sports.map((a) => `${typeActivite(a.type).nom.toLowerCase()} ${duree(a.duree * 60000)}`).join(', ')}` : '')
    )
  }

  // Volume et RPE par muscle (semaines de travail)
  titre('Volume par muscle (séries dures par semaine, hors déload)')
  const parSemaine = semaines.map((l) => volumeParMuscle(travail.filter((s) => semaineDe(s.date) === l), d.exercices))
  // Moyenne sur les semaines de la période, sauf celles de déload (une semaine sans séance compte pour 0).
  const semainesTravail = semaines.filter((l) => !periode.some((s) => semaineDe(s.date) === l && s.deload))
  for (const m of MUSCLES) {
    const valeurs = semaines.map((_, k) => parSemaine[k][m.id])
    const total = valeurs.reduce((a, b) => a + b, 0)
    if (!total && !d.cibles[m.id]) continue
    const moy = semainesTravail.length ? total / semainesTravail.length : 0
    const rpes = travail.flatMap((s) => s.series.filter((x) => d.exo(x.exoId).muscle === m.id && estDure(x)).map((x) => x.rpe))
    const rpe = moyenne(rpes)
    lignes.push(
      `${m.nom} : ${kg(arrondi(moy))}/sem.` +
        (d.cibles[m.id] ? ` (objectif ${kg(d.cibles[m.id])})` : '') +
        (rpe !== null ? ` · RPE moyen ${kg(arrondi(rpe))}` : '') +
        ` · par semaine : ${valeurs.map((v) => kg(arrondi(v))).join(' / ')}`
    )
  }

  // Exercice par exercice
  titre('Exercices')
  const ids = [...new Set(periode.flatMap((s) => s.series.map((x) => x.exoId)))]
  for (const id of ids) {
    const exo = d.exo(id)
    const muscle = MUSCLES.find((m) => m.id === exo.muscle)?.nom ?? exo.muscle
    lignes.push(`${exo.nom} (${muscle.toLowerCase()})`)
    const avec = periode.filter((s) => s.series.some((x) => x.exoId === id))
    for (const s of avec) {
      const series = s.series.filter((x) => x.exoId === id)
      lignes.push(`  ${jour(s.date)}${s.deload ? ' (déload)' : ''} : ${series.map((x) => serieTexte(exo, x)).join(', ')}${series.some((x) => x.douleur) ? ' ⚠ douleur' : ''}`)
    }
    // Tendance : meilleur 1RM estimé (ou meilleure série) de la première à la dernière séance de la période.
    const meilleur = (s: Seance) => Math.max(0, ...s.series.filter((x) => x.exoId === id).map((x) => e1rm(exo, x, s.poidsCorps) ?? 0))
    const normales = avec.filter((s) => !s.deload)
    if (normales.length >= 2 && meilleur(normales[0]) && meilleur(normales[normales.length - 1])) {
      const a = meilleur(normales[0])
      const b = meilleur(normales[normales.length - 1])
      lignes.push(`  1RM estimé : ${kg(arrondi(a))} → ${kg(arrondi(b))} kg (${b >= a ? '+' : '−'}${kg(Math.abs(arrondi(((b - a) / a) * 100)))} %)`)
    }
    const bloque = diagnostic(exo, { seances: d.seances, journal: d.journal, pesees: d.pesees, phase: d.objectifs && phaseA(d.objectifs, fin)?.phase }, fin)
    if (bloque) lignes.push(`  ${texteBlocage(bloque)}`)
  }

  // Corps
  const pesees = d.pesees.filter((p) => p.date >= debut && p.date <= fin)
  const mesures = d.mesures.filter((m) => m.date >= debut && m.date <= fin).sort((a, b) => a.date.localeCompare(b.date))
  if (pesees.length || mesures.length >= 2) {
    titre('Corps')
    if (pesees.length) {
      const moyennes = semaines
        .map((l) => moyenne(pesees.filter((p) => semaineDe(p.date) === l).map((p) => p.poids)))
        .filter((x): x is number => x !== null)
      if (moyennes.length >= 2) lignes.push(`Poids moyen par semaine : ${moyennes.map((x) => kg(arrondi(x))).join(' / ')} kg (${ecart(moyennes[moyennes.length - 1] - moyennes[0], 'kg')})`)
      else lignes.push(`Poids : ${pesees.map((p) => kg(p.poids)).join(', ')} kg`)
    }
    if (mesures.length >= 2) {
      const a = mesures[0]
      const b = mesures[mesures.length - 1]
      const cles = Object.keys(b.valeurs).filter((c) => a.valeurs[c] !== undefined)
      if (cles.length)
        lignes.push(`Mensurations du ${jour(a.date)} au ${jour(b.date)} : ${cles.map((c) => `${nomCle(c).toLowerCase()} ${kg(a.valeurs[c])} → ${kg(b.valeurs[c])} cm`).join(' ; ')}`)
    }
  }

  // Sommeil et calories (notés le matin)
  const jours = (d.journal ?? []).filter((j) => j.date >= debut && j.date <= fin)
  const nuits = jours.filter((j) => j.sommeil !== undefined).map((j) => j.sommeil!)
  const cal = jours.filter((j) => j.calories)
  if (nuits.length || cal.length) {
    titre('Sommeil et calories')
    if (nuits.length) {
      const m = moyenne(nuits)!
      lignes.push(`Sommeil moyen : ${Math.floor(m)} h ${String(Math.round((m % 1) * 60)).padStart(2, '0')} (${nuits.length} nuit${nuits.length > 1 ? 's' : ''} notée${nuits.length > 1 ? 's' : ''}, min ${kg(Math.min(...nuits))} h)`)
    }
    if (cal.length) {
      const n = (c: string) => cal.filter((j) => j.calories === c).length
      lignes.push(`Calories face à l’objectif (${cal.length} jours notés) : ${n('ok')} dans l’objectif, ${n('trop')} trop, ${n('pasAssez')} pas assez`)
    }
  }

  // Autres sports
  const sports = d.activites.filter((a) => a.date >= debut && a.date <= fin)
  if (sports.length) {
    titre('Autres sports')
    for (const a of sports) lignes.push(`${jour(a.date)} : ${typeActivite(a.type).nom}, ${duree(a.duree * 60000)}, intensité ${a.intensite}/10${a.note ? ` (${a.note})` : ''}`)
  }

  // Notes
  const notes = periode.flatMap((s) =>
    Object.entries(s.notes)
      .filter(([, t]) => t.trim())
      .map(([id, t]) => `${jour(s.date)} · ${d.exo(id).nom} : ${t.trim()}`)
  )
  if (notes.length) {
    titre('Notes')
    lignes.push(...notes)
  }

  return lignes.join('\n')
}
