const CACHE_NAME = 'wow-calendar-v2'

function appPath(pathname) {
  const scopeUrl = new URL(self.registration.scope)
  return new URL(pathname, scopeUrl).toString()
}

const APP_SHELL_URL = appPath('./index.html')
const ASSETS = [appPath('./'), APP_SHELL_URL, appPath('./manifest.webmanifest')]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached
      }

      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200) {
            return response
          }

          const cloned = response.clone()
          void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned))
          return response
        })
        .catch(() => caches.match(APP_SHELL_URL))
    }),
  )
})
