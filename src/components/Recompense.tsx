import { Flame, Frown, Smile } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { Catalogue } from '../catalogue'
import Disque, { IconeCran } from './Disque'
import { dureeSeance } from './RecapSeance'
import { duree, ecartQte, kg } from '../lib/calc'
import { cransDeSeance, etatDisque, totalCrans } from '../lib/crans'
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
  placeListe,
}: {
  seance: Seance
  /** Séances terminées, la plus récente en premier. */
  terminees: Seance[]
  catalogue: Catalogue
  /** « Séance faite. » quand tout est fait ; rien sur la page « Fin de séance », qui a déjà son titre. */
  titre?: string
  forme: number | undefined
  onForme: (v: number | undefined) => void
  /** En plein écran, où rien ne défile : la hauteur (px) laissée au bloc du haut et à la liste. Elle s'arrête à ce qui tient, les gains d'abord. */
  placeListe?: number
}) {
  const n = seance.series.length
  const resume = seance.deload ? null : resumeSeance(seance, terminees, catalogue.exo)
  // Les crans de la séance (un record battu = un cran), et où en est le disque avec eux.
  const crans = cransDeSeance(seance, terminees, catalogue.exo)
  const cransAvant = totalCrans(terminees.filter((s) => s.id !== seance.id), catalogue.exo)
  const disque = etatDisque(cransAvant + crans.length)
  const disquePlein = disque.pleins > etatDisque(cransAvant).pleins
  const cransMontres = disque.crans || (disque.total ? 12 : 0)
  // Toute première séance : rien à battre encore, on dit ce qui vient d'être posé.
  const premiereSeance = !seance.deload && n > 0 && !terminees.some((s) => s.id !== seance.id)
  const enSeche = phaseA(catalogue.objectifs, seance.date)?.phase === 'seche'
  const nbExos = new Set(seance.series.map((x) => x.exoId)).size
  const ms = dureeSeance(seance)

  // Chaque exercice face à la fois d'avant : les records, ce qui est mieux, ce qui est pareil, puis le reste (sans reproche).
  const cranDe = new Map(crans.map((c) => [c.exo.id, c]))
  const rangs = { record: 0, mieux: 1, egal: 2, terne: 3 }
  const lignes = gainsDeSeance(seance, terminees, catalogue.exo)
    .map((g, ordre) => {
      const c = cranDe.get(g.exoId)
      const gain = g.gain && g.gain !== '=' ? g.gain : undefined
      const ton: keyof typeof rangs = c ? 'record' : gain ? 'mieux' : g.gain === '=' ? 'egal' : 'terne'
      const texte = c ? (gain ?? (c.genre === 'reps' ? ecartQte(c.exo, c.serie.reps - c.ancien) : 'record')) : g.gain
      return { id: g.exoId, nom: catalogue.exo(g.exoId).nom, ton, texte, ordre }
    })
    .sort((a, b) => rangs[a.ton] - rangs[b.ton] || a.ordre - b.ordre)
  const aMontrer = lignes.some((l) => l.texte) && !premiereSeance
  // Hauteurs mesurées dans le navigateur à 360 px de large : le record, le disque plein, la phrase seule ; 28 px par ligne.
  const hautBloc = crans.length === 0 ? 100 : (disquePlein ? 300 : 205) + (cransAvant === 0 ? 64 : 0)
  const max = placeListe === undefined ? lignes.length : Math.max(2, Math.floor((placeListe - hautBloc) / 28))
  const visibles = lignes.length > max ? lignes.slice(0, Math.max(1, max - 1)) : lignes
  const cachees = lignes.length - visibles.length

  return (
    <div className="recompense">
      <div className="recompense-tete">
        {titre ? <span className="voix grand">{titre}</span> : <span className="recompense-nom">{seance.nom}</span>}
        {n > 0 && (
          <span className="faible petit">
            {ms >= 60000 && `${duree(ms)} · `}
            {n} série{n > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {crans.length > 0 ? (
        <div className="carte fin-resume trame">
          {disquePlein ? (
            // Le 12e cran : le seul moment qui a droit à une animation plus longue (une fois toutes les deux ou trois semaines).
            <div className="fin-disque-plein" style={{ '--apres': `${0.25 + Math.min(crans.length, 12) * 0.25}s` } as CSSProperties}>
              <Disque crans={12} nouveaux={Math.min(crans.length - disque.crans, 12)} taille={placeListe ? 104 : 132} chiffre plein />
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
            // Le record du jour en grand, penché, sur sa trame : le premier de la séance, les autres dans la liste dessous.
            <div className="fin-heros">
              <div className="fin-heros-exo">{crans[0].exo.nom}</div>
              <div className="fin-heros-chiffre">
                <b>{crans[0].genre === 'charge' ? kg(crans[0].serie.charge) : crans[0].serie.reps}</b>
                <span>{crans[0].genre === 'charge' ? (crans[0].exo.mode === 'elastique' ? 'niveau' : 'kg') : crans[0].exo.mesure === 'temps' ? 's' : 'reps'}</span>
              </div>
              <div className="fin-heros-titre">{crans.length > 1 ? `${crans.length} records battus.` : 'Record battu.'}</div>
              <div className="fin-crans-titre">
                {crans[0].genre === 'charge'
                  ? `${crans[0].exo.assistance ? 'jamais fait avec si peu d’aide' : 'charge jamais faite'} · ${crans[0].serie.reps} reps`
                  : `${ecartQte(crans[0].exo, crans[0].serie.reps - crans[0].ancien)} · ton record était ${crans[0].ancien}`}
              </div>
              <div className="fin-heros-disque">
                <Disque crans={cransMontres} nouveaux={Math.min(crans.length, cransMontres)} taille={26} />
                <span>
                  <strong>
                    {disque.crans} cran{disque.crans > 1 ? 's' : ''} sur 12
                  </strong>{' '}
                  <span className="faible">· {disque.reste === 1 ? 'plus qu’un' : `plus que ${disque.reste}`}</span>
                </span>
              </div>
            </div>
          )}
          {/* La règle, une seule fois : le jour du tout premier cran. */}
          {cransAvant === 0 && <div className="faible petit fin-crans-regle">Un cran = un record battu sur un exercice. Il ne se perd jamais. Au 12e, ton disque est plein et tu en commences un autre.</div>}
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
        <div className="chasse">
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
          {cachees > 0 && (
            <div className="chasse-terne">
              <span>
                +{cachees} autre{cachees > 1 ? 's' : ''}
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
