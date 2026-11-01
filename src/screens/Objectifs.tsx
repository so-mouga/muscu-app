import { changerObjectifs, type Catalogue } from '../catalogue'
import Phases from '../components/Phases'
import ChampNombre from '../components/ChampNombre'
import { dateISO } from '../lib/calc'
import { objectifsA } from '../lib/objectifs'

/** Objectifs (onglet Corps, sous le poids) : phases (sèche, maintien, prise) en blocs et calories. Le volume par muscle se lit dans le programme. */
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
    <div className="carte pile" style={{ marginBottom: 24 }}>
      <h3>Calories visées</h3>
      {calories ? (
        <div className="ligne entre" style={{ alignItems: 'baseline' }}>
          <strong className="valeur-kcal">{calories.toLocaleString('fr-FR')} kcal</strong>
          <span className="faible">Objectif par jour</span>
        </div>
      ) : (
        <div className="faible">Optionnel si tu suis tes calories. Laisse vide si tu ne comptes pas tes calories.</div>
      )}
      <div className="ligne entre">
        <span>Objectif</span>
        <span className="ligne" style={{ gap: 6 }}>
          <ChampNombre
            valeur={calories}
            placeholder="—"
            onChange={(v) => void changerObjectifs(catalogue, { calories: v && Math.round(v) })}
          />
          <span className="faible">kcal</span>
        </span>
      </div>
      <div className="faible">Chaque matin, l’accueil te propose de noter si tu as tenu ton objectif de la veille.</div>
    </div>
  )
}
