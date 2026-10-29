// Service worker minimal : hors ligne d'abord.
// Navigation : réseau puis cache. Fichiers statiques : cache puis réseau.
// Le cache n'est jamais vidé : une page ancienne doit toujours retrouver ses fichiers.
const CACHE = 'muscu-v2'

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
  // La page (et la vérification de mise à jour) : toujours le réseau d'abord.
  if (req.mode === 'navigate' || new URL(req.url).pathname.endsWith('/index.html')) {
    // `no-cache` : jamais la page du cache HTTP (GitHub la garde 10 min), qui peut viser d'anciens fichiers.
    e.respondWith(
      fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
        .then((res) => {
          caches.open(CACHE).then((c) => c.put('./index.html', res.clone()))
          return res
        })
        .catch(() => caches.match('./index.html'))
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
