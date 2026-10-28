import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { MUSCLES } from '../data/exercices'
import { MODELES, PROGRAMME } from '../data/programme'
import { db, dernierPoids, uid } from '../db'
import { dateISO, jourSemaine, kg, lundi, volumeParMuscle } from '../lib/calc'
import { debloquerSon } from '../lib/appareil'
import type { SeanceModele } from '../types'

const JOURS = ['', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']

async function demarrer(modele: SeanceModele) {
  debloquerSon()
  await db.seances.add({
    id: uid(),
    date: dateISO(),
    modeleId: modele.id,
    nom: modele.nom,
    debut: Date.now(),
    enCours: true,
    poidsCorps: await dernierPoids(),
    chauffes: {},
    series: [],
    notes: {},
    ajustSeries: {},
  })
}

export default function Accueil() {
  const [choix, setChoix] = useState(false)
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

  const planning = PROGRAMME.filter((m) => m.jour).sort((a, b) => a.jour! - b.jour!)
  const faite = (m: SeanceModele) =>
    semaine.some((s) => s.modeleId === m.id || MODELES[s.modeleId ?? '']?.varianteDe === m.id)
  const jour = jourSemaine()
  const duJour = planning.find((m) => m.jour === jour)
  const prochaine = planning.find((m) => !faite(m) && m.jour! >= jour) ?? planning.find((m) => !faite(m))
  const variante = duJour && PROGRAMME.find((m) => m.varianteDe === duJour.id)
  const proposee = duJour && !faite(duJour) ? duJour : prochaine

  const volume = volumeParMuscle(semaine)

  const exportVieux =
    nbSeances > 0 && (!dernierExport || Date.now() - (dernierExport.valeur as number) > 7 * 86400000)

  return (
    <div>
      <div className="entete">
        <div>
          <div className="faible">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1>Muscu</h1>
        </div>
      </div>

      {exportVieux && (
        <div className="carte petit" style={{ borderColor: 'var(--alerte)' }}>
          💾 Pense à exporter tes données (Réglages) : elles ne sont que sur ce téléphone.
        </div>
      )}

      <div className="carte pile">
        {duJour && faite(duJour) && <div className="pastille ok">✓ {duJour.nom} faite aujourd’hui</div>}
        {!duJour && <div className="muted">Repos prévu aujourd’hui.</div>}
        {proposee ? (
          <>
            <div>
              <div className="faible">{proposee === duJour ? 'Séance du jour' : `Prochaine · prévue ${JOURS[proposee.jour!]}`}</div>
              <h2>
                {proposee.nom} <span className="muted">— {proposee.sousTitre}</span>
              </h2>
              <div className="faible">{proposee.exercices.length} exercices</div>
            </div>
            <button className="btn primaire grand" onClick={() => demarrer(proposee)}>
              Démarrer
            </button>
          </>
        ) : (
          <div>Semaine complète 💪</div>
        )}
        <div className="ligne wrap">
          <button className="btn" onClick={() => setChoix(true)}>
            Autre séance
          </button>
          {variante && proposee === duJour && (
            <button className="btn" onClick={() => demarrer(variante)}>
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
          {planning.map((m) => (
            <span key={m.id} className={'pastille' + (faite(m) ? ' ok' : m.jour === jour ? ' accent' : '')}>
              {JOURS[m.jour!]} · {m.nom} {faite(m) ? '✓' : ''}
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
            {PROGRAMME.map((m) => (
              <button key={m.id} className="liste-btn" onClick={() => demarrer(m)}>
                <span>
                  <strong>{m.nom}</strong> <span className="muted">— {m.sousTitre}</span>
                </span>
                <span className="faible">{faite(m) ? '✓' : m.jour ? JOURS[m.jour] : ''}</span>
              </button>
            ))}
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
