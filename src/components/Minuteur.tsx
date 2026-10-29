import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { db } from '../db'
import { alarme, tic } from '../lib/appareil'
import { chrono } from '../lib/calc'
import { useRetour } from '../lib/nav'
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
  /** Ce qui vient après le repos, ex. « Butterfly · série 3/4 ». */
  ensuite?: string
  /** Présent quand l'écran affiché n'est pas l'exercice en cours : y revenir en un appui. */
  onAller?: () => void
  /** Vue plein écran : temps en grand et infos utiles pendant le repos. */
  grand: boolean
  onGrand: (v: boolean) => void
  /** Contenu de la vue plein écran (prochaine série, avancement de la séance). */
  detail?: ReactNode
  /** Vue plein écran, repos fini : aller saisir la série. */
  onSaisir?: () => void
}

export default function Minuteur({ etat, onChange, ensuite, onAller, grand, onGrand, detail, onSaisir }: Props) {
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

  useRetour(grand, () => onGrand(false))

  const decaler = (ms: number) => onChange(enPause ? { ...etat, pause: Math.max(0, etat.pause! + ms) } : { ...etat, fin: etat.fin + ms })
  const basculerPause = () =>
    onChange(enPause ? { ...etat, fin: Date.now() + etat.pause!, pause: undefined } : { ...etat, pause: Math.max(0, etat.fin - Date.now()) })

  const libelle = fini ? 'Repos terminé — à toi' : enPause ? 'En pause' : `Repos ${chrono(etat.duree)}`
  const temps = fini ? chrono(reste) : chrono(seconde)
  const boutons = (
    <>
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
    </>
  )

  if (grand) {
    // Part du repos écoulée ; la fin bouge avec −15/+15, le début non.
    const total = etat.debut ? (etat.pause !== undefined ? maintenant - etat.debut + etat.pause : etat.fin - etat.debut) / 1000 : etat.duree
    return (
      <div className={'minuteur grand' + (fini ? ' fini flash' : '') + (enPause ? ' en-pause' : '')} role="dialog" aria-label="Repos">
        <div className="contenu-grand">
          <button className="btn texte reduire" onClick={() => onGrand(false)}>
            ⌄ Réduire
          </button>
          <Anneau valeur={fini ? 1 : 1 - reste / Math.max(1, total)} taille={230} epaisseur={10} couleur={fini ? '#04140c' : 'var(--accent)'}>
            <div className="temps-grand">{temps}</div>
            <div className="libelle">{libelle}</div>
          </Anneau>
          <div className="ligne boutons-grand">{boutons}</div>
          {fini && onSaisir && (
            <button className="btn primaire grand-btn" onClick={onSaisir}>
              Saisir ma série ›
            </button>
          )}
          {detail}
        </div>
      </div>
    )
  }

  return (
    <div className={'minuteur' + (fini ? ' fini flash' : '') + (enPause ? ' en-pause' : '')}>
      <div className="contenu">
        <button className="temps" onClick={() => onGrand(true)} aria-label="Agrandir le minuteur">
          {temps} <span className="agrandir">⤢</span>
          <div className="faible" style={{ color: 'inherit', opacity: 0.7, fontSize: 12, fontWeight: 600 }}>
            {libelle}
          </div>
        </button>
        {boutons}
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
