import { useState } from 'react'
import { chrono, lireDuree } from '../lib/calc'

interface Props {
  valeur: number
  onChange: (s: number) => void
  /** Pas des boutons −/+, en secondes. */
  pas?: number
  compact?: boolean
}

/** Durée libre : boutons −/+ par 5 s, ou saisie directe (« 2:30 », « 90 », « 3 »). */
export default function ChoixDuree({ valeur, onChange, pas = 5, compact = false }: Props) {
  const [texte, setTexte] = useState<string | null>(null)
  const borne = (s: number) => Math.max(0, Math.min(15 * 60, s))
  return (
    <span className={'mini-stepper' + (compact ? ' compact' : '')}>
      <button type="button" onClick={() => onChange(borne(valeur - pas))} aria-label={`Moins ${pas} secondes`}>
        −
      </button>
      <input
        className="duree"
        inputMode="text"
        value={texte ?? chrono(valeur)}
        onFocus={(e) => (setTexte(chrono(valeur)), e.target.select())}
        onChange={(e) => setTexte(e.target.value)}
        onBlur={() => {
          const s = texte === null ? null : lireDuree(texte)
          if (s !== null) onChange(borne(s))
          setTexte(null)
        }}
      />
      <button type="button" onClick={() => onChange(borne(valeur + pas))} aria-label={`Plus ${pas} secondes`}>
        +
      </button>
    </span>
  )
}
