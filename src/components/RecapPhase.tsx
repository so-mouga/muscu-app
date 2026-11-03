import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { Catalogue } from '../catalogue'
import { clesDe, MESURES, nomCle, PRINCIPALES } from '../data/mesures'
import { db } from '../db'
import { dateISO, kg } from '../lib/calc'
import { useRetour } from '../lib/nav'
import { ecartTexte, nomPhase, periodes, type PeriodePhase } from '../lib/objectifs'
import { poseCommune } from '../lib/photos'
import { datesPhotosPhase, finRecap, recapMesures, recapPoids } from '../lib/recap'
import { PlanchePhotos } from '../screens/Photos'
import type { PhotoCorps } from '../types'
import BoutonRetour from './BoutonRetour'
import Courbe from './Courbe'
import Deplie from './Deplie'
import { SuitePhase } from './Phases'
import PhotoDatee from './PhotoDatee'

const JOUR = 86400000
const plusJours = (iso: string, n: number) => dateISO(new Date(Date.parse(iso + 'T12:00:00') + n * JOUR))
const jour = (iso: string, annee = false) => new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', ...(annee && { year: 'numeric' }) })
const cm = (v: number) => `${kg(v)} cm`

/** Les dates d'une phase, l'année toujours écrite : on les relit parfois un an plus tard. */
export const datesPhase = (debut: string, fin: string) => `${jour(debut, debut.slice(0, 4) !== fin.slice(0, 4))} → ${jour(fin, true)}`

/** Dernier jour affiché : sa vraie fin, sinon sa fin prévue, sinon aujourd'hui. */
const finAffichee = (p: PeriodePhase, aujourdhui: string) => p.fin ?? (p.finPrevue ? plusJours(p.finPrevue, -1) : aujourdhui)

/**
 * Le corps au début et à la fin d'une phase. Des faits, sans couleur ni jugement : ce qui manque ne s'affiche pas,
 * et le détail est à un appui. L'entraînement a son propre récap (le Bilan du cycle).
 */
export default function RecapPhase({ catalogue, debut, onRetour, onSuite }: { catalogue: Catalogue; debut: string; onRetour: () => void; /** La phase est changée ou prolongée : retour à la page Phases. */ onSuite: () => void }) {
  const aujourdhui = dateISO()
  const p = periodes(catalogue.objectifs).find((x) => x.debut === debut)
  const fin = p ? finRecap(p, aujourdhui) : aujourdhui
  const pesees = useLiveQuery(() => db.pesees.toArray(), [], [])
  const mesures = useLiveQuery(() => db.mesures.toArray(), [], [])
  const seances = useLiveQuery(() => db.seances.where('date').between(debut, fin, true, true).filter((s) => !s.enCours).count(), [debut, fin], 0)
  // Les photos sont lourdes : les dates d'abord, les images du début et de la fin seulement.
  const dates = useLiveQuery(async () => datesPhotosPhase((await db.photos.orderBy('date').uniqueKeys()) as string[], debut, fin), [debut, fin], [] as string[])
  const nbPhotos = useLiveQuery(() => (dates.length ? db.photos.where('date').anyOf(dates).count() : 0), [dates.join()], 0)
  const bouts = dates.length >= 2 ? [dates[0], dates[dates.length - 1]] : []
  const photos = useLiveQuery(() => (bouts.length ? db.photos.where('date').anyOf(bouts).toArray() : []), [bouts.join()], [] as PhotoCorps[])
  const [ouverte, setOuverte] = useState<string | null>(null)
  const [voirAutres, setVoirAutres] = useState(false)
  const [voirPhotos, setVoirPhotos] = useState(false)
  const [comparer, setComparer] = useState(false)

  if (!p) return null
  const poids = recapPoids(pesees, debut, fin)
  const corps = recapMesures(mesures, debut, fin)
  const ordre = MESURES.flatMap(clesDe)
  const lignes = [...corps.lignes].sort((a, b) => Number(b.cle === 'taille') - Number(a.cle === 'taille') || ordre.indexOf(a.cle) - ordre.indexOf(b.cle))
  const principales = lignes.filter((l) => PRINCIPALES.includes(l.cle))
  const autres = lignes.filter((l) => !PRINCIPALES.includes(l.cle))
  const posesDe = (d: string) => photos.filter((x) => x.date === d)
  const pose = bouts.length ? poseCommune(posesDe(bouts[0]).map((x) => x.pose), posesDe(bouts[1]).map((x) => x.pose)) : undefined
  const paire = pose ? bouts.map((d) => posesDe(d).find((x) => x.pose === pose)!) : []
  const dernierJour = finAffichee(p, aujourdhui)
  const semaines = Math.max(1, Math.round((Date.parse(plusJours(dernierJour, 1)) - Date.parse(debut)) / (7 * JOUR)))
  const rienANoter = !poids && !lignes.length && !nbPhotos && !seances

  const ligneMesure = (l: (typeof lignes)[number]) => {
    const estOuverte = ouverte === l.cle
    return (
      <div key={l.cle} className="mesure-ligne">
        <button type="button" className={'ligne-mesure' + (estOuverte ? ' active' : '')} aria-expanded={estOuverte} onClick={() => setOuverte(estOuverte ? null : l.cle)}>
          <span>{nomCle(l.cle)}</span>
          <span>
            <strong>
              {kg(l.depart.valeur)} → {cm(l.arrivee.valeur)}
            </strong>
            <ChevronRight size={16} strokeWidth={1.75} className={'muted depliable-chevron' + (estOuverte ? ' ouvert' : '')} />
          </span>
        </button>
        <Deplie ouvert={estOuverte}>
          <div className="mesure-detail">{l.points.length >= 2 && <Courbe key={l.cle} points={l.points} format={cm} label={`Évolution : ${nomCle(l.cle)}`} sansEnTete />}</div>
        </Deplie>
      </div>
    )
  }

  return (
    <div>
      <div className="entete">
        <BoutonRetour onClick={onRetour} label="Retour aux phases" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2>{nomPhase(p.phase)}</h2>
          <div className="faible">
            {datesPhase(debut, dernierJour)} · {semaines} semaine{semaines > 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {poids && (
        <section className="carte corps-carte">
          <div className="ligne entre">
            <strong className="corps-titre">Poids</strong>
            <strong>
              {kg(poids.depart)} → {kg(poids.arrivee)} kg
            </strong>
          </div>
          <div className="faible petit-texte recap-droite">{ecartTexte(poids.ecart)}, en moyenne sur quelques jours</div>
          {poids.points.length >= 2 && <Courbe points={poids.points} format={(v) => `${kg(v)} kg`} label={`Poids pendant la phase ${nomPhase(p.phase)}`} sansEnTete />}
        </section>
      )}

      {lignes.length > 0 && (
        <section className="carte corps-carte">
          <strong className="corps-titre">Mensurations</strong>
          {principales.map(ligneMesure)}
          {autres.length > 0 && principales.length > 0 && (
            <button type="button" className="groupe-repli" onClick={() => setVoirAutres(!voirAutres)} aria-expanded={voirAutres}>
              <span>Autres mesures</span>
              <span className={'muted chevron-accordeon' + (voirAutres ? ' ouvert' : '')}>▸</span>
            </button>
          )}
          <Deplie ouvert={voirAutres || !principales.length}>{autres.map(ligneMesure)}</Deplie>
          {corps.debut && corps.fin && (
            <div className="faible petit-texte">
              Prises le {jour(corps.debut)} et le {jour(corps.fin)}
            </div>
          )}
        </section>
      )}

      {nbPhotos > 0 && (
        <section className="carte corps-carte">
          <strong className="corps-titre">Photos</strong>
          {paire.length === 2 && (
            <button type="button" className="recap-paire corps-photos" aria-label="Comparer ces deux photos en grand" onClick={() => setComparer(true)}>
              <PhotoDatee photo={paire[0]} />
              <PhotoDatee photo={paire[1]} />
            </button>
          )}
          <button type="button" className="bilan-tous" onClick={() => setVoirPhotos(true)}>
            <span>
              Voir {nbPhotos > 1 ? `les ${nbPhotos} photos` : 'la photo'} de cette phase
            </span>
            <ChevronRight size={16} strokeWidth={1.75} className="muted" />
          </button>
        </section>
      )}

      {seances > 0 && (
        <section className="carte ligne entre recap-ligne">
          <span>Séances pendant cette phase</span>
          <strong>{seances}</strong>
        </section>
      )}

      {rienANoter && <p className="faible petit-texte">Pas de pesée, de mensuration, de photo ni de séance sur ces dates.</p>}

      {!p.fin && p.finPrevue && p.finPrevue <= aujourdhui && (
        <section className="carte pile">
          <strong>Et ensuite ?</strong>
          <SuitePhase catalogue={catalogue} onChoix={onSuite} />
        </section>
      )}

      {voirPhotos && <PhotosPhase dates={dates} titre={`${nomPhase(p.phase)} · ${datesPhase(debut, dernierJour)}`} onFermer={() => setVoirPhotos(false)} />}
      {comparer && paire.length === 2 && <PlanchePhotos photos={paire} dates={bouts} pose={pose} onFermer={() => setComparer(false)} />}
    </div>
  )
}

/** Toutes les photos d'une phase, par date : elles ne se chargent qu'ici. */
function PhotosPhase({ dates, titre, onFermer }: { dates: string[]; titre: string; onFermer: () => void }) {
  const photos = useLiveQuery(() => db.photos.where('date').anyOf(dates).toArray(), [dates.join()], [] as PhotoCorps[])
  const [plein, setPlein] = useState<{ dates: string[]; pose?: PhotoCorps['pose'] } | null>(null)
  useRetour(!plein, onFermer)
  return (
    <div className="page-dessus">
      <div className="entete">
        <BoutonRetour onClick={onFermer} label="Retour au récap" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2>Photos de cette phase</h2>
          <div className="faible">{titre}</div>
        </div>
      </div>
      {[...dates].reverse().map((d) => (
        <section key={d}>
          <div className="recap-date">{jour(d, true)}</div>
          <div className="recap-grille">
            {photos
              .filter((x) => x.date === d)
              .map((x) => (
                <button key={x.id} type="button" aria-label={`Ouvrir la photo du ${jour(d)}`} onClick={() => setPlein({ dates: [d], pose: x.pose })}>
                  <img src={x.image} alt="" />
                </button>
              ))}
          </div>
        </section>
      ))}
      {dates.length >= 2 && (
        <button type="button" className="liste-btn recap-comparer" onClick={() => setPlein({ dates: [dates[0], dates[dates.length - 1]] })}>
          <span>Comparer le début et la fin</span>
          <ChevronRight size={18} className="muted" />
        </button>
      )}
      {plein && <PlanchePhotos photos={photos} dates={plein.dates} pose={plein.pose} onFermer={() => setPlein(null)} />}
    </div>
  )
}
