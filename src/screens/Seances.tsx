import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import type { Catalogue } from '../catalogue'
import ChoixExo from '../components/ChoixExo'
import EditeurExoPlan from '../components/EditeurExoPlan'
import { MODELES } from '../data/programme'
import { db, uid } from '../db'
import { chrono, kg, chargeTexte } from '../lib/calc'
import { transition, useRetour } from '../lib/nav'
import type { Exercice, ExoPlan, SeanceModele } from '../types'

export const JOURS = ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']

/** Plan par défaut d'un exercice ajouté (modifiable juste après). */
export function planParDefaut(exo: Exercice): ExoPlan {
  const petit = exo.muscle === 'mollets' || exo.muscle === 'abdos'
  const compose = exo.type === 'compose'
  const [min, max] = compose ? [8, 12] : [12, 15]
  return {
    exoId: exo.id,
    repos: petit ? 90 : compose ? 180 : 150,
    series: [0, 1, 2].map(() => ({ repsMin: min, repsMax: max, rpe: compose ? 8 : 9 })),
    chauffes: [],
    finisseur: false,
    charge: null,
  }
}

export function resumePlan(exo: Exercice, p: ExoPlan): string {
  const s = p.series[0]
  const reps = s.repsMin === s.repsMax ? s.repsMin : `${s.repsMin}–${s.repsMax}`
  return [
    `${p.series.length} × ${reps}`,
    `RPE ${p.series.map((x) => kg(x.rpe)).join(', ')}`,
    chrono(p.repos),
    chargeTexte(exo, p.charge),
    p.finisseur ? '★' : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

export default function Seances({ catalogue }: { catalogue: Catalogue }) {
  const [edition, setEdition] = useState<{ m: SeanceModele; nouvelle: boolean } | null>(null)
  const masquees = useLiveQuery(() => db.modeles.filter((m) => !!m.supprime).toArray(), [], [])

  const ouvrir = (m: SeanceModele, nouvelle = false) => transition(() => setEdition({ m: structuredClone(m), nouvelle }), 'avant')
  const fermer = () => transition(() => setEdition(null), 'arriere')

  if (edition) return <Editeur catalogue={catalogue} initial={edition.m} nouvelle={edition.nouvelle} onFermer={fermer} />

  const liste = [...catalogue.modeles].sort((a, b) => (a.jour ?? 9) - (b.jour ?? 9) || a.nom.localeCompare(b.nom, 'fr'))

  return (
    <div>
      <div className="entete">
        <h1>Séances</h1>
      </div>
      <button
        className="btn primaire grand"
        style={{ marginBottom: 12 }}
        onClick={() => ouvrir({ id: 'm_' + uid(), nom: '', sousTitre: '', exercices: [] }, true)}
      >
        + Nouvelle séance
      </button>
      {liste.map((m) => (
        <button key={m.id} className="liste-btn" onClick={() => ouvrir(m)}>
          <span>
            <strong>{m.nom}</strong> {m.sousTitre && <span className="muted">— {m.sousTitre}</span>}
            <div className="faible">
              {m.jour ? JOURS[m.jour] : 'sans jour fixe'}
              {m.varianteDe ? ` · variante de ${catalogue.modele(m.varianteDe)?.nom ?? '?'}` : ''} · {m.exercices.length} exercices
            </div>
          </span>
          <span className="muted">›</span>
        </button>
      ))}
      {masquees.length > 0 && (
        <div className="carte pile" style={{ marginTop: 16 }}>
          <div className="faible">Séances du programme supprimées</div>
          {masquees.map((m) => (
            <div key={m.id} className="ligne entre">
              <span>{m.nom}</span>
              <button className="btn petit" onClick={() => db.modeles.delete(m.id)}>
                Restaurer
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Editeur({
  catalogue,
  initial,
  nouvelle,
  onFermer,
}: {
  catalogue: Catalogue
  initial: SeanceModele
  nouvelle: boolean
  onFermer: () => void
}) {
  const [m, setM] = useState(initial)
  const [choix, setChoix] = useState(false)
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const modifie = JSON.stringify(m) !== JSON.stringify(initial)
  const prechargee = !!MODELES[m.id]
  const modifieeEnBase = useLiveQuery(() => db.modeles.get(m.id), [m.id])

  useRetour(true, () => {
    if (modifie && !confirm('Quitter sans enregistrer ?')) return 'rester'
    onFermer()
  })

  const maj = (f: (x: SeanceModele) => void) =>
    setM((x) => {
      const c = structuredClone(x)
      f(c)
      return c
    })
  const deplacer = (i: number, d: number) =>
    maj((x) => {
      const [e] = x.exercices.splice(i, 1)
      x.exercices.splice(i + d, 0, e)
    })

  const finisseurs = m.exercices.filter((e) => e.finisseur).length
  const valide = m.nom.trim() !== '' && m.exercices.length > 0

  const enregistrer = async () => {
    await db.modeles.put({ ...m, nom: m.nom.trim(), sousTitre: m.sousTitre.trim() })
    onFermer()
  }
  const dupliquer = async () => {
    await db.modeles.put({ ...structuredClone(m), id: 'm_' + uid(), nom: `${m.nom.trim()} (copie)`, jour: undefined })
    onFermer()
  }
  const supprimer = async () => {
    if (!confirm(`Supprimer « ${m.nom} » ? L’historique des séances faites est conservé.`)) return
    if (prechargee) await db.modeles.put({ ...initial, supprime: true })
    else await db.modeles.delete(m.id)
    onFermer()
  }
  const reinitialiser = async () => {
    if (!confirm('Revenir à la version d’origine du programme ?')) return
    await db.modeles.delete(m.id)
    onFermer()
  }

  return (
    <div>
      <div className="entete">
        <button
          className="btn"
          onClick={() => {
            if (!modifie || confirm('Quitter sans enregistrer ?')) onFermer()
          }}
        >
          ←
        </button>
        <h2 style={{ flex: 1 }}>{nouvelle ? 'Nouvelle séance' : 'Modifier la séance'}</h2>
      </div>

      <div className="carte pile">
        <label className="champ">
          <span>Nom</span>
          <input value={m.nom} placeholder="ex. Haut D" onChange={(e) => maj((x) => (x.nom = e.target.value))} />
        </label>
        <label className="champ">
          <span>Sous-titre</span>
          <input value={m.sousTitre} placeholder="ex. épaules + bras" onChange={(e) => maj((x) => (x.sousTitre = e.target.value))} />
        </label>
        <label className="champ">
          <span>Jour proposé</span>
          <select value={m.jour ?? 0} onChange={(e) => maj((x) => (x.jour = +e.target.value || undefined))}>
            <option value={0}>Aucun (au choix)</option>
            {JOURS.slice(1).map((j, i) => (
              <option key={j} value={i + 1}>
                {j}
              </option>
            ))}
          </select>
        </label>
        <label className="champ">
          <span>Variante de (pour « Pas de salle »)</span>
          <select value={m.varianteDe ?? ''} onChange={(e) => maj((x) => (x.varianteDe = e.target.value || undefined))}>
            <option value="">Aucune</option>
            {catalogue.modeles
              .filter((x) => x.id !== m.id)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nom}
                </option>
              ))}
          </select>
        </label>
      </div>

      <div className="carte">
        <h3>Exercices</h3>
        {m.exercices.length === 0 && <div className="muted petit" style={{ marginTop: 8 }}>Aucun exercice pour l’instant.</div>}
        {m.exercices.map((p, i) => {
          const exo = catalogue.exo(p.exoId)
          return (
            <div key={p.exoId + i} className="exo-ligne">
              <button className="texte" onClick={() => setEditIdx(i)}>
                <strong>
                  {i + 1}. {exo.nom}
                </strong>
                {p.optionnel && <span className="faible"> (optionnel)</span>}
                <div className="faible">{resumePlan(exo, p)}</div>
              </button>
              <button className="icone" disabled={i === 0} onClick={() => deplacer(i, -1)} aria-label="Monter">
                ↑
              </button>
              <button className="icone" disabled={i === m.exercices.length - 1} onClick={() => deplacer(i, 1)} aria-label="Descendre">
                ↓
              </button>
              <button className="icone" onClick={() => maj((x) => x.exercices.splice(i, 1))} aria-label="Retirer">
                ✕
              </button>
            </div>
          )
        })}
        <button className="btn plein" style={{ marginTop: 12 }} onClick={() => setChoix(true)}>
          + Ajouter un exercice
        </button>
        {finisseurs > 2 && (
          <div className="faible" style={{ color: 'var(--alerte)', marginTop: 8 }}>
            {finisseurs} finisseurs dans la même séance : c’est beaucoup, la qualité des dernières séries risque d’en pâtir.
          </div>
        )}
      </div>

      <button className="btn primaire grand" disabled={!valide} onClick={enregistrer}>
        ENREGISTRER
      </button>
      {!valide && <div className="faible" style={{ marginTop: 6 }}>Il faut un nom et au moins un exercice.</div>}
      {!nouvelle && (
        <div className="ligne wrap" style={{ marginTop: 12 }}>
          <button className="btn" onClick={dupliquer}>
            Dupliquer
          </button>
          {prechargee && modifieeEnBase && !modifieeEnBase.supprime && (
            <button className="btn" onClick={reinitialiser}>
              Version d’origine
            </button>
          )}
          <button className="btn danger" onClick={supprimer}>
            Supprimer
          </button>
        </div>
      )}

      {choix && (
        <ChoixExo
          catalogue={catalogue}
          titre="Ajouter un exercice"
          exclure={m.exercices.map((e) => e.exoId)}
          onFermer={() => setChoix(false)}
          onChoix={(id, cree) => {
            setChoix(false)
            const exo = cree ?? catalogue.exo(id)
            maj((x) => x.exercices.push(planParDefaut(exo)))
            setEditIdx(m.exercices.length)
          }}
        />
      )}
      {editIdx !== null && m.exercices[editIdx] && (
        <EditeurExoPlan
          key={editIdx}
          exo={catalogue.exo(m.exercices[editIdx].exoId)}
          plan={m.exercices[editIdx]}
          onFermer={() => setEditIdx(null)}
          onValider={(p) => {
            maj((x) => (x.exercices[editIdx] = p))
            setEditIdx(null)
          }}
        />
      )}
    </div>
  )
}
