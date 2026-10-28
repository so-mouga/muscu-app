import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { db } from '../db'
import { alarme, tic } from '../lib/appareil'
import { chrono } from '../lib/calc'

export interface EtatMinuteur {
  /** Horodatage de fin : le temps restant ne dépend jamais d'un décompte en mémoire. */
  fin: number
  duree: number
  /** Début du repos (la fin bouge avec −15/+15, pas le début). */
  debut?: number
  /** En pause : temps restant figé, en ms (la fin est recalculée à la reprise). */
  pause?: number
  /** Séance à laquelle appartient ce repos : un autre séance ne le reprend jamais. */
  seanceId?: string
}

/** Secondes restantes d'un repos (en pause : le temps figé). */
export const resteRepos = (e: EtatMinuteur, maintenant: number) => (e.pause ?? e.fin - maintenant) / 1000

export const BIPS_DEFAUT = 5

interface Props {
  etat: EtatMinuteur
  onChange: (e: EtatMinuteur | null) => void
  /** Ce qui vient après le repos, ex. « Butterfly · série 3/4 ». */
  ensuite?: string
  /** Présent quand l'écran affiché n'est pas l'exercice en cours : y revenir en un appui. */
  onAller?: () => void
}

export default function Minuteur({ etat, onChange, ensuite, onAller }: Props) {
  const [maintenant, setMaintenant] = useState(Date.now())
  const sonne = useRef<number | null>(null)
  const dernierTic = useRef<number | null>(null)
  const reglage = useLiveQuery(() => db.reglages.get('bipsRepos'), [])
  const bips = typeof reglage?.valeur === 'number' ? reglage.valeur : BIPS_DEFAUT

  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 250)
    return () => clearInterval(t)
  }, [])

  const enPause = etat.pause !== undefined
  const reste = resteRepos(etat, maintenant)
  const fini = reste <= 0

  useEffect(() => {
    // Sonne une seule fois par repos, y compris au retour au premier plan.
    if (fini && sonne.current !== etat.fin) {
      sonne.current = etat.fin
      if (maintenant - etat.fin < 60000) alarme()
    }
  }, [fini, etat.fin, maintenant])

  // Décompte sonore des dernières secondes, une fois par seconde.
  const seconde = Math.ceil(reste)
  useEffect(() => {
    if (enPause || fini || seconde > bips || dernierTic.current === seconde) return
    dernierTic.current = seconde
    tic(seconde === 1)
  }, [seconde, bips, enPause, fini])

  const decaler = (ms: number) => onChange(enPause ? { ...etat, pause: Math.max(0, etat.pause! + ms) } : { ...etat, fin: etat.fin + ms })
  const basculerPause = () =>
    onChange(enPause ? { ...etat, fin: Date.now() + etat.pause!, pause: undefined } : { ...etat, pause: Math.max(0, etat.fin - Date.now()) })

  return (
    <div className={'minuteur' + (fini ? ' fini flash' : '') + (enPause ? ' en-pause' : '')}>
      <div className="contenu">
        <div className="temps">
          {fini ? chrono(reste) : chrono(seconde)}
          <div className="faible" style={{ color: 'inherit', opacity: 0.7, fontSize: 12, fontWeight: 600 }}>
            {fini ? 'Repos terminé — à toi' : enPause ? 'En pause' : `Repos ${chrono(etat.duree)}`}
          </div>
        </div>
        {!fini && (
          <>
            <button className="btn" onClick={basculerPause} aria-label={enPause ? 'Reprendre le repos' : 'Mettre en pause'}>
              {enPause ? '▶' : '⏸'}
            </button>
            <button className="btn" onClick={() => decaler(-15000)}>
              −15
            </button>
            <button className="btn" onClick={() => decaler(15000)}>
              +15
            </button>
          </>
        )}
        <button className="btn texte" onClick={() => onChange(null)}>
          {fini ? 'OK' : 'Passer'}
        </button>
      </div>
      {ensuite && (
        <button className={'ensuite' + (onAller ? ' cliquable' : '') + (fini && onAller ? ' reprendre' : '')} onClick={onAller} disabled={!onAller}>
          <span>
            <span className="label">{fini ? 'À toi' : 'Ensuite'}</span> {ensuite}
          </span>
          {onAller && <span className="aller">{fini ? 'Reprendre ›' : 'Y aller ›'}</span>}
        </button>
      )}
    </div>
  )
}
