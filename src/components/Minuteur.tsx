import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { db } from '../db'
import { alarme, tic } from '../lib/appareil'
import { chrono } from '../lib/calc'
import Anneau from './Anneau'

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
  /** Ce qui vient après le repos, ex. « Butterfly · série 3/4 » (affiché quand on regarde un autre exercice). */
  ensuite?: string
  /** Présent quand l'écran affiché n'est pas l'exercice en cours : y revenir en un appui. */
  onAller?: () => void
  /** `barre` : en bas de l'écran ; `grand` : cercle du mode plein écran ; `bandeau` : en haut du mode plein écran. */
  variante?: 'barre' | 'grand' | 'bandeau'
  /** Barre : appui sur le temps → mode plein écran. */
  onAgrandir?: () => void
}

export default function Minuteur({ etat, onChange, ensuite, onAller, variante = 'barre', onAgrandir }: Props) {
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

  const libelle = fini ? 'Repos terminé — à toi' : enPause ? 'En pause' : `Repos ${chrono(etat.duree)}`
  const temps = fini ? chrono(reste) : chrono(seconde)
  const boutons = (
    <>
      {!fini && (
        <>
          {/* En plein écran, la pause est sur le cercle lui-même. */}
          {variante !== 'grand' && (
            <button className="btn" onClick={basculerPause} aria-label={enPause ? 'Reprendre le repos' : 'Mettre en pause'}>
              {enPause ? '▶' : '⏸'}
            </button>
          )}
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
    </>
  )

  // Part du repos restante (le cercle se vide) ; la fin bouge avec −15/+15, le début non.
  const total = etat.debut ? (etat.pause !== undefined ? maintenant - etat.debut + etat.pause : etat.fin - etat.debut) / 1000 : etat.duree
  const part = fini ? 0 : reste / Math.max(1, total)

  if (variante === 'grand') {
    return (
      <div className={'minuteur grand' + (fini ? ' fini' : '') + (enPause ? ' en-pause' : '')}>
        <button type="button" className="cercle-pause" onClick={() => !fini && basculerPause()} aria-label={enPause ? 'Reprendre le repos' : 'Mettre le repos en pause'}>
          <Anneau valeur={part} taille={210} epaisseur={10}>
            <div className="temps-grand">{temps}</div>
            <div className="libelle">{fini ? libelle : enPause ? '▶ Reprendre' : libelle}</div>
            {!fini && <div className="astuce-pause">{enPause ? 'touche le cercle' : '⏸ touche = pause'}</div>}
          </Anneau>
        </button>
        <div className="ligne boutons-grand">{boutons}</div>
      </div>
    )
  }

  const bandeau = variante === 'bandeau'
  return (
    <div className={'minuteur' + (bandeau ? ' bandeau' : '') + (fini ? ' fini flash' : '') + (enPause ? ' en-pause' : '')}>
      <div className="contenu">
        <button className="temps" onClick={onAgrandir} disabled={!onAgrandir} aria-label={onAgrandir ? `${libelle}, ${temps}. Plein écran` : undefined}>
          <Anneau valeur={part} taille={52} epaisseur={4} couleur={fini ? '#04140c' : 'var(--accent)'}>
            <span className="temps-petit">{temps}</span>
          </Anneau>
        </button>
        <span className="espace" />
        {boutons}
      </div>
      {ensuite && !bandeau && onAller && (
        <button className={'ensuite cliquable' + (fini ? ' reprendre' : '')} onClick={onAller}>
          <span>
            <span className="label">{fini ? 'À toi' : 'Ensuite'}</span> {ensuite}
          </span>
          <span className="aller">{fini ? 'Reprendre ›' : 'Y aller ›'}</span>
        </button>
      )}
    </div>
  )
}
