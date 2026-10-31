import { useState } from 'react'

/**
 * Champ numérique facultatif : la valeur n'est prise qu'une fois la saisie finie (champ quitté ou
 * Entrée), vide = pas de valeur. Accepte la virgule.
 */
export default function ChampNombre({ valeur, onChange, placeholder, largeur = 80 }: { valeur?: number; onChange: (v: number | undefined) => void; placeholder?: string; largeur?: number }) {
  const [texte, setTexte] = useState<string | null>(null)
  const valider = () => {
    if (texte === null) return
    const v = parseFloat(texte.replace(',', '.'))
    const n = texte.trim() === '' || isNaN(v) || v <= 0 ? undefined : v
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
      onChange={(e) => setTexte(e.target.value)}
      onBlur={valider}
      onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
    />
  )
}
