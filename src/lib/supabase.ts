import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * The client needs the bare project origin. The dashboard also shows the REST
 * endpoint (`https://<ref>.supabase.co/rest/v1/`); pasting that would make every
 * auth call 404 (`/rest/v1/auth/v1/otp`), so keep only the origin.
 */
function projectOrigin(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined
  try {
    const parsed = new URL(raw.trim())
    if (parsed.pathname !== '/') {
      console.warn(`VITE_SUPABASE_URL should be just the project URL; ignoring path "${parsed.pathname}"`)
    }
    return parsed.origin
  } catch {
    console.error(`VITE_SUPABASE_URL is not a valid URL: "${raw}"`)
    return undefined
  }
}

const url = projectOrigin(import.meta.env.VITE_SUPABASE_URL)
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

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
