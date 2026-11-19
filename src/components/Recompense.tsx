import { Flame, Frown, Smile } from 'lucide-react'
import CircuitsFaits from './CircuitsFaits'
import { useLayoutEffect, useRef, useState } from 'react'
import type { Catalogue } from '../catalogue'
import { useCaps } from './Caps'
import { IconeCran } from './IconeCran'
import { dureeSeance } from './RecapSeance'
import { capFranchiDans, dureeCap, texteCap } from '../lib/caps'
import { chargeQte, duree, ecartQte, kg } from '../lib/calc'
import { recordsDeSeance } from '../lib/records'
import { gainsDeSeance, resumeSeance } from '../lib/motivation'
import { phaseA } from '../lib/objectifs'
import type { Seance } from '../types'

export const OPTIONS_FORME = [
  { val: 1, label: 'Difficile', Icon: Frown, couleur: 'var(--danger)' },
  { val: 3, label: 'Bien', Icon: Smile, couleur: 'var(--ok)' },
  { val: 5, label: 'Au top', Icon: Flame, couleur: 'var(--accent)' },
] as const

/**
 * La récompense d'une séance, sur un seul écran (refaite le 19 nov. 2026 sur maquette `maquettes/fin-seance-zero.html`,
 * version 2) : le résumé en titre (« 4 records. », sinon ce qui a été mieux, sinon « Séance tenue. »), puis une carte avec
 * chaque exercice, sa meilleure série du jour et celle d'avant, et ce qu'il a gagné ; puis « Comment c'était ? ». Les choix
 * pour la prochaine fois sont sur l'écran suivant. Le nombre de records n'est écrit qu'une fois, et seul un cap franchi garde
 * la grande carte sur la trame.
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
  // Les records de la séance, un par exercice au plus.
  const records = recordsDeSeance(seance, terminees, catalogue.exo)
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
  const recordDe = new Map(records.map((c) => [c.exo.id, c]))
  const rangs = { record: 0, mieux: 1, egal: 2, terne: 3, nouveau: 4 }
  const toutes = gainsDeSeance(seance, terminees, catalogue.exo)
    .map((g, ordre) => {
      const c = recordDe.get(g.exoId)
      const gain = g.gain && g.gain !== '=' ? g.gain : undefined
      const ton: keyof typeof rangs = c ? 'record' : gain ? 'mieux' : g.gain === '=' ? 'egal' : g.premiere ? 'nouveau' : 'terne'
      const texte = c ? (gain ?? (c.genre === 'reps' ? ecartQte(c.exo, c.serie.reps - c.ancien) : 'record')) : g.premiere ? '1re fois' : g.gain
      const e = catalogue.exo(g.exoId)
      const perf = g.jour && chargeQte(e, g.jour.charge, g.jour.reps)
      // La fois d'avant, seulement si elle diffère : sinon « comme la dernière fois » le dit déjà.
      const avant = g.avant && g.jour && (g.avant.charge !== g.jour.charge || g.avant.reps !== g.jour.reps) ? chargeQte(e, g.avant.charge, g.avant.reps) : undefined
      return { id: g.exoId, nom: e.nom, ton, texte: ton === 'egal' ? 'comme la dernière fois' : texte, perf, avant, ordre }
    })
    .sort((a, b) => rangs[a.ton] - rangs[b.ton] || a.ordre - b.ordre)
  const aMontrer = toutes.some((l) => l.texte) && !premiereSeance
  const lignes = toutes
  // En plein écran, rien ne défile : la zone de la liste prend la place libre (CSS), et on compte les lignes qui y tiennent.
  const racine = useRef<HTMLDivElement>(null)
  const [max, setMax] = useState(Infinity)
  useLayoutEffect(() => {
    const zone = plein ? racine.current?.querySelector<HTMLElement>('.chasse-zone') : null
    if (!zone) return
    // Hauteur d'une ligne : la plus haute vue (un record et sa fois d'avant), 50 px avant le premier affichage.
    let haut = 50
    const mesurer = () => {
      const carte = zone.querySelector<HTMLElement>('.chasse')
      if (!carte) return
      for (const x of carte.querySelectorAll<HTMLElement>('.chasse-ligne')) haut = Math.max(haut, x.offsetHeight)
      // Ce que la carte prend en plus de ses lignes : son titre et ses marges.
      const titre = carte.querySelector<HTMLElement>('.chasse-titre')
      const px = (x: string) => parseFloat(x) || 0
      const st = getComputedStyle(carte)
      const autour = (titre ? titre.offsetHeight + px(getComputedStyle(titre).marginBottom) : 0) + px(st.paddingTop) + px(st.paddingBottom)
      setMax(Math.max(1, Math.floor((zone.clientHeight - autour) / haut)))
    }
    mesurer()
    const suivi = new ResizeObserver(mesurer)
    suivi.observe(zone)
    return () => suivi.disconnect()
  }, [plein, aMontrer])
  const visibles = lignes.length > max ? lignes.slice(0, Math.max(0, max - 1)) : lignes
  const cachees = lignes.length - visibles.length

  // Le résumé en titre, une seule fois : les records, sinon ce qui a été mieux, sinon une phrase.
  const infos = n > 0 && (
    <span className="faible petit">
      {ms >= 60000 && `${duree(ms)} · `}
      {n} série{n > 1 ? 's' : ''}
    </span>
  )

  return (
    <div ref={racine} className="recompense">
      <div className="recompense-tete">
        {titre ? <span className="recompense-fait">{titre}</span> : <span className="recompense-nom">{seance.nom}</span>}
        {!titre && infos}
      </div>
      <CircuitsFaits seance={seance} avant={terminees} court />

      {tombe && exoCap ? (
        <div className="carte fin-resume trame">
          {/* Le cap franchi : le chiffre visé en grand, d'où on partait et le temps mis, dit après coup. */}
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
            {records.length > 0 && (
              <div className="fin-heros-disque">
                <IconeCran taille={20} />
                <strong>
                  {records.length} record{records.length > 1 ? 's' : ''} battu{records.length > 1 ? 's' : ''}
                </strong>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="recompense-sobre">
          {records.length > 0 ? (
            <div className="voix grand recompense-records">
              <IconeCran taille={26} />
              {records.length} record{records.length > 1 ? 's' : ''}.
            </div>
          ) : premiereSeance ? (
            <>
              <div className="voix grand">
                Tes repères sont posés.
                <br />
                <span className="voix-gris voix-suite">
                  {nbExos} exercice{nbExos > 1 ? 's' : ''}.
                </span>
              </div>
              <div className="faible petit">La prochaine fois, tu joues contre ces chiffres.</div>
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
            </div>
          ) : (
            <div className="voix grand">Séance tenue.</div>
          )}
          {titre && infos}
          {enSeche && !seance.deload && !premiereSeance && n > 0 && !records.length && <div className="faible petit">En sèche, on vise à tenir : garder tes charges, c’est réussi.</div>}
        </div>
      )}

      {aMontrer && (
        <div className={'chasse-zone' + (plein ? ' chasse-pleine' : '')}>
          <div className="chasse">
            <small className="chasse-titre">Face à la dernière fois</small>
            {visibles.map((l) => (
              <div key={l.id} className={'chasse-ligne chasse-' + l.ton}>
                <div className="chasse-gauche">
                  <span className="chasse-nom">{l.nom}</span>
                  {l.texte && (
                    <span className="chasse-gain">
                      {l.ton === 'record' && <IconeCran taille={14} />}
                      {l.texte}
                    </span>
                  )}
                </div>
                {l.perf && (
                  <div className="chasse-droite">
                    <span className="chasse-perf">{l.perf}</span>
                    {l.avant && <span className="chasse-avant">avant {l.avant}</span>}
                  </div>
                )}
              </div>
            ))}
            {cachees > 0 && visibles.length > 0 && (
              <div className="chasse-plus">
                +{cachees} {lignes.slice(visibles.length).every((l) => l.ton === 'egal' || l.ton === 'terne') ? 'sans progrès' : cachees > 1 ? 'autres' : 'autre'}
              </div>
            )}
          </div>
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
