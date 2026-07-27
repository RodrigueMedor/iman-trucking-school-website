import { useState, type FormEvent } from 'react'
import { Alert, Box, Button, Container, Paper, Stack, TextField, Typography } from '@mui/material'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const authorizedEmail = 'rodriguemedor@yahoo.fr'

export function AdminLogin() {
  const { configured, session, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState(authorizedEmail)
  const [recoveryMessage, setRecoveryMessage] = useState('')
  if (session) return <Navigate to="/admin/" replace />
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setLoading(true); setError('')
    const message = await signIn(email.trim(), password)
    setLoading(false)
    if (message) return setError(message)
    navigate((location.state as { from?: string } | null)?.from || '/admin/', { replace: true })
  }
  const recover = async () => {
    setError(''); setRecoveryMessage('')
    if (recoveryEmail.trim().toLowerCase() !== authorizedEmail) return setError('Password recovery is restricted to the authorized super-admin account.')
    if (!supabase) return setError('Password recovery is not configured.')
    const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(authorizedEmail, {
      redirectTo: `${window.location.origin}/admin/reset-password/`,
    })
    if (recoveryError) return setError(recoveryError.message)
    setRecoveryMessage(`A secure password-reset link was sent to ${authorizedEmail}.`)
  }
  return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: '#071a33', p: 2 }}><Container maxWidth="sm"><Paper component="form" onSubmit={submit} sx={{ p: { xs: 4, md: 6 }, borderRadius: 4 }}><Stack spacing={2.5}><Box sx={{ width: 58, height: 58, display: 'grid', placeItems: 'center', bgcolor: 'secondary.main', color: 'white', borderRadius: 3 }}><LockRoundedIcon /></Box><Box><Typography variant="h3" fontWeight={950}>Website Studio</Typography><Typography color="text.secondary" mt={1}>Sign in with the authorized super-admin account.</Typography></Box>{!configured && <Alert severity="warning">Authentication has not been configured for this deployment.</Alert>}{error && <Alert severity="error">{error}</Alert>}{recoveryMessage && <Alert severity="success">{recoveryMessage}</Alert>}<TextField required type="email" label="Email address" value={email} onChange={event => setEmail(event.target.value)} /><TextField required type="password" label="Password" value={password} onChange={event => setPassword(event.target.value)} /><Button type="submit" variant="contained" color="secondary" size="large" disabled={loading || !configured}>{loading ? 'Signing in…' : 'Sign in securely'}</Button><Button type="button" onClick={() => setRecoveryOpen(value => !value)}>Super-admin password recovery</Button>{recoveryOpen && <Stack spacing={1.5} sx={{ p: 2.5, bgcolor: '#f5f7fa', borderRadius: 2.5 }}><TextField type="email" label="Authorized email" value={recoveryEmail} onChange={event => setRecoveryEmail(event.target.value)} /><Button type="button" variant="outlined" onClick={() => void recover()}>Send password-reset link</Button></Stack>}</Stack></Paper></Container></Box>
}
