import { mouvement, MOUVEMENTS, type MouvementEchauffement } from '../data/echauffements'
import type { Cycle, Exercice, ExoPlan, Seance, Serie, TypeSerie } from '../types'
import { chargeQte, cibleTexte, dateCourte, duree, dureeSeanceEffective, kg, sensationSeance } from './calc'
import { etatCycle } from './cycle'
import { historiqueDe } from './historique'
import { nomPhase, phaseA, type EtapeObjectifs } from './objectifs'
import { ligneExo } from './partageProgramme'
import { conseil, pareil, type Suggestion } from './progression'

export interface DonneesSeance {
  /** Exercice avec ses réglages (palier) : ceux de la séance. */
  exo: (id: string) => Exercice
  /** Séances terminées avant celle-ci, dans n'importe quel ordre. */
  avant: Seance[]
  objectifs: EtapeObjectifs[]
  /** Cycle de la séance, s'il est connu. */
  cycle?: Cycle
  mouvements?: MouvementEchauffement[]
}

/** La question posée en tête du texte, selon qu'il y a un conseil à juger ou non. */
export const QUESTION_CONSEIL = 'Ma question : le conseil de l’appli pour la prochaine fois te paraît-il juste ? Réponds avec mes chiffres, en quelques lignes.'
export const QUESTION_SANS_CONSEIL = 'Ma question : est-ce que je change quelque chose la prochaine fois ? Réponds avec mes chiffres, en quelques lignes.'

const memeCible = (a: { charges: (number | null)[]; reps: number[] }, b: { charges: (number | null)[]; reps: number[] }) => JSON.stringify([a.charges, a.reps]) === JSON.stringify([b.charges, b.reps])

/** Ce que l'appli proposait de plus qu'aujourd'hui (comme en fin de séance) : rien si elle disait de refaire pareil. */
function conseilUtile(exo: Exercice, p: ExoPlan, histo: Serie[][]): Suggestion | null {
  const c = conseil(exo, p, histo)
  if (!c) return null
  const base = pareil(exo, p, histo)
  const rienDePlus = c.decision === 'consolider' && c.charges.every((x, i) => x === base.charges[i]) && c.reps.every((r, i) => r <= base.reps[i])
  return rienDePlus ? null : c
}

/** Le type d'une série, en mots : rien pour une série normale. */
const TYPE_TEXTE: Record<TypeSerie, string> = { normale: '', echec: 'à l’échec', serie_longue: 'série longue', drop: 'dégressive', rest_pause: 'rest-pause' }

/** Une série qui n'est pas normale, écrite à part : « dégressive : 36 kg × 10, puis 28 kg × 6 », « 40 kg × 12 à l’échec ». Null pour une série normale. */
function serieSpeciale(exo: Exercice, s: Serie): string | null {
  if (s.type === 'normale' && !s.demiReps && !s.suite?.length) return null
  let t = chargeQte(exo, s.charge, s.reps, true)
  if (s.suite?.length) t += s.type === 'drop' ? `, puis ${s.suite.map((x) => chargeQte(exo, x.charge, x.reps, true)).join(', puis ')}` : `, puis ${s.suite.map((x) => x.reps).join(' + ')} après une courte pause`
  if (s.demiReps) t += ` + ${s.demiReps} demi-reps`
  const type = TYPE_TEXTE[s.type]
  if (!type) return t
  return s.suite?.length ? `${type} : ${t}` : `${t} ${type}`
}

/**
 * Les séries en clair pour une IA : « 65 kg × 10, 9, 8 », la charge regroupée tant qu'elle ne change pas, et
 * chaque série qui n'est pas normale écrite à part, son type en mots (pas de flèche ni de signe à deviner).
 */
function seriesPartage(exo: Exercice, series: Serie[]): string {
  const parties: string[] = []
  let groupe: Serie[] = []
  const vider = () => {
    if (groupe.length) parties.push(chargeQte(exo, groupe[0].charge, groupe.map((x) => x.reps).join(', '), true))
    groupe = []
  }
  for (const x of series) {
    const speciale = serieSpeciale(exo, x)
    if (speciale) {
      vider()
      parties.push(speciale)
    } else {
      if (groupe.length && groupe[0].charge !== x.charge) vider()
      groupe.push(x)
    }
  }
  vider()
  return parties.join(' · ')
}

/** « 70 kg × 12, 12, 11 · effort 8, 8, 9/10 », et la douleur si elle a été notée. */
function faitTexte(exo: Exercice, series: Serie[]): string {
  const douleurs = series.flatMap((x, k) => (x.douleur ? [k + 1] : []))
  return [
    seriesPartage(exo, series),
    `effort ${series.map((x) => kg(x.rpe)).join(', ')}/10`,
    douleurs.length ? `douleur notée sur la série ${douleurs.join(' et ')}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * Une séance faite, en texte, pour un coach ou une IA : la question qu'on lui pose, puis ce qui était prévu, ce qui a
 * été fait, la fois d'avant, le conseil de l'appli et ce qui a été choisi pour la prochaine fois. Jamais le poids ni le corps.
 */
export function texteSeance(seance: Seance, d: DonneesSeance, avecAvant: boolean): string {
  const l: string[] = []
  let conseils = 0
  const avant = d.avant.filter((s) => !s.enCours && s.id !== seance.id && s.debut < seance.debut).sort((a, b) => b.debut - a.debut)
  const ms = dureeSeanceEffective(seance)
  l.push(`Séance ${seance.nom} · ${dateCourte(seance.date)}${ms > 0 ? ` · ${duree(ms)}` : ''}`)
  if (seance.deload) l.push(seance.allegeeSeule ? 'Séance allégée ce jour-là (moitié des séries, effort plus bas)' : 'Semaine allégée (moitié des séries, effort plus bas)')
  if (d.cycle && d.cycle.id === seance.cycleId) {
    const total = etatCycle(d.cycle, seance.date).total
    l.push(`Cycle ${d.cycle.nom ?? d.cycle.programme.nom}${seance.semaine ? `, semaine ${seance.semaine} sur ${total}` : ''}`)
  }
  const phase = phaseA(d.objectifs, seance.date)
  if (phase) l.push(`Phase : ${nomPhase(phase.phase)}`)
  const sens = sensationSeance(seance)
  if (sens) l.push(`Sensation : ${sens.label}`)
  l.push('Effort sur 10 : 8/10 = il reste environ 2 reps avant l’échec. Fourchette 8–12 : la charge monte quand toutes les séries atteignent le haut.')

  const faits = (seance.echauffement?.faits ?? []).map((id) => mouvement(id, d.mouvements ?? MOUVEMENTS)).filter((x) => !!x)
  if (faits.length) l.push('', `Échauffement : ${faits.map((x) => `${x.nom.toLowerCase()} ${x.quantite}`).join(', ')}`)

  const avecCelleCi = [seance, ...avant]
  const pasFaits: string[] = []
  const plans = [...seance.exercices]
  // Un exercice fait sans être au plan du jour (rare) garde quand même sa place.
  for (const id of new Set(seance.series.map((x) => x.exoId))) if (!plans.some((p) => p.exoId === id)) plans.push({ exoId: id, repos: 0, series: [], charge: null, chauffes: [], finisseur: false })
  plans.forEach((p, i) => {
    const exo = d.exo(p.exoId)
    const series = seance.series.filter((x) => x.exoId === p.exoId)
    if (!series.length) {
      pasFaits.push(exo.nom)
      return
    }
    l.push('', p.series.length ? ligneExo(exo, p, i) : `${i + 1}. ${exo.nom} · ajouté pendant la séance`)
    l.push(`   aujourd’hui : ${faitTexte(exo, series)}`)
    if (avecAvant) {
      const precedente = avant.find((s) => !s.deload && s.series.some((x) => x.exoId === p.exoId))
      l.push(precedente ? `   la fois d’avant (${dateCourte(precedente.date)}) : ${faitTexte(exo, precedente.series.filter((x) => x.exoId === p.exoId))}` : '   la fois d’avant : première fois')
    }
    // Une séance allégée ne juge rien et ne décide rien pour la prochaine fois.
    if (!seance.deload && p.series.length) {
      const c = conseilUtile(exo, p, historiqueDe(avecCelleCi, p.exoId))
      if (c) {
        conseils++
        l.push(`   conseil de l’appli : ${(c.titre ?? '').replace(/^💡\s*/, '')}, ${cibleTexte(exo, c.charges, c.reps, true)}`)
        l.push(`   pourquoi : ${c.message.replace(/^Pourquoi : /, '').replace(/\n/g, ' ')}`)
      }
      const o = seance.objectifs?.[p.exoId]
      if (o) l.push(`   prochaine fois : ${cibleTexte(exo, o.charges, o.reps, true)} (${c && memeCible(o, c) ? 'conseil suivi' : 'choisi à la main'})`)
      else l.push(`   prochaine fois : comme aujourd’hui${c ? ' (conseil pas suivi)' : ''}`)
    }
    const note = seance.notes[p.exoId]?.trim()
    if (note) l.push(`   note : ${note}`)
  })
  if (pasFaits.length) l.push('', `Pas fait aujourd’hui : ${pasFaits.join(', ')}`)
  l.push('', 'Fait avec Cran')
  // En tête, la question : sans elle, l'IA décrit la séance au lieu de répondre.
  l.unshift(conseils ? QUESTION_CONSEIL : QUESTION_SANS_CONSEIL, '')
  return l.join('\n')
}
