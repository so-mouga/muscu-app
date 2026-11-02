import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { ArrowLeft, Info, Pencil, Ruler, Trash2 } from 'lucide-react'
import Aide from '../components/Aide'
import Courbe from '../components/Courbe'
import Poids from '../components/Poids'
import SilhouetteMesures from '../components/SilhouetteMesures'
import Tendances from '../components/Tendances'
import { clesDe, CONSEILS_MESURE, MESURES, nomCle, PRINCIPALES, type DefMesure } from '../data/mesures'
import { db } from '../db'
import { dateCourte, dateISO, kg } from '../lib/calc'
import { useRetour } from '../lib/nav'
import type { Mesure } from '../types'
import { confirmer } from '../components/Dialogues'
import Photos from './Photos'
import Objectifs from './Objectifs'
import type { Catalogue } from '../catalogue'

const cm = (v: number) => `${kg(v)} cm`
const signe = (d: number) => (d > 0 ? '+' : d < 0 ? '−' : '±') + kg(Math.abs(Math.round(d * 10) / 10))

/** Valeurs d'une clé dans le temps (prises qui la contiennent, de la plus ancienne à la plus récente). */
const serie = (mesures: Mesure[], cle: string) => mesures.filter((m) => m.valeurs[cle] !== undefined).map((m) => ({ date: m.date, valeur: m.valeurs[cle] }))

type SousOngletCorps = 'poids' | 'objectifs' | 'mensurations' | 'photos'

/**
 * Onglet Corps (barre du bas) : Poids, Objectifs (phase, timeline, calories),
 * Mensurations, Photos.
 */
export default function Corps({ catalogue }: { catalogue: Catalogue }) {
  const [onglet, setOnglet] = useState<SousOngletCorps>(() => {
    try {
      return (localStorage.getItem('sous_onglet_corps') as SousOngletCorps) || 'poids'
    } catch {
      return 'poids'
    }
  })

  const changerOnglet = (o: SousOngletCorps) => {
    setOnglet(o)
    try {
      localStorage.setItem('sous_onglet_corps', o)
    } catch {}
  }

  return (
    <div>
      <div className="entete">
        <h1>Corps</h1>
      </div>
      <div className="segments" role="tablist" style={{ marginTop: 2, marginBottom: 14 }}>
        <button
          type="button"
          role="tab"
          aria-selected={onglet === 'poids'}
          className={onglet === 'poids' ? 'actif' : ''}
          onClick={() => changerOnglet('poids')}
        >
          Poids
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={onglet === 'objectifs'}
          className={onglet === 'objectifs' ? 'actif' : ''}
          onClick={() => changerOnglet('objectifs')}
        >
          Objectifs
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={onglet === 'mensurations'}
          className={onglet === 'mensurations' ? 'actif' : ''}
          onClick={() => changerOnglet('mensurations')}
        >
          Mensurations
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={onglet === 'photos'}
          className={onglet === 'photos' ? 'actif' : ''}
          onClick={() => changerOnglet('photos')}
        >
          Photos
        </button>
      </div>

      {onglet === 'poids' && <OngletPoids />}
      {onglet === 'objectifs' && <Objectifs catalogue={catalogue} />}
      {onglet === 'mensurations' && <Mesures />}
      {onglet === 'photos' && <Photos />}
    </div>
  )
}

/** Mensurations : silhouette, évolution, et la saisie par-dessus l'écran. */
function Mesures() {
  const [saisie, setSaisie] = useState<Mesure | 'nouvelle' | null>(null)
  const mesures = useLiveQuery(() => db.mesures.orderBy('date').toArray(), [], [])
  return (
    <>
      <Mensurations mesures={mesures} onSaisir={setSaisie} />
      {saisie && (
        <div className="page-dessus">
          <SaisieMesures initial={saisie === 'nouvelle' ? undefined : saisie} derniere={mesures[mesures.length - 1]} onFermer={() => setSaisie(null)} />
        </div>
      )}
    </>
  )
}

function OngletPoids() {
  const pesees = useLiveQuery(() => db.pesees.orderBy('date').reverse().toArray(), [], [])
  return <ListePoids pesees={pesees} />
}

function Mensurations({ mesures, onSaisir }: { mesures: Mesure[]; onSaisir: (m: Mesure | 'nouvelle') => void }) {
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
    const d = s[s.length - 1].valeur - s[0].valeur
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

      <Tendances mesures={mesures} />

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
          <h3 style={{ margin: '0 0 10px', fontSize: 'var(--t-texte)', fontWeight: 700 }}>Depuis le début</h3>
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

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 'var(--rayon-2)', background: 'var(--surface-2)', border: '1px solid var(--voile)', fontSize: 'var(--t-legende)', color: 'var(--texte-2)', marginBottom: 20 }}>
        <Info size={15} strokeWidth={2} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />
        <span>{CONSEILS_MESURE}</span>
      </div>
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
                    color: d > 0 ? 'var(--ok)' : d < 0 ? 'var(--danger)' : 'var(--texte-2)',
                    background: d > 0 ? 'var(--ok-voile)' : d < 0 ? 'var(--danger-voile)' : 'var(--voile)',
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

/** Saisie d'une prise de mensurations : tout d'un coup, chaque champ facultatif. */
export function SaisieMesures({ initial, derniere, onFermer }: { initial?: Mesure; derniere?: Mesure; onFermer: () => void }) {
  const [date, setDate] = useState(initial?.date ?? dateISO())
  const [textes, setTextes] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(initial?.valeurs ?? {}).map(([k, v]) => [k, String(v).replace('.', ',')]))
  )
  const [active, setActive] = useState<string>('poitrine')
  const [conseilOuvert, setConseilOuvert] = useState(false)
  const modifie = JSON.stringify(textes) !== JSON.stringify(Object.fromEntries(Object.entries(initial?.valeurs ?? {}).map(([k, v]) => [k, String(v).replace('.', ',')])))
  const fermer = () => {
    // Saisie en cours : on garde l'écran et on demande avant de perdre les valeurs.
    if (modifie) {
      void confirmer('Les mesures saisies seront perdues.', { titre: 'Quitter sans enregistrer ?', oui: 'Quitter sans enregistrer', non: 'Continuer', danger: true }).then((ok) => ok && onFermer())
      return 'rester' as const
    }
    onFermer()
  }
  useRetour(true, fermer)
  // Référence pour les champs : la prise d'avant (celle qu'on modifie n'est pas sa propre référence).
  const ref = initial && derniere?.date === initial.date ? undefined : derniere

  const valeurs = Object.fromEntries(
    Object.entries(textes)
      .map(([k, t]) => [k, parseFloat(t.replace(',', '.'))] as const)
      .filter(([, v]) => v > 0 && v < 300)
  )
  const enregistrer = async () => {
    await db.transaction('rw', db.mesures, async () => {
      if (initial && initial.date !== date) await db.mesures.delete(initial.date)
      const meme = initial?.date === date ? undefined : await db.mesures.get(date)
      await db.mesures.put({ date, valeurs: { ...meme?.valeurs, ...valeurs } })
    })
    onFermer()
  }
  const supprimer = async () => {
    if (!initial || !(await confirmer(`Supprimer la prise du ${dateCourte(initial.date)} ?`, { oui: 'Supprimer la prise', danger: true }))) return
    await db.mesures.delete(initial.date)
    onFermer()
  }

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
          placeholder={ref?.valeurs[cle] !== undefined ? kg(ref.valeurs[cle]) : '—'}
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
    <div style={{ paddingBottom: 110 }}>
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
          onChange={(e) => e.target.value && setDate(e.target.value)}
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
            {CONSEILS_MESURE} Remplis seulement ce que tu mesures ; en gris clair, ta dernière valeur de référence.
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

      <div className="barre-demarrer">
        <button className="btn primaire grand" disabled={!Object.keys(valeurs).length} onClick={enregistrer}>
          Enregistrer
        </button>
      </div>
      {initial && (
        <button className="btn discret danger plein" style={{ marginBottom: 24 }} onClick={supprimer}>
          Supprimer cette prise
        </button>
      )}
    </div>
  )
}

function ListePoids({ pesees }: { pesees: { date: string; poids: number }[] }) {
  // Date de la pesée saisie : aujourd'hui, ou celle d'une ligne touchée dans la liste (correction).
  const [date, setDate] = useState(dateISO())
  const [jours, setJours] = useState(30)
  const [voirTout, setVoirTout] = useState(false)
  const depuis = jours ? dateISO(new Date(Date.now() - jours * 86400000)) : ''
  const points = [...pesees]
    .reverse()
    .filter((p) => p.date >= depuis)
    .map((p) => ({ date: p.date, valeur: p.poids }))
  const ecart = points.length >= 2 ? points[points.length - 1].valeur - points[0].valeur : null

  const peseesAffichees = voirTout ? pesees : pesees.slice(0, 7)

  return (
    <>
      <Poids key={date} pesees={pesees} aujourdhui={date} onDate={setDate} />
      {pesees.length >= 2 && (
        <div className="carte" style={{ padding: '16px', borderRadius: 'var(--rayon)', marginTop: 12 }}>
          <div className="ligne entre" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 'var(--t-texte)', fontWeight: 700, color: 'var(--texte)' }}>Évolution</h3>
            {ecart !== null && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '3px 10px',
                  borderRadius: 999,
                  background: ecart > 0 ? 'var(--ok-voile)' : ecart < 0 ? 'var(--info-voile)' : 'var(--voile)',
                  border: '1px solid ' + (ecart > 0 ? 'var(--ok-bord)' : ecart < 0 ? 'var(--info-bord)' : 'var(--bord)'),
                  color: ecart > 0 ? 'var(--ok)' : ecart < 0 ? 'var(--info)' : 'var(--texte)',
                  fontSize: 'var(--t-legende)',
                  fontWeight: 700,
                }}
              >
                {signe(ecart).replace(/ $/, '')} kg
              </span>
            )}
          </div>
          {/* Barre d'onglets de période fins et compacts */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {(
              [
                ['1 mois', 30],
                ['3 mois', 91],
                ['6 mois', 182],
                ['Tout', 0],
              ] as [string, number][]
            ).map(([nom, j]) => {
              const actif = jours === j
              return (
                <button
                  key={nom}
                  type="button"
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    fontSize: 'var(--t-petit)',
                    fontWeight: actif ? 600 : 400,
                    color: actif ? 'var(--accent)' : 'var(--texte-2)',
                    background: actif ? 'var(--accent-voile)' : 'transparent',
                    border: '1px solid ' + (actif ? 'var(--accent)' : 'var(--bord)'),
                    borderRadius: 'var(--rayon-2)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onClick={() => setJours(j)}
                >
                  {nom}
                </button>
              )
            })}
          </div>
          {points.length >= 2 ? (
            <Courbe key={jours} points={points} format={(v) => `${kg(v)} kg`} label="Évolution du poids" />
          ) : (
            <div className="faible" style={{ padding: '12px 0' }}>Pas assez de pesées sur cette période.</div>
          )}
        </div>
      )}
      {pesees.length > 0 && (
        <div className="carte" style={{ padding: '16px', borderRadius: 'var(--rayon)', marginTop: 12 }}>
          <div className="ligne entre" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 'var(--t-texte)', fontWeight: 700, color: 'var(--texte)' }}>
              Pesées <span className="faible" style={{ fontSize: 'var(--t-petit)' }}>({pesees.length})</span>
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {peseesAffichees.map((p) => {
              const estActive = p.date === date
              return (
                <div
                  key={p.date}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: 'var(--rayon-2)',
                    background: estActive ? 'var(--accent-voile)' : 'var(--sous-carte)',
                    border: '1px solid ' + (estActive ? 'var(--accent-bord)' : 'var(--voile)'),
                    transition: 'all 0.15s ease',
                  }}
                >
                  <button
                    type="button"
                    style={{
                      flex: 1,
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: 'var(--texte)',
                      fontSize: 'var(--t-petit)',
                      fontWeight: estActive ? 700 : 500,
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      setDate(p.date)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                  >
                    {dateCourte(p.date)}
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <strong style={{ fontSize: 'var(--t-texte)', color: 'var(--texte)' }}>{kg(p.poids)} kg</strong>
                    <button
                      type="button"
                      aria-label={`Supprimer la pesée du ${dateCourte(p.date)}`}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--texte-2)',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        borderRadius: 'var(--rayon-2)',
                        transition: 'color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--texte-2)')}
                      onClick={async () => {
                        const suppr = await confirmer(`Supprimer la pesée du ${dateCourte(p.date)} ?`, { oui: 'Supprimer', danger: true })
                        if (suppr) await db.pesees.delete(p.date)
                      }}
                    >
                      <Trash2 size={16} strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          {pesees.length > 7 && (
            <button
              type="button"
              style={{
                width: '100%',
                marginTop: 10,
                padding: '8px 0',
                background: 'var(--surface-2)',
                border: '1px solid var(--voile)',
                borderRadius: 'var(--rayon-2)',
                color: 'var(--texte-2)',
                fontSize: 'var(--t-petit)',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s ease',
              }}
              onClick={() => setVoirTout(!voirTout)}
            >
              {voirTout ? 'Réduire' : `Voir les ${pesees.length} pesées`}
            </button>
          )}
        </div>
      )}
    </>
  )
}
