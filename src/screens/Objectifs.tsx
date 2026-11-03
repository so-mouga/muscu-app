import { changerObjectifs, type Catalogue } from '../catalogue'
import ChampNombre from '../components/ChampNombre'
import Phases from '../components/Phases'
import { dateISO } from '../lib/calc'
import { objectifsA } from '../lib/objectifs'

/** Page Phases (depuis Corps) : les phases en blocs et les calories visées pendant la phase en cours. */
export default function Objectifs({ catalogue }: { catalogue: Catalogue }) {
  const calories = objectifsA(catalogue.objectifs, dateISO())?.calories
  return (
    <div>
      <Phases catalogue={catalogue} />
      <div className="carte ligne entre calories-visees">
        <span>
          <strong>Calories par jour</strong>
          <span className="faible petit-texte">Facultatif. Sans objectif, l’accueil ne te demande rien.</span>
        </span>
        <span className="calories-champ">
          <ChampNombre valeur={calories} placeholder="—" largeur={75} onChange={(v) => void changerObjectifs(catalogue, { calories: v ? Math.round(v) : undefined })} />
          <span className="faible">kcal</span>
        </span>
      </div>
    </div>
  )
}
