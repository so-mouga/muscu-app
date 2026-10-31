import { MUSCLES } from '../data/exercices'
import { nomCle } from '../data/mesures'
import type { Exercice, Muscle, Seance, Serie } from '../types'
import { chargeQte, dateISO, e1rm, estDure, kg, kgSouleves, volumeParMuscle } from './calc'
import type { DonneesBilan } from './bilan'
import { dureeReelle, meilleureSerie, scoreSerie, semaineDe } from './historique'
import { nomPhase, type Phase } from './objectifs'
import { diagnostic } from './blocages'

const SEMAINE = 7 * 86400000
const arrondi = (x: number, d = 1) => Math.round(x * 10 ** d) / 10 ** d
const moyenne = (l: number[]) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : null)

export interface Record_ {
  date: string
  exo: Exercice
  /** « 62,5 kg × 8 » */
  perf: string
}

export interface Analyse {
  /** Début effectif de la période (calé sur la 1re séance enregistrée si l'historique est plus court). */
  debut: string
  semaines: string[]
  seances: number
  deloads: number
  /** Séances prévues par le programme sur la période (null sans planning). */
  prevues: number | null
  /** Séances qui comptent face au prévu (plafonnées au prévu de chaque semaine), et celles en plus. */
  faites: number
  enPlus: number
  temps: number
  dures: number
  tonnage: number
  sports: { n: number; minutes: number }
  /** Semaines d'affilée avec au moins une séance, jusqu'à la dernière semaine de la période. */
  enchainees: number
  /** Séries dures par semaine, moyenne hors semaines de déload. */
  volume: Record<Muscle, number>
  records: Record_[]
  /** Évolution du meilleur 1RM estimé (ou de la meilleure série pour l'isolation) sur la période. */
  progressions: { exo: Exercice; avant: number; apres: number; pct: number; detail?: string }[]
  /** Exercices sans progrès depuis 3 semaines ou plus à la fin de la période, avec les pistes (voir `lib/blocages`). */
  stagnations: { exo: Exercice; semaines: number; seances: number; pistes: string[] }[]
  douleurs: { exo: Exercice; date: string; n: number }[]
  rpe: number | null
  ressenti: number | null
  energie: number | null
  /** Poids moyen de la première et de la dernière semaine pesées, et les semaines qui les séparent. */
  poids: { debut: number; fin: number; semaines: number } | null
  /** Sommeil moyen (heures) sur les nuits notées. */
  sommeil: { moyenne: number; nuits: number } | null
  /** Jours notés face à l'objectif calories. */
  calories: { ok: number; trop: number; pasAssez: number }
  mesures: { cle: string; debut: number; fin: number }[]
}

/** Tout ce qu'on peut dire d'une période, à partir des séances, pesées, mesures et activités. */
export function analyser(d: DonneesBilan, debut: string, fin: string, prevuesParSemaine = 0, phase?: Phase): Analyse {
  const premiere = d.seances.reduce<string | null>((a, s) => (!a || s.date < a ? s.date : a), null)
  const depart = premiere && semaineDe(premiere) > semaineDe(debut) && semaineDe(premiere) <= semaineDe(fin) ? semaineDe(premiere) : semaineDe(debut)
  const debutEffectif = depart > semaineDe(debut) ? depart : debut
  const periode = d.seances.filter((s) => s.date >= debutEffectif && s.date <= fin).sort((a, b) => a.debut - b.debut)
  const travail = periode.filter((s) => !s.deload)
  const semaines: string[] = []
  for (let l = depart; l <= semaineDe(fin); l = dateISO(new Date(Date.parse(l + 'T12:00:00') + SEMAINE))) semaines.push(l)
  const semainesDeload = new Set(periode.filter((s) => s.deload).map((s) => semaineDe(s.date)))
  const nbTravail = Math.max(1, semaines.filter((l) => !semainesDeload.has(l)).length)

  // Volume moyen par semaine (hors déload)
  const total = volumeParMuscle(travail, d.exercices)
  const volume = Object.fromEntries(MUSCLES.map((m) => [m.id, total[m.id] / nbTravail])) as Record<Muscle, number>

  // Records : on rejoue tout l'historique pour savoir ce qui a été battu pendant la période.
  const meilleur: Record<string, number> = {}
  const records: Record_[] = []
  for (const s of [...d.seances].sort((a, b) => a.debut - b.debut)) {
    if (s.deload) continue
    const duJour = new Map<string, { score: number; serie: Serie }>()
    for (const x of s.series) {
      if (x.reps <= 0) continue
      const score = scoreSerie(d.exo(x.exoId), x, s.poidsCorps)
      if (!duJour.has(x.exoId) || score > duJour.get(x.exoId)!.score) duJour.set(x.exoId, { score, serie: x })
    }
    for (const [id, { score, serie }] of duJour) {
      if (meilleur[id] !== undefined && score > meilleur[id] && s.date >= debutEffectif && s.date <= fin)
        records.push({ date: s.date, exo: d.exo(id), perf: chargeQte(d.exo(id), serie.charge, serie.reps) })
      meilleur[id] = Math.max(meilleur[id] ?? 0, score)
    }
  }

  // Progressions et stagnations, exercice par exercice
  const ids = [...new Set(travail.flatMap((s) => s.series.map((x) => x.exoId)))]
  const anterieures = [...d.seances].filter((s) => !s.deload && s.date < debutEffectif).sort((a, b) => b.debut - a.debut)
  const progressions: Analyse['progressions'] = []
  const stagnations: Analyse['stagnations'] = []
  for (const id of ids) {
    const exo = d.exo(id)
    const avec = travail.filter((s) => s.series.some((x) => x.exoId === id))
    const sAvant: Seance | undefined = avec.length >= 2 ? avec[0] : anterieures.find((s) => s.series.some((x) => x.exoId === id))
    const sApres: Seance | undefined = avec[avec.length - 1]
    const top = (s: Seance) => Math.max(0, ...s.series.filter((x) => x.exoId === id).map((x) => e1rm(exo, x, s.poidsCorps) ?? 0))
    if (sAvant && sApres && sAvant.id !== sApres.id) {
      if (top(sAvant) > 0 && top(sApres) > 0) {
        const avant = top(sAvant)
        const apres = top(sApres)
        progressions.push({ exo, avant, apres, pct: ((apres - avant) / avant) * 100 })
      } else {
        const mAvant = meilleureSerie(sAvant.series.filter((x) => x.exoId === id && x.reps > 0))
        const mApres = meilleureSerie(sApres.series.filter((x) => x.exoId === id && x.reps > 0))
        if (mAvant && mApres && scoreSerie(exo, mApres, sApres.poidsCorps) > scoreSerie(exo, mAvant, sAvant.poidsCorps)) {
          const pct =
            mAvant.charge > 0 && mApres.charge !== mAvant.charge
              ? ((mApres.charge - mAvant.charge) / mAvant.charge) * 100
              : mAvant.reps > 0
                ? ((mApres.reps - mAvant.reps) / mAvant.reps) * 100
                : 0
          if (pct > 0)
            progressions.push({
              exo,
              avant: mAvant.charge || mAvant.reps,
              apres: mApres.charge || mApres.reps,
              pct,
              detail: `${chargeQte(exo, mAvant.charge, mAvant.reps)} → ${chargeQte(exo, mApres.charge, mApres.reps)}`,
            })
        }
      }
    }
    const b = diagnostic(exo, { seances: d.seances, journal: d.journal, pesees: d.pesees, phase }, fin)
    if (b) stagnations.push({ exo, semaines: b.semaines, seances: b.seances, pistes: b.pistes })
  }
  progressions.sort((a, b) => b.pct - a.pct)

  // Douleurs signalées sur la période
  const idsDouleur = [...new Set(periode.flatMap((s) => s.series.filter((x) => x.douleur).map((x) => x.exoId)))]
  const douleurs = idsDouleur
    .map((id) => {
      const touchees = periode.filter((s) => s.series.some((x) => x.exoId === id && x.douleur))
      return { exo: d.exo(id), date: touchees[touchees.length - 1].date, n: touchees.length }
    })
    .sort((a, b) => b.date.localeCompare(a.date))

  // Semaines enchaînées (en remontant depuis la fin de la période)
  let enchainees = 0
  for (let k = semaines.length - 1; k >= 0 && periode.some((s) => semaineDe(s.date) === semaines[k]); k--) enchainees++

  const notes = (f: (s: (typeof periode)[number]) => number | undefined) => moyenne(periode.map(f).filter((x): x is number => x !== undefined))
  const pesees = d.pesees.filter((p) => p.date >= debutEffectif && p.date <= fin)
  const moyennePesees = (l: string) => moyenne(pesees.filter((p) => semaineDe(p.date) === l).map((p) => p.poids))
  const parSemainePoids = semaines.map(moyennePesees)
  const avecPoids = parSemainePoids.filter((x): x is number => x !== null)
  const pesees1 = parSemainePoids.map((x, k) => (x !== null ? k : -1)).filter((k) => k >= 0)
  const ecartSemaines = pesees1.length ? pesees1[pesees1.length - 1] - pesees1[0] : 0
  const mesures = d.mesures.filter((m) => m.date >= debutEffectif && m.date <= fin).sort((a, b) => a.date.localeCompare(b.date))
  const sports = d.activites.filter((a) => a.date >= debutEffectif && a.date <= fin)

  return {
    debut: debutEffectif,
    semaines,
    seances: periode.length,
    deloads: periode.length - travail.length,
    prevues: prevuesParSemaine ? prevuesParSemaine * semaines.length : null,
    ...(() => {
      // Par semaine : 5 séances une semaine ne rattrapent pas une semaine sautée.
      const parSem = semaines.map((l) => periode.filter((s) => semaineDe(s.date) === l).length)
      if (!prevuesParSemaine) return { faites: periode.length, enPlus: 0 }
      return { faites: parSem.reduce((a, n) => a + Math.min(n, prevuesParSemaine), 0), enPlus: parSem.reduce((a, n) => a + Math.max(0, n - prevuesParSemaine), 0) }
    })(),
    temps: periode.reduce((a, s) => a + dureeReelle(s), 0),
    dures: travail.reduce((a, s) => a + s.series.filter(estDure).length, 0),
    tonnage: periode.reduce((a, s) => a + s.series.reduce((b, x) => b + kgSouleves(x, d.exo(x.exoId)), 0), 0),
    sports: { n: sports.length, minutes: sports.reduce((a, x) => a + x.duree, 0) },
    enchainees,
    volume,
    records,
    progressions,
    stagnations,
    douleurs,
    rpe: moyenne(travail.flatMap((s) => s.series.filter(estDure).map((x) => x.rpe))),
    ...(() => {
      const jours = (d.journal ?? []).filter((j) => j.date >= debutEffectif && j.date <= fin)
      const nuits = jours.filter((j) => j.sommeil !== undefined).map((j) => j.sommeil!)
      const n = (c: string) => jours.filter((j) => j.calories === c).length
      return { sommeil: nuits.length ? { moyenne: moyenne(nuits)!, nuits: nuits.length } : null, calories: { ok: n('ok'), trop: n('trop'), pasAssez: n('pasAssez') } }
    })(),
    ressenti: notes((s) => s.ressenti),
    energie: notes((s) => s.energie),
    poids: avecPoids.length >= 2 ? { debut: avecPoids[0], fin: avecPoids[avecPoids.length - 1], semaines: ecartSemaines } : null,
    mesures:
      mesures.length >= 2
        ? Object.keys(mesures[mesures.length - 1].valeurs)
            .filter((c) => mesures[0].valeurs[c] !== undefined)
            .map((c) => ({ cle: c, debut: mesures[0].valeurs[c], fin: mesures[mesures.length - 1].valeurs[c] }))
        : [],
  }
}

/**
 * « À retenir » : quelques phrases qui disent quoi faire, par des règles simples et sûres.
 * `avant` : la période précédente de même durée, pour les tendances.
 * `enCours` : la semaine n'est pas terminée (on ne reproche pas les séances ou muscles restants).
 */
export function aRetenir(a: Analyse, avant: Analyse | null, cibles: Record<Muscle, number>, enCours = false, phase?: Phase, depuisPhase?: Analyse): string[] {
  if (a.seances < 2) return ['Pas encore assez de séances sur cette période pour en tirer des conclusions : reviens après quelques séances.']
  const r: string[] = []
  const nom = (m: Muscle) => MUSCLES.find((x) => x.id === m)!.nom

  // Douleurs signalées en priorité
  for (const d of a.douleurs.slice(0, 2))
    r.push(`⚠️ Douleur signalée sur ${d.exo.nom}${d.n > 1 ? ` (${d.n} séances)` : ''} : adapte la charge ou remplace l’exercice si ça persiste.`)

  // Lecture selon la phase : perfs et poids n'ont pas le même sens en sèche et en prise. On ne juge
  // que depuis le début de la phase (`depuisPhase`), pas sur des semaines d'une autre phase.
  if (phase) {
    const ap = depuisPhase ?? a
    const lecture = lecturePhase(ap, phase)
    r.push(...lecture)
    if (!lecture.length && phase !== 'maintien' && !(ap.poids && ap.poids.semaines >= 2) && ap.progressions.length < 2)
      r.push(`${nomPhase(phase)} : pas encore assez de données depuis le début de la phase pour juger (il faut 2 semaines de pesées).`)
  }

  // Sommeil court : il explique souvent une baisse de forme avant le programme.
  if (a.sommeil && a.sommeil.nuits >= 3 && a.sommeil.moyenne < 6.5)
    r.push(`Sommeil moyen ${heuresTexte(a.sommeil.moyenne)} sur ${a.sommeil.nuits} nuits : sous 7 h, la récupération et les perfs en pâtissent.`)

  // Assiduité
  if (a.prevues) {
    const enPlus = a.enPlus ? ` (+${a.enPlus} en plus)` : ''
    if (a.faites >= a.prevues) r.push(`Assiduité parfaite : ${a.faites} séances sur ${a.prevues} prévues${enPlus}.`)
    else if (!enCours && a.faites < a.prevues * 0.75) r.push(`${a.faites} séances sur ${a.prevues} prévues${enPlus} : la régularité compte plus que tout le reste, mieux vaut chaque semaine que des semaines chargées.`)
  }

  // Muscles à zéro, puis en retard (les plus en retard d'abord) — seulement une fois la semaine finie
  if (!enCours) {
    const suivis = MUSCLES.filter((m) => cibles[m.id] > 0)
    const zero = suivis.filter((m) => a.volume[m.id] === 0)
    if (zero.length)
      r.push(`${zero.slice(0, 3).map((m) => m.nom).join(', ')}${zero.length > 3 ? ` et ${zero.length - 3} autre${zero.length > 4 ? 's' : ''}` : ''} : aucune série dure sur la période.`)
    const retard = suivis
      .filter((m) => a.volume[m.id] > 0 && a.volume[m.id] < cibles[m.id] * 0.75)
      .sort((x, y) => a.volume[x.id] / cibles[x.id] - a.volume[y.id] / cibles[y.id])
      .slice(0, 2)
    for (const m of retard) {
      const v = arrondi(a.volume[m.id])
      r.push(`${nom(m.id)} en retard : ${kg(v)} série${v >= 2 ? 's' : ''} dure${v >= 2 ? 's' : ''} par semaine sur ${kg(cibles[m.id])}.`)
    }
  }

  // Blocages, avec ce qui peut les expliquer
  for (const s of a.stagnations.slice(0, 2))
    r.push(`${s.exo.nom} : pas de progrès depuis ${s.semaines} semaines (${s.seances} séances). ${s.pistes.length ? `Pistes : ${s.pistes.join(', ')}.` : 'Tente +1 rep ou un cran de charge, ou une variante.'}`)

  // Recompo : la taille baisse pendant que la force monte
  const taille = a.mesures.find((m) => m.cle === 'taille')
  const force = moyenne(a.progressions.map((p) => p.pct))
  if (taille && taille.fin <= taille.debut - 0.5 && force !== null && force > 0)
    r.push(`Taille ${kg(arrondi(taille.fin - taille.debut))} cm pendant que tes charges montent (+${kg(arrondi(force))} % en moyenne) : ta recompo fonctionne.`)

  // Fatigue : RPE en hausse et énergie en baisse par rapport à la période d'avant
  if (avant && a.rpe !== null && avant.rpe !== null && a.energie !== null && avant.energie !== null && a.rpe >= avant.rpe + 0.5 && a.energie <= avant.energie - 0.5)
    r.push('RPE en hausse et énergie en baisse par rapport à la période d’avant : signe de fatigue, pense au déload.')

  // Records
  if (a.records.length) {
    const d = a.records[a.records.length - 1]
    r.push(`${a.records.length} record${a.records.length > 1 ? 's' : ''} battu${a.records.length > 1 ? 's' : ''}, dont ${d.exo.nom} à ${d.perf}.`)
  }

  return r.slice(0, 5).length ? r.slice(0, 5) : ['Rien à signaler : continue comme ça.']
}

/**
 * Ce que disent les perfs et le poids selon la phase (règles simples, sans IA). Force = moyenne des
 * progressions de la période ; vitesse du poids en % par semaine entre la 1re et la dernière semaine pesées.
 */
export function lecturePhase(a: Analyse, phase: Phase): string[] {
  const r: string[] = []
  const force = a.progressions.length >= 2 ? moyenne(a.progressions.map((p) => p.pct)) : null
  const p = a.poids && a.poids.semaines >= 2 ? a.poids : null
  const parSemaine = p ? (p.fin - p.debut) / p.semaines : null
  const pctSemaine = p && parSemaine !== null ? (parSemaine / p.debut) * 100 : null
  const kgSem = (x: number) => `${x > 0 ? '+' : '−'}${kg(Math.abs(arrondi(x, 2)))} kg par semaine`
  const forceTxt = force !== null ? `${force > 0 ? '+' : '−'}${kg(Math.abs(arrondi(force)))} %` : ''

  // Calories notées : tenues souvent (≥ 70 % de 4 jours ou plus) → c'est l'objectif qu'il faut revoir, sinon c'est l'écart.
  const c = a.calories ?? { ok: 0, trop: 0, pasAssez: 0 }
  const notes = c.ok + c.trop + c.pasAssez
  const tenues = notes >= 4 && c.ok / notes >= 0.7
  if (phase === 'seche') {
    if (force !== null && force <= -5) r.push(`En sèche, tes charges baissent (${forceTxt} en moyenne) : ton déficit est peut-être trop fort, ou tu dors trop peu. Mange un peu plus autour des séances.`)
    if (pctSemaine !== null && pctSemaine < -1) r.push(`Tu perds vite (${kgSem(parSemaine!)}, plus de 1 % de ton poids) : risque de perdre du muscle, ralentis un peu.`)
    else if (pctSemaine !== null && pctSemaine >= -0.1)
      r.push(
        tenues
          ? `En sèche, ton poids ne baisse pas (${kgSem(parSemaine!)}) alors que tu tiens tes calories ${c.ok} jours sur ${notes} : ton objectif est peut-être trop haut, essaie 150 kcal de moins.`
          : notes >= 4 && c.trop >= 2
            ? `En sèche, ton poids ne baisse pas (${kgSem(parSemaine!)}) : ${c.trop} jours notés au-dessus de l’objectif peuvent l’expliquer.`
            : `En sèche, mais ton poids ne baisse pas (${kgSem(parSemaine!)}) : réduis un peu ce que tu manges.`
      )
    else if (pctSemaine !== null && force !== null && force > -2) r.push(`Sèche qui marche : ${kgSem(parSemaine!)} et des charges tenues (${forceTxt}).`)
  }
  // Prise : viser +0,15 à +0,25 kg par semaine ; on corrige de 100 kcal sous +0,1 ou au-dessus de +0,4.
  if (phase === 'prise' && parSemaine !== null) {
    const constat = parSemaine <= 0 ? 'ne monte pas' : 'monte trop peu'
    if (parSemaine < 0.1)
      r.push(
        tenues
          ? `En prise, ton poids ${constat} (${kgSem(parSemaine)}) alors que tu tiens tes calories ${c.ok} jours sur ${notes} : ton objectif est peut-être trop bas, essaie 100 kcal de plus.`
          : notes >= 4 && c.pasAssez >= 2
            ? `En prise, ton poids ${constat} (${kgSem(parSemaine)}) : ${c.pasAssez} jours notés sous l’objectif peuvent l’expliquer.`
            : `En prise, mais ton poids ${constat} (${kgSem(parSemaine)}) : mange un peu plus (vise +0,15 à +0,25 kg par semaine).`
      )
    else if (parSemaine > 0.4) r.push(`Tu prends vite (${kgSem(parSemaine)}) : une partie risque d’être du gras, baisse de 100 kcal.`)
  }
  if (phase === 'prise') {
    if (force !== null && force <= 0 && a.seances >= 4)
      r.push(`En prise, tes charges ne montent pas (${forceTxt}) : vise +1 rep par semaine sur la moitié de tes exercices, et un cran de charge toutes les 2 à 4 semaines sur les gros mouvements (les conseils 💡 en fin de séance t’aident).`)
    else if (force !== null && force > 0 && parSemaine !== null && parSemaine >= 0.1 && parSemaine <= 0.4) r.push(`Prise qui marche : ${kgSem(parSemaine)} et des charges en hausse (${forceTxt}).`)
  }
  return r
}

const heuresTexte = (h: number) => `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}`

/** « Taille », « Bras droit »… */
export const libelleMesure = (cle: string) => nomCle(cle)
