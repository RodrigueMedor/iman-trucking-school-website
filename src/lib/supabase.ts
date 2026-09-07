import { createClient } from '@supabase/supabase-js'

// Support both VITE_ variables (build-time) and regular env vars (runtime for Node.js deployment)
const url = import.meta.env.VITE_SUPABASE_URL?.trim() || import.meta.env.SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || import.meta.env.SUPABASE_PUBLISHABLE_KEY?.trim()

export const isSupabaseConfigured = Boolean(url && key)
export const supabase = isSupabaseConfigured
  ? createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null
