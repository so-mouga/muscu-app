import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import type { Catalogue, EntreePlanning } from '../catalogue'
import { db, dernierPoids, exoAvecReglages, historiqueDe, uid } from '../db'
import { chargeQte, dateISO, duree, dureeTexte, estDure, jourSemaine, lundi } from '../lib/calc'
import { creneauxFaits, dureeReelle, recordsParSeance } from '../lib/historique'
import { hausse, suggestionPour } from '../lib/progression'
import { nomPhase, phaseAffichee } from '../lib/objectifs'
import { debloquerSon } from '../lib/appareil'
import { transition, useRetour } from '../lib/nav'
import FormActivite from '../components/FormActivite'
import JournalMatin from '../components/JournalMatin'
import { typeActivite } from '../data/activites'
import { BandeauCycle, BilanCycle } from '../components/Cycle'
import { etatCycle, planDeload } from '../lib/cycle'
import Apercu from './Apercu'
import type { Programme, SeanceModele } from '../types'
import { informer } from '../components/Dialogues'
import { echauffementDe } from '../data/echauffements'

const JOURS = ['', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']
const exercices = (n: number) => `${n} exercice${n > 1 ? 's' : ''}`

/** Sans modèle : séance libre, les exercices s'ajoutent à la volée. */
/** Contexte du cycle au démarrage : semaine en cours et déload éventuel. */
type ContexteCycle = { cycleId: string; semaine?: number; deload: boolean }

async function demarrer(modele?: SeanceModele, cycle?: ContexteCycle, echauffement: string[] = []) {
  try {
    await creerSeance(modele, cycle, echauffement)
  } catch (e) {
    void informer(`${(e as Error).message}\n(version ${__VERSION__})`, 'Impossible de démarrer la séance')
  }
}

async function creerSeance(modele: SeanceModele | undefined, cycle: ContexteCycle | undefined, echauffement: string[]) {
  debloquerSon()
  const deload = !!(modele && cycle?.deload)
  await db.seances.add({
    ...(cycle && { cycleId: cycle.cycleId, semaine: cycle.semaine }),
    ...(deload && { deload: true }),
    ...(echauffement.length && { echauffement: { ids: echauffement, faits: [] } }),
    id: uid(),
    date: dateISO(),
    modeleId: modele?.id,
    nom: modele?.nom ?? 'Séance libre',
    sousTitre: modele?.sousTitre ?? 'exercices au choix',
    // Déload : plan allégé (moitié des séries, RPE 6-7, sans finisseur).
    exercices: structuredClone(modele?.exercices ?? []).map((p) => (deload ? planDeload(p) : p)),
    debut: Date.now(),
    enCours: true,
    poidsCorps: await dernierPoids(),
    chauffes: {},
    series: [],
    notes: {},
    ajustSeries: {},
  })
}

export default function Accueil({
  catalogue,
  onVoirSeance,
  onMesures,
  onBilan,
  onProgrammes,
}: {
  catalogue: Catalogue
  onVoirSeance: (id: string) => void
  onMesures: () => void
  /** Ouvre Progression → Bilan. */
  onBilan: () => void
  /** Ouvre l'onglet Programmes (gestion du cycle). */
  onProgrammes: () => void
}) {
  const [bilan, setBilan] = useState(false)
  const [choix, setChoix] = useState(false)
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [apercu, setApercuEtat] = useState<SeanceModele | null>(null)
  const derniereMesure = useLiveQuery(() => db.mesures.orderBy('date').last(), [])
  const [activite, setActivite] = useState(false)
  // Rappels masqués par l'utilisateur : réapparaissent au bout d'une semaine.
  const [masques, setMasques] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem('rappelsMasques') ?? '{}')
    } catch {
      return {}
    }
  })
  const masque = (cle: string) => Date.now() - (masques[cle] ?? 0) < 7 * 86400000
  const masquer = (cle: string) => {
    const m = { ...masques, [cle]: Date.now() }
    setMasques(m)
    try {
      localStorage.setItem('rappelsMasques', JSON.stringify(m))
    } catch {
      /* stockage indisponible */
    }
  }
  useRetour(choix, () => setChoix(false))
  const voir = (m: SeanceModele | null) => {
    setChoix(false)
    transition(() => setApercuEtat(m && catalogue.pourDemarrer(m)), m ? 'avant' : 'arriere')
    window.scrollTo({ top: 0 })
  }
  const debutSemaine = lundi()
  const activitesSemaine = useLiveQuery(() => db.activites.where('date').aboveOrEqual(debutSemaine).sortBy('date'), [debutSemaine], [])
  const semaine = useLiveQuery(
    () => db.seances.where('date').aboveOrEqual(debutSemaine).filter((s) => !s.enCours).toArray(),
    [debutSemaine],
    []
  )
  const dernierExport = useLiveQuery(() => db.reglages.get('dernierExport'), [])
  const nbSeances = useLiveQuery(() => db.seances.count(), [], 0)
  const terminees = useLiveQuery(() => db.seances.filter((s) => !s.enCours).toArray(), [])
  const reglages = useLiveQuery(() => db.reglages.toArray(), [], [])

  const { planning, actif } = catalogue
  // Séances faites cette semaine pour un modèle (sa variante maison compte aussi).
  const realisees = (m: SeanceModele) =>
    semaine.filter((s) => s.modeleId === m.id || catalogue.modele(s.modeleId)?.varianteDe === m.id).length
  // Chaque séance faite coche le créneau le plus proche de son jour (une séance peut revenir deux fois).
  const idPlanning = (id?: string) => planning.find((e) => e.modele.id === id || catalogue.modele(id)?.varianteDe === e.modele.id)?.modele.id
  const coches = creneauxFaits(
    planning.map((e) => ({ id: e.modele.id, jour: e.jour })),
    semaine.flatMap((s) => {
      const id = idPlanning(s.modeleId)
      return id ? [{ id, jour: jourSemaine(new Date(s.date + 'T12:00:00')) }] : []
    })
  )
  const faite = (e: EntreePlanning) => coches.has(planning.indexOf(e))
  const jour = jourSemaine()
  const duJour = planning.find((e) => e.jour === jour)
  const prochaine = planning.find((e) => !faite(e) && e.jour >= jour) ?? planning.find((e) => !faite(e))
  const variante = duJour && catalogue.modeles.find((m) => m.varianteDe === duJour.modele.id)
  const proposee = duJour && !faite(duJour) ? duJour : prochaine
  const seancesDe = (p: Programme) => [...new Set(p.seances.map((e) => e.modeleId))].map((id) => catalogue.modele(id)).filter((m) => !!m)
  // Programme actif en tête, puis les autres ; les séances d'aucun programme à la fin.
  const programmes = [actif, ...catalogue.programmes.filter((p) => p.id !== actif.id)]
  const dansUnProgramme = new Set(catalogue.programmes.flatMap((p) => p.seances.map((e) => e.modeleId)))
  const horsProgramme = catalogue.modeles.filter((m) => !dansUnProgramme.has(m.id))
  const groupeOuvert = ouvert ?? actif.id

  const derniere = terminees?.reduce<(typeof terminees)[number] | undefined>((a, s) => (!a || s.debut > a.debut ? s : a), undefined)

  // Exercices où l'objectif dépasse la dernière fois : « à battre », avec la série visée et ce qu'elle demande de plus.
  const recentes = terminees && [...terminees].filter((s) => !s.deload).sort((a, b) => b.debut - a.debut)
  const aBattreDe = (m: SeanceModele) =>
    recentes
      ? m.exercices.flatMap((p) => {
          const exo = exoAvecReglages(catalogue.exo(p.exoId), reglages)
          const sugg = suggestionPour(exo, p, recentes)
          const der = historiqueDe(recentes, p.exoId)[0]
          const i = sugg.charges.findIndex((_, k) => hausse(exo, sugg, der, k) !== null)
          return i < 0 ? [] : [{ exo, cible: chargeQte(exo, sugg.charges[i], sugg.reps[i]), plus: hausse(exo, sugg, der, i)! }]
        })
      : []

  const phase = phaseAffichee(catalogue.objectifs, dateISO())

  // Cycle en cours : semaine, déload, pause ; chaque séance lancée y est rattachée.
  const cycle = catalogue.cycle
  const etat = cycle && etatCycle(cycle)
  const contexte: ContexteCycle | undefined =
    cycle && etat ? { cycleId: cycle.id, semaine: etat.n >= 1 && !etat.fini && !etat.pause ? etat.n : undefined, deload: etat.deload } : undefined
  const lancer = (m?: SeanceModele) => demarrer(m && catalogue.pourDemarrer(m), contexte, m ? echauffementDe(m, catalogue.exo) : [])
  const bandeauCycleVisible = !!(cycle && etat && (etat.fini || etat.deload || etat.pause || etat.n <= 0))
  const sousTitreProg =
    cycle && etat && etat.n >= 1 && !etat.fini
      ? `${cycle.programme.nom} · ${etat.pause ? 'en pause' : `Semaine ${etat.n}/${etat.total}${etat.deload ? ' (déload)' : ''}`}`
      : actif.nom
  const duresSemaine = semaine.reduce((a, s) => a + s.series.filter(estDure).length, 0)
  const recordsSemaine = terminees
    ? (() => {
        const recs = recordsParSeance(terminees, catalogue.exo)
        return semaine.reduce((a, s) => a + (recs[s.id] ?? 0), 0)
      })()
    : 0

  if (apercu) return <Apercu modele={apercu} catalogue={catalogue} deload={!!etat?.deload} onDemarrer={() => lancer(apercu)} onFermer={() => voir(null)} />

  // Rappel des mensurations : seulement après 3 semaines sans en prendre.
  const joursMesure = derniereMesure ? Math.floor((Date.now() - Date.parse(derniereMesure.date + 'T12:00:00')) / 86400000) : null
  const mesuresEnRetard = nbSeances > 0 && (joursMesure === null || joursMesure > 21)

  const exportVieux =
    nbSeances > 0 && (!dernierExport || Date.now() - (dernierExport.valeur as number) > 7 * 86400000)

  return (
    <div>
      <div className="entete">
        <div>
          <h1 style={{ textTransform: 'capitalize' }}>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</h1>
          {phase && (
            <div className="phase-accueil">
              <span className={`point-phase phase-${phase.phase}`} />
              {phase.aVenir
                ? `${phase.enCours ? `${nomPhase(phase.enCours.phase)} · ` : ''}${nomPhase(phase.phase).toLowerCase()} à partir du ${new Date(phase.debut + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}`
                : `${nomPhase(phase.phase)} · semaine ${phase.semaine}${phase.total ? ` sur ${phase.total}` : ''}`}
            </div>
          )}
          <button type="button" className="btn discret petit lien-action" style={{ color: 'var(--texte-3)', marginTop: 2 }} onClick={onProgrammes}>
            {sousTitreProg} ›
          </button>
        </div>
      </div>

      {bilan && cycle && <BilanCycle cycle={cycle} catalogue={catalogue} onFermer={() => setBilan(false)} />}

      {/* La séance d'abord : c'est l'action principale de l'écran. */}
      <div className="carte pile">
        {bandeauCycleVisible && cycle && etat && <BandeauCycle cycle={cycle} etat={etat} onBilan={() => setBilan(true)} onProgrammes={onProgrammes} />}
        {duJour && faite(duJour) && <div className="pastille ok">✓ {duJour.modele.nom} faite aujourd’hui</div>}
        {!duJour && <div className="muted">Repos prévu aujourd’hui.</div>}
        {proposee ? (
          <>
            <div>
              <div className="faible">{proposee === duJour ? 'Séance du jour' : `Prochaine · prévue ${JOURS[proposee.jour!]}`}</div>
              <h2>
                {proposee.modele.nom} {proposee.modele.sousTitre && <span className="muted">— {proposee.modele.sousTitre}</span>}
              </h2>
              <div className="faible">
                {exercices(proposee.modele.exercices.length)} · {dureeTexte(proposee.modele, terminees)}
              </div>
              {!etat?.deload &&
                (() => {
                  const l = aBattreDe(proposee.modele)
                  if (!l.length) return null
                  return (
                    <div className="a-battre">
                      <div className="badge-hausse grand">🔥 À battre {proposee === duJour ? 'aujourd’hui' : 'à la prochaine'}</div>
                      {l.slice(0, 3).map((x) => (
                        <div key={x.exo.id} className="ligne-battre">
                          <span>{x.exo.nom}</span>
                          <span>
                            <strong>{x.cible}</strong> <span className="plus">{x.plus}</span>
                          </span>
                        </div>
                      ))}
                      {l.length > 3 && <div className="faible">+ {l.length - 3} autre{l.length > 4 ? 's' : ''}</div>}
                    </div>
                  )
                })()}
            </div>
            <div className="ligne">
              <button className="btn primaire grand" style={{ flex: 2 }} onClick={() => lancer(proposee.modele)}>
                Démarrer
              </button>
              <button className="btn grand" style={{ flex: 1 }} onClick={() => voir(proposee.modele)}>
                Voir
              </button>
            </div>
          </>
        ) : (
          <div>Semaine complète 💪</div>
        )}
        <div className="ligne wrap" style={{ justifyContent: 'space-around', borderTop: '1px solid var(--bord)', paddingTop: 6, marginTop: 4 }}>
          <button className="btn discret petit lien-action" onClick={() => setChoix(true)}>
            Autre séance ›
          </button>
          <button className="btn discret petit lien-action" onClick={() => setActivite(true)}>
            + Activité
          </button>
          {variante && proposee === duJour && (
            <button className="btn discret petit lien-action" onClick={() => voir(variante)}>
              🏠 Pas de salle
            </button>
          )}
        </div>
      </div>

      {/* Journal du matin : de quoi se mettre en route (pesée, sommeil, calories, un vrai progrès). */}
      <JournalMatin catalogue={catalogue} terminees={terminees} entrainement={!!duJour} onCorps={onMesures} />

      {/* Rappels sous la séance, sur une ligne, masquables une semaine. */}
      {mesuresEnRetard && !masque('mesures') && (
        <div className="rappel-ligne">
          <button className="texte" onClick={onMesures}>
            📏 {derniereMesure ? 'Reprendre tes mensurations' : 'Prendre tes premières mensurations'}
            {joursMesure !== null && <span className="faible"> · il y a {joursMesure} j</span>} ›
          </button>
          <button className="fermer-rappel" aria-label="Masquer ce rappel une semaine" onClick={() => masquer('mesures')}>
            ✕
          </button>
        </div>
      )}
      {exportVieux && !masque('export') && (
        <div className="rappel-ligne">
          <span>💾 Exporte tes données (Réglages) : elles ne sont que sur ce téléphone.</span>
          <button className="fermer-rappel" aria-label="Masquer ce rappel une semaine" onClick={() => masquer('export')}>
            ✕
          </button>
        </div>
      )}

      <div className="carte">
        <div className="ligne entre" style={{ marginBottom: 10 }}>
          <h3>Cette semaine</h3>
          <span className="faible">
            {/* Séances prévues faites ; les autres (doublon, séance libre) à part. */}
            Prévues {planning.filter(faite).length}/{planning.length}
            {semaine.length > planning.filter(faite).length && ` · +${semaine.length - planning.filter(faite).length} autre${semaine.length - planning.filter(faite).length > 1 ? 's' : ''}`}
          </span>
        </div>
        <div className="ligne wrap">
          {planning.map((e) => (
            <button key={e.modele.id + e.jour} className={'pastille cliquable' + (faite(e) ? ' ok' : e.jour === jour ? ' accent' : '')} onClick={() => voir(e.modele)}>
              {JOURS[e.jour]} · {e.modele.nom} {faite(e) ? '✓' : ''}
            </button>
          ))}
          {activitesSemaine.map((a) => (
            <span key={a.id} className="pastille activite">
              {JOURS[jourSemaine(new Date(a.date + 'T12:00:00'))]} · {typeActivite(a.type).emoji} {typeActivite(a.type).nom}
            </span>
          ))}
        </div>
        {(semaine.length > 0 || activitesSemaine.length > 0) && (
          <button
            className="ligne-jour"
            style={{ marginTop: 12, paddingTop: 10, paddingBottom: derniere ? 10 : 0, borderTop: '1px solid var(--bord)', borderBottom: 'none' }}
            onClick={onBilan}
          >
            <span className="faible" style={{ minWidth: 0 }}>
              Bilan ·{' '}
              <strong style={{ color: 'var(--texte)' }}>
                {semaine.length} séance{semaine.length > 1 ? 's' : ''}
              </strong>
              {duresSemaine > 0 && ` · ${duresSemaine} série${duresSemaine > 1 ? 's' : ''} dure${duresSemaine > 1 ? 's' : ''}`}
              {recordsSemaine > 0 && ` · 🏆 ${recordsSemaine}`}
              {activitesSemaine.length > 0 && ` · +${activitesSemaine.length} sport${activitesSemaine.length > 1 ? 's' : ''}`}
            </span>
            <span className="muted">›</span>
          </button>
        )}
        {derniere && (
          <button className="ligne-jour" style={{ marginTop: semaine.length > 0 || activitesSemaine.length > 0 ? 0 : 12, paddingTop: 10, paddingBottom: 0, borderTop: '1px solid var(--bord)', borderBottom: 'none' }} onClick={() => onVoirSeance(derniere.id)}>
            <span style={{ minWidth: 0 }}>
              <span className="faible">Dernière · </span>
              <strong>{derniere.nom}</strong>{' '}
              <span className="faible">
                · {new Date(derniere.debut).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} · {duree(dureeReelle(derniere))}
              </span>
            </span>
            <span className="muted">›</span>
          </button>
        )}
      </div>


      {activite && <FormActivite onFermer={() => setActivite(false)} />}
      {choix && (
        <div className="modal-fond" onClick={() => setChoix(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: 12 }}>Choisir une séance</h2>
            {[...programmes.map((p) => ({ id: p.id, nom: p.nom, actif: p.id === actif.id, prog: p, seances: seancesDe(p) })), ...(horsProgramme.length ? [{ id: 'hors', nom: 'Hors programme', actif: false, prog: null, seances: horsProgramme }] : [])].map((g) => (
              <div key={g.id}>
                <button className="groupe-repli" onClick={() => setOuvert(groupeOuvert === g.id ? '' : g.id)} aria-expanded={groupeOuvert === g.id}>
                  <span>
                    {g.nom} {g.actif && <span className="pastille ok" style={{ marginLeft: 4 }}>actif</span>} <span className="nb">({g.seances.length})</span>
                  </span>
                  <span className="muted">{groupeOuvert === g.id ? '▾' : '▸'}</span>
                </button>
                {groupeOuvert === g.id &&
                  g.seances.map((m) => {
                    const jours = g.prog ? g.prog.seances.filter((e) => e.modeleId === m.id && e.jour).map((e) => JOURS[e.jour!]) : []
                    return (
                      <button key={m.id} className="liste-btn" onClick={() => voir(m)}>
                        <span>
                          <strong>{m.nom}</strong> {m.sousTitre && <span className="muted">— {m.sousTitre}</span>}
                          <div className="faible">{dureeTexte(m, terminees)}</div>
                        </span>
                        <span className="faible">{realisees(m) ? '✓' : jours.join(', ')}</span>
                      </button>
                    )
                  })}
              </div>
            ))}
            <div style={{ height: 8 }} />
            <button className="liste-btn" onClick={() => lancer()}>
              <span>
                <strong>Séance libre</strong> <span className="muted">— exercices ajoutés au fur et à mesure</span>
              </span>
              <span className="faible">+</span>
            </button>
            <button className="btn discret plein" onClick={() => setChoix(false)}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
