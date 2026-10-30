import { useState } from 'react'
import { nomMuscle } from '../components/ChoixExo'
import { MODES } from '../components/FormExo'
import Courbe from '../components/Courbe'
import IconeMuscle from '../components/IconeMuscle'
import { Consignes } from '../components/InfosExo'
import { consigne } from '../data/consignes'
import { MUSCLES } from '../data/exercices'
import { chargeTexte, dateCourte, duree, e1rm, enTemps, kg, kgSouleves, qte, serieTexte, tempsParExo } from '../lib/calc'
import type { Exercice, Seance } from '../types'
import { Aide } from '../components/Cycle'
import { LEXIQUE } from '../data/lexique'

type Onglet = 'stats' | 'historique' | 'infos'
type Mesure = 'e1rm' | 'charge' | 'volume' | 'temps'
const PERIODES: [string, number][] = [
  ['30 j', 30],
  ['3 m', 91],
  ['6 m', 182],
  ['1 an', 365],
  ['Tout', 0],
]

/** Fiche d'un exercice en trois onglets : stats, historique, infos (exécution, muscles, remplaçants). */
export function Detail({
  exo,
  seances,
  onRetour,
  onModifier,
  onSupprimer,
  equivalents,
  suggestions,
  onRelier,
  onRelierExo,
  onDelier,
}: {
  exo: Exercice
  seances: Seance[]
  onRetour: () => void
  onModifier: () => void
  onSupprimer: () => void
  /** Exercices reliés, avec leur dernière meilleure série. */
  equivalents: { exo: Exercice; derniere?: string }[]
  /** Remplaçants possibles non reliés (même muscle). */
  suggestions: Exercice[]
  onRelier: () => void
  onRelierExo: (id: string) => void
  onDelier: (id: string) => void
}) {
  const [onglet, setOnglet] = useState<Onglet>('stats')
  const temps = enTemps(exo)
  const secondaires = exo.secondaires?.map((x) => x.muscle) ?? []
  const unite1rm = exo.mode === 'par_main' ? 'kg/main' : 'kg'
  const [mesure, setMesure] = useState<Mesure>(temps ? 'temps' : exo.suivreE1rm ? 'e1rm' : 'charge')
  const [periode, setPeriode] = useState(91)
  const avec = seances.filter((s) => s.series.some((x) => x.exoId === exo.id))
  const chrono = [...avec].reverse()
  const seriesDe = (s: Seance) => s.series.filter((x) => x.exoId === exo.id)
  const e1rmDe = (s: Seance) => Math.max(0, ...seriesDe(s).map((x) => e1rm(exo, x, s.poidsCorps) ?? 0))
  const volumeDe = (s: Seance) => seriesDe(s).reduce((a, x) => a + kgSouleves(x, exo), 0)

  // Records et tuiles
  const toutes = avec.flatMap((s) => seriesDe(s).map((x) => ({ x, s })))
  const meilleurE1rm = exo.suivreE1rm ? Math.max(0, ...avec.map(e1rmDe)) : 0
  const chargeMax = toutes.length ? Math.max(...toutes.map(({ x }) => x.charge)) : null
  const dernierE1rm = exo.suivreE1rm && avec[0] ? e1rmDe(avec[0]) : 0
  const volumeTotal = avec.reduce((a, s) => a + volumeDe(s), 0)
  const repsParCharge = new Map<number, number>()
  for (const { x } of toutes) repsParCharge.set(x.charge, Math.max(repsParCharge.get(x.charge) ?? 0, x.reps))
  const demiReps = chrono.flatMap((s) => seriesDe(s).filter((x) => x.type === 'serie_longue').map((x) => ({ date: s.date, x })))

  // Courbe : un point par séance sur la période choisie
  const depuis = periode ? Date.now() - periode * 86400000 : 0
  const points = chrono
    .filter((s) => s.debut >= depuis)
    .map((s) => ({
      date: s.date,
      valeur:
        mesure === 'e1rm' ? e1rmDe(s) : mesure === 'volume' ? volumeDe(s) : mesure === 'temps' ? Math.max(...seriesDe(s).map((x) => x.reps)) : Math.max(...seriesDe(s).map((x) => x.charge)),
    }))
    .filter((p) => mesure !== 'e1rm' || p.valeur > 0)
  const formatMesure = (v: number) => (mesure === 'temps' ? `${v} s` : mesure === 'charge' ? chargeTexte(exo, v) : `${kg(Math.round(v * 10) / 10)} kg`)
  const tempsMax = toutes.length ? Math.max(...toutes.map(({ x }) => x.reps)) : null

  const c = consigne(exo.id)
  const tuile = (valeur: string, label: string) => (
    <div className="tuile">
      <strong>{valeur}</strong>
      <span className="faible">{label}</span>
    </div>
  )

  return (
    <div>
      <div className="entete">
        <button className="btn" onClick={onRetour} aria-label="Retour">
          ←
        </button>
        <h2 style={{ flex: 1 }}>{exo.nom}</h2>
        <button className="btn" onClick={onModifier}>
          Modifier
        </button>
      </div>

      <div className="carte fiche-tete">
        {exo.image ? (
          <img src={exo.image} alt={exo.nom} className="photo-grande" />
        ) : (
          // Muscle principal en orange, secondaires en orange doux ; la vue de dos s'ajoute si un muscle travaillé y est.
          <div className="ligne" style={{ gap: 8, justifyContent: 'center' }}>
            {(['avant', 'arriere'] as const)
              .filter((f) => [exo.muscle, ...secondaires].some((m) => MUSCLES.find((x) => x.id === m)?.face === f))
              .map((f) => (
                <IconeMuscle key={f} muscle={exo.muscle} secondaires={secondaires} face={f} taille={84} />
              ))}
          </div>
        )}
        <div className="faible">
          {nomMuscle(exo.muscle)}
          {secondaires.length ? ` (+ ${secondaires.map((m) => nomMuscle(m).toLowerCase()).join(', ')})` : ''} · {MODES.find((m) => m[0] === exo.mode)?.[1]} ·{' '}
          {exo.type === 'compose' ? 'composé' : 'isolation'}
        </div>
      </div>

      <div className="segments" role="tablist">
        {(
          [
            ['stats', 'Stats'],
            ['historique', 'Historique'],
            ['infos', 'Infos'],
          ] as [Onglet, string][]
        ).map(([id, nom]) => (
          <button key={id} role="tab" aria-selected={onglet === id} className={onglet === id ? 'actif' : ''} onClick={() => setOnglet(id)}>
            {nom}
          </button>
        ))}
      </div>

      {onglet === 'stats' && (
        <>
          <div className="tuiles" style={{ marginBottom: 12 }}>
            {temps && tuile(tempsMax !== null ? `${tempsMax} s` : '—', 'record de temps')}
            {tuile(exo.suivreE1rm ? (meilleurE1rm ? `${kg(Math.round(meilleurE1rm * 2) / 2)} ${unite1rm}` : '—') : chargeMax !== null ? chargeTexte(exo, chargeMax) : '—', exo.suivreE1rm ? 'record e1RM' : 'charge max')}
            {exo.suivreE1rm && tuile(dernierE1rm ? `${kg(Math.round(dernierE1rm * 2) / 2)} ${unite1rm}` : '—', '1RM estimé (dernier)')}
            {!temps && tuile(`${kg(Math.round(volumeTotal))} kg`, 'volume total')}
          </div>
          {exo.suivreE1rm && (
            <div className="ligne" style={{ gap: 8, marginBottom: 12 }}>
              <span className="faible">C’est quoi, le 1RM estimé ?</span>
              <Aide texte={LEXIQUE.find((l) => l[0] === '1RM estimé')![1]} />
            </div>
          )}

          <div className="carte pile">
            <div className="chips">
              {exo.suivreE1rm && (
                <button className={mesure === 'e1rm' ? 'actif' : ''} onClick={() => setMesure('e1rm')}>
                  1RM estimé
                </button>
              )}
              {temps && (
                <button className={mesure === 'temps' ? 'actif' : ''} onClick={() => setMesure('temps')}>
                  Temps max
                </button>
              )}
              <button className={mesure === 'charge' ? 'actif' : ''} onClick={() => setMesure('charge')}>
                Charge max
              </button>
              {!temps && (
                <button className={mesure === 'volume' ? 'actif' : ''} onClick={() => setMesure('volume')}>
                  Volume
                </button>
              )}
            </div>
            {points.length >= 2 ? (
              <Courbe key={mesure + periode} points={points} format={formatMesure} />
            ) : (
              <div className="faible" style={{ padding: '24px 0', textAlign: 'center' }}>
                {avec.length < 2
                  ? `La courbe apparaît à partir de 2 séances${exo.suivreE1rm && exo.mode === 'poids_corps' ? ' (avec ton poids du jour noté)' : ''}.`
                  : 'Pas assez de séances sur cette période.'}
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

          {repsParCharge.size > 0 && (
            <div className="carte">
              <h3 style={{ marginBottom: 6 }}>{temps ? 'Records de temps' : 'Records de reps'}</h3>
              <table>
                <tbody>
                  {[...repsParCharge.entries()]
                    .sort((a, b) => b[0] - a[0])
                    .slice(0, 6)
                    .map(([ch, r]) => (
                      <tr key={ch}>
                        <td>
                          {temps ? 'Max' : 'Max reps'} à {chargeTexte(exo, ch)}
                        </td>
                        <td>{qte(exo, r)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {demiReps.length > 0 && (
            <div className="carte">
              <h3 style={{ marginBottom: 6 }}>Demi-reps de finisseur</h3>
              <div className="petit">
                {demiReps.map(({ date, x }, i) => (
                  <span key={i}>
                    {i > 0 && ' → '}
                    <strong>{x.demiReps}</strong> <span className="faible">({chargeTexte(exo, x.charge)}, {dateCourte(date)})</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {onglet === 'historique' && (
        <div className="carte">
          {avec.length === 0 && <div className="faible">Pas encore fait.</div>}
          {avec.map((s) => (
            <div key={s.id} style={{ marginBottom: 10 }}>
              <div className="faible">
                {dateCourte(s.date)} · {s.nom}
                {tempsParExo(s)[exo.id] > 0 && ` · ⏱ ${duree(tempsParExo(s)[exo.id])}`}
              </div>
              <div className="petit">
                {seriesDe(s)
                  .map((x) => serieTexte(exo, x))
                  .join(' · ')}
              </div>
              {s.notes[exo.id] && <div className="faible">📝 {s.notes[exo.id]}</div>}
            </div>
          ))}
        </div>
      )}

      {onglet === 'infos' && (
        <>
          {c && (
            <div className="carte pile">
              <h3>Exécution</h3>
              <Consignes exo={exo} />
            </div>
          )}

          <div className="carte ligne" style={{ gap: 14 }}>
            <div>
              <div className="faible">Muscle ciblé</div>
              <strong>{nomMuscle(exo.muscle)}</strong>
              {exo.secondaires?.length ? <div className="faible">aussi : {exo.secondaires.map((x) => nomMuscle(x.muscle).toLowerCase()).join(', ')}</div> : null}
            </div>
          </div>

          <div className="carte pile">
            <div>
              <h3>Remplaçants</h3>
              <div className="faible">Quand la machine est prise. Les exercices reliés sont proposés en premier ; chacun garde sa propre progression.</div>
            </div>
            {equivalents.map((e) => (
              <div key={e.exo.id} className="ligne entre">
                <span>
                  ⇄ <strong>{e.exo.nom}</strong>
                  {e.derniere && <div className="faible">dernière fois : {e.derniere}</div>}
                </span>
                <button className="btn discret petit" onClick={() => onDelier(e.exo.id)}>
                  Délier
                </button>
              </div>
            ))}
            {suggestions.length > 0 && (
              <div>
                <div className="faible" style={{ marginBottom: 4 }}>
                  Suggestions, même muscle
                </div>
                {suggestions.map((e) => (
                  <div key={e.id} className="ligne entre" style={{ padding: '4px 0' }}>
                    <span>{e.nom}</span>
                    <button className="btn petit" onClick={() => onRelierExo(e.id)}>
                      + Relier
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button className="btn plein" onClick={onRelier}>
              Relier un autre exercice
            </button>
          </div>

          <div className="carte">
            <h3 style={{ marginBottom: 6 }}>Réglages</h3>
            <table>
              <tbody>
                <tr>
                  <td>Charge</td>
                  <td>
                    {MODES.find((m) => m[0] === exo.mode)?.[1]} · pas {kg(exo.pas)}
                    {exo.mode === 'elastique' ? '' : ' kg'}
                  </td>
                </tr>
                {exo.chargeMax !== undefined && (
                  <tr>
                    <td>Charge max dispo</td>
                    <td>{chargeTexte(exo, exo.chargeMax)}</td>
                  </tr>
                )}
              </tbody>
            </table>
            {exo.notes && <div className="petit muted" style={{ marginTop: 8 }}>📝 {exo.notes}</div>}
          </div>

          <button className="btn discret danger plein" style={{ marginBottom: 24 }} onClick={onSupprimer}>
            Supprimer l’exercice
          </button>
        </>
      )}
    </div>
  )
}

/** Courbe à une seule série : ligne 2 px, points 8 px, valeur au toucher. */
