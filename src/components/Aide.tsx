import { useState } from 'react'
import { HelpCircle, X } from 'lucide-react'

/**
 * Bouton d'aide sans jargon : icône help-circle discrète qui ouvre une bulle d'explication au clic.
 */
export function Aide({ texte, titre }: { texte: string; titre?: string }) {
  const [ouvert, setOuvert] = useState(false)

  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        aria-label={titre ? `Aide sur ${titre}` : 'Explication'}
        onClick={(e) => {
          e.stopPropagation()
          setOuvert(!ouvert)
        }}
        style={{
          background: 'none',
          border: 'none',
          padding: 2,
          margin: '0 2px',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.8,
          transition: 'color 0.15s ease, opacity 0.15s ease',
          verticalAlign: 'middle',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--texte)'
          e.currentTarget.style.opacity = '1'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text-secondary)'
          e.currentTarget.style.opacity = '0.8'
        }}
      >
        <HelpCircle size={14} strokeWidth={2} />
      </button>

      {ouvert && (
        <>
          {/* Backdrop transparent pour fermer au clic en dehors */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 998 }}
            onClick={(e) => {
              e.stopPropagation()
              setOuvert(false)
            }}
          />

          {/* Bulle / Popover Dark Glassmorphism */}
          <div
            className="popover-aide"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginTop: 6,
              width: 250,
              maxWidth: '80vw',
              padding: '12px 14px',
              borderRadius: 14,
              background: 'var(--bulle-fond-97)',
              border: '1px solid var(--border-top-highlight)',
              boxShadow: '0 8px 30px var(--ombre-forte), inset 0 1px 0 var(--bord)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              color: 'var(--texte)',
              fontSize: '0.8rem',
              lineHeight: 1.45,
              zIndex: 999,
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              {titre ? (
                <strong style={{ fontSize: '0.82rem', color: 'var(--accent-orange)' }}>{titre}</strong>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => setOuvert(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 2,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                }}
                aria-label="Fermer"
              >
                <X size={14} />
              </button>
            </div>
            <div style={{ color: 'var(--aide-texte)' }}>{texte}</div>
          </div>
        </>
      )}
    </span>
  )
}

export default Aide
