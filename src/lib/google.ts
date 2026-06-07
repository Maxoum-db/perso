// Client léger pour les APIs Google (Agenda + Drive).
//
// Le jeton d'accès Google nous est fourni par Supabase juste après le
// "Sign in with Google" (session.provider_token). Supabase ne le rafraîchit
// pas automatiquement et ne le rejoue pas sur un simple refresh de session :
// on le capture donc et on le met en cache localement. À expiration (~1h),
// l'UI propose de reconnecter Google.

import { supabase } from './supabase'

const TOKEN_KEY = 'hubperso.google.token'
const TOKEN_EXP_KEY = 'hubperso.google.token_exp'

// Marge de sécurité : on considère le jeton expiré 2 min avant l'heure réelle.
const SAFETY_MS = 2 * 60 * 1000
// Durée de vie par défaut d'un access token Google (~1h) si Google ne la précise pas.
const DEFAULT_TTL_MS = 60 * 60 * 1000

export function storeGoogleToken(token: string | null | undefined, expiresInSec?: number) {
  if (!token) return
  const ttl = expiresInSec && expiresInSec > 0 ? expiresInSec * 1000 : DEFAULT_TTL_MS
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(TOKEN_EXP_KEY, String(Date.now() + ttl))
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

// ---------- Renouvellement automatique (refresh token côté serveur) ----------

/** Sauvegarde le refresh_token Google de l'utilisateur (capté juste après le login). */
export async function saveGoogleRefreshToken(userId: string, refreshToken: string): Promise<void> {
  await supabase
    .from('perso_google_tokens')
    .upsert(
      { user_id: userId, refresh_token: refreshToken, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
}

let refreshInFlight: Promise<string | null> | null = null

/**
 * Demande un nouvel access token Google à la fonction Edge `google-refresh`
 * (qui utilise le refresh_token stocké côté serveur). Renvoie le token,
 * ou null s'il faut reconnecter Google (refresh token absent/révoqué).
 */
export async function refreshGoogleToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke('google-refresh')
      if (error || !data?.access_token) return null
      storeGoogleToken(data.access_token as string, data.expires_in as number | undefined)
      return data.access_token as string
    } catch {
      return null
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

/** Renvoie un access token valide (rafraîchit si nécessaire), sinon lève GoogleAuthError. */
async function getValidToken(): Promise<string> {
  const existing = getGoogleToken()
  if (existing) return existing
  const fresh = await refreshGoogleToken()
  if (fresh) return fresh
  throw new GoogleAuthError('Jeton Google absent ou expiré')
}

/** Erreur typée pour distinguer un problème d'auth Google d'une autre erreur. */
export class GoogleAuthError extends Error {}

async function googleFetch(path: string, params?: Record<string, string | number | boolean | undefined>) {
  const token = await getValidToken()

  const url = new URL(path.startsWith('http') ? path : `https://www.googleapis.com${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v))
    }
  }

  let res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })

  // 401 = access token expiré -> on tente un renouvellement silencieux puis on rejoue.
  if (res.status === 401) {
    const fresh = await refreshGoogleToken()
    if (fresh) {
      res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${fresh}` } })
    }
    if (res.status === 401) {
      clearGoogleToken()
      throw new GoogleAuthError('Session Google expirée')
    }
  }
  // 403 = autorisation/API manquante pour CETTE fonctionnalité. On NE touche PAS au
  // jeton (sinon on casse les autres modules et on boucle sur la reconnexion).
  if (res.status === 403) {
    const raw = await res.text().catch(() => '')
    const low = raw.toLowerCase()
    const apiDisabled =
      low.includes('accessnotconfigured') || low.includes('has not been used') || low.includes('it is disabled')
    const scopeMissing = low.includes('insufficient') || low.includes('scope')
    const why = apiDisabled
      ? "l'API n'est pas activée dans le bon projet Google Cloud."
      : scopeMissing
        ? 'autorisation manquante — reconnecte Google (Réglages) et accepte la permission.'
        : 'accès refusé.'
    let gmsg = ''
    try {
      gmsg = JSON.parse(raw)?.error?.message || ''
    } catch {
      /* pas de JSON */
    }
    throw new Error(`403 : ${why}${gmsg ? '\n\n' + gmsg.slice(0, 400) : ''}`)
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
  const token = await getValidToken()

  const url = path.startsWith('http') ? path : `https://www.googleapis.com${path}`
  const doFetch = (t: string) =>
    fetch(url, {
      method,
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })

  let res = await doFetch(token)

  if (res.status === 401) {
    const fresh = await refreshGoogleToken()
    if (fresh) res = await doFetch(fresh)
    if (res.status === 401) {
      clearGoogleToken()
      throw new GoogleAuthError('Session Google expirée')
    }
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

// ---------- Google Tasks ----------

export interface GTaskList {
  id: string
  title: string
}

export interface GTask {
  id: string
  title: string
  notes?: string
  status: 'needsAction' | 'completed'
  due?: string
}

export async function listTaskLists(): Promise<GTaskList[]> {
  const data = await googleFetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', { maxResults: 100 })
  return (data.items || []).map((l: any) => ({ id: l.id, title: l.title }))
}

export async function listTasks(listId: string, showCompleted = false): Promise<GTask[]> {
  const data = await googleFetch(`https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks`, {
    showCompleted,
    showHidden: showCompleted,
    maxResults: 100,
  })
  return (data.items || []).map((t: any) => ({
    id: t.id,
    title: t.title || '',
    notes: t.notes,
    status: t.status,
    due: t.due,
  }))
}

export interface DueTask extends GTask {
  listId: string
  listTitle: string
}

/** Tâches ouvertes échues (en retard ou aujourd'hui), toutes listes confondues. */
export async function listDueTasks(): Promise<DueTask[]> {
  const lists = await listTaskLists()
  const perList = await Promise.all(
    lists.map(async (l) => {
      const tasks = await listTasks(l.id)
      return tasks
        .filter((t) => t.status === 'needsAction' && t.due)
        .map((t) => ({ ...t, listId: l.id, listTitle: l.title }))
    }),
  )
  const todayStr = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD local
  return perList
    .flat()
    .filter((t) => (t.due as string).slice(0, 10) <= todayStr)
    .sort((a, b) => ((a.due as string) < (b.due as string) ? -1 : 1))
}

export function createTask(listId: string, title: string, due?: string) {
  const body: Record<string, unknown> = { title }
  if (due) body.due = due
  return googleWrite(`https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks`, 'POST', body)
}

export function setTaskStatus(listId: string, taskId: string, status: 'needsAction' | 'completed') {
  return googleWrite(
    `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
    'PATCH',
    { status, completed: status === 'completed' ? new Date().toISOString() : null },
  )
}

export function deleteTask(listId: string, taskId: string) {
  return googleWrite(
    `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
    'DELETE',
  )
}

// ---------- Gmail ----------

export interface GMessage {
  id: string
  from: string
  subject: string
  date?: string
  snippet: string
  unread: boolean
}

function headerVal(headers: any[], name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || ''
}

function parseFrom(raw: string): string {
  const m = raw.match(/^\s*"?([^"<]+?)"?\s*<.*>$/)
  return (m ? m[1] : raw).trim() || raw
}

export async function listRecentEmails(q = 'in:inbox', max = 15): Promise<GMessage[]> {
  const list = await googleFetch('https://gmail.googleapis.com/gmail/v1/users/me/messages', { q, maxResults: max })
  const ids: string[] = (list.messages || []).map((m: any) => m.id)
  const msgs = await Promise.all(
    ids.map((id) =>
      googleFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`, { format: 'metadata' }).catch(() => null),
    ),
  )
  const out: GMessage[] = []
  for (const m of msgs) {
    if (!m) continue
    const headers = m.payload?.headers || []
    out.push({
      id: m.id,
      from: parseFrom(headerVal(headers, 'From')),
      subject: headerVal(headers, 'Subject') || '(sans objet)',
      date: headerVal(headers, 'Date'),
      snippet: (m.snippet || '').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"'),
      unread: (m.labelIds || []).includes('UNREAD'),
    })
  }
  return out
}

// ---------- Contacts / anniversaires (People API) ----------

export interface Birthday {
  name: string
  month: number
  day: number
  inDays: number // jours avant le prochain anniversaire
}

export async function listUpcomingBirthdays(withinDays = 60): Promise<Birthday[]> {
  const data = await googleFetch('https://people.googleapis.com/v1/people/me/connections', {
    personFields: 'names,birthdays',
    pageSize: 1000,
    sortOrder: 'FIRST_NAME_ASCENDING',
  })
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const out: Birthday[] = []
  for (const p of data.connections || []) {
    const name = p.names?.[0]?.displayName
    const bd = p.birthdays?.find((b: any) => b.date)?.date
    if (!name || !bd || !bd.month || !bd.day) continue
    let next = new Date(today.getFullYear(), bd.month - 1, bd.day)
    if (next < today) next = new Date(today.getFullYear() + 1, bd.month - 1, bd.day)
    const inDays = Math.round((next.getTime() - today.getTime()) / 86400000)
    if (inDays <= withinDays) out.push({ name, month: bd.month, day: bd.day, inDays })
  }
  return out.sort((a, b) => a.inDays - b.inDays)
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
  const token = await getValidToken()

  let url: string
  if (file.mimeType === 'application/vnd.google-apps.document') {
    url = `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/plain`
  } else {
    url = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`
  }
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 401) {
    clearGoogleToken()
    throw new GoogleAuthError('Session Google expirée')
  }
  if (res.status === 403) {
    throw new Error("Accès refusé (403) : autorisation Google manquante pour ce fichier.")
  }
  if (!res.ok) throw new Error(`Erreur lecture fichier ${res.status}`)
  return res.text()
}

/** Crée ou met à jour un fichier texte dans Drive (scope drive.file). Renvoie son id. */
export async function uploadDriveTextFile(opts: {
  name: string
  content: string
  mimeType?: string
  folderId?: string
  fileId?: string
}): Promise<string> {
  const token = await getValidToken()
  const mime = opts.mimeType || 'text/markdown'

  const handle = async (res: Response) => {
    if (res.status === 401) {
      clearGoogleToken()
      throw new GoogleAuthError('Session Google expirée')
    }
    if (res.status === 403) {
      throw new Error('Autorisation Drive manquante — reconnecte Google (Réglages) pour activer la sauvegarde.')
    }
    if (res.status === 404) throw new GoogleNotFound('Fichier introuvable')
    if (!res.ok) throw new Error(`Erreur Drive ${res.status}`)
    return (await res.json()).id as string
  }

  if (opts.fileId) {
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${opts.fileId}?uploadType=media&fields=id`,
      { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': mime }, body: opts.content },
    )
    return handle(res)
  }

  const boundary = 'aide_' + Math.random().toString(36).slice(2)
  const metadata: Record<string, unknown> = { name: opts.name, mimeType: mime }
  if (opts.folderId) metadata.parents = [opts.folderId]
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: ${mime}\r\n\r\n${opts.content}\r\n--${boundary}--`
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
  return handle(res)
}

/** Erreur 404 (fichier supprimé côté Drive) — permet de recréer le backup. */
export class GoogleNotFound extends Error {}

/** Télécharge un fichier (avec auth) et renvoie une URL blob lisible (audio, etc.). */
export async function getFileBlobUrl(file: DriveFile): Promise<string> {
  const token = await getValidToken()
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) {
    clearGoogleToken()
    throw new GoogleAuthError('Session Google expirée')
  }
  if (res.status === 403) {
    throw new Error("Accès refusé (403) : autorisation Google manquante pour ce fichier.")
  }
  if (!res.ok) throw new Error(`Erreur média ${res.status}`)
  return URL.createObjectURL(await res.blob())
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
