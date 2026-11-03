import { useEffect, useRef, useState } from 'react'
import { MUSCLES } from '../data/exercices'
import { db, uid } from '../db'
import { POIDS_BARRES, type PoidsBarre } from '../lib/disques'
import { photoReduite } from '../lib/image'
import { kg } from '../lib/calc'
import { secondairesProposes } from '../lib/secondaires'
import type { Exercice, ModeCharge, Muscle } from '../types'
import Interrupteur from './Interrupteur'
import { informer } from './Dialogues'

const MATERIELS: [ModeCharge, string][] = [
  ['machine', 'Machine, barre, poulie'],
  ['par_main', 'Haltères'],
  ['poids_corps', 'Poids du corps'],
  ['elastique', 'Élastique'],
]
/** Les mêmes qu'en séance, dans les réglages de la machine. */
const PALIERS = [1, 1.25, 2, 2.5, 5, 10]
const palierDefaut = (m: ModeCharge) => (m === 'elastique' ? 1 : m === 'par_main' ? 2 : 2.5)
const nombre = (t: string) => {
  const v = parseFloat(t.replace(',', '.'))
  return v > 0 ? v : undefined
}

interface Props {
  /** Exercice à modifier ; absent = création. */
  initial?: Exercice
  nomInitial?: string
  muscleInitial?: Muscle
  onEnregistre: (exo: Exercice) => void
  onAnnuler: () => void
  /** Dans sa propre fenêtre : un appui à côté la ferme en gardant ce qui est saisi (s'il est complet). */
  fenetre?: boolean
}

/**
 * Créer ou modifier un exercice : l'essentiel d'abord, le reste replié. En modification, tout
 * s'enregistre tout seul, y compris en quittant par le retour ; à la création, « Créer » valide.
 */
export default function FormExo({ initial, nomInitial = '', muscleInitial, onEnregistre, onAnnuler, fenetre = false }: Props) {
  const [nom, setNom] = useState(initial?.nom ?? nomInitial)
  // Pas de muscle par défaut : un exercice de jambes ne doit pas finir dans « Pecs » par inattention.
  const [muscle, setMuscle] = useState<Muscle | ''>(initial?.muscle ?? muscleInitial ?? '')
  const [secondaires, setSecondaires] = useState(initial?.secondaires ?? [])
  const [mode, setMode] = useState<ModeCharge>(initial?.mode ?? 'machine')
  const [pas, setPas] = useState(initial?.pas ?? 2.5)
  const [autreOuvert, setAutreOuvert] = useState(!!initial && !PALIERS.includes(initial.pas))
  const [autre, setAutre] = useState(initial && !PALIERS.includes(initial.pas) ? kg(initial.pas) : '')
  // Charge maximale du matériel (haut de la pile, haltères les plus lourds) : vide = pas de limite.
  const [max, setMax] = useState(initial?.chargeMax !== undefined ? kg(initial.chargeMax) : '')
  const [assiste, setAssiste] = useState(!!initial?.assistance)
  const [compose, setCompose] = useState(initial ? initial.type === 'compose' : false)
  const [temps, setTemps] = useState(initial?.mesure === 'temps')
  // Calculateur de disques : réglé exercice par exercice ; un exercice créé n'en a pas tant qu'on ne l'active pas.
  const [disques, setDisques] = useState(initial?.barre !== undefined)
  const [barre, setBarre] = useState<PoidsBarre>((initial?.barre ?? 20) as PoidsBarre)
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [image, setImage] = useState(initial?.image)
  const [chargement, setChargement] = useState(false)

  // Muscles secondaires : à la création, proposés d'après le muscle et le type (comme les exercices de
  // base), tant qu'on n'y a pas touché ; la liste complète seulement sur « + Ajouter ».
  const [secondairesTouches, setSecondairesTouches] = useState(!!initial)
  const [toutesSecondaires, setToutesSecondaires] = useState(false)
  useEffect(() => {
    if (!secondairesTouches && muscle) setSecondaires(secondairesProposes(muscle, compose ? 'compose' : 'isolation'))
  }, [muscle, compose, secondairesTouches])

  const basculerSecondaire = (m: Muscle) =>
    setSecondaires((x) => (x.some((s) => s.muscle === m) ? x.filter((s) => s.muscle !== m) : [...x, { muscle: m, coef: 0.5 }]))

  const choisirPhoto = async (f: File | undefined) => {
    if (!f) return
    setChargement(true)
    try {
      setImage(await photoReduite(f))
    } catch {
      void informer('Choisis une photo au format JPEG ou PNG.', 'Impossible de lire cette image')
    } finally {
      setChargement(false)
    }
  }

  const estMachine = mode === 'machine'
  const assistee = estMachine && assiste
  const avecMax = mode !== 'poids_corps' && !assistee
  const palier = (autreOuvert && nombre(autre)) || pas
  const complet = !!nom.trim() && !!muscle && !chargement

  const exoSaisi = (): Exercice => {
    const exo: Exercice = {
      ...initial,
      id: initial?.id ?? 'x_' + uid(),
      nom: nom.trim(),
      muscle: muscle as Muscle,
      secondaires: secondaires.filter((s) => s.muscle !== muscle),
      type: compose ? 'compose' : 'isolation',
      mode,
      pas: palier,
      assistance: assistee || undefined,
      chargeMax: avecMax ? nombre(max) : undefined,
      suivreE1rm: compose && !temps && !assistee,
      mesure: temps ? 'temps' : undefined,
      barre: estMachine && disques && !assistee ? barre : undefined,
      notes: notes.trim() || undefined,
      image,
      perso: initial ? initial.perso : true,
    }
    if (!exo.secondaires?.length) delete exo.secondaires
    if (!exo.mesure) delete exo.mesure
    if (exo.barre === undefined) delete exo.barre
    if (exo.chargeMax === undefined) delete exo.chargeMax
    if (!exo.assistance) delete exo.assistance
    return exo
  }
  const ecrire = async (exo: Exercice) => {
    await db.exercices.put(exo)
    // L'ancien réglage de pas (écran Progression) est remplacé par celui de la fiche.
    await db.reglages.delete(`pas:${exo.id}`)
  }
  const creer = async () => {
    const exo = exoSaisi()
    await ecrire(exo)
    onEnregistre(exo)
  }

  // Modification : écrite peu après chaque changement, et en quittant (retour, appui à côté). Pas de changement, pas d'écriture :
  // un exercice de base simplement ouvert ne doit pas devenir « modifié ».
  const signature = (e: Exercice) => JSON.stringify(Object.entries(e).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)))
  const ecrit = useRef(initial ? signature(initial) : '')
  const enregistrerModif = () => {
    if (!initial || !complet) return
    const exo = exoSaisi()
    if (signature(exo) === ecrit.current) return
    ecrit.current = signature(exo)
    void ecrire(exo)
  }
  const dernier = useRef(enregistrerModif)
  dernier.current = enregistrerModif
  useEffect(() => {
    if (!initial) return
    const t = setTimeout(() => dernier.current(), 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nom, muscle, secondaires, mode, pas, autre, autreOuvert, max, assiste, compose, temps, disques, barre, notes, image])
  useEffect(() => () => dernier.current(), [])

  const champs = (
    <>
      <label className="champ">
        <span>Nom</span>
        <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="ex. Pec deck prise neutre" />
      </label>
      <label className="champ">
        <span>Muscle</span>
        <select value={muscle} onChange={(e) => setMuscle(e.target.value as Muscle)}>
          {!muscle && (
            <option value="" disabled>
              Choisis le muscle travaillé…
            </option>
          )}
          {MUSCLES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nom}
            </option>
          ))}
        </select>
      </label>
      <div className="champ">
        <span>Matériel</span>
        <div className="chips">
          {MATERIELS.map(([m, n]) => (
            <button
              key={m}
              type="button"
              className={mode === m ? 'actif' : ''}
              onClick={() => {
                setMode(m)
                setPas(palierDefaut(m))
                setAutreOuvert(false)
                setAutre('')
              }}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      {mode !== 'elastique' && (
        <div className="champ">
          <span>Palier : de combien la charge monte</span>
          <div className="chips">
            {PALIERS.map((p) => (
              <button
                key={p}
                type="button"
                className={!autreOuvert && pas === p ? 'actif' : ''}
                onClick={() => {
                  setPas(p)
                  setAutreOuvert(false)
                }}
              >
                {kg(p)} kg
              </button>
            ))}
            <button type="button" className={autreOuvert ? 'actif' : ''} onClick={() => setAutreOuvert(true)}>
              Autre
            </button>
          </div>
          {autreOuvert && <input inputMode="decimal" aria-label="Autre palier, en kg" placeholder="Palier en kg" value={autre} onChange={(e) => setAutre(e.target.value)} />}
        </div>
      )}

      <details className="depliable form-options">
        <summary>
          <span>Plus d’options</span>
          <span className="muted">›</span>
        </summary>
        <div className="depliable-corps pile">
          {estMachine && <Interrupteur on={assiste} onChange={setAssiste} label="Machine assistée" aide="Les kg notés t’aident : moins de kg = plus dur (tractions ou dips à la machine). Les conseils et les records vont dans ce sens." />}
          <div className="champ">
            <span>Compte aussi pour (une demi-série dans le volume)</span>
            <div className="chips">
              {secondaires
                .filter((s) => s.muscle !== muscle)
                .map((s) => (
                  <button key={s.muscle} type="button" className="actif" onClick={() => (setSecondairesTouches(true), basculerSecondaire(s.muscle))} aria-label={`Retirer ${MUSCLES.find((m) => m.id === s.muscle)!.nom}`}>
                    {MUSCLES.find((m) => m.id === s.muscle)!.nom} ✕
                  </button>
                ))}
              <button type="button" className="btn discret petit" onClick={() => setToutesSecondaires(!toutesSecondaires)}>
                {toutesSecondaires ? 'Fermer' : secondaires.length ? '+ Ajouter' : 'Aucun · + Ajouter'}
              </button>
            </div>
            {toutesSecondaires && (
              <div className="chips">
                {MUSCLES.filter((m) => m.id !== muscle && !secondaires.some((s) => s.muscle === m.id)).map((m) => (
                  <button key={m.id} type="button" onClick={() => (setSecondairesTouches(true), basculerSecondaire(m.id))}>
                    + {m.nom}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Interrupteur on={temps} onChange={setTemps} label="Mesuré en secondes" aide="Gainage, tenues : chaque série se note en secondes plutôt qu’en reps." />
          {temps !== (initial?.mesure === 'temps') && initial && <span className="faible">Pense à régler la durée visée de cet exercice dans tes séances.</span>}
          <Interrupteur
            on={compose}
            onChange={setCompose}
            label="Plusieurs articulations"
            aide="Développé, rowing, squat, soulevé de terre : ta force y est suivie par une estimation, et on lui donne plus de repos. Coupé : une seule articulation (curl, élévation latérale), suivie par ta meilleure série."
          />
          {avecMax && (
            <label className="champ">
              <span>Charge maximale du matériel ({mode === 'elastique' ? 'niveau' : mode === 'par_main' ? 'kg par main' : 'kg'})</span>
              <input inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} placeholder="Pas de limite" />
              <span className="faible">Le haut de la pile, ou tes haltères les plus lourds. L’appli ne propose pas de monter au-delà.</span>
            </label>
          )}
          {estMachine && !assistee && (
            <>
              <Interrupteur on={disques} onChange={setDisques} label="Calculateur de disques" aide="En séance, sous la charge : les disques à mettre de chaque côté (barre, Smith, machine à plaques)." />
              {disques && (
                <div className="champ">
                  <span>Poids de la barre</span>
                  <div className="chips">
                    {POIDS_BARRES.map((b) => (
                      <button key={b} type="button" className={barre === b ? 'actif' : ''} onClick={() => setBarre(b)}>
                        {b === 0 ? 'Disques seuls' : `${b} kg${b === 20 ? ' (barre olympique)' : b === 10 ? ' (Smith)' : ''}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          <label className="champ">
            <span>Note</span>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ex. siège cran 4, dossier 2" />
          </label>
          <div className="champ">
            <span>Photo</span>
            {image && <img src={image} alt="" className="form-photo" />}
            <div className="ligne" style={{ gap: 'var(--e2)' }}>
              <label className="btn" style={{ flex: 1 }}>
                {chargement ? 'Chargement…' : image ? 'Changer la photo' : 'Ajouter une photo'}
                <input type="file" accept="image/*" hidden onChange={(e) => choisirPhoto(e.target.files?.[0])} />
              </label>
              {image && (
                <button type="button" className="btn discret" onClick={() => setImage(undefined)}>
                  Retirer
                </button>
              )}
            </div>
          </div>
        </div>
      </details>
    </>
  )
  const bouton = initial ? (
    <button className="btn plein" onClick={onAnnuler}>
      Terminé
    </button>
  ) : (
    <button className="btn primaire plein" disabled={!complet} onClick={() => void creer()}>
      Créer
    </button>
  )
  const titre = <h2>{initial ? 'Modifier l’exercice' : 'Nouvel exercice'}</h2>

  if (!fenetre)
    return (
      <div className="pile">
        {titre}
        {champs}
        {bouton}
        {!initial && (
          <button type="button" className="btn discret plein" onClick={onAnnuler}>
            Annuler
          </button>
        )}
      </div>
    )
  return (
    <div className="modal-fond" onClick={() => (initial ? onAnnuler() : complet ? void creer() : onAnnuler())}>
      <div className="modal modal-colonne" onClick={(e) => e.stopPropagation()}>
        <div className="modal-tete">{titre}</div>
        <div className="modal-defile pile">{champs}</div>
        <div className="modal-pied">{bouton}</div>
      </div>
    </div>
  )
}
