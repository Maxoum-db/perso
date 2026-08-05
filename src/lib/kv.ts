import { supabase } from './supabase'
import { ecrireCache, lireCache } from './cache'

// Stockage clé/valeur par utilisateur (table perso_kv du projet dédié).
// Utilisé par les modules perso (ex: suivi de l'armure béhourd) pour une
// synchronisation téléphone ↔ PC. Un cache localStorage permet un affichage
// instantané avant le retour réseau.

// Le cache est rattaché au COMPTE (voir cache.ts). Il ne l'était pas : sur un
// appareil utilisé par deux personnes, ou après une déconnexion, le suivant
// lisait les courbatures, les intensités et le sommeil du précédent.
export function readKvCache<T>(key: string, fallback: T): T {
  return lireCache(`kv.${key}`, fallback)
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
  ecrireCache(`kv.${key}`, data.value)
  return data.value as T
}

export async function saveKv<T>(userId: string, key: string, value: T): Promise<void> {
  ecrireCache(`kv.${key}`, value)
  const { error } = await supabase.from('perso_kv').upsert(
    { user_id: userId, key, value, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,key' },
  )
  if (error) console.warn(`Sauvegarde perso_kv[${key}] échouée :`, error.message)
}
