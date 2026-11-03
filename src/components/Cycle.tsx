import { ChevronRight, MoreHorizontal } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { lancerCycle, type Catalogue } from '../catalogue'
import { db } from '../db'
import { dateCourte, dateISO, kg, lundi, semaineType, volumePrevu } from '../lib/calc'
import { appliquerEcart, BONUS_PRIORITE, debutCycle, deloadMaintenant, DUREE_DEFAUT, etatCycle, garderEcart, lundiDe, MAX_PRIORITES, mettreEnPause, nomCycle } from '../lib/cycle'
import { MUSCLES } from '../data/exercices'
import { useRetour } from '../lib/nav'
import type { Cycle, Muscle, Programme } from '../types'
import { confirmer } from './Dialogues'
import Aide from './Aide'

export const AIDE_CYCLE =
  'Un cycle, c’est ton programme lancé pour quelques semaines (6 par défaut, dont la semaine de déload à la fin : 5 de travail + 1 de déload). Le cycle garde sa propre copie du programme : si tu modifies le programme pendant le cycle, tu choisis s’il s’applique aux semaines qui restent ou seulement au prochain cycle.'
export const AIDE_DELOAD =
  'Déload : une semaine allégée pour récupérer et repartir plus fort. L’appli divise les séries par deux, baisse les charges d’environ 10 %, vise un RPE de 6-7 et retire les finisseurs. Garde tes repas et tes pas comme d’habitude : une semaine allégée ne fait pas perdre de muscle. Ces séances ne comptent pas pour ta progression : ensuite, tu reprends là où tu en étais.'

const debutSemaine = (iso: string) => dateCourte(iso).replace(/^\S+ /, '')

export { Aide } from './Aide'

/**
 * Programme modifié pendant le cycle : le dit tant qu'on n'a pas répondu, quel que soit le chemin pris
 * (barre du bas, appli fermée, séance retirée ailleurs). `fixe` : en bas de l'écran, pour ne pas décaler ce qu'on est en train de modifier.
 */
export function AvisCycle({ catalogue, fixe = false }: { catalogue: Catalogue; fixe?: boolean }) {
  const [fait, setFait] = useState('')
  const { cycle, ecart } = catalogue
  const repondre = async (changement: Partial<Cycle>, message: string) => {
    await db.cycles.update(cycle!.id, changement)
    setFait(message)
    setTimeout(() => setFait(''), 2500)
  }
  const classe = 'avis-cycle' + (fixe ? ' fixe' : '')
  if (!cycle || !ecart) return fait ? <div className={classe} role="status">✓ {fait}</div> : null
  const programme = catalogue.programmes.find((p) => p.id === cycle.programmeId)
  const quoi = [...(ecart.planning ? ['les jours et les séances du programme'] : []), ...ecart.seances.map((s) => s.nom)].join(', ')
  return (
    <div className={classe} role="status">
      <strong>Ton cycle garde l’ancienne version</strong>
      <div className="faible">Modifié : {quoi}.</div>
      <div className="avis-cycle-choix">
        <button type="button" className="btn" onClick={() => void repondre(appliquerEcart(cycle, ecart, programme, catalogue.modele), 'Appliqué aux semaines qui restent')}>
          Appliquer aux semaines qui restent
        </button>
        <button type="button" className="btn" onClick={() => void repondre(garderEcart(cycle, ecart, programme), 'Gardé pour le prochain cycle')}>
          Garder pour le prochain cycle
        </button>
      </div>
    </div>
  )
}

export function LancerCycle({ catalogue, programme, cycle, onFermer, onLance }: { catalogue: Catalogue; programme?: Programme; cycle?: Cycle; onFermer: () => void; /** Le cycle vient d'être lancé : le message à afficher. */ onLance?: (message: string) => void }) {
  useRetour(true, onFermer)
  const progId = cycle?.programmeId ?? programme?.id ?? catalogue.actif.id
  const [regler, setRegler] = useState(false)
  const cetteSemaine = lundi()
  const prochaine = dateISO(new Date(Date.parse(cetteSemaine + 'T12:00:00') + 7 * 86400000))
  // Tous les jours de séance déjà passés cette semaine : on propose de commencer la suivante.
  const [debut, setDebut] = useState(() => (cycle ? cetteSemaine : debutCycle((programme?.seances ?? []).flatMap((e) => e.jour ?? []))))
  const [semaines, setSemaines] = useState(cycle?.semaines ?? DUREE_DEFAUT)
  const [deloads, setDeloads] = useState<number[]>(cycle?.deloads ?? [DUREE_DEFAUT])
  const [nom, setNom] = useState(cycle?.nom ?? '')
  const [priorites, setPriorites] = useState<Muscle[]>(cycle?.priorites ?? [])
  const [options, setOptions] = useState(!!cycle?.priorites?.length)
  const basculerPriorite = (m: Muscle) => setPriorites((l) => (l.includes(m) ? l.filter((x) => x !== m) : [...l, m].slice(-MAX_PRIORITES)))
  // Ce que le programme prévoit pour chaque muscle, face à l'objectif relevé par la priorité.
  const progChoisi = cycle?.programme ?? catalogue.programmes.find((x) => x.id === progId)
  const seancesProg = progChoisi ? semaineType(progChoisi).map((e) => cycle?.modeles.find((m) => m.id === e.modeleId) ?? catalogue.modele(e.modeleId)).filter((m) => !!m) : []
  const prevu = volumePrevu(seancesProg, catalogue.exercices)
  const etat = cycle && etatCycle(cycle)

  const changerDuree = (n: number) => {
    // Déload « à la fin » par défaut : il suit la nouvelle durée.
    setDeloads((d) => (d.length === 1 && d[0] === semaines ? [n] : d.filter((x) => x <= n)))
    setSemaines(n)
  }

  const enregistrer = async () => {
    if (cycle) {
      await db.cycles.update(cycle.id, { nom: nom.trim() || undefined, priorites: priorites.length ? priorites : undefined, semaines, deloads: [...deloads].sort((a, b) => a - b) })
      return onFermer()
    }
    const p = catalogue.programmes.find((x) => x.id === progId)!
    const enCours = catalogue.cycle
    if (
      enCours &&
      !etatCycle(enCours).fini &&
      !(await confirmer(`Le cycle « ${nomCycle(enCours)} » en cours sera terminé. Son historique et son bilan sont conservés.`, { titre: 'Lancer un nouveau cycle ?', oui: 'Lancer le nouveau cycle' }))
    )
      return
    await lancerCycle(catalogue, p, { debut, semaines, deloads, nom, priorites })
    onFermer()
    onLance?.(debut === cetteSemaine ? `Cycle lancé : semaine 1 sur ${semaines}` : `Cycle lancé : il commence la semaine prochaine`)
  }

  // Par défaut, une phrase et un bouton : les réglages sont à un appui. Modifier un cycle les montre d'emblée.
  const resume = [
    `${semaines} semaines à partir ${debut === cetteSemaine ? 'de cette semaine' : 'de la semaine prochaine'}.`,
    deloads.length === 1 && deloads[0] === semaines
      ? 'La dernière est allégée pour récupérer : moitié moins de séries, charges −10 %.'
      : deloads.length
        ? `Semaines allégées pour récupérer : ${[...deloads].sort((a, b) => a - b).join(', ')}.`
        : 'Sans semaine allégée : au-delà de 6 à 8 semaines, la fatigue s’accumule.',
  ].join(' ')

  return (
    <div className="modal-fond" onClick={cycle ? () => void enregistrer() : onFermer}>
      <div className="modal pile" onClick={(e) => e.stopPropagation()}>
        <div className="ligne entre">
          <h2>{cycle ? 'Modifier le cycle' : `Lancer ${progChoisi?.nom ?? 'un cycle'}`}</h2>
          <Aide texte={AIDE_CYCLE} />
        </div>
        {!cycle && <div className="faible">{resume}</div>}

        {!cycle && regler && (
          <div className="champ">
            <span>Début</span>
            <div className="chips">
              <button className={debut === cetteSemaine ? 'actif' : ''} onClick={() => setDebut(cetteSemaine)}>
                Cette semaine (lun. {debutSemaine(cetteSemaine)})
              </button>
              <button className={debut === prochaine ? 'actif' : ''} onClick={() => setDebut(prochaine)}>
                Semaine prochaine (lun. {debutSemaine(prochaine)})
              </button>
            </div>
          </div>
        )}

        {(cycle || regler) && (
        <>
        <label className="champ">
          <span>Nom du cycle (facultatif)</span>
          <input type="text" value={nom} maxLength={40} placeholder={cycle?.programme.nom ?? catalogue.programmes.find((x) => x.id === progId)?.nom} onChange={(e) => setNom(e.target.value)} />
        </label>

        <div className="champ">
          <span>Durée, déload compris</span>
          <div className="chips">
            {[4, 5, 6, 7, 8, 10, 12]
              .filter((n) => !etat || n >= etat.n)
              .map((n) => (
                <button key={n} className={semaines === n ? 'actif' : ''} onClick={() => changerDuree(n)}>
                  {n} sem.
                </button>
              ))}
          </div>
        </div>

        <div className="champ">
          <span className="ligne entre">
            <span>Semaines allégées (déload)</span>
            <Aide texte={AIDE_DELOAD} />
          </span>
          <div className="chips">
            {Array.from({ length: semaines }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                className={deloads.includes(n) ? 'actif' : ''}
                disabled={!!etat && n < etat.n}
                onClick={() => setDeloads((d) => (d.includes(n) ? d.filter((x) => x !== n) : [...d, n]))}
              >
                S{n}
              </button>
            ))}
          </div>
          <span className="faible">
            {deloads.length
              ? `${semaines - deloads.length} semaines de travail, ${deloads.length} de déload.`
              : 'Aucun déload : au-delà de 6-8 semaines, la fatigue s’accumule.'}
          </span>
        </div>

        {/* Ancienne priorité de cycle : remplacée par ★ Priorité dans les cibles du programme, gardée pour les cycles qui en ont une. */}
        {cycle?.priorites?.length ? (
        <button type="button" className="groupe-repli" onClick={() => setOptions(!options)} aria-expanded={options}>
          <span>
            Plus d’options{priorites.length > 0 && <span className="faible"> · priorité : {priorites.map((m) => MUSCLES.find((x) => x.id === m)!.nom.toLowerCase()).join(', ')}</span>}
          </span>
          <span className="muted">{options ? '▾' : '▸'}</span>
        </button>
        ) : null}
        {options && (
        <div className="champ">
          <span>Muscle prioritaire pendant ce cycle (facultatif, {MAX_PRIORITES} au plus)</span>
          <div className="chips">
            {MUSCLES.filter((m) => m.cible > 0).map((m) => (
              <button key={m.id} className={priorites.includes(m.id) ? 'actif' : ''} onClick={() => basculerPriorite(m.id)}>
                {m.nom}
              </button>
            ))}
          </div>
          {priorites.length ? (
            priorites.map((m) => {
              const objectif = catalogue.ciblesPerso[m] + BONUS_PRIORITE
              const manque = Math.ceil(objectif - (prevu[m] ?? 0))
              return (
                <span key={m} className="faible">
                  {MUSCLES.find((x) => x.id === m)!.nom} : objectif {kg(catalogue.ciblesPerso[m])} → {kg(objectif)} séries dures par semaine pendant le cycle. Ton programme en prévoit {kg(prevu[m] ?? 0)}
                  {manque > 0 ? ` : ajoute ${manque} série${manque > 1 ? 's' : ''} (un exercice de plus, ou une série de plus sur plusieurs exercices).` : ' : c’est déjà bon.'}
                </span>
              )
            })
          ) : (
            <span className="faible">Un muscle à pousser pendant ce bloc (ex. les bras) : son objectif de volume monte de {BONUS_PRIORITE} séries par semaine, le temps du cycle. Tes objectifs habituels ne changent pas.</span>
          )}
        </div>
        )}

        </>
        )}

        <button className="btn primaire grand" onClick={enregistrer}>
          {cycle ? 'Enregistrer' : 'Lancer le cycle'}
        </button>
        {!cycle && !regler && (
          <button className="btn plein" onClick={() => setRegler(true)}>
            Régler
          </button>
        )}
        <button className="btn discret plein" onClick={onFermer}>
          Annuler
        </button>
      </div>
    </div>
  )
}

/** Le cycle : où j'en suis, semaine par semaine. Le rare (déload, pause, modifier, terminer) est dans ⋯. */
export function VueCycle({ catalogue, cycle, onFermer, onBilan }: { catalogue: Catalogue; cycle: Cycle; onFermer: () => void; onBilan: () => void }) {
  const [modifier, setModifier] = useState(false)
  const [menu, setMenu] = useState(false)
  useRetour(!modifier, onFermer)
  useRetour(menu, () => setMenu(false))
  const seances = useLiveQuery(() => db.seances.filter((s) => s.cycleId === cycle.id && !s.enCours).toArray(), [cycle.id], [])
  const etat = etatCycle(cycle)
  // Chaque séance va dans la semaine de sa date réelle (une semaine mise en pause après coup garde les siennes).
  const semaineDe = (date: string) => {
    const e = etatCycle(cycle, date)
    return e.pause ? 'pause' : e.n
  }
  const prevues = semaineType(cycle.programme).map((e) => cycle.modeles.find((m) => m.id === e.modeleId)).filter((m) => !!m)

  // Lignes : chaque semaine du cycle, avec les semaines de pause intercalées.
  const fin = lundiDe(cycle, cycle.semaines)
  const lignes: ({ pause: string } | { n: number; lundi: string })[] = []
  for (let l = cycle.debut, n = 0; l <= fin; l = dateISO(new Date(Date.parse(l + 'T12:00:00') + 7 * 86400000))) {
    if (cycle.pauses.includes(l)) lignes.push({ pause: l })
    else lignes.push({ n: ++n, lundi: l })
  }

  const terminer = async () => {
    setMenu(false)
    if (!(await confirmer('Son historique et son bilan sont conservés.', { titre: 'Terminer ce cycle maintenant ?', oui: 'Terminer le cycle', danger: true }))) return
    await db.cycles.update(cycle.id, { fin: dateISO() })
    onFermer()
  }
  const alleger = async () => {
    setMenu(false)
    if (await confirmer('Les séances seront allégées et la fin du cycle reculera d’une semaine.', { titre: `Alléger la semaine ${etat.n} ?`, oui: 'Alléger cette semaine' })) await db.cycles.put(deloadMaintenant(cycle))
  }
  const pause = async () => {
    setMenu(false)
    if (await confirmer('Elle ne comptera pas, et tout le reste du cycle glissera d’une semaine.', { titre: 'Mettre cette semaine en pause ?', oui: 'Mettre en pause' })) await db.cycles.put(mettreEnPause(cycle))
  }
  const enCours = !etat.fini && etat.n >= 1

  return (
    <div>
      <div className="entete">
        <button className="btn" onClick={onFermer} aria-label="Retour">
          ←
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2>{etat.fini ? 'Cycle terminé' : etat.n <= 0 ? 'Cycle à venir' : etat.pause ? 'Semaine en pause' : `Semaine ${etat.n} sur ${etat.total}`}</h2>
          <div className="faible">
            {nomCycle(cycle)} · depuis le {debutSemaine(cycle.debut)}
            {cycle.priorites?.length ? ` · priorité : ${cycle.priorites.map((m) => MUSCLES.find((x) => x.id === m)!.nom.toLowerCase()).join(', ')}` : ''}
          </div>
        </div>
        {!etat.fini && (
          <button className="icone" onClick={() => setMenu(true)} aria-label="Plus d’actions">
            <MoreHorizontal size={22} />
          </button>
        )}
      </div>

      <div className="carte">
        {lignes.map((x) => {
          if ('pause' in x)
            return (
              <div key={x.pause} className="semaine-cycle">
                <span className="faible">Pause · semaine du {debutSemaine(x.pause)}</span>
              </div>
            )
          const faites = seances.filter((s) => semaineDe(s.date) === x.n)
          const deload = cycle.deloads.includes(x.n)
          const courante = x.n === etat.n && !etat.pause && !etat.fini
          const titre = (
            <span>
              <strong>Semaine {x.n}</strong>
              {deload && <span className="semaine-allegee"> · allégée</span>}
            </span>
          )
          if (courante) {
            const restantes = [...faites]
            return (
              <div key={x.n} className="semaine-cycle courante">
                <div className="ligne entre">
                  {titre}
                  <span className="faible">{debutSemaine(x.lundi)}</span>
                </div>
                <div className="ligne wrap" style={{ gap: 'var(--e1)' }}>
                  {prevues.map((m, k) => {
                    const i = restantes.findIndex((s) => s.modeleId === m.id)
                    if (i >= 0) restantes.splice(i, 1)
                    return (
                      <span key={m.id + k} className={'pastille' + (i >= 0 ? ' ok' : '')}>
                        {i >= 0 ? '✓ ' : ''}
                        {m.nom}
                      </span>
                    )
                  })}
                  {restantes.map((s) => (
                    <span key={s.id} className="pastille ok">
                      ✓ {s.nom}
                    </span>
                  ))}
                </div>
              </div>
            )
          }
          const passee = x.lundi < lundi()
          return (
            <div key={x.n} className="semaine-cycle ligne entre">
              {titre}
              {passee || faites.length ? (
                <span className={faites.length >= prevues.length ? 'tenue' : 'faible'}>
                  {faites.length >= prevues.length ? '✓ ' : ''}
                  {faites.length} sur {prevues.length}
                </span>
              ) : (
                <span className="faible">{debutSemaine(x.lundi)}</span>
              )}
            </div>
          )
        })}
      </div>

      {cycle.debut < lundi() && (
        <button className="liste-btn" onClick={onBilan}>
          <span>Voir le bilan de ce cycle</span>
          <ChevronRight size={20} className="muted" />
        </button>
      )}
      <div className="ligne entre faible" style={{ padding: 'var(--e2) var(--e1)' }}>
        <span>C’est quoi, un cycle ?</span>
        <Aide texte={AIDE_CYCLE} />
      </div>

      {menu && (
        <div className="modal-fond" onClick={() => setMenu(false)}>
          <div className="modal pile" onClick={(e) => e.stopPropagation()}>
            <h3>Ce cycle</h3>
            {enCours && (
              <button className="liste-btn" disabled={etat.pause || etat.deload} onClick={() => void alleger()}>
                <span>
                  Alléger cette semaine (déload)
                  <span className="faible prog-sous">Fatigué : la suite du cycle est décalée d’une semaine</span>
                </span>
              </button>
            )}
            {enCours && (
              <button className="liste-btn" disabled={etat.pause} onClick={() => void pause()}>
                <span>
                  Mettre cette semaine en pause
                  <span className="faible prog-sous">Vacances, maladie : elle ne compte pas</span>
                </span>
              </button>
            )}
            <button className="liste-btn" onClick={() => (setMenu(false), setModifier(true))}>
              <span>Modifier la durée et le nom</span>
            </button>
            <button className="liste-btn" onClick={() => void terminer()}>
              <span style={{ color: 'var(--danger)' }}>Terminer le cycle</span>
            </button>
            <button className="btn discret plein" onClick={() => setMenu(false)}>
              Fermer
            </button>
          </div>
        </div>
      )}
      {modifier && <LancerCycle catalogue={catalogue} cycle={cycle} onFermer={() => setModifier(false)} />}
    </div>
  )
}
