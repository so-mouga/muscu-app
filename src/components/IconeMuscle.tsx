import { MUSCLES, type Zone } from '../data/exercices'
import type { Muscle } from '../types'

type Forme = { m?: Muscle; e: [number, number, number, number] } | { m?: Muscle; d: string }

// Silhouette stylisée (viewBox 60 × 100), une paire de formes par muscle.
const paire = (m: Muscle | undefined, x: number, y: number, rx: number, ry: number): Forme[] => [
  { m, e: [x, y, rx, ry] },
  { m, e: [60 - x, y, rx, ry] },
]

const COMMUN: Forme[] = [
  { e: [30, 8, 5.5, 6.5] }, // tête
  ...paire(undefined, 10.5, 56, 2.2, 3), // mains
  ...paire(undefined, 25.5, 94, 3, 2.2), // pieds
]

const AVANT: Forme[] = [
  ...COMMUN,
  { d: 'M27 14h6v5h-6z' }, // cou
  ...paire('epaule_laterale', 15.5, 23, 3.6, 5),
  ...paire('epaule_avant', 20, 23.5, 3, 4.2),
  { m: 'pecs', d: 'M21.5 21.5 Q25 19.5 29.4 20.5 V31 Q25 33 21.5 30 Z' },
  { m: 'pecs', d: 'M38.5 21.5 Q35 19.5 30.6 20.5 V31 Q35 33 38.5 30 Z' },
  { m: 'abdos', d: 'M23.5 33 Q30 31 36.5 33 L35.5 50 Q30 52.5 24.5 50 Z' },
  ...paire('biceps', 14, 34, 3.2, 6.2),
  ...paire('avant_bras', 12, 46.5, 2.7, 6),
  ...paire('quadriceps', 25, 66, 4.6, 11),
  ...paire('adducteurs', 28.6, 59, 1.4, 6),
  ...paire(undefined, 25.5, 85.5, 3, 6.5), // tibias
]

const ARRIERE: Forme[] = [
  ...COMMUN,
  { m: 'trapezes', d: 'M30 14 L38 21 L30 30 L22 21 Z' },
  ...paire('epaule_arriere', 16, 23, 3.8, 4.8),
  { m: 'dos', d: 'M21.5 24 L29.4 31 V43 Q24.5 40 22.5 33 Z' },
  { m: 'dos', d: 'M38.5 24 L30.6 31 V43 Q35.5 40 37.5 33 Z' },
  { m: 'lombaires', d: 'M25.5 43.5 Q30 45 34.5 43.5 L35 50.5 Q30 52 25 50.5 Z' },
  ...paire('triceps', 14, 34, 3.2, 6.2),
  ...paire(undefined, 12, 46.5, 2.7, 6), // avant-bras
  ...paire('fessiers', 25.4, 57, 5, 5.2),
  ...paire('ischios', 25.2, 70, 4.4, 8.5),
  ...paire('mollets', 25.5, 85.5, 3.3, 6.5),
]

const MUSCLES_ZONE = (z: Zone) => MUSCLES.filter((m) => m.zone === z).map((m) => m.id)
const FACE_ZONE: Record<Zone, 'avant' | 'arriere'> = { pecs: 'avant', dos: 'arriere', epaules: 'avant', bras: 'avant', jambes: 'avant', abdos: 'avant' }

interface Props {
  /** Un muscle, ou une zone entière (filtres). */
  muscle?: Muscle
  zone?: Zone
  taille?: number
}

/** Silhouette de face ou de dos avec le muscle travaillé en couleur. */
export default function IconeMuscle({ muscle, zone, taille = 40 }: Props) {
  const actifs = new Set<Muscle>(zone ? MUSCLES_ZONE(zone) : muscle ? [muscle] : [])
  const face = zone ? FACE_ZONE[zone] : (MUSCLES.find((m) => m.id === muscle)?.face ?? 'avant')
  const formes = face === 'avant' ? AVANT : ARRIERE
  // Cadrage sur la moitié du corps concernée, pour que le muscle se voie même en petit.
  const jambes = zone ? zone === 'jambes' : MUSCLES.find((m) => m.id === muscle)?.zone === 'jambes'
  const cadre = jambes ? '6 44 48 56' : '3 0 54 56'
  return (
    <span className="icone-muscle" style={{ width: taille, height: taille }} aria-hidden="true">
      <svg viewBox={cadre} width={taille} height={taille}>
        {formes.map((f, i) => {
          const fill = f.m && actifs.has(f.m) ? 'var(--accent)' : 'var(--silhouette)'
          return 'e' in f ? <ellipse key={i} cx={f.e[0]} cy={f.e[1]} rx={f.e[2]} ry={f.e[3]} fill={fill} /> : <path key={i} d={f.d} fill={fill} />
        })}
      </svg>
    </span>
  )
}
