import { supabase } from './supabase'

// Préférences du Hub, stockées côté Supabase (table perso_settings, 1 ligne par
// utilisateur) pour être synchronisées entre le téléphone et le PC. Un cache
// localStorage est tenu à jour pour un affichage instantané au démarrage.

export interface PersoSettings {
  drive_synthese_folder_id: string | null
  drive_synthese_folder_name: string | null
  visible_calendar_ids: string[]
}

const DEFAULTS: PersoSettings = {
  drive_synthese_folder_id: null,
  drive_synthese_folder_name: null,
  visible_calendar_ids: [],
}

const CACHE_KEY = 'hubperso.settings'

export function readCachedSettings(): PersoSettings {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return { ...DEFAULTS }
}

function writeCache(s: PersoSettings) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(s))
}

export async function fetchSettings(userId: string): Promise<PersoSettings> {
  const { data, error } = await supabase
    .from('perso_settings')
    .select('drive_synthese_folder_id, drive_synthese_folder_name, visible_calendar_ids')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.warn('Lecture settings échouée, on garde le cache local :', error.message)
    return readCachedSettings()
  }
  const merged: PersoSettings = { ...DEFAULTS, ...(data ?? {}) }
  writeCache(merged)
  return merged
}

export async function saveSettings(
  userId: string,
  patch: Partial<PersoSettings>,
): Promise<PersoSettings> {
  const current = readCachedSettings()
  const next = { ...current, ...patch }
  writeCache(next)

  const { error } = await supabase.from('perso_settings').upsert(
    {
      user_id: userId,
      ...next,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) console.warn('Sauvegarde settings échouée :', error.message)
  return next
}
