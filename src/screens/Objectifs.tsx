import { Flame } from 'lucide-react'
import { changerObjectifs, type Catalogue } from '../catalogue'
import Aide from '../components/Aide'
import Phases from '../components/Phases'
import ChampNombre from '../components/ChampNombre'
import { dateISO } from '../lib/calc'
import { objectifsA } from '../lib/objectifs'

/** Objectifs (onglet Corps, sous le poids) : phases (sèche, maintien, prise) en blocs et calories. */
export default function Objectifs({ catalogue }: { catalogue: Catalogue }) {
  return (
    <div>
      <Phases catalogue={catalogue} />
      <CaloriesVisees catalogue={catalogue} />
    </div>
  )
}

/** Objectif calories du jour : fixé dans les objectifs si souhaité. */
function CaloriesVisees({ catalogue }: { catalogue: Catalogue }) {
  const aujourdhui = dateISO()
  const calories = objectifsA(catalogue.objectifs, aujourdhui)?.calories
  const actif = calories !== undefined && calories > 0

  const toggle = () => {
    if (actif) {
      void changerObjectifs(catalogue, { calories: undefined })
    } else {
      void changerObjectifs(catalogue, { calories: 2200 })
    }
  }

  return (
    <div
      className="carte"
      style={{
        padding: '16px',
        borderRadius: 'var(--rayon)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginTop: 12,
        marginBottom: 24,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 'var(--rayon-2)',
            background: actif ? 'var(--accent-voile)' : 'var(--surface-2)',
            border: '1px solid ' + (actif ? 'var(--accent-bord)' : 'var(--bord)'),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: actif ? 'var(--accent)' : 'var(--texte-2)',
            flexShrink: 0,
            transition: 'all 0.2s ease',
          }}
        >
          <Flame size={20} strokeWidth={2} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 'var(--t-texte)', fontWeight: 700, color: 'var(--texte)' }}>Calories visées</span>
            <Aide
              titre="Calories visées"
              texte="Objectif quotidien indicatif pour cadrer ton apport énergétique selon ta phase (sèche, maintien ou prise). Totalement optionnel : si désactivé, tu peux quand même noter tes ressentis chaque matin."
            />
          </div>
          <div style={{ fontSize: 'var(--t-legende)', color: 'var(--texte-2)', marginTop: 2 }}>
            {actif ? 'Objectif quotidien de référence' : 'Désactivé (optionnel)'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {actif && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ChampNombre
              valeur={calories}
              placeholder="—"
              largeur={75}
              onChange={(v) => void changerObjectifs(catalogue, { calories: v ? Math.round(v) : undefined })}
            />
            <span style={{ fontSize: 'var(--t-petit)', fontWeight: 600, color: 'var(--texte-2)' }}>kcal</span>
          </div>
        )}
        <button
          type="button"
          role="switch"
          aria-checked={actif}
          aria-label="Activer ou désactiver l'objectif calories"
          onClick={toggle}
          style={{
            position: 'relative',
            width: 42,
            height: 24,
            borderRadius: 'var(--rayon-2)',
            background: actif ? 'var(--accent)' : 'var(--bord-haut)',
            border: '1px solid ' + (actif ? 'var(--accent-bord)' : 'var(--voile-fort)'),
            cursor: 'pointer',
            padding: 2,
            display: 'inline-flex',
            alignItems: 'center',
            flexShrink: 0,
            transition: 'background 0.2s ease, border-color 0.2s ease',
          }}
        >
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: 'var(--blanc)',
              transform: actif ? 'translateX(18px)' : 'translateX(0)',
              transition: 'transform 0.2s ease',
              boxShadow: '0 1px 3px var(--ombre-legere)',
            }}
          />
        </button>
      </div>
    </div>
  )
}
