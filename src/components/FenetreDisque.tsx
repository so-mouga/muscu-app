import { createPortal } from 'react-dom'
import type { Exercice, Seance } from '../types'
import { dateCourte } from '../lib/calc'
import { cransDeSeance, cransParSeance, etatDisque, texteCran } from '../lib/crans'
import { useRetour } from '../lib/nav'
import Disque from './Disque'

/** Le disque en grand : où il en est, la règle en une phrase, et les derniers crans gagnés. */
export default function FenetreDisque({ seances, exo, onFermer }: { /** Séances terminées. */ seances: Seance[]; exo: (id: string) => Exercice; onFermer: () => void }) {
  useRetour(true, onFermer)
  const parSeance = cransParSeance(seances, exo)
  const d = etatDisque(Object.values(parSeance).reduce((a, n) => a + n, 0))
  const derniers = [...seances]
    .sort((a, b) => b.debut - a.debut)
    .filter((s) => parSeance[s.id] > 0)
    .slice(0, 3)
    .flatMap((s) => cransDeSeance(s, seances, exo).map((c) => ({ c, date: s.date })))
    .slice(0, 5)
  return createPortal(
    <div className="modal-fond" onClick={onFermer}>
      <div className="modal pile" onClick={(e) => e.stopPropagation()}>
        <div className="fin-crans">
          <Disque crans={d.crans} taille={96} chiffre />
          <div>
            <h2>{d.pleins > 0 ? `Ton ${d.numero}e disque` : 'Ton disque'}</h2>
            <div>
              {d.crans} cran{d.crans > 1 ? 's' : ''} · plus que {d.reste}
            </div>
            {d.pleins > 0 && (
              <div className="faible petit">
                {d.pleins} disque{d.pleins > 1 ? 's' : ''} plein{d.pleins > 1 ? 's' : ''} · {d.total} crans en tout
              </div>
            )}
          </div>
        </div>
        <div className="faible">Un cran = un record battu sur un exercice : une charge jamais faite, ou plus de reps que jamais à une charge déjà faite. Un seul par exercice et par séance, aucun en séance allégée. Il ne se perd jamais. Au 12e, ton disque est plein et tu en commences un autre.</div>
        {derniers.length > 0 && (
          <div className="pile" style={{ gap: 4 }}>
            <h3>Derniers crans</h3>
            {derniers.map(({ c, date }) => (
              <div key={c.serie.id} className="ligne entre petit">
                <span>
                  {c.exo.nom} <span className="fin-crans-gain">{texteCran(c, true)}</span>
                </span>
                <span className="faible">{dateCourte(date)}</span>
              </div>
            ))}
          </div>
        )}
        <button type="button" className="btn plein" onClick={onFermer}>
          Compris
        </button>
      </div>
    </div>,
    document.body
  )
}
