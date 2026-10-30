import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { dureeEchauffement, echauffementDe, mouvement, MOUVEMENTS, type MouvementEchauffement } from '../data/echauffements'
import { db, setReglage, uid } from '../db'
import { minutes } from '../lib/calc'
import { useRetour } from '../lib/nav'
import type { Exercice, Seance, SeanceModele } from '../types'
import { majSeance } from './CarteExo'
import { confirmer } from './Dialogues'
import Interrupteur from './Interrupteur'
import PictoEchauffement from './PictoEchauffement'

const ZONES = [
  ['general', 'Général'],
  ['haut', 'Haut du corps'],
  ['bas', 'Bas du corps'],
] as const

/** La bibliothèque et les mouvements ajoutés par l'utilisateur. */
export function useMouvements(): MouvementEchauffement[] {
  const perso = useLiveQuery(() => db.reglages.get('echauffementsPerso'), [])
  return [...MOUVEMENTS, ...((perso?.valeur as MouvementEchauffement[] | undefined) ?? [])]
}

const minutesDe = (ids: string[], liste: MouvementEchauffement[]) => minutes(Math.max(1, Math.round(dureeEchauffement(ids, liste) / 60)))

/** Échauffement en tête de séance tant qu'aucune série n'est faite et qu'on ne l'a pas fini ou passé. */
export const echauffementActif = (s: Seance) => !!s.echauffement?.ids.length && !s.echauffement.fini && s.series.length === 0

/** 1re étape de la séance : les mouvements à cocher, avec dessin et consignes. */
export default function Echauffement({ seance, onPasser }: { seance: Seance; onPasser?: () => void }) {
  const [ouvert, setOuvert] = useState<string | null>(null)
  const liste = useMouvements()
  const e = seance.echauffement!
  const ids = e.ids.filter((id) => mouvement(id, liste))
  const tousFaits = ids.every((id) => e.faits.includes(id))
  const cocher = (id: string) =>
    void majSeance(seance.id, (s) => {
      const f = s.echauffement!.faits
      s.echauffement!.faits = f.includes(id) ? f.filter((x) => x !== id) : [...f, id]
    })
  const finir = () => {
    void majSeance(seance.id, (s) => {
      s.echauffement!.fini = true
    })
    onPasser?.()
  }

  return (
    <div className="carte pile echauffement">
      <div className="ligne entre">
        <h2>Échauffement</h2>
        <span className="faible">≈ {minutesDe(ids, liste)}</span>
      </div>
      <div>
        {ids.map((id) => {
          const m = mouvement(id, liste)!
          const fait = e.faits.includes(id)
          const details = m.consignes.length > 0
          return (
            <div key={id} className={'mouvement' + (fait ? ' fait' : '')}>
              <button className="mouvement-ligne" onClick={() => cocher(id)} aria-pressed={fait}>
                <span className="case">{fait ? '✓' : ''}</span>
                <PictoEchauffement id={id} taille={44} />
                <span className="mouvement-texte">
                  <strong>{m.nom}</strong>
                  {m.quantite && <span className="faible">{m.quantite}</span>}
                </span>
              </button>
              {details && (
                <button type="button" className="btn-infos" onClick={() => setOuvert(ouvert === id ? null : id)} aria-expanded={ouvert === id} aria-label={`Comment faire : ${m.nom}`}>
                  {ouvert === id ? '×' : 'i'}
                </button>
              )}
              {ouvert === id && (
                <div className="mouvement-detail">
                  <PictoEchauffement id={id} taille={120} />
                  <ul className="consignes">
                    {m.consignes.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <button className={'btn grand' + (tousFaits ? ' primaire' : '')} onClick={finir}>
        {tousFaits ? '✓ Échauffé, on attaque' : 'Passer à la séance'}
      </button>
    </div>
  )
}

/** Réglage de l'échauffement d'une séance (éditeur) : interrupteur, résumé, choix des mouvements dans une fenêtre. */
export function ReglageEchauffement({ modele, exo, onChange }: { modele: SeanceModele; exo: (id: string) => Exercice; onChange: (v: SeanceModele['echauffement']) => void }) {
  const [choix, setChoix] = useState(false)
  const liste = useMouvements()
  const actif = modele.echauffement !== 'aucun'
  const ids = echauffementDe(modele, exo).filter((id) => mouvement(id, liste))
  return (
    <div className="carte pile">
      <Interrupteur on={actif} onChange={(v) => onChange(v ? undefined : 'aucun')} label="Échauffement avant la séance" aide={actif ? undefined : 'Les séries de chauffe de chaque exercice restent.'} />
      {actif && (
        <>
          <div className="faible">
            {ids.length ? `${ids.map((id) => mouvement(id, liste)!.nom).join(' · ')} (≈ ${minutesDe(ids, liste)})` : 'Aucun mouvement choisi.'}
            {modele.echauffement === undefined && ' — proposé d’après les muscles de la séance.'}
          </div>
          <button type="button" className="btn" onClick={() => setChoix(true)}>
            Choisir les mouvements
          </button>
        </>
      )}
      {choix && <ChoixMouvements modele={modele} ids={ids} liste={liste} onChange={onChange} onFermer={() => setChoix(false)} />}
    </div>
  )
}

function ChoixMouvements({
  modele,
  ids,
  liste,
  onChange,
  onFermer,
}: {
  modele: SeanceModele
  ids: string[]
  liste: MouvementEchauffement[]
  onChange: (v: SeanceModele['echauffement']) => void
  onFermer: () => void
}) {
  const [ajout, setAjout] = useState<MouvementEchauffement['zone'] | null>(null)
  useRetour(true, onFermer)
  // Toucher un mouvement fige la liste : on part de celle proposée d'après les muscles.
  const basculer = (id: string) => onChange(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])
  const supprimer = async (m: MouvementEchauffement) => {
    if (!(await confirmer(`Supprimer « ${m.nom} » de tes mouvements ?`, { oui: 'Supprimer', danger: true }))) return
    const perso = liste.filter((x) => x.perso && x.id !== m.id)
    await setReglage('echauffementsPerso', perso)
    if (ids.includes(m.id)) onChange(ids.filter((x) => x !== m.id))
  }
  return (
    <div className="modal-fond" onClick={onFermer}>
      <div className="modal pile" onClick={(e) => e.stopPropagation()}>
        <h2>Mouvements d’échauffement</h2>
        <div className="faible">
          {ids.length} choisi{ids.length > 1 ? 's' : ''} · ≈ {minutesDe(ids, liste)}
        </div>
        {ZONES.map(([z, nom]) => (
          <div key={z}>
            <div className="faible" style={{ margin: '4px 0' }}>
              {nom}
            </div>
            <div className="chips">
              {liste
                .filter((m) => m.zone === z)
                .map((m) => (
                  <span key={m.id} className="chip-groupe">
                    <button type="button" className={ids.includes(m.id) ? 'actif' : ''} onClick={() => basculer(m.id)}>
                      {ids.includes(m.id) ? '✓ ' : ''}
                      {m.nom}
                    </button>
                    {m.perso && (
                      <button type="button" className="chip-suppr" onClick={() => void supprimer(m)} aria-label={`Supprimer ${m.nom}`}>
                        ×
                      </button>
                    )}
                  </span>
                ))}
              <button type="button" className="chip-ajout" onClick={() => setAjout(z)}>
                + Ajouter
              </button>
            </div>
            {ajout === z && (
              <NouveauMouvement
                zone={z}
                onAnnuler={() => setAjout(null)}
                onCree={async (m) => {
                  await setReglage('echauffementsPerso', [...liste.filter((x) => x.perso), m])
                  onChange([...ids, m.id])
                  setAjout(null)
                }}
              />
            )}
          </div>
        ))}
        {modele.echauffement !== undefined && (
          <button type="button" className="btn discret plein" onClick={() => onChange(undefined)}>
            ↺ Reprendre la proposition d’après les muscles
          </button>
        )}
        <button className="btn primaire plein" onClick={onFermer}>
          OK
        </button>
      </div>
    </div>
  )
}

function NouveauMouvement({ zone, onCree, onAnnuler }: { zone: MouvementEchauffement['zone']; onCree: (m: MouvementEchauffement) => void; onAnnuler: () => void }) {
  const [nom, setNom] = useState('')
  const [quantite, setQuantite] = useState('')
  const [consigne, setConsigne] = useState('')
  return (
    <div className="pile nouveau-mouvement">
      <label className="champ">
        <span>Nom</span>
        <input autoFocus value={nom} placeholder="ex. Rotations de poignets" onChange={(e) => setNom(e.target.value)} />
      </label>
      <label className="champ">
        <span>Combien</span>
        <input value={quantite} placeholder="ex. 10 par côté, 30 s" onChange={(e) => setQuantite(e.target.value)} />
      </label>
      <label className="champ">
        <span>Consigne (facultatif)</span>
        <input value={consigne} onChange={(e) => setConsigne(e.target.value)} />
      </label>
      <div className="ligne" style={{ gap: 8 }}>
        <button type="button" className="btn" style={{ flex: 1 }} onClick={onAnnuler}>
          Annuler
        </button>
        <button
          type="button"
          className="btn primaire"
          style={{ flex: 1 }}
          disabled={!nom.trim()}
          onClick={() => onCree({ id: 'e_' + uid(), nom: nom.trim(), quantite: quantite.trim(), duree: 45, zone, consignes: consigne.trim() ? [consigne.trim()] : [], perso: true })}
        >
          Ajouter
        </button>
      </div>
    </div>
  )
}
