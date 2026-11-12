import { useLiveQuery } from 'dexie-react-hooks'
import { Maximize2, Pause, Play } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { db } from '../db'
import { alarme, tic } from '../lib/appareil'
import { chrono } from '../lib/calc'
import { natif } from '../lib/natif'
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

/** Repos terminé depuis plus de 15 min : il ne veut plus rien dire. */
export const reposOublie = (e: EtatMinuteur, maintenant: number) => e.pause === undefined && maintenant - e.fin > 15 * 60000

export const BIPS_DEFAUT = 5

interface Props {
  etat: EtatMinuteur
  onChange: (e: EtatMinuteur | null) => void
  /** `barre` : en bas de l'écran (vue liste) ; `bandeau` : en haut du plein écran, repos fini ; `geant` : le repos du plein écran, en chiffres géants. */
  variante?: 'barre' | 'bandeau' | 'geant'
  /** `geant` : ce qui s'affiche entre le chrono et « Passer » (l'effort de la série qu'on vient de faire). */
  children?: ReactNode
  /** `geant`, avant un finisseur : en violet, et le repos fini attend un appui (« Prêt », « J'y vais ») au lieu de laisser la place à la saisie. */
  finisseur?: boolean
  /** Barre : appui sur le temps → mode plein écran. */
  onAgrandir?: () => void
}

export default function Minuteur({ etat, onChange, variante = 'barre', onAgrandir, children, finisseur }: Props) {
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
      // Appli Android en arrière-plan : c'est l'alarme d'Android qui a sonné, pas de bips en retard.
      if (maintenant - etat.fin < 60000 && !(natif && document.hidden)) alarme()
    }
  }, [fini, etat.fin, maintenant])

  // Décompte sonore des dernières secondes, une fois par seconde.
  const seconde = Math.ceil(reste)
  useEffect(() => {
    if (enPause || fini || seconde > bips || dernierTic.current === seconde || (natif && document.hidden)) return
    dernierTic.current = seconde
    tic(seconde === 1)
  }, [seconde, bips, enPause, fini])

  const [saut, setSaut] = useState(false)
  useEffect(() => {
    if (!saut) return
    const t = setTimeout(() => setSaut(false), 250)
    return () => clearTimeout(t)
  }, [saut, etat.fin, etat.pause])
  const decaler = (ms: number) => (setSaut(true), onChange(enPause ? { ...etat, pause: Math.max(0, etat.pause! + ms) } : { ...etat, fin: etat.fin + ms }))
  const basculerPause = () =>
    onChange(enPause ? { ...etat, fin: Date.now() + etat.pause!, pause: undefined } : { ...etat, pause: Math.max(0, etat.fin - Date.now()) })

  const libelle = fini ? 'Repos terminé — à toi' : enPause ? 'En pause' : `Repos ${chrono(etat.duree)}`
  const temps = fini ? chrono(reste) : chrono(seconde)
  const boutons = (
    <>
      {!fini && (
        <>
          <button className="btn" onClick={basculerPause} aria-label={enPause ? 'Reprendre le repos' : 'Mettre en pause'}>
            {enPause ? <Play size={18} fill="currentColor" /> : <Pause size={18} fill="currentColor" />}
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

  // Part du repos restante (le cercle se vide) ; la fin bouge avec −15/+15, le début non.
  const total = etat.debut ? (etat.pause !== undefined ? maintenant - etat.debut + etat.pause : etat.fin - etat.debut) / 1000 : etat.duree
  const part = fini ? 0 : reste / Math.max(1, total)
  const decompteActif = !fini && !enPause && seconde > 0 && seconde <= (bips > 0 ? bips : 5)

  // Plein écran : le temps en chiffres géants, sa barre dessous, +15 et −15 à côté (maquette `seance-parcours.html`, choix de
  // l'utilisateur : pas de rangée de boutons du chrono au-dessus de ceux de l'effort). « Pause » est écrit, et un appui sur le
  // temps fait pareil. Avant un finisseur, le repos fini ne part pas tout seul : « Prêt », puis « J'y vais ».
  if (variante === 'geant') {
    return (
      <div className={'repos-geant' + (fini ? ' fini' : '') + (enPause ? ' en-pause' : '') + (decompteActif ? ' decompte' : '') + (finisseur ? ' ton-fin' : '')}>
        <div className="zone-chrono">
          <div className="chrono-tete">
            <span>{fini ? 'repos fini' : enPause ? 'en pause' : `repos · prévu ${chrono(etat.duree)}`}</span>
            {!fini && (
              <button type="button" className="lien-pause" onClick={basculerPause}>
                {enPause ? <Play size={12} fill="currentColor" /> : <Pause size={12} fill="currentColor" />} {enPause ? 'Reprendre' : 'Pause'}
              </button>
            )}
          </div>
          <div className="rangee-chrono">
            <button type="button" className="chrono-geant" onClick={() => !fini && basculerPause()} aria-label={fini ? 'Repos terminé' : enPause ? `Repos en pause, ${temps}. Reprendre` : `Repos, ${temps}. Mettre en pause`}>
              {fini ? 'Prêt' : temps}
            </button>
            {!fini && (
              <div className="chrono-cote">
                <button type="button" className="btn" onClick={() => decaler(15000)}>
                  +15
                </button>
                <button type="button" className="btn" onClick={() => decaler(-15000)}>
                  −15
                </button>
              </div>
            )}
          </div>
          <div className="jauge-repos">
            <i className={saut ? 'saut' : undefined} style={{ width: `${Math.min(100, Math.max(0, part * 100))}%` }} />
          </div>
        </div>
        {children}
        <button type="button" className={'btn chrono-passer' + (fini && finisseur ? ' finisseur' : '')} onClick={() => onChange(null)}>
          {fini ? (finisseur ? 'J’y vais' : 'OK') : 'Passer'}
        </button>
      </div>
    )
  }

  const bandeau = variante === 'bandeau'
  return (
    <div className={'minuteur' + (bandeau ? ' bandeau' : '') + (fini ? ' fini flash' : '') + (enPause ? ' en-pause' : '') + (decompteActif ? ' decompte' : '')}>
      <div className="contenu">
        <button className="temps" onClick={onAgrandir} disabled={!onAgrandir} aria-label={onAgrandir ? `${libelle}, ${temps}. Plein écran` : undefined}>
          <Anneau valeur={part} taille={52} epaisseur={4} couleur={fini ? 'var(--minuteur-fini)' : enPause ? 'var(--accent-attenu)' : decompteActif ? 'var(--alerte)' : 'var(--accent)'} fluide={!enPause && !fini} saut={saut}>
            <span className="temps-petit">{temps}</span>
          </Anneau>
          {onAgrandir && <span className="indice-plein-ecran"><Maximize2 size={12} className="ico-texte" /> Plein écran</span>}
        </button>
        <span className="espace" />
        {boutons}
      </div>
    </div>
  )
}
