import { useLiveQuery } from 'dexie-react-hooks'
import { Flame, Info, Link2, Pause, Pencil } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Catalogue } from '../catalogue'
import { ObjectifApres } from '../components/EditeurObjectif'
import Vignette from '../components/Vignette'
import { db, exoAvecReglages, historiqueDe } from '../db'
import { chargeQte, cibleTexte, dateISO, dureeEstimee, dureeHabituelle, kg, minutes, reposTexte, schemaPlan, seancesHabituelles } from '../lib/calc'
import { useRetour } from '../lib/nav'
import { planDeload, suggestionDeload } from '../lib/cycle'
import { hausse, suggestionPour } from '../lib/progression'
import { diagnostic, texteBlocage } from '../lib/blocages'
import { phaseA } from '../lib/objectifs'
import type { SeanceModele } from '../types'
import { informer } from '../components/Dialogues'
import { BoutonLexique } from '../components/Lexique'
import { ReglageEchauffement } from '../components/Echauffement'
import { estDansSuperset, groupeSuperset } from '../lib/superset'

interface Props {
  modele: SeanceModele
  catalogue: Catalogue
  onDemarrer: () => void
  /** Active ou coupe l'échauffement de cette séance (enregistré sur la séance, comme dans Programmes). */
  onEchauffement?: (v: SeanceModele['echauffement']) => void
  onFermer: () => void
  /** Semaine de déload : la séance sera allégée au démarrage. */
  deload?: boolean
}

export default function Apercu({ modele, catalogue, onDemarrer, onEchauffement, onFermer, deload = false }: Props) {
  useRetour(true, onFermer)
  useEffect(() => {
    document.body.classList.add('sans-onglets')
    return () => document.body.classList.remove('sans-onglets')
  }, [])
  // Les déloads ne servent pas de référence pour la progression.
  const terminees = useLiveQuery(() => db.seances.orderBy('debut').reverse().filter((s) => !s.enCours && !s.deload).toArray(), [])
  const reglages = useLiveQuery(() => db.reglages.toArray(), [], [])
  // Pour expliquer un blocage : déloads, sommeil, calories et poids.
  const deloads = useLiveQuery(() => db.seances.filter((s) => !s.enCours && !!s.deload).toArray(), [], [])
  const journal = useLiveQuery(() => db.journal.toArray(), [], [])
  const pesees = useLiveQuery(() => db.pesees.toArray(), [], [])
  const aujourdhui = dateISO()
  const contexte = terminees && { seances: [...terminees, ...deloads], journal, pesees, phase: phaseA(catalogue.objectifs, aujourdhui)?.phase, debutPhase: phaseA(catalogue.objectifs, aujourdhui)?.debut }
  // En-tête : la séance telle qu'elle sera faite (allégée en déload).
  const prevu = deload ? { ...modele, exercices: modele.exercices.map(planDeload) } : modele
  const series = prevu.exercices.reduce((a, p) => a + p.series.length, 0)
  const finisseurs = prevu.exercices.filter((p) => p.finisseur).length
  const habituelle = terminees && dureeHabituelle(modele.id, terminees)
  const nbHabituelles = terminees ? seancesHabituelles(modele.id, terminees).length : 0
  /** Exercice dont on règle l'objectif (index dans la séance). */
  const [objectif, setObjectif] = useState<number | null>(null)

  return (
    <div>
      <div className="entete">
        <button className="btn" onClick={onFermer} aria-label="Retour">
          ←
        </button>
        <div className="apercu-titre">
          <h2>{modele.nom}</h2>
          {modele.sousTitre && <div className="faible">{modele.sousTitre}</div>}
        </div>
      </div>

      <div className="apercu-resume">
        <div className="ligne">
          <span>
            ≈ {minutes(dureeEstimee(prevu))} prévues{habituelle ? ` · ${minutes(habituelle)} d’habitude` : ''}
          </span>
          <button
            type="button"
            className="btn-infos"
            aria-label="Comment la durée est calculée"
            onClick={() => void informer(`Prévu : 1 min par série et par échauffement, plus les repos.${habituelle ? (nbHabituelles > 1 ? ` D’habitude : tes ${nbHabituelles} dernières séances.` : ' D’habitude : ta dernière séance.') : ''}`, 'Durée de la séance')}
          >
            <Info size={20} />
          </button>
        </div>
        <div className="faible">
          {modele.exercices.length} exercice{modele.exercices.length > 1 ? 's' : ''} · {series} séries
          {finisseurs > 0 && <span className="texte-finisseur"> · {finisseurs} finisseur{finisseurs > 1 ? 's' : ''}</span>}
        </div>
      </div>

      {onEchauffement && <ReglageEchauffement modele={modele} onChange={onEchauffement} />}

      {deload && <div className="bandeau-deload">Semaine de déload : moitié des séries, charges −10 %, effort 6-7/10, sans échec. Récupère, et garde tes repas et tes pas comme d’habitude.</div>}

      {terminees && modele.exercices.some((p) => suggestionPour(exoAvecReglages(catalogue.exo(p.exoId), reglages), p, terminees).decision === 'calibrer') && (
        <div className="faible">À calibrer : démarre léger et ajuste jusqu’à l’effort visé dès la 1re série.</div>
      )}

      {modele.exercices.map((p0, i) => {
        const p = deload ? planDeload(p0) : p0
        const exo = exoAvecReglages(catalogue.exo(p.exoId), reglages)
        const normale = terminees && suggestionPour(exo, p, terminees)
        const sugg = normale && (deload ? suggestionDeload(exo, normale) : normale)
        const derniere = terminees && historiqueDe(terminees, p.exoId)[0]
        const hausses = sugg ? sugg.charges.map((_, n) => hausse(exo, sugg, derniere, n)) : []
        const battre = hausses.some(Boolean)
        const bloque = !deload && contexte ? diagnostic(exo, contexte, aujourdhui) : null
        const dansSuperset = estDansSuperset(modele.exercices, i)
        const groupe = groupeSuperset(modele.exercices, i)
        const posSuperset = dansSuperset ? groupe.indexOf(i) + 1 : 0
        const enchaine = !!p.enchaine
        const precEnchaine = i > 0 && !!modele.exercices[i - 1]?.enchaine
        return (
          <div
            key={p.exoId + i}
            className={
              'carte pile' +
              (dansSuperset ? ' en-superset' : '') +
              (enchaine ? ' enchaine-vers-suivant' : '') +
              (precEnchaine && !enchaine ? ' suite-superset' : '')
            }
          >
            <div className="ligne apercu-exo">
              <Vignette exo={exo} taille={44} />
              <div className="apercu-exo-texte">
                <strong>
                  {i + 1}. {exo.nom}
                </strong>
                {p.optionnel && <span className="faible"> (optionnel)</span>}
                {dansSuperset && (
                  <div>
                    <span className="badge-superset">
                      <Link2 size={12} /> Superset {posSuperset}/{groupe.length}
                    </span>
                  </div>
                )}
                <div className="faible">
                  {schemaPlan(exo, p)}
                  {/* Effort seulement s'il s'écarte du réglage par défaut (8) */}
                  {p.series.some((x) => x.rpe !== 8) && !(p.finisseur && p.series.slice(0, -1).every((x) => x.rpe === 8)) ? ` · effort ${[...new Set(p.series.map((x) => kg(x.rpe)))].join(', ')}/10` : ''} · repos {reposTexte(p)}
                  {p.finisseur && <span className="texte-finisseur"> · finisseur</span>}
                </div>
              </div>
            </div>
            {sugg && (
              <div className={'suggestion petit' + (battre ? ' a-battre' : '')}>
                <div className="ligne entre">
                  <div className="apercu-cible">
                    <strong>{cibleTexte(exo, sugg.charges, sugg.reps)}</strong>
                    {battre && (
                      <span className="badge-hausse">
                        <Flame size={12} className="ico-texte" /> À battre
                      </span>
                    )}
                  </div>
                  {derniere && !deload && (
                    <button type="button" className="btn-infos" aria-label="Modifier l’objectif" onClick={() => setObjectif(i)}>
                      <Pencil size={20} />
                    </button>
                  )}
                </div>
                {battre ? (
                  <div className="muted">
                    {hausses.map((h, n) => (h ? `S${n + 1} ${h}` : null)).filter(Boolean).join(' · ')}
                    {derniere && <> · dernière fois {derniere.map((x) => chargeQte(exo, x.charge, x.reps)).join(', ')}</>}
                  </div>
                ) : bloque ? (
                  <div className="muted">
                    <Pause size={14} fill="currentColor" className="ico-texte" /> {texteBlocage(bloque)}
                  </div>
                ) : (
                  /* « Comme la dernière fois » n'apprend rien : la cible suffit. */
                  sugg.decision !== 'pareil' && sugg.decision !== 'calibrer' && <div className="muted">{sugg.message}</div>
                )}
              </div>
            )}
            {p.chauffes.length > 0 && <div className="faible">Chauffe : {p.chauffes.join(' · ')}</div>}
            {(p.note || exo.notes) && <div className="faible">{p.note ?? exo.notes}</div>}
          </div>
        )
      })}

      {objectif !== null && terminees && (
        <ObjectifApres
          exo={exoAvecReglages(catalogue.exo(modele.exercices[objectif].exoId), reglages)}
          plan={modele.exercices[objectif]}
          terminees={terminees}
          onFermer={() => setObjectif(null)}
        />
      )}

      <BoutonLexique />

      <div className="barre-demarrer">
        <button className="btn primaire grand" onClick={onDemarrer}>
          Démarrer
        </button>
      </div>
    </div>
  )
}
