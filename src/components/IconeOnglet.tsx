/** Icônes de la barre d'onglets : trait simple, couleur du texte (orange quand l'onglet est actif). */
const TRACES: Record<string, string> = {
  accueil: 'M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z',
  historique: 'M3.5 17.5 9 12l4 4 7.5-8M15 8h5.5v5.5',
  seances: 'M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v13.5A1.5 1.5 0 0 1 19 21H5a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 5 4.5zM3.5 9.5h17M8 2.5v4M16 2.5v4M7.5 13.5h4M7.5 17h7',
  exercices: 'M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11',
  reglages: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M9 14.5v5',
}

export default function IconeOnglet({ nom }: { nom: string }) {
  return (
    <svg className="ico" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={TRACES[nom]} />
    </svg>
  )
}
