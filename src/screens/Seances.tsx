import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { ID_PROGRAMME_DEFAUT, type Catalogue } from '../catalogue'
import ChoixExo from '../components/ChoixExo'
import EditeurExoPlan from '../components/EditeurExoPlan'
import { MODELES } from '../data/programme'
import { db, setReglage, uid } from '../db'
import { chrono, kg, chargeTexte } from '../lib/calc'
import { transition, useRetour } from '../lib/nav'
import type { Exercice, ExoPlan, Programme, SeanceModele } from '../types'

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

type Vue =
  | { type: 'programme'; p: Programme; initial: Programme; nouveau: boolean }
  | { type: 'seance'; m: SeanceModele; nouvelle: boolean; /** Ajouter la séance créée au programme en dessous. */ pourProgramme?: boolean }

export const jourCourt = (j?: number) => (j ? JOURS[j].slice(0, 3) : '')

/** Enregistre un programme ; le programme de départ (virtuel) est conservé dès qu'on en crée un autre. */
async function sauverProgramme(p: Programme, catalogue: Catalogue) {
  if ((await db.programmes.count()) === 0 && p.id !== ID_PROGRAMME_DEFAUT) await db.programmes.put(catalogue.programmes[0])
  await db.programmes.put(p)
}

export default function Seances({ catalogue }: { catalogue: Catalogue }) {
  const [pile, setPile] = useState<Vue[]>([])
  const masquees = useLiveQuery(() => db.modeles.filter((m) => !!m.supprime).toArray(), [], [])
  const vue = pile[pile.length - 1]

  const ouvrir = (v: Vue) => (transition(() => setPile((x) => [...x, v]), 'avant'), window.scrollTo({ top: 0 }))
  const fermer = (f?: (pile: Vue[]) => Vue[]) =>
    (transition(() => setPile((x) => (f ? f(x.slice(0, -1)) : x.slice(0, -1))), 'arriere'), window.scrollTo({ top: 0 }))
  const ouvrirProgramme = (p: Programme, nouveau = false) => ouvrir({ type: 'programme', p: structuredClone(p), initial: structuredClone(p), nouveau })
  const ouvrirSeance = (m: SeanceModele, nouvelle = false, pourProgramme = false) =>
    ouvrir({ type: 'seance', m: structuredClone(m), nouvelle, pourProgramme })
  const nouvelleSeance = (pourProgramme = false) => ouvrirSeance({ id: 'm_' + uid(), nom: '', sousTitre: '', exercices: [] }, true, pourProgramme)

  if (vue?.type === 'seance')
    return (
      <Editeur
        key={vue.m.id}
        catalogue={catalogue}
        initial={vue.m}
        nouvelle={vue.nouvelle}
        onFermer={(enregistree) =>
          fermer((reste) => {
            // Séance créée depuis un programme : on l'ajoute au brouillon du programme.
            const dessous = reste[reste.length - 1]
            if (enregistree && vue.pourProgramme && dessous?.type === 'programme')
              return [...reste.slice(0, -1), { ...dessous, p: { ...dessous.p, seances: [...dessous.p.seances, { modeleId: enregistree.id }] } }]
            return reste
          })
        }
      />
    )
  if (vue?.type === 'programme')
    return (
      <EditeurProgramme
        key={vue.initial.id}
        catalogue={catalogue}
        vue={vue}
        setP={(p) => setPile((x) => x.map((v) => (v === vue ? { ...vue, p } : v)))}
        onOuvrirSeance={(m) => ouvrirSeance(m)}
        onNouvelleSeance={() => nouvelleSeance(true)}
        onFermer={() => fermer()}
      />
    )

  const utilisations = (m: SeanceModele) => catalogue.programmes.filter((p) => p.seances.some((e) => e.modeleId === m.id)).map((p) => p.nom)

  return (
    <div>
      <div className="entete">
        <h1>Programmes</h1>
      </div>
      {catalogue.programmes.map((p) => {
        const seances = p.seances.filter((e) => catalogue.modele(e.modeleId))
        const jours = seances.filter((e) => e.jour).sort((a, b) => a.jour! - b.jour!)
        return (
          <button key={p.id} className="liste-btn" style={p.id === catalogue.actif.id ? { borderColor: 'var(--accent)' } : undefined} onClick={() => ouvrirProgramme(p)}>
            <span>
              <strong>{p.nom}</strong> {p.id === catalogue.actif.id && <span className="pastille accent">actif</span>}
              <div className="faible">
                {seances.length} séance{seances.length > 1 ? 's' : ''}
                {jours.length > 0 && ' · ' + jours.map((e) => jourCourt(e.jour)).join(', ')}
              </div>
            </span>
            <span className="muted">›</span>
          </button>
        )
      })}
      <button className="btn plein" style={{ marginBottom: 24 }} onClick={() => ouvrirProgramme({ id: 'p_' + uid(), nom: '', seances: [] }, true)}>
        + Nouveau programme
      </button>

      <div className="ligne entre" style={{ marginBottom: 10 }}>
        <h2>Bibliothèque de séances</h2>
      </div>
      <button className="btn primaire plein" style={{ marginBottom: 12 }} onClick={() => nouvelleSeance()}>
        + Nouvelle séance
      </button>
      {[...catalogue.modeles]
        .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
        .map((m) => {
          const progs = utilisations(m)
          return (
            <button key={m.id} className="liste-btn" onClick={() => ouvrirSeance(m)}>
              <span>
                <strong>{m.nom}</strong> {m.sousTitre && <span className="muted">— {m.sousTitre}</span>}
                <div className="faible">
                  {m.exercices.length} exercice{m.exercices.length > 1 ? 's' : ''}
                  {m.varianteDe ? ` · variante de ${catalogue.modele(m.varianteDe)?.nom ?? '?'}` : ''}
                  {progs.length ? ` · ${progs.join(', ')}` : ' · dans aucun programme'}
                </div>
              </span>
              <span className="muted">›</span>
            </button>
          )
        })}
      {masquees.length > 0 && (
        <div className="carte pile" style={{ marginTop: 16 }}>
          <div className="faible">Séances préchargées supprimées</div>
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

function EditeurProgramme({
  catalogue,
  vue,
  setP,
  onOuvrirSeance,
  onNouvelleSeance,
  onFermer,
}: {
  catalogue: Catalogue
  vue: Extract<Vue, { type: 'programme' }>
  setP: (p: Programme) => void
  onOuvrirSeance: (m: SeanceModele) => void
  onNouvelleSeance: () => void
  onFermer: () => void
}) {
  const { p, initial, nouveau } = vue
  const [choix, setChoix] = useState(false)
  const modifie = JSON.stringify(p) !== JSON.stringify(initial)
  const actif = catalogue.actif.id === p.id
  const enBase = catalogue.programmes.some((x) => x.id === p.id)
  useRetour(choix, () => setChoix(false))
  useRetour(true, () => {
    if (modifie && !confirm('Quitter sans enregistrer ?')) return 'rester'
    onFermer()
  })

  const maj = (f: (x: Programme) => void) => {
    const c = structuredClone(p)
    f(c)
    setP(c)
  }
  const entrees = p.seances.map((e, i) => ({ e, i, m: catalogue.modele(e.modeleId) })).filter((x) => x.m)
  const valide = p.nom.trim() !== '' && entrees.length > 0

  const enregistrer = async (activer = false) => {
    const finale = { ...p, nom: p.nom.trim(), description: p.description?.trim() || undefined, seances: p.seances.filter((e) => catalogue.modele(e.modeleId)) }
    await sauverProgramme(finale, catalogue)
    if (activer) await setReglage('programmeActif', finale.id)
    onFermer()
  }
  const dupliquer = async () => {
    await sauverProgramme({ ...structuredClone(p), id: 'p_' + uid(), nom: `${p.nom.trim()} (copie)` }, catalogue)
    onFermer()
  }
  const supprimer = async () => {
    if (catalogue.programmes.length <= 1) return alert('Il faut garder au moins un programme.')
    if (!confirm(`Supprimer le programme « ${p.nom} » ? Ses séances restent dans la bibliothèque.`)) return
    if ((await db.programmes.count()) === 0) await db.programmes.bulkPut(catalogue.programmes)
    await db.programmes.delete(p.id)
    if (actif) await setReglage('programmeActif', catalogue.programmes.find((x) => x.id !== p.id)!.id)
    onFermer()
  }

  return (
    <div>
      <div className="entete">
        <button className="btn" onClick={() => (!modifie || confirm('Quitter sans enregistrer ?')) && onFermer()}>
          ←
        </button>
        <h2 style={{ flex: 1 }}>{nouveau ? 'Nouveau programme' : 'Programme'}</h2>
        {actif && <span className="pastille accent">actif</span>}
      </div>

      <div className="carte pile">
        <label className="champ">
          <span>Nom</span>
          <input value={p.nom} placeholder="ex. Recompo 4 jours" onChange={(e) => maj((x) => (x.nom = e.target.value))} />
        </label>
        <label className="champ">
          <span>Description (optionnel)</span>
          <input value={p.description ?? ''} placeholder="ex. pecs et dos prioritaires" onChange={(e) => maj((x) => (x.description = e.target.value))} />
        </label>
      </div>

      <div className="carte">
        <h3>Séances et planning</h3>
        <div className="faible" style={{ marginTop: 4 }}>
          Le jour sert à proposer la séance du jour. Sans jour : séance au choix (variante maison, séance d’appoint…).
        </div>
        {entrees.length === 0 && <div className="muted petit" style={{ marginTop: 10 }}>Aucune séance pour l’instant.</div>}
        {entrees.map(({ e, i, m }, k) => (
          <div key={e.modeleId + i} className="exo-ligne">
            <button className="texte" onClick={() => onOuvrirSeance(m!)}>
              <strong>{m!.nom}</strong>
              <div className="faible">
                {m!.sousTitre ? m!.sousTitre + ' · ' : ''}
                {m!.exercices.length} exo{m!.exercices.length > 1 ? "s" : ""} ›
              </div>
            </button>
            <select
              value={e.jour ?? 0}
              style={{ width: 84, padding: '8px 6px' }}
              onChange={(ev) => maj((x) => (x.seances[i].jour = +ev.target.value || undefined))}
            >
              <option value={0}>—</option>
              {JOURS.slice(1).map((j, n) => (
                <option key={j} value={n + 1}>
                  {j.slice(0, 3)}
                </option>
              ))}
            </select>
            <button
              className="icone"
              disabled={k === 0}
              aria-label="Monter"
              onClick={() =>
                maj((x) => {
                  const [s] = x.seances.splice(i, 1)
                  x.seances.splice(entrees[k - 1].i, 0, s)
                })
              }
            >
              ↑
            </button>
            <button className="icone" aria-label="Retirer" onClick={() => maj((x) => x.seances.splice(i, 1))}>
              ✕
            </button>
          </div>
        ))}
        <button className="btn plein" style={{ marginTop: 12 }} onClick={() => setChoix(true)}>
          + Ajouter une séance
        </button>
      </div>

      {modifie || nouveau || !enBase ? (
        <button className="btn primaire grand" disabled={!valide} onClick={() => enregistrer(nouveau && !actif)}>
          {nouveau ? 'CRÉER ET ACTIVER' : 'ENREGISTRER'}
        </button>
      ) : null}
      {!valide && <div className="faible" style={{ marginTop: 6 }}>Il faut un nom et au moins une séance.</div>}
      {!nouveau && (
        <div className="ligne wrap" style={{ marginTop: 12 }}>
          {!actif && (
            <button className="btn primaire" disabled={!valide} onClick={() => enregistrer(true)}>
              Activer ce programme
            </button>
          )}
          <button className="btn" onClick={dupliquer}>
            Dupliquer
          </button>
          <button className="btn danger" onClick={supprimer}>
            Supprimer
          </button>
        </div>
      )}

      {choix && (
        <div className="modal-fond" onClick={() => setChoix(false)}>
          <div className="modal" onClick={(ev) => ev.stopPropagation()}>
            <h2 style={{ marginBottom: 12 }}>Ajouter une séance</h2>
            <button className="btn primaire plein" style={{ marginBottom: 12 }} onClick={() => (setChoix(false), onNouvelleSeance())}>
              + Créer une nouvelle séance
            </button>
            {catalogue.modeles.map((m) => {
              const deja = p.seances.some((e) => e.modeleId === m.id)
              return (
                <button
                  key={m.id}
                  className="liste-btn"
                  onClick={() => {
                    setChoix(false)
                    maj((x) => x.seances.push({ modeleId: m.id }))
                  }}
                >
                  <span>
                    <strong>{m.nom}</strong> {m.sousTitre && <span className="muted">— {m.sousTitre}</span>}
                    {deja && <div className="faible">déjà dans le programme (l’ajouter encore = 2 fois par semaine)</div>}
                  </span>
                  <span className="muted">+</span>
                </button>
              )
            })}
            <button className="btn discret plein" onClick={() => setChoix(false)}>
              Annuler
            </button>
          </div>
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
  /** Reçoit la séance quand elle vient d'être enregistrée. */
  onFermer: (enregistree?: SeanceModele) => void
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
    const finale = { ...m, nom: m.nom.trim(), sousTitre: m.sousTitre.trim() }
    await db.modeles.put(finale)
    onFermer(finale)
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
