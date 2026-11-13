import { Flame, Frown, Smile } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { Catalogue } from '../catalogue'
import { useCaps } from './Caps'
import Disque, { IconeCran } from './Disque'
import { dureeSeance } from './RecapSeance'
import { capFranchiDans, dureeCap, texteCap } from '../lib/caps'
import { duree, ecartQte, kg } from '../lib/calc'
import { cransDeSeance, etatDisque, totalCrans, type CranGagne } from '../lib/crans'
import { gainsDeSeance, resumeSeance } from '../lib/motivation'
import { phaseA } from '../lib/objectifs'
import type { Seance } from '../types'

export const OPTIONS_FORME = [
  { val: 1, label: 'Difficile', Icon: Frown, couleur: 'var(--danger)' },
  { val: 3, label: 'Bien', Icon: Smile, couleur: 'var(--ok)' },
  { val: 5, label: 'Au top', Icon: Flame, couleur: 'var(--accent)' },
] as const

/**
 * La récompense d'une séance, sur un seul écran (direction « deux temps », choisie sur maquette le 12 nov. 2026) : le record du
 * jour en grand (sinon ce qui a été mieux, sinon « Séance tenue. »), le disque, chaque exercice avec son gain face à la fois
 * d'avant, et « Comment c'était ? ». Les choix pour la prochaine fois sont sur l'écran suivant. Un seul chiffre en grand, et
 * toujours un chiffre dont on est fier : jamais « 1 série sur 17 ».
 */
export default function Recompense({
  seance,
  terminees,
  catalogue,
  titre,
  forme,
  onForme,
  plein,
}: {
  seance: Seance
  /** Séances terminées, la plus récente en premier. */
  terminees: Seance[]
  catalogue: Catalogue
  /** « Séance faite. » quand tout est fait ; rien sur la page « Fin de séance », qui a déjà son titre. */
  titre?: string
  forme: number | undefined
  onForme: (v: number | undefined) => void
  /** En plein écran, où rien ne défile : la liste s'arrête à ce qui tient (mesuré), les gains d'abord. */
  plein?: boolean
}) {
  const n = seance.series.length
  const resume = seance.deload ? null : resumeSeance(seance, terminees, catalogue.exo)
  // Les crans de la séance (un record battu = un cran), et où en est le disque avec eux.
  const crans = cransDeSeance(seance, terminees, catalogue.exo)
  const cransAvant = totalCrans(terminees.filter((s) => s.id !== seance.id), catalogue.exo)
  const disque = etatDisque(cransAvant + crans.length)
  const disquePlein = disque.pleins > etatDisque(cransAvant).pleins
  const cransMontres = disque.crans || (disque.total ? 12 : 0)
  // Un cap qui tombe aujourd'hui passe devant le record : il arrive quelques fois par an.
  const caps = useCaps()
  const tombe = caps?.find((c) => capFranchiDans(c, seance, terminees))
  const exoCap = tombe && catalogue.exo(tombe.exoId)
  // Toute première séance : rien à battre encore, on dit ce qui vient d'être posé.
  const premiereSeance = !seance.deload && n > 0 && !terminees.some((s) => s.id !== seance.id)
  const enSeche = phaseA(catalogue.objectifs, seance.date)?.phase === 'seche'
  const nbExos = new Set(seance.series.map((x) => x.exoId)).size
  const ms = dureeSeance(seance)

  // Chaque exercice face à la fois d'avant : les records, ce qui est mieux, ce qui est pareil, puis le reste (sans reproche).
  const cranDe = new Map(crans.map((c) => [c.exo.id, c]))
  const rangs = { record: 0, mieux: 1, egal: 2, terne: 3, nouveau: 4 }
  const toutes = gainsDeSeance(seance, terminees, catalogue.exo)
    .map((g, ordre) => {
      const c = cranDe.get(g.exoId)
      const gain = g.gain && g.gain !== '=' ? g.gain : undefined
      const ton: keyof typeof rangs = c ? 'record' : gain ? 'mieux' : g.gain === '=' ? 'egal' : g.premiere ? 'nouveau' : 'terne'
      const texte = c ? (gain ?? (c.genre === 'reps' ? ecartQte(c.exo, c.serie.reps - c.ancien) : 'record')) : g.premiere ? '1re fois' : g.gain
      return { id: g.exoId, nom: catalogue.exo(g.exoId).nom, ton, texte, ordre }
    })
    .sort((a, b) => rangs[a.ton] - rangs[b.ton] || a.ordre - b.ordre)
  // Le compte, en une ligne au-dessus de la liste (retour de l'utilisateur, 13 nov. 2026 : « seule l'extension a un record ? »).
  const compte = { mieux: 0, sans: 0, nouveaux: 0 }
  for (const l of toutes) {
    if (l.ton === 'mieux') compte.mieux++
    else if (l.ton === 'egal' || l.ton === 'terne') compte.sans++
    else if (l.ton === 'nouveau') compte.nouveaux++
  }
  const nbParties = [crans.length, compte.mieux, compte.sans, compte.nouveaux].filter(Boolean).length
  const aMontrer = toutes.some((l) => l.texte) && !premiereSeance
  // Un seul record : il est en grand dans la carte, la liste ne le répète pas.
  const seulRecord = crans.length === 1 && !tombe && !disquePlein
  const lignes = seulRecord ? toutes.filter((l) => l.id !== crans[0].exo.id) : toutes
  // En plein écran, rien ne défile : la liste prend la place libre (CSS), et on compte les lignes de 28 px qui y tiennent.
  const racine = useRef<HTMLDivElement>(null)
  const [max, setMax] = useState(Infinity)
  useLayoutEffect(() => {
    const liste = plein ? racine.current?.querySelector<HTMLElement>('.chasse') : null
    if (!liste) return
    const mesurer = () => {
      const compte = liste.querySelector<HTMLElement>('.chasse-compte')
      const haut = compte ? compte.offsetHeight + parseFloat(getComputedStyle(compte).marginBottom) : 0
      setMax(Math.max(0, Math.floor((liste.clientHeight - haut) / 28)))
    }
    mesurer()
    const suivi = new ResizeObserver(mesurer)
    suivi.observe(liste)
    return () => suivi.disconnect()
  }, [plein, aMontrer])
  const visibles = lignes.length > max ? lignes.slice(0, Math.max(0, max - 1)) : lignes
  const cachees = lignes.length - visibles.length

  return (
    <div ref={racine} className="recompense">
      <div className="recompense-tete">
        {titre ? <span className="voix grand">{titre}</span> : <span className="recompense-nom">{seance.nom}</span>}
        {n > 0 && (
          <span className="faible petit">
            {ms >= 60000 && `${duree(ms)} · `}
            {n} série{n > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {crans.length > 0 || (tombe && exoCap) ? (
        <div className="carte fin-resume trame">
          {tombe && exoCap ? (
            // Le cap franchi : le chiffre visé en grand, d'où on partait et le temps mis, dit après coup.
            <div className="fin-heros">
              <div className="fin-heros-exo">{exoCap.nom}</div>
              <div className="fin-heros-chiffre">
                <b>{kg(tombe.cible)}</b>
                <span>{tombe.genre === 'reps' ? 'reps' : exoCap.mode === 'par_main' ? 'kg/main' : 'kg'}</span>
              </div>
              <div className="fin-heros-titre">Cap franchi.</div>
              <div className="fin-crans-titre">
                Tu partais de {texteCap(exoCap, tombe, tombe.depart)}. {dureeCap(tombe.depuis, seance.date).replace(/^e/, 'E')}.
              </div>
              {crans.length > 0 && (
                <div className="fin-heros-disque">
                  <Disque crans={cransMontres} nouveaux={Math.min(crans.length, cransMontres)} taille={26} />
                  <span>
                    <strong>{disquePlein ? 'Disque plein' : `Record battu · ${disque.crans} cran${disque.crans > 1 ? 's' : ''} sur 12`}</strong>
                  </span>
                </div>
              )}
            </div>
          ) : disquePlein ? (
            // Le 12e cran : le seul moment qui a droit à une animation plus longue (une fois toutes les deux ou trois semaines).
            <div className="fin-disque-plein" style={{ '--apres': `${0.25 + Math.min(crans.length, 12) * 0.25}s` } as CSSProperties}>
              <Disque crans={12} nouveaux={Math.min(crans.length - disque.crans, 12)} taille={plein ? 104 : 132} chiffre plein />
              <h2>Disque plein</h2>
              <div className="fin-crans-titre">
                {crans.length} record{crans.length > 1 ? 's' : ''} battu{crans.length > 1 ? 's' : ''} aujourd’hui
              </div>
              <div className="faible petit fin-disque-suite">
                {disque.crans ? `Ton ${disque.numero}e disque a déjà ${disque.crans} cran${disque.crans > 1 ? 's' : ''}.` : `Ton ${disque.numero}e disque commence à la prochaine séance.`}
              </div>
              <span className="pastille fin-disque-suite">
                <Disque crans={12} taille={16} plein /> {disque.pleins} disque{disque.pleins > 1 ? 's' : ''} plein{disque.pleins > 1 ? 's' : ''}
              </span>
            </div>
          ) : (
            // Un record : l'exercice et son chiffre en grand. Plusieurs : leur nombre en grand, chacun dans la liste dessous, à
            // égalité (avant, le premier de la séance prenait la carte, et on lisait « 35 kg, 3 records battus »).
            <div className="fin-heros">
              {seulRecord ? (
                <>
                  <div className="fin-heros-exo">{crans[0].exo.nom}</div>
                  <div className="fin-heros-chiffre">
                    <b>{crans[0].genre === 'charge' ? kg(crans[0].serie.charge) : crans[0].serie.reps}</b>
                    <span>{crans[0].genre === 'charge' ? (crans[0].exo.mode === 'elastique' ? 'niveau' : 'kg') : crans[0].exo.mesure === 'temps' ? 's' : 'reps'}</span>
                  </div>
                  <div className="fin-heros-titre">Record battu.</div>
                  <div className="fin-crans-titre">{detailRecord(crans[0])}</div>
                </>
              ) : (
                <div className="fin-heros-chiffre">
                  <b>{crans.length}</b>
                  <span className="fin-heros-suite">records battus.</span>
                </div>
              )}
              <div className="fin-heros-disque">
                <Disque crans={cransMontres} nouveaux={Math.min(crans.length, cransMontres)} taille={26} />
                <span>
                  <strong>
                    {disque.crans} cran{disque.crans > 1 ? 's' : ''} sur 12
                  </strong>{' '}
                  {/* La règle tient en une ligne le jour du tout premier cran. */}
                  <span className="faible">· {cransAvant === 0 ? 'un record = un cran' : disque.reste === 1 ? 'plus qu’un' : `plus que ${disque.reste}`}</span>
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="recompense-sobre">
          {premiereSeance ? (
            <>
              <div className="voix grand">
                Tes repères sont posés.
                <br />
                <span className="voix-gris voix-suite">
                  {nbExos} exercice{nbExos > 1 ? 's' : ''}.
                </span>
              </div>
              <div className="faible petit">La prochaine fois, chaque record battu taille un cran dans ton disque.</div>
            </>
          ) : seance.deload ? (
            <div className="voix grand">
              <span className="texte-finisseur">Allégée.</span> <span className="voix-gris">Sans forcer.</span>
            </div>
          ) : n === 0 ? (
            <div className="faible">Aucune série validée : rien à enregistrer.</div>
          ) : resume && resume.mieux > 0 ? (
            <div className="voix grand">
              {resume.mieux} exercice{resume.mieux > 1 ? 's' : ''} <span className="ok-texte">mieux.</span>
              <br />
              <span className="voix-gris voix-suite">Pas de record. Pas loin.</span>
            </div>
          ) : (
            <div className="voix grand">Séance tenue.</div>
          )}
          {enSeche && !seance.deload && !premiereSeance && n > 0 && <div className="faible petit">En sèche, on vise à tenir : garder tes charges, c’est réussi.</div>}
        </div>
      )}

      {aMontrer && (
        <div className={'chasse' + (plein ? ' chasse-pleine' : '')}>
          {nbParties > 1 && (
            <div className="chasse-compte">
              <small>Face à la dernière fois</small>
              <span>
                {[
                  crans.length > 0 && <b key="r">{crans.length} record{crans.length > 1 ? 's' : ''}</b>,
                  compte.mieux > 0 && <b key="m" className="ok-texte">{compte.mieux} mieux</b>,
                  compte.sans > 0 && <span key="s">{compte.sans} sans progrès</span>,
                  compte.nouveaux > 0 && <span key="n">{compte.nouveaux} première{compte.nouveaux > 1 ? 's' : ''} fois</span>,
                ]
                  .filter(Boolean)
                  .flatMap((x, k) => (k ? [<span key={'p' + k} className="chasse-point">·</span>, x] : [x]))}
              </span>
            </div>
          )}
          {visibles.map((l) => (
            <div key={l.id} className={'chasse-' + l.ton}>
              <span>{l.nom}</span>
              {l.texte && (
                <span className="chasse-gain">
                  {l.ton === 'record' && <IconeCran taille={16} />}
                  {l.texte}
                </span>
              )}
            </div>
          ))}
          {cachees > 0 && visibles.length > 0 && (
            <div className="chasse-terne">
              <span>
                +{cachees} {lignes.slice(visibles.length).every((l) => l.ton === 'egal' || l.ton === 'terne') ? 'sans progrès' : cachees > 1 ? 'autres' : 'autre'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Ici plutôt que sur l'écran des choix : on répond à chaud, et « Enregistrer » n'attend plus que les décisions. */}
      {n > 0 && (
        <div className="fin-sensations">
          <div className="faible petit">Comment c’était ?</div>
          <div className="fin-sensations-choix">
            {OPTIONS_FORME.map((o) => (
              <button key={o.val} type="button" className={forme === o.val ? 'actif' : ''} aria-pressed={forme === o.val} onClick={() => onForme(forme === o.val ? undefined : o.val)}>
                <o.Icon size={18} style={{ color: forme === o.val ? 'var(--texte)' : o.couleur }} />
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** Sous le record en grand : de combien il bat l'ancien, et la série. « +6 kg sur ton record · 15 reps ». */
function detailRecord(c: CranGagne): string {
  if (c.genre === 'reps') return `${ecartQte(c.exo, c.serie.reps - c.ancien)} · ton record était ${c.ancien}`
  const d = Math.round((c.serie.charge - c.ancien) * 100) / 100
  if (c.exo.assistance || c.exo.mode === 'elastique' || d <= 0) return `${c.exo.assistance ? 'jamais fait avec si peu d’aide' : 'charge jamais faite'} · ${c.serie.reps} reps`
  return `+${kg(d)} kg sur ton record · ${c.serie.reps} reps`
}
