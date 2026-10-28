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

function bip(debut: number, freq: number, duree: number) {
  if (!audio) return
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.frequency.value = freq
  osc.type = 'square'
  gain.gain.setValueAtTime(0.25, audio.currentTime + debut)
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + debut + duree)
  osc.connect(gain).connect(audio.destination)
  osc.start(audio.currentTime + debut)
  osc.stop(audio.currentTime + debut + duree)
}

export function alarme() {
  try {
    navigator.vibrate?.([300, 150, 300, 150, 600])
  } catch {
    /* pas de vibration */
  }
  bip(0, 880, 0.2)
  bip(0.3, 880, 0.2)
  bip(0.6, 1320, 0.4)
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
