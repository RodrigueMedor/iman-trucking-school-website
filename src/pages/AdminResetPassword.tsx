import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Box, Button, Container, Paper, Stack, TextField, Typography } from '@mui/material'
import LockResetRoundedIcon from '@mui/icons-material/LockResetRounded'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { isSuperAdminEmail } from '../lib/adminAuth'

export function AdminResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    let active = true
    const verifyRecoveryAccount = async () => {
      if (!supabase) {
        if (active) { setError('Password recovery is not configured.'); setChecking(false) }
        return
      }
      const { data, error: userError } = await supabase.auth.getUser()
      const allowed = !userError && isSuperAdminEmail(data.user?.email)
      if (!allowed) await supabase.auth.signOut()
      if (active) {
        setAuthorized(allowed)
        setError(allowed ? '' : 'This password-reset link is invalid or is not for the authorized super-admin account.')
        setChecking(false)
      }
    }
    void verifyRecoveryAccount()
    return () => { active = false }
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    if (!authorized) return setError('This password-reset link is not authorized.')
    if (password.length < 10) return setError('Use a password with at least 10 characters.')
    if (password !== confirmPassword) return setError('The passwords do not match.')
    if (!supabase) return setError('Password recovery is not configured.')
    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (updateError) return setError(updateError.message)
    await supabase.auth.signOut()
    navigate('/admin/login/', { replace: true })
  }
  return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: '#071a33', p: 2 }}><Container maxWidth="sm"><Paper component="form" onSubmit={submit} sx={{ p: { xs: 4, md: 6 }, borderRadius: 4 }}><Stack spacing={2.5}><LockResetRoundedIcon color="secondary" sx={{ fontSize: 52 }} /><Box><Typography variant="h3" fontWeight={950}>Choose a new password</Typography><Typography color="text.secondary" mt={1}>Create a secure password for your Website Studio account.</Typography></Box>{checking && <Alert severity="info">Verifying your secure reset link…</Alert>}{error && <Alert severity="error">{error}</Alert>}<TextField required disabled={!authorized || checking} type="password" label="New password" value={password} onChange={event => setPassword(event.target.value)} /><TextField required disabled={!authorized || checking} type="password" label="Confirm new password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} /><Button type="submit" variant="contained" color="secondary" size="large" disabled={saving || checking || !authorized}>{saving ? 'Updating…' : 'Update password'}</Button>{!checking && !authorized && <Button type="button" onClick={() => navigate('/admin/login/', { replace: true })}>Return to admin sign in</Button>}</Stack></Paper></Container></Box>
}
