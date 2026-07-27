import { useState, type FormEvent } from 'react'
import { Alert, Box, Button, Container, Paper, Stack, TextField, Typography } from '@mui/material'
import LockResetRoundedIcon from '@mui/icons-material/LockResetRounded'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function AdminResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('')
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
  return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: '#071a33', p: 2 }}><Container maxWidth="sm"><Paper component="form" onSubmit={submit} sx={{ p: { xs: 4, md: 6 }, borderRadius: 4 }}><Stack spacing={2.5}><LockResetRoundedIcon color="secondary" sx={{ fontSize: 52 }} /><Box><Typography variant="h3" fontWeight={950}>Choose a new password</Typography><Typography color="text.secondary" mt={1}>Create a secure password for your Website Studio account.</Typography></Box>{error && <Alert severity="error">{error}</Alert>}<TextField required type="password" label="New password" value={password} onChange={event => setPassword(event.target.value)} /><TextField required type="password" label="Confirm new password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} /><Button type="submit" variant="contained" color="secondary" size="large" disabled={saving}>{saving ? 'Updating…' : 'Update password'}</Button></Stack></Paper></Container></Box>
}
