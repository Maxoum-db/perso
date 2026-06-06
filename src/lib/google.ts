// Client léger pour les APIs Google (Agenda + Drive).
//
// Le jeton d'accès Google nous est fourni par Supabase juste après le
// "Sign in with Google" (session.provider_token). Supabase ne le rafraîchit
// pas automatiquement et ne le rejoue pas sur un simple refresh de session :
// on le capture donc et on le met en cache localement. À expiration (~1h),
// l'UI propose de reconnecter Google.

const TOKEN_KEY = 'hubperso.google.token'
const TOKEN_EXP_KEY = 'hubperso.google.token_exp'

// Marge de sécurité : on considère le jeton expiré 5 min avant l'heure réelle.
const SAFETY_MS = 5 * 60 * 1000
// Durée de vie par défaut d'un access token Google (~1h).
const DEFAULT_TTL_MS = 60 * 60 * 1000

export function storeGoogleToken(token: string | null | undefined) {
  if (!token) return
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(TOKEN_EXP_KEY, String(Date.now() + DEFAULT_TTL_MS))
}

export function clearGoogleToken() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(TOKEN_EXP_KEY)
}

export function getGoogleToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY)
  const exp = Number(localStorage.getItem(TOKEN_EXP_KEY) || 0)
  if (!token) return null
  if (Date.now() > exp - SAFETY_MS) return null
  return token
}

export function hasFreshGoogleToken(): boolean {
  return getGoogleToken() !== null
}

/** Erreur typée pour distinguer un problème d'auth Google d'une autre erreur. */
export class GoogleAuthError extends Error {}

async function googleFetch(path: string, params?: Record<string, string | number | boolean | undefined>) {
  const token = getGoogleToken()
  if (!token) throw new GoogleAuthError('Jeton Google absent ou expiré')

  const url = new URL(path.startsWith('http') ? path : `https://www.googleapis.com${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v))
    }
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (res.status === 401 || res.status === 403) {
    clearGoogleToken()
    throw new GoogleAuthError(`Accès Google refusé (${res.status})`)
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Erreur Google ${res.status}: ${body.slice(0, 300)}`)
  }
  return res.json()
}

// ---------- Agenda ----------

export interface GCalendar {
  id: string
  summary: string
  primary?: boolean
  backgroundColor?: string
  accessRole?: string
}

/** Vrai si l'utilisateur peut créer/modifier des événements dans cet agenda. */
export function canWriteCalendar(c: GCalendar): boolean {
  return c.accessRole === 'owner' || c.accessRole === 'writer'
}

export interface EventInput {
  summary: string
  location?: string
  description?: string
  start: { dateTime?: string; date?: string; timeZone?: string }
  end: { dateTime?: string; date?: string; timeZone?: string }
}

export interface GEvent {
  id: string
  calendarId: string
  calendarSummary: string
  calendarColor?: string
  summary?: string
  location?: string
  description?: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  htmlLink?: string
}

export async function listCalendars(): Promise<GCalendar[]> {
  const data = await googleFetch('/calendar/v3/users/me/calendarList', {
    minAccessRole: 'reader',
    maxResults: 250,
  })
  return (data.items || []).map((c: any) => ({
    id: c.id,
    summary: c.summaryOverride || c.summary,
    primary: c.primary,
    backgroundColor: c.backgroundColor,
    accessRole: c.accessRole,
  }))
}

// ---------- Écriture d'événements ----------

async function googleWrite(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) {
  const token = getGoogleToken()
  if (!token) throw new GoogleAuthError('Jeton Google absent ou expiré')

  const res = await fetch(`https://www.googleapis.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    clearGoogleToken()
    throw new GoogleAuthError('Session Google expirée')
  }
  if (res.status === 403) {
    throw new Error("Tu n'as pas le droit d'écrire dans cet agenda (lecture seule).")
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Erreur Google ${res.status}: ${txt.slice(0, 200)}`)
  }
  return res.status === 204 ? null : res.json()
}

export function createEvent(calendarId: string, input: EventInput) {
  return googleWrite(`/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, 'POST', input)
}

export function updateEvent(calendarId: string, eventId: string, input: EventInput) {
  return googleWrite(
    `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    'PATCH',
    input,
  )
}

export function deleteEvent(calendarId: string, eventId: string) {
  return googleWrite(
    `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    'DELETE',
  )
}

export async function listEvents(
  calendar: GCalendar,
  timeMin: Date,
  timeMax: Date,
): Promise<GEvent[]> {
  const data = await googleFetch(
    `/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events`,
    {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 2500,
    },
  )
  return (data.items || []).map((e: any) => ({
    id: e.id,
    calendarId: calendar.id,
    calendarSummary: calendar.summary,
    calendarColor: calendar.backgroundColor,
    summary: e.summary,
    location: e.location,
    description: e.description,
    start: e.start,
    end: e.end,
    htmlLink: e.htmlLink,
  }))
}

export async function listEventsMulti(
  calendars: GCalendar[],
  timeMin: Date,
  timeMax: Date,
): Promise<GEvent[]> {
  const results = await Promise.allSettled(
    calendars.map((c) => listEvents(c, timeMin, timeMax)),
  )
  const events: GEvent[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') events.push(...r.value)
  }
  events.sort((a, b) => eventStartMs(a) - eventStartMs(b))
  return events
}

export function eventStartMs(e: GEvent): number {
  const s = e.start.dateTime || e.start.date
  return s ? new Date(s).getTime() : 0
}

export function isAllDay(e: GEvent): boolean {
  return !e.start.dateTime && !!e.start.date
}

// ---------- Drive ----------

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime?: string
  webViewLink?: string
  iconLink?: string
  size?: string
}

export const FOLDER_MIME = 'application/vnd.google-apps.folder'

export async function searchFolders(query: string): Promise<DriveFile[]> {
  const q = [
    `mimeType = '${FOLDER_MIME}'`,
    'trashed = false',
    query ? `name contains '${query.replace(/'/g, "\\'")}'` : '',
  ]
    .filter(Boolean)
    .join(' and ')
  const data = await googleFetch('/drive/v3/files', {
    q,
    fields: 'files(id,name,modifiedTime,webViewLink)',
    pageSize: 50,
    orderBy: 'modifiedTime desc',
    spaces: 'drive',
  })
  return (data.files || []).map(mapFile)
}

export async function listFilesInFolder(folderId: string): Promise<DriveFile[]> {
  const data = await googleFetch('/drive/v3/files', {
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id,name,mimeType,modifiedTime,webViewLink,iconLink,size)',
    pageSize: 200,
    orderBy: 'modifiedTime desc',
    spaces: 'drive',
  })
  return (data.files || []).map(mapFile)
}

/** Récupère le texte d'un fichier (Google Doc exporté en texte brut, ou fichier texte). */
export async function getFileText(file: DriveFile): Promise<string> {
  const token = getGoogleToken()
  if (!token) throw new GoogleAuthError('Jeton Google absent ou expiré')

  let url: string
  if (file.mimeType === 'application/vnd.google-apps.document') {
    url = `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/plain`
  } else {
    url = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`
  }
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 401 || res.status === 403) {
    clearGoogleToken()
    throw new GoogleAuthError(`Accès Google refusé (${res.status})`)
  }
  if (!res.ok) throw new Error(`Erreur lecture fichier ${res.status}`)
  return res.text()
}

function mapFile(f: any): DriveFile {
  return {
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    modifiedTime: f.modifiedTime,
    webViewLink: f.webViewLink,
    iconLink: f.iconLink,
    size: f.size,
  }
}
