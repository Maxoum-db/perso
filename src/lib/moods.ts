import { supabase } from './supabase'

export interface Mood {
  date: string
  mood: number
  tags: string[]
  note: string
}

export const MOOD_SCALE = [
  { value: 1, emoji: '😣', label: 'Très mal', color: '#ef4444' },
  { value: 2, emoji: '🙁', label: 'Mal', color: '#f97316' },
  { value: 3, emoji: '😐', label: 'Moyen', color: '#eab308' },
  { value: 4, emoji: '🙂', label: 'Bien', color: '#84cc16' },
  { value: 5, emoji: '😄', label: 'Top', color: '#22c55e' },
]

export const MOOD_TAGS = [
  'Sport',
  'Béhourd',
  'Boulot',
  'Famille',
  'Amis',
  'Repos',
  'Bien dormi',
  'Mal dormi',
  'Stress',
  'Nature',
  'Alcool',
  'Malade',
]

export function moodMeta(v: number) {
  return MOOD_SCALE.find((m) => m.value === v) ?? MOOD_SCALE[2]
}

export async function listMoods(userId: string, days = 120): Promise<Mood[]> {
  const since = new Date()
  since.setDate(since.getDate() - days)
  const { data, error } = await supabase
    .from('perso_moods')
    .select('date,mood,tags,note')
    .eq('user_id', userId)
    .gte('date', since.toISOString().slice(0, 10))
    .order('date', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Mood[]
}

export async function upsertMood(userId: string, m: Mood): Promise<void> {
  const { error } = await supabase
    .from('perso_moods')
    .upsert({ user_id: userId, ...m, updated_at: new Date().toISOString() }, { onConflict: 'user_id,date' })
  if (error) throw new Error(error.message)
}
