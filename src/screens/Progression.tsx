import { useState } from 'react'
import { nomMuscle } from '../components/ChoixExo'
import { MODES } from '../components/FormExo'
import { chargeTexte, dateCourte, duree, e1rm, kg, serieTexte, tempsParExo } from '../lib/calc'
import type { Exercice, Seance } from '../types'

/** Fiche d'un exercice : photo, réglages, progression et historique. */
export function Detail({
  exo,
  seances,
  onRetour,
  onModifier,
  onSupprimer,
  equivalents,
  onRelier,
  onDelier,
}: {
  exo: Exercice
  seances: Seance[]
  onRetour: () => void
  onModifier: () => void
  onSupprimer: () => void
  /** Exercices reliés, avec leur dernière meilleure série. */
  equivalents: { exo: Exercice; derniere?: string }[]
  onRelier: () => void
  onDelier: (id: string) => void
}) {
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


  return (
    <div>
      <div className="entete">
        <button className="btn" onClick={onRetour}>
          ←
        </button>
        <h2 style={{ flex: 1 }}>{exo.nom}</h2>
        <button className="btn" onClick={onModifier}>
          Modifier
        </button>
      </div>

      <div className="carte pile">
        {exo.image && <img src={exo.image} alt={exo.nom} className="photo-grande" />}
        <table>
          <tbody>
            <tr>
              <td>Muscle</td>
              <td>
                {nomMuscle(exo.muscle)}
                {exo.secondaires?.length ? ` (+ ${exo.secondaires.map((x) => nomMuscle(x.muscle).toLowerCase()).join(', ')})` : ''}
              </td>
            </tr>
            <tr>
              <td>Type</td>
              <td>{exo.type === 'compose' ? 'composé (suivi e1RM)' : 'isolation'}</td>
            </tr>
            <tr>
              <td>Charge</td>
              <td>
                {MODES.find((m) => m[0] === exo.mode)?.[1]} · pas {kg(exo.pas)}
                {exo.mode === 'elastique' ? '' : ' kg'}
              </td>
            </tr>
          </tbody>
        </table>
        {exo.notes && <div className="petit muted">📝 {exo.notes}</div>}
      </div>

      <div className="carte pile">
        <div>
          <h3>Équivalents</h3>
          <div className="faible">
            Exercices qui le remplacent quand la machine est prise. Ils sont proposés en premier, et chacun garde sa propre progression.
          </div>
        </div>
        {equivalents.map((e) => (
          <div key={e.exo.id} className="ligne entre">
            <span>
              ⇄ <strong>{e.exo.nom}</strong>
              {e.derniere && <div className="faible">dernière fois : {e.derniere}</div>}
            </span>
            <button className="btn discret petit" onClick={() => onDelier(e.exo.id)}>
              Délier
            </button>
          </div>
        ))}
        <button className="btn plein" onClick={onRelier}>
          + Relier un exercice
        </button>
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
              {tempsParExo(s)[exo.id] > 0 && ` · ⏱ ${duree(tempsParExo(s)[exo.id])}`}
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

      <button className="btn discret danger plein" style={{ marginBottom: 24 }} onClick={onSupprimer}>
        Supprimer l’exercice
      </button>
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
