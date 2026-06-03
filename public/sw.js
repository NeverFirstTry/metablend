// Caches the app shell so it loads offline. The forecasts themselves live in
// localStorage (see page.js) — this is just the static stuff.
const CACHE = 'metablend-v1'
const SHELL = ['/', '/leaderboard', '/heatmap', '/manifest.json', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // same-origin only; the app deals with offline API calls itself
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  // pages: try the network, fall back to whatever we cached
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => {
          const copy = res.clone()
          caches.open(CACHE).then(c => c.put(request, copy)).catch(() => {})
          return res
        })
        .catch(() => caches.match(request).then(r => r ?? caches.match('/')))
    )
    return
  }

  // assets: serve cached, refresh in the background
  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request)
        .then(res => {
          const copy = res.clone()
          caches.open(CACHE).then(c => c.put(request, copy)).catch(() => {})
          return res
        })
        .catch(() => cached)
      return cached ?? network
    })
  )
})
