import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ChevronRight, Pencil } from 'lucide-react'
import type { Catalogue } from '../catalogue'
import { db, setReglage } from '../db'
import { dateCourte, dateISO, kg, milliers } from '../lib/calc'
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
  ecartCourt,
  ecartTexte,
  finApres,
  finNouvellePhase,
  modifier,
  nomPhase,
  nomVise,
  ouEnEst,
  periodes,
  phaseA,
  PHASES,
  phasesPassees,
  poidsDepart,
  rythmeParSemaine,
  supprimerPhase,
  terminerPhase,
  typePhase,
  type EtapeObjectifs,
  type PeriodePhase,
  type Phase,
} from '../lib/objectifs'
import { recapPoids } from '../lib/recap'
import ChampNombre from './ChampNombre'
import { confirmer } from './Dialogues'
import Deplie from './Deplie'
import OuEnEst from './OuEnEst'
import { useRetour } from '../lib/nav'

const JOUR = 86400000
const jour = (iso: string) => dateCourte(iso).replace(/^\S+ /, '')
const plusJours = (iso: string, n: number) => dateISO(new Date(Date.parse(iso + 'T12:00:00') + n * JOUR))
const semainesEntre = (a: string, b: string) => Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / (7 * JOUR)))
/** Ce qu'on retrouve au retour du récap d'une phase ; `edition` : la phase vient d'être choisie depuis le récap, son formulaire s'ouvre. */
const memoire = { voirAvant: null as boolean | null, edition: false, allerPassees: false }
/** Assez peu de phases passées pour les montrer d'office : c'est ce qu'on vient chercher. */
const PASSEES_OUVERTES = 3

/** Le lien de Corps : la page s'ouvrira sur les phases précédentes, dépliées. */
export const voirPhasesPrecedentes = () => {
  memoire.voirAvant = true
  memoire.allerPassees = true
}
const DUREES = [4, 8, 12, 16]
const DUREE_DEFAUT: Record<Phase, number> = { prise: 12, seche: 8, maintien: 4 }
const ECARTS: Record<Phase, number[]> = { prise: [1, 2, 3], seche: [-2, -4, -6], maintien: [] }
type Pesees = { date: string; poids: number }[]

/** Phase finie : prolonger, ou passer à une autre. Depuis le récap comme depuis la page Phases, c'est le même choix. `type` : une autre phase a été choisie. */
export function SuitePhase({ catalogue, onChoix }: { catalogue: Catalogue; onChoix: (type?: Phase) => void }) {
  const frise = catalogue.objectifs
  const aujourdhui = dateISO()
  const enCours = phaseA(frise, aujourdhui)
  if (!enCours?.finPrevue) return null
  return (
    <div className="ligne wrap" style={{ gap: 8, marginTop: 8 }}>
      <button
        className="btn petit"
        onClick={() => {
          void setReglage(CLE_OBJECTIFS, dureePhase(frise, enCours.debut, dureeProlongee(enCours.debut, enCours.finPrevue!, aujourdhui), aujourdhui))
          onChoix()
        }}
      >
        Prolonger de 4 semaines
      </button>
      {PHASES.filter((x) => x.id !== enCours.phase).map((x) => (
        <button
          key={x.id}
          className="btn petit"
          onClick={() => {
            void setReglage(CLE_OBJECTIFS, modifier(frise, aujourdhui, { phase: x.id, finPrevue: finNouvellePhase(frise, aujourdhui, DUREE_DEFAUT[x.id]) }, catalogue.ciblesPerso))
            memoire.edition = true
            onChoix(x.id)
          }}
        >
          {x.vise}
        </button>
      ))}
    </div>
  )
}

/**
 * Phases en blocs (Corps → Phases) : dashboard épuré pour la phase en cours,
 * timeline pour les phases à venir, et historique des phases passées.
 */
export default function Phases({ catalogue, onRecap }: { catalogue: Catalogue; /** Ouvre le récap d'une phase. */ onRecap: (debut: string) => void }) {
  const frise = catalogue.objectifs
  const aujourdhui = dateISO()
  const pesees = useLiveQuery(() => db.pesees.toArray(), [], [])
  const [choixVoirAvant, setChoixVoirAvant] = useState(memoire.voirAvant)
  const setVoirAvant = (v: boolean) => {
    memoire.voirAvant = v
    setChoixVoirAvant(v)
  }
  const blocPassees = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!memoire.allerPassees) return
    memoire.allerPassees = false
    requestAnimationFrame(() => blocPassees.current?.scrollIntoView({ block: 'start' }))
  }, [])
  const [editionEnCours, setEditionEnCours] = useState(() => {
    const e = memoire.edition
    memoire.edition = false
    return e
  })
  const [ouverte, setOuverte] = useState<string | null>(null)
  // Le retour Android referme le formulaire ouvert et laisse sur la page « Ton objectif ».
  useRetour(editionEnCours, () => setEditionEnCours(false))
  useRetour(!!ouverte, () => setOuverte(null))

  const enregistrer = (f: EtapeObjectifs[]) => void setReglage(CLE_OBJECTIFS, f)
  const toutes = periodes(frise)
  const enCours = phaseA(frise, aujourdhui)
  const aVenir = toutes.filter((p) => p.debut > aujourdhui)
  const passees = phasesPassees(frise, aujourdhui)
  const voirAvant = choixVoirAvant ?? passees.length <= PASSEES_OUVERTES
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
  const etatEnCours = enCours ? ouEnEst(enCours, pesees, aujourdhui) : null
  const avisEnCours = enCours?.ecartVise && totalEnCours ? avisRythme(enCours.phase, enCours.ecartVise, totalEnCours) : null

  return (
    <>
      {enCours && finie && (
        <div className="carte pile rappel-phase" style={{ padding: '16px', borderRadius: 'var(--rayon)', marginBottom: 12 }}>
          <strong>
            Ton objectif « {nomVise(enCours.phase)} », prévu jusqu’au {jour(plusJours(enCours.finPrevue!, -1))}, est terminé.
          </strong>
          <button type="button" className="bilan-tous" onClick={() => onRecap(enCours.debut)}>
            <span>Voir le récap de cet objectif</span>
            <ChevronRight size={16} strokeWidth={1.75} className="muted" />
          </button>
          <SuitePhase catalogue={catalogue} onChoix={(type) => {
            if (!type) return
            memoire.edition = false
            setEditionEnCours(true)
          }} />
        </div>
      )}

      <div className="carte" style={{ padding: '16px', borderRadius: 'var(--rayon)' }}>
        {/* --- PHASE EN COURS --- */}
        {enCours && (
          <div>
            {!editionEnCours ? (
              /* Où en est ton poids, puis la carte d'avant : dates et poids visé en texte, calories sur la page, le crayon pour le reste. */
              <div className="sous-carte" style={{ marginBottom: aVenir.length || peutAjouter ? 16 : 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="ligne entre" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                  <strong>
                    {nomVise(enCours.phase)} <span className="mot-salle">{nomPhase(enCours.phase).toLowerCase()}</span>
                  </strong>
                  <button type="button" className="objectif-crayon" aria-label="Modifier l’objectif en cours" onClick={() => setEditionEnCours(true)}>
                    <Pencil size={16} strokeWidth={1.75} />
                  </button>
                </div>
                {etatEnCours && <OuEnEst etat={etatEnCours} debut={enCours.debut} finPrevue={enCours.finPrevue} />}
                <div className="faible petit-texte">
                  {enCours.depassee ? 'Fin dépassée' : `Semaine ${enCours.semaine}${totalEnCours ? ` sur ${totalEnCours}` : ''}`} · {enCours.finPrevue ? `du ${jour(enCours.debut)} au ${jour(plusJours(enCours.finPrevue, -1))}` : `depuis le ${jour(enCours.debut)}, sans fin prévue`}
                </div>
                {enCours.ecartVise && (
                  <div className="faible petit-texte">
                    {ecartTexte(enCours.ecartVise)} visés{totalEnCours ? ` · ${ecartTexte(Math.round((enCours.ecartVise / totalEnCours) * 100) / 100)} par semaine` : ''}
                  </div>
                )}
                <ChampCalories p={enCours} frise={frise} aujourdhui={aujourdhui} enregistrer={enregistrer} />

                {/* Le poids visé sort de la zone conseillée : un mot, en ambre (un réglage, pas ton corps). */}
                {avisEnCours && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
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
                  <strong style={{ fontSize: 'var(--t-texte)', color: 'var(--texte)' }}>Modifier « {nomVise(enCours.phase)} »</strong>
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
            <div className="demarrage-choix objectif-choix">
              {PHASES.slice()
                .sort((a, b) => ['prise', 'seche', 'maintien'].indexOf(a.id) - ['prise', 'seche', 'maintien'].indexOf(b.id))
                .map((x) => (
                  <button key={x.id} type="button" className="demarrage-option" onClick={() => commencer(x.id)}>
                    <strong>
                      {x.vise} <span className="mot-salle">{x.nom.toLowerCase()}</span>
                    </strong>
                    {x.aide && <span>{x.aide}</span>}
                  </button>
                ))}
              <button type="button" aria-pressed={!!catalogue.sansObjectif} className={catalogue.sansObjectif ? 'demarrage-option pris' : 'demarrage-option'} onClick={() => void setReglage(CLE_SANS_OBJECTIF, !catalogue.sansObjectif)}>
                <strong>Pas d’objectif pour l’instant</strong>
                <span>Tu t’entraînes, c’est tout</span>
              </button>
            </div>
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
                            {nomVise(p.phase)}
                          </div>
                          <div style={{ fontSize: 'var(--t-legende)', color: 'var(--texte-2)', marginTop: 2 }}>
                            Du {jour(p.debut)} {p.finPrevue ? `au ${jour(plusJours(p.finPrevue, -1))}` : ''}
                            {p.calories ? <div>{milliers(p.calories)} kcal par jour</div> : null}
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
                        <div style={{ fontSize: 'var(--t-petit)', fontWeight: 600, color: 'var(--texte)', marginBottom: 10 }}>{nomVise(p.phase)} (à venir)</div>
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
            <span className="faible petit-texte" style={{ width: '100%' }}>
              Et après ?
            </span>
            <div className="objectif-suite">
              {PHASES.filter((x) => x.id !== derniere!.phase).map((x) => (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => {
                    enregistrer(ajouterApres(frise, x.id, DUREE_DEFAUT[x.id], catalogue.ciblesPerso))
                    setOuverte(derniere!.finPrevue!)
                  }}
                >
                  + {x.vise}
                </button>
              ))}
            </div>
          </div>
        )}

        {derniere && !derniere.fin && !derniere.finPrevue && !editionEnCours && !ouverte && (
          <div className="faible" style={{ fontSize: 'var(--t-legende)', marginTop: 8 }}>
            Fixe une durée au dernier objectif pour pouvoir en ajouter un après.
          </div>
        )}

        {/* --- PHASES PRÉCÉDENTES --- */}
        {passees.length === 0 ? (
          <div className="phases-passees">
            <span className="phases-passees-titre">Objectifs précédents</span>
            <p className="faible petit-texte">Pas encore d’objectif terminé. Tu retrouveras ici le récap de chacun.</p>
          </div>
        ) : (
          <div ref={blocPassees} className="phases-passees">
            <button
              type="button"
              className="groupe-repli"
              onClick={() => setVoirAvant(!voirAvant)}
              aria-expanded={voirAvant}
              style={{ padding: '4px 0' }}
            >
              <span style={{ fontSize: 'var(--t-petit)' }}>
                Objectifs précédents <span className="faible">({passees.length})</span>
              </span>
              <ChevronRight size={16} className={'muted depliable-chevron' + (voirAvant ? ' ouvert' : '')} />
            </button>
            <Deplie ouvert={voirAvant}>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {passees.map((p) => (
                  <LignePassee key={p.debut} p={p} pesees={pesees} onOuvrir={() => onRecap(p.debut)} />
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
      await confirmer(suivante ? 'Les objectifs suivants avancent d’autant.' : p.debut === aujourdhui ? 'Il a commencé aujourd’hui : rien n’en sera gardé.' : 'Il n’a pas encore commencé.', {
        titre: `Supprimer l’objectif « ${nomVise(p.phase)} » ?`,
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
        suivante ? 'L’objectif suivant commence aujourd’hui, les autres avancent d’autant.' : 'Tu n’auras plus d’objectif en cours.',
        {
          titre: `Terminer « ${nomVise(p.phase)} » aujourd’hui ?`,
          oui: suivante ? 'Passer au suivant' : 'Terminer cet objectif',
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
        <div className="segments" role="radiogroup" aria-label="Type d’objectif">
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
        <div style={{ fontSize: 'var(--t-legende)', color: 'var(--texte-2)', marginBottom: 6 }}>Durée</div>
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
            {suivante ? 'Passer à l’objectif suivant maintenant' : 'Terminer cet objectif'}
          </button>
        ) : (
          <button
            type="button"
            className="btn discret petit"
            style={{ color: 'var(--danger)', fontSize: 'var(--t-legende)' }}
            onClick={supprimer}
          >
            Supprimer cet objectif
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
function LignePassee({ p, pesees, onOuvrir }: { p: PeriodePhase; pesees: Pesees; onOuvrir: () => void }) {
  const poids = recapPoids(pesees, p.debut, p.fin!)
  const autreAnnee = p.fin!.slice(0, 4) !== dateISO().slice(0, 4)
  return (
    <button
      type="button"
      onClick={onOuvrir}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '8px 12px',
        minHeight: 'var(--cible)',
        borderRadius: 'var(--rayon-2)',
        background: 'var(--surface-2)',
        border: '1px solid var(--voile)',
        color: 'inherit',
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className={`point-phase phase-${p.phase}`} style={{ width: 8, height: 8 }} />
        <div>
          <span style={{ fontSize: 'var(--t-petit)', fontWeight: 600, color: 'var(--texte)' }}>{nomVise(p.phase)}</span>
          <div style={{ fontSize: 'var(--t-legende)', color: 'var(--texte-2)' }}>
            {jour(p.debut)} → {jour(p.fin!)}{autreAnnee ? ` ${p.fin!.slice(0, 4)}` : ''} · {semainesEntre(p.debut, plusJours(p.fin!, 1))} sem.
          </div>
        </div>
      </div>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--t-legende)', textAlign: 'right', color: 'var(--texte-2)' }}>
        {poids ? <strong style={{ color: 'var(--texte)', fontSize: 'var(--t-petit)' }}>{ecartCourt(poids.ecart)} kg</strong> : ''}
        <ChevronRight size={16} strokeWidth={1.75} className="muted" style={{ flex: 'none' }} />
      </span>
    </button>
  )
}
