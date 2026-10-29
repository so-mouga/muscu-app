import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import Courbe from '../components/Courbe'
import Poids from '../components/Poids'
import SilhouetteMesures from '../components/SilhouetteMesures'
import Tendances from '../components/Tendances'
import { clesDe, CONSEILS_MESURE, MESURES, nomCle, type DefMesure } from '../data/mesures'
import { db } from '../db'
import { dateCourte, dateISO, kg } from '../lib/calc'
import { useRetour } from '../lib/nav'
import type { Mesure } from '../types'

const cm = (v: number) => `${kg(v)} cm`
const signe = (d: number) => (d > 0 ? '+' : d < 0 ? '−' : '±') + kg(Math.abs(Math.round(d * 10) / 10))

/** Valeurs d'une clé dans le temps (prises qui la contiennent, de la plus ancienne à la plus récente). */
const serie = (mesures: Mesure[], cle: string) => mesures.filter((m) => m.valeurs[cle] !== undefined).map((m) => ({ date: m.date, valeur: m.valeurs[cle] }))

/** Onglet Mesures de Progression : silhouette, évolution, et la saisie par-dessus l'écran. */
export function Mesures() {
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

/** Onglet Poids de Progression. */
export function OngletPoids() {
  const pesees = useLiveQuery(() => db.pesees.orderBy('date').reverse().toArray(), [], [])
  return <ListePoids pesees={pesees} />
}

function Mensurations({ mesures, onSaisir }: { mesures: Mesure[]; onSaisir: (m: Mesure | 'nouvelle') => void }) {
  const [active, setActive] = useState('taille')
  const [cote, setCote] = useState<'g' | 'd'>('g')
  const def = MESURES.find((m) => m.id === active)!
  const remplies = new Set(MESURES.filter((m) => clesDe(m).some((c) => mesures.some((x) => x.valeurs[c] !== undefined))).map((m) => m.id))
  // Côté affiché : celui choisi s'il a des valeurs, sinon l'autre.
  const cles = clesDe(def)
  const cleCourbe = def.cotes ? (serie(mesures, `${def.id}_${cote}`).length ? `${def.id}_${cote}` : cles.find((c) => serie(mesures, c).length) ?? cles[0]) : cles[0]
  const points = serie(mesures, cleCourbe)

  return (
    <>
      <button className="btn primaire grand" style={{ marginBottom: 12 }} onClick={() => onSaisir('nouvelle')}>
        + Prendre mes mensurations
      </button>

      <Tendances mesures={mesures} />

      <div className="carte mesures-haut">
        <SilhouetteMesures active={active} onChoix={setActive} remplies={remplies} />
        <div className="pile" style={{ gap: 8, minWidth: 0 }}>
          <div>
            <div className="faible">{MESURES.indexOf(def) + 1}</div>
            <h2>{def.nom}</h2>
          </div>
          <div className="petit">{def.consigne}</div>
          <ValeursMesure def={def} mesures={mesures} />
        </div>
      </div>

      {points.length >= 2 && (
        <div className="carte">
          <div className="ligne entre">
            <h3>{def.nom}</h3>
            {def.cotes && cles.every((c) => serie(mesures, c).length) && (
              <div className="chips">
                {(['g', 'd'] as const).map((c) => (
                  <button key={c} className={cleCourbe.endsWith('_' + c) ? 'actif' : ''} onClick={() => setCote(c)}>
                    {c === 'g' ? 'Gauche' : 'Droite'}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Courbe key={cleCourbe} points={points} format={cm} label={`Évolution : ${def.nom}`} />
        </div>
      )}

      {mesures.length > 0 && (
        <div className="carte">
          <h3>Depuis le début</h3>
          <div className="faible" style={{ margin: '4px 0 8px' }}>
            Dernière valeur et écart avec la première prise. Un appui sur une ligne la montre sur la silhouette.
          </div>
          {MESURES.filter((m) => remplies.has(m.id)).map((m) =>
            clesDe(m)
              .filter((c) => serie(mesures, c).length)
              .map((c) => {
                const s = serie(mesures, c)
                const d = s[s.length - 1].valeur - s[0].valeur
                return (
                  <button key={c} className={'ligne-mesure' + (m.id === active ? ' active' : '')} onClick={() => (setActive(m.id), c.endsWith('_d') ? setCote('d') : setCote('g'))}>
                    <span>{nomCle(c)}</span>
                    <span>
                      <strong>{cm(s[s.length - 1].valeur)}</strong>
                      {s.length > 1 && <span className="ecart-mesure"> {signe(d)}</span>}
                    </span>
                  </button>
                )
              })
          )}
        </div>
      )}

      {mesures.length > 0 && (
        <div className="carte">
          <h3>Prises</h3>
          {[...mesures].reverse().map((m) => (
            <button key={m.date} className="ligne-mesure" onClick={() => onSaisir(m)}>
              <span>{dateCourte(m.date)}</span>
              <span className="faible">
                {Object.keys(m.valeurs).length} mesure{Object.keys(m.valeurs).length > 1 ? 's' : ''} ✎
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="faible" style={{ marginBottom: 16 }}>
        💡 {CONSEILS_MESURE}
      </div>
    </>
  )
}

/** Dernière valeur de la mesure (par côté) et écart avec la prise d'avant. */
function ValeursMesure({ def, mesures }: { def: DefMesure; mesures: Mesure[] }) {
  const lignes = clesDe(def)
    .map((c) => ({ c, s: serie(mesures, c) }))
    .filter((x) => x.s.length)
  if (!lignes.length) return <div className="faible">Pas encore mesuré.</div>
  // Date sous chaque valeur seulement si les côtés n'ont pas été mesurés le même jour.
  const memeJour = new Set(lignes.map((l) => l.s[l.s.length - 1].date)).size === 1
  return (
    <div>
      {lignes.map(({ c, s }) => {
        const der = s[s.length - 1]
        const d = s.length > 1 ? der.valeur - s[s.length - 2].valeur : null
        return (
          <div key={c}>
            {def.cotes && <span className="faible">{c.endsWith('_g') ? 'G ' : 'D '}</span>}
            <strong className="valeur-mesure">{cm(der.valeur)}</strong>
            {d !== null && <span className="faible"> {signe(d)}</span>}
            {!memeJour && <div className="faible">le {dateCourte(der.date)}</div>}
          </div>
        )
      })}
      {memeJour && <div className="faible">le {dateCourte(lignes[0].s[lignes[0].s.length - 1].date)}</div>}
    </div>
  )
}

/** Saisie d'une prise de mensurations : tout d'un coup, chaque champ facultatif. */
function SaisieMesures({ initial, derniere, onFermer }: { initial?: Mesure; derniere?: Mesure; onFermer: () => void }) {
  const [date, setDate] = useState(initial?.date ?? dateISO())
  const [textes, setTextes] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(initial?.valeurs ?? {}).map(([k, v]) => [k, String(v).replace('.', ',')]))
  )
  const [active, setActive] = useState<string>('cou')
  const modifie = JSON.stringify(textes) !== JSON.stringify(Object.fromEntries(Object.entries(initial?.valeurs ?? {}).map(([k, v]) => [k, String(v).replace('.', ',')])))
  const fermer = () => {
    if (modifie && !confirm('Quitter sans enregistrer ?')) return 'rester' as const
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
    if (!initial || !confirm(`Supprimer la prise du ${dateCourte(initial.date)} ?`)) return
    await db.mesures.delete(initial.date)
    onFermer()
  }

  const champ = (cle: string, label?: string) => (
    <label className="champ-mesure" key={cle}>
      {label && <span className="faible">{label}</span>}
      <span className="ligne" style={{ gap: 4 }}>
        <input
          inputMode="decimal"
          placeholder={ref?.valeurs[cle] !== undefined ? kg(ref.valeurs[cle]) : '—'}
          value={textes[cle] ?? ''}
          onFocus={() => setActive(cle.replace(/_[gd]$/, ''))}
          onChange={(e) => setTextes((x) => ({ ...x, [cle]: e.target.value }))}
        />
        <span className="faible">cm</span>
      </span>
    </label>
  )

  return (
    <div>
      <div className="entete">
        <button className="btn" onClick={fermer} aria-label="Retour">
          ←
        </button>
        <h2 style={{ flex: 1 }}>{initial ? 'Modifier la prise' : 'Mensurations'}</h2>
      </div>
      <div className="carte pile">
        <label className="champ">
          <span>Date</span>
          <input type="date" value={date} max={dateISO()} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <div className="faible">💡 {CONSEILS_MESURE} Remplis seulement ce que tu mesures ; en gris, ta dernière valeur.</div>
      </div>

      <div className="saisie-mesures">
        <div className="saisie-silhouette">
          <SilhouetteMesures active={active} onChoix={setActive} />
        </div>
        <div>
          {MESURES.map((m, k) => (
            <div key={m.id} className={'carte pile mesure-saisie' + (m.id === active ? ' active' : '')} onClick={() => setActive(m.id)}>
              <div className="ligne" style={{ gap: 8 }}>
                <span className="num-mesure">{k + 1}</span>
                <strong>{m.nom}</strong>
              </div>
              {m.id === active && <div className="faible">{m.consigne}</div>}
              <div className="ligne" style={{ gap: 12 }}>
                {m.cotes ? [champ(`${m.id}_g`, 'Gauche'), champ(`${m.id}_d`, 'Droite')] : champ(m.id)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="barre-demarrer">
        <button className="btn primaire grand" disabled={!Object.keys(valeurs).length} onClick={enregistrer}>
          ENREGISTRER
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
  const points = [...pesees].reverse().map((p) => ({ date: p.date, valeur: p.poids }))
  return (
    <>
      <Poids pesees={pesees} aujourdhui={dateISO()} />
      {points.length >= 2 && (
        <div className="carte">
          <h3>Évolution</h3>
          <Courbe points={points} format={(v) => `${kg(v)} kg`} label="Évolution du poids" />
        </div>
      )}
      {pesees.length > 0 && (
        <div className="carte">
          <h3>Pesées</h3>
          {pesees.slice(0, 30).map((p) => (
            <div key={p.date} className="ligne-mesure">
              <span>{dateCourte(p.date)}</span>
              <span className="ligne" style={{ gap: 8 }}>
                <strong>{kg(p.poids)} kg</strong>
                <button className="btn discret petit" aria-label="Supprimer" onClick={() => confirm(`Supprimer la pesée du ${dateCourte(p.date)} ?`) && db.pesees.delete(p.date)}>
                  ✕
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
