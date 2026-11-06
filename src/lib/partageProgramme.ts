import { MUSCLES } from '../data/exercices'
import { mouvement, MOUVEMENTS, echauffementDe, type MouvementEchauffement } from '../data/echauffements'
import type { Cycle, Exercice, ExoPlan, Muscle, Programme, Seance, SeanceModele } from '../types'
import { chrono, dateCourte, dureeEstimee, kg, reposTexte, schemaPlan, semaineType, seriesEnClair, texteChauffe, volumePrevu } from './calc'
import { etatCycle } from './cycle'
import { historiqueDe } from './historique'
import { nomPhase, phaseA, type EtapeObjectifs } from './objectifs'
import { etatVolume } from './volume'

const JOURS = ['Sans jour', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

export interface DonneesProgramme {
  modele: (id: string | undefined) => SeanceModele | undefined
  exo: (id: string) => Exercice
  exercices: Record<string, Exercice>
  /** Cycle lancé sur ce programme, s'il y en a un. */
  cycle?: Cycle
  objectifs: EtapeObjectifs[]
  cibles: Record<Muscle, number>
  /** Séances terminées, dans n'importe quel ordre. */
  seances: Seance[]
  mouvements?: MouvementEchauffement[]
  aujourdhui: string
}

/** « effort 8/10 », « effort 7, 8/10 » si l'effort change d'une série à l'autre. */
const effort = (p: ExoPlan) => `effort ${[...new Set(p.series.map((s) => kg(Math.round(s.rpe))))].join(', ')}/10`

/** Ligne d'un exercice : séries, effort, repos ou superset, et ce qui le distingue. */
function ligneExo(exo: Exercice, p: ExoPlan, i: number): string {
  const repos = p.enchaine ? `superset avec le ${i + 2}, ${p.repos > 0 ? `${chrono(p.repos)} pour changer de poste` : 'sans repos entre les deux'}` : `repos ${reposTexte(p)}`
  return [`${i + 1}. ${exo.nom}`, schemaPlan(exo, p), effort(p), repos, p.finisseur ? 'finisseur' : '', p.optionnel ? 'optionnel' : ''].filter(Boolean).join(' · ')
}

/**
 * Le programme en texte, pour un coach ou une IA : chaque séance avec son jour, ses exercices, ses
 * échauffements et, si on le veut, ce qui a été fait la dernière fois. Jamais le poids ni le corps.
 */
export function texteProgramme(p: Programme, d: DonneesProgramme, avecCharges: boolean): string {
  const l: string[] = []
  const semaine = semaineType(p)
  const avecJours = semaine.some((e) => e.jour)
  l.push(`Programme ${p.nom} · ${semaine.length} séance${semaine.length > 1 ? 's' : ''}${avecJours ? ' par semaine' : ''}`)
  const etat = d.cycle && d.cycle.programmeId === p.id ? etatCycle(d.cycle, d.aujourdhui) : undefined
  if (d.cycle && etat && !etat.fini) {
    const allegees = d.cycle.deloads.length ? `, semaine${d.cycle.deloads.length > 1 ? 's' : ''} allégée${d.cycle.deloads.length > 1 ? 's' : ''} : ${d.cycle.deloads.join(' et ')}` : ''
    l.push(etat.n < 1 ? `Cycle de ${etat.total} semaines, commence le ${dateCourte(d.cycle.debut)}${allegees}` : `Cycle de ${etat.total} semaines, semaine ${etat.n}${etat.pause ? ' (en pause)' : ''}${allegees}`)
  }
  const phase = phaseA(d.objectifs, d.aujourdhui)
  if (phase) l.push(`Phase : ${nomPhase(phase.phase)}`)
  l.push('Effort sur 10 : 8/10 = il reste environ 2 reps avant l’échec. Fourchette 8–12 : la charge monte quand toutes les séries atteignent le haut.')

  const historique = avecCharges ? [...d.seances].filter((s) => !s.enCours).sort((a, b) => b.debut - a.debut) : []
  const derniere = (exoId: string) => {
    const s = historique.find((x) => !x.deload && x.series.some((y) => y.exoId === exoId))
    const series = historiqueDe(historique, exoId)[0]
    return s && series ? `dernière fois (${dateCourte(s.date)}) : ${seriesEnClair(d.exo(exoId), series)}` : 'pas encore fait'
  }

  const deja = new Map<string, number>()
  const entrees = p.seances.map((e) => ({ e, m: d.modele(e.modeleId) })).filter((x) => x.m).sort((a, b) => (a.e.jour ?? 8) - (b.e.jour ?? 8))
  for (const { e, m } of entrees) {
    const jour = JOURS[e.jour ?? 0]
    l.push('')
    // Une séance faite deux fois dans la semaine : écrite une fois, l'autre jour y renvoie.
    if (deja.has(m!.id)) {
      l.push(`${jour} · ${m!.nom} : la même séance que ${JOURS[deja.get(m!.id)!].toLowerCase()}`)
      continue
    }
    deja.set(m!.id, e.jour ?? 0)
    const duree = dureeEstimee(m!)
    const precisions = [m!.sousTitre, duree ? `environ ${duree} min` : ''].filter(Boolean)
    l.push(`${jour} · ${m!.nom}${precisions.length ? ` (${precisions.join(', ')})` : ''}`)
    const general = echauffementDe(m!)
      .map((id) => mouvement(id, d.mouvements ?? MOUVEMENTS))
      .filter((x) => !!x)
      .map((x) => `${x.nom.toLowerCase()} ${x.quantite}`)
    if (general.length) l.push(`Échauffement : ${general.join(', ')}`)
    if (!m!.exercices.length) l.push('Pas encore d’exercices')
    m!.exercices.forEach((x, i) => {
      const exo = d.exo(x.exoId)
      l.push(ligneExo(exo, x, i))
      if (x.chauffes.length) l.push(`   échauffement ${x.chauffes.map((c) => texteChauffe(exo, c, null)).join(', ')}`)
      if (x.note) l.push(`   note : ${x.note}`)
      if (avecCharges) l.push(`   ${derniere(x.exoId)}`)
    })
  }

  const modeles = semaine.map((e) => d.modele(e.modeleId)).filter((m) => !!m)
  const volume = volumePrevu(modeles, d.exercices)
  const muscles = MUSCLES.filter((m) => volume[m.id] > 0).sort((a, b) => volume[b.id] - volume[a.id])
  if (muscles.length) {
    l.push('', 'Séries par semaine (effort 7/10 ou plus ; un muscle qui aide compte pour moitié)')
    l.push(
      muscles
        .map((m) => {
          const etat = etatVolume(m.id, volume[m.id], d.cibles[m.id])
          return `${m.nom} ${kg(volume[m.id])}${etat === 'leger' ? ' (léger)' : etat === 'beaucoup' ? ' (beaucoup)' : ''}`
        })
        .join(' · ')
    )
  }
  l.push('', 'Fait avec Cran')
  return l.join('\n')
}
