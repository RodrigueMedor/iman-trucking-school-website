import { useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  TextField,
  Typography,
  Alert,
  Stack,
  Link as MuiLink,
  Divider,
} from '@mui/material'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getLocalAccountRole, useAuth } from '../contexts/AuthContext'

export function CDLLogin() {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const localRole = getLocalAccountRole(formData.email, formData.password)
      if (localRole) {
        const message = await signIn(formData.email, formData.password)
        if (message) throw new Error(message)
        navigate(localRole === 'student' ? '/cdl-readiness/' : localRole === 'instructor' ? '/admin/cdl-instructor/' : '/admin/')
        return
      }

      if (!supabase) throw new Error('Use one of the configured local demo accounts.')

      const message = await signIn(formData.email, formData.password)
      if (message) throw new Error(message)
      const { data: { user } } = await supabase.auth.getUser()
      const { data: accountProfile, error: profileError } = await supabase
        .from('profiles')
        .select('role, active')
        .eq('id', user!.id)
        .single()
      if (profileError || !accountProfile?.active) throw new Error('Your account role could not be loaded.')
      navigate(accountProfile.role === 'instructor' ? '/admin/cdl-instructor/' : ['admin', 'super_admin'].includes(accountProfile.role) ? '/admin/' : '/cdl-readiness/')
    } catch (err: any) {
      setError(err.message || 'Failed to sign in')
    }

    setLoading(false)
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: '#f5f7fb' }}>
      <Container maxWidth="sm">
        <Card sx={{ boxShadow: '0 25px 50px rgba(8,8,95,.15)', borderRadius: 4 }}>
          <CardContent sx={{ p: { xs: 4, md: 6 } }}>
            <Stack direction="row" alignItems="center" gap={2} sx={{ mb: 4, justifyContent: 'center' }}>
              <LocalShippingIcon sx={{ fontSize: 48, color: '#d61f2c' }} />
              <Typography variant="h4" fontWeight={900} color="primary.main">
                IMAN CDL READINESS
              </Typography>
            </Stack>

            <Typography variant="overline" fontWeight={900} letterSpacing=".12em" textTransform="uppercase" color="#8a5700" display="block" sx={{ mb: 2 }}>
              Welcome back
            </Typography>
            <Typography variant="h3" fontWeight={900} gutterBottom>
              Continue your journey
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 4 }}>
              Sign in to resume an assessment or review your result.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <Stack spacing={3}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  required
                  autoFocus
                />
                <TextField
                  fullWidth
                  label="Password"
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  required
                />
                <Button
                  type="submit"
                  variant="contained"
                  color="secondary"
                  size="large"
                  fullWidth
                  disabled={loading}
                  sx={{ py: 2 }}
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
              </Stack>
            </form>

            <Divider sx={{ my: 4 }} />

            <Typography textAlign="center" color="text.secondary">
              Don't have an account?{' '}
              <MuiLink component={Link} to="/cdl-register" fontWeight="bold" color="#d61f2c">
                Create account
              </MuiLink>
            </Typography>
          </CardContent>
        </Card>
      </Container>
    </Box>
  )
}
