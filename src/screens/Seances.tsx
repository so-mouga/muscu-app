import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { ID_PROGRAMME_DEFAUT, type Catalogue } from '../catalogue'
import ChoixExo from '../components/ChoixExo'
import EditeurExoPlan from '../components/EditeurExoPlan'
import InfosExo from '../components/InfosExo'
import VolumeMuscles from '../components/VolumeMuscles'
import { Aide, AIDE_CYCLE, LancerCycle, VueCycle } from '../components/Cycle'
import { confirmer, informer } from '../components/Dialogues'
import { cibles, copieSeances, etatCycle, volumeProgramme } from '../lib/cycle'
import { MUSCLES } from '../data/exercices'
import { MODELES } from '../data/programme'
import { db, setReglage, uid } from '../db'
import { chargeTexte, dureeEstimee, dureeTexte, kg, minutes, reposTexte, schemaPlan, semaineType, volumePrevu } from '../lib/calc'
import { transition, useRetour } from '../lib/nav'
import type { Exercice, ExoPlan, Programme, Seance, SeanceModele } from '../types'
import SilhouetteVolume from '../components/SilhouetteVolume'
import { ReglageEchauffement } from '../components/Echauffement'
import { deplacer, useGlisser } from '../lib/glisser'

export const JOURS = ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']

/** Plan par défaut d'un exercice ajouté (modifiable juste après). */
export function planParDefaut(exo: Exercice): ExoPlan {
  // Exercice en temps (gainage…) : 3 × 30 s, repos court.
  if (exo.mesure === 'temps')
    return { exoId: exo.id, repos: 60, series: [0, 1, 2].map(() => ({ repsMin: 30, repsMax: 30, rpe: 8 })), chauffes: [], finisseur: false, charge: 0 }
  const petit = exo.muscle === 'mollets' || exo.muscle === 'abdos'
  const compose = exo.type === 'compose'
  // Un seul nombre de reps par série (3 × 10, 3 × 12) ; la fourchette reste une option avancée.
  const reps = compose ? 10 : 12
  return {
    exoId: exo.id,
    repos: petit ? 90 : compose ? 180 : 150,
    series: [0, 1, 2].map(() => ({ repsMin: reps, repsMax: reps, rpe: 8 })),
    chauffes: [],
    finisseur: false,
    charge: null,
  }
}

export function resumePlan(exo: Exercice, p: ExoPlan): string {
  // Le RPE n'apparaît que s'il s'écarte du réglage par défaut (8) : on lit d'abord reps, charge, repos.
  const rpeParDefaut = p.series.every((x) => x.rpe === 8) || (p.finisseur && p.series.slice(0, -1).every((x) => x.rpe === 8))
  return [
    schemaPlan(exo, p),
    p.charge === null ? '' : chargeTexte(exo, p.charge),
    `repos ${reposTexte(p)}`,
    rpeParDefaut ? '' : `RPE ${p.series.map((x) => kg(x.rpe)).join(', ')}`,
    p.finisseur ? '★ finisseur' : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

type Vue =
  | { type: 'programme'; p: Programme; initial: Programme; nouveau: boolean }
  | { type: 'seance'; m: SeanceModele; nouvelle: boolean; /** Ajouter la séance créée au programme en dessous. */ pourProgramme?: boolean }
  | { type: 'cycle' }

export const jourCourt = (j?: number) => (j ? JOURS[j].slice(0, 3) : '')

/** Enregistre un programme ; le programme de départ (virtuel) est conservé dès qu'on en crée un autre. */
async function sauverProgramme(p: Programme, catalogue: Catalogue) {
  if ((await db.programmes.count()) === 0 && p.id !== ID_PROGRAMME_DEFAUT) await db.programmes.put(catalogue.programmes[0])
  await db.programmes.put(p)
}

export default function Seances({ catalogue }: { catalogue: Catalogue }) {
  const [pile, setPile] = useState<Vue[]>([])
  const masquees = useLiveQuery(() => db.modeles.filter((m) => !!m.supprime).toArray(), [], [])
  const terminees = useLiveQuery(() => db.seances.filter((s) => !s.enCours).toArray(), [])
  const vue = pile[pile.length - 1]
  const [lancer, setLancer] = useState(false)

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
        // Ouverte depuis un programme : c'est lui qui gère son contenu.
        pourProgramme={pile[pile.length - 2]?.type === 'programme'}
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
  if (vue?.type === 'cycle' && catalogue.cycle) return <VueCycle catalogue={catalogue} cycle={catalogue.cycle} onFermer={() => fermer()} />
  if (vue?.type === 'programme')
    return (
      <EditeurProgramme
        key={vue.initial.id}
        catalogue={catalogue}
        vue={vue}
        terminees={terminees}
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
      {catalogue.cycle ? (
        (() => {
          const e = etatCycle(catalogue.cycle)
          return (
            <button className="liste-btn bandeau-cycle" style={{ borderColor: 'var(--accent)' }} onClick={() => ouvrir({ type: 'cycle' })}>
              <span>
                <span className="faible">Cycle en cours</span>
                <strong>🔁 {catalogue.cycle.programme.nom}</strong>
                <span className="faible">
                  {e.fini ? 'terminé : voir le bilan' : e.n <= 0 ? 'commence la semaine prochaine' : e.pause ? 'semaine en pause' : `semaine ${e.n}/${e.total}${e.deload ? ' · 🧘 déload' : ''}`}
                </span>
              </span>
              <span className="muted">›</span>
            </button>
          )
        })()
      ) : (
        <div className="carte pile">
          <div className="ligne entre">
            <strong>Pas de cycle en cours</strong>
            <Aide texte={AIDE_CYCLE} />
          </div>
          <div className="faible">Lance ton programme pour 6 semaines avec un déload à la fin : l’appli suit les semaines et allège le déload toute seule.</div>
          <button className="btn primaire plein" onClick={() => setLancer(true)}>
            Lancer un cycle
          </button>
        </div>
      )}
      {lancer && <LancerCycle catalogue={catalogue} onFermer={() => setLancer(false)} />}
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
      <button className="btn plein" style={{ marginBottom: 24 }} onClick={() => ouvrirProgramme({ id: 'p_' + uid(), nom: '', seances: [], volume: { ...(catalogue.cycle?.volume ?? volumeProgramme(catalogue.actif)) } }, true)}>
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
                  {m.exercices.length} exercice{m.exercices.length > 1 ? 's' : ''} · {dureeTexte(m, terminees)}
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
  terminees,
  vue,
  setP,
  onOuvrirSeance,
  onNouvelleSeance,
  onFermer,
}: {
  catalogue: Catalogue
  terminees: Seance[] | undefined
  vue: Extract<Vue, { type: 'programme' }>
  setP: (p: Programme) => void
  onOuvrirSeance: (m: SeanceModele) => void
  onNouvelleSeance: () => void
  onFermer: () => void
}) {
  const { p, initial, nouveau } = vue
  const [choix, setChoix] = useState(false)
  const [lancer, setLancer] = useState(false)
  const [voirVolume, setVoirVolume] = useState(false)
  const modifie = JSON.stringify(p) !== JSON.stringify(initial)
  const actif = catalogue.actif.id === p.id
  const enBase = catalogue.programmes.some((x) => x.id === p.id)
  useRetour(choix, () => setChoix(false))

  // Enregistrement automatique : chaque changement est écrit peu après (dès que le programme a un nom).
  const finaleDe = (x: Programme) => ({ ...x, nom: x.nom.trim(), description: x.description?.trim() || undefined, seances: x.seances.filter((e) => catalogue.modele(e.modeleId)) })
  const [enregistre, setEnregistre] = useState(false)
  useEffect(() => {
    if (!modifie || !p.nom.trim()) return
    const t = setTimeout(() => void sauverProgramme(finaleDe(p), catalogue).then(() => setEnregistre(true)), 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p])

  // En quittant : dernier enregistrement, puis, pour le programme du cycle en cours, la question du cycle.
  const quitter = async () => {
    if (modifie && p.nom.trim()) {
      const finale = finaleDe(p)
      await sauverProgramme(finale, catalogue)
      const c = catalogue.cycle
      if (
        c &&
        c.programmeId === finale.id &&
        (await confirmer(`« ${finale.nom} » est le programme du cycle en cours. Tes changements sont enregistrés dans le programme ; tu choisis s’ils s’appliquent dès maintenant au cycle, ou seulement au prochain.`, {
          titre: 'Appliquer au cycle en cours ?',
          oui: 'Appliquer au cycle en cours',
          non: 'Seulement pour le prochain cycle',
        }))
      )
        await db.cycles.update(c.id, { programme: finale, modeles: copieSeances(finale, catalogue.modele), volume: { ...volumeProgramme(finale) } })
    }
    onFermer()
  }
  useRetour(true, () => {
    void quitter()
    return 'rester'
  })

  const maj = (f: (x: Programme) => void) => {
    const c = structuredClone(p)
    f(c)
    setP(c)
  }
  const entrees = p.seances.map((e, i) => ({ e, i, m: catalogue.modele(e.modeleId) })).filter((x) => x.m)
  // Les positions de la liste affichée renvoient aux indices du programme (séances disparues ignorées).
  const glisser = useGlisser('.exo-ligne', (de, vers) =>
    maj((x) => {
      const s = x.seances[entrees[de].i]
      const avant = vers < entrees.length ? x.seances[entrees[vers].i] : null
      x.seances.splice(entrees[de].i, 1)
      x.seances.splice(avant ? x.seances.indexOf(avant) : x.seances.length, 0, s)
    })
  )
  const valide = p.nom.trim() !== '' && entrees.length > 0

  const activer = async () => {
    await sauverProgramme(finaleDe(p), catalogue)
    await setReglage('programmeActif', p.id)
  }
  const dupliquer = async () => {
    await sauverProgramme({ ...structuredClone(p), id: 'p_' + uid(), nom: `${p.nom.trim()} (copie)` }, catalogue)
    onFermer()
  }
  const supprimer = async () => {
    if (catalogue.programmes.length <= 1) return informer('Il faut garder au moins un programme.')
    if (!(await confirmer('Ses séances restent dans ta bibliothèque.', { titre: `Supprimer le programme « ${p.nom} » ?`, oui: 'Supprimer le programme', danger: true }))) return
    if ((await db.programmes.count()) === 0) await db.programmes.bulkPut(catalogue.programmes)
    await db.programmes.delete(p.id)
    if (actif) await setReglage('programmeActif', catalogue.programmes.find((x) => x.id !== p.id)!.id)
    onFermer()
  }

  return (
    <div>
      <div className="entete">
        <button className="btn" onClick={() => void quitter()}>
          ←
        </button>
        <h2 style={{ flex: 1 }}>{nouveau ? 'Nouveau programme' : 'Programme'}</h2>
        {actif && <span className="pastille accent">actif</span>}
        <EtatEnregistrement nom={p.nom} enregistre={enregistre} />
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
        <div ref={glisser.liste}>
        {entrees.map(({ e, i, m }, k) => (
          <div key={e.modeleId + i} className={'exo-ligne' + glisser.classes(k, entrees.length)}>
            {entrees.length > 1 && (
              <button className="poignee" aria-label={`Déplacer ${m!.nom}`} {...glisser.poignee(k)}>
                ⠿
              </button>
            )}
            <button className="texte" onClick={() => onOuvrirSeance(m!)}>
              <strong>{m!.nom}</strong>
              <div className="faible">
                {m!.sousTitre ? m!.sousTitre + ' · ' : ''}
                {m!.exercices.length} exo{m!.exercices.length > 1 ? 's' : ''} · {dureeTexte(m!, terminees)} ›
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
            <button className="icone" aria-label="Retirer" onClick={() => maj((x) => x.seances.splice(i, 1))}>
              ✕
            </button>
          </div>
        ))}
        </div>
        {entrees.length > 1 && <div className="faible" style={{ marginTop: 6 }}>Pour changer l’ordre, maintiens la poignée ⠿ d’une séance puis fais-la glisser.</div>}
        <button className="btn plein" style={{ marginTop: 12 }} onClick={() => setChoix(true)}>
          + Ajouter une séance
        </button>
      </div>

      {entrees.length > 0 &&
        (() => {
          // Replié par défaut : une ligne de résumé, le détail (et le réglage des objectifs) à la demande.
          const volume = volumePrevu(semaineType(p).map((e) => catalogue.modele(e.modeleId)).filter((m) => !!m), catalogue.exercices)
          const c = cibles(undefined, p)
          const suivis = MUSCLES.filter((m) => c[m.id] > 0)
          const retard = suivis.filter((m) => volume[m.id] < c[m.id]).length
          const dessus = suivis.filter((m) => volume[m.id] > c[m.id] * 1.25).length
          return (
            <div className="carte">
              <button type="button" className="groupe-repli" onClick={() => setVoirVolume(!voirVolume)} aria-expanded={voirVolume}>
                <span>
                  <strong>Volume par semaine</strong>
                  <div className="faible">
                    {retard || dessus
                      ? [retard ? `${retard} muscle${retard > 1 ? 's' : ''} sous l’objectif` : '', dessus ? `${dessus} au-dessus` : ''].filter(Boolean).join(' · ')
                      : 'Tous les objectifs sont atteints'}
                  </div>
                </span>
                <span className="muted">{voirVolume ? '▾' : '▸'}</span>
              </button>
              {voirVolume && (
                <>
                  <div className="faible" style={{ margin: '4px 0 10px' }}>
                    Séries dures prévues par muscle{p.seances.some((e) => e.jour) ? ' (séances avec un jour)' : ''}, face aux objectifs de ce programme. Touche
                    un muscle pour changer son objectif.
                  </div>
                  <VolumeMuscles volume={volume} cibles={c} onCible={(muscle, v) => maj((x) => (x.volume = { ...volumeProgramme(x), [muscle]: v }))} />
                </>
              )}
            </div>
          )
        })()}

      {!valide && <div className="faible" style={{ marginTop: 6 }}>Donne-lui un nom et ajoute au moins une séance : tout s’enregistre au fur et à mesure.</div>}
      {(enBase || enregistre) && (
        <div className="ligne wrap" style={{ marginTop: 12 }}>
          {catalogue.cycle?.programmeId !== p.id && (
            <button className="btn primaire" disabled={!valide} onClick={() => setLancer(true)}>
              Lancer un cycle
            </button>
          )}
          {!actif && !catalogue.cycle && (
            <button className="btn" disabled={!valide} onClick={() => void activer()}>
              Activer sans cycle
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

      {lancer && <LancerCycle catalogue={catalogue} programme={p} onFermer={() => setLancer(false)} />}
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
  pourProgramme,
  onFermer,
}: {
  catalogue: Catalogue
  initial: SeanceModele
  nouvelle: boolean
  /** Ouverte depuis un programme : pas de choix de programme ici. */
  pourProgramme: boolean
  /** Reçoit la séance quand elle vient d'être enregistrée. */
  onFermer: (enregistree?: SeanceModele) => void
}) {
  const [m, setM] = useState(initial)
  const [choix, setChoix] = useState(false)
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [infos, setInfos] = useState<Exercice | null>(null)
  // Programmes qui contiennent la séance ; une nouvelle séance va par défaut dans le programme actif.
  const progsInitiaux = catalogue.programmes.filter((p) => p.seances.some((e) => e.modeleId === initial.id)).map((p) => p.id)
  const [progs, setProgs] = useState<string[]>(nouvelle ? [catalogue.actif.id] : progsInitiaux)
  const modifie = JSON.stringify(m) !== JSON.stringify(initial) || (!pourProgramme && [...progs].sort().join() !== [...progsInitiaux].sort().join())
  const prechargee = !!MODELES[m.id]

  // Enregistrement automatique : la séance et ses programmes sont écrits peu après chaque changement.
  const [enregistre, setEnregistre] = useState(false)
  const ecrire = async () => {
    const finale = { ...m, nom: m.nom.trim(), sousTitre: m.sousTitre.trim() }
    await db.modeles.put(finale)
    if (!pourProgramme)
      for (const p of catalogue.programmes) {
        const dedans = p.seances.some((e) => e.modeleId === finale.id)
        if (progs.includes(p.id) && !dedans) await sauverProgramme({ ...p, seances: [...p.seances, { modeleId: finale.id }] }, catalogue)
        if (!progs.includes(p.id) && dedans) await sauverProgramme({ ...p, seances: p.seances.filter((e) => e.modeleId !== finale.id) }, catalogue)
      }
    setEnregistre(true)
    return finale
  }
  useEffect(() => {
    if (!modifie || !m.nom.trim()) return
    const t = setTimeout(() => void ecrire(), 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m, progs])

  // En quittant : dernier enregistrement, puis, pour une séance du cycle en cours, la question du cycle.
  const quitter = async () => {
    if (!modifie || !m.nom.trim()) return onFermer()
    const finale = await ecrire()
    const c = catalogue.cycle
    if (
      JSON.stringify(m) !== JSON.stringify(initial) &&
      c?.modeles.some((x) => x.id === finale.id) &&
      (await confirmer(`« ${finale.nom} » fait partie du cycle en cours. La séance est enregistrée dans ta bibliothèque ; tu choisis si le cycle la prend dès maintenant, ou seulement au prochain cycle.`, {
        titre: 'Appliquer au cycle en cours ?',
        oui: 'Appliquer au cycle en cours',
        non: 'Seulement pour le prochain cycle',
      }))
    )
      await db.cycles.update(c.id, { modeles: c.modeles.map((x) => (x.id === finale.id ? structuredClone(finale) : x)) })
    onFermer(finale)
  }
  useRetour(true, () => {
    void quitter()
    return 'rester'
  })

  const maj = (f: (x: SeanceModele) => void) =>
    setM((x) => {
      const c = structuredClone(x)
      f(c)
      return c
    })
  const [remplace, setRemplace] = useState<number | null>(null)
  /** Exercice dont le menu ⋯ est ouvert (fiche, remplacer, retirer). */
  const [menu, setMenu] = useState<number | null>(null)
  useRetour(menu !== null, () => setMenu(null))
  const glisser = useGlisser('.exo-ligne', (de, vers) => maj((x) => deplacer(x.exercices, de, vers)))

  const finisseurs = m.exercices.filter((e) => e.finisseur).length

  // Séries dures que la séance donne à chaque muscle, du plus travaillé au moins travaillé.
  const volume = volumePrevu([m], catalogue.exercices)
  const travailles = MUSCLES.filter((x) => volume[x.id] > 0).sort((a, b) => volume[b.id] - volume[a.id])
  const valide = m.nom.trim() !== '' && m.exercices.length > 0

  const dupliquer = async () => {
    await db.modeles.put({ ...structuredClone(m), id: 'm_' + uid(), nom: `${m.nom.trim()} (copie)`, jour: undefined })
    onFermer()
  }
  const supprimer = async () => {
    if (!(await confirmer('L’historique des séances faites est conservé.', { titre: `Supprimer « ${m.nom} » ?`, oui: 'Supprimer la séance', danger: true }))) return
    if (prechargee) await db.modeles.put({ ...initial, supprime: true })
    else await db.modeles.delete(m.id)
    onFermer()
  }

  return (
    <div>
      <div className="entete">
        <button
          className="btn"
          onClick={() => void quitter()}
        >
          ←
        </button>
        <h2 style={{ flex: 1 }}>{nouvelle ? 'Nouvelle séance' : 'Modifier la séance'}</h2>
        <EtatEnregistrement nom={m.nom} enregistre={enregistre} />
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
          <span className="faible">Séance de repli proposée sur l’accueil (« 🏠 Pas de salle ») quand tu ne peux pas aller à la salle ce jour-là.</span>
        </label>
        {!pourProgramme && (
          <div className="champ">
            <span>Programme{catalogue.programmes.length > 1 ? 's' : ''}</span>
            <div className="chips">
              {catalogue.programmes.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={progs.includes(p.id) ? 'actif' : ''}
                  onClick={() => setProgs((x) => (x.includes(p.id) ? x.filter((y) => y !== p.id) : [...x, p.id]))}
                >
                  {progs.includes(p.id) ? '✓ ' : ''}
                  {p.nom}
                </button>
              ))}
            </div>
            <span className="faible">
              {progs.length === 0
                ? 'Dans aucun programme : tu la retrouveras dans « Autre séance → Hors programme ».'
                : 'Le jour de la semaine se règle dans le programme (onglet Programmes).'}
            </span>
          </div>
        )}
      </div>

      <ReglageEchauffement modele={m} exo={catalogue.exo} onChange={(v) => maj((x) => (v === undefined ? delete x.echauffement : (x.echauffement = v)))} />

      <div className="carte">
        <div className="ligne entre">
          <h3>Exercices</h3>
          {m.exercices.length > 0 && <span className="faible">≈ {minutes(dureeEstimee(m))}</span>}
        </div>
        {m.exercices.length === 0 && <div className="muted petit" style={{ marginTop: 8 }}>Aucun exercice pour l’instant.</div>}
        <div ref={glisser.liste}>
        {m.exercices.map((p, i) => {
          const exo = catalogue.exo(p.exoId)
          return (
            <div
              key={p.exoId + i}
              className={'exo-ligne' + glisser.classes(i, m.exercices.length)}
            >
              <button className="poignee" aria-label={`Déplacer ${exo.nom}`} {...glisser.poignee(i)}>
                ⠿
              </button>
              <button className="texte" onClick={() => setEditIdx(i)}>
                <strong>
                  {i + 1}. {exo.nom}
                </strong>
                {p.optionnel && <span className="faible"> (optionnel)</span>}
                <div className="faible">{resumePlan(exo, p)}</div>
              </button>
              <button className="icone" onClick={() => setMenu(i)} aria-label={`Actions pour ${exo.nom}`}>
                ⋯
              </button>
            </div>
          )
        })}
        </div>
        {m.exercices.length > 1 && <div className="faible" style={{ marginTop: 6 }}>Pour changer l’ordre, maintiens la poignée ⠿ d’un exercice puis fais-le glisser.</div>}
        <button className="btn plein" style={{ marginTop: 12 }} onClick={() => setChoix(true)}>
          + Ajouter un exercice
        </button>
        {finisseurs > 2 && (
          <div className="faible" style={{ color: 'var(--alerte)', marginTop: 8 }}>
            {finisseurs} finisseurs dans la même séance : c’est beaucoup, la qualité des dernières séries risque d’en pâtir.
          </div>
        )}
      </div>

      {travailles.length > 0 && (
        <div className="carte">
          <h3>Muscles travaillés</h3>
          <div className="faible" style={{ margin: '4px 0 8px' }}>
            Séries dures de cette séance, face aux objectifs de la semaine. Le total de la semaine est dans le programme.
          </div>
          <SilhouetteVolume volume={volume} cibles={cibles(catalogue.cycle, catalogue.actif)} legende="objectif de la semaine" quoi="prévues" />
          {travailles.map((x) => (
            <div key={x.id} className="ligne entre petit" style={{ padding: '4px 0' }}>
              <span>{x.nom}</span>
              <strong>
                {kg(volume[x.id])} série{volume[x.id] >= 2 ? 's' : ''}
              </strong>
            </div>
          ))}
        </div>
      )}

      {!valide && <div className="faible" style={{ marginTop: 6 }}>Donne-lui un nom et ajoute des exercices : tout s’enregistre au fur et à mesure.</div>}
      {(!nouvelle || enregistre) && (
        <div className="ligne wrap" style={{ marginTop: 12 }}>
          <button className="btn" onClick={dupliquer}>
            Dupliquer
          </button>
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
          onChoixMultiple={(ids) => {
            setChoix(false)
            maj((x) => x.exercices.push(...ids.map((id) => planParDefaut(catalogue.exo(id)))))
            // Un seul exercice : on règle son plan tout de suite ; plusieurs : on les règle ensuite un par un.
            if (ids.length === 1) setEditIdx(m.exercices.length)
          }}
        />
      )}
      {infos && <InfosExo exo={infos} onFermer={() => setInfos(null)} />}
      {menu !== null && m.exercices[menu] && (
        <div className="modal-fond" onClick={() => setMenu(null)}>
          <div className="modal pile" onClick={(e) => e.stopPropagation()}>
            <h3>{catalogue.exo(m.exercices[menu].exoId).nom}</h3>
            <button className="liste-btn" onClick={() => (setInfos(catalogue.exo(m.exercices[menu].exoId)), setMenu(null))}>
              <span>ⓘ Voir comment faire l’exercice</span>
            </button>
            <button className="liste-btn" onClick={() => (setRemplace(menu), setMenu(null))}>
              <span>⇄ Remplacer par un autre exercice</span>
            </button>
            <button
              className="liste-btn"
              onClick={async () => {
                const i = menu
                setMenu(null)
                if (await confirmer(`Retirer « ${catalogue.exo(m.exercices[i].exoId).nom} » de la séance ?`, { oui: 'Retirer', danger: true }))
                  maj((x) => x.exercices.splice(i, 1))
              }}
            >
              <span style={{ color: 'var(--danger)' }}>✕ Retirer de la séance</span>
            </button>
            <button className="btn discret plein" onClick={() => setMenu(null)}>
              Fermer
            </button>
          </div>
        </div>
      )}
      {editIdx !== null && m.exercices[editIdx] && (
        <EditeurExoPlan
          key={editIdx}
          exo={catalogue.exo(m.exercices[editIdx].exoId)}
          plan={m.exercices[editIdx]}
          onValider={(p) => {
            maj((x) => (x.exercices[editIdx] = p))
            setEditIdx(null)
          }}
          onPrecedent={
            editIdx > 0
              ? (p) => {
                  maj((x) => (x.exercices[editIdx] = p))
                  setEditIdx(editIdx - 1)
                }
              : undefined
          }
          onSuivant={
            editIdx < m.exercices.length - 1
              ? (p) => {
                  maj((x) => (x.exercices[editIdx] = p))
                  setEditIdx(editIdx + 1)
                }
              : undefined
          }
          onRemplacer={(p) => {
            maj((x) => (x.exercices[editIdx] = p))
            setRemplace(editIdx)
            setEditIdx(null)
          }}
        />
      )}
      {remplace !== null && m.exercices[remplace] && (
        <ChoixExo
          catalogue={catalogue}
          titre={`Remplacer ${catalogue.exo(m.exercices[remplace].exoId).nom}`}
          muscle={catalogue.exo(m.exercices[remplace].exoId).muscle}
          exclure={m.exercices.map((e) => e.exoId)}
          onFermer={() => setRemplace(null)}
          onChoix={(id) => {
            // Même plan (séries, reps, RPE, repos) ; charges et échauffements repartent de zéro (autre machine).
            maj((x) => {
              const ancien = x.exercices[remplace]
              x.exercices[remplace] = {
                ...ancien,
                exoId: id,
                charge: null,
                chauffes: [],
                series: ancien.series.map(({ charge: _c, ...s }) => s),
              }
            })
            setEditIdx(remplace)
            setRemplace(null)
          }}
        />
      )}
    </div>
  )
}

/** « ✓ Enregistré » : l'édition s'enregistre toute seule, on le montre discrètement. */
function EtatEnregistrement({ nom, enregistre }: { nom: string; enregistre: boolean }) {
  if (!nom.trim()) return <span className="faible">à nommer</span>
  return enregistre ? <span className="faible etat-enregistre">✓ Enregistré</span> : null
}
