import { dateCourte, kg } from '../lib/calc'
import { ecartCourt, type EtatPoids, type Phase } from '../lib/objectifs'

const jour = (iso: string) => dateCourte(iso).replace(/^\S+ /, '')
const veille = (iso: string) => new Date(Date.parse(iso + 'T12:00:00') - 86400000).toISOString().slice(0, 10)

/**
 * Où en est ton poids, en une phrase penchée avec tes chiffres (« +0,4 kg. Encore 2,1 pour tes 72,6. ») et une jauge
 * dans la couleur de l'objectif. Des faits, jamais de bravo ni de reproche : un poids parti dans l'autre sens dit
 * seulement ce que tu vises. Carte du haut de Corps et page « Ton objectif ».
 */
export default function OuEnEst({ etat, debut, finPrevue, phase }: { etat: EtatPoids; debut: string; finPrevue?: string; /** La barre prend la couleur de l'objectif (vert, bleu, gris), comme le point et la pastille. */ phase: Phase }) {
  return (
    <>
      <div className="ou-en-est">
        <span className="voix grand">{etat.vise !== undefined ? `${ecartCourt(etat.ecart)} kg.` : `${kg(etat.actuel)} kg.`}</span>
        <span className="faible petit-texte">
          {etat.vise === undefined
            ? `${ecartCourt(etat.ecart)} depuis le ${jour(debut)}.`
            : etat.atteint
              ? `Tu es à tes ${kg(etat.vise)}.`
              : etat.aRebours
                ? `Tu vises ${ecartCourt(etat.vise - etat.depart)}.`
                : `Encore ${kg(etat.reste!)} pour tes ${kg(etat.vise)}.`}
        </span>
      </div>
      {etat.vise !== undefined && (
        <>
          <div className={`cap-piste piste-phase phase-${phase}`}>
            <i style={{ width: `${Math.round((etat.part ?? 0) * 100)}%` }} />
          </div>
          <div className="cap-bouts">
            <span>
              {kg(etat.depart)} kg · {jour(debut)}
            </span>
            <span>
              {kg(etat.vise)} kg{finPrevue ? ` · ${jour(veille(finPrevue))}` : ''}
            </span>
          </div>
        </>
      )}
    </>
  )
}
