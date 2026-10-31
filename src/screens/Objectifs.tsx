import { useLiveQuery } from 'dexie-react-hooks'
import { changerObjectifs, type Catalogue } from '../catalogue'
import { confirmer } from '../components/Dialogues'
import VolumeMuscles from '../components/VolumeMuscles'
import Phases from '../components/Phases'
import { db } from '../db'
import ChampNombre from '../components/ChampNombre'
import { AJUSTEMENT, CLE_PROFIL, objectifDuJour, profilComplet, type Profil } from '../lib/nutrition'
import { dateISO, kg, semaineType, volumePrevu } from '../lib/calc'
import { BONUS_PRIORITE, nomCycle, volumeDefaut } from '../lib/cycle'
import { MUSCLES } from '../data/exercices'
import { nomPhase, objectifsA } from '../lib/objectifs'

/** Partie Objectifs de Progression : phases (sèche, maintien, prise) en blocs, volume par muscle, calories. */
export default function Objectifs({ catalogue }: { catalogue: Catalogue }) {
  const volume = volumePrevu(semaineType(catalogue.actif).map((e) => catalogue.modele(e.modeleId)).filter((m) => !!m), catalogue.exercices)
  const reinitialiser = async () => {
    if (await confirmer('Chaque muscle reprend l’objectif conseillé par l’appli.', { titre: 'Revenir aux objectifs conseillés ?', oui: 'Revenir aux objectifs conseillés' }))
      void changerObjectifs(catalogue, { volume: volumeDefaut() })
  }

  return (
    <div>
      <Phases catalogue={catalogue} />

      <div className="carte">
        <h3>Volume par semaine</h3>
        <div className="faible" style={{ margin: '4px 0 10px' }}>
          Séries dures par muscle et par semaine : tes objectifs, les mêmes pour tous tes programmes. En face : ce que prévoit « {catalogue.actif.nom} ». Touche un muscle pour changer son objectif ; chaque changement est daté, pour relire plus tard ce que tu visais.
        </div>
        <VolumeMuscles volume={volume} cibles={catalogue.ciblesPerso} onCible={(m, v) => void changerObjectifs(catalogue, { volume: { ...catalogue.ciblesPerso, [m]: v } })} />
        {catalogue.cycle?.priorites?.length ? (
          <div className="faible" style={{ marginTop: 8 }}>
            🎯 Priorité du cycle « {nomCycle(catalogue.cycle)} » : +{BONUS_PRIORITE} séries par semaine pour {catalogue.cycle.priorites.map((m) => MUSCLES.find((x) => x.id === m)!.nom).join(' et ')}, le temps du cycle (le Bilan en tient compte).
          </div>
        ) : null}
        <button className="btn discret petit lien-action" style={{ marginTop: 8 }} onClick={reinitialiser}>
          Revenir aux objectifs conseillés
        </button>
      </div>

      <CaloriesVisees catalogue={catalogue} />
    </div>
  )
}

/** Objectif calories du jour : calculé d'après le profil, le poids et la phase, ou fixé à la main (daté dans les objectifs). */
function CaloriesVisees({ catalogue }: { catalogue: Catalogue }) {
  const profil = useLiveQuery(() => db.reglages.get(CLE_PROFIL), [], null)
  const pesee = useLiveQuery(() => db.pesees.orderBy('date').last(), [], null)
  if (profil === null || pesee === null) return null
  const p = profil?.valeur as Profil | undefined
  const aujourdhui = dateISO()
  const o = objectifDuJour(catalogue.objectifs, aujourdhui, p, pesee?.poids, catalogue.planning.length)
  const manquant = [!profilComplet(p) && 'ton profil (Réglages → Mon profil)', !pesee && 'une pesée (Progression → Corps)'].filter(Boolean)
  const ajust = o?.phase ? AJUSTEMENT[o.phase] : 0
  return (
    <div className="carte pile" style={{ marginBottom: 24 }}>
      <h3>Calories visées</h3>
      {o ? (
        <>
          <div className="ligne entre" style={{ alignItems: 'baseline' }}>
            <strong className="valeur-kcal">{o.kcal.toLocaleString('fr-FR')} kcal</strong>
            {o.proteines && <span className="faible">dont {o.proteines} g de protéines</span>}
          </div>
          <div className="faible">
            {o.manuel
              ? 'Fixé par toi.'
              : `Maintien estimé ${o.maintien!.toLocaleString('fr-FR')} kcal (poids ${kg(pesee!.poids)} kg, activité, ${catalogue.planning.length} séances par semaine)${o.phase ? `, ${ajust > 0 ? '+' : ajust < 0 ? '−' : '±'}${Math.abs(ajust * 100)} % pour ta ${nomPhase(o.phase).toLowerCase()}` : ''}. Il se met à jour à chaque pesée.`}
          </div>
        </>
      ) : (
        <div className="faible">Pour le calcul, il manque {manquant.join(' et ')}. Ou fixe ton objectif toi-même ci-dessous.</div>
      )}
      <div className="ligne entre">
        <span>Mon objectif à moi</span>
        <span className="ligne" style={{ gap: 6 }}>
          <ChampNombre valeur={objectifsA(catalogue.objectifs, aujourdhui)?.calories} placeholder="auto" onChange={(v) => void changerObjectifs(catalogue, { calories: v && Math.round(v) })} />
          <span className="faible">kcal</span>
        </span>
      </div>
      <div className="faible">Laisse vide pour le calcul automatique. Chaque jour, l’accueil te demande si tu as tenu l’objectif de la veille : c’est noté pour le Bilan.</div>
    </div>
  )
}
