import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import type { Catalogue } from '../catalogue'
import { db, setReglage } from '../db'
import { dateCourte, dateISO, kg } from '../lib/calc'
import {
  ajouterApres,
  avancePoids,
  avisRythme,
  CLE_OBJECTIFS,
  deplacerPhase,
  dureePhase,
  ecartPhase,
  ecartTexte,
  finApres,
  modifier,
  nomPhase,
  periodes,
  phaseA,
  PHASES,
  poidsDepart,
  poidsSemaine,
  supprimerPhase,
  terminerPhase,
  typePhase,
  type EtapeObjectifs,
  type PeriodePhase,
  type Phase,
} from '../lib/objectifs'
import ChampNombre from './ChampNombre'
import { confirmer } from './Dialogues'

const JOUR = 86400000
const jour = (iso: string) => dateCourte(iso).replace(/^\S+ /, '')
const plusJours = (iso: string, n: number) => dateISO(new Date(Date.parse(iso + 'T12:00:00') + n * JOUR))
const semainesEntre = (a: string, b: string) => Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / (7 * JOUR)))
const DUREES = [4, 8, 12, 16]
const DUREE_DEFAUT: Record<Phase, number> = { prise: 12, seche: 8, maintien: 4 }
const ECARTS: Record<Phase, number[]> = { prise: [1, 2, 3], seche: [-2, -4, -6], maintien: [] }
type Pesees = { date: string; poids: number }[]

/**
 * Phases en blocs (Progression → Objectifs) : passées figées avec leur résultat, en cours (modifiée par une
 * étape datée d'aujourd'hui), à venir (modifiables, supprimables). Chaque phase ajoutée suit la précédente.
 */
export default function Phases({ catalogue }: { catalogue: Catalogue }) {
  const frise = catalogue.objectifs
  const aujourdhui = dateISO()
  const pesees = useLiveQuery(() => db.pesees.toArray(), [], [])
  const [voirAvant, setVoirAvant] = useState(false)
  const enregistrer = (f: EtapeObjectifs[]) => void setReglage(CLE_OBJECTIFS, f)
  const toutes = periodes(frise)
  const enCours = phaseA(frise, aujourdhui)
  const aVenir = toutes.filter((p) => p.debut > aujourdhui)
  const passees = toutes.filter((p) => p.debut <= aujourdhui && p.debut !== enCours?.debut).reverse()
  const derniere = toutes.at(-1)
  const peutAjouter = !!derniere && !derniere.fin && !!derniere.finPrevue && derniere.finPrevue > aujourdhui
  const finie = enCours?.finPrevue && enCours.finPrevue <= aujourdhui && !aVenir.length
  const commencer = (phase: Phase, date = aujourdhui) => enregistrer(modifier(frise, date, { phase, finPrevue: finApres(date, DUREE_DEFAUT[phase]) }, catalogue.ciblesPerso))
  const blocs = [...(enCours ? [enCours] : []), ...aVenir]

  return (
    <>
      {enCours && finie && (
        <div className="carte pile rappel-phase">
          <strong>
            Ta {nomPhase(enCours.phase).toLowerCase()} prévue jusqu’au {jour(enCours.finPrevue!)} est finie.
          </strong>
          <div className="ligne wrap" style={{ gap: 8 }}>
            <button className="btn petit" onClick={() => enregistrer(dureePhase(frise, enCours.debut, semainesEntre(enCours.debut, enCours.finPrevue!) + 4, aujourdhui))}>
              Prolonger de 4 semaines
            </button>
            {PHASES.filter((x) => x.id !== enCours.phase).map((x) => (
              <button key={x.id} className="btn petit" onClick={() => commencer(x.id)}>
                Passer en {x.court.toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="carte pile">
        <h3>Phases</h3>
        <div className="faible">Sèche, maintien ou prise : chaque phase a sa durée et son objectif de poids. Ajoute la suivante à la fin de celle-ci ; le Bilan lit tes perfs et ton poids selon la phase du moment.</div>

        {blocs.map((p, i) => (
          <BlocPhase
            key={p.debut}
            p={p}
            enCours={p.debut === enCours?.debut}
            premier={i === 0}
            voisins={[blocs[i - 1]?.phase, blocs[i + 1]?.phase]}
            suivante={!!blocs[i + 1]}
            pesees={pesees}
            frise={frise}
            aujourdhui={aujourdhui}
            enregistrer={enregistrer}
          />
        ))}

        {!blocs.length && (
          <>
            <div className="faible">Aucune phase en cours. Commence-en une (aujourd’hui ; tu pourras changer la date de début) :</div>
            <div className="chips">
              {PHASES.map((x) => (
                <button key={x.id} onClick={() => commencer(x.id)}>
                  {x.court}
                </button>
              ))}
            </div>
          </>
        )}

        {peutAjouter && (
          <div>
            <div className="faible">+ Ajouter une phase après, à partir du {jour(derniere!.finPrevue!)} :</div>
            <div className="chips">
              {PHASES.filter((x) => x.id !== derniere!.phase).map((x) => (
                <button key={x.id} onClick={() => enregistrer(ajouterApres(frise, x.id, DUREE_DEFAUT[x.id], catalogue.ciblesPerso))}>
                  + {x.court}
                </button>
              ))}
            </div>
          </div>
        )}
        {derniere && !derniere.fin && !derniere.finPrevue && <div className="faible">Fixe une durée à la dernière phase pour pouvoir en ajouter une après.</div>}

        {passees.length > 0 && (
          <>
            <button type="button" className="groupe-repli" onClick={() => setVoirAvant(!voirAvant)} aria-expanded={voirAvant}>
              <span>
                Phases précédentes <span className="faible">({passees.length})</span>
              </span>
              <span className="muted">{voirAvant ? '▾' : '▸'}</span>
            </button>
            {voirAvant && passees.map((p) => <LignePassee key={p.debut} p={p} pesees={pesees} />)}
          </>
        )}
      </div>
    </>
  )
}

/** Une phase passée : figée, avec ce qu'elle a donné sur le poids. */
function LignePassee({ p, pesees }: { p: PeriodePhase; pesees: Pesees }) {
  const depart = poidsDepart(pesees, p.debut)
  const arrivee = poidsSemaine(pesees, p.fin!)
  const fait = depart !== null && arrivee !== null ? Math.round((arrivee - depart) * 10) / 10 : null
  return (
    <div className="ligne-mesure">
      <span>
        <span className={`point-phase phase-${p.phase}`} /> {nomPhase(p.phase)}
        <span className="faible petit-detail">
          {jour(p.debut)} → {jour(p.fin!)} · {semainesEntre(p.debut, plusJours(p.fin!, 1))} sem.
        </span>
      </span>
      <span className="faible" style={{ textAlign: 'right' }}>
        {fait !== null ? `${kg(depart!)} → ${kg(arrivee!)} kg (${ecartTexte(fait)}${p.ecartVise ? `, visé ${ecartTexte(p.ecartVise)}` : ''})` : p.ecartVise ? `visé ${ecartTexte(p.ecartVise)}` : ''}
      </span>
    </div>
  )
}

function BlocPhase({
  p,
  enCours,
  premier,
  voisins,
  suivante,
  pesees,
  frise,
  aujourdhui,
  enregistrer,
}: {
  p: PeriodePhase & { semaine?: number; total?: number }
  enCours: boolean
  premier: boolean
  /** Phases juste avant et juste après : une phase à venir ne peut pas prendre le même type (elles se fondraient). */
  voisins: (Phase | undefined)[]
  suivante: boolean
  pesees: Pesees
  frise: EtapeObjectifs[]
  aujourdhui: string
  enregistrer: (f: EtapeObjectifs[]) => void
}) {
  const total = p.finPrevue ? semainesEntre(p.debut, p.finPrevue) : undefined
  const depart = enCours ? poidsDepart(pesees, p.debut) : null
  const actuel = enCours ? poidsSemaine(pesees, aujourdhui) : null
  const vise = depart !== null && p.ecartVise ? Math.round((depart + p.ecartVise) * 10) / 10 : null
  const avance = vise !== null && actuel !== null ? avancePoids(p.phase, actuel, vise, aujourdhui, p.finPrevue) : null
  const avis = p.ecartVise && total ? avisRythme(p.phase, p.ecartVise, total) : null
  // Début : après l'étape d'avant (la durée est gardée, les phases suivantes suivent).
  const k = frise.findIndex((e) => e.depuis === p.debut)
  const minDebut = k > 0 ? plusJours(frise[k - 1].depuis, 1) : undefined

  const supprimer = async () => {
    if (await confirmer(suivante ? 'Les phases suivantes avancent d’autant.' : 'Elle n’a pas encore commencé.', { titre: `Supprimer cette ${nomPhase(p.phase).toLowerCase()} ?`, oui: 'Supprimer', danger: true }))
      enregistrer(supprimerPhase(frise, p.debut))
  }
  const terminer = async () => {
    if (await confirmer(suivante ? 'La phase suivante commence aujourd’hui, les autres avancent d’autant.' : 'Tu n’auras plus de phase en cours.', { titre: `Terminer ta ${nomPhase(p.phase).toLowerCase()} aujourd’hui ?`, oui: suivante ? 'Passer à la suivante' : 'Terminer la phase' }))
      enregistrer(terminerPhase(frise, p.debut, aujourdhui))
  }

  return (
    <div className={'bloc-phase' + (enCours ? ' en-cours' : '')}>
      <div className="ligne entre">
        <strong>
          <span className={`point-phase phase-${p.phase}`} /> {nomPhase(p.phase)}
        </strong>
        <span className="faible">{enCours ? `semaine ${p.semaine}${total ? ` sur ${total}` : ''}` : `à venir · ${total ? `${total} sem.` : 'sans fin'}`}</span>
      </div>
      <div className="faible">
        Du {jour(p.debut)}
        {p.finPrevue ? ` au ${jour(plusJours(p.finPrevue, -1))}` : ', sans fin prévue'}
      </div>
      {enCours && total && (
        <div className="barre-phase">
          <span style={{ width: `${Math.min(100, ((p.semaine ?? 0) / total) * 100)}%` }} />
        </div>
      )}

      {!enCours && (
        <div className="segments" role="radiogroup" aria-label="Type de phase">
          {PHASES.map((x) => (
            <button
              key={x.id}
              role="radio"
              aria-checked={p.phase === x.id}
              className={p.phase === x.id ? 'actif' : ''}
              disabled={p.phase !== x.id && voisins.includes(x.id)}
              onClick={() => enregistrer(typePhase(frise, p.debut, x.id))}
            >
              {x.court}
            </button>
          ))}
        </div>
      )}

      <div className="chips">
        {DUREES.map((n) => {
          const fin = finApres(p.debut, n)
          return (
            <button key={n} className={p.finPrevue === fin ? 'actif' : ''} disabled={enCours && fin <= aujourdhui} onClick={() => enregistrer(dureePhase(frise, p.debut, n, aujourdhui))}>
              {n} sem.
            </button>
          )
        })}
        {!suivante && (
          <button className={!p.finPrevue ? 'actif' : ''} onClick={() => enregistrer(dureePhase(frise, p.debut, undefined, aujourdhui))}>
            Sans fin
          </button>
        )}
      </div>
      {premier && (
        <label className="champ">
          <span>Début</span>
          <input type="date" value={p.debut} min={minDebut} onChange={(e) => e.target.value && e.target.value >= (minDebut ?? '') && enregistrer(deplacerPhase(frise, p.debut, e.target.value))} />
        </label>
      )}

      {p.phase !== 'maintien' && (
        <>
          <div className="ligne entre">
            <span>Objectif de poids</span>
            <span className="ligne" style={{ gap: 6 }}>
              <ChampNombre
                valeur={p.ecartVise}
                placeholder="±"
                largeur={64}
                signe
                onChange={(v) => {
                  if (v === undefined) {
                    enregistrer(ecartPhase(frise, p.debut, undefined, aujourdhui))
                    return
                  }
                  // Corrige le signe selon la phase si l'utilisateur a juste tapé un chiffre positif (ex: "4" en sèche -> -4)
                  const signed = p.phase === 'seche' ? -Math.abs(v) : Math.abs(v)
                  enregistrer(ecartPhase(frise, p.debut, Math.round(signed * 10) / 10, aujourdhui))
                }}
              />
              <span className="faible">kg</span>
            </span>
          </div>
          <div className="chips">
            {ECARTS[p.phase].map((x) => (
              <button key={x} className={p.ecartVise === x ? 'actif' : ''} onClick={() => enregistrer(ecartPhase(frise, p.debut, p.ecartVise === x ? undefined : x, aujourdhui))}>
                {ecartTexte(x)}
              </button>
            ))}
          </div>
          {p.ecartVise ? (
            <div className="faible">
              {vise !== null
                ? `Départ ${kg(depart!)} kg → visé ${kg(vise)} kg (${ecartTexte(p.ecartVise)}).`
                : `${ecartTexte(p.ecartVise)}${total ? ` en ${total} semaines, soit ${ecartTexte(Math.round((p.ecartVise / total) * 100) / 100)} par semaine` : ''}.`}
              {avance && (avance.atteint ? ' Atteint 🎉' : ` Cette semaine ${kg(actuel!)} kg : encore ${ecartTexte(avance.reste)}${avance.parSemaine !== null ? `, soit ${ecartTexte(avance.parSemaine)} par semaine` : ''}.`)}
              {enCours && depart === null && ' Pèse-toi pour fixer ton poids de départ.'}
              {avis && <div style={{ color: 'var(--alerte)' }}>Rythme {avis}.</div>}
            </div>
          ) : null}
        </>
      )}

      <div className="ligne wrap" style={{ gap: 8 }}>
        {enCours ? (
          <button className="btn discret petit lien-action" onClick={terminer}>
            {suivante ? 'Passer à la suivante maintenant' : 'Terminer la phase'}
          </button>
        ) : (
          <button className="btn discret petit lien-action" onClick={supprimer}>
            Supprimer
          </button>
        )}
      </div>
    </div>
  )
}
