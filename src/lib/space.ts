import { supabase } from './supabase'

// ── Espace partagé (couple) : listes, petits mots et agenda communs ─────────

export interface SpaceMember {
  user_id: string
  role: string
  display_name: string | null
  email: string | null
}

export interface MySpace {
  spaceId: string
  members: SpaceMember[]
  googleCalendarId: string | null
  googleCalendarName: string | null
}

export interface SharedList {
  id: string
  title: string
  emoji: string
  position: number
}
export interface SharedListWithCount extends SharedList {
  total: number
  done: number
}
export interface SharedListItem {
  id: string
  list_id: string
  content: string
  done: boolean
  position: number
}

export interface SharedNote {
  id: string
  body: string
  author_id: string | null
  author_name: string | null
  created_at: string
  updated_at: string
}

export interface SharedEvent {
  id: string
  title: string
  date: string
  time: string | null
  note: string | null
  author_name: string | null
  google_event_id: string | null
}

// ── Espace : appartenance & invitations ─────────────────────────────────────

/** Renvoie l'espace de l'utilisateur (et ses membres) ou null s'il n'en a pas. */
export async function getMySpace(): Promise<MySpace | null> {
  const { data: mine, error } = await supabase
    .from('perso_space_members')
    .select('space_id')
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!mine) return null

  const { data: members } = await supabase
    .from('perso_space_members')
    .select('user_id,role,display_name,email')
    .eq('space_id', mine.space_id)
    .order('joined_at', { ascending: true })

  const { data: space } = await supabase
    .from('perso_spaces')
    .select('google_calendar_id,google_calendar_name')
    .eq('id', mine.space_id)
    .maybeSingle()

  return {
    spaceId: mine.space_id,
    members: (members ?? []) as SpaceMember[],
    googleCalendarId: space?.google_calendar_id ?? null,
    googleCalendarName: space?.google_calendar_name ?? null,
  }
}

/** Lie (ou délie si id vide) un agenda Google partagé à l'espace. */
export async function setSpaceCalendar(calendarId: string, calendarName: string): Promise<void> {
  const { error } = await supabase.rpc('set_space_calendar', {
    p_calendar_id: calendarId,
    p_calendar_name: calendarName,
  })
  if (error) throw new Error(error.message)
}

export async function createSpace(displayName: string, email: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_space', {
    p_display_name: displayName,
    p_email: email,
  })
  if (error) throw new Error(error.message)
  return data as string
}

export async function createInvite(): Promise<string> {
  const { data, error } = await supabase.rpc('create_space_invite')
  if (error) throw new Error(error.message)
  return data as string
}

export async function joinSpace(code: string, displayName: string, email: string): Promise<void> {
  const { error } = await supabase.rpc('join_space', {
    p_code: code.trim(),
    p_display_name: displayName,
    p_email: email,
  })
  if (error) {
    if (error.message.includes('invite_invalid')) throw new Error('Code invalide ou expiré.')
    throw new Error(error.message)
  }
}

// ── Listes partagées ────────────────────────────────────────────────────────

export async function listSharedLists(spaceId: string): Promise<SharedListWithCount[]> {
  const { data: lists, error } = await supabase
    .from('shared_lists')
    .select('id,title,emoji,position')
    .eq('space_id', spaceId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)

  const { data: items } = await supabase
    .from('shared_list_items')
    .select('list_id,done')
    .eq('space_id', spaceId)

  const counts = new Map<string, { total: number; done: number }>()
  for (const it of items ?? []) {
    const c = counts.get(it.list_id) ?? { total: 0, done: 0 }
    c.total++
    if (it.done) c.done++
    counts.set(it.list_id, c)
  }
  return (lists ?? []).map((l) => ({
    ...l,
    total: counts.get(l.id)?.total ?? 0,
    done: counts.get(l.id)?.done ?? 0,
  }))
}

export async function createSharedList(spaceId: string, title: string, emoji = '📝'): Promise<SharedList> {
  const { data, error } = await supabase
    .from('shared_lists')
    .insert({ space_id: spaceId, title: title.trim() || 'Liste', emoji })
    .select('id,title,emoji,position')
    .single()
  if (error) throw new Error(error.message)
  return data as SharedList
}

export async function updateSharedList(id: string, patch: Partial<Pick<SharedList, 'title' | 'emoji'>>): Promise<void> {
  const { error } = await supabase.from('shared_lists').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteSharedList(id: string): Promise<void> {
  const { error } = await supabase.from('shared_lists').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function listSharedItems(listId: string): Promise<SharedListItem[]> {
  const { data, error } = await supabase
    .from('shared_list_items')
    .select('id,list_id,content,done,position')
    .eq('list_id', listId)
    .order('done', { ascending: true })
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as SharedListItem[]
}

export async function addSharedItem(spaceId: string, listId: string, content: string): Promise<SharedListItem> {
  const { data, error } = await supabase
    .from('shared_list_items')
    .insert({ space_id: spaceId, list_id: listId, content: content.trim() })
    .select('id,list_id,content,done,position')
    .single()
  if (error) throw new Error(error.message)
  return data as SharedListItem
}

export async function toggleSharedItem(id: string, done: boolean): Promise<void> {
  const { error } = await supabase.from('shared_list_items').update({ done }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteSharedItem(id: string): Promise<void> {
  const { error } = await supabase.from('shared_list_items').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function clearDoneShared(listId: string): Promise<void> {
  const { error } = await supabase.from('shared_list_items').delete().eq('list_id', listId).eq('done', true)
  if (error) throw new Error(error.message)
}

// ── Petits mots (notes partagées) ───────────────────────────────────────────

export async function listSharedNotes(spaceId: string): Promise<SharedNote[]> {
  const { data, error } = await supabase
    .from('shared_notes')
    .select('id,body,author_id,author_name,created_at,updated_at')
    .eq('space_id', spaceId)
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as SharedNote[]
}

export async function createSharedNote(
  spaceId: string,
  body: string,
  author: { id: string; name: string },
): Promise<void> {
  const { error } = await supabase
    .from('shared_notes')
    .insert({ space_id: spaceId, body: body.trim(), author_id: author.id, author_name: author.name })
  if (error) throw new Error(error.message)
}

export async function updateSharedNote(id: string, body: string): Promise<void> {
  const { error } = await supabase
    .from('shared_notes')
    .update({ body: body.trim(), updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteSharedNote(id: string): Promise<void> {
  const { error } = await supabase.from('shared_notes').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Agenda commun ─────────────────────────────────────────────────────────

export async function listSharedEvents(spaceId: string): Promise<SharedEvent[]> {
  const { data, error } = await supabase
    .from('shared_events')
    .select('id,title,date,time,note,author_name,google_event_id')
    .eq('space_id', spaceId)
    .order('date', { ascending: true })
    .order('time', { ascending: true, nullsFirst: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as SharedEvent[]
}

export async function createSharedEvent(
  spaceId: string,
  ev: { title: string; date: string; time?: string | null; note?: string | null },
  author: { id: string; name: string },
): Promise<string> {
  const { data, error } = await supabase
    .from('shared_events')
    .insert({
      space_id: spaceId,
      title: ev.title.trim(),
      date: ev.date,
      time: ev.time?.trim() || null,
      note: ev.note?.trim() || null,
      author_id: author.id,
      author_name: author.name,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return (data as { id: string }).id
}

/** Mémorise l'id de l'événement Google miroir. */
export async function setSharedEventGoogleId(id: string, googleEventId: string): Promise<void> {
  await supabase.from('shared_events').update({ google_event_id: googleEventId }).eq('id', id)
}

export async function deleteSharedEvent(id: string): Promise<void> {
  const { error } = await supabase.from('shared_events').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
