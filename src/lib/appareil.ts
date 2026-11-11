let audio: AudioContext | null = null

/** À appeler sur un geste utilisateur : le navigateur n'autorise le son qu'après. */
export function debloquerSon() {
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
  } catch {
    /* pas de Web Audio */
  }
}

/** Une note qui s'éteint, attaque immédiate. */
function ton(t: number, freq: number, duree: number, volume: number) {
  if (!audio) return
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.002)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duree)
  osc.connect(gain).connect(audio.destination)
  osc.start(t)
  osc.stop(t + duree + 0.02)
}

/** Style « Fonte » (choisi après écoute sur le téléphone) : un disque qui tinte, fait de notes qui ne s'accordent pas, comme du métal. */
function fonte(debut: number, freq: number, duree = 0.45, volume = 0.28) {
  if (!audio) return
  const t = audio.currentTime + debut
  ;[
    [1, 1],
    [2.76, 0.5],
    [5.4, 0.28],
    [8.93, 0.12],
  ].forEach(([rapport, part], i) => ton(t, freq * rapport, duree / (1 + i * 0.7), volume * part))
}

export function alarme() {
  try {
    navigator.vibrate?.([300, 150, 300, 150, 600])
  } catch {
    /* pas de vibration */
  }
  fonte(0, 1200, 0.6)
  fonte(0.35, 1200, 0.6)
  fonte(0.7, 1800, 1.1, 0.32)
}

/** Tic du décompte des dernières secondes de repos. */
export function tic(dernier = false) {
  vibrer(dernier ? 60 : 25)
  if (dernier) fonte(0, 1950, 0.25, 0.22)
  else fonte(0, 1300, 0.12, 0.2)
}

/**
 * Signal à la validation d'une série : un petit tintement ; deux montants si la série bat la dernière
 * fois ; un cran gagné (record battu) : deux vibrations courtes et une note haute qui dure ; trois coups et une longue vibration quand l'exercice est terminé, pour le sentir sans regarder.
 * Avec des écouteurs Bluetooth, le son arrive environ 440 ms après l'appui (mesuré sur le S25) : c'est la vibration qui confirme tout de suite.
 */
/** Les notes d'un exercice : chaque série validée sonne plus haut que la précédente (maquette écoutée par l'utilisateur, 11 nov. 2026). */
const NOTES = [1175, 1319, 1568, 1760, 2093]
const note = (rang: number) => NOTES[Math.max(0, Math.min(rang, NOTES.length - 1))]

export function signalSerie(genre: 'normale' | 'mieux' | 'cran' | 'finExercice', son = true, /** Numéro de la série dans l'exercice (0 = première) : la note monte avec lui. */ rang = 0) {
  try {
    navigator.vibrate?.(genre === 'finExercice' ? [120, 80, 120, 80, 240] : genre === 'cran' ? [70, 90, 70] : genre === 'mieux' ? [40, 40, 80] : 40)
  } catch {
    /* pas de vibration */
  }
  if (!son) return
  if (genre === 'normale') fonte(0, note(rang), 0.2, 0.22)
  else if (genre === 'mieux') (fonte(0, note(rang), 0.2, 0.22), fonte(0.12, note(rang + 1), 0.3, 0.2))
  // Un record : la note de la série, plus une note bien au-dessus qui dure.
  else if (genre === 'cran') (fonte(0, note(rang), 0.22, 0.24), fonte(0.13, note(rang + 2), 0.55, 0.24))
  else (fonte(0, 1000, 0.5), fonte(0.16, 1000, 0.5), fonte(0.32, 1500, 0.8))
}

/** Fin de séance, à l'enregistrement : l'accord complet, et une vibration qui clôt. */
export function sonFinSeance(son = true) {
  try {
    navigator.vibrate?.([90, 70, 90, 70, 260])
  } catch {
    /* pas de vibration */
  }
  if (!son) return
  ;[0, 1, 2, 4].forEach((n, k) => fonte(k * 0.11, NOTES[n], 1.4, 0.2))
}

/** Annonce d'un finisseur : deux battements, comme un cœur. */
export function battement() {
  try {
    navigator.vibrate?.([90, 150, 90, 520, 90, 150, 90])
  } catch {
    /* pas de vibration */
  }
}

export function vibrer(ms = 20) {
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* pas de vibration */
  }
}

// --- Écran toujours allumé pendant la séance --------------------------------

let verrou: WakeLockSentinel | null = null
let actif = false

async function demanderVerrou() {
  try {
    if (actif && document.visibilityState === 'visible' && 'wakeLock' in navigator) {
      verrou = await navigator.wakeLock.request('screen')
    }
  } catch {
    /* refusé (batterie faible, etc.) */
  }
}

document.addEventListener('visibilitychange', () => void demanderVerrou())

export function ecranAllume(oui: boolean) {
  actif = oui
  if (oui) void demanderVerrou()
  else {
    void verrou?.release()
    verrou = null
  }
}
