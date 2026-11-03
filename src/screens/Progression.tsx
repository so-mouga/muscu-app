import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { confirmer } from '../components/Dialogues'
import { db } from '../db'
import Aide from '../components/Aide'
import { nomMuscle } from '../components/ChoixExo'
import Courbe from '../components/Courbe'
import { Consignes, resumeReglages } from '../components/InfosExo'
import { ContenuReglages } from '../components/ReglagesMachine'
import { consigne } from '../data/consignes'
import { EXERCICES } from '../data/exercices'
import { LEXIQUE } from '../data/lexique'
import { blocage, type Blocage } from '../lib/blocages'
import { chargeQte, chargeTexte, dateCourte, dateISO, e1rm, enTemps, kg, qte, serieTexte } from '../lib/calc'
import { evolutionForce, meilleureSerie } from '../lib/historique'
import { useRetour } from '../lib/nav'
import type { Exercice, Seance, Serie } from '../types'

type Mesure = 'force' | 'charge' | 'temps'
const PERIODES: [string, number][] = [
  ['3 mois', 91],
  ['1 an', 365],
  ['Tout', 0],
]
const JOUR = 86400000

/** L'effort des séries, en clair : « effort 8/10 », ou « effort 7, 8/10 » s'il change. */
const effortDe = (series: Serie[]) => {
  const l = [...new Set(series.map((x) => x.rpe).filter((r) => r > 0))].sort((a, b) => a - b)
  return l.length ? `effort ${l.map(kg).join(', ')}/10` : ''
}

/** Est-ce que je progresse ? Le constat, chiffré, sur les 8 dernières semaines : les mêmes règles que le Bilan et les blocages. */
export function lectureExo(exo: Exercice, chrono: Seance[], enSeche = false): { texte: string; classe: string; detail?: string } | null {
  const travail = chrono.filter((s) => !s.deload)
  if (travail.length < 2) return null
  // En sèche, on ne parle pas de blocage : la force qui tient est déjà un bon résultat.
  const bloque: Blocage | null = enSeche ? null : blocage(exo, travail, dateISO())
  if (bloque) return { texte: `Bloqué depuis ${bloque.semaines} semaines`, classe: 'alerte-texte', detail: `pas de progrès sur ${bloque.seances} séances` }
  const dernier = Date.parse(travail[travail.length - 1].date)
  const recentes = travail.filter((s) => dernier - Date.parse(s.date) <= 56 * JOUR)
  const ev = evolutionForce(exo, recentes.length >= 2 ? recentes : travail)
  if (!ev) return null
  const premiere = recentes.length >= 2 ? recentes[0] : travail[0]
  const semaines = Math.max(1, Math.round((dernier - Date.parse(premiere.date)) / (7 * JOUR)))
  const duree = `en ${semaines} semaine${semaines > 1 ? 's' : ''}`
  const monte = ev.apres.score > ev.avant.score * (exo.suivreE1rm && !enTemps(exo) ? 1.01 : 1)
  if (monte)
    return {
      texte: 'Ça monte',
      classe: 'tenue',
      detail: ev.avant.e1rm && ev.apres.e1rm ? `force estimée +${kg(Math.round((ev.apres.e1rm - ev.avant.e1rm) * 2) / 2)} kg ${duree}` : `${chargeQte(exo, ev.avant.serie.charge, ev.avant.serie.reps)} → ${chargeQte(exo, ev.apres.serie.charge, ev.apres.serie.reps)} ${duree}`,
    }
  return { texte: ev.apres.score < ev.avant.score * 0.98 ? 'Un peu en dessous' : 'Stable', classe: 'faible', detail: `sur les ${semaines} dernière${semaines > 1 ? 's' : ''} semaine${semaines > 1 ? 's' : ''}` }
}

/** Fiche d'un exercice sur une page : où j'en suis, la courbe, puis le détail à un appui. */
export function Detail({
  exo,
  seances,
  onRetour,
  onModifier,
  onSupprimer,
  onDupliquer,
  copieDe,
  equivalents,
  suggestions,
  onRelier,
  onRelierExo,
  onDelier,
  enSeche,
  pistes,
}: {
  exo: Exercice
  seances: Seance[]
  onRetour: () => void
  onModifier: () => void
  onSupprimer: () => void
  /** Copie de l'exercice (variante : autre machine, autre prise), reliée comme équivalent. */
  onDupliquer?: () => void
  /** Nom de l'exercice d'origine, juste après un « Dupliquer » : on le dit clairement. */
  copieDe?: string
  /** Exercices reliés, avec leur dernière meilleure série. */
  equivalents: { exo: Exercice; derniere?: string }[]
  /** Remplaçants possibles non reliés (même muscle). */
  suggestions: Exercice[]
  onRelier: () => void
  onRelierExo: (id: string) => void
  onDelier: (id: string) => void
  enSeche?: boolean
  /** Exercice bloqué : pistes chiffrées, jamais une cause. */
  pistes?: string[]
}) {
  const [menu, setMenu] = useState(false)
  useRetour(menu, () => setMenu(false))
  // Exercice de base modifié par l'utilisateur (sa version est enregistrée par-dessus) : on peut revenir à l'original.
  const modifie = useLiveQuery(async () => !exo.perso && !!EXERCICES[exo.id] && !!(await db.exercices.get(exo.id)), [exo.id, exo.perso], false)
  const revenirOriginal = async () => {
    setMenu(false)
    if (
      await confirmer(`Nom, muscles, matériel, palier et consignes reprennent les valeurs de l’appli${exo.image ? ', et ta photo est retirée' : ''}. Ton historique ne change pas.`, {
        titre: 'Revenir à l’original ?',
        oui: 'Revenir à l’original',
      })
    )
      await db.exercices.delete(exo.id)
  }
  const temps = enTemps(exo)
  const [mesure, setMesure] = useState<Mesure>(temps ? 'temps' : exo.suivreE1rm ? 'force' : 'charge')
  const [periode, setPeriode] = useState(91)
  const avec = seances.filter((s) => s.series.some((x) => x.exoId === exo.id))
  const chrono = [...avec].reverse()
  const seriesDe = (s: Seance) => s.series.filter((x) => x.exoId === exo.id)
  const forceDe = (s: Seance) => Math.max(0, ...seriesDe(s).map((x) => e1rm(exo, x, s.poidsCorps) ?? 0))

  const derniere = avec.find((s) => !s.deload) ?? avec[0]
  const meilleure = derniere && meilleureSerie(seriesDe(derniere), exo.assistance)
  const verdict = lectureExo(exo, chrono, enSeche)

  const toutes = avec.flatMap((s) => seriesDe(s))
  const repsParCharge = new Map<number, number>()
  for (const x of toutes) repsParCharge.set(x.charge, Math.max(repsParCharge.get(x.charge) ?? 0, x.reps))

  // Courbe : un point par séance sur la période choisie
  const depuis = periode ? Date.now() - periode * JOUR : 0
  const points = chrono
    .filter((s) => s.debut >= depuis)
    .map((s) => ({ date: s.date, valeur: mesure === 'force' ? forceDe(s) : mesure === 'temps' ? Math.max(...seriesDe(s).map((x) => x.reps)) : Math.max(...seriesDe(s).map((x) => x.charge)) }))
    .filter((p) => mesure !== 'force' || p.valeur > 0)
  const formatMesure = (v: number) => (mesure === 'temps' ? `${v} s` : mesure === 'charge' ? chargeTexte(exo, v) : `${kg(Math.round(v * 10) / 10)} kg`)
  const secondaires = exo.secondaires?.map((x) => nomMuscle(x.muscle).toLowerCase()).join(', ')

  return (
    <div>
      <div className="entete">
        <button className="btn" onClick={onRetour} aria-label="Retour">
          ←
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2>{exo.nom}</h2>
          <div className="faible">
            {nomMuscle(exo.muscle)}
            {secondaires ? ` · aussi ${secondaires}` : ''}
          </div>
        </div>
        <button className="icone" onClick={() => setMenu(true)} aria-label="Plus d’actions">
          <MoreHorizontal size={22} />
        </button>
      </div>
      {copieDe && (
        <div className="carte pile bandeau-copie">
          <strong>Copie de « {copieDe} » créée</strong>
          <div className="faible">C’est un nouvel exercice, sans historique, relié à l’original comme équivalent. L’original n’a pas changé.</div>
          <button className="btn petit" onClick={onModifier}>
            Renommer la copie
          </button>
        </div>
      )}
      {exo.image && <img src={exo.image} alt={exo.nom} className="photo-grande" />}

      {derniere && meilleure ? (
        <div className="carte fiche-reponse">
          <div className="faible">Dernière fois, {dateCourte(derniere.date)}</div>
          <div className="fiche-perf">{chargeQte(exo, meilleure.charge, meilleure.reps)}</div>
          {effortDe(seriesDe(derniere)) && <div className="faible">{effortDe(seriesDe(derniere))}</div>}
          {verdict ? (
            <div className="fiche-verdict">
              <strong className={verdict.classe}>{verdict.texte}</strong>
              {verdict.detail && <span className="faible"> · {verdict.detail}</span>}
              {pistes && pistes.length > 0 && <div className="faible">Pistes : {pistes.join(' · ')}</div>}
            </div>
          ) : (
            <div className="fiche-verdict faible">Première séance : elle sert de repère.</div>
          )}
        </div>
      ) : (
        <div className="carte faible">Pas encore fait. Ta première séance donnera le repère.</div>
      )}

      {avec.length >= 2 && (
        <div className="carte pile">
          {exo.suivreE1rm && !temps && (
            <div className="ligne" style={{ gap: 'var(--e2)' }}>
            <div className="segments" role="tablist" style={{ marginBottom: 0, flex: 1 }}>
              <button role="tab" aria-selected={mesure === 'force'} className={mesure === 'force' ? 'actif' : ''} onClick={() => setMesure('force')}>
                Force
              </button>
              <button role="tab" aria-selected={mesure === 'charge'} className={mesure === 'charge' ? 'actif' : ''} onClick={() => setMesure('charge')}>
                Charge
              </button>
            </div>
            <Aide titre="Force estimée" texte={LEXIQUE.find((l) => l[0] === 'Force estimée')![1]} />
            </div>
          )}
          {points.length >= 2 ? (
            <Courbe key={mesure + periode} points={points} format={formatMesure} />
          ) : (
            <div className="faible" style={{ padding: 'var(--e5) 0', textAlign: 'center' }}>
              {mesure === 'force' && exo.mode === 'poids_corps' ? 'La force estimée demande ton poids du jour : note-le à l’accueil.' : 'Pas assez de séances sur cette période.'}
            </div>
          )}
          <div className="chips">
            {PERIODES.map(([nom, j]) => (
              <button key={nom} className={periode === j ? 'actif' : ''} onClick={() => setPeriode(j)}>
                {nom}
              </button>
            ))}
          </div>
        </div>
      )}

      {avec.length > 0 && (
        <details className="depliable">
          <summary>
            <span>
              Historique <span className="faible">· {avec.length} séance{avec.length > 1 ? 's' : ''}</span>
            </span>
            <ChevronRight size={20} className="muted depliable-chevron" />
          </summary>
          <div className="depliable-corps pile">
            {avec.map((s) => (
              <div key={s.id}>
                <div className="faible">
                  {dateCourte(s.date)} · {s.nom}
                  {s.deload ? ' · allégée' : ''}
                </div>
                <div>
                  {seriesDe(s)
                    .map((x) => serieTexte(exo, x, true))
                    .join(' · ')}
                </div>
                <div className="faible">{effortDe(seriesDe(s))}</div>
                {s.notes[exo.id] && <div className="faible">Note : {s.notes[exo.id]}</div>}
              </div>
            ))}
          </div>
        </details>
      )}

      {repsParCharge.size > 0 && !temps && (
        <details className="depliable">
          <summary>
            <span>Records</span>
            <ChevronRight size={20} className="muted depliable-chevron" />
          </summary>
          <div className="depliable-corps">
            <div className="faible" style={{ marginBottom: 'var(--e2)' }}>
              Le plus de reps à chaque charge.
            </div>
            {[...repsParCharge.entries()]
              .sort((a, b) => (exo.assistance ? a[0] - b[0] : b[0] - a[0]))
              .slice(0, 6)
              .map(([ch, r]) => (
                <div key={ch} className="ligne entre">
                  <span>{chargeTexte(exo, ch)}</span>
                  <strong>{qte(exo, r)}</strong>
                </div>
              ))}
          </div>
        </details>
      )}

      {consigne(exo.id) && (
        <details className="depliable" open={avec.length === 0}>
          <summary>
            <span>Comment le faire</span>
            <ChevronRight size={20} className="muted depliable-chevron" />
          </summary>
          <div className="depliable-corps pile">
            <Consignes exo={exo} />
          </div>
        </details>
      )}

      <details className="depliable">
        <summary>
          <span>
            Réglages
            <span className="faible prog-sous">{resumeReglages(exo)}</span>
          </span>
          <ChevronRight size={20} className="muted depliable-chevron" />
        </summary>
        <div className="depliable-corps pile">
          <ContenuReglages key={exo.id} exo={exo} />
        </div>
      </details>

      <details className="depliable">
        <summary>
          <span>
            Remplaçants
            {equivalents.length > 0 && <span className="faible"> · {equivalents.length}</span>}
          </span>
          <ChevronRight size={20} className="muted depliable-chevron" />
        </summary>
        <div className="depliable-corps pile">
          <div className="faible">Quand la machine est prise. Les exercices reliés sont proposés en premier ; chacun garde sa propre progression.</div>
          {equivalents.map((e) => (
            <div key={e.exo.id} className="ligne entre">
              <span>
                <strong>{e.exo.nom}</strong>
                {e.derniere && <div className="faible">dernière fois : {e.derniere}</div>}
              </span>
              <button className="btn discret petit" onClick={() => onDelier(e.exo.id)}>
                Délier
              </button>
            </div>
          ))}
          {suggestions.map((e) => (
            <div key={e.id} className="ligne entre">
              <span>{e.nom}</span>
              <button className="btn petit" onClick={() => onRelierExo(e.id)}>
                + Relier
              </button>
            </div>
          ))}
          <button className="btn plein" onClick={onRelier}>
            Relier un autre exercice
          </button>
        </div>
      </details>

      {menu && (
        <div className="modal-fond" onClick={() => setMenu(false)}>
          <div className="modal pile" onClick={(e) => e.stopPropagation()}>
            <h3>{exo.nom}</h3>
            <button className="liste-btn" onClick={() => (setMenu(false), onModifier())}>
              <span>Modifier</span>
            </button>
            {onDupliquer && (
              <button className="liste-btn" onClick={() => (setMenu(false), onDupliquer())}>
                <span>
                  Dupliquer
                  <span className="faible prog-sous">Autre machine, autre prise : sans historique, relié à l’original</span>
                </span>
              </button>
            )}
            {modifie && (
              <button className="liste-btn" onClick={() => void revenirOriginal()}>
                <span>Revenir à l’original</span>
              </button>
            )}
            <button className="liste-btn" onClick={() => (setMenu(false), onSupprimer())}>
              <span style={exo.perso ? { color: 'var(--danger)' } : undefined}>{exo.perso ? 'Supprimer l’exercice' : 'Masquer de la liste'}</span>
            </button>
            <button className="btn discret plein" onClick={() => setMenu(false)}>
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
