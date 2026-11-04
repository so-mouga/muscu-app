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
 * fois ; trois coups et une longue vibration quand l'exercice est terminé, pour le sentir sans regarder.
 * Avec des écouteurs Bluetooth, le son arrive environ 440 ms après l'appui (mesuré sur le S25) : c'est la vibration qui confirme tout de suite.
 */
export function signalSerie(genre: 'normale' | 'mieux' | 'finExercice', son = true) {
  try {
    navigator.vibrate?.(genre === 'finExercice' ? [120, 80, 120, 80, 240] : genre === 'mieux' ? [40, 40, 80] : 40)
  } catch {
    /* pas de vibration */
  }
  if (!son) return
  if (genre === 'normale') fonte(0, 1500, 0.14, 0.2)
  else if (genre === 'mieux') (fonte(0, 1300, 0.18, 0.22), fonte(0.12, 1950, 0.3, 0.22))
  else (fonte(0, 1000, 0.5), fonte(0.16, 1000, 0.5), fonte(0.32, 1500, 0.8))
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
