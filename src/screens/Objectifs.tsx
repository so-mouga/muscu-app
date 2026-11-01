import { Flame } from 'lucide-react'
import { changerObjectifs, type Catalogue } from '../catalogue'
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

  return (
    <div
      className="carte"
      style={{
        padding: '16px',
        borderRadius: 18,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 12,
        marginBottom: 24,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: 'rgba(249, 115, 22, 0.12)',
            border: '1px solid rgba(249, 115, 22, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-orange)',
            flexShrink: 0,
          }}
        >
          <Flame size={20} strokeWidth={2} />
        </div>
        <div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--texte)' }}>Calories visées</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
            Objectif quotidien de référence
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <ChampNombre
          valeur={calories}
          placeholder="—"
          largeur={85}
          onChange={(v) => void changerObjectifs(catalogue, { calories: v && Math.round(v) })}
        />
        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>kcal</span>
      </div>
    </div>
  )
}
