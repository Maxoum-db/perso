import { supabase } from './supabase'

export interface Habit {
  id: string
  name: string
  emoji: string
  weekly_target: number
}

export interface HabitWithState extends Habit {
  doneToday: boolean
  streak: number
  last7: number
}

const iso = (d: Date) => d.toISOString().slice(0, 10)

export async function listHabitsWithState(userId: string): Promise<HabitWithState[]> {
  const { data: habits, error } = await supabase
    .from('perso_habits')
    .select('id,name,emoji,weekly_target')
    .eq('user_id', userId)
    .eq('archived', false)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)

  const since = new Date()
  since.setDate(since.getDate() - 60)
  const { data: logs } = await supabase
    .from('perso_habit_logs')
    .select('habit_id,date')
    .eq('user_id', userId)
    .gte('date', iso(since))

  const byHabit = new Map<string, Set<string>>()
  for (const l of logs ?? []) {
    if (!byHabit.has(l.habit_id)) byHabit.set(l.habit_id, new Set())
    byHabit.get(l.habit_id)!.add(l.date)
  }

  const today = iso(new Date())
  return (habits ?? []).map((h) => {
    const set = byHabit.get(h.id) ?? new Set<string>()
    // streak : jours consécutifs jusqu'à aujourd'hui (ou hier si pas encore fait aujourd'hui)
    let streak = 0
    const d = new Date()
    if (!set.has(today)) d.setDate(d.getDate() - 1)
    while (set.has(iso(d))) {
      streak++
      d.setDate(d.getDate() - 1)
    }
    let last7 = 0
    for (let i = 0; i < 7; i++) {
      const dd = new Date()
      dd.setDate(dd.getDate() - i)
      if (set.has(iso(dd))) last7++
    }
    return { ...h, doneToday: set.has(today), streak, last7 }
  })
}

export async function addHabit(userId: string, name: string, emoji: string): Promise<void> {
  const { error } = await supabase.from('perso_habits').insert({ user_id: userId, name, emoji })
  if (error) throw new Error(error.message)
}

export async function deleteHabit(id: string): Promise<void> {
  const { error } = await supabase.from('perso_habits').update({ archived: true }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function toggleHabitToday(userId: string, habitId: string, done: boolean): Promise<void> {
  const date = iso(new Date())
  if (done) {
    const { error } = await supabase.from('perso_habit_logs').insert({ user_id: userId, habit_id: habitId, date })
    if (error && !error.message.includes('duplicate')) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('perso_habit_logs').delete().eq('habit_id', habitId).eq('date', date)
    if (error) throw new Error(error.message)
  }
}
