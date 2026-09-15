// Le fichier partagé, récupéré depuis le cache où le service worker l'a laissé.
//
// Le chemin est imposé par la spécification du partage : le navigateur envoie
// un POST, seul un service worker peut l'intercepter sans serveur, et un
// service worker ne peut pas rendre la main à la page autrement qu'en la
// redirigeant. Le cache est la boîte aux lettres entre les deux.

const CACHE_PARTAGE = 'partage-gpx'
const CLE_PARTAGE = '/__partage-gpx__'

export interface FichierPartage {
  nom: string
  texte: string
}

/**
 * Relève la boîte aux lettres, et la vide.
 *
 * La vider est la moitié du travail : sans ça, rouvrir la section Moto
 * réimporterait le même trajet à chaque visite, indéfiniment.
 */
export async function releverPartage(): Promise<FichierPartage | null> {
  if (typeof caches === 'undefined') return null
  try {
    const cache = await caches.open(CACHE_PARTAGE)
    const rep = await cache.match(CLE_PARTAGE)
    if (!rep) return null
    const texte = await rep.text()
    const brut = rep.headers.get('x-nom-fichier')
    await cache.delete(CLE_PARTAGE)
    return { nom: brut ? decodeURIComponent(brut) : 'trace.gpx', texte }
  } catch {
    return null
  }
}

/**
 * Enregistre le service worker, s'il ne l'est pas déjà.
 *
 * Il l'était uniquement à l'activation des notifications — ce qui suffisait
 * tant qu'il ne servait qu'à elles. Le partage, lui, doit fonctionner sans
 * qu'on ait rien activé : une cible de partage déclarée mais jamais interceptée
 * est pire que pas de cible du tout, puisqu'elle apparaît dans le menu du
 * téléphone et perd le fichier.
 */
export async function assurerServiceWorker(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  try {
    const deja = await navigator.serviceWorker.getRegistration()
    if (!deja) await navigator.serviceWorker.register('/sw.js')
  } catch {
    /* refusé, hors HTTPS, ou navigateur sans service worker : le partage ne
       sera simplement pas proposé. */
  }
}
