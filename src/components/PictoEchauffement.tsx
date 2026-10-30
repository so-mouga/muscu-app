import type { ReactNode } from 'react'

// Pictogrammes maison (viewBox 100 × 100) : silhouette en traits épais, mouvement en orange.
const corps = { stroke: 'var(--silhouette)', strokeWidth: 8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }
const fleche = { stroke: 'var(--accent)', strokeWidth: 3.5, strokeLinecap: 'round' as const, fill: 'none', markerEnd: 'url(#pointe)' }
const fantome = { ...corps, opacity: 0.35 }
const tete = (x: number, y: number) => <circle cx={x} cy={y} r={7.5} fill="var(--silhouette)" />

const DESSINS: Record<string, ReactNode> = {
  moulinets: (
    <>
      {tete(50, 15)}
      <path {...corps} d="M50 27 V56 M50 56 L42 90 M50 56 L58 90 M22 33 H78" />
      <path {...fleche} d="M14 24 A11 11 0 1 1 13 42" />
      <path {...fleche} d="M86 42 A11 11 0 1 1 87 24" />
    </>
  ),
  passages: (
    <>
      {tete(46, 22)}
      <path {...corps} d="M46 34 V62 M46 62 L44 92 M46 62 L50 92 M46 38 L68 16" />
      <circle cx={70} cy={14} r={4} fill="var(--texte-2)" />
      <path {...fantome} d="M46 38 L70 54" />
      <path {...fleche} d="M80 52 C88 18 58 -2 30 12 C20 18 16 30 18 44" />
    </>
  ),
  balances_jambes: (
    <>
      <path stroke="var(--texte-3)" strokeWidth={4} strokeLinecap="round" d="M16 30 V94" />
      {tete(48, 14)}
      <path {...corps} d="M48 26 V56 M48 56 L48 92 M48 32 L20 40 M48 56 L74 80" />
      <path {...fantome} d="M48 56 L26 82" />
      <path {...fleche} d="M28 92 Q50 104 76 90" />
    </>
  ),
  squat_tenu: (
    <>
      {tete(54, 36)}
      <path {...corps} d="M52 48 L44 72 L68 70 L58 92 M52 50 L72 60" />
      <path stroke="var(--texte-3)" strokeWidth={3} strokeLinecap="round" d="M30 96 H82" />
      <circle cx={82} cy={22} r={11} stroke="var(--accent)" strokeWidth={3.5} fill="none" />
      <path stroke="var(--accent)" strokeWidth={3.5} strokeLinecap="round" d="M82 15 V22 L87 25" />
      <path {...fleche} d="M30 30 V52" />
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
