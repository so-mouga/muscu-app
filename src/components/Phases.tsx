import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { AlertTriangle, ChevronRight, Pencil } from 'lucide-react'
import type { Catalogue } from '../catalogue'
import { db, setReglage } from '../db'
import { dateCourte, dateISO, kg } from '../lib/calc'
import {
  ajouterApres,
  avisRythme,
  caloriesPhase,
  CLE_OBJECTIFS,
  CLE_SANS_OBJECTIF,
  deplacerPhase,
  dureePhase,
  dureeProlongee,
  ecartPhase,
  ecartTexte,
  finApres,
  finNouvellePhase,
  modifier,
  nomPhase,
  periodes,
  phaseA,
  PHASES,
  poidsDepart,
  poidsSemaine,
  rythmeParSemaine,
  supprimerPhase,
  terminerPhase,
  typePhase,
  type EtapeObjectifs,
  type PeriodePhase,
  type Phase,
} from '../lib/objectifs'
import ChampNombre from './ChampNombre'
import { confirmer } from './Dialogues'
import Deplie from './Deplie'

const JOUR = 86400000
const jour = (iso: string) => dateCourte(iso).replace(/^\S+ /, '')
const plusJours = (iso: string, n: number) => dateISO(new Date(Date.parse(iso + 'T12:00:00') + n * JOUR))
const semainesEntre = (a: string, b: string) => Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / (7 * JOUR)))
const DUREES = [4, 8, 12, 16]
const DUREE_DEFAUT: Record<Phase, number> = { prise: 12, seche: 8, maintien: 4 }
const ECARTS: Record<Phase, number[]> = { prise: [1, 2, 3], seche: [-2, -4, -6], maintien: [] }
type Pesees = { date: string; poids: number }[]

/**
 * Phases en blocs (Corps → Phases) : dashboard épuré pour la phase en cours,
 * timeline pour les phases à venir, et historique des phases passées.
 */
export default function Phases({ catalogue }: { catalogue: Catalogue }) {
  const frise = catalogue.objectifs
  const aujourdhui = dateISO()
  const pesees = useLiveQuery(() => db.pesees.toArray(), [], [])
  const [voirAvant, setVoirAvant] = useState(false)
  const [editionEnCours, setEditionEnCours] = useState(false)
  const [ouverte, setOuverte] = useState<string | null>(null)

  const enregistrer = (f: EtapeObjectifs[]) => void setReglage(CLE_OBJECTIFS, f)
  const toutes = periodes(frise)
  const enCours = phaseA(frise, aujourdhui)
  const aVenir = toutes.filter((p) => p.debut > aujourdhui)
  const passees = toutes.filter((p) => p.debut <= aujourdhui && p.debut !== enCours?.debut).reverse()
  const derniere = toutes.at(-1)
  const peutAjouter = !!derniere && !derniere.fin && !!derniere.finPrevue && derniere.finPrevue > aujourdhui
  const finie = enCours?.finPrevue && enCours.finPrevue <= aujourdhui && !aVenir.length
  const commencer = (phase: Phase, date = aujourdhui) => {
    enregistrer(modifier(frise, date, { phase, finPrevue: finNouvellePhase(frise, date, DUREE_DEFAUT[phase]) }, catalogue.ciblesPerso))
    if (catalogue.sansObjectif) void setReglage(CLE_SANS_OBJECTIF, false)
    setEditionEnCours(true)
  }

  // Métriques pour la phase en cours
  const totalEnCours = enCours?.finPrevue ? semainesEntre(enCours.debut, enCours.finPrevue) : undefined
  const departEnCours = enCours ? poidsDepart(pesees, enCours.debut) : null
  const viseEnCours = departEnCours !== null && enCours?.ecartVise ? Math.round((departEnCours + enCours.ecartVise) * 10) / 10 : null
  const avisEnCours = enCours?.ecartVise && totalEnCours ? avisRythme(enCours.phase, enCours.ecartVise, totalEnCours) : null

  return (
    <>
      {enCours && finie && (
        <div className="carte pile rappel-phase" style={{ padding: '16px', borderRadius: 'var(--rayon)', marginBottom: 12 }}>
          <strong>
            Ta {nomPhase(enCours.phase).toLowerCase()} prévue jusqu’au {jour(plusJours(enCours.finPrevue!, -1))} est finie.
          </strong>
          <div className="ligne wrap" style={{ gap: 8, marginTop: 8 }}>
            <button
              className="btn petit"
              onClick={() => enregistrer(dureePhase(frise, enCours.debut, dureeProlongee(enCours.debut, enCours.finPrevue!, aujourdhui), aujourdhui))}
            >
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

      <div className="carte" style={{ padding: '16px', borderRadius: 'var(--rayon)' }}>
        {/* --- PHASE EN COURS --- */}
        {enCours && (
          <div>
            {!editionEnCours ? (
              /* Vue Dashboard compacte */
              <div
                style={{
                  background: 'var(--sous-carte)',
                  border: '1px solid var(--bord)',
                  borderRadius: 'var(--rayon-2)',
                  padding: '14px 16px',
                  marginBottom: aVenir.length || peutAjouter ? 16 : 8,
                }}
              >
                {/* Ligne 1 : Titre + Badge + Bouton Modifier */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`point-phase phase-${enCours.phase}`} style={{ width: 10, height: 10 }} />
                    <span style={{ fontSize: 'var(--t-texte)', fontWeight: 700, color: 'var(--texte)' }}>
                      {nomPhase(enCours.phase)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontSize: 'var(--t-legende)',
                        fontWeight: 600,
                        color: `var(--phase-${enCours.phase})`,
                        background: 'var(--voile)',
                        padding: '2px 8px',
                        borderRadius: 'var(--rayon-2)',
                        border: '1px solid var(--bord)',
                      }}
                    >
                      Sem. {enCours.semaine}{totalEnCours && !enCours.depassee ? `/${totalEnCours}` : ''}
                    </span>
                    <button
                      type="button"
                      aria-label="Modifier la phase en cours"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        padding: '4px',
                        color: 'var(--texte-2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        borderRadius: 'var(--rayon-2)',
                      }}
                      onClick={() => setEditionEnCours(true)}
                    >
                      <Pencil size={15} strokeWidth={1.75} />
                    </button>
                  </div>
                </div>

                {/* Ligne 2 : Dates et Objectif de poids */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 8 }}>
                  <div style={{ fontSize: 'var(--t-legende)', color: 'var(--texte-2)' }}>
                    {jour(enCours.debut)} → {enCours.finPrevue ? jour(plusJours(enCours.finPrevue, -1)) : 'sans fin prévue'}
                  </div>
                  {enCours.ecartVise && departEnCours !== null && (
                    <div style={{ fontSize: 'var(--t-petit)', color: 'var(--texte)', fontWeight: 500 }}>
                      {kg(departEnCours)} kg → {viseEnCours !== null ? `${kg(viseEnCours)} kg` : ''} ({ecartTexte(enCours.ecartVise)})
                      {totalEnCours && ` · ${ecartTexte(Math.round((enCours.ecartVise / totalEnCours) * 100) / 100)}/sem`}
                    </div>
                  )}
                </div>

                {/* Ligne 3 : Barre de progression horizontale fine */}
                {totalEnCours && (
                  <div
                    style={{
                      height: 6,
                      background: 'var(--voile)',
                      borderRadius: 3,
                      overflow: 'hidden',
                      marginTop: 12,
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(100, ((enCours.semaine ?? 0) / totalEnCours) * 100)}%`,
                        height: '100%',
                        background: `var(--phase-${enCours.phase})`,
                        borderRadius: 3,
                      }}
                    />
                  </div>
                )}

                {/* Bannière d'alerte de rythme */}
                {avisEnCours && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginTop: 10,
                      padding: '6px 10px',
                      borderRadius: 'var(--rayon-2)',
                      background: 'var(--alerte-voile)',
                      border: '1px solid var(--alerte-bord)',
                      color: 'var(--alerte)',
                      fontSize: 'var(--t-legende)',
                      fontWeight: 500,
                    }}
                  >
                    <AlertTriangle size={14} strokeWidth={2} />
                    <span>Rythme {avisEnCours}</span>
                  </div>
                )}

                <div style={{ marginTop: 12 }}>
                  <ChampCalories p={enCours} frise={frise} aujourdhui={aujourdhui} enregistrer={enregistrer} />
                </div>
              </div>
            ) : (
              /* Vue Édition de la phase en cours */
              <div
                style={{
                  background: 'var(--sous-carte)',
                  border: '1px solid var(--voile-fort)',
                  borderRadius: 'var(--rayon-2)',
                  padding: '14px 16px',
                  marginBottom: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span className={`point-phase phase-${enCours.phase}`} />
                  <strong style={{ fontSize: 'var(--t-texte)', color: 'var(--texte)' }}>Modifier {nomPhase(enCours.phase)}</strong>
                </div>

                <EditeurPhase
                  p={enCours}
                  enCours={true}
                  premier={true}
                  voisins={[undefined, aVenir[0]?.phase]}
                  suivante={aVenir.length > 0}
                  pesees={pesees}
                  frise={frise}
                  aujourdhui={aujourdhui}
                  enregistrer={(f) => {
                    enregistrer(f)
                  }}
                  onFermer={() => setEditionEnCours(false)}
                />
              </div>
            )}
          </div>
        )}

        {!enCours && (
          <div style={{ marginBottom: 14 }}>
            <div className="faible" style={{ marginBottom: 8 }}>
              Qu’est-ce que tu vises en ce moment ? C’est facultatif.
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PHASES.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--rayon-2)',
                    background: 'var(--voile)',
                    border: '1px solid var(--bord)',
                    color: 'var(--texte)',
                    fontSize: 'var(--t-petit)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  onClick={() => commencer(x.id)}
                >
                  {x.nom}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={!!catalogue.sansObjectif}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--rayon-2)',
                  background: catalogue.sansObjectif ? 'var(--voile-fort)' : 'var(--voile)',
                  border: '1px solid var(--bord)',
                  color: 'var(--texte)',
                  fontSize: 'var(--t-petit)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                onClick={() => void setReglage(CLE_SANS_OBJECTIF, !catalogue.sansObjectif)}
              >
                Pas d’objectif pour l’instant
              </button>
            </div>
            {catalogue.sansObjectif && (
              <div className="faible petit-texte" style={{ marginTop: 8 }}>
                Tu t’entraînes, c’est tout : l’appli ne te demande rien de plus.
              </div>
            )}
          </div>
        )}

        {/* --- TIMELINE DES PHASES SUIVANTES (« À VENIR ») --- */}
        {aVenir.length > 0 && (
          <div style={{ marginTop: 6, marginBottom: 12 }}>
            <div
              style={{
                fontSize: 'var(--t-legende)',
                fontWeight: 600,
                color: 'var(--texte-2)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: 10,
              }}
            >
              À venir
            </div>

            <div style={{ position: 'relative', paddingLeft: 18 }}>
              {/* Ligne verticale de timeline */}
              <div
                style={{
                  position: 'absolute',
                  top: 14,
                  bottom: 14,
                  left: 4,
                  width: 2,
                  background: 'var(--voile-fort)',
                  borderRadius: 1,
                }}
              />

              {aVenir.map((p, idx) => {
                const estOuverte = ouverte === p.debut
                const total = p.finPrevue ? semainesEntre(p.debut, p.finPrevue) : undefined
                return (
                  <div key={p.debut} style={{ position: 'relative', marginBottom: 10 }}>
                    {/* Point sur la timeline */}
                    <div
                      style={{
                        position: 'absolute',
                        left: -18,
                        top: 13,
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: `var(--phase-${p.phase})`,
                        border: '2px solid var(--bg)',
                      }}
                    />

                    {!estOuverte ? (
                      <button
                        type="button"
                        onClick={() => setOuverte(p.debut)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: 'var(--rayon-2)',
                          background: 'var(--surface-2)',
                          border: '1px solid var(--voile)',
                          cursor: 'pointer',
                          transition: 'all var(--duree-appui) ease',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 'var(--t-petit)', fontWeight: 600, color: 'var(--texte)' }}>
                            {nomPhase(p.phase)}
                          </div>
                          <div style={{ fontSize: 'var(--t-legende)', color: 'var(--texte-2)', marginTop: 2 }}>
                            Du {jour(p.debut)} {p.finPrevue ? `au ${jour(plusJours(p.finPrevue, -1))}` : ''}
                            {p.calories ? <div>{p.calories.toLocaleString('fr-FR')} kcal par jour</div> : null}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 'var(--t-legende)', color: 'var(--texte-2)' }}>
                            {total ? `${total} sem.` : 'sans fin'}
                          </span>
                          <ChevronRight size={15} strokeWidth={1.75} className="muted" />
                        </div>
                      </button>
                    ) : (
                      <div
                        className="fondu-entree"
                        style={{
                          padding: '12px 14px',
                          borderRadius: 'var(--rayon-2)',
                          background: 'var(--surface-2)',
                          border: '1px solid var(--voile-fort)',
                        }}
                      >
                        <div style={{ fontSize: 'var(--t-petit)', fontWeight: 700, color: 'var(--texte)', marginBottom: 10 }}>{nomPhase(p.phase)} (à venir)</div>
                        <EditeurPhase
                          p={p}
                          enCours={false}
                          premier={false}
                          voisins={[aVenir[idx - 1]?.phase ?? enCours?.phase, aVenir[idx + 1]?.phase]}
                          suivante={!!aVenir[idx + 1]}
                          pesees={pesees}
                          frise={frise}
                          aujourdhui={aujourdhui}
                          enregistrer={enregistrer}
                          onFermer={() => setOuverte(null)}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* --- PLANIFIER LA SUITE : pas pendant qu'on règle une phase, il revient en fermant --- */}
        {peutAjouter && !editionEnCours && !ouverte && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              paddingTop: 8,
              borderTop: '1px solid var(--voile)',
              marginTop: 6,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 'var(--t-legende)', color: 'var(--texte-2)' }}>
              + Planifier la suite :
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              {PHASES.filter((x) => x.id !== derniere!.phase).map((x) => (
                <button
                  key={x.id}
                  type="button"
                  style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--bord)',
                    color: 'var(--texte)',
                    fontSize: 'var(--t-legende)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all var(--duree-appui) ease',
                  }}
                  onClick={() => {
                    enregistrer(ajouterApres(frise, x.id, DUREE_DEFAUT[x.id], catalogue.ciblesPerso))
                    setOuverte(derniere!.finPrevue!)
                  }}
                >
                  + {x.court}
                </button>
              ))}
            </div>
          </div>
        )}

        {derniere && !derniere.fin && !derniere.finPrevue && !editionEnCours && !ouverte && (
          <div className="faible" style={{ fontSize: 'var(--t-legende)', marginTop: 8 }}>
            Fixe une durée à la dernière phase pour pouvoir en ajouter une après.
          </div>
        )}

        {/* --- PHASES PRÉCÉDENTES --- */}
        {passees.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--voile)' }}>
            <button
              type="button"
              className="groupe-repli"
              onClick={() => setVoirAvant(!voirAvant)}
              aria-expanded={voirAvant}
              style={{ padding: '4px 0' }}
            >
              <span style={{ fontSize: 'var(--t-petit)' }}>
                Phases précédentes <span className="faible">({passees.length})</span>
              </span>
              <ChevronRight size={16} className={'muted depliable-chevron' + (voirAvant ? ' ouvert' : '')} />
            </button>
            <Deplie ouvert={voirAvant}>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {passees.map((p) => (
                  <LignePassee key={p.debut} p={p} pesees={pesees} />
                ))}
              </div>
            </Deplie>
          </div>
        )}
      </div>
    </>
  )
}

/** Calories par jour d'une phase : l'objectif de l'accueil suit la phase, sans rien à refaire le jour du changement. */
function ChampCalories({
  p,
  frise,
  aujourdhui,
  enregistrer,
}: {
  p: PeriodePhase
  frise: EtapeObjectifs[]
  aujourdhui: string
  enregistrer: (f: EtapeObjectifs[]) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 'var(--t-petit)', color: 'var(--texte-2)' }}>Calories par jour</span>
        <span style={{ fontSize: 'var(--t-legende)', color: 'var(--texte-2)' }}>Facultatif</span>
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>
        <ChampNombre
          key={p.debut + p.phase}
          valeur={p.calories}
          placeholder="—"
          largeur={75}
          onChange={(v) => enregistrer(caloriesPhase(frise, p.debut, v ? Math.round(v) : undefined, aujourdhui))}
        />
        <span style={{ fontSize: 'var(--t-petit)', color: 'var(--texte-2)' }}>kcal</span>
      </span>
    </div>
  )
}

/** Formulaire d'édition d'une phase (déplié sur demande). */
function EditeurPhase({
  p,
  enCours,
  premier,
  voisins,
  suivante,
  pesees,
  frise,
  aujourdhui,
  enregistrer,
  onFermer,
}: {
  p: PeriodePhase & { semaine?: number; total?: number }
  enCours: boolean
  premier: boolean
  voisins: (Phase | undefined)[]
  suivante: boolean
  pesees: Pesees
  frise: EtapeObjectifs[]
  aujourdhui: string
  enregistrer: (f: EtapeObjectifs[]) => void
  onFermer?: () => void
}) {
  const total = p.finPrevue ? semainesEntre(p.debut, p.finPrevue) : undefined
  // Le conseil suit le poids pendant qu'on le tape ; l'enregistrement, lui, se fait à la fin de la saisie.
  const [frappe, setFrappe] = useState<{ v?: number } | null>(null)
  const signe = (v: number) => Math.round((p.phase === 'seche' ? -Math.abs(v) : Math.abs(v)) * 10) / 10
  const ecart = frappe ? (frappe.v ? signe(frappe.v) : undefined) : p.ecartVise
  const avis = ecart && total ? avisRythme(p.phase, ecart, total) : null
  const depart = enCours ? poidsDepart(pesees, p.debut) : null
  const vise = depart !== null && ecart ? Math.round((depart + ecart) * 10) / 10 : null
  const k = frise.findIndex((e) => e.depuis === p.debut)
  const minDebut = k > 0 ? plusJours(frise[k - 1].depuis, 1) : undefined

  const supprimer = async () => {
    if (
      await confirmer(suivante ? 'Les phases suivantes avancent d’autant.' : p.debut === aujourdhui ? 'Elle a commencé aujourd’hui : rien n’en sera gardé.' : 'Elle n’a pas encore commencé.', {
        titre: `Supprimer cette ${nomPhase(p.phase).toLowerCase()} ?`,
        oui: 'Supprimer',
        danger: true,
      })
    ) {
      enregistrer(supprimerPhase(frise, p.debut))
      onFermer?.()
    }
  }

  const terminer = async () => {
    if (
      await confirmer(
        suivante ? 'La phase suivante commence aujourd’hui, les autres avancent d’autant.' : 'Tu n’auras plus de phase en cours.',
        {
          titre: `Terminer ta ${nomPhase(p.phase).toLowerCase()} aujourd’hui ?`,
          oui: suivante ? 'Passer à la suivante' : 'Terminer la phase',
        },
      )
    ) {
      enregistrer(terminerPhase(frise, p.debut, aujourdhui))
      onFermer?.()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Switch de type de phase si future */}
      {!enCours && (
        <div className="segments" role="radiogroup" aria-label="Type de phase">
          {PHASES.map((x) => (
            <button
              key={x.id}
              type="button"
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

      {/* Durée sur une seule ligne horizontale compacte */}
      <div>
        <div style={{ fontSize: 'var(--t-legende)', color: 'var(--texte-2)', marginBottom: 6 }}>Durée de la phase</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {DUREES.map((n) => {
            const fin = finApres(p.debut, n)
            const actif = p.finPrevue === fin
            return (
              <button
                key={n}
                type="button"
                style={{
                  flex: 1,
                  padding: '6px 0',
                  fontSize: 'var(--t-legende)',
                  fontWeight: actif ? 600 : 400,
                  borderRadius: 'var(--rayon-2)',
                  border: '1px solid ' + (actif ? `var(--phase-${p.phase})` : 'var(--bord)'),
                  background: actif ? 'var(--bord)' : 'transparent',
                  color: actif ? 'var(--texte)' : 'var(--texte-2)',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
                disabled={enCours && fin <= aujourdhui}
                onClick={() => enregistrer(dureePhase(frise, p.debut, n, aujourdhui))}
              >
                {n} sem.
              </button>
            )
          })}
          {!suivante && (
            <button
              type="button"
              style={{
                flex: 1.2,
                padding: '6px 0',
                fontSize: 'var(--t-legende)',
                fontWeight: !p.finPrevue ? 600 : 400,
                borderRadius: 'var(--rayon-2)',
                border: '1px solid ' + (!p.finPrevue ? `var(--phase-${p.phase})` : 'var(--bord)'),
                background: !p.finPrevue ? 'var(--bord)' : 'transparent',
                color: !p.finPrevue ? 'var(--texte)' : 'var(--texte-2)',
                cursor: 'pointer',
                textAlign: 'center',
              }}
              onClick={() => enregistrer(dureePhase(frise, p.debut, undefined, aujourdhui))}
            >
              Sans fin
            </button>
          )}
        </div>
      </div>

      {/* Date de début si premier */}
      {premier && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 'var(--t-petit)', color: 'var(--texte-2)' }}>Date de début</span>
          <input
            type="date"
            value={p.debut}
            min={minDebut}
            style={{ width: 'auto', padding: '4px 8px', fontSize: 'var(--t-petit)' }}
            onChange={(e) =>
              e.target.value && e.target.value >= (minDebut ?? '') && enregistrer(deplacerPhase(frise, p.debut, e.target.value))
            }
          />
        </div>
      )}

      {/* Objectif de poids (si pas maintien) */}
      {p.phase !== 'maintien' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 'var(--t-petit)', color: 'var(--texte-2)' }}>{p.phase === 'seche' ? 'Poids à perdre' : 'Poids à gagner'}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ChampNombre
                valeur={p.ecartVise}
                placeholder="—"
                largeur={60}
                signe
                onSaisie={(v) => setFrappe({ v })}
                onChange={(v) => {
                  setFrappe(null)
                  enregistrer(ecartPhase(frise, p.debut, v === undefined ? undefined : signe(v), aujourdhui))
                }}
              />
              <span style={{ fontSize: 'var(--t-petit)', color: 'var(--texte-2)' }}>kg</span>
            </div>
          </div>

          {/* Raccourcis +1, +2, +3 kg en petits tags fins */}
          <div style={{ display: 'flex', gap: 6 }}>
            {ECARTS[p.phase].map((x) => {
              const actif = ecart === x
              return (
                <button
                  key={x}
                  type="button"
                  style={{
                    padding: '3px 10px',
                    borderRadius: 999,
                    fontSize: 'var(--t-legende)',
                    fontWeight: actif ? 600 : 400,
                    background: actif ? 'var(--bord)' : 'transparent',
                    border: '1px solid ' + (actif ? `var(--phase-${p.phase})` : 'var(--bord)'),
                    color: actif ? 'var(--texte)' : 'var(--texte-2)',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    setFrappe(null)
                    enregistrer(ecartPhase(frise, p.debut, p.ecartVise === x ? undefined : x, aujourdhui))
                  }}
                >
                  {ecartTexte(x)}
                </button>
              )
            })}
          </div>

          {!!ecart && (
            <div style={{ fontSize: 'var(--t-legende)', color: 'var(--texte-2)' }} aria-live="polite">
              {vise !== null && depart !== null && <div>{kg(depart)} kg → {kg(vise)} kg visés</div>}
              {total ? (
                <>
                  <div>
                    {ecartTexte(ecart)} en {total} sem., soit {ecartTexte(rythmeParSemaine(ecart, total))} par semaine
                    {!avis && <span style={{ color: 'var(--ok)', fontWeight: 600 }}> : bon rythme</span>}
                  </div>
                  {avis && <div style={{ color: 'var(--alerte)', fontWeight: 500, marginTop: 2 }}>Rythme {avis}</div>}
                </>
              ) : (
                <div>Choisis une durée pour savoir si ce rythme est bon.</div>
              )}
            </div>
          )}
        </div>
      )}

      <ChampCalories p={p} frise={frise} aujourdhui={aujourdhui} enregistrer={enregistrer} />

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--voile)' }}>
        {enCours && p.debut < aujourdhui ? (
          <button
            type="button"
            className="btn discret petit"
            style={{ color: 'var(--accent)', fontSize: 'var(--t-legende)' }}
            onClick={terminer}
          >
            {suivante ? 'Passer à la phase suivante maintenant' : 'Terminer la phase'}
          </button>
        ) : (
          <button
            type="button"
            className="btn discret petit"
            style={{ color: 'var(--danger)', fontSize: 'var(--t-legende)' }}
            onClick={supprimer}
          >
            Supprimer cette phase
          </button>
        )}

        {onFermer && (
          <button
            type="button"
            className="btn discret petit"
            style={{ fontSize: 'var(--t-legende)' }}
            onClick={onFermer}
          >
            Fermer
          </button>
        )}
      </div>
    </div>
  )
}

/** Une phase passée : ligne compacte dans l'accordéon des phases archivées. */
function LignePassee({ p, pesees }: { p: PeriodePhase; pesees: Pesees }) {
  const depart = poidsDepart(pesees, p.debut)
  const arrivee = poidsSemaine(pesees, p.fin!)
  const fait = depart !== null && arrivee !== null ? Math.round((arrivee - depart) * 10) / 10 : null
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderRadius: 'var(--rayon-2)',
        background: 'var(--surface-2)',
        border: '1px solid var(--voile)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className={`point-phase phase-${p.phase}`} style={{ width: 8, height: 8 }} />
        <div>
          <span style={{ fontSize: 'var(--t-petit)', fontWeight: 600, color: 'var(--texte)' }}>{nomPhase(p.phase)}</span>
          <div style={{ fontSize: 'var(--t-legende)', color: 'var(--texte-2)' }}>
            {jour(p.debut)} → {jour(p.fin!)} · {semainesEntre(p.debut, plusJours(p.fin!, 1))} sem.
          </div>
        </div>
      </div>
      <div style={{ fontSize: 'var(--t-legende)', textAlign: 'right', color: 'var(--texte-2)' }}>
        {fait !== null
          ? `${kg(depart!)} → ${kg(arrivee!)} kg (${ecartTexte(fait)})`
          : p.ecartVise
            ? `visé ${ecartTexte(p.ecartVise)}`
            : ''}
      </div>
    </div>
  )
}
