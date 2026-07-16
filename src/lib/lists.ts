import { supabase } from './supabase'

export interface ListItem {
  id: string
  list_id: string
  content: string
  done: boolean
  position: number
  url: string | null
}

export interface Liste {
  id: string
  title: string
  emoji: string
  position: number
}

export interface ListeWithCount extends Liste {
  total: number
  done: number
}

// Quelques emojis pratiques pour personnaliser une liste.
export const LIST_EMOJIS = ['📝', '🛒', '✅', '🎒', '🎁', '🍽️', '🍺', '🍻', '🏖️', '🏠', '💡', '💕']

// La RLS renvoie les listes des deux membres de l'espace (partagées à deux) :
// pas de filtre user_id en lecture. Les insertions restent signées par l'auteur.
export async function listListes(): Promise<ListeWithCount[]> {
  const { data: lists, error } = await supabase
    .from('perso_lists')
    .select('id,title,emoji,position')
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)

  const { data: items } = await supabase
    .from('perso_list_items')
    .select('list_id,done')

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

export async function createListe(userId: string, title: string, emoji = '📝'): Promise<Liste> {
  const { data, error } = await supabase
    .from('perso_lists')
    .insert({ user_id: userId, title: title.trim() || 'Liste', emoji })
    .select('id,title,emoji,position')
    .single()
  if (error) throw new Error(error.message)
  return data as Liste
}

export async function updateListe(id: string, patch: Partial<Pick<Liste, 'title' | 'emoji'>>): Promise<void> {
  const { error } = await supabase
    .from('perso_lists')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteListe(id: string): Promise<void> {
  // Les items partent en cascade (FK on delete cascade).
  const { error } = await supabase.from('perso_lists').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function listItems(listId: string): Promise<ListItem[]> {
  const { data, error } = await supabase
    .from('perso_list_items')
    .select('id,list_id,content,done,position,url')
    .eq('list_id', listId)
    .order('done', { ascending: true })
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as ListItem[]
}

export async function addItem(userId: string, listId: string, content: string): Promise<ListItem> {
  const { data, error } = await supabase
    .from('perso_list_items')
    .insert({ user_id: userId, list_id: listId, content: content.trim() })
    .select('id,list_id,content,done,position,url')
    .single()
  if (error) throw new Error(error.message)
  return data as ListItem
}

export async function updateItem(
  id: string,
  patch: { content?: string; url?: string | null },
): Promise<void> {
  const { error } = await supabase.from('perso_list_items').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function toggleItem(id: string, done: boolean): Promise<void> {
  const { error } = await supabase.from('perso_list_items').update({ done }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from('perso_list_items').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** Supprime tous les items cochés d'une liste. */
export async function clearDone(listId: string): Promise<void> {
  const { error } = await supabase
    .from('perso_list_items')
    .delete()
    .eq('list_id', listId)
    .eq('done', true)
  if (error) throw new Error(error.message)
}
