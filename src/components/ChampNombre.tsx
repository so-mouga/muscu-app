import { useState } from 'react'

/**
 * Champ numérique facultatif : la valeur n'est prise qu'une fois la saisie finie (champ quitté ou
 * Entrée), vide = pas de valeur. Accepte la virgule.
 */
export default function ChampNombre({
  valeur,
  onChange,
  placeholder,
  largeur = 80,
  signe = false,
  onSaisie,
}: {
  valeur?: number
  onChange: (v: number | undefined) => void
  placeholder?: string
  largeur?: number
  /** Accepte les nombres négatifs (ex: −4 kg en sèche). */
  signe?: boolean
  /** Suit la frappe (pour un conseil en direct) ; la valeur reste enregistrée à la fin de la saisie. */
  onSaisie?: (v: number | undefined) => void
}) {
  const [texte, setTexte] = useState<string | null>(null)
  const lire = (t: string) => {
    const v = parseFloat(t.replace('−', '-').replace(',', '.'))
    return t.trim() === '' || isNaN(v) || (!signe && v <= 0) || v === 0 ? undefined : v
  }
  const valider = () => {
    if (texte === null) return
    const n = lire(texte)
    if (n !== valeur) onChange(n)
    setTexte(null)
  }
  return (
    <input
      inputMode="decimal"
      enterKeyHint="done"
      placeholder={placeholder}
      style={{ width: largeur, textAlign: 'center', flex: '0 0 auto' }}
      value={texte ?? (valeur !== undefined ? String(valeur).replace('.', ',') : '')}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        setTexte(e.target.value)
        onSaisie?.(lire(e.target.value))
      }}
      onBlur={valider}
      onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
    />
  )
}
