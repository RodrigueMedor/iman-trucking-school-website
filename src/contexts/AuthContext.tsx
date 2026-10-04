import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { EMAIL_RATE_LIMIT_MESSAGE, isEmailRateLimited } from '../portal/errors'

type LocalRole = 'super_admin' | 'instructor' | 'student'
type Profile = { id: string; full_name: string; role: LocalRole | 'admin' | 'employee'; active: boolean }
export type SignUpInput = { firstName: string; lastName: string; email: string; password: string; redirectTo: string }
export type VerificationResult = { error?: string; verified?: boolean }
type AuthValue = {
  configured: boolean
  loading: boolean
  /** True once the profile for the current session has been fetched (it may still be null). */
  profileReady: boolean
  session: Session | null
  profile: Profile | null
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (input: SignUpInput) => Promise<{ error?: string; needsConfirmation?: boolean }>
  verifyEmail: (email: string, code: string) => Promise<VerificationResult>
  resendVerification: (email: string) => Promise<string | null>
  resetPassword: (email: string, redirectTo: string) => Promise<string | null>
  updatePassword: (password: string) => Promise<string | null>
  refreshProfile: () => Promise<void>
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
  // Which user id the current `profile` state was loaded for.
  const [profileFor, setProfileFor] = useState<string | null>(initialLocalAuth?.session.user.id ?? null)

  const loadProfile = async (userId?: string) => {
    if (!supabase || !userId) {
      setProfile(null)
      setProfileFor(null)
      return
    }
    const { data, error } = await supabase.from('profiles').select('id, full_name, role, active').eq('id', userId).maybeSingle()
    if (error) console.error('Failed to load profile:', error)
    setProfile((data as Profile | null) ?? null)
    setProfileFor(userId)
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
      // Supabase must not be awaited inside this callback; defer the query.
      window.setTimeout(() => void loadProfile(next?.user.id), 0)
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
    profileReady: !loading && (!session || profileFor === session.user.id),
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
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        if (/email not confirmed/i.test(error.message)) return 'Enter the verification code sent to your email before signing in.'
        if (/invalid login credentials/i.test(error.message)) return 'The email or password is incorrect.'
        return error.message
      }
      // Profiles are created by the database when the account is created;
      // the browser never creates or changes them.
      const { data: accountProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, role, active')
        .eq('id', data.user.id)
        .maybeSingle()
      if (profileError || !accountProfile) {
        await supabase.auth.signOut()
        setSession(null)
        setProfile(null)
        return 'Your account is not set up yet. Please contact admissions.'
      }
      if (!accountProfile.active) {
        await supabase.auth.signOut()
        setSession(null)
        setProfile(null)
        return 'This account is inactive.'
      }
      setSession(data.session)
      setProfile(accountProfile as Profile)
      setProfileFor(data.user.id)
      return null
    },
    signUp: async ({ firstName, lastName, email, password, redirectTo }) => {
      if (!supabase) return { error: 'Account creation is not available right now. Please contact admissions.' }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: { first_name: firstName, last_name: lastName, full_name: `${firstName} ${lastName}`.trim() },
        },
      })
      if (error) {
        if (isEmailRateLimited(error)) return { error: EMAIL_RATE_LIMIT_MESSAGE }
        if (/already registered|already exists/i.test(error.message)) return { error: 'An account with this email already exists. Sign in instead.' }
        if (/password/i.test(error.message)) return { error: error.message }
        return { error: 'Your account could not be created. Please try again.' }
      }
      // With email confirmation on, an existing address returns a user with no identities.
      if (data.user && data.user.identities?.length === 0) {
        return { error: 'An account with this email already exists. Sign in instead.' }
      }
      return { needsConfirmation: !data.session }
    },
    verifyEmail: async (email, code) => {
      if (!supabase) return { error: 'Email verification is not available right now. Please contact admissions.' }
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
      if (error) {
        if (error.code === 'otp_expired' || /expired/i.test(error.message)) {
          return { error: 'This code is invalid or has expired. Request a new code and try again.' }
        }
        if (/invalid|token/i.test(error.message)) return { error: 'That verification code is incorrect.' }
        if (isEmailRateLimited(error)) return { error: EMAIL_RATE_LIMIT_MESSAGE }
        return { error: 'We could not verify that code. Please try again.' }
      }
      // Verification returns a session. End it so the user completes the explicit
      // Verify Email -> Login step and receives the normal role-based redirect.
      await supabase.auth.signOut()
      setSession(null)
      setProfile(null)
      setProfileFor(null)
      return { verified: true }
    },
    resendVerification: async email => {
      if (!supabase) return 'Email verification is not available right now. Please contact admissions.'
      const { error } = await supabase.auth.resend({ type: 'signup', email })
      if (!error) return null
      if (isEmailRateLimited(error) || error.status === 429) return 'Please wait before requesting another code.'
      return 'We could not send another code. Please try again in a few minutes.'
    },
    resetPassword: async (email, redirectTo) => {
      if (!supabase) return 'Password reset is not available right now. Please contact admissions.'
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
      if (!error) return null
      if (isEmailRateLimited(error)) return EMAIL_RATE_LIMIT_MESSAGE
      return 'We could not send the reset email. Please try again in a few minutes.'
    },
    updatePassword: async password => {
      if (!supabase) return 'Password reset is not available right now.'
      const { error } = await supabase.auth.updateUser({ password })
      return error ? error.message : null
    },
    refreshProfile: async () => {
      await loadProfile(session?.user.id)
    },
    signOut: async () => {
      window.sessionStorage.removeItem(localSessionKey)
      setSession(null)
      setProfile(null)
      setProfileFor(null)
      if (supabase) await supabase.auth.signOut()
    },
  }), [loading, session, profile, profileFor])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
