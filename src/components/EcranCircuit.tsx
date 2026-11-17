import { Check, ChevronRight, Minus, Play, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { alarme, debloquerSon, sonFinSeance, tic, vibrer } from '../lib/appareil'
import { chrono } from '../lib/calc'
import { DECOMPTE, circuitsRestants, dureeCircuit, minuteDe, toursAvant } from '../lib/circuits'
import type { CircuitPlan, MouvCircuit, Seance } from '../types'
import Anneau from './Anneau'
import { majSeance, Photo } from './CarteExo'
import Dessin, { srcDessin } from './Dessin'
import { confirmer } from './Dialogues'

const pluriel = (n: number) => `${n} tour${n > 1 ? 's' : ''}`

/**
 * Un circuit en plein écran, du lancement au résultat. L'heure du top est écrite dans la séance : fermer
 * l'appli ou passer par la liste ne l'arrête pas. Rien d'autre dans la séance ne dépend de cet écran.
 */
export default function EcranCircuit({ seance, circuit, terminees, son }: { seance: Seance; circuit: CircuitPlan; terminees: Seance[]; son: boolean }) {
  const [maintenant, setMaintenant] = useState(Date.now())
  const [grand, setGrand] = useState<MouvCircuit | null>(null)
  useEffect(() => {
    const id = setInterval(() => setMaintenant(Date.now()), 200)
    return () => clearInterval(id)
  }, [])

  const cours = seance.circuitEnCours?.id === circuit.id ? seance.circuitEnCours : null
  const total = dureeCircuit(circuit)
  const ecoule = cours ? (maintenant - cours.depart) / 1000 : 0
  const fini = !!cours && ecoule >= total
  const minute = circuit.type === 'minute'
  const avant = minute ? undefined : toursAvant(terminees, circuit)

  // Sons : les trois dernières secondes du décompte et du circuit, chaque nouvelle minute, la fin. Jamais pour un moment
  // déjà passé (appli rouverte) : seulement ce qui vient d'arriver.
  const dit = useRef('')
  useEffect(() => {
    if (!cours) return
    const dire = (cle: string, retard: number, fn: () => void) => {
      if (dit.current === cle) return
      dit.current = cle
      if (retard < 1.5) fn()
    }
    if (ecoule < 0) {
      const s = Math.ceil(-ecoule)
      if (s <= 3) dire(`d${s}`, s + ecoule, () => (son ? tic() : vibrer(25)))
      return
    }
    if (fini) return dire('fin', ecoule - total, () => (son ? alarme() : vibrer(600)))
    const reste = total - ecoule
    if (reste <= 3) return dire(`f${Math.ceil(reste)}`, Math.ceil(reste) - reste, () => (son ? tic() : vibrer(25)))
    if (minute) {
      const m = minuteDe(circuit, ecoule)
      if (m.reste <= 3) return dire(`m${m.minute}-${Math.ceil(m.reste)}`, Math.ceil(m.reste) - m.reste, () => (son ? tic() : vibrer(25)))
      return dire(`m${m.minute}`, ecoule - m.minute * 60, () => (son ? tic(true) : vibrer(60)))
    }
    dire('top', ecoule, () => (son ? tic(true) : vibrer(60)))
  })

  const lancer = () => {
    debloquerSon()
    dit.current = ''
    void majSeance(seance.id, (s) => {
      s.circuitEnCours = { id: circuit.id, depart: Date.now() + DECOMPTE * 1000, tours: 0 }
    })
  }
  const tours = (delta: number) =>
    majSeance(seance.id, (s) => {
      if (s.circuitEnCours?.id === circuit.id) s.circuitEnCours.tours = Math.max(0, s.circuitEnCours.tours + delta)
    })
  /** Range le circuit : fini jusqu'au bout, arrêté en route ou sauté. */
  const ranger = (passe: boolean) => {
    const derniere = circuitsRestants(seance) <= 1
    const entiere = !passe && derniere && !seance.passes?.length && (seance.circuits ?? []).every((c) => c.id === circuit.id || !seance.circuitsFaits?.[c.id]?.passe)
    // Toute la séance est faite : l'accord joue avec l'affiche « Séance faite. », comme après la dernière série.
    if (entiere) sonFinSeance(son)
    return majSeance(seance.id, (s) => {
      const c = s.circuitEnCours?.id === circuit.id ? s.circuitEnCours : null
      s.circuitsFaits = {
        ...s.circuitsFaits,
        [circuit.id]: { debut: c?.depart ?? Date.now(), fin: Date.now(), ...(!minute && c && { tours: c.tours }), ...(passe && { passe: true }) },
      }
      delete s.circuitEnCours
    })
  }
  const arreter = async () => {
    if (await confirmer(minute ? 'Il sera noté comme sauté.' : 'Les tours déjà comptés sont gardés.', { titre: `Arrêter ${circuit.nom} ?`, oui: 'Arrêter le circuit', non: 'Continuer' })) void ranger(true)
  }

  const liste = (appui: boolean) => (
    <div className="circuit-liste">
      {circuit.mouvements.map((m, k) => (
        <div key={k} className="circuit-mouv">
          <Dessin image={m.image} taille={52} onClick={appui && m.image ? () => setGrand(m) : undefined} />
          <div>
            <strong>{m.nom}</strong>
            {m.detail && <div className="faible">{m.detail}</div>}
          </div>
          {minute && <span className="faible circuit-min">minute {k + 1}</span>}
        </div>
      ))}
    </div>
  )
  const photo = grand?.image && createPortal(<Photo src={srcDessin(grand.image)} titre={grand.nom} onFermer={() => setGrand(null)} />, document.body)

  // Avant de lancer : ce qu'il y a à faire, et les tours à battre.
  if (!cours)
    return (
      <div className="focus-bloc circuit">
        <div>
          <h2>{circuit.nom}</h2>
          <div className="faible">
            {minute
              ? `Une chose par minute${circuit.tours > 1 ? ` · ${circuit.tours} fois les ${circuit.mouvements.length} minutes` : ''} · ${Math.round(total / 60)} min`
              : `${circuit.minutes} minutes · enchaîne, autant de tours que tu peux`}
          </div>
        </div>
        {liste(true)}
        {minute && <div className="faible">Fais le mouvement, puis souffle jusqu’au bip. Le téléphone annonce la suite.</div>}
        <div className="circuit-pousse" />
        {avant !== undefined && (
          <div className="voix-duel">
            Bats {avant}.<small>la dernière fois : {pluriel(avant)}</small>
          </div>
        )}
        <button type="button" className="btn primaire grand" onClick={lancer}>
          <Play size={18} fill="currentColor" /> Lancer les {Math.round(total / 60)} min
        </button>
        <button type="button" className="btn discret plein" onClick={() => void ranger(true)}>
          Passer ce circuit
        </button>
        {photo}
      </div>
    )

  // Le résultat : le temps est écoulé. Les tours se corrigent encore (le dernier se finit souvent après le bip).
  if (fini) {
    const t = cours.tours
    return (
      <div className="focus-bloc circuit">
        <div className="circuit-pousse" />
        <div className="voix grand">{circuit.nom} fini.</div>
        {minute ? (
          <div className="voix voix-gris">{Math.round(total / 60)} minutes tenues.</div>
        ) : (
          <>
            <div className="voix voix-gris">
              {pluriel(t)} en {circuit.minutes} min.
            </div>
            {avant !== undefined && <div className={t > avant ? 'ok-texte' : 'faible'}>{t > avant ? `+${t - avant} sur la dernière fois` : t === avant ? 'Comme la dernière fois' : `La dernière fois : ${pluriel(avant)}`}</div>}
            <div className="circuit-corrige">
              <button type="button" className="btn" onClick={() => void tours(-1)} disabled={!t} aria-label="Retirer un tour">
                <Minus size={18} />
              </button>
              <span className="faible">{pluriel(t)}</span>
              <button type="button" className="btn" onClick={() => void tours(1)} aria-label="Ajouter un tour">
                <Plus size={18} />
              </button>
            </div>
          </>
        )}
        <div className="circuit-pousse" />
        <button type="button" className="btn primaire grand" onClick={() => void ranger(false)}>
          Continuer <ChevronRight size={20} />
        </button>
      </div>
    )
  }

  // Le décompte avant le top.
  if (ecoule < 0)
    return (
      <div className="focus-bloc circuit centre">
        <div className="faible">{circuit.nom} · prépare-toi</div>
        <div className="circuit-pousse" />
        <div className="circuit-decompte">{Math.ceil(-ecoule)}</div>
        <div className="voix">{circuit.mouvements[0]?.nom}</div>
        <div className="circuit-pousse" />
        <button type="button" className="btn discret plein" onClick={() => void majSeance(seance.id, (s) => void delete s.circuitEnCours)}>
          Annuler
        </button>
      </div>
    )

  if (minute) {
    const m = minuteDe(circuit, ecoule)
    const mouv = circuit.mouvements[m.rang]
    const suivant = m.minute + 1 >= circuit.mouvements.length * circuit.tours ? null : circuit.mouvements[(m.rang + 1) % circuit.mouvements.length]
    return (
      <div className="focus-bloc circuit centre">
        <div className="faible">
          {circuit.tours > 1 ? `Passage ${m.passage + 1} sur ${circuit.tours} · ` : ''}minute {m.rang + 1} sur {circuit.mouvements.length}
        </div>
        <Anneau valeur={m.reste / 60} taille={150} epaisseur={8} couleur={m.reste <= 3 ? 'var(--alerte)' : 'var(--info)'} label="Temps avant la suite">
          <div className="circuit-temps">{chrono(Math.ceil(m.reste))}</div>
          <div className="faible legende">avant la suite</div>
        </Anneau>
        <div className="voix grand">{mouv?.nom}</div>
        {mouv?.detail && <div className="faible">{mouv.detail}</div>}
        {mouv?.image && <Dessin image={mouv.image} taille={104} />}
        <div className="circuit-points">
          {circuit.mouvements.map((_, k) => (
            <i key={k} className={k < m.rang ? 'fait' : k === m.rang ? 'cours' : ''} />
          ))}
        </div>
        <div className="circuit-pousse" />
        <div className="faible">{suivant ? `Ensuite : ${suivant.nom}` : 'Dernière minute'}</div>
        <button type="button" className="btn plein" onClick={() => void arreter()}>
          Arrêter le circuit
        </button>
      </div>
    )
  }

  const reste = total - ecoule
  return (
    <div className="focus-bloc circuit">
      <div className="circuit-tete">
        <Anneau valeur={reste / total} taille={132} epaisseur={8} couleur={reste <= 10 ? 'var(--alerte)' : 'var(--accent)'} label="Temps restant">
          <div className="circuit-temps">{chrono(Math.ceil(reste))}</div>
          <div className="faible legende">sur {circuit.minutes} min</div>
        </Anneau>
        <div>
          <div className="faible">{circuit.nom}</div>
          <div className="circuit-tours">{cours.tours}</div>
          <div className="faible">
            tour{cours.tours > 1 ? 's' : ''}
            {avant !== undefined ? ` · à battre : ${avant}` : ''}
          </div>
        </div>
      </div>
      {liste(false)}
      <div className="circuit-pousse" />
      <button type="button" className="btn primaire grand" onClick={() => (vibrer(30), void tours(1))}>
        <Check size={20} /> Tour fini
      </button>
      <div className="circuit-bas">
        <button type="button" className="btn discret" onClick={() => void tours(-1)} disabled={!cours.tours}>
          Retirer un tour
        </button>
        <button type="button" className="btn discret" onClick={() => void arreter()}>
          Arrêter le circuit
        </button>
      </div>
    </div>
  )
}
