import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import type { Catalogue, EntreePlanning } from '../catalogue'
import { db, dernierPoids, exoAvecReglages, historiqueDe, uid } from '../db'
import { chargeQte, dateISO, duree, dureeTexte, estDure, jourSemaine, lundi } from '../lib/calc'
import { creneauxFaits, dureeReelle, recordsParSeance } from '../lib/historique'
import { hausse, suggestionPour } from '../lib/progression'
import { nomPhase, phaseAffichee } from '../lib/objectifs'
import { debloquerSon } from '../lib/appareil'
import { transition, useRetour } from '../lib/nav'
import JournalMatin from '../components/JournalMatin'
import { typeActivite } from '../data/activites'
import { BandeauCycle, BilanCycle } from '../components/Cycle'
import { etatCycle, planDeload } from '../lib/cycle'
import { deloadConseille } from '../lib/blocages'
import Apercu from './Apercu'
import type { Programme, SeanceModele } from '../types'
import { informer } from '../components/Dialogues'
import ChoixProgramme from '../components/ChoixProgramme'
import IconeOnglet from '../components/IconeOnglet'
import { joursSansSeance, semainesTenues, seuilSemaine } from '../lib/motivation'
import { nouvelleVersionAndroid, seanceDuJourNatif } from '../lib/natif'
import { CATEGORIES_COURANTES, sauvegarder } from '../lib/sauvegarde'
import { echauffementDe } from '../data/echauffements'

const JOURS = ['', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']

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
  void seanceDuJourNatif(dateISO())
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
  onReglages,
  onBilan,
  onProgrammes,
}: {
  catalogue: Catalogue
  onVoirSeance: (id: string) => void
  onMesures: () => void
  /** Ouvre les Réglages (⚙). */
  onReglages: () => void
  /** Ouvre Progression → Bilan. */
  onBilan: () => void
  /** Ouvre l'onglet Programmes (gestion du cycle). */
  onProgrammes: () => void
}) {
  const [bilan, setBilan] = useState(false)
  const [choix, setChoix] = useState(false)
  const [ouvert, setOuvert] = useState<string | null>(null)
  // Retour d'une séance annulée ou supprimée qu'on avait lancée depuis « Voir » : on y revient.
  const [apercu, setApercuEtat] = useState<SeanceModele | null>(() => {
    try {
      const o = JSON.parse(localStorage.getItem('retourSeance') ?? 'null') as { apercu?: string } | null
      localStorage.removeItem('retourSeance')
      const m = o?.apercu ? catalogue.modele(o.apercu) : undefined
      return m ? catalogue.pourDemarrer(m) : null
    } catch {
      return null
    }
  })
  const derniereMesure = useLiveQuery(() => db.mesures.orderBy('date').last(), [])
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
  const cycles = useLiveQuery(() => db.cycles.toArray(), [], [])
  // Appli Android : un APK plus récent publié ? (le site, lui, se met à jour tout seul)
  const [majAndroid, setMajAndroid] = useState<{ version: string; url: string } | null>(null)
  useEffect(() => void nouvelleVersionAndroid().then(setMajAndroid), [])
  // Toute première ouverture : pas encore de programme à soi ni de séance, on propose d'en choisir un.
  const nbProgrammes = useLiveQuery(() => db.programmes.count(), [], null)
  const premiereFois = nbProgrammes === 0 && terminees?.length === 0
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
  // On retient d'où la séance est lancée (accueil, ou « Voir ») pour y revenir si on l'annule.
  const lancer = (m?: SeanceModele, depuisApercu = false) => {
    try {
      localStorage.setItem('retourSeance', JSON.stringify(depuisApercu && m ? { apercu: m.id } : {}))
    } catch {
      /* stockage indisponible */
    }
    return demarrer(m && catalogue.pourDemarrer(m), contexte, m ? echauffementDe(m) : [])
  }
  const bandeauCycleVisible = !!(cycle && etat && (etat.fini || etat.deload || etat.pause || etat.n <= 0))
  const duresSemaine = semaine.reduce((a, s) => a + s.series.filter(estDure).length, 0)
  const recordsSemaine = terminees
    ? (() => {
        const recs = recordsParSeance(terminees, catalogue.exo)
        return semaine.reduce((a, s) => a + (recs[s.id] ?? 0), 0)
      })()
    : 0

  // Échauffement activé depuis « Voir » : enregistré sur la séance (comme dans Programmes) et pris en compte tout de suite.
  const changerEchauffement = (v: SeanceModele['echauffement']) => {
    if (!apercu) return
    const base = catalogue.modele(apercu.id)
    const avec = <T extends SeanceModele>(m: T): T => {
      const c = structuredClone(m)
      if (v === undefined) delete c.echauffement
      else c.echauffement = v
      return c
    }
    if (base) void db.modeles.put(avec(base))
    // Pendant un cycle, la séance lancée est sa copie : elle suit aussi (sinon le réglage serait oublié).
    const c = catalogue.cycle
    if (c?.modeles.some((m) => m.id === apercu.id)) void db.cycles.update(c.id, { modeles: c.modeles.map((m) => (m.id === apercu.id ? avec(m) : m)) })
    setApercuEtat(avec(apercu))
  }
  if (apercu) return <Apercu modele={apercu} catalogue={catalogue} deload={!!etat?.deload} onDemarrer={() => lancer(apercu, true)} onEchauffement={changerEchauffement} onFermer={() => voir(null)} />

  // Rappel des mensurations : seulement après 3 semaines sans en prendre.
  const joursMesure = derniereMesure ? Math.floor((Date.now() - Date.parse(derniereMesure.date + 'T12:00:00')) / 86400000) : null
  const mesuresEnRetard = nbSeances > 0 && (joursMesure === null || joursMesure > 21)

  const joursExport = dernierExport ? Math.floor((Date.now() - (dernierExport.valeur as number)) / 86400000) : null
  const exportVieux = nbSeances > 0 && (joursExport === null || joursExport >= 7)
  // Déload à avancer : seulement pendant une semaine de travail du cycle (le bouton est dans le cycle).
  const deloadPlusTot = cycle && etat && etat.n >= 1 && !etat.fini && !etat.deload && !etat.pause && terminees ? deloadConseille(terminees, catalogue.exo, dateISO()) : null
  const sauvegarderTout = async () => {
    try {
      await sauvegarder(CATEGORIES_COURANTES)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') void informer((e as Error).message, 'Sauvegarde impossible')
    }
  }

  return (
    <div>
      <div className="entete">
        <div>
          <h1 style={{ textTransform: 'capitalize', fontSize: '1.4rem', fontWeight: 800, margin: '0 0 2px', letterSpacing: '-0.3px' }}>
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h1>
          {phase && !bandeauCycleVisible && (
            <div className="phase-accueil">
              <span className={`point-phase phase-${phase.phase}`} />
              <span>
                {phase.aVenir
                  ? `${phase.enCours ? `${nomPhase(phase.enCours.phase)} · ` : ''}${nomPhase(phase.phase).toLowerCase()} à partir du ${new Date(phase.debut + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}`
                  : `${nomPhase(phase.phase)} · sem. ${phase.semaine}${phase.total ? `/${phase.total}` : ''}`}
              </span>
            </div>
          )}
        </div>
        <button type="button" className="btn-reglages" onClick={onReglages} aria-label="Réglages">
          <IconeOnglet nom="reglages" />
        </button>
      </div>

      {bilan && cycle && <BilanCycle cycle={cycle} catalogue={catalogue} onFermer={() => setBilan(false)} />}

      {/* En haut, sur une ligne : nouvelle version de l'appli Android, sauvegarde à faire (rares, et ce qu'on perdrait). */}
      {majAndroid && !masque('android') && (
        <div className="rappel-ligne">
          {/* Le téléchargement s'ouvre dans le navigateur du téléphone ; on installe par-dessus, les données restent. */}
          <a className="texte" href={majAndroid.url}>
            📲 Nouvelle version de l’appli ({majAndroid.version}) : installer
            <span className="faible"> · tes données sont gardées</span> ›
          </a>
          <button className="fermer-rappel" aria-label="Masquer ce rappel une semaine" onClick={() => masquer('android')}>
            ✕
          </button>
        </div>
      )}
      {exportVieux && !masque('export') && (
        <div className="rappel-ligne">
          <button className="texte" onClick={sauvegarderTout}>
            💾 Sauvegarder (Drive, mail…)
            <span className="faible"> · {joursExport === null ? 'jamais fait' : `dernière il y a ${joursExport} j`}</span> ›
          </button>
          <button className="fermer-rappel" aria-label="Masquer ce rappel une semaine" onClick={() => masquer('export')}>
            ✕
          </button>
        </div>
      )}

      {premiereFois && (
        <ChoixProgramme
          catalogue={catalogue}
          titre="Pour commencer, choisis ton programme"
          intro="Tu pourras tout modifier ensuite (exercices, séries, jours) dans l’onglet Programmes. Les charges se règlent pendant ta 1re séance."
        />
      )}

      {/* La séance d'abord : c'est l'action principale de l'écran. */}
      {!premiereFois && (
      <div className="carte pile">
        {bandeauCycleVisible && cycle && etat && <BandeauCycle cycle={cycle} etat={etat} onBilan={() => setBilan(true)} onProgrammes={onProgrammes} />}
        {duJour && faite(duJour) && <div className="pastille ok">✓ {duJour.modele.nom} faite aujourd’hui</div>}
        {!duJour && <div className="muted">Repos prévu aujourd’hui.</div>}
        {proposee ? (
          <>
            <div>
              <div className="faible">{proposee === duJour ? 'Séance du jour' : `Prochaine · prévue ${JOURS[proposee.jour!]}`}</div>
              <h2 style={{ margin: '2px 0 0' }}>{proposee.modele.nom}</h2>
              {proposee.modele.sousTitre && (
                <div className="faible" style={{ fontSize: '0.95rem', margin: '2px 0 6px' }}>
                  {proposee.modele.sousTitre}
                </div>
              )}
              {(() => {
                // Retour après un trou : pas de reproche, on reprend où on en était.
                const n = terminees ? joursSansSeance(terminees, dateISO()) : null
                return n !== null && n >= 10 ? (
                  <div className="faible" style={{ margin: '4px 0 6px' }}>
                    Première séance depuis {n} jours : mêmes charges que la dernière fois, baisse un peu si c’est trop dur.
                  </div>
                ) : null
              })()}
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
        ) : planning.length > 0 ? (
          <>
            <div>Semaine complète 💪 Tout ce que tu fais en plus est du bonus.</div>
            <button className="btn primaire grand" onClick={() => setChoix(true)}>
              Démarrer une séance
            </button>
          </>
        ) : (
          <>
            <div className="muted">Aucune séance planifiée dans ce programme.</div>
            <div className="ligne">
              <button className="btn primaire grand" onClick={() => setChoix(true)}>
                Choisir une séance
              </button>
              <button className="btn grand" onClick={onProgrammes}>
                Planifier
              </button>
            </div>
          </>
        )}
        <div className="ligne actions-accueil">
          {proposee && (
            <button type="button" className="btn texte lien-discret" onClick={() => setChoix(true)}>
              Choisir une autre séance ›
            </button>
          )}
          {variante && proposee === duJour && (
            <button type="button" className="btn texte lien-discret" onClick={() => voir(variante)}>
              🏠 Pas de salle ›
            </button>
          )}
        </div>
      </div>
      )}

      {/* Journal du matin : de quoi se mettre en route (pesée, sommeil, calories, un vrai progrès). */}
      {!premiereFois && <JournalMatin catalogue={catalogue} terminees={terminees} entrainement={!!duJour} deload={!!etat?.deload && !etat.pause} onCorps={onMesures} />}

      {/* Rappels sous la séance, sur une ligne, masquables une semaine. */}
      {deloadPlusTot && !masque('deload') && (
        <div className="rappel-ligne">
          <button className="texte" onClick={onProgrammes}>
            🧘 Force en baisse sur {deloadPlusTot.baisses.length} exercices{deloadPlusTot.energieBasse ? ' et énergie basse' : ''} : un déload cette semaine ?
            <span className="faible"> · {deloadPlusTot.baisses.slice(0, 3).map((e) => e.nom).join(', ')}</span> ›
          </button>
          <button className="fermer-rappel" aria-label="Masquer ce rappel une semaine" onClick={() => masquer('deload')}>
            ✕
          </button>
        </div>
      )}
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

      {!premiereFois && (
      <div className="carte">
        <div className="ligne entre" style={{ marginBottom: 10 }}>
          <h3>Cette semaine</h3>
          <span className="faible">
            {/* Séances prévues faites ; les autres (doublon, séance libre) à part. Sans planning : juste le nombre fait. */}
            {planning.length ? (
              <>
                Prévues {planning.filter(faite).length}/{planning.length}
                {semaine.length > planning.filter(faite).length && ` · +${semaine.length - planning.filter(faite).length} autre${semaine.length - planning.filter(faite).length > 1 ? 's' : ''}`}
              </>
            ) : (
              semaine.length > 0 && `${semaine.length} séance${semaine.length > 1 ? 's' : ''} faite${semaine.length > 1 ? 's' : ''}`
            )}
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
          {(() => {
            // Semaines tenues (les trois quarts des séances prévues, `seuilSemaine`) d'affilée ; déloads et pauses ne cassent rien.
            const n = terminees ? semainesTenues(terminees, planning.length, cycles, dateISO()) : 0
            return n >= 2 ? (
              <div className="faible" style={{ width: '100%', marginTop: 6 }}>
                {n}ᵉ semaine tenue de suite ({seuilSemaine(planning.length)} séances sur {planning.length} ou plus)
              </div>
            ) : null
          })()}
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
      )}


      {choix && (
        <div className="modal-fond" onClick={() => setChoix(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="ligne entre" style={{ marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>Choisir une séance</h2>
              <button
                type="button"
                className="icone"
                onClick={() => setChoix(false)}
                aria-label="Fermer"
                style={{ fontSize: 18 }}
              >
                ✕
              </button>
            </div>

            {[
              ...programmes.map((p) => ({
                id: p.id,
                nom: p.nom,
                actif: p.id === actif.id,
                prog: p,
                seances: seancesDe(p),
              })),
              ...(horsProgramme.length
                ? [{ id: 'hors', nom: 'Hors programme', actif: false, prog: null, seances: horsProgramme }]
                : []),
            ].map((g) => {
              const ouvert = groupeOuvert === g.id
              return (
                <div
                  key={g.id}
                  className={'carte pile' + (g.actif ? ' carte-programme-actif' : '')}
                  style={{
                    marginBottom: 12,
                    padding: 12,
                    background: 'var(--surface)',
                    border: g.actif ? '1.5px solid var(--accent)' : '1px solid var(--bord)',
                    borderRadius: 16,
                  }}
                >
                  <button
                    type="button"
                    className="ligne entre"
                    style={{
                      width: '100%',
                      background: 'none',
                      border: 'none',
                      padding: '4px 2px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      alignItems: 'center',
                    }}
                    onClick={() => setOuvert(ouvert ? '' : g.id)}
                    aria-expanded={ouvert}
                  >
                    <div className="ligne wrap" style={{ gap: 8, alignItems: 'center' }}>
                      <strong style={{ fontSize: '1.05rem', color: 'var(--texte)' }}>{g.nom}</strong>
                      {g.actif && <span className="pastille ok">actif</span>}
                      <span className="faible" style={{ fontSize: '0.85rem' }}>
                        ({g.seances.length} séance{g.seances.length > 1 ? 's' : ''})
                      </span>
                    </div>
                    <span className="muted" style={{ fontSize: 16 }}>{ouvert ? '▾' : '▸'}</span>
                  </button>

                  {ouvert && (
                    <div
                      className="pile"
                      style={{
                        gap: 8,
                        marginTop: 10,
                        paddingTop: 10,
                        borderTop: '1px solid var(--bord)',
                      }}
                    >
                      {g.seances.length === 0 ? (
                        <div className="faible" style={{ fontStyle: 'italic', padding: '6px 2px' }}>
                          Aucune séance dans ce programme.
                        </div>
                      ) : (
                        g.seances.map((m) => {
                          const creneauxJours = g.prog
                            ? g.prog.seances.filter((e) => e.modeleId === m.id && e.jour).map((e) => e.jour!)
                            : []
                          const estAujourdhui = creneauxJours.includes(jour)
                          const faiteSemaine = realisees(m) > 0

                          return (
                            <button
                              key={m.id}
                              type="button"
                              className="sous-seance-item"
                              style={{
                                padding: '12px 14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 12,
                              }}
                              onClick={() => voir(m)}
                            >
                              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                                <div className="ligne wrap" style={{ gap: 6, alignItems: 'center' }}>
                                  <strong style={{ fontSize: '1rem', color: 'var(--texte)' }}>{m.nom}</strong>
                                  {creneauxJours.map((j) => (
                                    <span key={j} className={'badge-jour' + (j === jour ? ' aujourdhui' : '')}>
                                      {['', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][j]}
                                    </span>
                                  ))}
                                </div>
                                {m.sousTitre && (
                                  <div
                                    className="muted petit"
                                    style={{
                                      marginTop: 2,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {m.sousTitre}
                                  </div>
                                )}
                                <div className="faible" style={{ marginTop: 4, fontSize: '0.8rem' }}>
                                  {dureeTexte(m, terminees)}
                                </div>
                              </div>

                              <div className="ligne" style={{ gap: 6, alignItems: 'center', flexShrink: 0 }}>
                                {faiteSemaine ? (
                                  <span className="pastille ok" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                                    ✓ Faite
                                  </span>
                                ) : estAujourdhui ? (
                                  <span className="pastille accent" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                                    Aujourd'hui
                                  </span>
                                ) : null}
                                <span className="muted" style={{ fontSize: '1.1rem', marginLeft: 2 }}>›</span>
                              </div>
                            </button>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--bord)' }}>
              <button
                type="button"
                className="sous-seance-item"
                style={{
                  padding: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                }}
                onClick={() => lancer()}
              >
                <div style={{ textAlign: 'left' }}>
                  <strong style={{ fontSize: '0.98rem' }}>⚡ Séance libre</strong>
                  <div className="faible" style={{ marginTop: 2, fontSize: '0.8rem' }}>
                    Exercices ajoutés au fur et à mesure sans modèle
                  </div>
                </div>
                <span className="pastille accent" style={{ fontSize: '1rem', padding: '2px 8px' }}>+</span>
              </button>
            </div>

            <button className="btn discret plein" style={{ marginTop: 10 }} onClick={() => setChoix(false)}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
