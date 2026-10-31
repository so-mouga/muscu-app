import type { ReactNode } from 'react'

// Pictogrammes maison (viewBox 100 × 100) : silhouette en traits épais, mouvement en orange.
const corps = { stroke: 'var(--silhouette)', strokeWidth: 8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }
const fleche = { stroke: 'var(--accent)', strokeWidth: 3.5, strokeLinecap: 'round' as const, fill: 'none', markerEnd: 'url(#pointe)' }
const fantome = { ...corps, opacity: 0.35 }
const tete = (x: number, y: number) => <circle cx={x} cy={y} r={7.5} fill="var(--silhouette)" />
const sol = (d = 'M10 94 H90') => <path stroke="var(--texte-3)" strokeWidth={3} strokeLinecap="round" d={d} />

const DESSINS: Record<string, ReactNode> = {
  // 1. Corde à sauter / Cardio léger
  cardio: (
    <>
      {sol('M20 94 H80')}
      {tete(50, 16)}
      <path {...corps} d="M50 26 V52 M50 52 L43 72 L44 86 M50 52 L57 72 L56 86 M50 32 L34 42 L26 48 M50 32 L66 42 L74 48" />
      {/* Corde qui passe sous les pieds */}
      <path stroke="var(--accent)" strokeWidth={3} strokeLinecap="round" fill="none" d="M26 48 C10 60 12 96 50 96 C88 96 90 60 74 48" />
      {/* Flèche d'impulsion vers le haut */}
      <path {...fleche} d="M50 82 V68" />
    </>
  ),

  // 2. Jumping jacks
  jumping: (
    <>
      {sol('M14 94 H86')}
      {/* Position fantôme : bras le long du corps, jambes serrées */}
      <path {...fantome} d="M50 32 L38 58 M50 32 L62 58 M50 54 L46 90 M50 54 L54 90" />
      {tete(50, 16)}
      {/* Position écartée en X */}
      <path {...corps} d="M50 26 V54 M50 32 L26 18 M50 32 L74 18 M50 54 L30 90 M50 54 L70 90" />
      {/* Flèches de mouvement des bras */}
      <path {...fleche} d="M36 50 C24 44 22 28 28 20" />
      <path {...fleche} d="M64 50 C76 44 78 28 72 20" />
    </>
  ),

  // 3. Moulinets de bras (existant)
  moulinets: (
    <>
      {tete(50, 15)}
      <path {...corps} d="M50 27 V56 M50 56 L42 90 M50 56 L58 90 M22 33 H78" />
      <path {...fleche} d="M14 24 A11 11 0 1 1 13 42" />
      <path {...fleche} d="M86 42 A11 11 0 1 1 87 24" />
    </>
  ),

  // 4. Passages d'épaules élastique ou bâton (existant)
  passages: (
    <>
      {tete(46, 22)}
      <path {...corps} d="M46 34 V62 M46 62 L44 92 M46 62 L50 92 M46 38 L68 16" />
      <circle cx={70} cy={14} r={4} fill="var(--texte-2)" />
      <path {...fantome} d="M46 38 L70 54" />
      <path {...fleche} d="M80 52 C88 18 58 -2 30 12 C20 18 16 30 18 44" />
    </>
  ),

  // 5. Écartés à l'élastique
  ecartes_elastique: (
    <>
      {tete(50, 16)}
      <path {...corps} d="M50 26 V58 M50 58 L44 92 M50 58 L56 92" />
      {/* Position fantôme : mains jointes devant */}
      <path {...fantome} d="M50 34 L38 46 M50 34 L62 46" />
      {/* Bras écartés sur les côtés */}
      <path {...corps} d="M18 36 L50 34 L82 36" />
      {/* Élastique tendu */}
      <path stroke="var(--accent)" strokeWidth={3.5} strokeLinecap="round" d="M18 36 H82" />
      {/* Flèches d'écartement vers l'extérieur */}
      <path {...fleche} d="M38 44 Q24 44 20 38" />
      <path {...fleche} d="M62 44 Q76 44 80 38" />
    </>
  ),

  // 6. Rotations externes à l'élastique
  rotations_externes: (
    <>
      {tete(46, 16)}
      <path {...corps} d="M46 26 V60 M46 60 L42 92 M46 60 L50 92 M46 32 L34 52" />
      {/* Bras actif : coude collé au corps, avant-bras tourné vers l'extérieur */}
      <path {...corps} d="M46 32 L58 48 L84 48" />
      {/* Position fantôme avant-bras vers l'avant */}
      <path {...fantome} d="M58 48 L58 64" />
      {/* Élastique partant de la gauche vers la main */}
      <path stroke="var(--accent)" strokeWidth={3} strokeLinecap="round" d="M14 48 H84" />
      {/* Arc de rotation vers l'extérieur */}
      <path {...fleche} d="M58 62 C72 62 80 58 84 52" />
    </>
  ),

  // 7. Rotations du haut du dos (à 4 pattes)
  thoracique: (
    <>
      {sol('M12 92 H88')}
      {/* Jambes et bassin à 4 pattes */}
      <path {...corps} d="M30 92 V64 L62 60 L62 92" />
      {tete(74, 52)}
      {/* Bras levé vers le ciel avec main derrière la nuque */}
      <path {...corps} d="M62 60 L70 24 L74 42" />
      {/* Flèche d'ouverture vers le haut */}
      <path {...fleche} d="M52 64 C56 42 64 30 68 26" />
    </>
  ),

  // 8. Chat-vache
  chat_vache: (
    <>
      {sol('M12 92 H88')}
      {/* Bras et jambes stables */}
      <path {...corps} d="M30 92 V64 M70 92 V64" />
      {/* Dos rond (chat) */}
      <path {...corps} d="M30 64 Q50 36 70 64" />
      {tete(78, 72)}
      {/* Dos creux (vache) fantôme */}
      <path {...fantome} d="M30 64 Q50 72 70 64" />
      <circle cx={80} cy={56} r={7.5} fill="var(--silhouette)" opacity={0.35} />
      {/* Flèche de mouvement vertical du dos */}
      <path {...fleche} d="M50 68 V42" />
    </>
  ),

  // 9. Pompes scapulaires (en planche)
  pompes_scapulaires: (
    <>
      {sol('M12 92 H88')}
      {/* Bras tendu fixe */}
      <path {...corps} d="M72 92 V56" />
      {/* Corps en planche aligné */}
      <path {...corps} d="M18 90 L44 68 L72 56" />
      {tete(80, 50)}
      {/* Position fantôme : affaissement entre les omoplates */}
      <path {...fantome} d="M18 90 L44 74 L72 66" />
      {/* Flèche double mouvement scapulaire */}
      <path {...fleche} d="M72 46 V64" />
    </>
  ),

  // 10. Balancés de jambes (existant)
  balances_jambes: (
    <>
      <path stroke="var(--texte-3)" strokeWidth={4} strokeLinecap="round" d="M16 30 V94" />
      {tete(48, 14)}
      <path {...corps} d="M48 26 V56 M48 56 L48 92 M48 32 L20 40 M48 56 L74 80" />
      <path {...fantome} d="M48 56 L26 82" />
      <path {...fleche} d="M28 92 Q50 104 76 90" />
    </>
  ),

  // 11. Squat profond tenu (existant)
  squat_tenu: (
    <>
      {tete(54, 36)}
      <path {...corps} d="M52 48 L44 72 L68 70 L58 92 M52 50 L72 60" />
      {sol('M30 96 H82')}
      <circle cx={82} cy={22} r={11} stroke="var(--accent)" strokeWidth={3.5} fill="none" />
      <path stroke="var(--accent)" strokeWidth={3.5} strokeLinecap="round" d="M82 15 V22 L87 25" />
      <path {...fleche} d="M30 30 V52" />
    </>
  ),

  // 12. Fentes avec rotation
  fentes_rotation: (
    <>
      {sol('M10 94 H90')}
      {/* Jambe avant pliée à 90°, jambe arrière genou au ras du sol */}
      <path {...corps} d="M46 54 L68 70 L68 94 M46 54 L28 78 L16 94" />
      {/* Buste vertical */}
      <path {...corps} d="M46 54 V26" />
      {tete(46, 16)}
      {/* Bras ouverts en rotation */}
      <path {...corps} d="M24 32 L46 32 L72 36" />
      {/* Flèche de rotation du buste */}
      <path {...fleche} d="M34 22 C48 16 66 20 72 30" />
    </>
  ),

  // 13. Pont fessier (glute bridge)
  pont_fessier: (
    <>
      {sol('M12 92 H88')}
      {/* Tête et épaules au sol */}
      <circle cx={80} cy={86} r={7.5} fill="var(--silhouette)" />
      {/* Pieds au sol, genoux pliés, hanches montées vers le haut */}
      <path {...corps} d="M24 92 L28 58 L50 56 L72 86" />
      {/* Position fantôme hanches au sol */}
      <path {...fantome} d="M24 92 L28 64 L50 86 L72 86" />
      {/* Flèche de poussée des fessiers vers le haut */}
      <path {...fleche} d="M50 82 V58" />
    </>
  ),

  // 14. Genou au mur (chevilles)
  chevilles: (
    <>
      {/* Mur vertical à droite */}
      <path stroke="var(--texte-3)" strokeWidth={4} strokeLinecap="round" d="M84 18 V94" />
      {sol('M10 94 H86')}
      {/* Jambe arrière */}
      <path {...corps} d="M42 56 L22 80 L14 94" />
      {/* Buste et tête */}
      <path {...corps} d="M42 56 L38 32" />
      {tete(36, 20)}
      {/* Mains en appui contre le mur */}
      <path {...corps} d="M38 34 L82 40" />
      {/* Jambe avant : pied à plat, genou qui avance vers le mur */}
      <path {...corps} d="M42 56 L76 72 L48 94" />
      {/* Flèche d'avancée du genou contre le mur */}
      <path {...fleche} d="M54 72 H78" />
    </>
  ),

  // 15. 90/90 des hanches
  hanches_9090: (
    <>
      {sol('M10 94 H90')}
      {tete(50, 18)}
      {/* Buste assis au sol */}
      <path {...corps} d="M50 28 V68" />
      {/* Bras en appui arrière */}
      <path {...corps} d="M50 36 L24 64 L22 92" />
      {/* Jambe avant 90° et jambe arrière 90° au sol */}
      <path {...corps} d="M50 68 L74 72 L76 92 M50 68 L36 78 L42 94" />
      {/* Flèche de bascule/rotation des hanches */}
      <path {...fleche} d="M32 54 C44 44 62 44 74 56" />
    </>
  ),
}

export const aUnDessin = (id: string) => id in DESSINS

/** Dessin du mouvement ; rien s'il n'y en a pas encore. */
export default function PictoEchauffement({ id, taille = 56 }: { id: string; taille?: number }) {
  const d = DESSINS[id]
  if (!d) return null
  return (
    <span className="picto-echauffement" style={{ width: taille, height: taille }} aria-hidden="true">
      <svg viewBox="0 0 100 100" width={taille} height={taille}>
        <defs>
          <marker id="pointe" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)" />
          </marker>
        </defs>
        {d}
      </svg>
    </span>
  )
}
