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
  const nbFaits = ids.filter((id) => e.faits.includes(id)).length
  const tousFaits = nbFaits === ids.length
  // Revenu par la pastille 🤸 une fois la séance commencée : on consulte, on ne recommence pas.
  const revoir = !echauffementActif(seance)
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
        <h2>
          Échauffement <span className="faible">≈ {minutesDe(ids, liste)}</span>
        </h2>
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
      {/* Un seul bouton : son texte suit ce qui est coché (les cases restent visibles dans la séance enregistrée). */}
      <button className={'btn grand' + (tousFaits || revoir ? ' primaire' : '')} onClick={revoir ? onPasser : finir}>
        {revoir ? 'Retour à la séance' : tousFaits ? '✓ Échauffé, on attaque' : nbFaits ? `Terminer l’échauffement (${nbFaits}/${ids.length})` : 'Passer l’échauffement'}
      </button>
    </div>
  )
}

/**
 * Réglage de l'échauffement d'une séance : coupé par défaut ; activé, on choisit ses mouvements dans une liste.
 * `discret` (écran « Voir ») : coupé, ce n'est qu'un petit bouton « Activer l'échauffement ».
 */
export function ReglageEchauffement({ modele, onChange, discret = false }: { modele: SeanceModele; exo?: (id: string) => Exercice; onChange: (v: SeanceModele['echauffement']) => void; discret?: boolean }) {
  const [choix, setChoix] = useState(false)
  const liste = useMouvements()
  const actif = Array.isArray(modele.echauffement)
  const ids = echauffementDe(modele).filter((id) => mouvement(id, liste))
  if (discret && !actif)
    return (
      <button type="button" className="btn discret petit" onClick={() => (onChange([]), setChoix(true))}>
        🤸 Activer l’échauffement
      </button>
    )
  return (
    <div className="carte pile">
      <Interrupteur
        on={actif}
        onChange={(v) => {
          onChange(v ? [] : undefined)
          if (v) setChoix(true)
        }}
        label="Échauffement avant la séance"
        aide={actif ? undefined : 'Des mouvements à cocher avant la 1re série. Les séries de chauffe de chaque exercice restent, elles, toujours là.'}
      />
      {actif && (
        <>
          <div className="faible">{ids.length ? `${ids.map((id) => mouvement(id, liste)!.nom).join(' · ')} (≈ ${minutesDe(ids, liste)})` : 'Aucun mouvement choisi.'}</div>
          <button type="button" className="btn" onClick={() => setChoix(true)}>
            {ids.length ? 'Modifier les mouvements' : 'Choisir les mouvements'}
          </button>
        </>
      )}
      {choix && <ChoixMouvements ids={ids} liste={liste} onChange={onChange} onFermer={() => setChoix(false)} />}
    </div>
  )
}

/** Choix des mouvements : une liste par zone, avec le dessin, la quantité et les consignes (ⓘ). */
function ChoixMouvements({ ids, liste, onChange, onFermer }: { ids: string[]; liste: MouvementEchauffement[]; onChange: (v: SeanceModele['echauffement']) => void; onFermer: () => void }) {
  const [ajout, setAjout] = useState<MouvementEchauffement['zone'] | null>(null)
  const [ouvert, setOuvert] = useState<string | null>(null)
  useRetour(true, onFermer)
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
          <div key={z} className="echauffement">
            <h3 style={{ margin: '8px 0 4px' }}>{nom}</h3>
            {liste
              .filter((m) => m.zone === z)
              .map((m) => {
                const choisi = ids.includes(m.id)
                return (
                  <div key={m.id} className={'mouvement' + (choisi ? ' choisi' : '')}>
                    <button type="button" className="mouvement-ligne" onClick={() => basculer(m.id)} aria-pressed={choisi}>
                      <span className="case">{choisi ? '✓' : ''}</span>
                      <PictoEchauffement id={m.id} taille={44} />
                      <span className="mouvement-texte">
                        <strong>{m.nom}</strong>
                        {m.quantite && <span className="faible">{m.quantite}</span>}
                      </span>
                    </button>
                    {m.perso ? (
                      <button type="button" className="btn-infos" onClick={() => void supprimer(m)} aria-label={`Supprimer ${m.nom}`}>
                        ×
                      </button>
                    ) : (
                      m.consignes.length > 0 && (
                        <button type="button" className="btn-infos" onClick={() => setOuvert(ouvert === m.id ? null : m.id)} aria-expanded={ouvert === m.id} aria-label={`Comment faire : ${m.nom}`}>
                          {ouvert === m.id ? '×' : 'i'}
                        </button>
                      )
                    )}
                    {ouvert === m.id && (
                      <div className="mouvement-detail">
                        <PictoEchauffement id={m.id} taille={120} />
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
            {ajout === z ? (
              <NouveauMouvement
                zone={z}
                onAnnuler={() => setAjout(null)}
                onCree={async (m) => {
                  await setReglage('echauffementsPerso', [...liste.filter((x) => x.perso), m])
                  onChange([...ids, m.id])
                  setAjout(null)
                }}
              />
            ) : (
              <button type="button" className="btn discret petit lien-action" onClick={() => setAjout(z)}>
                + Ajouter un mouvement
              </button>
            )}
          </div>
        ))}
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
