import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

type LocalRole = 'super_admin' | 'instructor' | 'student'
type Profile = { id: string; full_name: string; role: LocalRole | 'employee'; active: boolean }
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
const localSessionKey = 'iman-school-local-admin-session'
const inactivityLimit = 30 * 60 * 1000
const localAccounts = import.meta.env.DEV ? [
  { email: import.meta.env.VITE_LOCAL_ADMIN_EMAIL?.trim().toLowerCase(), password: import.meta.env.VITE_LOCAL_ADMIN_PASSWORD, role: 'super_admin' as const, name: 'Super Admin' },
  { email: import.meta.env.VITE_LOCAL_INSTRUCTOR_EMAIL?.trim().toLowerCase(), password: import.meta.env.VITE_LOCAL_INSTRUCTOR_PASSWORD, role: 'instructor' as const, name: 'CDL Instructor' },
  { email: import.meta.env.VITE_LOCAL_STUDENT_EMAIL?.trim().toLowerCase(), password: import.meta.env.VITE_LOCAL_STUDENT_PASSWORD, role: 'student' as const, name: 'CDL Student' },
].filter(account => account.email && account.password) : []

export function getLocalAccountRole(email: string, password: string): LocalRole | null {
  return localAccounts.find(account => account.email === email.trim().toLowerCase() && account.password === password)?.role ?? null
}

export function getLocalSessionRole(): LocalRole | null {
  if (!import.meta.env.DEV) return null
  const role = window.sessionStorage.getItem(localSessionKey)
  return role === 'super_admin' || role === 'instructor' || role === 'student' ? role : null
}

function makeLocalAuth(role: LocalRole) {
  const account = localAccounts.find(item => item.role === role)!
  return {
    session: { user: { id: `local-${role}`, email: account.email } } as Session,
    profile: { id: `local-${role}`, full_name: account.name, role, active: true } as Profile,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initialLocalRole = getLocalSessionRole()
  const initialLocalAuth = initialLocalRole ? makeLocalAuth(initialLocalRole) : null
  const [session, setSession] = useState<Session | null>(initialLocalAuth?.session ?? null)
  const [profile, setProfile] = useState<Profile | null>(initialLocalAuth?.profile ?? null)
  const [loading, setLoading] = useState(true)

  const loadProfile = async (userId?: string) => {
    if (!supabase || !userId) return setProfile(null)
    const { data } = await supabase.from('profiles').select('id, full_name, role, active').eq('id', userId).maybeSingle()
    setProfile((data as Profile | null) ?? null)
  }

  useEffect(() => {
    if (initialLocalRole) return setLoading(false)
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
  }, [initialLocalRole])

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
    configured: isSupabaseConfigured || localAccounts.length > 0,
    loading,
    session,
    profile,
    signIn: async (email, password) => {
      const localRole = getLocalAccountRole(email, password)
      if (localRole) {
        const localAuth = makeLocalAuth(localRole)
        window.sessionStorage.setItem(localSessionKey, localRole)
        setSession(localAuth.session)
        setProfile(localAuth.profile)
        return null
      }
      if (!supabase) return 'Authentication has not been configured for this deployment.'
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return error?.message ?? null
    },
    signOut: async () => {
      window.sessionStorage.removeItem(localSessionKey)
      setSession(null)
      setProfile(null)
      if (supabase) await supabase.auth.signOut()
    },
  }), [loading, session, profile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
