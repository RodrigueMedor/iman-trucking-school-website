import { useState, type FormEvent } from 'react'
import { Alert, Box, Button, Container, Paper, Stack, TextField, Typography } from '@mui/material'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { homeForRole, SUPER_ADMIN_EMAIL } from '../lib/adminAuth'

export function AdminLogin() {
  const { configured, profileReady, session, profile, signIn } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [recoveryMessage, setRecoveryMessage] = useState('')
  const [recoveryLoading, setRecoveryLoading] = useState(false)
  // Signed-in accounts go to their own area: staff back to the admin page they
  // asked for, students to the student portal.
  if (session && profileReady && profile) {
    const from = (location.state as { from?: string } | null)?.from
    const staff = profile.role === 'super_admin' || profile.role === 'instructor'
    return <Navigate to={staff && from?.startsWith('/admin/') ? from : homeForRole(profile.role)} replace />
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setLoading(true); setError('')
    const message = await signIn(email.trim(), password)
    setLoading(false)
    if (message) return setError(message)
  }
  const recover = async () => {
    setError(''); setRecoveryMessage('')
    if (!supabase) return setError('Password recovery is not configured.')
    setRecoveryLoading(true)
    const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(SUPER_ADMIN_EMAIL, {
      redirectTo: `${window.location.origin}/admin/reset-password/`,
    })
    setRecoveryLoading(false)
    if (recoveryError) return setError(recoveryError.message)
    setRecoveryMessage(`If ${SUPER_ADMIN_EMAIL} has an account, a password-reset link is on its way. Check the inbox and spam folder.`)
  }
  return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: '#071a33', p: 2 }}><Container maxWidth="sm"><Paper component="form" onSubmit={submit} sx={{ p: { xs: 4, md: 6 }, borderRadius: 4 }}><Stack spacing={2.5}><Box sx={{ width: 58, height: 58, display: 'grid', placeItems: 'center', bgcolor: 'secondary.main', color: 'white', borderRadius: 3 }}><LockRoundedIcon /></Box><Box><Typography variant="h3" fontWeight={950}>Website Studio</Typography><Typography color="text.secondary" mt={1}>Sign in with the authorized super-admin account.</Typography></Box>{!configured && <Alert severity="warning">Authentication has not been configured for this deployment.</Alert>}{error && <Alert severity="error">{error}</Alert>}{recoveryMessage && <Alert severity="success">{recoveryMessage}</Alert>}<TextField required type="email" label="Email address" value={email} onChange={event => setEmail(event.target.value)} /><TextField required type="password" label="Password" value={password} onChange={event => setPassword(event.target.value)} /><Button type="submit" variant="contained" color="secondary" size="large" disabled={loading || !configured}>{loading ? 'Signing in…' : 'Sign in securely'}</Button><Button type="button" onClick={() => setRecoveryOpen(value => !value)}>Super-admin password recovery</Button>{recoveryOpen && <Stack spacing={1.5} sx={{ p: 2.5, bgcolor: '#f5f7fa', borderRadius: 2.5 }}><Alert severity="info">Password recovery is available only for {SUPER_ADMIN_EMAIL}.</Alert><Button type="button" variant="outlined" disabled={recoveryLoading} onClick={() => void recover()}>{recoveryLoading ? 'Sending…' : 'Send password-reset link'}</Button></Stack>}</Stack></Paper></Container></Box>
}
