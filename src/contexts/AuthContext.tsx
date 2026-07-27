import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

type Profile = { id: string; full_name: string; role: 'super_admin' | 'employee'; active: boolean }
type AuthValue = {
  configured: boolean
  loading: boolean
  session: Session | null
  profile: Profile | null
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)
const activityKey = 'iman-school-admin-last-activity'
const inactivityLimit = 30 * 60 * 1000

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = async (userId?: string) => {
    if (!supabase || !userId) return setProfile(null)
    const { data } = await supabase.from('profiles').select('id, full_name, role, active').eq('id', userId).maybeSingle()
    setProfile((data as Profile | null) ?? null)
  }

  useEffect(() => {
    if (!supabase) return setLoading(false)
    void supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      await loadProfile(data.session?.user.id)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      void loadProfile(next?.user.id)
      setLoading(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return window.localStorage.removeItem(activityKey)
    const record = () => window.localStorage.setItem(activityKey, String(Date.now()))
    const check = () => {
      const last = Number(window.localStorage.getItem(activityKey) || Date.now())
      if (Date.now() - last >= inactivityLimit) void supabase?.auth.signOut()
    }
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'scroll', 'touchstart']
    record()
    events.forEach(event => window.addEventListener(event, record, { passive: true }))
    const timer = window.setInterval(check, 30_000)
    return () => {
      events.forEach(event => window.removeEventListener(event, record))
      window.clearInterval(timer)
    }
  }, [session])

  const value = useMemo<AuthValue>(() => ({
    configured: isSupabaseConfigured,
    loading,
    session,
    profile,
    signIn: async (email, password) => {
      if (!supabase) return 'Authentication has not been configured for this deployment.'
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return error?.message ?? null
    },
    signOut: async () => { if (supabase) await supabase.auth.signOut() },
  }), [loading, session, profile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
