import { supabase } from './supabase'

export interface Workout {
  id: string
  date: string
  kind: string
  duration_min: number | null
  notes: string
}

export interface Weighin {
  id: string
  date: string
  weight_kg: number
}

export const WORKOUT_KINDS = ['Push', 'Pull', 'Legs', 'Core', 'Béhourd', 'Mobilité', 'Cardio', 'Autre']

export async function listWorkouts(userId: string): Promise<Workout[]> {
  const { data, error } = await supabase
    .from('perso_workouts')
    .select('id,date,kind,duration_min,notes')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(60)
  if (error) throw new Error(error.message)
  return (data ?? []) as Workout[]
}

export async function addWorkout(
  userId: string,
  w: { date: string; kind: string; duration_min: number | null; notes: string },
): Promise<void> {
  const { error } = await supabase.from('perso_workouts').insert({ user_id: userId, ...w })
  if (error) throw new Error(error.message)
}

export async function deleteWorkout(id: string): Promise<void> {
  const { error } = await supabase.from('perso_workouts').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function listWeighins(userId: string): Promise<Weighin[]> {
  const { data, error } = await supabase
    .from('perso_weighins')
    .select('id,date,weight_kg')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(60)
  if (error) throw new Error(error.message)
  return (data ?? []).map((w) => ({ ...w, weight_kg: Number(w.weight_kg) })) as Weighin[]
}

export async function addWeighin(userId: string, w: { date: string; weight_kg: number }): Promise<void> {
  const { error } = await supabase.from('perso_weighins').insert({ user_id: userId, ...w })
  if (error) throw new Error(error.message)
}

export async function deleteWeighin(id: string): Promise<void> {
  const { error } = await supabase.from('perso_weighins').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
