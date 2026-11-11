import { MUSCLES } from '../data/exercices'
import { nomCle } from '../data/mesures'
import type { Exercice, Muscle, Serie } from '../types'
import { chargeQte, dateISO, estDure, heuresMinutes, jourSemaine, kg, kgSouleves, lundi, volumeParMuscle } from './calc'
import type { DonneesBilan } from './bilan'
import { dureeReelle, evolutionForce, meilleureSerie, pctCharges, seanceSemaineAllegee, semaineDe, sensPerf, serieComptee, suiviProgres } from './historique'
import { gain } from './constat'
import { nomPhase, phaseA, type Phase } from './objectifs'
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
  /** Semaines d'affilée avec au moins une séance, jusqu'à la dernière semaine de la période. */
  enchainees: number
  /** Séries dures par semaine, moyenne hors semaines de déload. */
  volume: Record<Muscle, number>
  records: Record_[]
  /**
   * Évolution de la meilleure série de travail sur la période, en charge et en reps (jamais l'effort noté ni la force
   * estimée) : `sens` dit si ça monte, `pct` de combien (`pctCharges`), `detail` « 60 kg × 10 → 62,5 kg × 8 ».
   */
  progressions: { exo: Exercice; avant: Serie; apres: Serie; sens: -1 | 0 | 1; pct: number; detail: string }[]
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
  /** Pas par jour lus dans Health Connect (jours finis seulement : celui d'aujourd'hui n'est pas complet). */
  pas: { moyenne: number; min: number; max: number; jours: number } | null
  /** Jours notés face à l'objectif calories. */
  calories: { ok: number; trop: number; pasAssez: number }
  mesures: { cle: string; debut: number; fin: number }[]
}

/** Tout ce qu'on peut dire d'une période, à partir des séances, pesées, mesures et activités. */
export function analyser(d: DonneesBilan, debut: string, fin: string, prevuesParSemaine: number | ((lundi: string) => number) = 0, phase?: Phase): Analyse {
  const prevuDe = typeof prevuesParSemaine === 'function' ? prevuesParSemaine : () => prevuesParSemaine
  const premiere = d.seances.reduce<string | null>((a, s) => (!a || s.date < a ? s.date : a), null)
  const depart = premiere && semaineDe(premiere) > semaineDe(debut) && semaineDe(premiere) <= semaineDe(fin) ? semaineDe(premiere) : semaineDe(debut)
  const debutEffectif = depart > semaineDe(debut) ? depart : debut
  const periode = d.seances.filter((s) => s.date >= debutEffectif && s.date <= fin).sort((a, b) => a.debut - b.debut)
  const travail = periode.filter((s) => !s.deload)
  const semaines: string[] = []
  for (let l = depart; l <= semaineDe(fin); l = dateISO(new Date(Date.parse(l + 'T12:00:00') + SEMAINE))) semaines.push(l)
  const semainesDeload = new Set(periode.filter(seanceSemaineAllegee).map((s) => semaineDe(s.date)))
  // Une semaine mise en pause ne compte ni dans le prévu, ni dans la moyenne de volume (sauf si on s'est entraîné quand même).
  const pausees = new Set((d.cycles ?? []).flatMap((c) => c.pauses))
  const nbTravail = Math.max(1, semaines.filter((l) => !semainesDeload.has(l) && !(pausees.has(l) && !periode.some((s) => semaineDe(s.date) === l))).length)

  // Volume moyen par semaine (hors déload)
  // Une séance allégée pour un seul jour reste dans le volume de sa semaine, qui reste comptée.
  const total = volumeParMuscle(periode.filter((s) => !seanceSemaineAllegee(s)), d.exercices)
  const volume = Object.fromEntries(MUSCLES.map((m) => [m.id, total[m.id] / nbTravail])) as Record<Muscle, number>

  // Records : on rejoue tout l'historique pour savoir ce qui a été battu pendant la période (même mesure que partout : `suiviProgres`).
  const suivis = new Map<string, ReturnType<typeof suiviProgres>>()
  const records: Record_[] = []
  for (const s of [...d.seances].sort((a, b) => a.debut - b.debut)) {
    if (s.deload) continue
    for (const id of new Set(s.series.map((x) => x.exoId))) {
      const series = s.series.filter((x) => x.exoId === id && serieComptee(x))
      if (!series.length) continue
      if (!suivis.has(id)) suivis.set(id, suiviProgres(d.exo(id)))
      const battu = suivis.get(id)!.juger(series).record
      const serie = meilleureSerie(series, d.exo(id).assistance)!
      if (battu && s.date >= debutEffectif && s.date <= fin) records.push({ date: s.date, exo: d.exo(id), perf: chargeQte(d.exo(id), serie.charge, serie.reps) })
    }
  }

  // Progressions et stagnations, exercice par exercice
  const ids = [...new Set(travail.flatMap((s) => s.series.map((x) => x.exoId)))]
  const anterieures = [...d.seances].filter((s) => !s.deload && s.date < debutEffectif).sort((a, b) => b.debut - a.debut)
  const progressions: Analyse['progressions'] = []
  const stagnations: Analyse['stagnations'] = []
  for (const id of ids) {
    const exo = d.exo(id)
    // Mesuré comme les blocages (séries de travail seulement, charge et reps), meilleure des 2 premières séances
    // face à la meilleure des 2 dernières ; une seule séance sur la période : face à la dernière d'avant.
    const avec = travail.filter((s) => s.series.some((x) => x.exoId === id))
    const anterieure = anterieures.find((s) => s.series.some((x) => x.exoId === id))
    const ev = evolutionForce(exo, avec.length >= 2 || !anterieure ? avec : [anterieure, ...avec])
    if (ev) {
      const [avant, apres] = [ev.avant.serie, ev.apres.serie]
      progressions.push({ exo, avant, apres, sens: sensPerf(exo, avant, apres), pct: pctCharges(exo, avant, apres), detail: `${chargeQte(exo, avant.charge, avant.reps)} → ${chargeQte(exo, apres.charge, apres.reps)}` })
    }
    const b = diagnostic(exo, { seances: d.seances, journal: d.journal, pesees: d.pesees, phase, debutPhase: d.objectifs && phaseA(d.objectifs, fin)?.debut, objectifs: d.objectifs }, fin)
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

  return {
    debut: debutEffectif,
    semaines,
    seances: periode.length,
    deloads: periode.length - travail.length,
    prevues: semaines.some((l) => prevuDe(l) > 0) ? semaines.reduce((x, l) => x + (pausees.has(l) ? 0 : prevuDe(l)), 0) : null,
    ...(() => {
      // Par semaine : 5 séances une semaine ne rattrapent pas une semaine sautée.
      if (!semaines.some((l) => prevuDe(l) > 0)) return { faites: periode.length, enPlus: 0 }
      const parSem = semaines.map((l) => ({ n: periode.filter((s) => semaineDe(s.date) === l).length, prevu: pausees.has(l) ? 0 : prevuDe(l) }))
      return { faites: parSem.reduce((a, x) => a + Math.min(x.n, x.prevu), 0), enPlus: parSem.reduce((a, x) => a + Math.max(0, x.n - x.prevu), 0) }
    })(),
    temps: periode.reduce((a, s) => a + dureeReelle(s), 0),
    dures: travail.reduce((a, s) => a + s.series.filter(estDure).length, 0),
    tonnage: periode.reduce((a, s) => a + s.series.reduce((b, x) => b + kgSouleves(x, d.exo(x.exoId)), 0), 0),
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
      const pas = jours.filter((j) => j.pas !== undefined && j.date < dateISO()).map((j) => j.pas!)
      return {
        sommeil: nuits.length ? { moyenne: moyenne(nuits)!, nuits: nuits.length } : null,
        pas: pas.length ? { moyenne: Math.round(moyenne(pas)!), min: Math.min(...pas), max: Math.max(...pas), jours: pas.length } : null,
        calories: { ok: n('ok'), trop: n('trop'), pasAssez: n('pasAssez') },
      }
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

/** Semaines finies depuis la semaine de la première séance : les jauges de muscles attendent d'en avoir 2, une seule semaine ne juge rien. */
/**
 * Lundi de la première semaine que le Bilan ne lit pas encore. D'habitude, la semaine en cours ; le dimanche, la
 * suivante : la semaine qui s'achève compte déjà, pour faire son point avant d'attaquer la nouvelle (choix de
 * l'utilisateur, 10 nov. 2026). Le lundi ne juge toujours rien.
 */
export function semaineOuverte(d = new Date()): string {
  const l = lundi(d)
  if (jourSemaine(d) !== 7) return l
  const x = new Date(l + 'T12:00:00')
  x.setDate(x.getDate() + 7)
  return dateISO(x)
}

export function semainesFinies(dates: string[], lundiCetteSemaine: string): number {
  if (!dates.length) return 0
  const premiere = semaineDe(dates.reduce((x, d) => (d < x ? d : x)))
  return Math.max(0, Math.round((Date.parse(lundiCetteSemaine) - Date.parse(premiere)) / SEMAINE))
}

const JOUR_MS = 86400000

/** Dates du Bilan au choix : ce qui les empêche de donner un bilan, ou null. Moins de 7 jours ne permet de rien comparer. */
export function erreurDates(du: string, au: string, aujourdhui: string): string | null {
  if (!du || !au) return 'Choisis les deux dates.'
  if (du > au) return 'La date de début doit venir avant la date de fin.'
  if (au > aujourdhui) return 'Choisis une date de fin passée.'
  if (Math.round((Date.parse(au) - Date.parse(du)) / JOUR_MS) + 1 < 7) return 'Choisis au moins 7 jours pour avoir un bilan.'
  return null
}

/** Du premier lundi au dernier dimanche compris dans les dates ; null s'il n'y a aucune semaine entière. */
export function semainesEntieres(debut: string, fin: string): { debut: string; fin: string; n: number } | null {
  const plus = (iso: string, jours: number) => dateISO(new Date(Date.parse(iso + 'T12:00:00') + jours * JOUR_MS))
  const lundi = semaineDe(debut) === debut ? debut : plus(semaineDe(debut), 7)
  const dimanche = plus(semaineDe(plus(fin, 1)), -1)
  if (lundi > dimanche) return null
  return { debut: lundi, fin: dimanche, n: Math.round((Date.parse(dimanche) - Date.parse(lundi) + JOUR_MS) / SEMAINE) }
}

/**
 * Bilan sur des dates au choix. Une semaine coupée ferait croire à des séances manquées et à des muscles
 * trop peu travaillés : la régularité et le volume ne lisent que les semaines entières, et sans aucune
 * semaine entière, il n'y a pas de prévu et le volume est ramené à la durée réelle.
 */
export function analyserDates(d: DonneesBilan, debut: string, fin: string, prevuesParSemaine: number | ((lundi: string) => number) = 0, phase?: Phase): { analyse: Analyse; entieres: number; coupees: boolean } {
  const brut = analyser(d, debut, fin, prevuesParSemaine, phase)
  const ent = semainesEntieres(debut, fin)
  if (ent) {
    const sur = analyser(d, ent.debut, ent.fin, prevuesParSemaine, phase)
    return { analyse: { ...brut, prevues: sur.prevues, faites: sur.faites, enPlus: sur.enPlus, volume: sur.volume }, entieres: ent.n, coupees: ent.debut !== debut || ent.fin !== fin }
  }
  const semaines = (Date.parse(fin) - Date.parse(brut.debut) + JOUR_MS) / SEMAINE
  const volume = Object.fromEntries(Object.entries(brut.volume).map(([m, v]) => [m, (v * brut.semaines.length) / semaines])) as Analyse['volume']
  return { analyse: { ...brut, prevues: null, faites: 0, enPlus: 0, volume }, entieres: 0, coupees: true }
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
    r.push(`Sommeil moyen ${heuresMinutes(a.sommeil.moyenne)} sur ${a.sommeil.nuits} nuits : sous 6 h 30, la récupération et les perfs en pâtissent.`)

  // Assiduité
  if (a.prevues) {
    const enPlus = a.enPlus ? ` (+${a.enPlus} en plus)` : ''
    if (a.faites >= a.prevues) r.push(`Assiduité parfaite : ${a.faites} séances sur ${a.prevues} prévues${enPlus}.`)
    else if (!enCours && a.faites < a.prevues * 0.75) r.push(`${a.faites} séance${a.faites > 1 ? 's' : ''} sur ${a.prevues} prévues${enPlus} : la régularité compte plus que tout le reste, mieux vaut chaque semaine que des semaines chargées.`)
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
      r.push(`${nom(m.id)} un peu léger : ${kg(v)} série${v >= 2 ? 's' : ''} dure${v >= 2 ? 's' : ''} par semaine, le conseil est à ${kg(cibles[m.id])}.`)
    }
  }

  // Blocages, avec ce qui peut les expliquer
  for (const s of a.stagnations.slice(0, 2))
    r.push(`${s.exo.nom} : pas de progrès depuis ${s.semaines} semaines (${s.seances} séances). ${s.pistes.length ? `Pistes : ${s.pistes.join(', ')}.` : 'Tente +1 rep ou un cran de charge, ou une variante.'}`)

  // La taille baisse pendant que la force monte
  const taille = a.mesures.find((m) => m.cle === 'taille')
  const force = moyenne(a.progressions.map((p) => p.pct))
  if (taille && taille.fin <= taille.debut - 0.5 && force !== null && force > 0)
    r.push(`Taille ${kg(arrondi(taille.fin - taille.debut))} cm pendant que tes charges montent (+${kg(arrondi(force))} % en moyenne) : tu perds du tour de taille en gagnant en force.`)

  // Fatigue : RPE en hausse et sensations en baisse par rapport à la période d'avant
  if (avant && a.rpe !== null && avant.rpe !== null && a.energie !== null && avant.energie !== null && a.rpe >= avant.rpe + 0.5 && a.energie <= avant.energie - 0.5)
    r.push('Effort en hausse et sensations en baisse par rapport à la période d’avant : signe de fatigue, pense à une semaine allégée.')

  // Records
  if (a.records.length) {
    const d = a.records[a.records.length - 1]
    r.push(`${a.records.length} record${a.records.length > 1 ? 's' : ''} battu${a.records.length > 1 ? 's' : ''}, dont ${d.exo.nom} à ${d.perf}.`)
  }

  return r.slice(0, 5).length ? r.slice(0, 5) : ['Rien à signaler : continue comme ça.']
}

/** Une ligne d'« À retenir » à l'écran : elle peut mener à un exercice ou à la liste des blocages. */
export interface LigneEssentielle {
  texte: string
  exoId?: string
  blocages?: boolean
}

/**
 * Ce qu'il faut retenir à l'écran, 3 lignes au plus, par ordre d'importance : douleurs, lecture de la
 * phase, sommeil court, régularité en baisse, blocages (résumés), fatigue. Les muscles, les records et la
 * bonne régularité ont leur carte dans le Bilan. Le texte partagé garde tout (`aRetenir`).
 */
export function essentiel(a: Analyse, avant: Analyse | null, phase?: Phase, depuisPhase?: Analyse, arrete = false): LigneEssentielle[] {
  if (a.seances < 2) return []
  const r: LigneEssentielle[] = a.douleurs.slice(0, 2).map((d) => ({ texte: `Douleur signalée sur ${d.exo.nom}${d.n > 1 ? ` (${d.n} séances)` : ''} : adapte la charge ou remplace l’exercice si ça persiste.`, exoId: d.exo.id }))
  if (phase) for (const texte of lecturePhase(depuisPhase ?? a, phase)) r.push({ texte })
  if (a.sommeil && a.sommeil.nuits >= 3 && a.sommeil.moyenne < 6.5) r.push({ texte: `Sommeil moyen ${heuresMinutes(a.sommeil.moyenne)} sur ${a.sommeil.nuits} nuits : sous 6 h 30, la récupération et les perfs en pâtissent.` })
  // Cycle arrêté en route : pas de remarque sur les séances manquées, l'écran dit déjà qu'il s'est arrêté.
  if (!arrete && a.prevues && a.faites < a.prevues * 0.75) r.push({ texte: `${a.faites} séance${a.faites > 1 ? 's' : ''} sur ${a.prevues} prévues : mieux vaut chaque semaine que des semaines chargées.` })
  const bloques = a.stagnations
  if (bloques.length === 1) r.push({ texte: `${bloques[0].exo.nom} : pas de progrès depuis ${bloques[0].semaines} semaines.${bloques[0].pistes.length ? ` Piste : ${bloques[0].pistes[0]}.` : ''}`, exoId: bloques[0].exo.id })
  else if (bloques.length > 1) {
    const commune = bloques[0].pistes.find((p) => bloques.every((s) => s.pistes.includes(p)))
    r.push({ texte: `${bloques.length} exercices sans progrès.${commune ? ` Piste commune : ${commune}.` : ''}`, blocages: true })
  }
  if (avant && a.rpe !== null && avant.rpe !== null && a.energie !== null && avant.energie !== null && a.rpe >= avant.rpe + 0.5 && a.energie <= avant.energie - 0.5) r.push({ texte: 'Effort en hausse et sensations en baisse par rapport à la période d’avant : signe de fatigue, pense à une semaine allégée.' })
  return r.slice(0, 3)
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
  const kgSem = (x: number) => (arrondi(x, 2) === 0 ? 'stable' : `${x > 0 ? '+' : '−'}${kg(Math.abs(arrondi(x, 2)))} kg par semaine`)
  const forceArrondie = force === null ? 0 : arrondi(force)
  const forceTxt = force !== null ? `${forceArrondie > 0 ? '+' : forceArrondie < 0 ? '−' : '±'}${kg(Math.abs(forceArrondie))} %` : ''

  // Calories notées : tenues souvent (≥ 70 % de 4 jours ou plus) → c'est l'objectif qu'il faut revoir, sinon c'est l'écart.
  const c = a.calories ?? { ok: 0, trop: 0, pasAssez: 0 }
  const notes = c.ok + c.trop + c.pasAssez
  const tenues = notes >= 4 && c.ok / notes >= 0.7
  if (phase === 'seche') {
    // Charges en baisse et poids immobile : manger plus et manger moins seraient deux conseils opposés. Une seule phrase.
    if (force !== null && force <= -5 && pctSemaine !== null && pctSemaine >= -0.1) {
      r.push(`En sèche, tes charges baissent (${forceTxt} en moyenne) et ton poids ne baisse pas (${kgSem(parSemaine!)}) : le déficit n’explique pas cette baisse. Regarde d’abord ton sommeil et ta fatigue, sans changer encore ce que tu manges.`)
      return r
    }
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
  // Prise : viser +0,15 à +0,4 kg par semaine, comme le conseil des phases ; on corrige de 100 kcal sous +0,1 ou au-dessus de +0,4.
  if (phase === 'prise' && parSemaine !== null) {
    const constat = parSemaine <= 0 ? 'ne monte pas' : 'monte trop peu'
    if (parSemaine < 0.1)
      r.push(
        tenues
          ? `En prise, ton poids ${constat} (${kgSem(parSemaine)}) alors que tu tiens tes calories ${c.ok} jours sur ${notes} : ton objectif est peut-être trop bas, essaie 100 kcal de plus.`
          : notes >= 4 && c.pasAssez >= 2
            ? `En prise, ton poids ${constat} (${kgSem(parSemaine)}) : ${c.pasAssez} jours notés sous l’objectif peuvent l’expliquer.`
            : `En prise, mais ton poids ${constat} (${kgSem(parSemaine)}) : mange un peu plus (vise +0,15 à +0,4 kg par semaine).`
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

/** « Taille », « Bras droit »… */
export const libelleMesure = (cle: string) => nomCle(cle)

export interface LigneExercice {
  id: string
  nom: string
  detail: string
  valeur?: string
}

/**
 * Ce qui monte et ce qui bloque, pour le Bilan : un exercice monte si sa meilleure série est plus lourde ou a plus de
 * reps à la même charge (`sens`), ou s'il a battu un record. Un exercice bloqué n'est jamais dans « ce qui monte » :
 * les deux listes ne se contredisent pas. `parCharges` : sur un cycle, avant → après en tête.
 */
export function ceQuiMonte(a: Pick<Analyse, 'progressions' | 'records' | 'stagnations'>, parCharges: LigneExercice[] = []): { montent: LigneExercice[]; bloques: LigneExercice[] } {
  const bloque = new Set(a.stagnations.map((s) => s.exo.id))
  const records = new Map(a.records.map((r) => [r.exo.id, r.perf]))
  const avecRecord = (id: string, texte: string) => (records.has(id) ? `${texte} · record` : texte)
  const montent: LigneExercice[] = a.progressions
    .filter((p) => p.sens > 0)
    .map((p) => ({ id: p.exo.id, nom: p.exo.nom, detail: avecRecord(p.exo.id, p.detail), valeur: gain(p.exo, [p.avant], [p.apres])?.court }))
  const vus = new Set(montent.map((l) => l.id))
  for (const r of a.records) {
    if (vus.has(r.exo.id)) continue
    vus.add(r.exo.id)
    montent.push({ id: r.exo.id, nom: r.exo.nom, detail: avecRecord(r.exo.id, r.perf) })
  }
  for (const l of [...parCharges].reverse()) {
    const i = montent.findIndex((x) => x.id === l.id)
    if (i >= 0) montent.splice(i, 1)
    montent.unshift({ ...l, detail: avecRecord(l.id, l.detail) })
  }
  return {
    montent: montent.filter((l) => !bloque.has(l.id)),
    bloques: a.stagnations.map((s) => ({ id: s.exo.id, nom: s.exo.nom, detail: `${s.semaines} sem. sans progrès` })),
  }
}
