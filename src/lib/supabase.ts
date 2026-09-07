import { createClient } from '@supabase/supabase-js'

// Prefer build-time Vite env vars, but support runtime injection by server via window.__SUPABASE_URL__/__SUPABASE_KEY__
const envUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const envKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

let runtimeUrl = ''
let runtimeKey = ''
if (typeof window !== 'undefined') {
  try {
    const a = (window as any).__SUPABASE_URL__
    const b = (window as any).__SUPABASE_KEY__
    runtimeUrl = a ? String(a).trim() : ''
    runtimeKey = b ? String(b).trim() : ''
  } catch (e) {
    runtimeUrl = ''
    runtimeKey = ''
  }
}

const url = envUrl || runtimeUrl || ''
const key = envKey || runtimeKey || ''

export const isSupabaseConfigured = Boolean(url && key)
export const supabase = isSupabaseConfigured
  ? createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null
