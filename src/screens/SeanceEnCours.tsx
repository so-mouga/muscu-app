import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import CarteExo from '../components/CarteExo'
import Minuteur, { type EtatMinuteur } from '../components/Minuteur'
import { MODELES } from '../data/programme'
import { db, exoAvecReglages, historiqueDe } from '../db'
import { debloquerSon, ecranAllume } from '../lib/appareil'
import { chargeTexte, duree, e1rm, estDure, kg } from '../lib/calc'
import { suggere, type Suggestion } from '../lib/progression'
import type { Seance, Serie } from '../types'

function stocke<T>(cle: string, defaut: T): T {
  try {
    const v = localStorage.getItem(cle)
    return v ? (JSON.parse(v) as T) : defaut
  } catch {
    return defaut
  }
}
function range(cle: string, v: unknown) {
  try {
    if (v === null) localStorage.removeItem(cle)
    else localStorage.setItem(cle, JSON.stringify(v))
  } catch {
    /* stockage indisponible */
  }
}

export default function SeanceEnCours({ seance }: { seance: Seance }) {
  const modele = MODELES[seance.modeleId ?? '']
  const terminees = useLiveQuery(() => db.seances.orderBy('debut').reverse().filter((s) => !s.enCours).toArray(), [])
  const reglages = useLiveQuery(() => db.reglages.toArray(), [])
  const [idx, setIdxEtat] = useState<number>(() => stocke(`idx:${seance.id}`, 0))
  const [minuteur, setMinuteurEtat] = useState<EtatMinuteur | null>(() => stocke('minuteur', null))
  const [toast, setToast] = useState<string | null>(null)
  const [fin, setFin] = useState(false)

  const setIdx = (i: number) => (setIdxEtat(i), range(`idx:${seance.id}`, i), window.scrollTo({ top: 0 }))
  const setMinuteur = (m: EtatMinuteur | null) => (setMinuteurEtat(m), range('minuteur', m))

  useEffect(() => {
    ecranAllume(true)
    return () => ecranAllume(false)
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const exos = useMemo(() => (reglages ? modele.exercices.map((p) => exoAvecReglages(p.exoId, reglages)) : []), [modele, reglages])
  const suggestions = useMemo(() => {
    if (!terminees) return [] as Suggestion[]
    return modele.exercices.map((p, i) => suggere(exos[i], p, historiqueDe(terminees, p.exoId)))
  }, [terminees, exos, modele])

  if (!terminees || !reglages || !suggestions.length) return null

  const valider = (s: Serie, repos: number) => {
    debloquerSon()
    setMinuteur({ fin: Date.now() + repos * 1000, duree: repos })
    // Records (seulement s'il existe un historique pour comparer)
    const exo = exoAvecReglages(s.exoId, reglages)
    const avant = historiqueDe(terminees, s.exoId).flat()
    if (avant.length === 0) return
    const memeCharge = avant.filter((x) => x.charge === s.charge)
    const e = e1rm(exo, s, seance.poidsCorps)
    const meilleur = Math.max(0, ...avant.map((x) => e1rm(exo, x, seance.poidsCorps) ?? 0))
    if (e && meilleur && e > meilleur) setToast(`🏆 Nouveau record e1RM : ${kg(e)} kg`)
    else if (memeCharge.length && s.reps > Math.max(...memeCharge.map((x) => x.reps)))
      setToast(`🏆 Nouveau record de reps à ${chargeTexte(exo, s.charge)} : ${s.reps}`)
  }

  if (fin) return <FinSeance seance={seance} terminees={terminees} reglages={reglages} onRetour={() => setFin(false)} />

  const plan = modele.exercices[idx]
  const nbFaites = (exoId: string) => seance.series.filter((s) => s.exoId === exoId).length

  return (
    <div>
      <div className="entete">
        <div>
          <div className="faible">
            {modele.nom} · {duree(Date.now() - seance.debut)}
          </div>
          <h3>{modele.sousTitre}</h3>
        </div>
        <button className="btn" onClick={() => setFin(true)}>
          Terminer
        </button>
      </div>

      <div className="pills">
        {modele.exercices.map((p, i) => {
          const fait = nbFaites(p.exoId) >= p.series.length + (seance.ajustSeries[p.exoId] ?? 0)
          return (
            <button key={p.exoId} className={(i === idx ? 'actif ' : '') + (fait ? 'fait' : '')} onClick={() => setIdx(i)}>
              {fait ? '✓' : i + 1}
            </button>
          )
        })}
      </div>

      <CarteExo
        key={plan.exoId}
        seance={seance}
        plan={plan}
        exo={exos[idx]}
        sugg={suggestions[idx]}
        derniere={historiqueDe(terminees, plan.exoId)[0]}
        onValide={valider}
      />

      <div className="ligne entre" style={{ marginBottom: 80 }}>
        <button className="btn" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>
          ← Précédent
        </button>
        {idx < modele.exercices.length - 1 ? (
          <button className="btn primaire" onClick={() => setIdx(idx + 1)}>
            Suivant →
          </button>
        ) : (
          <button className="btn primaire" onClick={() => setFin(true)}>
            Terminer la séance
          </button>
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}
      {minuteur && <Minuteur etat={minuteur} onChange={setMinuteur} />}
    </div>
  )
}

function FinSeance({
  seance,
  terminees,
  reglages,
  onRetour,
}: {
  seance: Seance
  terminees: Seance[]
  reglages: Parameters<typeof exoAvecReglages>[1]
  onRetour: () => void
}) {
  const modele = MODELES[seance.modeleId ?? '']
  const [ressenti, setRessenti] = useState(3)
  const [energie, setEnergie] = useState(3)
  const dures = seance.series.filter(estDure).length
  const tonnage = seance.series.reduce((a, s) => a + s.charge * s.reps, 0)
  const finisseurs = seance.series.filter((s) => s.type === 'serie_longue').length
  const chauffes = Object.values(seance.chauffes).filter(Boolean).length

  // « Prévoir la prochaine séance » : suggestions calculées avec cette séance incluse.
  const avecCelleCi = [seance, ...terminees]
  const prochaines = modele.exercices
    .filter((p) => seance.series.some((s) => s.exoId === p.exoId))
    .map((p) => {
      const exo = exoAvecReglages(p.exoId, reglages)
      return { exo, s: suggere(exo, p, historiqueDe(avecCelleCi, p.exoId)) }
    })

  const enregistrer = async () => {
    await db.seances.update(seance.id, { enCours: false, fin: Date.now(), ressenti, energie })
    try {
      localStorage.removeItem('minuteur')
      localStorage.removeItem(`idx:${seance.id}`)
    } catch {
      /* rien */
    }
  }

  const abandonner = async () => {
    if (!confirm(seance.series.length ? 'Supprimer cette séance et ses séries ?' : 'Annuler la séance ?')) return
    await db.seances.delete(seance.id)
  }

  const Echelle = ({ v, set, label }: { v: number; set: (n: number) => void; label: string }) => (
    <div>
      <div className="faible" style={{ marginBottom: 6 }}>
        {label}
      </div>
      <div className="rpe" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} className={v === n ? 'actif' : ''} onClick={() => set(n)}>
            {n}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div>
      <div className="entete">
        <h1>Fin de séance</h1>
        <button className="btn" onClick={onRetour}>
          ← Reprendre
        </button>
      </div>
      <div className="carte">
        <h2>{modele.nom}</h2>
        <table style={{ marginTop: 8 }}>
          <tbody>
            <tr>
              <td>Durée</td>
              <td>{duree(Date.now() - seance.debut)}</td>
            </tr>
            <tr>
              <td>Séries dures</td>
              <td>{dures}</td>
            </tr>
            <tr>
              <td>Volume</td>
              <td>{kg(Math.round(tonnage))} kg × reps</td>
            </tr>
            <tr>
              <td>Finisseurs</td>
              <td>{finisseurs}</td>
            </tr>
            <tr>
              <td>Chauffes cochées</td>
              <td>{chauffes}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="carte pile">
        <Echelle v={ressenti} set={setRessenti} label="Ressenti global (1 = dur, 5 = excellent)" />
        <Echelle v={energie} set={setEnergie} label="Énergie (1 = vidé, 5 = au top)" />
      </div>

      {prochaines.length > 0 && (
        <div className="carte">
          <h3 style={{ marginBottom: 8 }}>Prochaine fois</h3>
          {prochaines.map(({ exo, s }) => (
            <div key={exo.id} className="suggestion petit" style={{ marginBottom: 10 }}>
              <strong>{exo.nom}</strong> : {chargeTexte(exo, s.charges[0])}
              {s.charges.some((c) => c !== s.charges[0]) && ` → ${chargeTexte(exo, s.charges[s.charges.length - 1])}`} × {s.reps.join('/')}
              <div className="muted">{s.message}</div>
            </div>
          ))}
        </div>
      )}

      <button className="btn primaire grand" onClick={enregistrer} disabled={seance.series.length === 0}>
        ENREGISTRER
      </button>
      <button className="btn discret danger plein" style={{ marginTop: 12 }} onClick={abandonner}>
        {seance.series.length ? 'Supprimer la séance' : 'Annuler la séance'}
      </button>
    </div>
  )
}
