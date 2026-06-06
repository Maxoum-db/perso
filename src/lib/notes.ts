import { supabase } from './supabase'

export interface Note {
  id: string
  user_id: string
  title: string
  body: string
  category: string
  pinned: boolean
  created_at: string
  updated_at: string
}

export interface NoteInput {
  title: string
  body: string
  category: string
  pinned: boolean
}

// Catégories de notes (la note psy est volontairement mise en avant).
export const NOTE_CATEGORIES: { id: string; label: string; emoji: string; color: string }[] = [
  { id: 'perso', label: 'Perso', emoji: '🏠', color: '#a78bfa' },
  { id: 'psy', label: 'Psy', emoji: '🧠', color: '#60a5fa' },
  { id: 'idee', label: 'Idée', emoji: '💡', color: '#fbbf24' },
  { id: 'todo', label: 'À faire', emoji: '✅', color: '#34d399' },
  { id: 'autre', label: 'Autre', emoji: '📌', color: '#9ca3af' },
]

export function categoryMeta(id: string) {
  return NOTE_CATEGORIES.find((c) => c.id === id) ?? NOTE_CATEGORIES[NOTE_CATEGORIES.length - 1]
}

export async function listNotes(userId: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from('perso_notes')
    .select('*')
    .eq('user_id', userId)
    .order('pinned', { ascending: false })
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Note[]
}

export async function createNote(userId: string, input: NoteInput): Promise<Note> {
  const { data, error } = await supabase
    .from('perso_notes')
    .insert({ user_id: userId, ...input })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as Note
}

export async function updateNote(id: string, patch: Partial<NoteInput>): Promise<void> {
  const { error } = await supabase
    .from('perso_notes')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase.from('perso_notes').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
