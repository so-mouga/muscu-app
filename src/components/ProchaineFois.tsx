import { Check, ChevronDown, Pencil } from 'lucide-react'
import { Fragment, useState, type ReactNode } from 'react'
import type { Catalogue } from '../catalogue'
import EditeurObjectif from './EditeurObjectif'
import { exoAvecReglages } from '../db'
import { chargesTexte, cibleTexte, ecartSerie, kg } from '../lib/calc'
import { historiqueDe, recordDuJour } from '../lib/historique'
import { lignesProchaineFois, vraiChoix } from '../lib/prochaineFois'
import type { Suggestion } from '../lib/progression'
import type { Exercice, Objectif, Reglage, Seance } from '../types'

type Objectifs = Record<string, Objectif>

/**
 * « Pour la prochaine fois » : les exercices où il y a un vrai choix (Comme aujourd'hui / le conseil, crayon pour un autre objectif),
 * puis « On refait pareil » en une ligne. En fin de séance, et sur une séance enregistrée tant qu'elle est la dernière fois
 * qu'on a fait l'exercice (`pour`). Les choix sont ceux de `objectifs`, enregistrés par l'écran qui l'affiche.
 */
export default function ProchaineFois({
  seance,
  avant,
  catalogue,
  reglages,
  objectifs,
  onObjectifs,
  pour = () => true,
  quand = 'aujourd’hui',
  detailSeries,
  place,
  groupes = false,
}: {
  seance: Seance
  /** Séances terminées avant celle-ci, la plus récente en premier. */
  avant: Seance[]
  catalogue: Catalogue
  reglages: Reglage[]
  objectifs: Objectifs
  onObjectifs: (fn: (o: Objectifs) => Objectifs) => void
  /** Exercices dont cette séance décide encore (tous en fin de séance). */
  pour?: (exoId: string) => boolean
  /** « aujourd’hui », ou « ce jour-là » pour une séance d'un autre jour. */
  quand?: string
  /** Les séries du jour sous un exercice, à un appui (fin de séance). Sans : pas de dépliage. */
  detailSeries?: (exo: Exercice) => ReactNode
  /** Sous le nom d'un remplaçant : l'exercice prévu à sa place. */
  place?: (exoId: string) => ReactNode
  /** Fin de séance : pas de titre (la page le porte), et deux groupes, ce qui monte d'abord, ce qu'on allège ensuite. */
  groupes?: boolean
}) {
  const [ajuste, setAjuste] = useState<string | null>(null)
  /** Exercices dont on a déplié les séries. */
  const [ouverts, setOuverts] = useState<Record<string, boolean>>({})
  const basculer = (id: string) => setOuverts((x) => ({ ...x, [id]: !x[id] }))

  const exoDe = (id: string) => exoAvecReglages(catalogue.exo(id), reglages)
  const lignes = lignesProchaineFois(seance, avant, exoDe).filter((l) => pour(l.plan.exoId))
  // En déload, rien à décider : tout passe dans la liste simple.
  // « Confirme d'abord » et « Charge max atteinte » ne proposent rien de plus qu'aujourd'hui : pas de faux choix, une simple ligne.
  // Les bonnes nouvelles d'abord : ce qui monte (une rep, la charge), puis ce qu'on reprend ou qu'on allège.
  const monte = (l: (typeof lignes)[number]) => l.conseil?.decision === 'augmenter' || l.conseil?.decision === 'plus_une_rep'
  const choix = seance.deload ? [] : lignes.filter(vraiChoix)
  const aDecider = [...choix.filter(monte), ...choix.filter((l) => !monte(l))]
  const nbMonte = choix.filter(monte).length
  /** Titre du 2e groupe : « À alléger » si tout y baisse, sinon il y a aussi des séries à refaire à la même charge. */
  const titreReste = aDecider.slice(nbMonte).every((l) => l.conseil?.decision === 'baisser') ? 'À alléger' : 'À reprendre'
  const autres = seance.deload ? lignes : lignes.filter((l) => !vraiChoix(l))

  const retirerObjectif = (id: string) =>
    onObjectifs((x) => {
      const { [id]: _retire, ...reste } = x
      return reste
    })
  const seriesDuJour = (exo: Exercice) => seance.series.filter((x) => x.exoId === exo.id)
  /** « 105 kg × 10/10/10 » : ce qui a été fait ce jour-là sur l'exercice. */
  const resumeDuJour = (exo: Exercice) => {
    const l = seriesDuJour(exo)
    return cibleTexte(exo, l.map((x) => x.charge), l.map((x) => x.reps), true)
  }
  /** Une ligne : objectif fixé, raison de refaire pareil, ou comparaison avec la dernière fois. */
  const statut = (exo: Exercice, raison: string | null, c: Suggestion | null) => {
    if (seance.deload) return ''
    const o = objectifs[exo.id]
    // Objectif fixé : la pastille « Ton objectif » le dit, en blanc.
    if (o) return ''
    if (raison) return raison
    if (c) return c.message.replace(/^Pourquoi : /, '').replace('\n', ' ')
    const precedente = historiqueDe(avant, exo.id)[0] ?? []
    if (!precedente.length) return '1re fois'
    const duJour = seriesDuJour(exo)
    const sens = duJour.flatMap((x, k) => ecartSerie(x, precedente[k], exo)?.sens ?? [])
    if (sens.includes('mieux')) return '↑ mieux que la dernière fois'
    if (sens.every((x) => x === 'egal')) {
      // Les séries faites sont les mêmes : seul le nombre de séries peut changer.
      const ecart = duJour.length - precedente.length
      if (ecart > 0) return `↑ ${ecart} série${ecart > 1 ? 's' : ''} de plus que la dernière fois`
      if (ecart < 0) return `${-ecart} série${ecart < -1 ? 's' : ''} de moins que la dernière fois`
      return 'comme la dernière fois'
    }
    return 'un peu moins que la dernière fois'
  }

  const choixDe = (id: string, c: Suggestion): 'pareil' | 'conseil' | 'perso' => {
    const o = objectifs[id]
    return !o ? 'pareil' : JSON.stringify([o.charges, o.reps]) === JSON.stringify([c.charges, c.reps]) ? 'conseil' : 'perso'
  }
  const suivreConseil = (id: string, c: Suggestion) => onObjectifs((x) => ({ ...x, [id]: { charges: c.charges, reps: c.reps } }))
  // Le bouton « tout d'un coup » ne touche jamais à un objectif fixé à la main.
  const modifiables = aDecider.filter((l) => choixDe(l.exo.id, l.conseil!) !== 'perso')
  const tousSuivis = modifiables.length > 0 && modifiables.every((l) => choixDe(l.exo.id, l.conseil!) === 'conseil')
  const basculerTous = () => modifiables.forEach((l) => (tousSuivis ? retirerObjectif(l.exo.id) : suivreConseil(l.exo.id, l.conseil!)))
  const comme = `Comme ${quand}`

  /** Le nom d'un exercice : un appui déplie ses séries quand on peut les montrer ici. */
  const nom = (exo: Exercice, classe: string, sousTitre: ReactNode) =>
    detailSeries ? (
      <button type="button" className={classe} onClick={() => basculer(exo.id)} aria-expanded={!!ouverts[exo.id]}>
        <strong>{exo.nom}</strong>
        {place?.(exo.id)}
        {sousTitre}
      </button>
    ) : (
      <div className={classe}>
        <strong>{exo.nom}</strong>
        {place?.(exo.id)}
        {sousTitre}
      </div>
    )

  return (
    <>
      {/* Ce qui compte : décider de la prochaine fois, seulement là où il y a un conseil. Le reste en une ligne. */}
      {aDecider.length > 0 && (
        <>
          <div className={'fin-titre ligne entre' + (groupes ? ' fin-titre-groupes' : '')}>
            {groupes ? <span className="faible petit">Sans choix de ta part, on refait {comme.toLowerCase()}.</span> : <h3>Pour la prochaine fois</h3>}
            {aDecider.length >= 3 && modifiables.length > 0 && (
              <button type="button" className="fin-suivre" onClick={basculerTous}>
                {tousSuivis ? `tout ${comme.toLowerCase()}` : 'suivre les conseils'}
              </button>
            )}
          </div>
          {aDecider.map(({ plan, exo, s: base, conseil: c }, rang) => {
            const o = objectifs[exo.id]
            const choix = choixDe(exo.id, c!)
            const memeCharge = JSON.stringify(base.charges) === JSON.stringify(c!.charges)
            const titreGroupe = !groupes ? null : rang === 0 && nbMonte > 0 ? ['Tu peux viser plus', nbMonte] : rang === nbMonte ? [titreReste, aDecider.length - nbMonte] : null
            return (
              <Fragment key={plan.exoId}>
              {titreGroupe && (
                <div className="fin-groupe">
                  <h3>{titreGroupe[0]}</h3>
                  <span className="faible petit">{titreGroupe[1]}</span>
                </div>
              )}
              <div className="carte decision">
                <div className="decision-tete">
                  {nom(
                    exo,
                    'decision-nom',
                    <span className="faible petit">
                      {memeCharge ? '' : `${quand} `}
                      {chargesTexte(exo, base.charges, true)}
                      {detailSeries && (
                        <>
                          {' '}
                          · {ouverts[exo.id] ? 'masquer' : 'voir'} les séries
                          <ChevronDown size={14} className={'ico-texte decision-chevron' + (ouverts[exo.id] ? ' ouvert' : '')} />
                        </>
                      )}
                    </span>
                  )}
                  <button type="button" className="decision-crayon" onClick={() => setAjuste(exo.id)} aria-label={`Autre objectif pour ${exo.nom}`}>
                    <Pencil size={18} />
                  </button>
                </div>
                <div className="choix-prochaine" role="radiogroup" aria-label={`Prochaine fois, ${exo.nom}`}>
                  <button type="button" role="radio" aria-checked={choix === 'pareil'} className={choix === 'pareil' ? 'actif' : ''} onClick={() => retirerObjectif(exo.id)}>
                    <span className="faible">
                      {choix === 'pareil' && <Coche />}
                      {comme}
                    </span>
                    <strong>{base.reps.join('/')}</strong>
                  </button>
                  <button type="button" role="radio" aria-checked={choix === 'conseil'} className={choix === 'conseil' ? 'actif' : ''} onClick={() => suivreConseil(exo.id, c!)}>
                    <span className="faible">
                      {choix === 'conseil' && <Coche />}
                      {libelleConseil(c!, base)}
                    </span>
                    <strong>
                      <Valeur exo={exo} cible={c!} base={base} />
                    </strong>
                  </button>
                  {/* Fixé au crayon : c'est le choix coché, aussi visible que les deux autres (avant, une petite ligne grise faisait croire que rien n'était enregistré). */}
                  {choix === 'perso' && (
                    <button type="button" role="radio" aria-checked className="actif large" onClick={() => setAjuste(exo.id)} aria-label={`Ton objectif pour ${exo.nom}, le changer`}>
                      <span className="choix-texte">
                        <span className="faible">
                          <Coche />
                          Ton objectif
                        </span>
                        <strong>
                          <Valeur exo={exo} cible={o!} base={base} />
                        </strong>
                      </span>
                      <Pencil size={18} className="choix-crayon" />
                    </button>
                  )}
                </div>
                <div className="faible petit fin-pourquoi">{c!.message}</div>
                {ouverts[exo.id] && detailSeries?.(exo)}
              </div>
              </Fragment>
            )
          })}
        </>
      )}

      {autres.length > 0 && (
        <>
          <h3 className="fin-titre">{seance.deload ? 'Tes exercices' : 'On refait pareil'}</h3>
          {seance.deload && <div className="faible fin-deload">Séance allégée : pas d’objectif à fixer, la prochaine vraie séance reprend là où tu en étais.</div>}
          <div className="carte pile fin-lignes">
            {autres.map(({ plan, exo, raison, conseil: c, s: base }) => {
              const texte = statut(exo, raison, c)
              return (
                <div key={plan.exoId}>
                  <div className="ligne-fin">
                    {nom(
                      exo,
                      'ligne-fin-principal',
                      <>
                        <span className="faible petit">
                          {resumeDuJour(exo)}
                          {texte && ` · ${texte}`}
                        </span>
                        {objectifs[exo.id] && (
                          <span className="objectif-pastille">
                            <Coche />
                            Ton objectif : <Valeur exo={exo} cible={objectifs[exo.id]} base={base} long />
                          </span>
                        )}
                      </>
                    )}
                    {!seance.deload && (
                      <button type="button" className="decision-crayon" onClick={() => setAjuste(exo.id)} aria-label={`Fixer un objectif pour ${exo.nom}`}>
                        <Pencil size={18} />
                      </button>
                    )}
                  </div>
                  {ouverts[exo.id] && detailSeries?.(exo)}
                </div>
              )
            })}
          </div>
        </>
      )}

      {ajuste &&
        (() => {
          const l = lignes.find((x) => x.exo.id === ajuste)
          if (!l) return null
          const histo = historiqueDe(avant, ajuste)
          const faitesExo = seance.series.filter((x) => x.exoId === ajuste)
          return (
            <EditeurObjectif
              exo={l.exo}
              base={l.s}
              actuel={objectifs[ajuste]}
              faites={faitesExo}
              precedente={histo[0] ?? []}
              record={!!recordDuJour(l.exo, histo, faitesExo)}
              quand={quand}
              onFermer={() => setAjuste(null)}
              onValider={(o) => (onObjectifs((x) => ({ ...x, [ajuste]: o })), setAjuste(null))}
              onDefaut={() => (retirerObjectif(ajuste), setAjuste(null))}
            />
          )
        })()}
    </>
  )
}

/** La coche du choix retenu : les trois choix (comme aujourd'hui, conseil, ton objectif) se lisent pareil. */
function Coche() {
  return (
    <span className="choix-coche" aria-hidden="true">
      <Check size={12} strokeWidth={3} />
    </span>
  )
}

/** Charge et reps d'un choix, ce qui change par rapport à aujourd'hui en orange. `long` : la charge en entier (« 32 kg/main »), même inchangée. */
function Valeur({ exo, cible, base, long = false }: { exo: Exercice; cible: { charges: (number | null)[]; reps: number[] }; base: Suggestion; long?: boolean }) {
  const memeCharge = JSON.stringify(base.charges) === JSON.stringify(cible.charges)
  if (memeCharge && !long) return <RepsDiff reps={cible.reps} avant={base.reps} />
  return (
    <>
      {/* La charge change : elle seule en orange, les reps repartent forcément d'ailleurs. */}
      <span className={memeCharge ? undefined : 'fin-diff'}>{memeCharge ? chargesTexte(exo, cible.charges) : chargesCourtes(exo, cible.charges)}</span> × {memeCharge ? <RepsDiff reps={cible.reps} avant={base.reps} /> : cible.reps.join('/')}
    </>
  )
}

/** Les reps d'une option, avec en couleur celles qui changent par rapport à aujourd'hui. */
function RepsDiff({ reps, avant }: { reps: number[]; avant: number[] }) {
  return (
    <>
      {reps.map((r, i) => (
        <span key={i}>
          {i > 0 && '/'}
          {r !== avant[i] ? <span className="fin-diff">{r}</span> : r}
        </span>
      ))}
    </>
  )
}

/** Titre d'un conseil dans son option : dit ce qui change quand c'est une rep de plus. */
function libelleConseil(c: Suggestion, base: Suggestion): string {
  const plus = c.reps.flatMap((r, i) => (r > base.reps[i] ? [i] : []))
  if (c.decision === 'plus_une_rep' && plus.length === 1) return `+1 rep, ${plus[0] === 0 ? '1re' : `${plus[0] + 1}e`} série`
  if (c.decision === 'plus_une_rep' && plus.length > 1) return `+1 rep sur ${plus.length} séries`
  return (c.titre ?? 'Conseil').replace(/^💡\s*/, '')
}

/** Charge dans une option, où la place manque : le lest seul au poids du corps. */
function chargesCourtes(exo: Exercice, charges: (number | null)[]): string {
  if (exo.mode !== 'poids_corps') return chargesTexte(exo, charges)
  const c = charges[0] ?? 0
  return c === 0 ? 'sans lest' : `${c > 0 ? '+' : '−'}${kg(Math.abs(c))} kg`
}
