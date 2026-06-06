// Connexion Spotify via OAuth PKCE (client public, sans secret).
// Le Client ID vient de VITE_SPOTIFY_CLIENT_ID (app créée sur le dashboard Spotify).

// Client ID public (PKCE) — exposé côté navigateur de toute façon. Surchargeable par env.
const CLIENT_ID =
  (import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined) || '3f1cd585e62d4562bb71015ee367852d'
const SCOPES = [
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-modify-playback-state',
  'playlist-read-private',
  'user-read-recently-played',
  'user-top-read',
].join(' ')

const T_ACCESS = 'spotify.access'
const T_REFRESH = 'spotify.refresh'
const T_EXP = 'spotify.exp'
const VERIFIER = 'spotify.verifier'

export function spotifyConfigured(): boolean {
  return !!CLIENT_ID
}

export function spotifyConnected(): boolean {
  return !!localStorage.getItem(T_REFRESH)
}

function redirectUri() {
  return `${window.location.origin}/spotify-callback`
}

function randString(len: number): string {
  const a = new Uint8Array(len)
  crypto.getRandomValues(a)
  return Array.from(a, (b) => ('0' + (b & 0xff).toString(16)).slice(-2)).join('')
}

function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function spotifyLogin() {
  if (!CLIENT_ID) throw new Error('VITE_SPOTIFY_CLIENT_ID manquant')
  const verifier = randString(48)
  localStorage.setItem(VERIFIER, verifier)
  const challenge = base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
  const url = new URL('https://accounts.spotify.com/authorize')
  url.search = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES,
  }).toString()
  window.location.href = url.toString()
}

export async function spotifyHandleCallback(code: string): Promise<void> {
  const verifier = localStorage.getItem(VERIFIER) || ''
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID || '',
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    }),
  })
  if (!res.ok) throw new Error('Échec de connexion Spotify (' + res.status + ')')
  const data = await res.json()
  storeTokens(data)
  localStorage.removeItem(VERIFIER)
}

function storeTokens(data: any) {
  if (data.access_token) localStorage.setItem(T_ACCESS, data.access_token)
  if (data.refresh_token) localStorage.setItem(T_REFRESH, data.refresh_token)
  localStorage.setItem(T_EXP, String(Date.now() + (data.expires_in || 3600) * 1000 - 60000))
}

export function spotifyLogout() {
  ;[T_ACCESS, T_REFRESH, T_EXP].forEach((k) => localStorage.removeItem(k))
}

async function getToken(): Promise<string | null> {
  const access = localStorage.getItem(T_ACCESS)
  const exp = Number(localStorage.getItem(T_EXP) || 0)
  if (access && Date.now() < exp) return access
  const refresh = localStorage.getItem(T_REFRESH)
  if (!refresh || !CLIENT_ID) return null
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, grant_type: 'refresh_token', refresh_token: refresh }),
  })
  if (!res.ok) {
    spotifyLogout()
    return null
  }
  storeTokens(await res.json())
  return localStorage.getItem(T_ACCESS)
}

async function api(path: string, init?: RequestInit): Promise<any> {
  const token = await getToken()
  if (!token) throw new Error('NOT_CONNECTED')
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
  if (res.status === 204) return null
  if (res.status === 401) {
    spotifyLogout()
    throw new Error('NOT_CONNECTED')
  }
  if (res.status === 404) throw new Error('Aucun appareil Spotify actif. Ouvre Spotify sur un appareil puis réessaie.')
  if (!res.ok) throw new Error('Erreur Spotify ' + res.status)
  return res.status === 200 ? res.json().catch(() => null) : null
}

export interface NowPlaying {
  isPlaying: boolean
  title: string
  artist: string
  cover?: string
}

export async function getNowPlaying(): Promise<NowPlaying | null> {
  const d = await api('/me/player/currently-playing')
  if (!d || !d.item) return null
  return {
    isPlaying: d.is_playing,
    title: d.item.name,
    artist: (d.item.artists || []).map((a: any) => a.name).join(', '),
    cover: d.item.album?.images?.[0]?.url,
  }
}

export async function getRecentlyPlayed(): Promise<{ title: string; artist: string; cover?: string }[]> {
  const d = await api('/me/player/recently-played?limit=20')
  return (d?.items || []).map((i: any) => ({
    title: i.track.name,
    artist: (i.track.artists || []).map((a: any) => a.name).join(', '),
    cover: i.track.album?.images?.slice(-1)[0]?.url,
  }))
}

export async function getPlaylists(): Promise<{ id: string; name: string; cover?: string; url: string }[]> {
  const d = await api('/me/playlists?limit=30')
  return (d?.items || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    cover: p.images?.[0]?.url,
    url: p.external_urls?.spotify,
  }))
}

export interface SpotifyDevice {
  id: string
  name: string
  type: string
  is_active: boolean
}

export async function getDevices(): Promise<SpotifyDevice[]> {
  const d = await api('/me/player/devices')
  return (d?.devices || []).map((x: any) => ({ id: x.id, name: x.name, type: x.type, is_active: x.is_active }))
}

/** Transfère (et active) la lecture sur un appareil. */
export function transferPlayback(deviceId: string, play = true) {
  return api('/me/player', { method: 'PUT', body: JSON.stringify({ device_ids: [deviceId], play }) })
}

/** Garantit un appareil actif : renvoie l'id actif, sinon transfère vers le 1er dispo. */
export async function ensureActiveDevice(): Promise<string | null> {
  const devices = await getDevices()
  const active = devices.find((d) => d.is_active)
  if (active) return active.id
  if (devices[0]) {
    await transferPlayback(devices[0].id, false)
    return devices[0].id
  }
  return null
}

export const spotifyPlay = () => api('/me/player/play', { method: 'PUT' })
export const spotifyPause = () => api('/me/player/pause', { method: 'PUT' })
export const spotifyNext = () => api('/me/player/next', { method: 'POST' })
export const spotifyPrev = () => api('/me/player/previous', { method: 'POST' })
