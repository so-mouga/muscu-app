import { MUSCLES } from '../data/exercices'
import { nomCle } from '../data/mesures'
import type { Cycle, Exercice, JourJournal, Mesure, Muscle, Pesee, Seance } from '../types'
import { dateCourte, dateISO, duree, estDure, heuresMinutes, kg, lundi, niveauSensation, sensationSeance, serieTexte, volumeParMuscle } from './calc'
import { dureeReelle, evolutionForce, recordsParSeance, seanceSemaineAllegee, semaineDe } from './historique'
import { periodes, phaseA, textePhase, type EtapeObjectifs } from './objectifs'
import { diagnostic, texteBlocage } from './blocages'


/** « 12 400 » : espace des milliers, comme à l'écran. */
const nombre = (n: number) => n.toLocaleString('fr-FR').replace(/\s/g, ' ')

export interface DonneesBilan {
  /** Séances terminées (toutes : les plus anciennes servent de référence aux records). */
  seances: Seance[]
  pesees: Pesee[]
  mesures: Mesure[]
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
  /** Tous les cycles : leurs semaines en pause ne comptent ni dans le prévu, ni dans le volume. */
  cycles?: Cycle[]
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
export function genererBilan(d: DonneesBilan, debut: string, fin = dateISO(), retenir: string[] = [], semainesCoupees = false): string {
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
  // Dates au choix : la vraie date de début, pas le lundi de sa semaine.
  const departEcrit = semaineDe(debut) === debut || depart > debut ? depart : debut
  lignes.push(`BILAN D'ENTRAÎNEMENT · du ${jour(departEcrit)} au ${jour(fin)} (${nbSemaines} semaine${nbSemaines > 1 ? 's' : ''})`)
  if (d.programme) lignes.push(`Programme : ${d.programme}`)
  if (d.cycle) lignes.push(d.cycle)
  // Phase(s) de la période : en cours à la fin, et celles qui ont commencé ou fini pendant.
  if (d.objectifs?.length) {
    const phase = textePhase(d.objectifs, fin, jour)
    if (phase) lignes.push(`Phase : ${phase}`)
    // Phases finies pendant la période : celle encore en cours à la fin de la période n'en fait pas partie.
    const autres = periodes(d.objectifs).filter((p) => p.fin && p.fin >= depart && p.fin < fin)
    for (const p of autres) lignes.push(`Phase précédente pendant la période : ${p.phase === 'seche' ? 'sèche' : p.phase === 'prise' ? 'prise de muscle' : 'maintien'} du ${jour(p.debut)} au ${jour(p.fin!)}`)
  }
  const dernierPoids = [...d.pesees].filter((p) => p.date <= fin).sort((a, b) => b.date.localeCompare(a.date))[0]
  if (dernierPoids) lignes.push(`Poids actuel : ${kg(dernierPoids.poids)} kg`)
  lignes.push('Séries dures = RPE ≥ 7 (ou échec). RPE 10 = échec, 8 = 2 reps en réserve. PDC = poids du corps (+ lest).')

  if (retenir.length) {
    titre('À retenir')
    lignes.push(...retenir)
  }

  // Vue d'ensemble
  titre('Vue d’ensemble')
  if (!periode.length) {
    lignes.push('Aucune séance sur la période.')
    return lignes.join('\n')
  }
  const dures = travail.reduce((a, s) => a + s.series.filter(estDure).length, 0)
  const sensations = periode.map(sensationSeance).filter((x): x is NonNullable<typeof x> => x !== null)
  lignes.push(
    `${periode.length} séance${periode.length > 1 ? 's' : ''}${periode.length > travail.length ? ` dont ${periode.length - travail.length} en déload` : ''} · ` +
      `durée moyenne ${duree(moyenne(periode.map(dureeReelle))!)} · ${dures} séries dures`
  )
  if (sensations.length) {
    const moy = moyenne(sensations.map((s) => s.val))!
    lignes.push(`Sensation moyenne : ${niveauSensation(moy)} (${kg(arrondi(moy))}/5 sur ${sensations.length} séance${sensations.length > 1 ? 's' : ''})`)
  }
  const nbRecords = periode.reduce((a, s) => a + (records[s.id] ?? 0), 0)
  if (nbRecords) lignes.push(`${nbRecords} record${nbRecords > 1 ? 's' : ''} battu${nbRecords > 1 ? 's' : ''}`)

  // Semaine par semaine
  titre('Semaine par semaine')
  for (const l of semaines) {
    const ss = periode.filter((s) => semaineDe(s.date) === l)
    if (!ss.length) {
      lignes.push(`Sem. du ${jour(l)} : ${d.cycles?.some((c) => c.pauses.includes(l)) ? 'en pause' : 'aucune séance'}`)
      continue
    }
    const ssSens = ss.map(sensationSeance).filter((x): x is NonNullable<typeof x> => x !== null)
    const r = ssSens.length ? moyenne(ssSens.map((x) => x.val)) : null
    lignes.push(
      `Sem. du ${jour(l)} : ${ss.length} séance${ss.length > 1 ? 's' : ''} (${ss.map((s) => s.nom).join(', ')}) · ` +
        `${ss.filter((s) => !seanceSemaineAllegee(s)).reduce((a, s) => a + s.series.filter(estDure).length, 0)} séries dures` +
        (ss.some(seanceSemaineAllegee) ? ' · déload' : ss.some((s) => s.allegeeSeule) ? ' · séance allégée' : '') +
        (r !== null ? ` · sensation ${niveauSensation(r)}` : '')
    )
  }

  // Volume et RPE par muscle (semaines de travail)
  titre('Volume par muscle (séries dures par semaine, hors déload)')
  // Dates au choix : une semaine coupée ferait croire à un volume trop faible.
  const entieres = semaines.filter((l) => l >= debut && dateISO(new Date(Date.parse(l + 'T12:00:00') + 6 * 86400000)) <= fin)
  const semainesVolume = semainesCoupees && entieres.length ? entieres : semaines
  const parSemaine = semainesVolume.map((l) => volumeParMuscle(periode.filter((s) => !seanceSemaineAllegee(s) && semaineDe(s.date) === l), d.exercices))
  // Moyenne sur les semaines de la période, sauf celles de déload (une semaine sans séance compte pour 0).
  const semainesTravail = semainesVolume.filter((l) => !periode.some((s) => semaineDe(s.date) === l && seanceSemaineAllegee(s)) && !(d.cycles?.some((c) => c.pauses.includes(l)) && !periode.some((s) => semaineDe(s.date) === l)))
  for (const m of MUSCLES) {
    const valeurs = semainesVolume.map((_, k) => parSemaine[k][m.id])
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
      lignes.push(`  ${jour(s.date)}${s.allegeeSeule ? ' (séance allégée)' : s.deload ? ' (déload)' : ''} : ${series.map((x) => serieTexte(exo, x)).join(', ')}${series.some((x) => x.douleur) ? ' ⚠ douleur' : ''}`)
    }
    // Tendance : meilleur 1RM estimé des séries de travail, des 2 premières aux 2 dernières séances (voir `evolutionForce`).
    const ev = evolutionForce(exo, avec.filter((s) => !s.deload))
    if (ev?.avant.e1rm && ev.apres.e1rm) {
      const a = ev.avant.e1rm
      const b = ev.apres.e1rm
      lignes.push(`  Force estimée : ${kg(arrondi(a))} → ${kg(arrondi(b))} kg (${b >= a ? '+' : '−'}${kg(Math.abs(arrondi(((b - a) / a) * 100)))} %)`)
    }
    const bloque = diagnostic(exo, { seances: d.seances, journal: d.journal, pesees: d.pesees, phase: d.objectifs && phaseA(d.objectifs, fin)?.phase, debutPhase: d.objectifs && phaseA(d.objectifs, fin)?.debut, objectifs: d.objectifs }, fin)
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

  // Sommeil, pas et calories (notés le matin, ou lus dans Health Connect)
  const jours = (d.journal ?? []).filter((j) => j.date >= debut && j.date <= fin)
  const nuits = jours.filter((j) => j.sommeil !== undefined).map((j) => j.sommeil!)
  const cal = jours.filter((j) => j.calories)
  // Le jour même n'est pas fini : ses pas ne comptent pas encore.
  const pas = jours.filter((j) => j.pas !== undefined && j.date < dateISO()).map((j) => j.pas!)
  if (nuits.length || cal.length || pas.length) {
    titre(pas.length ? 'Sommeil, pas et calories' : 'Sommeil et calories')
    if (nuits.length) {
      const m = moyenne(nuits)!
      lignes.push(`Sommeil moyen : ${heuresMinutes(m)} (${nuits.length} nuit${nuits.length > 1 ? 's' : ''} notée${nuits.length > 1 ? 's' : ''}, min ${kg(Math.min(...nuits))} h)`)
    }
    if (pas.length) lignes.push(`Pas : ${nombre(Math.round(moyenne(pas)!))} par jour en moyenne (de ${nombre(Math.min(...pas))} à ${nombre(Math.max(...pas))}, ${pas.length} jour${pas.length > 1 ? 's' : ''}, lus sur la montre ou le téléphone)`)
    if (cal.length) {
      const n = (c: string) => cal.filter((j) => j.calories === c).length
      lignes.push(`Calories face à l’objectif (${cal.length} jours notés) : ${n('ok')} dans l’objectif, ${n('trop')} trop, ${n('pasAssez')} pas assez`)
    }
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
