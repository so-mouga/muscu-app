import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { MESURES, clesDe, nomCle } from '../data/mesures'
import { db, setReglage } from '../db'
import { dateCourte, dateISO, kg } from '../lib/calc'
import type { Mesure, Pesee } from '../types'

/** Couleurs des lignes, dans un ordre fixe (lisibles pour les daltoniens), et forme du point de chacune. */
const COULEURS = ['#56b4e9', '#e69f00', '#2bb58c', '#d483b3']
const FORMES = ['rond', 'carre', 'triangle', 'losange'] as const
const MAX = 4

const PERIODES: [string, number][] = [
  ['1 mois', 30],
  ['3 mois', 91],
  ['6 mois', 182],
  ['Tout', 0],
]

interface Courbe {
  cle: string
  nom: string
  unite: string
  points: { date: string; valeur: number }[]
}

/** Poids lissé sur 7 jours à chaque pesée : les variations d'un jour (eau, repas) masqueraient la tendance. */
function poidsLisse(pesees: Pesee[]) {
  const tri = [...pesees].sort((a, b) => a.date.localeCompare(b.date))
  return tri.map((p) => {
    const debut = Date.parse(p.date) - 6 * 86400000
    const fenetre = tri.filter((q) => q.date <= p.date && Date.parse(q.date) >= debut)
    return { date: p.date, valeur: fenetre.reduce((a, q) => a + q.poids, 0) / fenetre.length }
  })
}

function courbes(pesees: Pesee[], mesures: Mesure[]): Courbe[] {
  const liste: Courbe[] = [{ cle: 'poids', nom: 'Poids (moy. 7 j)', unite: 'kg', points: poidsLisse(pesees) }]
  for (const m of MESURES)
    for (const c of clesDe(m))
      liste.push({ cle: c, nom: nomCle(c), unite: 'cm', points: mesures.filter((x) => x.valeurs[c] !== undefined).map((x) => ({ date: x.date, valeur: x.valeurs[c] })) })
  return liste.filter((c) => c.points.length > 0)
}

/** Épinglées par défaut : poids, taille, un bras, poitrine (parmi ce qui a des données). */
function parDefaut(dispo: Courbe[]) {
  const a = new Set(dispo.map((c) => c.cle))
  const bras = ['bras_d', 'bras_g'].find((c) => a.has(c))
  return ['poids', 'taille', bras, 'poitrine', 'cuisse_d', 'cuisse_g', 'epaules'].filter((c): c is string => !!c && a.has(c)).slice(0, MAX)
}

/** Arrondi au dixième avant le signe : pas de « −0 ». */
const signe = (v: number, u: string, zero: string) => {
  const r = Math.round(v * 10) / 10
  return `${r > 0 ? '+' : r < 0 ? '−' : zero}${kg(Math.abs(r))} ${u}`
}
const pct = (v: number) => signe(v, '%', '')
const ecart = (v: number, u: string) => signe(v, u, '±')

function Point({ forme, x, y, couleur, r = 4 }: { forme: (typeof FORMES)[number]; x: number; y: number; couleur: string; r?: number }) {
  const bord = { fill: couleur, stroke: 'var(--surface)', strokeWidth: 1.5 }
  if (forme === 'carre') return <rect x={x - r} y={y - r} width={r * 2} height={r * 2} {...bord} />
  if (forme === 'triangle') return <path d={`M${x} ${y - r * 1.2} L${x + r * 1.1} ${y + r * 0.8} L${x - r * 1.1} ${y + r * 0.8} Z`} {...bord} />
  if (forme === 'losange') return <path d={`M${x} ${y - r * 1.25} L${x + r * 1.1} ${y} L${x} ${y + r * 1.25} L${x - r * 1.1} ${y} Z`} {...bord} />
  return <circle cx={x} cy={y} r={r} {...bord} />
}

/** Plusieurs mesures sur un même graphique, en % d'évolution depuis le début de la période. */
export default function Tendances({ mesures }: { mesures: Mesure[] }) {
  const pesees = useLiveQuery(() => db.pesees.toArray(), [], [])
  const reglage = useLiveQuery(() => db.reglages.get('tendances'), [])
  const [jours, setJours] = useState(91)
  const [choix, setChoix] = useState(false)
  const [actif, setActif] = useState<string | null>(null)

  const dispo = courbes(pesees, mesures)
  const epinglees = ((reglage?.valeur as string[] | undefined) ?? parDefaut(dispo)).filter((c) => dispo.some((d) => d.cle === c)).slice(0, MAX)
  const debut = jours ? dateISO(new Date(Date.now() - jours * 86400000)) : ''
  const series = epinglees.map((cle, i) => {
    const c = dispo.find((d) => d.cle === cle)!
    const pts = c.points.filter((p) => p.date >= debut)
    const base = pts[0]?.valeur
    return { ...c, i, pts: pts.map((p) => ({ ...p, pct: base ? ((p.valeur - base) / base) * 100 : 0 })) }
  })
  const traces = series.filter((s) => s.pts.length >= 2)

  if (!dispo.some((c) => c.points.length >= 2)) return null

  // Échelles : temps en abscisse, % en ordonnée (0 toujours visible, pas d'au moins 1 %).
  const L = 320
  const H = 170
  const m = { g: 36, d: 8, h: 10, b: 20 }
  const dates = traces.flatMap((s) => s.pts.map((p) => Date.parse(p.date)))
  const t0 = Math.min(...dates)
  const t1 = Math.max(...dates, t0 + 86400000)
  const vals = traces.flatMap((s) => s.pts.map((p) => p.pct))
  const pas = Math.max(1, Math.ceil((Math.max(...vals, 0) - Math.min(...vals, 0)) / 4))
  const vMax = Math.max(pas, Math.ceil(Math.max(...vals, 0) / pas) * pas)
  const vMin = Math.min(-pas, Math.floor(Math.min(...vals, 0) / pas) * pas)
  const x = (d: string) => m.g + ((Date.parse(d) - t0) / (t1 - t0)) * (L - m.g - m.d)
  const y = (v: number) => m.h + ((vMax - v) / (vMax - vMin)) * (H - m.h - m.b)
  const graduations: number[] = []
  for (let v = vMin; v <= vMax + 1e-9; v += pas) graduations.push(v)
  const toutesDates = [...new Set(traces.flatMap((s) => s.pts.map((p) => p.date)))].sort()

  return (
    <div className="carte pile">
      <div className="ligne entre">
        <div>
          <h3>Tendances</h3>
          <div className="faible">
            {epinglees.length} mesure{epinglees.length > 1 ? 's' : ''} suivie{epinglees.length > 1 ? 's' : ''}
          </div>
        </div>
        <button className="btn discret petit" onClick={() => setChoix(!choix)}>
          {choix ? 'OK' : '✎ Choisir'}
        </button>
      </div>

      {choix ? (
        <div>
          <div className="faible" style={{ marginBottom: 6 }}>
            Jusqu’à {MAX} mesures sur le graphique.
          </div>
          <div className="chips">
            {dispo.map((c) => {
              const on = epinglees.includes(c.cle)
              return (
                <button
                  key={c.cle}
                  className={on ? 'actif' : ''}
                  disabled={!on && epinglees.length >= MAX}
                  onClick={() => void setReglage('tendances', on ? epinglees.filter((x) => x !== c.cle) : [...epinglees, c.cle])}
                >
                  {on ? '✓ ' : ''}
                  {c.nom}
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <>
          <div className="segments" role="tablist" style={{ marginBottom: 0 }}>
            {PERIODES.map(([nom, j]) => (
              <button key={nom} role="tab" aria-selected={jours === j} className={jours === j ? 'actif' : ''} onClick={() => (setJours(j), setActif(null))}>
                {nom}
              </button>
            ))}
          </div>

          {traces.length === 0 ? (
            <div className="faible">Pas assez de valeurs sur cette période : il en faut au moins deux par mesure.</div>
          ) : (
            <div>
              <div className="faible" style={{ marginBottom: 4 }}>
                Évolution en % depuis la première valeur de la période
              </div>
              <svg className="graph" viewBox={`0 0 ${L} ${H}`} width="100%" role="img" aria-label="Évolution des mesures suivies, en pourcentage">
                {graduations.map((v) => (
                  <g key={v}>
                    <line x1={m.g} x2={L - m.d} y1={y(v)} y2={y(v)} stroke="var(--bord)" strokeWidth={v === 0 ? 1.5 : 1} strokeDasharray={v === 0 ? '4 3' : undefined} />
                    <text x={m.g - 4} y={y(v) + 3} textAnchor="end">
                      {v === 0 ? '0 %' : pct(v)}
                    </text>
                  </g>
                ))}
                {traces.map((s) => (
                  <polyline
                    key={s.cle}
                    fill="none"
                    stroke={COULEURS[s.i]}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeDasharray={s.i === 0 ? undefined : s.i === 1 ? '6 3' : s.i === 2 ? '2 3' : '8 3 2 3'}
                    points={s.pts.map((p) => `${x(p.date)},${y(p.pct)}`).join(' ')}
                  />
                ))}
                {actif && <line x1={x(actif)} x2={x(actif)} y1={m.h} y2={H - m.b} stroke="var(--texte-3)" strokeDasharray="3 3" />}
                {/* Points : tous s'ils sont peu nombreux, sinon le premier, le dernier et celui sélectionné. */}
                {traces.map((s) =>
                  s.pts
                    .filter((p, k) => s.pts.length <= 15 || k === 0 || k === s.pts.length - 1 || p.date === actif)
                    .map((p) => <Point key={s.cle + p.date} forme={FORMES[s.i]} x={x(p.date)} y={y(p.pct)} couleur={COULEURS[s.i]} r={p.date === actif ? 5 : 3.5} />)
                )}
                {/* Zones d'appui par date (plus larges que les points) */}
                {toutesDates.map((d, k) => {
                  const g = k ? (x(toutesDates[k - 1]) + x(d)) / 2 : m.g
                  const dr = k < toutesDates.length - 1 ? (x(d) + x(toutesDates[k + 1])) / 2 : L - m.d
                  return <rect key={d} x={g} y={0} width={Math.max(1, dr - g)} height={H} fill="transparent" onClick={() => setActif(actif === d ? null : d)} />
                })}
                <text x={m.g} y={H - 4}>
                  {dateCourte(toutesDates[0])}
                </text>
                <text x={L - m.d} y={H - 4} textAnchor="end">
                  {dateCourte(toutesDates[toutesDates.length - 1])}
                </text>
              </svg>
              {actif && (
                <div className="faible" style={{ marginTop: 2 }}>
                  {dateCourte(actif)} :{' '}
                  {traces
                    .map((s) => {
                      const p = [...s.pts].reverse().find((q) => q.date <= actif)
                      return p ? `${s.nom.replace(' (moy. 7 j)', '')} ${pct(p.pct)}` : null
                    })
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              )}
            </div>
          )}

          <div className="legende-tendances">
            {series.map((s) => {
              const der = s.pts[s.pts.length - 1]
              const prem = s.pts[0]
              return (
                <div key={s.cle}>
                  <div className="ligne" style={{ gap: 6 }}>
                    <svg width={22} height={12} aria-hidden="true">
                      <line x1={1} x2={21} y1={6} y2={6} stroke={COULEURS[s.i]} strokeWidth={2} />
                      <Point forme={FORMES[s.i]} x={11} y={6} couleur={COULEURS[s.i]} r={3.5} />
                    </svg>
                    <span className="petit">{s.nom}</span>
                  </div>
                  {der ? (
                    <>
                      <strong className="valeur-tendance">
                        {kg(Math.round(der.valeur * 10) / 10)} <span className="faible">{s.unite}</span>
                      </strong>
                      <div className="faible">{s.pts.length >= 2 ? `${ecart(der.valeur - prem.valeur, s.unite)} · ${pct(der.pct)}` : 'une seule valeur'}</div>
                      <div className="faible">{dateCourte(der.date)}</div>
                    </>
                  ) : (
                    <div className="faible">rien sur la période</div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
