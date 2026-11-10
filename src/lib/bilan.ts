import { MUSCLES } from '../data/exercices'
import { nomCle } from '../data/mesures'
import type { Cycle, Exercice, JourJournal, Mesure, Muscle, Pesee, Seance } from '../types'
import { dateCourte, dateISO, duree, estDure, heuresMinutes, kg, lundi, niveauSensation, schemaPlan, sensationSeance, volumeParMuscle } from './calc'
import { effort } from './partageProgramme'
import { faitTexte } from './partageSeance'
import { dureeReelle, evolutionForce, recordsParSeance, seanceSemaineAllegee, semaineDe } from './historique'
import { periodes, phaseA, textePhase, type EtapeObjectifs } from './objectifs'
import { moyenneRepas, objectifDuJour, texteRepas } from './nutrition'
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
const ecart = (d: number, u: string, decimales = 1) => `${d > 0 ? '+' : d < 0 ? '−' : '±'}${kg(Math.abs(arrondi(d, decimales)))} ${u}`
const jour = (iso: string) => dateCourte(iso).replace(/^\S+ /, '')

/** Lundi de début pour « les N dernières semaines » (semaine en cours comprise). */
export const debutPeriode = (semaines: number, aujourdhui = dateISO()) =>
  dateISO(new Date(Date.parse(lundi(new Date(aujourdhui + 'T12:00:00')) + 'T12:00:00') - (semaines - 1) * SEMAINE))

/**
 * Bilan d'entraînement en texte, à partager (coach, outil d'analyse) : vue d'ensemble, semaine par
 * semaine, volume et RPE par muscle, exercice par exercice, corps, autres sports, douleurs et notes.
 */
export function genererBilan(d: DonneesBilan, debut: string, fin = dateISO(), retenir: string[] = [], semainesCoupees = false, question = ''): string {
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
  // La question de la semaine, si la personne en a écrit une : en tête, pour qu'une IA y réponde.
  if (question.trim()) lignes.push(`Ma question cette semaine : ${question.trim()}`, '')
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
  lignes.push('Effort sur 10 : 10 = échec, 8/10 = il reste environ 2 reps. Séries dures = effort 7/10 ou plus (ou échec). Fourchette 8–12 : la charge monte quand toutes les séries atteignent le haut.')

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

  // Exercice par exercice : une ligne (ce qui est visé, la 1re et la dernière séance de la période), puis la force et
  // les blocages. Pas toutes les séries : chaque séance se partage à part, et le texte doublerait (avis de l'IA de
  // l'utilisateur, 10 nov. 2026). Les séances allégées ne servent ni de 1re ni de dernière.
  titre('Exercices (ce qui est visé · 1re et dernière séance de la période)')
  const ids = [...new Set(periode.flatMap((s) => s.series.map((x) => x.exoId)))]
  for (const id of ids) {
    const exo = d.exo(id)
    const muscle = MUSCLES.find((m) => m.id === exo.muscle)?.nom ?? exo.muscle
    const avec = periode.filter((s) => s.series.some((x) => x.exoId === id))
    const normales = avec.filter((s) => !s.deload)
    const plan = [...avec].reverse().map((s) => s.exercices.find((p) => p.exoId === id)).find((p) => p && p.series.length)
    const fait = (s: Seance) => `${jour(s.date)} : ${faitTexte(exo, s.series.filter((x) => x.exoId === id))}`
    const bornes = normales.length >= 2 ? [`1re (${fait(normales[0])})`, `dernière (${fait(normales[normales.length - 1])})`] : normales.length ? [`une séance (${fait(normales[0])})`] : []
    const allegees = avec.length - normales.length
    lignes.push(
      [`${exo.nom} (${muscle.toLowerCase()})`, plan && `${schemaPlan(exo, plan)}, ${effort(plan)}`, ...bornes, allegees && `${allegees} séance${allegees > 1 ? 's' : ''} allégée${allegees > 1 ? 's' : ''} en plus`]
        .filter(Boolean)
        .join(' · ')
    )
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
  const taille = [...d.mesures].filter((m) => m.date <= fin && m.valeurs.taille !== undefined).sort((a, b) => b.date.localeCompare(a.date))[0]
  if (pesees.length || mesures.length >= 2 || taille) {
    titre('Corps')
    if (pesees.length) {
      // Moyenne de chaque semaine pesée, avec le nombre de pesées sur les jours écoulés : une semaine à 3 pesées sur 7
      // peut tromper (remarque de l'IA de l'utilisateur, 10 nov. 2026).
      const aujourdhui = dateISO()
      const parSemaine = semaines
        .map((l) => {
          const du = l < debut ? debut : l
          const dim = dateISO(new Date(Date.parse(l + 'T12:00:00') + 6 * 86400000))
          const au = [dim, fin, aujourdhui].sort()[0]
          const jours = Math.round((Date.parse(au) - Date.parse(du)) / 86400000) + 1
          const ps = pesees.filter((p) => semaineDe(p.date) === l)
          return { l, moy: moyenne(ps.map((p) => p.poids)), n: ps.length, jours }
        })
        .filter((x): x is { l: string; moy: number; n: number; jours: number } => x.moy !== null)
      lignes.push(`Poids moyen par semaine : ${parSemaine.map((x) => `sem. du ${jour(x.l)} ${kg(arrondi(x.moy, 2))} kg (${x.n}/${x.jours} pesée${x.n > 1 ? 's' : ''})`).join(' · ')}`)
      if (parSemaine.length >= 2) {
        const a = parSemaine[0]
        const b = parSemaine[parSemaine.length - 1]
        const ecartSem = Math.round((Date.parse(b.l) - Date.parse(a.l)) / SEMAINE)
        const rythme = (b.moy - a.moy) / ecartSem
        // Rythme visé : celui de la phase réglée (poids visé sur sa durée), sinon la zone générale de l'appli, la même qu'à l'écran.
        const ph = d.objectifs ? phaseA(d.objectifs, fin) : null
        const zone =
          ph?.ecartVise && ph.total
            ? `, visé par ta phase : ${ecart(ph.ecartVise, 'kg')} en ${ph.total} semaines, soit ${ecart(ph.ecartVise / ph.total, 'kg', 2)}/semaine`
            : ph?.phase === 'prise'
              ? ', zone conseillée en prise : +0,15 à +0,4 kg/semaine'
              : ph?.phase === 'seche'
                ? ', zone conseillée en sèche : −0,2 à −1 kg/semaine'
                : ''
        lignes.push(`Rythme : ${ecart(rythme, 'kg', 2)}/semaine (${ecart(b.moy - a.moy, 'kg')} en ${ecartSem} semaine${ecartSem > 1 ? 's' : ''}${zone})`)
      }
    }
    if (taille) lignes.push(`Dernier tour de taille : ${kg(taille.valeurs.taille)} cm (${jour(taille.date)})`)
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
  // Le jour même n'est pas fini : ses pas et ses repas ne comptent pas encore.
  const finis = jours.filter((j) => j.date < dateISO())
  const repas = moyenneRepas(finis, d.objectifs)
  // Avec le vrai total, le verdict n'apprend rien de plus : seuls les jours notés à la main le gardent.
  const cal = jours.filter((j) => j.calories && !j.kcalAppli)
  const pas = finis.filter((j) => j.pas !== undefined).map((j) => j.pas!)
  if (nuits.length || cal.length || pas.length || repas) {
    titre(pas.length ? 'Sommeil, pas et calories' : 'Sommeil et calories')
    if (nuits.length) {
      const m = moyenne(nuits)!
      lignes.push(`Sommeil moyen : ${heuresMinutes(m)} (${nuits.length} nuit${nuits.length > 1 ? 's' : ''} notée${nuits.length > 1 ? 's' : ''}, min ${kg(Math.min(...nuits))} h)`)
    }
    if (pas.length) lignes.push(`Pas : ${nombre(Math.round(moyenne(pas)!))} par jour en moyenne (de ${nombre(Math.min(...pas))} à ${nombre(Math.max(...pas))}, ${pas.length} jour${pas.length > 1 ? 's' : ''}, lus sur la montre ou le téléphone)`)
    if (repas) lignes.push(`Repas (${repas.jours} jour${repas.jours > 1 ? 's' : ''}, lus dans l’appli de repas), en moyenne par jour : ${texteRepas(repas)}`)
    if (cal.length) {
      const n = (c: string) => cal.filter((j) => j.calories === c).length
      lignes.push(`Calories face à l’objectif (${cal.length} jours notés${repas ? ' à la main' : ''}) : ${n('ok')} dans l’objectif, ${n('trop')} trop, ${n('pasAssez')} pas assez`)
    }
  }

  // Jour par jour, 7 derniers jours, toujours les 7 lignes (« — » pour ce qui manque), en colonnes : tenir sa cible
  // chaque jour, relier une mauvaise nuit à une mauvaise séance (même nom que dans le partage d'une séance). Pas pour
  // relier le poids d'un matin aux calories de la veille : l'eau et le sel masquent tout. La nuit est celle d'avant.
  const septJours = Array.from({ length: 7 }, (_, k) => dateISO(new Date(Date.parse(fin + 'T12:00:00') - (6 - k) * 86400000))).filter((x) => x >= debut)
  const aujourdhui = dateISO()
  const duJournal = (date: string) => d.journal?.find((x) => x.date === date)
  const poidsLe = (date: string) => d.pesees.find((p) => p.date === date)?.poids
  const auMoinsUnChiffre = septJours.some((date) => poidsLe(date) !== undefined || duJournal(date) || periode.some((s) => s.date === date))
  if (auMoinsUnChiffre) {
    const obj = d.objectifs && objectifDuJour(d.objectifs, fin)
    titre(`Jour par jour, 7 derniers jours${obj ? ` (objectif ${nombre(obj.kcal)} kcal)` : ''}`)
    lignes.push('jour | poids | kcal | protéines | sodium | pas | nuit d’avant | séance | notes')
    const tiret = '—'
    for (const date of septJours) {
      const j = duJournal(date)
      const poids = poidsLe(date)
      const ss = periode.filter((s) => s.date === date)
      // Sans appli de repas, le verdict noté à la main tient lieu de kcal.
      const kcal = j?.kcalAppli && j.kcal !== undefined ? nombre(j.kcal) : j?.calories ? (j.calories === 'ok' ? 'tenu' : j.calories === 'trop' ? 'trop' : 'pas assez') : tiret
      lignes.push(
        [
          `${dateCourte(date)}${date === aujourdhui ? ' (en cours)' : ''}`,
          poids !== undefined ? `${kg(poids)} kg` : tiret,
          kcal,
          j?.kcalAppli && j.proteines !== undefined ? `${j.proteines} g` : tiret,
          j?.kcalAppli && j.sodium !== undefined ? `${nombre(j.sodium)} mg` : tiret,
          j?.pas !== undefined ? nombre(j.pas) : tiret,
          j?.sommeil !== undefined ? heuresMinutes(j.sommeil) : tiret,
          ss.length ? ss.map((s) => s.nom).join(', ') : tiret,
          j?.note ?? '',
        ].join(' | ')
      )
    }
    // Moyenne : repas sur les jours finis, poids sur les 7 jours avec le nombre de pesées (une moyenne sur peu de pesées peut tromper).
    const finis7 = septJours.filter((x) => x < aujourdhui).map(duJournal).filter((x): x is JourJournal => !!x)
    const r = moyenneRepas(finis7, d.objectifs)
    const poids7 = septJours.map(poidsLe).filter((x): x is number => x !== undefined)
    const morceaux = [r && texteRepas(r), poids7.length && `poids moyen ${kg(arrondi(moyenne(poids7)!, 2))} kg (${poids7.length}/${septJours.length} pesée${poids7.length > 1 ? 's' : ''})`].filter(Boolean)
    if (morceaux.length) lignes.push(`Moyenne (repas sur les jours finis) : ${morceaux.join(' · ')}`)
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
