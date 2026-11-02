import { useEffect, useRef, useState } from 'react'
import { Check, ChevronRight } from 'lucide-react'
import { db } from '../db'
import { dateISO, kg } from '../lib/calc'
import type { Pesee } from '../types'
import Aide from './Aide'
import { informer } from './Dialogues'

/**
 * Pesée d'un jour (aujourd'hui par défaut), avec la moyenne sur 7 jours. `onDate` : la date se
 * change (pesée oubliée d'hier, correction d'une ancienne).
 */
export default function Poids({
  pesees,
  aujourdhui,
  onDate,
}: {
  pesees: Pesee[]
  aujourdhui: string
  onDate?: (d: string) => void
}) {
  const estAujourdhui = aujourdhui === dateISO()
  const duJour = pesees.find((p) => p.date === aujourdhui)
  const dernierPoids = [...pesees].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.poids
  const [valeur, setValeur] = useState(() => (duJour ? String(duJour.poids).replace('.', ',') : dernierPoids ? String(dernierPoids).replace('.', ',') : ''))
  const [touched, setTouched] = useState(false)
  const [enregistreAnim, setEnregistreAnim] = useState(false)
  const dateInputRef = useRef<HTMLInputElement>(null)

  const recentes = pesees.filter((p) => Date.parse(p.date) > Date.now() - 7 * 86400000)
  const moyenne = recentes.length ? recentes.reduce((a, p) => a + p.poids, 0) / recentes.length : null

  // Pré-remplir avec le dernier poids si l'utilisateur n'a pas encore touché le champ
  useEffect(() => {
    if (!touched) {
      if (duJour) {
        setValeur(String(duJour.poids).replace('.', ','))
      } else if (dernierPoids) {
        setValeur(String(dernierPoids).replace('.', ','))
      }
    }
  }, [dernierPoids, duJour, touched])

  const ajuster = (delta: number) => {
    setTouched(true)
    const base = parseFloat((valeur || (dernierPoids ? String(dernierPoids) : '70')).trim().replace(',', '.')) || 70
    const nouveau = Math.round((base + delta) * 10) / 10
    setValeur(nouveau.toFixed(1).replace('.', ','))
  }

  const enregistrer = async () => {
    const raw = valeur || (dernierPoids ? String(dernierPoids) : '')
    const t = raw.trim().replace(',', '.')
    const poids = /^\d{2,3}(\.\d{1,2})?$/.test(t) ? parseFloat(t) : NaN
    if (!(poids > 30 && poids < 250)) {
      return informer('Entre 30 et 250 kg, avec au plus 2 chiffres après la virgule : par exemple 72,3.', 'Poids non reconnu')
    }
    await db.pesees.put({ date: aujourdhui, poids })
    await db.seances.filter((s) => !s.poidsCorps).modify((s) => {
      s.poidsCorps = poids
    })
    setTouched(false)
    setEnregistreAnim(true)
    setTimeout(() => setEnregistreAnim(false), 2000)
  }

  const dateFormatee = estAujourdhui
    ? `Aujourd’hui, ${new Date(aujourdhui + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
    : new Date(aujourdhui + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })

  const valeurAffichee = valeur || (duJour ? kg(duJour.poids) : dernierPoids ? kg(dernierPoids) : '70')
  const estEnregistre = duJour && !touched && duJour.poids === parseFloat(valeurAffichee.replace(',', '.'))

  return (
    <div className="carte" style={{ padding: '16px', borderRadius: 'var(--rayon)' }}>
      {/* En-tête : Titre & Date cliquable à gauche, Moyenne 7j à droite */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <h3 style={{ margin: 0, fontSize: 'var(--t-texte)', fontWeight: 700, color: 'var(--texte)' }}>
              {estAujourdhui ? 'Poids du jour' : 'Pesée'}
            </h3>
            <Aide titre="Poids de corps (PDC)" texte="Le poids fluctue naturellement au jour le jour avec l'eau et les repas. La moyenne sur 7 jours donne la vraie tendance de ton poids de corps (PDC) et sert aussi à calibrer tes exercices au poids du corps et l'estimation de ta force." />
          </div>
          {onDate ? (
            <button
              type="button"
              onClick={() => {
                if (dateInputRef.current) {
                  if ('showPicker' in HTMLInputElement.prototype) {
                    try {
                      dateInputRef.current.showPicker()
                    } catch {
                      dateInputRef.current.focus()
                    }
                  } else {
                    dateInputRef.current.focus()
                  }
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                marginTop: 3,
                background: 'transparent',
                border: 'none',
                padding: 0,
                color: 'var(--texte-2)',
                fontSize: 'var(--t-petit)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span>{dateFormatee}</span>
              <ChevronRight size={13} strokeWidth={2} style={{ opacity: 0.7 }} />
              <input
                ref={dateInputRef}
                type="date"
                value={aujourdhui}
                max={dateISO()}
                style={{
                  position: 'absolute',
                  opacity: 0,
                  pointerEvents: 'none',
                  width: 0,
                  height: 0,
                }}
                onChange={(e) => {
                  if (e.target.value) {
                    onDate(e.target.value)
                    setTouched(false)
                  }
                }}
              />
            </button>
          ) : (
            <div style={{ fontSize: 'var(--t-petit)', color: 'var(--texte-2)', marginTop: 3 }}>
              {dateFormatee}
            </div>
          )}
        </div>

        {moyenne !== null && (
          <div
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              background: 'var(--surface-2)',
              border: '1px solid var(--bord)',
              fontSize: 'var(--t-legende)',
              color: 'var(--texte-2)',
              whiteSpace: 'nowrap',
            }}
          >
            Moy. 7j : <strong style={{ color: 'var(--texte)', fontWeight: 600 }}>{kg(Math.round(moyenne * 10) / 10)} kg</strong>
          </div>
        )}
      </div>

      {/* Contrôle de saisie sur une seule ligne harmonieuse : Stepper unifié + Bouton d'action */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14, width: '100%', boxSizing: 'border-box' }}>
        {/* Stepper unifié */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            background: 'var(--sous-carte)',
            border: '1px solid var(--bord)',
            borderRadius: 'var(--rayon-2)',
            padding: '2px',
            boxSizing: 'border-box',
          }}
        >
          <button
            type="button"
            onClick={() => ajuster(-0.1)}
            aria-label="Diminuer de 0,1 kg"
            style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--surface-2)',
              border: '1px solid var(--voile)',
              borderRadius: 'var(--rayon-2)',
              fontSize: 'var(--t-texte)',
              color: 'var(--texte)',
              cursor: 'pointer',
              userSelect: 'none',
              flexShrink: 0,
            }}
          >
            −
          </button>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '0 2px' }}>
            <input
              type="text"
              inputMode="decimal"
              enterKeyHint="done"
              className="duree"
              style={{
                width: 42,
                maxWidth: 46,
                minWidth: 30,
                textAlign: 'center',
                fontSize: 'var(--t-texte)',
                fontWeight: 800,
                color: 'var(--texte)',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                padding: 0,
                boxSizing: 'border-box',
              }}
              placeholder={dernierPoids ? kg(dernierPoids) : '70'}
              value={valeurAffichee}
              onChange={(e) => {
                setTouched(true)
                setValeur(e.target.value)
              }}
              onFocus={(e) => {
                if (!valeur) setValeur(valeurAffichee)
                e.target.select()
              }}
              onKeyDown={(e) => e.key === 'Enter' && void enregistrer()}
            />
            <span style={{ fontSize: 'var(--t-legende)', fontWeight: 600, color: 'var(--texte-2)', flexShrink: 0 }}>kg</span>
          </div>
          <button
            type="button"
            onClick={() => ajuster(0.1)}
            aria-label="Augmenter de 0,1 kg"
            style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--surface-2)',
              border: '1px solid var(--voile)',
              borderRadius: 'var(--rayon-2)',
              fontSize: 'var(--t-texte)',
              color: 'var(--texte)',
              cursor: 'pointer',
              userSelect: 'none',
              flexShrink: 0,
            }}
          >
            +
          </button>
        </div>

        {/* Bouton d'action orange ou statut enregistré */}
        <button
          type="button"
          onClick={enregistrer}
          style={{
            height: 38,
            padding: '0 10px',
            borderRadius: 'var(--rayon-2)',
            background: estEnregistre && !enregistreAnim
              ? 'var(--ok-voile)'
              : 'var(--accent)',
            border: estEnregistre && !enregistreAnim
              ? '1px solid var(--ok-bord)'
              : 'none',
            color: estEnregistre && !enregistreAnim ? 'var(--ok)' : 'var(--accent-texte)',
            fontWeight: 700,
            fontSize: 'var(--t-legende)',
            letterSpacing: '0.01em',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            boxSizing: 'border-box',
          }}
        >
          <Check size={14} strokeWidth={2.5} />
          <span>{enregistreAnim ? 'Enregistré !' : estEnregistre ? 'Enregistré' : 'Enregistrer'}</span>
        </button>
      </div>
    </div>
  )
}
