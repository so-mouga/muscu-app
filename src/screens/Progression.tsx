import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import type { Catalogue } from '../catalogue'
import { db, exoAvecReglages, setReglage } from '../db'
import { chargeTexte, dateCourte, e1rm, kg, serieTexte } from '../lib/calc'
import { transition, useRetour } from '../lib/nav'
import type { Exercice, Seance } from '../types'

export default function Progression({ catalogue }: { catalogue: Catalogue }) {
  const seances = useLiveQuery(() => db.seances.orderBy('debut').reverse().filter((s) => !s.enCours).toArray(), [], [])
  const reglages = useLiveQuery(() => db.reglages.toArray(), [], [])
  const [choisi, setChoisiEtat] = useState<string | null>(null)
  const setChoisi = (id: string | null) => (transition(() => setChoisiEtat(id), id ? 'avant' : 'arriere'), window.scrollTo({ top: 0 }))
  useRetour(!!choisi, () => setChoisi(null))

  if (choisi) return <Detail exo={exoAvecReglages(catalogue.exo(choisi), reglages)} seances={seances} onRetour={() => setChoisi(null)} />

  // Exercices pratiqués, du plus récent au plus ancien
  const vus: { id: string; date: string; n: number }[] = []
  for (const s of seances)
    for (const x of s.series) if (!vus.some((v) => v.id === x.exoId)) vus.push({ id: x.exoId, date: s.date, n: 0 })
  for (const v of vus) v.n = seances.filter((s) => s.series.some((x) => x.exoId === v.id)).length

  return (
    <div>
      <div className="entete">
        <h1>Progression</h1>
        <span className="faible">{seances.length} séances</span>
      </div>
      {vus.length === 0 && <div className="carte muted">Termine une première séance pour voir ta progression ici.</div>}
      {vus.map((v) => (
        <button key={v.id} className="liste-btn" onClick={() => setChoisi(v.id)}>
          <span>
            <strong>{catalogue.exo(v.id).nom}</strong>
            <div className="faible">
              {v.n} séance{v.n > 1 ? 's' : ''} · dernière {dateCourte(v.date)}
            </div>
          </span>
          <span className="muted">›</span>
        </button>
      ))}
    </div>
  )
}

function Detail({ exo, seances, onRetour }: { exo: Exercice; seances: Seance[]; onRetour: () => void }) {
  const [pas, setPas] = useState(String(exo.pas).replace('.', ','))
  const avec = seances.filter((s) => s.series.some((x) => x.exoId === exo.id))
  const chrono = [...avec].reverse()

  // Point par séance : e1RM (composés) ou charge de travail max (isolation)
  const points = chrono.map((s) => {
    const series = s.series.filter((x) => x.exoId === exo.id)
    const valeur = exo.suivreE1rm
      ? Math.max(0, ...series.map((x) => e1rm(exo, x, s.poidsCorps) ?? 0))
      : Math.max(...series.map((x) => x.charge))
    return { date: s.date, valeur, series }
  }).filter((p) => !exo.suivreE1rm || p.valeur > 0)

  // Records
  const toutes = avec.flatMap((s) => s.series.filter((x) => x.exoId === exo.id).map((x) => ({ x, s })))
  const meilleurE1rm = exo.suivreE1rm ? Math.max(0, ...toutes.map(({ x, s }) => e1rm(exo, x, s.poidsCorps) ?? 0)) : 0
  const repsParCharge = new Map<number, number>()
  for (const { x } of toutes) repsParCharge.set(x.charge, Math.max(repsParCharge.get(x.charge) ?? 0, x.reps))
  const demiReps = chrono.flatMap((s) =>
    s.series.filter((x) => x.exoId === exo.id && x.type === 'serie_longue').map((x) => ({ date: s.date, x }))
  )

  const majPas = async () => {
    const v = parseFloat(pas.replace(',', '.'))
    if (v > 0) await setReglage(`pas:${exo.id}`, v)
  }

  return (
    <div>
      <div className="entete">
        <button className="btn" onClick={onRetour}>
          ←
        </button>
        <h2 style={{ flex: 1 }}>{exo.nom}</h2>
      </div>

      <div className="carte">
        <h3>{exo.suivreE1rm ? 'e1RM estimé (kg)' : 'Charge de travail max'}</h3>
        {points.length >= 2 ? (
          <Courbe points={points.map((p) => ({ date: p.date, valeur: p.valeur }))} format={(v) => (exo.suivreE1rm ? `${kg(v)} kg` : chargeTexte(exo, v))} />
        ) : (
          <div className="faible" style={{ marginTop: 8 }}>
            La courbe apparaît à partir de 2 séances{exo.suivreE1rm && exo.mode === 'poids_corps' ? ' (et avec ton poids du jour noté)' : ''}.
          </div>
        )}
      </div>

      <div className="carte">
        <h3 style={{ marginBottom: 6 }}>Records</h3>
        <table>
          <tbody>
            {meilleurE1rm > 0 && (
              <tr>
                <td>Meilleur e1RM</td>
                <td>{kg(meilleurE1rm)} kg</td>
              </tr>
            )}
            {[...repsParCharge.entries()]
              .sort((a, b) => b[0] - a[0])
              .slice(0, 6)
              .map(([c, r]) => (
                <tr key={c}>
                  <td>Max reps à {chargeTexte(exo, c)}</td>
                  <td>{r}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {demiReps.length > 0 && (
        <div className="carte">
          <h3 style={{ marginBottom: 6 }}>Demi-reps de finisseur</h3>
          <div className="petit">
            {demiReps.map(({ date, x }, i) => (
              <span key={i}>
                {i > 0 && ' → '}
                <strong>{x.demiReps}</strong> <span className="faible">({chargeTexte(exo, x.charge)}, {dateCourte(date)})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="carte">
        <h3 style={{ marginBottom: 6 }}>Séances</h3>
        {avec.map((s) => (
          <div key={s.id} style={{ marginBottom: 10 }}>
            <div className="faible">
              {dateCourte(s.date)} · {s.nom}
            </div>
            <div className="petit">
              {s.series
                .filter((x) => x.exoId === exo.id)
                .map((x) => serieTexte(exo, x))
                .join(' · ')}
            </div>
            {s.notes[exo.id] && <div className="faible">📝 {s.notes[exo.id]}</div>}
          </div>
        ))}
      </div>

      <div className="carte pile">
        <h3>Réglage</h3>
        <div className="ligne">
          <span className="petit" style={{ whiteSpace: 'nowrap' }}>
            Pas de charge
          </span>
          <input inputMode="decimal" value={pas} onChange={(e) => setPas(e.target.value)} onBlur={majPas} />
          <span className="faible">{exo.mode === 'elastique' ? 'niveau' : 'kg'}</span>
        </div>
        <div className="faible">Utilisé par les boutons −/+ et pour calculer la prochaine charge.</div>
      </div>
    </div>
  )
}

/** Courbe à une seule série : ligne 2 px, points 8 px, valeur au toucher. */
function Courbe({ points, format }: { points: { date: string; valeur: number }[]; format: (v: number) => string }) {
  const [actif, setActif] = useState(points.length - 1)
  const L = 320
  const H = 140
  const m = { g: 8, d: 8, h: 12, b: 22 }
  const vals = points.map((p) => p.valeur)
  let min = Math.min(...vals)
  let max = Math.max(...vals)
  if (max - min < 1) (min -= 1), (max += 1)
  const x = (i: number) => m.g + (i / (points.length - 1)) * (L - m.g - m.d)
  const y = (v: number) => m.h + (1 - (v - min) / (max - min)) * (H - m.h - m.b)
  const p = points[actif]

  return (
    <div style={{ marginTop: 8 }}>
      <div className="ligne entre petit" style={{ marginBottom: 4 }}>
        <strong>{format(p.valeur)}</strong>
        <span className="faible">{dateCourte(p.date)}</span>
      </div>
      <svg className="graph" viewBox={`0 0 ${L} ${H}`} width="100%" role="img" aria-label="Évolution par séance">
        {[min, (min + max) / 2, max].map((v) => (
          <line key={v} x1={m.g} x2={L - m.d} y1={y(v)} y2={y(v)} stroke="var(--bord)" strokeWidth="1" />
        ))}
        <polyline
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinejoin="round"
          points={points.map((q, i) => `${x(i)},${y(q.valeur)}`).join(' ')}
        />
        <line x1={x(actif)} x2={x(actif)} y1={m.h} y2={H - m.b} stroke="var(--texte-3)" strokeWidth="1" strokeDasharray="3 3" />
        {points.map((q, i) => (
          <g key={i} onClick={() => setActif(i)} style={{ cursor: 'pointer' }}>
            <rect x={x(i) - 14} y={0} width={28} height={H} fill="transparent" />
            <circle cx={x(i)} cy={y(q.valeur)} r={i === actif ? 5 : 4} fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
          </g>
        ))}
        <text x={m.g} y={H - 6}>
          {dateCourte(points[0].date)}
        </text>
        <text x={L - m.d} y={H - 6} textAnchor="end">
          {dateCourte(points[points.length - 1].date)}
        </text>
      </svg>
    </div>
  )
}
