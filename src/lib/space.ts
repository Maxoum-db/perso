import { supabase } from './supabase'

// ── Espace partagé (couple) : petits mots et agenda communs ────────────────
// (Les listes du couple vivent dans perso_lists, partagées via la RLS
//  same_space_as — voir lists.ts et la page Listes.)

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
