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

export function CDLRegister() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (formData.password.length < 10) {
      setError('Password must be at least 10 characters')
      setLoading(false)
      return
    }

    try {
      if (!supabase) throw new Error('Student registration requires a configured Supabase project. Use the local student demo account instead.')

      // Sign up with Supabase
      const { data, error: signUpError } = await supabase!.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            firstName: formData.firstName,
            lastName: formData.lastName,
            role: 'student',
          },
        },
      })

      if (signUpError) throw signUpError

      // Create student profile
      if (data.user) {
        const { error: profileError } = await supabase!
          .from('cdl_students')
          .insert({
            user_id: data.user.id,
            first_name: formData.firstName,
            last_name: formData.lastName,
            preferred_language: 'en',
          })

        if (profileError) throw profileError
      }

      // Redirect to assessment
      navigate('/cdl-readiness')
    } catch (err: any) {
      setError(err.message || 'Failed to create account')
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
              Student Registration
            </Typography>
            <Typography variant="h3" fontWeight={900} gutterBottom>
              Start your assessment
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 4 }}>
              Create a secure account. Your progress and personal information stay private.
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
                  label="First name"
                  value={formData.firstName}
                  onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                  required
                  autoFocus
                />
                <TextField
                  fullWidth
                  label="Last name"
                  value={formData.lastName}
                  onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                  required
                />
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  required
                />
                <TextField
                  fullWidth
                  label="Password"
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  required
                  helperText="Minimum 10 characters"
                />
                <TextField
                  fullWidth
                  label="Confirm password"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
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
                  {loading ? 'Creating account...' : 'Create Account & Start Assessment'}
                </Button>
              </Stack>
            </form>

            <Divider sx={{ my: 4 }} />

            <Typography textAlign="center" color="text.secondary">
              Already have an account?{' '}
              <MuiLink component={Link} to="/cdl-login" fontWeight="bold" color="#d61f2c">
                Sign in
              </MuiLink>
            </Typography>
          </CardContent>
        </Card>
      </Container>
    </Box>
  )
}
