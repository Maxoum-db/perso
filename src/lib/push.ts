import { supabase } from './supabase'

// Notifications push (Web Push). Sur iOS, ça ne fonctionne QUE si l'app est
// ajoutée à l'écran d'accueil (iOS 16.4+) et ouverte depuis cette icône.

// Clé VAPID publique (sans danger côté client). La clé privée est un secret serveur.
const VAPID_PUBLIC = 'BAhOWJoa2BOi5Yra8m6j0R3owNUqhy_1rxuLa0uHw12_YicKWDaq0pgeVXv0LgT8BU_FJzvcvBEphq1bwFS2uKM'

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** PWA installée (ouverte depuis l'écran d'accueil) — requis sur iOS. */
export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration()
  return existing ?? (await navigator.serviceWorker.register('/sw.js'))
}

export async function pushStatus(): Promise<'unsupported' | 'denied' | 'on' | 'off'> {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    return sub ? 'on' : 'off'
  } catch {
    return 'off'
  }
}

/** Active les notifications : permission + abonnement + sauvegarde. */
export async function enablePush(userId: string): Promise<void> {
  if (!pushSupported()) throw new Error('Notifications non supportées sur cet appareil/navigateur.')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Permission refusée.')

  const reg = await registration()
  await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as BufferSource,
    })
  }
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      ua: navigator.userAgent,
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw new Error(error.message)
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  }
}

/** Envoie une notification de test à soi-même (via l'edge function push-send). */
export async function sendTestPush(): Promise<void> {
  const { data, error } = await supabase.functions.invoke('push-send', {
    body: { test: true, title: 'Aide ✅', body: 'Les notifications fonctionnent !', url: '/' },
  })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  if (data?.sent === 0) throw new Error('Aucun abonnement actif — réactive les notifications.')
}
