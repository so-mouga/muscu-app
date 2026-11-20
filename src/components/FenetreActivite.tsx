import { useState } from 'react'
import { createPortal } from 'react-dom'
import { db, uid } from '../db'
import { confirmer } from './Dialogues'
import { dureeActivite, EFFORTS_ACTIVITE, TYPES_ACTIVITE } from '../lib/activites'
import { useRetour } from '../lib/nav'
import type { Activite } from '../types'

/**
 * Noter une activité hors muscu d'un jour (padel, course…), ou la modifier : le type, la durée, l'effort en trois choix et une
 * note. Rien à enregistrer à la main : l'activité est écrite dès que le type est choisi, puis à chaque changement ; un appui à
 * côté, le glissement ou le retour la ferment en gardant tout (maquette `maquettes/activites.html`, 20 nov. 2026).
 */
export default function FenetreActivite({ date, activite, onFermer }: { date: string; activite?: Activite; onFermer: () => void }) {
  const [a, setA] = useState<Activite>(() => activite ?? { id: uid(), date, type: '', duree: 60, intensite: 6 })
  const [autre, setAutre] = useState(() => !!activite && !(TYPES_ACTIVITE as readonly string[]).includes(activite.type))
  const court = new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })

  // Chaque changement part dans la base, une fois le type connu (une activité sans type ne veut rien dire).
  const changer = (m: Partial<Activite>) => {
    const n = { ...a, ...m }
    setA(n)
    if (n.type.trim()) void db.activites.put({ ...n, type: n.type.trim(), note: n.note?.trim() || undefined })
  }
  useRetour(true, onFermer)

  const supprimer = async () => {
    if (!(await confirmer('Cette activité sera retirée de ce jour.', { titre: 'Supprimer cette activité ?', oui: 'Supprimer', danger: true }))) return
    await db.activites.delete(a.id)
    onFermer()
  }

  return createPortal(
    <div className="modal-fond" onClick={onFermer}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="pile">
          <h2>Activité · {court}</h2>
          <div className="chips">
            {TYPES_ACTIVITE.map((t) => (
              <button key={t} type="button" className={!autre && a.type === t ? 'actif' : ''} aria-pressed={!autre && a.type === t} onClick={() => (setAutre(false), changer({ type: t }))}>
                {t}
              </button>
            ))}
            <button type="button" className={autre ? 'actif' : ''} aria-pressed={autre} onClick={() => (setAutre(true), setA({ ...a, type: autre ? a.type : '' }))}>
              Autre…
            </button>
          </div>
          {autre && <input type="text" autoFocus aria-label="Quelle activité" placeholder="Par exemple : boxe, ski" value={a.type} onChange={(e) => changer({ type: e.target.value })} />}

          <div className="faible petit-texte">Durée</div>
          <div className="stepper">
            <button type="button" onClick={() => changer({ duree: Math.max(15, a.duree - 15) })} aria-label="Moins 15 minutes">
              −
            </button>
            <div className="valeur">
              <span className="activite-duree">{dureeActivite(a.duree)}</span>
            </div>
            <button type="button" onClick={() => changer({ duree: Math.min(600, a.duree + 15) })} aria-label="Plus 15 minutes">
              +
            </button>
          </div>

          <div className="faible petit-texte">Effort</div>
          <div className="rpe activite-effort" style={{ gridTemplateColumns: `repeat(${EFFORTS_ACTIVITE.length}, 1fr)` }}>
            {EFFORTS_ACTIVITE.map((e) => (
              <button key={e.val} type="button" className={a.intensite === e.val ? 'actif' : ''} aria-pressed={a.intensite === e.val} onClick={() => changer({ intensite: e.val })}>
                {e.nom}
                <small>{e.aide}</small>
              </button>
            ))}
          </div>

          <label className="note-jour">
            <span className="faible petit-texte">Note (facultatif)</span>
            <input type="text" value={a.note ?? ''} placeholder="Par exemple : 2 matchs, genou un peu raide" onChange={(e) => changer({ note: e.target.value })} />
          </label>

          <button type="button" className="btn primaire plein" onClick={onFermer}>
            Terminer
          </button>
          {activite && (
            <button type="button" className="btn discret danger plein" onClick={() => void supprimer()}>
              Supprimer cette activité
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
