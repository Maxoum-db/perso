import { supabase } from './supabase'

// Stockage clé/valeur par utilisateur (table perso_kv du projet dédié).
// Utilisé par les modules perso (ex: suivi de l'armure béhourd) pour une
// synchronisation téléphone ↔ PC. Un cache localStorage permet un affichage
// instantané avant le retour réseau.

function cacheKey(key: string) {
  return `hubperso.kv.${key}`
}

export function readKvCache<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(cacheKey(key))
    if (raw) return JSON.parse(raw) as T
  } catch {
    /* ignore */
  }
  return fallback
}

export async function fetchKv<T>(userId: string, key: string, fallback: T): Promise<T> {
  const { data, error } = await supabase
    .from('perso_kv')
    .select('value')
    .eq('user_id', userId)
    .eq('key', key)
    .maybeSingle()

  if (error) {
    console.warn(`Lecture perso_kv[${key}] échouée :`, error.message)
    return readKvCache(key, fallback)
  }
  if (!data) return fallback
  try {
    localStorage.setItem(cacheKey(key), JSON.stringify(data.value))
  } catch {
    /* ignore */
  }
  return data.value as T
}

export async function saveKv<T>(userId: string, key: string, value: T): Promise<void> {
  try {
    localStorage.setItem(cacheKey(key), JSON.stringify(value))
  } catch {
    /* ignore */
  }
  const { error } = await supabase.from('perso_kv').upsert(
    { user_id: userId, key, value, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,key' },
  )
  if (error) console.warn(`Sauvegarde perso_kv[${key}] échouée :`, error.message)
}
