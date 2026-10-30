import { useState } from 'react'
import { dureeEchauffement, mouvement } from '../data/echauffements'
import { minutes } from '../lib/calc'
import type { Seance } from '../types'
import { majSeance } from './CarteExo'
import PictoEchauffement from './PictoEchauffement'

/** Échauffement en tête de séance tant qu'aucune série n'est faite et qu'on ne l'a pas fini ou passé. */
export const echauffementActif = (s: Seance) => !!s.echauffement?.ids.length && !s.echauffement.fini && s.series.length === 0

/** 1re étape de la séance : les mouvements à cocher, avec dessin et consignes. */
export default function Echauffement({ seance }: { seance: Seance }) {
  const [ouvert, setOuvert] = useState<string | null>(null)
  const e = seance.echauffement!
  const tousFaits = e.ids.every((id) => e.faits.includes(id))
  const cocher = (id: string) =>
    void majSeance(seance.id, (s) => {
      const f = s.echauffement!.faits
      s.echauffement!.faits = f.includes(id) ? f.filter((x) => x !== id) : [...f, id]
    })
  const finir = () =>
    void majSeance(seance.id, (s) => {
      s.echauffement!.fini = true
    })

  return (
    <div className="carte pile echauffement">
      <div className="ligne entre">
        <h2>Échauffement</h2>
        <span className="faible">≈ {minutes(Math.round(dureeEchauffement(e.ids) / 60))}</span>
      </div>
      <div>
        {e.ids.map((id) => {
          const m = mouvement(id)
          if (!m) return null
          const fait = e.faits.includes(id)
          return (
            <div key={id} className={'mouvement' + (fait ? ' fait' : '')}>
              <button className="mouvement-ligne" onClick={() => cocher(id)} aria-pressed={fait}>
                <span className="case">{fait ? '✓' : ''}</span>
                <PictoEchauffement id={id} taille={44} />
                <span className="mouvement-texte">
                  <strong>{m.nom}</strong>
                  <span className="faible">{m.quantite}</span>
                </span>
              </button>
              <button type="button" className="btn-infos" onClick={() => setOuvert(ouvert === id ? null : id)} aria-expanded={ouvert === id} aria-label={`Comment faire : ${m.nom}`}>
                {ouvert === id ? '×' : 'i'}
              </button>
              {ouvert === id && (
                <div className="mouvement-detail">
                  <PictoEchauffement id={id} taille={120} />
                  <ul className="consignes">
                    {m.consignes.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <button className={'btn grand' + (tousFaits ? ' primaire' : '')} onClick={finir}>
        {tousFaits ? '✓ Échauffé, on attaque' : 'Passer à la séance'}
      </button>
    </div>
  )
}
