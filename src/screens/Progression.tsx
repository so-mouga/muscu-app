import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, MoreHorizontal } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import BoutonRetour from '../components/BoutonRetour'
import { confirmer } from '../components/Dialogues'
import { db } from '../db'
import { nomMuscle } from '../components/ChoixExo'
import InfosExo, { Consignes } from '../components/InfosExo'
import { BandeauPhoto, CasePhoto } from '../components/PhotoExo'
import { ContenuReglages, titreReglages } from '../components/ReglagesMachine'
import { consigne } from '../data/consignes'
import { EXERCICES } from '../data/exercices'
import { lectureExo, marquesSeances } from '../lib/constat'
import type { EtapeObjectifs } from '../lib/objectifs'
import { dateCourte, kg, seriesEnClair } from '../lib/calc'
import { useRetour } from '../lib/nav'
import type { Exercice, Seance, Serie } from '../types'

/** Séances montrées sur la fiche avant « Voir les n séances ». */
const SEANCES_VISIBLES = 5

/** L'effort des séries, en clair : « effort 8/10 », ou « effort 7, 8/10 » s'il change. */
const effortDe = (series: Serie[]) => {
  const l = [...new Set(series.map((x) => x.rpe).filter((r) => r > 0))].sort((a, b) => a - b)
  return l.length ? `effort ${l.map(kg).join(', ')}/10` : ''
}

/** Fiche d'un exercice : on lit où on en est. Les décisions se prennent en séance. */
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
  objectifs,
  pistes,
  cap,
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
  /** Frise des phases : les semaines de sèche ne comptent pas dans un blocage. */
  objectifs?: EtapeObjectifs[]
  /** Exercice bloqué : pistes chiffrées, jamais une cause. */
  pistes?: string[]
  /** Le cap de l'exercice, ou de quoi en fixer un (`CapExo`). */
  cap?: ReactNode
}) {
  const [menu, setMenu] = useState(false)
  const [reglages, setReglages] = useState(false)
  const [infos, setInfos] = useState(false)
  const [toutes, setToutes] = useState(false)
  useRetour(menu, () => setMenu(false))
  useRetour(reglages, () => setReglages(false))
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
  const avec = seances.filter((s) => s.series.some((x) => x.exoId === exo.id))
  const chrono = [...avec].reverse()
  const seriesDe = (s: Seance) => s.series.filter((x) => x.exoId === exo.id)

  const derniere = avec.find((s) => !s.deload) ?? avec[0]
  const constat = lectureExo(exo, chrono, enSeche, objectifs)
  const marques = marquesSeances(exo, chrono)
  const secondaires = exo.secondaires?.map((x) => nomMuscle(x.muscle).toLowerCase()).join(', ')
  const aLire = !!(consigne(exo.id) || exo.notes)
  // Jamais fait : rien d'autre à lire, les consignes restent sur la page.
  const consignesSurLaPage = !!consigne(exo.id) && avec.length === 0

  return (
    <div>
      {infos && <InfosExo exo={exo} consignesSeules onFermer={() => setInfos(false)} />}
      <div className="entete">
        <BoutonRetour onClick={onRetour} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2>{exo.nom}</h2>
          <div className="faible">
            {nomMuscle(exo.muscle)}
            {secondaires ? ` · aussi ${secondaires}` : ''}
          </div>
        </div>
        {!exo.image && <CasePhoto exo={exo} />}
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
      {exo.image && <BandeauPhoto exo={exo} />}

      {derniere ? (
        <>
          <div className="carte">
            <div className={`fiche-constat ${constat?.classe ?? 'faible'}`}>{constat?.texte ?? 'Seulement en séance allégée'}</div>
            {constat?.detail && <div className="faible">{constat.detail}</div>}
            {pistes && pistes.length > 0 && <div className="faible" style={{ marginTop: 'var(--e2)' }}>À regarder : {pistes.join(' · ')}</div>}
          </div>
          <div className="carte">
            <div className="faible">Dernière fois, {dateCourte(derniere.date)}</div>
            <div className="fiche-perf">{seriesEnClair(exo, seriesDe(derniere))}</div>
            <div className="faible">{[effortDe(seriesDe(derniere)), derniere.nom].filter(Boolean).join(' · ')}</div>
          </div>
          {cap}
        </>
      ) : (
        <div className="carte">
          <div className="fiche-constat">Pas encore fait</div>
          <div className="faible">Ta première séance donnera le repère.</div>
        </div>
      )}

      {consignesSurLaPage && (
        <div className="carte pile">
          <h3>Comment le faire</h3>
          <Consignes exo={exo} />
        </div>
      )}

      <div className={`fiche-duo${aLire && !consignesSurLaPage ? '' : ' seul'}`}>
        {aLire && !consignesSurLaPage && (
          <button className="liste-btn" onClick={() => setInfos(true)}>
            <span>Comment le faire</span>
            <ChevronRight size={20} className="muted" />
          </button>
        )}
        <button className="liste-btn" onClick={() => setReglages(true)}>
          <span>Réglages</span>
          <ChevronRight size={20} className="muted" />
        </button>
      </div>

      {avec.length > 1 && (
        <>
          <h3 className="prog-groupe">Tes séances</h3>
          <div className="carte">
            <div className="fiche-seances">
              {(toutes ? avec : avec.slice(0, SEANCES_VISIBLES)).flatMap((s) => {
                const m = marques.get(s.id)
                return [
                  <span key={s.id + ':date'} className="faible">
                    {dateCourte(s.date).replace(/^\S+\s/, '')}
                  </span>,
                  <span key={s.id + ':series'}>{seriesEnClair(exo, seriesDe(s))}</span>,
                  <span key={s.id + ':marque'} className={`fiche-marque ${m?.classe ?? ''}`}>
                    {m?.texte}
                  </span>,
                  ...(s.notes[exo.id]
                    ? [
                        <span key={s.id + ':note'} className="fiche-note faible">
                          Note : {s.notes[exo.id]}
                        </span>,
                      ]
                    : []),
                ]
              })}
            </div>
            {!toutes && avec.length > SEANCES_VISIBLES && (
              <button className="btn plein" style={{ marginTop: 'var(--e2)' }} onClick={() => setToutes(true)}>
                Voir les {avec.length} séances
              </button>
            )}
          </div>
        </>
      )}

      {reglages && (
        <div className="modal-fond" onClick={() => setReglages(false)}>
          <div className="modal modal-colonne" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-tete">{titreReglages(exo)}</h2>
            <div className="modal-defile pile">
              <ContenuReglages key={`${exo.id}:${exo.pas}:${exo.chargeMax}`} exo={exo} />
              <h3>Remplaçants</h3>
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
              <button className="btn discret plein" onClick={() => setReglages(false)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {menu && (
        <div className="modal-fond" onClick={() => setMenu(false)}>
          <div className="modal pile" onClick={(e) => e.stopPropagation()}>
            <h3>{exo.nom}</h3>
            <button className="liste-btn" onClick={() => (setMenu(false), onModifier())}>
              <span>Modifier l’exercice</span>
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
