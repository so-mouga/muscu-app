import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import type { Catalogue } from '../catalogue'
import Aide from '../components/Aide'
import { informer } from '../components/Dialogues'
import { NiveauJauge } from '../components/VolumeMuscles'
import { db } from '../db'
import { phaseA } from '../lib/objectifs'
import { BONUS_PRIORITE, cycleDuBilan, etatCycle, lundiDe, nomCycle } from '../lib/cycle'
import { MUSCLES } from '../data/exercices'
import { analyser, aRetenir, essentiel, semainesFinies, type Analyse } from '../lib/analyse'
import { genererBilan, type DonneesBilan } from '../lib/bilan'
import { chargeQte, dateCourte, dateISO, kg, lundi } from '../lib/calc'
import { depuisDebut, semainesTenues } from '../lib/motivation'
import { CLE_PREVUS, prevuDeSemaine, type EtapePrevu } from '../lib/prevu'
import { etatVolume, LIBELLE_VOLUME, zone } from '../lib/volume'
import type { Muscle } from '../types'

type Periode = '4' | 'cycle' | '12'

const JOUR = 86400000
const decaler = (iso: string, jours: number) => dateISO(new Date(Date.parse(iso + 'T12:00:00') + jours * JOUR))
const arrondi = (x: number) => Math.round(x * 10) / 10
const jour = (iso: string) => dateCourte(iso).replace(/^\S+ /, '')
const ecart = (d: number, u: string) => `${d > 0 ? '+' : d < 0 ? '−' : '±'}${kg(Math.abs(arrondi(d)))} ${u}`

/** Ce qu'on retrouve au retour d'une fiche d'exercice : le Bilan est démonté pendant qu'elle est ouverte. */
const memoire = { periode: '4' as Periode, defilement: 0 }

/** « Voir le bilan » d'un cycle : le Bilan s'ouvrira sur sa période. */
export const voirPeriodeCycle = () => {
  memoire.periode = 'cycle'
  memoire.defilement = 0
}

/**
 * Bilan des semaines finies : la réponse d'abord (À retenir), puis les exercices, la régularité, les
 * muscles et la forme. La semaine en cours n'y entre pas : l'accueil s'en occupe, et un lundi ne juge rien.
 */
export default function Bilan({ catalogue, haut, onExo, onTousExos, onCorps }: { catalogue: Catalogue; haut: ReactNode; onExo?: (id: string) => void; onTousExos?: () => void; onCorps?: () => void }) {
  const [periodeChoisie, setPeriodeChoisie] = useState(memoire.periode)
  const seances = useLiveQuery(() => db.seances.filter((s) => !s.enCours).toArray(), [])
  const pesees = useLiveQuery(() => db.pesees.toArray(), [], [])
  const mesures = useLiveQuery(() => db.mesures.toArray(), [], [])
  const journal = useLiveQuery(() => db.journal.toArray(), [], [])
  const cycles = useLiveQuery(() => db.cycles.toArray(), [], [])
  const prevusNotes = useLiveQuery(() => db.reglages.get(CLE_PREVUS), [])
  const donneesPretes = !!seances

  useEffect(() => {
    if (!donneesPretes || !memoire.defilement) return
    const y = memoire.defilement
    memoire.defilement = 0
    requestAnimationFrame(() => window.scrollTo({ top: y }))
  }, [donneesPretes])

  if (!seances) return null

  const ouvrirCorps = () => {
    memoire.defilement = window.scrollY
    onCorps?.()
  }
  const ouvrirExo = onExo
    ? (id: string) => {
        memoire.defilement = window.scrollY
        onExo(id)
      }
    : undefined

  const cetteSemaine = lundi()
  // Le cycle en cours, sinon le dernier terminé, y compris quand un nouveau vient d'être lancé : son bilan reste consultable.
  const cycle = cycleDuBilan(cycles, cetteSemaine)
  const cycleDispo = !!cycle && cycle.debut < cetteSemaine
  const cycleFini = !!cycle && etatCycle(cycle).fini
  const periode: Periode = periodeChoisie === 'cycle' && !cycleDispo ? '4' : periodeChoisie
  const finSemaines = decaler(cetteSemaine, -1)
  const finCycle = cycle?.fin ?? (cycle ? decaler(lundiDe(cycle, cycle.semaines), 6) : finSemaines)
  const fin = periode === 'cycle' && finCycle < finSemaines ? finCycle : finSemaines
  const debut = periode === 'cycle' && cycle ? cycle.debut : decaler(cetteSemaine, periode === '12' ? -91 : -28)

  // Objectifs de volume en vigueur à la fin de la période (ils peuvent avoir changé depuis).
  const cibles = catalogue.ciblesA(fin)
  const donnees: DonneesBilan = { seances, cycles, pesees, mesures, exo: catalogue.exo, exercices: catalogue.exercices, cibles, programme: catalogue.actif.nom, objectifs: catalogue.objectifs, journal, cycle: cycle && `Cycle « ${nomCycle(cycle)} » (${cycle.programme.nom}), ${cycleFini ? 'terminé' : `semaine ${Math.max(1, etatCycle(cycle).n)}/${cycle.semaines}`}${cycle.priorites?.length ? `, priorité : ${cycle.priorites.map((m) => MUSCLES.find((x) => x.id === m)!.nom.toLowerCase()).join(', ')} (+${BONUS_PRIORITE} séries par semaine)` : ''}` }
  const prevues = prevuDeSemaine((prevusNotes?.valeur as EtapePrevu[] | undefined) ?? [], cycles, seances, catalogue.planning.length)
  const phaseEnCours = phaseA(catalogue.objectifs, fin)
  const phaseFin = phaseEnCours?.phase
  const a = analyser(donnees, debut, fin, prevues, phaseFin)
  // La phase a commencé pendant la période : on ne la juge que depuis son début.
  const depuisPhase = phaseEnCours && phaseEnCours.debut > debut ? analyser(donnees, phaseEnCours.debut, fin, prevues, phaseFin) : undefined
  const longueur = Math.round((Date.parse(fin) - Date.parse(a.debut)) / JOUR)
  const finAvant = decaler(a.debut, -1)
  const avant = analyser(donnees, decaler(finAvant, -longueur), finAvant, prevues, phaseA(catalogue.objectifs, finAvant)?.phase)
  const lignes = essentiel(a, avant.seances > 0 ? avant : null, phaseFin, depuisPhase)
  // Sur un cycle : ce qui monte se lit en charges, de la 1re séance à la dernière.
  const parCharges = periode === 'cycle' && cycle ? depuisDebut(seances.filter((s) => s.date <= fin), catalogue.exo, cycle.debut, 8) : []
  const exercices = lectureExercices(a, parCharges.map((p) => ({ id: p.exo.id, nom: p.exo.nom, detail: `${chargeQte(p.exo, p.avant.charge, p.avant.reps)} → ${chargeQte(p.exo, p.apres.charge, p.apres.reps)}`, valeur: p.pct !== undefined ? `+${kg(arrondi(p.pct))} %` : undefined })))

  const partager = async () => {
    const texte = genererBilan(donnees, a.debut, fin, aRetenir(a, avant.seances > 0 ? avant : null, cibles, false, phaseFin, depuisPhase))
    try {
      if (typeof navigator.share === 'function') await navigator.share({ title: 'Bilan d’entraînement', text: texte })
      else {
        await navigator.clipboard.writeText(texte)
        void informer('Le bilan complet est copié : colle-le où tu veux.', 'Copié')
      }
    } catch {
      /* partage annulé */
    }
  }

  const choisirPeriode = (p: Periode) => {
    memoire.periode = p
    setPeriodeChoisie(p)
  }

  // Aucune semaine finie avec une séance : le bilan n'a encore rien à dire. Sinon, les périodes restent là, même vides.
  if (!seances.some((s) => s.date <= finSemaines))
    return (
      <div>
        {haut}
        <div className="carte bilan-carte">
          <h3>Ton bilan arrive après ta première semaine</h3>
          <p className="faible petit-texte">Tu verras ici ce qui monte, ce qui bloque, ta régularité et les muscles à renforcer.</p>
        </div>
      </div>
    )

  const choixPeriode = (
    <>
      <div className="bilan-periodes">
        {(
          [
            ['4', '4 sem.'],
            ...(cycleDispo ? [['cycle', cycleFini ? 'Dernier cycle' : 'Cycle']] : []),
            ['12', '3 mois'],
          ] as [Periode, string][]
        ).map(([id, nom]) => (
          <button key={id} type="button" className={periode === id ? 'actif' : ''} aria-pressed={periode === id} onClick={() => choisirPeriode(id)}>
            {nom}
          </button>
        ))}
      </div>
      <p className="faible bilan-periode">
        Du {jour(a.debut)} au {jour(fin)}
      </p>
    </>
  )

  if (!a.seances)
    return (
      <div>
        {haut}
        {choixPeriode}
        <div className="carte bilan-carte">
          <h3>Pas de séance sur cette période</h3>
          <p className="faible petit-texte">Tes séances d’avant restent là : choisis une autre période, ou retrouve-les dans le Journal.</p>
        </div>
      </div>
    )

  const tenues = semainesTenues(seances, prevues, cycles, dateISO())
  const muscles = MUSCLES.filter((m) => zone(m.id, cibles[m.id]))
  const horsZone = muscles
    .filter((m) => etatVolume(m.id, a.volume[m.id], cibles[m.id]) !== 'optimal')
    .sort((x, y) => a.volume[x.id] / cibles[x.id] - a.volume[y.id] / cibles[y.id])
  const dansZone = muscles.filter((m) => etatVolume(m.id, a.volume[m.id], cibles[m.id]) === 'optimal')
  const notesCalories = a.calories.ok + a.calories.trop + a.calories.pasAssez

  return (
    <div>
      {haut}
      {choixPeriode}

      {lignes.length > 0 && (
        <section className="carte bilan-carte">
          <h3>À retenir</h3>
          {lignes.map((l) =>
            l.exoId || l.blocages ? (
              <button key={l.texte} type="button" className="bilan-retenir" onClick={() => (l.exoId ? ouvrirExo?.(l.exoId) : onTousExos?.())}>
                <span>{l.texte}</span>
                <ChevronRight size={16} strokeWidth={1.75} className="muted" />
              </button>
            ) : (
              <p key={l.texte} className="bilan-retenir">
                {l.texte}
              </p>
            )
          )}
        </section>
      )}

      {exercices.montent.length + exercices.bloques.length > 0 && (
        <section className="carte bilan-carte">
          <h3>Exercices</h3>
          {exercices.montent.length > 0 && <div className="bilan-intertitre">Ce qui monte</div>}
          {exercices.montent.slice(0, 2).map((l) => (
            <LigneExo key={l.id} {...l} onClick={ouvrirExo && (() => ouvrirExo(l.id))} />
          ))}
          {exercices.bloques.length > 0 && <div className="bilan-intertitre">Ce qui bloque</div>}
          {exercices.bloques.slice(0, 2).map((l) => (
            <LigneExo key={l.id} {...l} onClick={ouvrirExo && (() => ouvrirExo(l.id))} />
          ))}
          {exercices.montent.length + exercices.bloques.length > 2 && (
            <button type="button" className="bilan-tous" onClick={() => onTousExos?.()}>
              <span>Voir tous les exercices</span>
              <ChevronRight size={16} strokeWidth={1.75} className="muted" />
            </button>
          )}
        </section>
      )}

      <section className="carte bilan-carte bilan-regularite">
        <h3>Régularité</h3>
        <p>
          <strong>{a.prevues ? `${a.faites} séance${a.faites > 1 ? 's' : ''} sur ${a.prevues}` : `${a.seances} séance${a.seances > 1 ? 's' : ''}`}</strong>
          {a.enPlus > 0 && <span className="faible"> (+{a.enPlus} en plus)</span>}
          {tenues >= 2 && <span className="tenue"> · {tenues}e semaine tenue</span>}
        </p>
      </section>

      {muscles.length > 0 && semainesFinies(seances.map((s) => s.date), cetteSemaine) < 2 && (
        <section className="carte bilan-carte bilan-regularite">
          <h3>Muscles</h3>
          <p className="faible petit-texte">Tes muscles apparaîtront ici après 2 semaines d’entraînement.</p>
        </section>
      )}

      {muscles.length > 0 && semainesFinies(seances.map((s) => s.date), cetteSemaine) >= 2 && (
        <section className="carte bilan-carte">
          <div className="ligne entre">
            <h3 className="avec-aide">
              Muscles
              <Aide titre="Séries dures" texte="Une série dure est une série proche de l’échec (effort 7/10 ou plus). C’est ce travail qui fait progresser le muscle. La zone verte de la jauge est la zone utile." />
            </h3>
            <span className="faible petit-texte">séries dures par semaine</span>
          </div>
          {horsZone.map((m) => (
            <JaugeMuscle key={m.id} muscle={m.id} nom={m.nom} valeur={a.volume[m.id]} cible={cibles[m.id]} />
          ))}
          {dansZone.length > 0 && (
            <p className="petit-texte">
              <span className="tenue">Dans la zone : </span>
              {dansZone.map((m) => `${m.nom} ${kg(arrondi(a.volume[m.id]))}`).join(' · ')}
            </p>
          )}
        </section>
      )}

      {(a.sommeil || notesCalories > 0 || a.poids) && (
        <section className="carte bilan-carte">
          <h3>Forme</h3>
          {a.sommeil && (
            <div className="ligne entre bilan-forme">
              <span>Sommeil moyen</span>
              <strong>
                {Math.floor(a.sommeil.moyenne)} h {String(Math.round((a.sommeil.moyenne % 1) * 60)).padStart(2, '0')}
              </strong>
            </div>
          )}
          {notesCalories > 0 && (
            <div className="ligne entre bilan-forme">
              <span>Calories tenues</span>
              <strong>
                {a.calories.ok} jour{a.calories.ok > 1 ? 's' : ''} sur {notesCalories}
              </strong>
            </div>
          )}
          {a.poids && (
            <button type="button" className="ligne entre bilan-forme bilan-lien" onClick={ouvrirCorps}>
              <span>Poids moyen</span>
              <span>
                <strong>{kg(arrondi(a.poids.fin))} kg</strong> <span className="faible">{ecart(a.poids.fin - a.poids.debut, 'kg')}</span>
                <ChevronRight size={16} strokeWidth={1.75} className="muted" />
              </span>
            </button>
          )}
        </section>
      )}

      <button type="button" className="bilan-partager" onClick={() => void partager()}>
        Partager ce bilan
      </button>
    </div>
  )
}

interface LigneExercice {
  id: string
  nom: string
  detail: string
  valeur?: string
}

/** Records, progressions et blocages réunis : ce qui monte (les plus forts d'abord) et ce qui bloque ; les pistes sont sur la fiche de l'exercice. */
function lectureExercices(a: Analyse, parCharges: LigneExercice[] = []) {
  const records = new Map(a.records.map((r) => [r.exo.id, r.perf]))
  const avecRecord = (id: string, texte: string) => (records.has(id) ? `${texte} · record` : texte)
  const montent: LigneExercice[] = a.progressions
    .filter((p) => p.pct > 0)
    .map((p) => ({ id: p.exo.id, nom: p.exo.nom, detail: avecRecord(p.exo.id, p.detail ?? `force estimée : ${kg(arrondi(p.avant))} → ${kg(arrondi(p.apres))} kg`), valeur: `+${kg(arrondi(p.pct))} %` }))
  const vus = new Set(montent.map((l) => l.id))
  for (const r of a.records) {
    if (vus.has(r.exo.id)) continue
    vus.add(r.exo.id)
    montent.push({ id: r.exo.id, nom: r.exo.nom, detail: avecRecord(r.exo.id, records.get(r.exo.id)!) })
  }
  // Sur un cycle : avant → après en tête, et à la place de la force estimée.
  for (const l of [...parCharges].reverse()) {
    const i = montent.findIndex((x) => x.id === l.id)
    if (i >= 0) montent.splice(i, 1)
    montent.unshift({ ...l, detail: records.has(l.id) ? `${l.detail} · record` : l.detail })
  }
  const bloques: LigneExercice[] = a.stagnations.map((s) => ({
    id: s.exo.id,
    nom: s.exo.nom,
    detail: `${s.semaines} sem. sans progrès`,
  }))
  return { montent, bloques }
}

function LigneExo({ nom, detail, valeur, onClick }: LigneExercice & { onClick?: () => void }) {
  return (
    <button type="button" className="bilan-exo" onClick={onClick} disabled={!onClick}>
      <span className="bilan-exo-texte">
        <span>{nom}</span>
        <span className="faible">{detail}</span>
      </span>
      {valeur && <strong className="tenue">{valeur}</strong>}
      <ChevronRight size={16} strokeWidth={1.75} className="muted" />
    </button>
  )
}

function JaugeMuscle({ muscle, nom, valeur, cible }: { muscle: Muscle; nom: string; valeur: number; cible: number }) {
  const z = zone(muscle, cible)!
  const etat = etatVolume(muscle, valeur, cible)
  const max = z.haut * 1.25
  return (
    <div className="bilan-jauge">
      <div className="ligne entre">
        <span>{nom}</span>
        <span>
          <strong>{kg(arrondi(valeur))}</strong> <span className={`etat-volume ${etat}`}>{LIBELLE_VOLUME[etat]}</span>
        </span>
      </div>
      <div className="jauge">
        <span className="zone-utile" style={{ left: `${(z.bas / max) * 100}%`, width: `${((z.haut - z.bas) / max) * 100}%` }} />
        <NiveauJauge muscle={muscle} etat={etat} valeur={valeur} max={max} />
      </div>
    </div>
  )
}
