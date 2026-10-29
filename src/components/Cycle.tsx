import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import type { Catalogue } from '../catalogue'
import { MUSCLES } from '../data/exercices'
import { nomCle } from '../data/mesures'
import { db, setReglage, uid } from '../db'
import { dateCourte, dateISO, kg, lundi, semaineType, volumeParMuscle } from '../lib/calc'
import { cibles, deloadMaintenant, DUREE_DEFAUT, etatCycle, lundiDe, mettreEnPause, nouveauCycle, volumeDefaut, type EtatCycle } from '../lib/cycle'
import { recordsParSeance } from '../lib/historique'
import { useRetour } from '../lib/nav'
import type { Cycle, Muscle, Programme } from '../types'
import VolumeMuscles from './VolumeMuscles'

export const AIDE_CYCLE =
  'Un cycle, c’est ton programme lancé pour quelques semaines (6 par défaut), avec une semaine de déload à la fin. Le cycle garde sa propre copie du programme : si tu modifies le programme pendant le cycle, l’appli te demande si tu veux l’appliquer tout de suite ou seulement au prochain cycle.'
export const AIDE_DELOAD =
  'Déload : une semaine allégée pour récupérer et repartir plus fort. L’appli divise les séries par deux, baisse les charges d’environ 10 %, vise un RPE de 6-7 et retire les finisseurs. Ces séances ne comptent pas pour ta progression : ensuite, tu reprends là où tu en étais.'

const debutSemaine = (iso: string) => dateCourte(iso).replace(/^\S+ /, '')

/** Petit bouton ⓘ qui déplie une explication. */
export function Aide({ texte }: { texte: string }) {
  const [ouvert, setOuvert] = useState(false)
  return (
    <>
      <button type="button" className="btn-infos" aria-label="Explication" onClick={(e) => (e.stopPropagation(), setOuvert(!ouvert))}>
        i
      </button>
      {ouvert && (
        <div className="aide-texte" onClick={() => setOuvert(false)}>
          {texte}
        </div>
      )}
    </>
  )
}

/** Accueil : où en est le cycle (semaine, déload, pause, fin). */
export function BandeauCycle({ cycle, etat, onBilan, onProgrammes }: { cycle: Cycle; etat: EtatCycle; onBilan: () => void; onProgrammes: () => void }) {
  if (etat.fini)
    return (
      <div className="carte pile" style={{ borderColor: 'var(--ok)' }}>
        <div>
          <strong>🎉 Cycle « {cycle.programme.nom} » terminé</strong>
          <div className="faible">{cycle.semaines} semaines. Regarde ce que ça a donné, puis lance le suivant.</div>
        </div>
        <div className="ligne">
          <button className="btn primaire" style={{ flex: 1 }} onClick={onBilan}>
            Voir le bilan
          </button>
          <button className="btn" style={{ flex: 1 }} onClick={onProgrammes}>
            Nouveau cycle
          </button>
        </div>
      </div>
    )
  return (
    <button className={'liste-btn bandeau-cycle' + (etat.deload ? ' deload' : '')} onClick={onProgrammes}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="ligne entre">
          <strong>🔁 {cycle.programme.nom}</strong>
          <span className="faible">
            {etat.n <= 0 ? `début le ${debutSemaine(cycle.debut)}` : etat.pause ? 'semaine en pause' : `semaine ${etat.n}/${etat.total}`}
          </span>
        </span>
        {etat.n >= 1 && (
          <span className="semaines-cycle">
            {Array.from({ length: etat.total }, (_, i) => (
              <span key={i} className={(i + 1 < etat.n ? 'faite' : i + 1 === etat.n && !etat.pause ? 'courante' : '') + (cycle.deloads.includes(i + 1) ? ' deload' : '')} />
            ))}
          </span>
        )}
        {etat.deload && <span className="faible">🧘 Semaine de déload : séances allégées automatiquement (séries ÷ 2, −10 %, RPE 6-7).</span>}
        {etat.pause && <span className="faible">⏸ Le cycle reprend la semaine prochaine.</span>}
      </span>
    </button>
  )
}

/** Lancer un cycle, ou modifier celui en cours (durée, déloads, objectifs de volume). */
export function LancerCycle({ catalogue, programme, cycle, onFermer }: { catalogue: Catalogue; programme?: Programme; cycle?: Cycle; onFermer: () => void }) {
  useRetour(true, onFermer)
  const [progId, setProgId] = useState(cycle?.programmeId ?? programme?.id ?? catalogue.actif.id)
  const cetteSemaine = lundi()
  const prochaine = dateISO(new Date(Date.parse(cetteSemaine + 'T12:00:00') + 7 * 86400000))
  const [debut, setDebut] = useState(cetteSemaine)
  const [semaines, setSemaines] = useState(cycle?.semaines ?? DUREE_DEFAUT)
  const [deloads, setDeloads] = useState<number[]>(cycle?.deloads ?? [DUREE_DEFAUT])
  const [volume, setVolume] = useState<Partial<Record<Muscle, number>>>(cycle?.volume ?? volumeDefaut())
  const [voirVolume, setVoirVolume] = useState(false)
  const etat = cycle && etatCycle(cycle)

  const changerDuree = (n: number) => {
    // Déload « à la fin » par défaut : il suit la nouvelle durée.
    setDeloads((d) => (d.length === 1 && d[0] === semaines ? [n] : d.filter((x) => x <= n)))
    setSemaines(n)
  }

  const enregistrer = async () => {
    if (cycle) {
      await db.cycles.update(cycle.id, { semaines, deloads: [...deloads].sort((a, b) => a - b), volume })
      return onFermer()
    }
    const p = catalogue.programmes.find((x) => x.id === progId)!
    const enCours = catalogue.cycle
    if (enCours && !confirm(`Terminer le cycle « ${enCours.programme.nom} » en cours et lancer celui-ci ? L’historique est conservé.`)) return
    const c = nouveauCycle('c_' + uid(), p, catalogue.modele, debut, semaines, [...deloads].sort((a, b) => a - b), volume)
    await db.transaction('rw', db.cycles, db.reglages, db.seances, async () => {
      if (enCours) await db.cycles.update(enCours.id, { fin: dateISO() })
      await db.cycles.put(c)
      await setReglage('programmeActif', p.id)
      // Cycle lancé cette semaine : les séances déjà faites cette semaine en font partie (semaine 1).
      if (debut === cetteSemaine)
        await db.seances
          .where('date')
          .aboveOrEqual(cetteSemaine)
          .filter((s) => !s.cycleId)
          .modify((s) => {
            s.cycleId = c.id
            s.semaine = 1
          })
    })
    onFermer()
  }

  return (
    <div className="modal-fond" onClick={onFermer}>
      <div className="modal pile" onClick={(e) => e.stopPropagation()}>
        <div className="ligne entre">
          <h2>{cycle ? 'Modifier le cycle' : 'Lancer un cycle'}</h2>
          <Aide texte={AIDE_CYCLE} />
        </div>

        {!cycle && (
          <>
            <label className="champ">
              <span>Programme</span>
              <select value={progId} onChange={(e) => setProgId(e.target.value)}>
                {catalogue.programmes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom}
                  </option>
                ))}
              </select>
            </label>
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
          </>
        )}

        <div className="champ">
          <span>Durée</span>
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
            <span>Semaines de déload</span>
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
                {deloads.includes(n) ? '🧘 ' : ''}S{n}
              </button>
            ))}
          </div>
          <span className="faible">
            {deloads.length
              ? `${semaines - deloads.length} semaines de travail, ${deloads.length} de déload.`
              : 'Aucun déload : au-delà de 6-8 semaines, la fatigue s’accumule.'}
          </span>
        </div>

        <div className="champ">
          <button type="button" className="groupe-repli" onClick={() => setVoirVolume(!voirVolume)} aria-expanded={voirVolume}>
            <span>Objectifs de volume (séries dures / semaine)</span>
            <span className="muted">{voirVolume ? '▾' : '▸'}</span>
          </button>
          {voirVolume && (
            <div>
              <div className="faible" style={{ margin: '6px 0' }}>
                Pré-remplis avec les repères habituels (10-20 séries par muscle et par semaine). 0 = pas d’objectif pour ce muscle.
              </div>
              {MUSCLES.map((m) => (
                <div key={m.id} className="ligne entre" style={{ padding: '4px 0' }}>
                  <span className="petit">{m.nom}</span>
                  <span className="mini-stepper">
                    <button type="button" onClick={() => setVolume((v) => ({ ...v, [m.id]: Math.max(0, (v[m.id] ?? 0) - 1) }))}>
                      −
                    </button>
                    <strong>{volume[m.id] ?? 0}</strong>
                    <button type="button" onClick={() => setVolume((v) => ({ ...v, [m.id]: Math.min(40, (v[m.id] ?? 0) + 1) }))}>
                      +
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <button className="btn primaire grand" onClick={enregistrer}>
          {cycle ? 'ENREGISTRER' : 'LANCER LE CYCLE'}
        </button>
        <button className="btn discret plein" onClick={onFermer}>
          Annuler
        </button>
      </div>
    </div>
  )
}

/** Vue du cycle en cours : semaine par semaine, et les actions (pause, déload, modifier, terminer). */
export function VueCycle({ catalogue, cycle, onFermer }: { catalogue: Catalogue; cycle: Cycle; onFermer: () => void }) {
  const [modifier, setModifier] = useState(false)
  const [bilan, setBilan] = useState(false)
  useRetour(!modifier && !bilan, onFermer)
  const seances = useLiveQuery(() => db.seances.filter((s) => s.cycleId === cycle.id && !s.enCours).toArray(), [cycle.id], [])
  const etat = etatCycle(cycle)
  const prevues = semaineType(cycle.programme).map((e) => cycle.modeles.find((m) => m.id === e.modeleId)).filter((m) => !!m)

  // Lignes : chaque semaine du cycle, avec les semaines de pause intercalées.
  const fin = lundiDe(cycle, cycle.semaines)
  const lignes: ({ pause: string } | { n: number; lundi: string })[] = []
  for (let l = cycle.debut, n = 0; l <= fin; l = dateISO(new Date(Date.parse(l + 'T12:00:00') + 7 * 86400000))) {
    if (cycle.pauses.includes(l)) lignes.push({ pause: l })
    else lignes.push({ n: ++n, lundi: l })
  }

  const terminer = async () => {
    if (!confirm('Terminer ce cycle maintenant ? Son historique et son bilan sont conservés.')) return
    await db.cycles.update(cycle.id, { fin: dateISO() })
    onFermer()
  }

  return (
    <div>
      <div className="entete">
        <button className="btn" onClick={onFermer} aria-label="Retour">
          ←
        </button>
        <div style={{ flex: 1 }}>
          <h2>Cycle en cours</h2>
          <div className="faible">
            {cycle.programme.nom} · {cycle.semaines} semaines depuis le {debutSemaine(cycle.debut)}
          </div>
        </div>
        <Aide texte={AIDE_CYCLE} />
      </div>

      <div className="carte">
        {lignes.map((x) => {
          if ('pause' in x)
            return (
              <div key={x.pause} className="ligne-semaine pause">
                <span className="faible">⏸ Pause · sem. du {debutSemaine(x.pause)}</span>
              </div>
            )
          const faites = seances.filter((s) => s.semaine === x.n)
          const deload = cycle.deloads.includes(x.n)
          const courante = x.n === etat.n && !etat.pause
          const restantes = [...faites]
          return (
            <div key={x.n} className={'ligne-semaine' + (courante ? ' courante' : '') + (deload ? ' deload' : '')}>
              <div className="ligne entre">
                <strong>
                  S{x.n}
                  {deload && ' · 🧘 déload'}
                </strong>
                <span className="faible">{debutSemaine(x.lundi)}</span>
              </div>
              <div className="ligne wrap" style={{ gap: 4 }}>
                {prevues.map((m, k) => {
                  const i = restantes.findIndex((s) => s.modeleId === m.id)
                  const fait = i >= 0
                  if (fait) restantes.splice(i, 1)
                  return (
                    <span key={m.id + k} className={'pastille' + (fait ? ' ok' : '')}>
                      {fait ? '✓ ' : ''}
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
        })}
      </div>

      {!etat.fini && etat.n >= 1 && (
        <div className="carte pile">
          <button className="btn plein" disabled={etat.pause} onClick={() => db.cycles.put(deloadMaintenant(cycle))}>
            🧘 Déload maintenant
          </button>
          <div className="faible">Tu te sens cuit ? Cette semaine devient un déload, la suite du cycle est décalée d’une semaine.</div>
          <button className="btn plein" disabled={etat.pause} onClick={() => db.cycles.put(mettreEnPause(cycle))}>
            ⏸ Mettre cette semaine en pause
          </button>
          <div className="faible">Vacances, maladie : la semaine ne compte pas, tout le reste du cycle glisse d’une semaine.</div>
        </div>
      )}

      <div className="ligne wrap" style={{ marginBottom: 24 }}>
        <button className="btn" onClick={() => setBilan(true)}>
          📊 Bilan{etat.fini ? '' : ' jusqu’ici'}
        </button>
        <button className="btn" onClick={() => setModifier(true)}>
          Modifier
        </button>
        <button className="btn danger" onClick={terminer}>
          Terminer le cycle
        </button>
      </div>

      {modifier && <LancerCycle catalogue={catalogue} cycle={cycle} onFermer={() => setModifier(false)} />}
      {bilan && <BilanCycle cycle={cycle} catalogue={catalogue} onFermer={() => setBilan(false)} />}
    </div>
  )
}

/** Bilan d'un cycle : assiduité, volume moyen face aux objectifs, records, poids et mesures. */
export function BilanCycle({ cycle, catalogue, onFermer }: { cycle: Cycle; catalogue: Catalogue; onFermer: () => void }) {
  useRetour(true, onFermer)
  const toutes = useLiveQuery(() => db.seances.filter((s) => !s.enCours).toArray(), [])
  const pesees = useLiveQuery(() => db.pesees.orderBy('date').toArray(), [], [])
  const mesures = useLiveQuery(() => db.mesures.orderBy('date').toArray(), [], [])
  if (!toutes) return null

  const etat = etatCycle(cycle)
  // Semaines écoulées (la semaine en cours ne compte qu'une fois finie), puis celles de travail.
  const ecoulees = etat.fini ? cycle.semaines : Math.min(cycle.semaines, Math.max(0, etat.n - 1))
  const normales = Array.from({ length: ecoulees }, (_, i) => i + 1).filter((n) => !cycle.deloads.includes(n))
  const duCycle = toutes.filter((s) => s.cycleId === cycle.id)
  const travail = duCycle.filter((s) => !s.deload && s.semaine !== undefined && normales.includes(s.semaine))
  const prevues = semaineType(cycle.programme).length * normales.length
  const volume = volumeParMuscle(travail, catalogue.exercices)
  const moyen = Object.fromEntries(Object.entries(volume).map(([m, v]) => [m, normales.length ? Math.round((v / normales.length) * 10) / 10 : 0])) as typeof volume
  const records = recordsParSeance(toutes, catalogue.exo)
  const nbRecords = duCycle.reduce((a, s) => a + (records[s.id] ?? 0), 0)

  const finCycle = cycle.fin ?? dateISO()
  const avantDebut = <T extends { date: string }>(l: T[]) => [...l].reverse().find((x) => x.date <= cycle.debut) ?? l.find((x) => x.date >= cycle.debut && x.date <= finCycle)
  const derniere = <T extends { date: string }>(l: T[]) => [...l].reverse().find((x) => x.date <= finCycle)
  const p0 = avantDebut(pesees)
  const p1 = derniere(pesees)
  const m0 = avantDebut(mesures)
  const m1 = derniere(mesures)
  const signe = (d: number, u: string) => `${d > 0 ? '+' : d < 0 ? '−' : '±'}${kg(Math.abs(Math.round(d * 10) / 10))} ${u}`
  const ecartsMesures = m0 && m1 && m0.date !== m1.date ? Object.keys(m1.valeurs).filter((c) => m0.valeurs[c] !== undefined) : []

  return (
    <div className="modal-fond" onClick={onFermer}>
      <div className="modal pile" onClick={(e) => e.stopPropagation()}>
        <div>
          <h2>Bilan du cycle</h2>
          <div className="faible">
            {cycle.programme.nom} · depuis le {debutSemaine(cycle.debut)}
            {etat.fini ? '' : ` · ${ecoulees} semaine${ecoulees > 1 ? 's' : ''} écoulée${ecoulees > 1 ? 's' : ''}`}
          </div>
        </div>
        <div className="tuiles">
          <div className="tuile">
            <strong>
              {travail.length}/{prevues}
            </strong>
            <span className="faible">séances faites</span>
          </div>
          <div className="tuile">
            <strong>{nbRecords}</strong>
            <span className="faible">record{nbRecords > 1 ? 's' : ''} 🏆</span>
          </div>
          <div className="tuile">
            <strong>{duCycle.filter((s) => s.deload).length}</strong>
            <span className="faible">séance(s) de déload</span>
          </div>
        </div>

        <div>
          <h3>Volume moyen par semaine</h3>
          <div className="faible" style={{ margin: '4px 0 8px' }}>
            Séries dures sur les semaines de travail, face aux objectifs du cycle.
          </div>
          {normales.length ? <VolumeMuscles volume={moyen} cibles={cibles(cycle)} /> : <div className="faible">Pas encore de semaine de travail terminée.</div>}
        </div>

        {(p0 && p1 && p0.date !== p1.date) || ecartsMesures.length ? (
          <div>
            <h3>Corps</h3>
            {p0 && p1 && p0.date !== p1.date && (
              <div className="ligne-mesure">
                <span>Poids</span>
                <strong>{signe(p1.poids - p0.poids, 'kg')}</strong>
              </div>
            )}
            {ecartsMesures.map((c) => (
              <div key={c} className="ligne-mesure">
                <span>{nomCle(c)}</span>
                <strong>{signe(m1!.valeurs[c] - m0!.valeurs[c], 'cm')}</strong>
              </div>
            ))}
          </div>
        ) : null}

        <button className="btn discret plein" onClick={onFermer}>
          Fermer
        </button>
      </div>
    </div>
  )
}
