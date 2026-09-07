import { createClient } from '@supabase/supabase-js'

// Support both build-time VITE_ variables and runtime injected variables
const url = import.meta.env.VITE_SUPABASE_URL?.trim() || (typeof window !== 'undefined' && (window as any).__SUPABASE_URL__)?.trim()
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || (typeof window !== 'undefined' && (window as any).__SUPABASE_KEY__)?.trim()

export const isSupabaseConfigured = Boolean(url && key)
export const supabase = isSupabaseConfigured
  ? createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null
