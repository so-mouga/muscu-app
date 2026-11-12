import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { Catalogue } from '../catalogue'
import { db, setReglage } from '../db'
import { CAPS_MAX, CLE_CAPS, capMin, capPropose, capsEnCours, dureeCap, etatCap, lireCaps, niveau, regleCap, regleEnClair, texteCap, texteReste, type Cap, type RegleCap } from '../lib/caps'
import { dateCourte, dateISO } from '../lib/calc'
import { useRetour } from '../lib/nav'
import type { Exercice, ExoPlan, Seance } from '../types'

/** Les caps enregistrés ; `undefined` pendant la lecture. */
export const useCaps = () => useLiveQuery(() => db.reglages.get(CLE_CAPS).then((r) => lireCaps(r?.valeur)), [])

/** Un cap par exercice : le nouveau remplace l'ancien. */
const fixerCap = async (cap: Cap) => setReglage(CLE_CAPS, [...lireCaps((await db.reglages.get(CLE_CAPS))?.valeur).filter((c) => c.exoId !== cap.exoId), cap])
const retirerCap = async (exoId: string) => setReglage(CLE_CAPS, lireCaps((await db.reglages.get(CLE_CAPS))?.valeur).filter((c) => c.exoId !== exoId))

/** Le réglage de l'exercice dans le programme en service, sinon dans une autre séance. */
export function planDe(catalogue: Catalogue, exoId: string): ExoPlan | undefined {
  for (const m of [...catalogue.planning.map((e) => e.modele), ...catalogue.modeles]) {
    const p = m.exercices.find((e) => e.exoId === exoId)
    if (p) return p
  }
}

/** La barre d'un cap : une seule couleur sur du gris. */
export function PisteCap({ part }: { part: number }) {
  return (
    <div className="cap-piste">
      <i style={{ width: `${Math.round(part * 100)}%` }} />
    </div>
  )
}

/**
 * Fenêtre « Ton cap » : un seul nombre. Les séries et les reps viennent du programme, il n'y a pas de date.
 * Un appui à côté garde le changement d'un cap déjà fixé ; il ne crée jamais un cap qu'on n'a pas demandé.
 */
function FenetreCap({ exo, regle, actuel, cap, onFermer }: { exo: Exercice; regle: RegleCap; actuel: number; cap?: Cap; onFermer: () => void }) {
  const min = capMin(exo, regle, actuel)
  const [cible, setCible] = useState(cap && cap.cible >= min ? cap.cible : (capPropose(exo, regle, actuel) ?? min))
  const pas = regle.genre === 'charge' ? exo.pas : 1
  const max = regle.genre === 'charge' && exo.chargeMax ? exo.chargeMax : Infinity
  const changer = (sens: number) => setCible((c) => Math.min(max, Math.max(min, Math.round((c + sens * pas) * 100) / 100)))
  const fixer = () => {
    void fixerCap(cap ? { ...cap, cible } : { ...regle, exoId: exo.id, cible, depart: actuel, depuis: dateISO() })
    onFermer()
  }
  const aCote = () => (cap && cible !== cap.cible ? fixer() : onFermer())
  useRetour(true, aCote)
  return createPortal(
    <div className="modal-fond" onClick={aCote}>
      <div className="modal pile" onClick={(e) => e.stopPropagation()}>
        <div>
          <h2>Ton cap</h2>
          <div className="faible">
            {exo.nom} · aujourd’hui {texteCap(exo, regle, actuel)}
          </div>
        </div>
        <div className="cap-reglage">
          <button type="button" className="btn" onClick={() => changer(-1)} disabled={cible <= min} aria-label="Moins">
            <Minus size={22} />
          </button>
          <strong aria-live="polite">{texteCap(exo, regle, cible)}</strong>
          <button type="button" className="btn" onClick={() => changer(1)} disabled={cible >= max} aria-label="Plus">
            <Plus size={22} />
          </button>
        </div>
        <div className="voix">{texteReste(regle, Math.round((cible - actuel) * 100) / 100)}</div>
        <div className="faible">
          {regleEnClair(exo, regle, cible)} Pas de date : tu y vas à ton rythme, et les conseils de l’appli ne changent pas.
        </div>
        <button type="button" className="btn primaire plein" onClick={fixer}>
          Fixer ce cap
        </button>
        {cap && (
          <button
            type="button"
            className="btn discret plein"
            onClick={() => {
              void retirerCap(exo.id)
              onFermer()
            }}
          >
            Retirer ce cap
          </button>
        )}
      </div>
    </div>,
    document.body
  )
}

/** Sur la fiche d'un exercice : son cap, ou de quoi en fixer un. Rien tant que l'exercice n'a pas été fait. */
export function CapExo({ exo, seances, catalogue }: { exo: Exercice; seances: Seance[]; catalogue: Catalogue }) {
  const caps = useCaps()
  const [fenetre, setFenetre] = useState(false)
  if (!caps) return null
  const cap = caps.find((c) => c.exoId === exo.id)
  const derniere = seances.find((s) => !s.deload && !s.enCours && s.series.some((x) => x.exoId === exo.id))?.series.filter((x) => x.exoId === exo.id)
  const regle: RegleCap | null = cap ?? regleCap(exo, planDe(catalogue, exo.id), derniere)
  if (!regle) return null
  const actuel = niveau(regle, exo.id, seances)
  const etat = cap && etatCap(cap, seances)
  const base = etat?.niveau ?? actuel
  const fenetreCap = fenetre && base !== null && <FenetreCap exo={exo} regle={regle} actuel={base} cap={etat?.franchi ? undefined : cap} onFermer={() => setFenetre(false)} />

  if (cap && etat?.franchi)
    return (
      <div className="carte cap-carte">
        <div className="cap-tete">
          <strong>Cap franchi</strong>
          <span className="cap-but">{texteCap(exo, cap, cap.cible)}</span>
        </div>
        <div className="faible">
          Le {dateCourte(etat.franchi.date).replace(/^\S+\s/, '')}, {dureeCap(cap.depuis, etat.franchi.date)}. Tu partais de {texteCap(exo, cap, cap.depart)}.
        </div>
        {(!exo.chargeMax || cap.genre === 'reps' || etat.niveau < exo.chargeMax) && (
          <button type="button" className="btn plein" onClick={() => setFenetre(true)}>
            Fixer le cap suivant
          </button>
        )}
        {fenetreCap}
      </div>
    )

  if (cap && etat)
    return (
      <>
        <button type="button" className="carte cap-carte" onClick={() => setFenetre(true)} aria-label="Modifier ton cap">
          <div className="cap-tete">
            <strong>Ton cap</strong>
            <span className="cap-but">{texteCap(exo, cap, cap.cible)}</span>
          </div>
          <PisteCap part={etat.part} />
          <div className="cap-bouts">
            <span>
              {texteCap(exo, cap, cap.depart)} · {dateCourte(cap.depuis).replace(/^\S+\s/, '')}
            </span>
            <span>{texteCap(exo, cap, cap.cible)}</span>
          </div>
          <div>
            Tu es à <strong>{texteCap(exo, cap, etat.niveau)}</strong>. <span className="faible">{texteReste(cap, etat.reste)}</span>
          </div>
        </button>
        {fenetreCap}
      </>
    )

  // Pas encore de cap : il faut un repère (toutes les séries faites au moins une fois), et de la place.
  if (actuel === null || capPropose(exo, regle, actuel) === null) return null
  const plein = capsEnCours(caps, seances).length >= CAPS_MAX
  return (
    <>
      <button type="button" className="liste-btn cap-fixer" onClick={() => setFenetre(true)} disabled={plein}>
        <span>
          Fixer un cap
          <span className="faible prog-sous">{plein ? `Tu as déjà ${CAPS_MAX} caps en cours : franchis-en un, ou retires-en un.` : 'Une charge à atteindre, à ton rythme'}</span>
        </span>
        {!plein && <ChevronRight size={20} className="muted" />}
      </button>
      {fenetreCap}
    </>
  )
}

/** En tête de Progrès → Exercices : les caps en cours, chacun avec sa barre. Un appui ouvre la fiche. */
export function TesCaps({ catalogue, seances, onOuvrir }: { catalogue: Catalogue; seances: Seance[]; onOuvrir: (exoId: string) => void }) {
  const caps = useCaps()
  const enCours = caps ? capsEnCours(caps, seances).filter((c) => !catalogue.exo(c.exoId).supprime) : []
  if (!enCours.length) return null
  return (
    <div className="carte cap-liste">
      <h3>Tes caps</h3>
      {enCours.map((c) => {
        const exo = catalogue.exo(c.exoId)
        const etat = etatCap(c, seances)
        return (
          <button type="button" key={c.exoId} onClick={() => onOuvrir(c.exoId)}>
            <div className="cap-tete">
              <span>{exo.nom}</span>
              <span className="cap-but">{texteCap(exo, c, c.cible)}</span>
            </div>
            <PisteCap part={etat.part} />
            <div className="faible cap-legende">
              {texteCap(exo, c, etat.niveau)} · {texteReste(c, etat.reste).toLowerCase().replace('.', '')}
            </div>
          </button>
        )
      })}
    </div>
  )
}
