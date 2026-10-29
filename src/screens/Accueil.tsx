import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import type { Catalogue, EntreePlanning } from '../catalogue'
import { MUSCLES } from '../data/exercices'
import { db, dernierPoids, uid } from '../db'
import { dateISO, dureeTexte, jourSemaine, kg, lundi, volumeParMuscle } from '../lib/calc'
import { debloquerSon } from '../lib/appareil'
import { transition, useRetour } from '../lib/nav'
import Apercu from './Apercu'
import type { Programme, SeanceModele } from '../types'

const JOURS = ['', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']
const exercices = (n: number) => `${n} exercice${n > 1 ? 's' : ''}`

/** Sans modèle : séance libre, les exercices s'ajoutent à la volée. */
async function demarrer(modele?: SeanceModele) {
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

export default function Accueil({ catalogue }: { catalogue: Catalogue }) {
  const [choix, setChoix] = useState(false)
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [apercu, setApercuEtat] = useState<SeanceModele | null>(null)
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
        {MUSCLES.map((m) => {
          const v = volume[m.id]
          const pct = Math.min(100, (v / m.cible) * 100)
          const etat = v > m.cible * 1.25 ? 'trop' : v >= m.cible ? 'ok' : ''
          return (
            <div key={m.id} style={{ marginBottom: 8 }}>
              <div className="ligne entre petit">
                <span>{m.nom}</span>
                <span className="muted">
                  {kg(v)}/{kg(m.cible)}
                </span>
              </div>
              <div className={'barre ' + etat}>
                <div style={{ width: pct + '%' }} />
              </div>
            </div>
          )
        })}
        <div className="faible">Séries dures (RPE ≥ 7). Triceps : développés et dips comptés à 0,5.</div>
      </div>

      <Poids pesees={pesees} aujourdhui={aujourdhui} />

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

function Poids({ pesees, aujourdhui }: { pesees: { date: string; poids: number }[]; aujourdhui: string }) {
  const duJour = pesees.find((p) => p.date === aujourdhui)
  const [valeur, setValeur] = useState('')
  const recentes = pesees.filter((p) => Date.parse(p.date) > Date.now() - 7 * 86400000)
  const moyenne = recentes.length ? recentes.reduce((a, p) => a + p.poids, 0) / recentes.length : null

  const enregistrer = async () => {
    const poids = parseFloat(valeur.replace(',', '.'))
    if (!(poids > 30 && poids < 250)) return
    await db.pesees.put({ date: aujourdhui, poids })
    setValeur('')
  }

  return (
    <div className="carte pile">
      <div className="ligne entre">
        <h3>Poids du jour</h3>
        {moyenne !== null && <span className="faible">moyenne 7 j : {kg(Math.round(moyenne * 10) / 10)} kg</span>}
      </div>
      {duJour ? (
        <div className="muted">
          {kg(duJour.poids)} kg noté aujourd’hui{' '}
          <button className="btn discret petit" onClick={() => setValeur(String(duJour.poids))}>
            modifier
          </button>
        </div>
      ) : null}
      {(!duJour || valeur) && (
        <div className="ligne">
          <input inputMode="decimal" placeholder="ex. 70,4" value={valeur} onChange={(e) => setValeur(e.target.value)} />
          <button className="btn primaire" onClick={enregistrer}>
            OK
          </button>
        </div>
      )}
      <div className="faible">Sert aussi au calcul de l’e1RM des tractions et dips. Seule la moyenne compte, pas la variation d’un jour.</div>
    </div>
  )
}
