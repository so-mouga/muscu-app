import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ChevronRight, Info, Pencil, Ruler } from 'lucide-react'
import Aide from '../components/Aide'
import Courbe from '../components/Courbe'
import { FenetreJour } from '../components/JournalMatin'
import SilhouetteMesures from '../components/SilhouetteMesures'
import { clesDe, CONSEILS_MESURE, MESURES, nomCle, PRINCIPALES, type DefMesure } from '../data/mesures'
import { db } from '../db'
import { dateCourte, dateISO, kg } from '../lib/calc'
import { useRetour } from '../lib/nav'
import { nomPhase, phaseA, phaseAffichee, poidsDepart, poidsSemaine } from '../lib/objectifs'
import { objectifDuJour } from '../lib/nutrition'
import type { Mesure, PhotoCorps } from '../types'
import { confirmer } from '../components/Dialogues'
import Photos from './Photos'
import Objectifs from './Objectifs'
import type { Catalogue } from '../catalogue'

const cm = (v: number) => `${kg(v)} cm`
const signe = (d: number) => (d > 0 ? '+' : d < 0 ? '−' : '±') + kg(Math.abs(Math.round(d * 10) / 10))

/** Valeurs d'une clé dans le temps (prises qui la contiennent, de la plus ancienne à la plus récente). */
const serie = (mesures: Mesure[], cle: string) => mesures.filter((m) => m.valeurs[cle] !== undefined).map((m) => ({ date: m.date, valeur: m.valeurs[cle] }))

export type PageCorps = 'phases' | 'pesees' | 'mensurations' | 'photos'

const TITRES: Record<PageCorps, string> = { phases: 'Phases', pesees: 'Toutes les pesées', mensurations: 'Mensurations', photos: 'Photos' }

/**
 * Onglet Corps (barre du bas) : une seule page dit si le corps change. La phase, le poids, les
 * mensurations et les photos, lus ensemble ; un appui ouvre le détail de chacun.
 */
export default function Corps({ catalogue, page, onPage }: { catalogue: Catalogue; page: PageCorps | null; onPage: (p: PageCorps | null) => void }) {
  useRetour(page !== null, () => onPage(null))
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [page])
  if (!page) return <AccueilCorps catalogue={catalogue} onPage={onPage} />
  return (
    <div>
      <div className="entete">
        <button className="btn" onClick={() => onPage(null)} aria-label="Retour à Corps">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h2 style={{ flex: 1 }}>{TITRES[page]}</h2>
      </div>
      {page === 'phases' && <Objectifs catalogue={catalogue} />}
      {page === 'pesees' && <ListePesees catalogue={catalogue} />}
      {page === 'mensurations' && <Mesures catalogue={catalogue} />}
      {page === 'photos' && <Photos />}
    </div>
  )
}

/** Valeur d'une série de mesures au repère : la dernière prise à cette date ou avant, sinon la première. */
const auRepere = (s: { date: string; valeur: number }[], depuis?: string) => (depuis ? [...s].reverse().find((x) => x.date <= depuis) : undefined) ?? s[0]

const signeCm = (d: number) => (Math.abs(d) < 0.05 ? '±0' : signe(d))

function AccueilCorps({ catalogue, onPage }: { catalogue: Catalogue; onPage: (p: PageCorps) => void }) {
  const aujourdhui = dateISO()
  const pesees = useLiveQuery(() => db.pesees.orderBy('date').toArray(), [], [])
  const mesures = useLiveQuery(() => db.mesures.orderBy('date').toArray(), [], [])
  const journal = useLiveQuery(() => db.journal.get(aujourdhui), [aujourdhui])
  const phase = phaseAffichee(catalogue.objectifs, aujourdhui)
  const enCours = phase && !phase.aVenir ? phase : null
  // Photos : seulement celles du début de la phase et les dernières (elles sont lourdes).
  const photos = useLiveQuery(
    async () => {
      const dates = (await db.photos.orderBy('date').uniqueKeys()) as string[]
      if (!dates.length) return { depart: undefined, derniere: undefined, liste: [] as PhotoCorps[] }
      const derniere = dates[dates.length - 1]
      const depart = (enCours && dates.find((d) => d >= enCours.debut && d < derniere)) || (dates.length > 1 ? dates[0] : undefined)
      return { depart, derniere, liste: await db.photos.where('date').anyOf([derniere, depart ?? derniere]).toArray() }
    },
    [enCours?.debut],
    { depart: undefined, derniere: undefined, liste: [] as PhotoCorps[] }
  )
  const [noter, setNoter] = useState(false)
  const [jours, setJours] = useState(30)

  // Poids : moyenne sur 7 jours, courbe et écart sur la période choisie.
  const moyenne = poidsSemaine(pesees, aujourdhui)
  const depuisCourbe = jours ? dateISO(new Date(Date.now() - jours * 86400000)) : ''
  const points = pesees.filter((p) => p.date >= depuisCourbe).map((p) => ({ date: p.date, valeur: p.poids }))
  const ecartPoids = points.length >= 2 ? points[points.length - 1].valeur - points[0].valeur : null

  // Phase : objectif de poids, sans jugement.
  const totalPhase = phase?.total
  const depart = enCours ? poidsDepart(pesees, enCours.debut) : null
  const vise = depart !== null && enCours?.ecartVise ? Math.round((depart + enCours.ecartVise) * 10) / 10 : null
  const kcal = objectifDuJour(catalogue.objectifs, aujourdhui)?.kcal
  const fin = (iso: string) => dateCourte(dateISO(new Date(Date.parse(iso + 'T12:00:00') - 86400000))).replace(/^\S+ /, '')
  const avance = enCours && totalPhase ? Math.min(100, (enCours.semaine / totalPhase) * 100) : 0

  // Mensurations : les principales, depuis le début de la phase (sinon depuis la première prise).
  const principales = PRINCIPALES.filter((c) => serie(mesures, c).length)
  const principalesTriees = [...principales].sort((x, y) => (y === 'taille' ? 1 : 0) - (x === 'taille' ? 1 : 0))
  const derniereMesure = mesures[mesures.length - 1]

  const photoDe = (d?: string) => {
    const l = photos.liste.filter((p) => p.date === d)
    return l.find((p) => p.pose === 'face') ?? l[0]
  }
  const pDepart = photoDe(photos.depart)
  const pDerniere = photoDe(photos.derniere)

  return (
    <div>
      <div className="entete">
        <h1>Corps</h1>
      </div>

      {phase ? (
        <button type="button" className="carte corps-carte corps-phase" onClick={() => onPage('phases')}>
          <span className="ligne entre">
            <strong className="corps-titre">{nomPhase(phase.phase)}</strong>
            <span className="corps-detail-droite">
              {phase.aVenir ? `dès le ${dateCourte(phase.debut).replace(/^\S+ /, '')}` : `sem. ${phase.semaine}${totalPhase ? `/${totalPhase}` : ''}`}
              <ChevronRight size={16} strokeWidth={1.75} className="muted" />
            </span>
          </span>
          {(phase.finPrevue || kcal) && !phase.aVenir && (
            <span className="faible petit-texte">{[phase.finPrevue && `Jusqu’au ${fin(phase.finPrevue)}`, kcal && `${kcal.toLocaleString('fr-FR')} kcal par jour`].filter(Boolean).join(' · ')}</span>
          )}
          {vise !== null && depart !== null && (
            <span className="petit-texte">
              {kg(depart)} → {kg(vise)} kg visés
            </span>
          )}
          {totalPhase && !phase.aVenir && (
            <span className="barre-phase corps-barre">
              <span style={{ width: `${avance}%` }} />
            </span>
          )}
        </button>
      ) : catalogue.sansObjectif ? (
        <button type="button" className="carte corps-carte corps-phase" onClick={() => onPage('phases')}>
          <span className="ligne entre">
            <strong className="corps-titre">Phase</strong>
            <span className="corps-detail-droite">
              Pas d’objectif pour l’instant
              <ChevronRight size={16} strokeWidth={1.75} className="muted" />
            </span>
          </span>
        </button>
      ) : (
        <section className="carte corps-carte">
          <strong className="corps-titre">Phase</strong>
          <p className="faible petit-texte">Qu’est-ce que tu vises en ce moment ?</p>
          <button type="button" className="btn plein" onClick={() => onPage('phases')}>
            Choisir ma phase
          </button>
        </section>
      )}

      <section className="carte corps-carte">
        <strong className="corps-titre">Poids</strong>
        {moyenne !== null && (
          <div className="ligne entre">
            <span className="corps-chiffre">{kg(Math.round(moyenne * 10) / 10)} kg</span>
            <span className="faible petit-texte corps-droite">
              moyenne sur 7 jours
              {ecartPoids !== null && (
                <>
                  <br />
                  {signe(ecartPoids)} kg sur la période
                </>
              )}
            </span>
          </div>
        )}
        {pesees.length >= 2 ? (
          <>
            {points.length >= 2 ? <Courbe key={jours} points={points} format={(v) => `${kg(v)} kg`} label="Évolution du poids" sansEnTete /> : <p className="faible petit-texte">Pas assez de pesées sur cette période.</p>}
            <div className="bilan-periodes">
              {(
                [
                  ['1 mois', 30],
                  ['3 mois', 91],
                  ['6 mois', 182],
                  ['Tout', 0],
                ] as [string, number][]
              ).map(([nom, j]) => (
                <button key={nom} type="button" className={jours === j ? 'actif' : ''} aria-pressed={jours === j} onClick={() => setJours(j)}>
                  {nom}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="faible petit-texte">Note ton poids le matin : la courbe apparaît dès 2 pesées.</p>
        )}
        <div className="corps-boutons">
          <button type="button" className="btn" onClick={() => setNoter(true)}>
            Noter mon poids
          </button>
          {pesees.length > 0 && (
            <button type="button" className="btn" onClick={() => onPage('pesees')}>
              {pesees.length} pesée{pesees.length > 1 ? 's' : ''} ›
            </button>
          )}
        </div>
      </section>

      <section className="carte corps-carte">
        {principalesTriees.length > 0 ? (
          <>
            <div className="ligne entre">
              <strong className="corps-titre">Mensurations</strong>
              {mesures.length > 1 && <span className="faible petit-texte">{enCours ? 'depuis le début de la phase' : 'depuis la première prise'}</span>}
            </div>
            {principalesTriees.map((c) => {
              const s = serie(mesures, c)
              const d = s[s.length - 1].valeur - auRepere(s, enCours?.debut).valeur
              return (
                <div key={c} className="ligne entre corps-mesure">
                  <span>{nomCle(c)}</span>
                  <span>
                    <strong>{cm(s[s.length - 1].valeur)}</strong> {s.length > 1 && <span className="faible">{signeCm(d)}</span>}
                  </span>
                </div>
              )
            })}
            <button type="button" className="bilan-tous" onClick={() => onPage('mensurations')}>
              <span>Toutes les mesures{derniereMesure ? ` · dernière le ${dateCourte(derniereMesure.date).replace(/^\S+ /, '')}` : ''}</span>
              <ChevronRight size={16} strokeWidth={1.75} className="muted" />
            </button>
          </>
        ) : (
          <>
            <strong className="corps-titre">Mensurations</strong>
            <p className="faible petit-texte">Une prise toutes les 2 à 4 semaines suffit.</p>
            <button type="button" className="btn plein" onClick={() => onPage('mensurations')}>
              {mesures.length ? 'Voir mes mensurations' : 'Prendre mes mensurations'}
            </button>
          </>
        )}
      </section>

      <section className="carte corps-carte">
        <strong className="corps-titre">Photos</strong>
        {pDerniere ? (
          <>
            <div className="corps-photos">
              {pDepart && <PhotoDatee photo={pDepart} />}
              <PhotoDatee photo={pDerniere} />
            </div>
            <button type="button" className="bilan-tous" onClick={() => onPage('photos')}>
              <span>{pDepart ? 'Comparer et toutes les photos' : 'Toutes les photos'}</span>
              <ChevronRight size={16} strokeWidth={1.75} className="muted" />
            </button>
          </>
        ) : (
          <>
            <p className="faible petit-texte">Stockées uniquement sur cet appareil.</p>
            <button type="button" className="btn plein" onClick={() => onPage('photos')}>
              Séance photo
            </button>
          </>
        )}
      </section>

      {noter && <FenetreJour saisie="poids" date={aujourdhui} catalogue={catalogue} journal={journal} poidsDuJour={pesees.find((p) => p.date === aujourdhui)?.poids} poidsRepere={pesees[pesees.length - 1]?.poids} onFermer={() => setNoter(false)} />}
    </div>
  )
}

function PhotoDatee({ photo }: { photo: PhotoCorps }) {
  return (
    <figure>
      <img src={photo.image} alt={`Photo du ${dateCourte(photo.date)}`} />
      <figcaption>{dateCourte(photo.date).replace(/^\S+ /, '')}</figcaption>
    </figure>
  )
}

/** Toutes les pesées, un appui pour corriger ou supprimer. */
function ListePesees({ catalogue }: { catalogue: Catalogue }) {
  const pesees = useLiveQuery(() => db.pesees.orderBy('date').reverse().toArray(), [], [])
  const [date, setDate] = useState<string | null>(null)
  const [voirTout, setVoirTout] = useState(false)
  const affichees = voirTout ? pesees : pesees.slice(0, 30)
  const choisie = pesees.find((p) => p.date === date)
  return (
    <>
      <p className="faible petit-texte corps-aide">Un appui pour corriger ou effacer une pesée.</p>
      <div className="carte corps-carte corps-liste">
        {affichees.map((p) => (
          <button key={p.date} type="button" className="bilan-tous corps-pesee" onClick={() => setDate(p.date)}>
            <span>{dateCourte(p.date)}</span>
            <strong>{kg(p.poids)} kg</strong>
          </button>
        ))}
        {pesees.length > affichees.length && (
          <button type="button" className="btn discret plein" onClick={() => setVoirTout(true)}>
            Voir les {pesees.length} pesées
          </button>
        )}
      </div>
      {date && <FenetreJour saisie="poids" date={date} catalogue={catalogue} poidsDuJour={choisie?.poids} onFermer={() => setDate(null)} />}
    </>
  )
}

/** Mensurations : silhouette, évolution, et la saisie par-dessus l'écran. */
function Mesures({ catalogue }: { catalogue: Catalogue }) {
  const [saisie, setSaisie] = useState<Mesure | 'nouvelle' | null>(null)
  const mesures = useLiveQuery(() => db.mesures.orderBy('date').toArray(), [], [])
  return (
    <>
      <Mensurations mesures={mesures} depuis={phaseA(catalogue.objectifs, dateISO())?.debut} onSaisir={setSaisie} />
      {saisie && (
        <div className="page-dessus">
          <SaisieMesures initial={saisie === 'nouvelle' ? mesures.find((m) => m.date === dateISO()) : saisie} mesures={mesures} onFermer={() => setSaisie(null)} />
        </div>
      )}
    </>
  )
}

function Mensurations({ mesures, depuis, onSaisir }: { mesures: Mesure[]; depuis?: string; onSaisir: (m: Mesure | 'nouvelle') => void }) {
  const [active, setActive] = useState('taille')
  const [cote, setCote] = useState<'g' | 'd'>('g')
  const [voirPrises, setVoirPrises] = useState(false)
  const [voirAutres, setVoirAutres] = useState(false)
  // Mesure choisie plus bas dans la page : on remonte jusqu'à sa carte pour qu'on voie le changement.
  const carte = useRef<HTMLDivElement>(null)
  const choisir = (id: string, c?: 'g' | 'd') => {
    setActive(id)
    if (c) setCote(c)
    carte.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const def = MESURES.find((m) => m.id === active)!
  const remplies = new Set(MESURES.filter((m) => clesDe(m).some((c) => mesures.some((x) => x.valeurs[c] !== undefined))).map((m) => m.id))
  // Côté affiché : celui choisi s'il a des valeurs, sinon l'autre.
  const clesDef = clesDe(def)
  const cleCourbe = def.cotes ? (serie(mesures, `${def.id}_${cote}`).length ? `${def.id}_${cote}` : clesDef.find((c) => serie(mesures, c).length) ?? clesDef[0]) : clesDef[0]
  const points = serie(mesures, cleCourbe)
  // Clés déjà mesurées, dans l'ordre de la silhouette.
  const cles = MESURES.flatMap(clesDe).filter((c) => serie(mesures, c).length)
  const ligne = (c: string) => {
    const s = serie(mesures, c)
    const d = s[s.length - 1].valeur - auRepere(s, depuis).valeur
    const id = c.replace(/_[gd]$/, '')
    return (
      <button key={c} className={'ligne-mesure' + (id === active ? ' active' : '')} onClick={() => choisir(id, c.endsWith('_d') ? 'd' : 'g')}>
        <span>{nomCle(c)}</span>
        <span>
          <strong>{cm(s[s.length - 1].valeur)}</strong>
          {s.length > 1 && <span className="ecart-mesure"> {signe(d)}</span>}
        </span>
      </button>
    )
  }

  return (
    <>
      {/* Bouton d'action élégant 44px */}
      <button
        type="button"
        onClick={() => onSaisir('nouvelle')}
        style={{
          width: '100%',
          height: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          background: 'var(--accent)',
          boxShadow: 'var(--ombre-primaire)',
          border: 'none',
          borderRadius: 'var(--rayon-2)',
          color: 'var(--accent-texte)',
          fontSize: 'var(--t-petit)',
          fontWeight: 600,
          cursor: 'pointer',
          marginBottom: 14,
          transition: 'transform 0.1s ease, box-shadow 0.15s ease',
        }}
      >
        <Ruler size={18} strokeWidth={2.2} />
        <span>Prendre mes mensurations</span>
      </button>

      {/* Carte silhouette & courbe de détail sans doublon */}
      <div className="carte" ref={carte} style={{ padding: '16px', borderRadius: 'var(--rayon)', scrollMarginTop: 12, marginBottom: 12, overflow: 'hidden' }}>
        <div className="mesures-haut">
          <div style={{ width: '100%', maxWidth: 115, margin: '0 auto' }}>
            <SilhouetteMesures active={active} onChoix={(id) => setActive(id)} remplies={remplies} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span className="faible" style={{ fontSize: 'var(--t-petit)', fontWeight: 600 }}>
                {MESURES.indexOf(def) + 1} ·
              </span>
              <h3 style={{ margin: 0, fontSize: 'var(--t-titre)', fontWeight: 700, color: 'var(--texte)' }}>
                {def.nom}
              </h3>
              <Aide titre={def.nom} texte={def.consigne} />
            </div>
            <ValeursMesure def={def} mesures={mesures} />
          </div>
        </div>

        {points.length >= 2 && (
          <div style={{ marginTop: 10, width: '100%', overflow: 'hidden' }}>
            {def.cotes && clesDef.every((c) => serie(mesures, c).length) && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                {(['g', 'd'] as const).map((c) => {
                  const actifCote = cleCourbe.endsWith('_' + c)
                  return (
                    <button
                      key={c}
                      type="button"
                      style={{
                        padding: '3px 10px',
                        fontSize: 'var(--t-legende)',
                        fontWeight: actifCote ? 600 : 400,
                        color: actifCote ? 'var(--texte)' : 'var(--texte-2)',
                        background: actifCote ? 'var(--voile-fort)' : 'var(--surface-2)',
                        border: '1px solid ' + (actifCote ? 'var(--voile-bord)' : 'var(--voile)'),
                        borderRadius: 'var(--rayon-2)',
                        cursor: 'pointer',
                      }}
                      onClick={() => setCote(c)}
                    >
                      {c === 'g' ? 'Gauche' : 'Droite'}
                    </button>
                  )
                })}
              </div>
            )}
            <Courbe key={cleCourbe} points={points} format={cm} label={`Évolution : ${def.nom}`} sansEnTete />
          </div>
        )}
      </div>

      {mesures.length > 0 && (
        <div className="carte" style={{ padding: '16px', borderRadius: 'var(--rayon)', marginBottom: 12 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 'var(--t-texte)', fontWeight: 700 }}>{depuis ? 'Depuis le début de la phase' : 'Depuis le début'}</h3>
          {cles.filter((c) => PRINCIPALES.includes(c)).map(ligne)}
          {cles.some((c) => !PRINCIPALES.includes(c)) && (
            <button type="button" className="groupe-repli" onClick={() => setVoirAutres(!voirAutres)} aria-expanded={voirAutres}>
              <span>Autres mesures</span>
              <span className="muted">{voirAutres ? '▾' : '▸'}</span>
            </button>
          )}
          {voirAutres && cles.filter((c) => !PRINCIPALES.includes(c)).map(ligne)}
        </div>
      )}

      {mesures.length > 0 && (
        <div className="carte" style={{ padding: '16px', borderRadius: 'var(--rayon)', marginBottom: 12 }}>
          <button type="button" className="groupe-repli" onClick={() => setVoirPrises(!voirPrises)} aria-expanded={voirPrises}>
            <span style={{ fontWeight: 600 }}>
              Prises <span className="faible">({mesures.length})</span>
            </span>
            <span className="muted">{voirPrises ? '▾' : '▸'}</span>
          </button>
          {voirPrises && [...mesures].reverse().map((m) => {
            const entrees = Object.entries(m.valeurs)
            const apercu = entrees.length <= 2
              ? entrees.map(([k, v]) => `${nomCle(k)} : ${cm(v)}`).join(' · ')
              : `${entrees.length} mesures`
            return (
              <button
                key={m.date}
                className="ligne-mesure"
                onClick={() => onSaisir(m)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}
              >
                <span style={{ fontWeight: 500 }}>{dateCourte(m.date)}</span>
                <span className="faible" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--t-petit)' }}>
                  <span>{apercu}</span>
                  <Pencil size={13} strokeWidth={1.75} style={{ opacity: 0.7 }} />
                </span>
              </button>
            )
          })}
        </div>
      )}

    </>
  )
}

/** Dernière valeur de la mesure (par côté) et écart avec la prise d'avant. */
function ValeursMesure({ def, mesures }: { def: DefMesure; mesures: Mesure[] }) {
  const lignes = clesDe(def)
    .map((c) => ({ c, s: serie(mesures, c) }))
    .filter((x) => x.s.length)
  if (!lignes.length) return <div className="faible" style={{ fontSize: 'var(--t-petit)' }}>Pas encore mesuré.</div>
  const memeJour = new Set(lignes.map((l) => l.s[l.s.length - 1].date)).size === 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {lignes.map(({ c, s }) => {
        const der = s[s.length - 1]
        const d = s.length > 1 ? der.valeur - s[s.length - 2].valeur : null
        return (
          <div key={c}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
              {def.cotes && <span className="faible" style={{ fontSize: 'var(--t-petit)', fontWeight: 600 }}>{c.endsWith('_g') ? 'G ' : 'D '}</span>}
              <span style={{ fontSize: 'var(--t-titre)', fontWeight: 800, color: 'var(--texte)', letterSpacing: '-0.3px' }}>
                {cm(der.valeur)}
              </span>
              {d !== null && (
                <span
                  style={{
                    padding: '2px 7px',
                    borderRadius: 999,
                    fontSize: 'var(--t-legende)',
                    fontWeight: 600,
                    color: 'var(--texte-2)',
                    background: 'var(--voile)',
                  }}
                >
                  {signe(d)}
                </span>
              )}
            </div>
            {!memeJour && (
              <div className="faible" style={{ fontSize: 'var(--t-legende)', color: 'var(--texte-2)', marginTop: 1 }}>
                le {dateCourte(der.date)}
              </div>
            )}
          </div>
        )
      })}
      {memeJour && (
        <div className="faible" style={{ fontSize: 'var(--t-legende)', color: 'var(--texte-2)', marginTop: 1 }}>
          le {dateCourte(lignes[0].s[lignes[0].s.length - 1].date)}
        </div>
      )}
    </div>
  )
}

const enTextes = (v: Record<string, number> = {}) => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, String(x).replace('.', ',')]))
const lireValeurs = (textes: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(textes)
      .map(([k, t]) => [k, parseFloat(t.replace(',', '.'))] as const)
      .filter(([, v]) => v > 0 && v < 300)
  )

/**
 * Saisie d'une prise de mensurations : tout d'un coup, chaque champ facultatif. Pas de bouton : chaque
 * valeur est gardée peu après la frappe, et tout de suite en quittant ou si l'appli passe en arrière-plan.
 */
export function SaisieMesures({ initial, mesures, onFermer }: { initial?: Mesure; mesures: Mesure[]; onFermer: () => void }) {
  const [date, setDate] = useState(initial?.date ?? dateISO())
  const [textes, setTextes] = useState<Record<string, string>>(() => enTextes(initial?.valeurs))
  const [active, setActive] = useState<string>('poitrine')
  const [conseilOuvert, setConseilOuvert] = useState(false)
  // Ce qui est en base pour cette saisie : la date et les valeurs, pour n'écrire que ce qui a changé.
  const enBase = useRef({ date: initial?.date, valeurs: JSON.stringify(lireValeurs(enTextes(initial?.valeurs))) })
  const aEcrire = useRef({ date, textes })
  aEcrire.current = { date, textes }
  const minuteur = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const supprimee = useRef(false)

  const ecrire = () => {
    clearTimeout(minuteur.current)
    if (supprimee.current) return
    const { date: d, textes: t } = aEcrire.current
    const valeurs = lireValeurs(t)
    const texte = JSON.stringify(valeurs)
    const avant = enBase.current
    if (avant.date === d && avant.valeurs === texte) return
    if (!avant.date && !Object.keys(valeurs).length) return
    enBase.current = { date: Object.keys(valeurs).length ? d : undefined, valeurs: texte }
    void db.transaction('rw', db.mesures, async () => {
      if (avant.date && avant.date !== d) await db.mesures.delete(avant.date)
      if (Object.keys(valeurs).length) await db.mesures.put({ date: d, valeurs })
      else await db.mesures.delete(d)
    })
  }
  useEffect(() => {
    clearTimeout(minuteur.current)
    minuteur.current = setTimeout(ecrire, 400)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, textes])
  useEffect(() => {
    const cachee = () => document.visibilityState === 'hidden' && ecrire()
    document.addEventListener('visibilitychange', cachee)
    window.addEventListener('pagehide', ecrire)
    return () => {
      document.removeEventListener('visibilitychange', cachee)
      window.removeEventListener('pagehide', ecrire)
      ecrire()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const fermer = () => {
    ecrire()
    onFermer()
  }
  useRetour(true, fermer)

  /** Une prise existe déjà à cette date : ses valeurs rejoignent celle-ci, celles qu'on vient de noter passent devant. */
  const changerDate = async (d: string) => {
    if (!d || d === date) return
    const deja = await db.mesures.get(d)
    setTextes((t) => ({ ...enTextes(deja?.valeurs), ...t }))
    setDate(d)
  }

  const supprimer = async () => {
    if (!enBase.current.date || !(await confirmer(`Supprimer la prise du ${dateCourte(enBase.current.date)} ?`, { oui: 'Supprimer la prise', danger: true }))) return
    supprimee.current = true
    clearTimeout(minuteur.current)
    await db.mesures.delete(enBase.current.date)
    onFermer()
  }
  // Référence pour chaque champ : la dernière valeur connue avant cette prise.
  const repere = (cle: string) => [...mesures].filter((m) => m.date < date && m.valeurs[cle] !== undefined).sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.valeurs[cle]

  const champ = (cle: string, label?: string) => (
    <div key={cle} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {label && <span className="faible" style={{ fontSize: 'var(--t-legende)', minWidth: 14 }}>{label}</span>}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          background: 'var(--surface-2)',
          border: '1px solid var(--voile-fort)',
          borderRadius: 'var(--rayon-2)',
          padding: '4px 8px',
        }}
      >
        <input
          inputMode="decimal"
          placeholder={repere(cle) !== undefined ? kg(repere(cle)!) : '—'}
          value={textes[cle] ?? ''}
          onFocus={() => setActive(cle.replace(/_[gd]$/, ''))}
          onChange={(e) => setTextes((x) => ({ ...x, [cle]: e.target.value }))}
          style={{
            width: 52,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--texte)',
            fontSize: 'var(--t-petit)',
            fontWeight: 600,
            textAlign: 'right',
            fontFamily: 'inherit',
          }}
        />
        <span className="faible" style={{ fontSize: 'var(--t-legende)' }}>cm</span>
      </div>
    </div>
  )

  // Autres mesures ouvertes d'office si la prise en contient, ou si on touche l'une d'elles sur la silhouette.
  const [voirAutres, setVoirAutres] = useState(() => Object.keys(initial?.valeurs ?? {}).some((c) => !PRINCIPALES.includes(c)))
  const autresOuvertes = voirAutres || !clesDe(MESURES.find((m) => m.id === active)!).some((c) => PRINCIPALES.includes(c))
  const carteSaisie = (m: DefMesure, cles: string[]) => {
    if (cles.length === 0) return null
    const estActif = m.id === active
    const mono = cles.length === 1

    return (
      <div
        key={m.id}
        className={'carte mesure-saisie' + (estActif ? ' active' : '')}
        onClick={() => setActive(m.id)}
        style={{
          padding: '10px 14px',
          borderRadius: 'var(--rayon-2)',
          marginBottom: 8,
          background: estActif ? 'var(--accent-voile)' : 'var(--sous-carte)',
          border: '1px solid ' + (estActif ? 'var(--accent)' : 'var(--voile)'),
          transition: 'all 0.15s ease',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: estActif ? 'var(--accent)' : 'var(--voile)',
                color: estActif ? 'var(--blanc)' : 'var(--texte-2)',
                fontSize: 'var(--t-legende)',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {MESURES.indexOf(m) + 1}
            </span>
            <strong style={{ fontSize: 'var(--t-petit)', color: 'var(--texte)' }}>
              {mono ? nomCle(cles[0]) : m.nom}
            </strong>
          </div>

          {mono ? (
            champ(cles[0])
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {cles.map((c) => champ(c, c.endsWith('_g') ? 'G' : 'D'))}
            </div>
          )}
        </div>

        {/* Consigne affichée UNIQUEMENT sur la carte active */}
        {estActif && (
          <div
            className="faible"
            style={{
              fontSize: 'var(--t-legende)',
              color: 'var(--texte-2)',
              marginTop: 6,
              paddingTop: 6,
              borderTop: '1px solid var(--voile)',
              lineHeight: 1.4,
            }}
          >
            {m.consigne}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: 24 }}>
      <div className="entete" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          onClick={fermer}
          aria-label="Retour"
          style={{
            background: 'none',
            border: 'none',
            padding: 6,
            color: 'var(--texte)',
            cursor: 'pointer',
            display: 'flex',
          }}
        >
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h2 style={{ flex: 1, margin: 0, fontSize: 'var(--t-titre)', fontWeight: 700 }}>
          {initial ? 'Modifier la prise' : 'Mensurations'}
        </h2>
      </div>

      <div
        className="carte"
        style={{
          padding: '12px 14px',
          borderRadius: 'var(--rayon-2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <span style={{ fontSize: 'var(--t-petit)', fontWeight: 600, color: 'var(--texte)' }}>Date de la prise</span>
        <input
          type="date"
          value={date}
          max={dateISO()}
          onChange={(e) => void changerDate(e.target.value)}
          style={{
            background: 'var(--voile)',
            border: '1px solid var(--voile-fort)',
            borderRadius: 'var(--rayon-2)',
            color: 'var(--texte)',
            padding: '5px 10px',
            fontSize: 'var(--t-petit)',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Bannière conseil repliable */}
      <div
        style={{
          borderRadius: 'var(--rayon-2)',
          background: 'var(--surface-2)',
          border: '1px solid var(--voile)',
          padding: '8px 12px',
          marginBottom: 14,
          fontSize: 'var(--t-legende)',
        }}
      >
        <button
          type="button"
          onClick={() => setConseilOuvert(!conseilOuvert)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            color: 'var(--texte-2)',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Info size={14} strokeWidth={2} style={{ color: 'var(--accent)' }} />
            <span>Conseil : le matin à jeun</span>
          </div>
          <span style={{ fontSize: 'var(--t-legende)', color: 'var(--texte-2)' }}>
            {conseilOuvert ? 'Masquer' : 'Voir plus ›'}
          </span>
        </button>
        {conseilOuvert && (
          <div style={{ marginTop: 6, color: 'var(--texte-2)', lineHeight: 1.4 }}>
            {CONSEILS_MESURE} Remplis seulement ce que tu mesures ; en gris clair, ta dernière valeur. Tout est gardé dès que tu le notes.
          </div>
        )}
      </div>

      <div className="saisie-mesures">
        <div className="saisie-silhouette">
          <SilhouetteMesures active={active} onChoix={setActive} />
        </div>
        <div>
          {MESURES.map((m) => carteSaisie(m, clesDe(m).filter((c) => PRINCIPALES.includes(c))))}
          <button type="button" className="groupe-repli" onClick={() => setVoirAutres(!autresOuvertes)} aria-expanded={autresOuvertes} style={{ marginBottom: 8 }}>
            <span>
              Autres mesures <span className="faible">(cou, épaules, côté droit…)</span>
            </span>
            <span className="muted">{autresOuvertes ? '▾' : '▸'}</span>
          </button>
          {autresOuvertes && MESURES.map((m) => carteSaisie(m, clesDe(m).filter((c) => !PRINCIPALES.includes(c))))}
        </div>
      </div>

      {!!initial && (
        <button className="btn discret danger plein" style={{ marginBottom: 24 }} onClick={supprimer}>
          Supprimer cette prise
        </button>
      )}
    </div>
  )
}
