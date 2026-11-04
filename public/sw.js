// Service worker minimal : hors ligne d'abord.
// Navigation : réseau, ou le cache si le réseau tarde ou manque. Fichiers statiques : cache puis réseau.
// Le cache n'est jamais vidé : une page ancienne doit toujours retrouver ses fichiers.
const CACHE = 'muscu-v2'
const ATTENTE_RESEAU = 1500

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './icon.svg'])))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith('muscu-')).map((k) => caches.delete(k))))
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return
  // La page (et la vérification de mise à jour) : le réseau d'abord, sans l'attendre plus de 1,5 s.
  if (req.mode === 'navigate' || new URL(req.url).pathname.endsWith('/index.html')) {
    // `no-cache` : jamais la page du cache HTTP (GitHub la garde 10 min), qui peut viser d'anciens fichiers.
    const reseau = fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then((res) => {
      const copie = res.clone()
      // La copie s'écrit même si la page du cache a déjà répondu : la mise à jour arrive à l'ouverture suivante.
      e.waitUntil(caches.open(CACHE).then((c) => c.put('./index.html', copie)))
      return res
    })
    // Réseau faible à la salle : on n'attend pas plus de 1,5 s si une page est déjà en cache.
    const repli = new Promise((ok) => setTimeout(ok, ATTENTE_RESEAU)).then(() => caches.match('./index.html'))
    e.respondWith(
      Promise.race([reseau.catch(() => null), repli]).then(
        (premiere) => premiere || caches.match('./index.html').then((cache) => cache || reseau)
      )
    )
    return
  }
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()))
          return res
        })
    )
  )
})
