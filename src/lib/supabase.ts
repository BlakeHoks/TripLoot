import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — copy .env.example to .env.local')
}

// Only the public anon key is ever used in the browser; access is enforced by RLS.
export const supabase = createClient<Database>(url ?? 'http://localhost', anonKey ?? 'missing-anon-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Picks up the session from the magic-link redirect (/auth/callback).
    detectSessionInUrl: true,
  },
})
