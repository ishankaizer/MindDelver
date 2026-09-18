// Bhulandar's whole "brain" is a live word lookup (Datamuse, optionally an
// LLM), so this service worker does not try to make the app work fully
// offline - that would mean caching growth results, which would make the
// tool answer the same six branches every time. Its job is narrower: cache
// the app shell (the built JS/CSS/HTML/icons) so a repeat visit, or a
// flaky connection, still opens the reef instead of a blank tab, and so the
// browser considers the app installable in the first place.
const CACHE = 'bhulandar-shell-v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  // only the app's own shell is cached; word data and any LLM call must
  // always go live, and font requests are left to the browser's own cache
  if (url.origin !== self.location.origin) return

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((cache) => cache.put(req, copy))
        return res
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('/'))),
  )
})
