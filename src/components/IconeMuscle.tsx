import { MUSCLES, type Zone } from '../data/exercices'
import type { Muscle } from '../types'

export type Forme = { m?: Muscle; d: string }

/** Contour athlétique du corps entier (fond sombre). */
export const CONTOUR_CORPS =
  'M60 8 C52 8 47 14 47 22 C47 29 51 34 53 36 L51 42 L34 45 C24 47 19 54 17 64 L13 88 L8 114 C7 119 10 124 14 123 L18 115 L23 92 L28 70 L32 68 L34 88 L37 108 L34 146 L37 188 L35 208 C35 212 42 213 46 210 L47 190 L52 150 L57 118 L60 118 L63 118 L68 150 L73 190 L74 210 C78 213 85 212 85 208 L83 188 L86 146 L83 108 L86 88 L88 68 L92 70 L97 92 L102 115 L106 123 C110 124 113 119 112 114 L107 88 L103 64 C101 54 96 47 86 45 L69 42 L67 36 C69 34 73 29 73 22 C73 14 68 8 60 8 Z'

export const AVANT: Forme[] = [
  // Trapèzes (haut)
  { d: 'M51 38 L37 44 L46 46 L53 41 Z M69 38 L83 44 L74 46 L67 41 Z' },
  // Pectoraux (gauche et droite)
  { m: 'pecs', d: 'M59 46 L42 46 C37 50 35 57 36 64 C39 68 49 69 59 65 Z' },
  { m: 'pecs', d: 'M61 46 L78 46 C83 50 85 57 84 64 C81 68 71 69 61 65 Z' },
  // Épaule latérale (externe)
  { m: 'epaule_laterale', d: 'M35 45 C26 47 21 54 21 63 C23 65 27 64 31 59 C33 54 34 49 35 45 Z' },
  { m: 'epaule_laterale', d: 'M85 45 C94 47 99 54 99 63 C97 65 93 64 89 59 C87 54 86 49 85 45 Z' },
  // Épaule avant (antérieure)
  { m: 'epaule_avant', d: 'M36 46 C33 51 32 57 32 63 C35 63 38 59 40 53 L41 46 Z' },
  { m: 'epaule_avant', d: 'M84 46 C87 51 88 57 88 63 C85 63 82 59 80 53 L79 46 Z' },
  // Biceps
  { m: 'biceps', d: 'M29 63 C24 67 21 76 22 85 C26 87 30 84 32 76 C33 70 32 65 29 63 Z' },
  { m: 'biceps', d: 'M91 63 C96 67 99 76 98 85 C94 87 90 84 88 76 C87 70 88 65 91 63 Z' },
  // Avant-bras
  { m: 'avant_bras', d: 'M21 87 C16 93 13 103 13 112 C16 113 21 106 25 96 L27 88 Z' },
  { m: 'avant_bras', d: 'M99 87 C104 93 107 103 107 112 C104 113 99 106 95 96 L93 88 Z' },
  // Abdos
  { m: 'abdos', d: 'M47 68 L59 67 L59 76 L46 76 Z M61 67 L73 68 L74 76 L61 76 Z M46 78 L59 78 L59 87 L46 87 Z M61 78 L74 78 L74 87 L61 87 Z M47 89 L59 89 L59 103 L49 101 Z M61 89 L73 89 L71 101 L61 103 Z' },
  // Adducteurs
  { m: 'adducteurs', d: 'M51 110 L58 114 L54 142 L49 132 Z' },
  { m: 'adducteurs', d: 'M69 110 L62 114 L66 142 L71 132 Z' },
  // Quadriceps
  { m: 'quadriceps', d: 'M39 106 L49 109 L48 148 C41 148 36 135 36 120 Z M50 133 L55 144 C55 153 50 156 46 152 L48 135 Z' },
  { m: 'quadriceps', d: 'M81 106 L71 109 L72 148 C79 148 84 135 84 120 Z M70 133 L65 144 C65 153 70 156 74 152 L72 135 Z' },
  // Mollets (face)
  { m: 'mollets', d: 'M38 164 C35 173 35 184 38 194 L46 194 C49 183 49 172 45 164 Z' },
  { m: 'mollets', d: 'M82 164 C85 173 85 184 82 194 L74 194 C71 183 71 172 75 164 Z' },
]

export const ARRIERE: Forme[] = [
  // Trapèzes
  { m: 'trapezes', d: 'M60 36 L41 44 L51 58 L60 72 L69 58 L79 44 Z' },
  // Épaule arrière
  { m: 'epaule_arriere', d: 'M36 45 C26 47 21 54 22 62 C27 64 34 60 39 52 Z' },
  { m: 'epaule_arriere', d: 'M84 45 C94 47 99 54 98 62 C93 64 86 60 81 52 Z' },
  // Grand dorsal (Dos V)
  { m: 'dos', d: 'M40 54 L50 60 L58 75 L58 92 C48 89 39 78 36 62 Z' },
  { m: 'dos', d: 'M80 54 L70 60 L62 75 L62 92 C72 89 81 78 84 62 Z' },
  // Lombaires
  { m: 'lombaires', d: 'M48 91 L59 94 L59 106 L46 104 Z M72 91 L61 94 L61 106 L74 104 Z' },
  // Triceps
  { m: 'triceps', d: 'M29 63 C24 68 21 76 22 85 L31 85 C33 77 33 69 29 63 Z' },
  { m: 'triceps', d: 'M91 63 C96 68 99 76 98 85 L89 85 C87 77 87 69 91 63 Z' },
  // Avant-bras dos
  { m: 'avant_bras', d: 'M21 87 C16 93 13 103 13 112 C16 113 21 106 25 96 L27 88 Z' },
  { m: 'avant_bras', d: 'M99 87 C104 93 107 103 107 112 C104 113 99 106 95 96 L93 88 Z' },
  // Fessiers
  { m: 'fessiers', d: 'M44 105 L59 108 L59 125 C49 128 40 122 41 112 Z' },
  { m: 'fessiers', d: 'M76 105 L61 108 L61 125 C71 128 80 122 79 112 Z' },
  // Ischios
  { m: 'ischios', d: 'M41 127 L56 128 L53 156 L40 154 C38 144 38 134 41 127 Z' },
  { m: 'ischios', d: 'M79 127 L64 128 L67 156 L80 154 C82 144 82 134 79 127 Z' },
  // Mollets (dos)
  { m: 'mollets', d: 'M38 162 C34 172 35 184 39 194 L47 194 C50 183 50 172 46 162 Z' },
  { m: 'mollets', d: 'M82 162 C86 172 85 184 81 194 L73 194 C70 183 70 172 74 162 Z' },
]

/** Zones tactiles élargies spécifiques pour les muscles petits ou proches (notamment épaules). */
export const ZONES_TACTILES_AVANT: { m: Muscle; d: string }[] = [
  // Épaule latérale gauche (bien sur l'extérieur du bras)
  { m: 'epaule_laterale', d: 'M18 42 L33 42 L29 65 L17 65 Z' },
  // Épaule latérale droite
  { m: 'epaule_laterale', d: 'M87 42 L102 42 L103 65 L91 65 Z' },
  // Épaule avant gauche (vers l'intérieur et l'aisselle)
  { m: 'epaule_avant', d: 'M33 42 L44 42 L42 66 L29 66 Z' },
  // Épaule avant droite
  { m: 'epaule_avant', d: 'M76 42 L87 42 L91 66 L78 66 Z' },
  // Adducteurs
  { m: 'adducteurs', d: 'M48 108 L72 108 L70 144 L50 144 Z' },
]

export const ZONES_TACTILES_ARRIERE: { m: Muscle; d: string }[] = [
  // Épaule arrière gauche
  { m: 'epaule_arriere', d: 'M18 42 L40 42 L38 65 L19 65 Z' },
  // Épaule arrière droite
  { m: 'epaule_arriere', d: 'M80 42 L102 42 L101 65 L82 65 Z' },
  // Lombaires
  { m: 'lombaires', d: 'M44 88 L76 88 L76 108 L44 108 Z' },
]

const MUSCLES_ZONE = (z: Zone) => MUSCLES.filter((m) => m.zone === z).map((m) => m.id)
const FACE_ZONE: Record<Zone, 'avant' | 'arriere'> = { pecs: 'avant', dos: 'arriere', epaules: 'avant', bras: 'avant', jambes: 'avant', abdos: 'avant' }

interface Props {
  /** Un muscle, ou une zone entière (filtres). */
  muscle?: Muscle
  zone?: Zone
  taille?: number
  /** Muscles secondaires, en orange atténué. */
  secondaires?: Muscle[]
  /** Vue imposée (sinon celle du muscle). */
  face?: 'avant' | 'arriere'
}

/** Silhouette anatomique de face ou de dos avec le muscle travaillé en couleur. */
export default function IconeMuscle({ muscle, zone, taille = 40, secondaires = [], face: faceImposee }: Props) {
  const actifs = new Set<Muscle>(zone ? MUSCLES_ZONE(zone) : muscle ? [muscle] : [])
  const face = faceImposee ?? (zone ? FACE_ZONE[zone] : (MUSCLES.find((m) => m.id === muscle)?.face ?? 'avant'))
  const formes = face === 'avant' ? AVANT : ARRIERE
  // Cadrage sur la moitié du corps concernée (viewBox 120 × 220)
  const jambes = zone ? zone === 'jambes' : MUSCLES.find((m) => m.id === muscle)?.zone === 'jambes'
  const cadre = jambes ? '15 95 90 120' : '10 5 100 120'
  return (
    <span className="icone-muscle" style={{ width: taille, height: taille }} aria-hidden="true">
      <svg viewBox={cadre} width={taille} height={taille}>
        <path d={CONTOUR_CORPS} fill="var(--surface-2)" stroke="var(--bord)" strokeWidth={1} />
        {formes.map((f, i) => {
          const fill = f.m && actifs.has(f.m) ? 'var(--accent)' : f.m && secondaires.includes(f.m) ? 'color-mix(in srgb, var(--accent) 45%, var(--silhouette))' : 'var(--silhouette)'
          return <path key={i} d={f.d} fill={fill} />
        })}
      </svg>
    </span>
  )
}
