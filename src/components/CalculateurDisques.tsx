import { useState } from 'react'
import { createPortal } from 'react-dom'
import { modifierExercice } from '../db'
import { useRetour } from '../lib/nav'
import { kg } from '../lib/calc'
import { DISQUES_STANDARDS, type PoidsBarre, repartirDisques } from '../lib/disques'
import type { Exercice } from '../types'

interface Props {
  exo: Exercice
  charge: number
  onFermer: () => void
}

/** Poids de la barre gardé dans l'exercice (fiche), donc dans les exports et la sauvegarde. */
const enregistrerBarre = (exoId: string, barre: number) => modifierExercice(exoId, { barre })

export default function CalculateurDisques({ exo, charge, onFermer }: Props) {
  const exoNom = exo.nom
  useRetour(true, onFermer)
  const [poidsBarre, setPoidsBarre] = useState<number>(exo.barre ?? 20)

  const changerBarre = (p: PoidsBarre) => {
    setPoidsBarre(p)
    void enregistrerBarre(exo.id, p)
  }

  const rep = repartirDisques(charge, poidsBarre, DISQUES_STANDARDS)

  return createPortal(
    <div className="modal-fond dialogue" onClick={onFermer}>
      <div
        className="modal pile"
        role="dialog"
        aria-label="Calculateur de disques"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 360, width: '100%' }}
      >
        <div className="ligne entre" style={{ marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>🏋️ Disques à charger</h2>
          <button className="btn discret petit" onClick={onFermer}>
            ✕
          </button>
        </div>

        <div className="faible" style={{ marginBottom: 8 }}>
          {exoNom} · <strong>{kg(charge)} kg</strong> au total
        </div>

        {/* Choix du poids de la barre */}
        <div>
          <div className="faible" style={{ marginBottom: 6, fontSize: 13 }}>
            Poids de la barre (gardé pour cet exercice, aussi dans sa fiche) :
          </div>
          <div className="segments" style={{ marginBottom: 12 }}>
            <button
              type="button"
              className={poidsBarre === 20 ? 'actif' : ''}
              onClick={() => changerBarre(20)}
            >
              20 kg
            </button>
            <button
              type="button"
              className={poidsBarre === 15 ? 'actif' : ''}
              onClick={() => changerBarre(15)}
            >
              15 kg
            </button>
            <button
              type="button"
              className={poidsBarre === 10 ? 'actif' : ''}
              onClick={() => changerBarre(10)}
            >
              10 kg (Smith)
            </button>
            <button
              type="button"
              className={poidsBarre === 0 ? 'actif' : ''}
              onClick={() => changerBarre(0)}
            >
              0 kg
            </button>
          </div>
        </div>

        {/* Résultat par côté */}
        {charge <= poidsBarre ? (
          <div className="carte pile" style={{ textAlign: 'center', background: 'var(--surface)' }}>
            <strong>Barre seule ({poidsBarre} kg)</strong>
            <span className="faible">Aucun disque à ajouter de chaque côté.</span>
          </div>
        ) : (
          <div className="carte pile" style={{ background: 'var(--surface)', gap: 12 }}>
            <div className="ligne entre" style={{ borderBottom: '1px solid var(--bord)', paddingBottom: 8 }}>
              <span>Par côté :</span>
              <strong style={{ fontSize: 20, color: 'var(--accent)' }}>
                {kg(rep.chargeParCote)} kg
              </strong>
            </div>

            {/* Liste visuelle des disques */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              {rep.disques.map((d) => (
                <div
                  key={d.poids}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    borderRadius: 10,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--bord)',
                  }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background:
                        d.poids === 20
                          ? '#2563eb'
                          : d.poids === 10
                            ? '#16a34a'
                            : d.poids === 5
                              ? '#eab308'
                              : d.poids === 2.5
                                ? '#dc2626'
                                : '#64748b',
                      display: 'inline-block',
                    }}
                  />
                  <strong>
                    {d.quantite} × {kg(d.poids)} kg
                  </strong>
                </div>
              ))}
            </div>

            {rep.reste > 0 && (
              <div className="faible" style={{ color: 'var(--attention)' }}>
                ⚠️ Reste non décomposable avec les disques standards : {kg(rep.reste)} kg par côté.
              </div>
            )}

            <div className="faible" style={{ fontSize: 12, marginTop: 4 }}>
              Détail : {poidsBarre > 0 ? `${poidsBarre} kg (barre) + ` : ''}2 × {kg(rep.chargeParCote)} kg = {kg(charge)} kg
            </div>
          </div>
        )}

        <button className="btn primaire plein" onClick={onFermer} style={{ marginTop: 8 }}>
          Fermer
        </button>
      </div>
    </div>,
    document.body
  )
}

/**
 * Bouton / puce compacte affichée sous le stepper de charge.
 */
export function PuceDisques({ exo, charge, unite = 'kg' }: { exo: Exercice; charge: number; unite?: string }) {
  const [ouvert, setOuvert] = useState(false)

  // Seulement si la fiche de l'exercice l'active (champ `barre`), en kg, et une fois la charge connue.
  if (exo.barre === undefined || unite !== 'kg' || charge <= 0) return null

  const poidsBarre = exo.barre
  const rep = repartirDisques(charge, poidsBarre, DISQUES_STANDARDS)

  const texteResume =
    charge <= poidsBarre
      ? `Barre seule (${poidsBarre} kg)`
      : `${kg(rep.chargeParCote)} kg/côté · ${rep.disques.map((d) => (d.quantite > 1 ? `${d.quantite}×` : '') + kg(d.poids) + 'kg').join(' + ')}`

  return (
    <>
      <button
        type="button"
        className="btn discret petit"
        style={{
          alignSelf: 'center',
          fontSize: 12,
          padding: '4px 10px',
          borderRadius: 8,
          background: 'var(--surface-2)',
          border: '1px solid var(--bord)',
          color: 'var(--texte-2)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
        onClick={() => setOuvert(true)}
        title="Ouvrir le calculateur de disques"
      >
        <span>🏋️</span>
        <span>{texteResume}</span>
      </button>

      {ouvert && (
        <CalculateurDisques exo={exo} charge={charge} onFermer={() => setOuvert(false)} />
      )}
    </>
  )
}
