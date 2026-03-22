const CACHE_NAME = 'wow-calendar-v4'

const scopeUrl = new URL(self.registration.scope)
const BASE_PATH = scopeUrl.pathname
const APP_SHELL = `${BASE_PATH}index.html`

const PRE_CACHE = [BASE_PATH, APP_SHELL, `${BASE_PATH}manifest.webmanifest`, `${BASE_PATH}icon-192.png`, `${BASE_PATH}icon-512.png`]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRE_CACHE)
    }),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => (key === CACHE_NAME ? null : caches.delete(key)))).then(() => self.clients.claim()),
    ),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) {
    return
  }

  const isNavigation = request.mode === 'navigate'

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          void caches.open(CACHE_NAME).then((cache) => cache.put(APP_SHELL, copy))
          return response
        })
        .catch(() => caches.match(APP_SHELL).then((cached) => cached || caches.match(request))),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached
      }

      return fetch(request).then((response) => {
        const copy = response.clone()
        void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        return response
      })
    }),
  )
})
