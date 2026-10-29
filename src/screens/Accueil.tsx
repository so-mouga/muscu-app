import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import type { Catalogue, EntreePlanning } from '../catalogue'
import { db, dernierPoids, exoAvecReglages, historiqueDe, uid } from '../db'
import { dateISO, duree, dureeTexte, jourSemaine, lundi, volumeParMuscle } from '../lib/calc'
import { dureeReelle } from '../lib/historique'
import { aBattre, suggestionPour } from '../lib/progression'
import { debloquerSon } from '../lib/appareil'
import { transition, useRetour } from '../lib/nav'
import VolumeMuscles from '../components/VolumeMuscles'
import Poids from '../components/Poids'
import Apercu from './Apercu'
import Corps from './Corps'
import type { Programme, SeanceModele } from '../types'

const JOURS = ['', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']
const exercices = (n: number) => `${n} exercice${n > 1 ? 's' : ''}`

/** Sans modèle : séance libre, les exercices s'ajoutent à la volée. */
async function demarrer(modele?: SeanceModele) {
  try {
    await creerSeance(modele)
  } catch (e) {
    alert(`Impossible de démarrer la séance : ${(e as Error).message}\n(version ${__VERSION__})`)
  }
}

async function creerSeance(modele?: SeanceModele) {
  debloquerSon()
  await db.seances.add({
    id: uid(),
    date: dateISO(),
    modeleId: modele?.id,
    nom: modele?.nom ?? 'Séance libre',
    sousTitre: modele?.sousTitre ?? 'exercices au choix',
    exercices: structuredClone(modele?.exercices ?? []),
    debut: Date.now(),
    enCours: true,
    poidsCorps: await dernierPoids(),
    chauffes: {},
    series: [],
    notes: {},
    ajustSeries: {},
  })
}

export default function Accueil({ catalogue, onVoirSeance }: { catalogue: Catalogue; onVoirSeance: (id: string) => void }) {
  const [choix, setChoix] = useState(false)
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [apercu, setApercuEtat] = useState<SeanceModele | null>(null)
  const [corps, setCorpsEtat] = useState(false)
  const voirCorps = (v: boolean) => (transition(() => setCorpsEtat(v), v ? 'avant' : 'arriere'), window.scrollTo({ top: 0 }))
  const derniereMesure = useLiveQuery(() => db.mesures.orderBy('date').last(), [])
  useRetour(choix, () => setChoix(false))
  const voir = (m: SeanceModele | null) => {
    setChoix(false)
    transition(() => setApercuEtat(m), m ? 'avant' : 'arriere')
    window.scrollTo({ top: 0 })
  }
  const aujourdhui = dateISO()
  const debutSemaine = lundi()
  const semaine = useLiveQuery(
    () => db.seances.where('date').aboveOrEqual(debutSemaine).filter((s) => !s.enCours).toArray(),
    [debutSemaine],
    []
  )
  const pesees = useLiveQuery(() => db.pesees.orderBy('date').reverse().limit(14).toArray(), [], [])
  const dernierExport = useLiveQuery(() => db.reglages.get('dernierExport'), [])
  const nbSeances = useLiveQuery(() => db.seances.count(), [], 0)
  const terminees = useLiveQuery(() => db.seances.filter((s) => !s.enCours).toArray(), [])
  const reglages = useLiveQuery(() => db.reglages.toArray(), [], [])

  const { planning, actif } = catalogue
  // Séances faites cette semaine pour un modèle (sa variante maison compte aussi).
  const realisees = (m: SeanceModele) =>
    semaine.filter((s) => s.modeleId === m.id || catalogue.modele(s.modeleId)?.varianteDe === m.id).length
  // Une même séance peut revenir deux fois dans la semaine : la k-ième est faite s'il y en a eu au moins k.
  const faite = (e: EntreePlanning) => realisees(e.modele) > planning.filter((x) => x.modele.id === e.modele.id && x.jour < e.jour).length
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

  const volume = volumeParMuscle(semaine, catalogue.exercices)
  const derniere = terminees?.reduce<(typeof terminees)[number] | undefined>((a, s) => (!a || s.debut > a.debut ? s : a), undefined)

  // Exercices où l'objectif dépasse la dernière fois : « à battre ».
  const recentes = terminees && [...terminees].sort((a, b) => b.debut - a.debut)
  const nbABattre = (m: SeanceModele) =>
    recentes
      ? m.exercices.filter((p) => {
          const exo = exoAvecReglages(catalogue.exo(p.exoId), reglages)
          return aBattre(exo, suggestionPour(exo, p, recentes), historiqueDe(recentes, p.exoId)[0])
        }).length
      : 0

  if (corps) return <Corps onFermer={() => voirCorps(false)} />
  if (apercu) return <Apercu modele={apercu} catalogue={catalogue} onDemarrer={() => demarrer(apercu)} onFermer={() => voir(null)} />

  const exportVieux =
    nbSeances > 0 && (!dernierExport || Date.now() - (dernierExport.valeur as number) > 7 * 86400000)

  return (
    <div>
      <div className="entete">
        <div>
          <div className="faible">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1>Muscu</h1>
          <div className="faible">Programme : {actif.nom}</div>
        </div>
      </div>

      {exportVieux && (
        <div className="carte petit" style={{ borderColor: 'var(--alerte)' }}>
          💾 Pense à exporter tes données (Réglages) : elles ne sont que sur ce téléphone.
        </div>
      )}

      <div className="carte pile">
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
              {nbABattre(proposee.modele) > 0 && (
                <div className="badge-hausse grand" style={{ marginTop: 6 }}>
                  🔥 {nbABattre(proposee.modele)} objectif{nbABattre(proposee.modele) > 1 ? 's' : ''} à battre
                </div>
              )}
            </div>
            <div className="ligne">
              <button className="btn primaire grand" style={{ flex: 2 }} onClick={() => demarrer(proposee.modele)}>
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
        <div className="ligne wrap">
          <button className="btn" onClick={() => setChoix(true)}>
            Autre séance
          </button>
          {variante && proposee === duJour && (
            <button className="btn" onClick={() => voir(variante)}>
              🏠 Pas de salle
            </button>
          )}
        </div>
      </div>

      {derniere && (
        <button className="liste-btn" style={{ marginBottom: 12 }} onClick={() => onVoirSeance(derniere.id)}>
          <span>
            <span className="faible">Dernière séance</span>
            <div>
              <strong>{derniere.nom}</strong>{' '}
              <span className="muted">
                · {new Date(derniere.debut).toLocaleDateString('fr-FR', { weekday: 'long' })} · {duree(dureeReelle(derniere))}
              </span>
            </div>
          </span>
          <span className="muted">›</span>
        </button>
      )}

      <div className="carte">
        <div className="ligne entre" style={{ marginBottom: 10 }}>
          <h3>Cette semaine</h3>
          <span className="faible">
            Séances {semaine.length}/{planning.length}
          </span>
        </div>
        <div className="ligne wrap" style={{ marginBottom: 14 }}>
          {planning.map((e) => (
            <span key={e.modele.id + e.jour} className={'pastille' + (faite(e) ? ' ok' : e.jour === jour ? ' accent' : '')}>
              {JOURS[e.jour]} · {e.modele.nom} {faite(e) ? '✓' : ''}
            </span>
          ))}
        </div>
        <VolumeMuscles volume={volume} />
        <div className="faible">Séries dures (RPE ≥ 7). Triceps : développés et dips comptés à 0,5.</div>
      </div>

      <Poids pesees={pesees} aujourdhui={aujourdhui} onCorps={() => voirCorps(true)} derniereMesure={derniereMesure?.date} />

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
            <button className="liste-btn" onClick={() => demarrer()}>
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
