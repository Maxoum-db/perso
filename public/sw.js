// Service worker — réception des notifications push (PWA installée sur l'écran d'accueil).
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (_) {
    data = { title: 'Aide', body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'Aide'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag,
    data: { url: data.url || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          c.navigate(url)
          return c.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    }),
  )
})

// ── Recevoir un fichier partagé depuis une autre application ───────────────
//
// Le manifeste déclare `/partage-gpx` comme cible de partage, en POST
// multipart. Le navigateur envoie alors le fichier à cette adresse — sauf
// qu'il n'y a AUCUN serveur derrière : l'application est statique.
//
// C'est le service worker qui intercepte la requête. Il lit le fichier, le
// range dans le cache, et répond par une redirection vers l'écran qui va le
// traiter. Le fichier ne quitte donc jamais le téléphone : il ne part sur
// aucun serveur, pas même le nôtre.
//
// ⚠️ Sans cette interception, le POST partirait vers le réseau et l'hébergeur
// rendrait la page d'accueil : le partage aurait l'air de marcher, et le
// fichier serait perdu en route.

const CACHE_PARTAGE = 'partage-gpx'
const CLE_PARTAGE = '/__partage-gpx__'

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'POST' || url.pathname !== '/partage-gpx') return
  event.respondWith(
    (async () => {
      try {
        const donnees = await event.request.formData()
        const fichier = donnees.get('trace')
        if (fichier && typeof fichier !== 'string') {
          const cache = await caches.open(CACHE_PARTAGE)
          // Le nom voyage dans un en-tête : une réponse de cache ne garde pas
          // le nom du fichier, et « Balade du 14 » vaut mieux que « trace.gpx »
          // pour se relire dans six mois.
          await cache.put(
            CLE_PARTAGE,
            new Response(await fichier.arrayBuffer(), {
              headers: { 'x-nom-fichier': encodeURIComponent(fichier.name || 'trace.gpx') },
            }),
          )
        }
      } catch (_) {
        // Un partage illisible ne doit pas laisser l'utilisateur sur une erreur
        // du navigateur : on redirige quand même, et l'écran dira qu'il n'a
        // rien reçu.
      }
      return Response.redirect('/moto?partage=1', 303)
    })(),
  )
})
