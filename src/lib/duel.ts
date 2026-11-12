import { ecartSerie, enTemps, kg, qte } from './calc'
import type { Revanche } from './revanche'
import type { Exercice, Serie } from '../types'

/**
 * Le duel : en séance, chaque série se joue contre la même série de la dernière fois (plein écran, maquette
 * `maquettes/seance-parcours.html`, validée le 12 nov. 2026). Ici, ce que disent le titre au-dessus du tableau et la
 * ligne sous le chiffre, qui suivent la charge et les reps réglées. Même mesure que partout : la charge puis les reps
 * (`ecartSerie`), jamais l'effort noté.
 */

/** `gagne` : record ou revanche (orange et trame) ; `mieux` : au-dessus de la dernière fois (vert) ; sinon du gris. */
export type TonDuel = 'gagne' | 'mieux' | 'egal' | 'moins' | 'neutre'
export interface Verdict {
  ton: TonDuel
  texte: string
  /** Cette série battrait le record de l'exercice : le petit disque devant le texte. */
  cran?: boolean
}

export interface EtatDuel {
  reps: number
  charge: number
  /** La même série, la dernière fois. */
  hier?: Serie
  /** Ce qu'il faut à cette charge pour le cran du jour (`seuilCran`). */
  seuil?: { reps: number; record?: number } | null
  revanche?: Revanche | null
}

const unite = (exo: Exercice, n: number) => (enTemps(exo) ? ' s' : Math.abs(n) > 1 ? ' reps' : ' rep')
/** La revanche vaut pour la charge où elle se joue : les reps ratées à la même charge, ou la charge qu'on retrouve. */
const revancheIci = (v: EtatDuel) => (v.revanche?.genre === 'reps' ? !!v.hier && v.charge === v.hier.charge : v.revanche?.genre === 'charge' ? v.charge >= v.revanche.vise : false)

/** La ligne sous le chiffre du jour : où il en est face à la dernière fois, et s'il vaut un record. */
export function verdictSaisie(exo: Exercice, v: EtatDuel): Verdict | null {
  const { reps, charge, hier, seuil, revanche } = v
  if (reps <= 0) return null
  if (revanche?.genre === 'reps' && revancheIci(v)) {
    if (reps >= revanche.vise) return { ton: 'gagne', texte: 'Revanche prise.' }
    const d = reps - revanche.avant
    return d > 0 ? { ton: 'mieux', texte: `+${d} · encore ${revanche.vise - reps} pour la revanche` } : { ton: 'moins', texte: `La dernière fois : ${revanche.avant}` }
  }
  if (seuil && reps >= seuil.reps) {
    const pourquoi = seuil.record === undefined ? (exo.assistance ? 'Jamais fait avec si peu d’aide' : 'Charge jamais faite') : `+${reps - seuil.record}${unite(exo, reps - seuil.record)}`
    return { ton: 'gagne', cran: true, texte: `${pourquoi} · record · +1 cran` }
  }
  if (hier) {
    const e = ecartSerie({ ...hier, charge, reps }, hier, exo)!
    const memeCharge = charge === hier.charge
    if (e.sens === 'egal') return { ton: 'egal', texte: enTemps(exo) ? 'Égalité. Tiens encore.' : 'Égalité. Encore une.' }
    const ecart = memeCharge ? `${reps > hier.reps ? '+' : '−'}${Math.abs(reps - hier.reps)}${unite(exo, reps - hier.reps)}` : e.texte
    if (e.sens === 'mieux') return { ton: 'mieux', texte: `${ecart} sur la dernière fois${memeCharge && seuil?.record !== undefined ? ` · record : ${qte(exo, seuil.record)}` : ''}` }
    return { ton: 'moins', texte: `${ecart} sur la dernière fois` }
  }
  if (seuil?.record !== undefined) return { ton: 'neutre', texte: `Ton record à cette charge : ${qte(exo, seuil.record)}` }
  return null
}

/** Une phrase en deux ou trois morceaux : du gris avant, le fort, un mot en couleur, du gris après. */
export interface Phrase {
  avant?: string
  fort: string
  accent?: string
  apres?: string
}

/** La revanche en deux phrases courtes : ce qu'on avait fait, ce qu'il faut faire. Elles tiennent chacune sur une ligne. */
export const phraseRevanche = (r: Revanche): Phrase =>
  r.genre === 'reps' ? { avant: `Tu t’étais arrêté à ${r.avant}.`, fort: 'Aujourd’hui, ', accent: `${r.vise}.` } : { avant: `Redescendu à ${kg(r.avant)} kg.`, fort: 'Aujourd’hui, ', accent: `${kg(r.vise)} kg.` }

/** Le titre au-dessus du tableau, à la saisie : qui est l'adversaire de cette série. */
export function titreSaisie(exo: Exercice, v: Pick<EtatDuel, 'charge' | 'hier' | 'revanche'> & { premiereFois: boolean; allegee: boolean; finisseur: boolean }): Phrase | null {
  if (v.finisseur) return { fort: 'Jusqu’à l’échec. ', accent: 'À fond.' }
  if (v.allegee) return { fort: 'Allégée. ', apres: 'Sans forcer.' }
  if (v.premiereFois) return { fort: 'Première fois. ', apres: 'Ton repère.' }
  const r = v.revanche
  if (r && revancheIci({ ...v, reps: 0 })) return phraseRevanche(r)
  if (!v.hier) return null
  const dur = (exo.assistance ? -1 : 1) * (v.charge - v.hier.charge)
  if (dur > 0) return { fort: exo.assistance ? 'Moins d’aide qu’avant.' : 'Plus lourd qu’avant.' }
  if (dur < 0) return null
  return { fort: `Bats ${qte(exo, v.hier.reps)}.` }
}

/** Séries du jour mieux que la même série la dernière fois (charge plus dure, ou plus de reps à la même charge). */
export const mieuxQueHier = (exo: Exercice, faites: Serie[], hier: Serie[] | undefined) => faites.filter((f, k) => ecartSerie(f, hier?.[k], exo)?.sens === 'mieux').length

/** Le petit signe à côté d'une série faite : « +1 » (ou « ↑ » si la charge a changé), « = », rien si c'est moins bien. */
export function gainSerie(exo: Exercice, fait: Serie, hier: Serie | undefined): { sens: 'mieux' | 'egal'; texte: string } | null {
  const e = ecartSerie(fait, hier, exo)
  if (!e || e.sens === 'moins') return null
  if (e.sens === 'egal') return { sens: 'egal', texte: '=' }
  return { sens: 'mieux', texte: fait.charge === hier!.charge ? `+${fait.reps - hier!.reps}` : '↑' }
}
