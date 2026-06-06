import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  // Message explicite en dev pour éviter les écrans blancs silencieux.
  console.error(
    'Config Supabase manquante : définis VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY (voir .env.example).',
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
