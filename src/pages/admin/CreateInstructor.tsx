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
  Paper,
  Grid,
} from '@mui/material'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export function CreateInstructor() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
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
    setSuccess('')
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
      if (!supabase) throw new Error('Supabase is not configured.')

      // Sign up the instructor with Supabase
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            full_name: `${formData.firstName} ${formData.lastName}`,
            role: 'instructor',
          },
        },
      })

      if (signUpError) throw signUpError

      if (!data.user) throw new Error('Supabase did not return the new instructor account.')

      // The database auth trigger atomically creates profiles, cdl_users, and
      // cdl_instructors. Writing them again here causes duplicate primary keys.

      setSuccess(`Instructor account created successfully for ${formData.email}. They can now log in.`)
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
      })
    } catch (err: any) {
      setError(err.message || 'Failed to create instructor account')
    }

    setLoading(false)
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7fb', py: 6 }}>
      <Container maxWidth="md">
        <Button component={Link} to="/admin/" sx={{ mb: 2 }}>
          ← Dashboard
        </Button>
        <Typography variant="h3" fontWeight={900} sx={{ mb: 2 }}>
          Create Instructor Account
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 4 }}>
          Only super administrators can create instructor accounts. Instructors can then log in and access the instructor dashboard.
        </Typography>

        <Card sx={{ boxShadow: '0 25px 50px rgba(8,8,95,.15)', borderRadius: 4 }}>
          <CardContent sx={{ p: { xs: 4, md: 6 } }}>
            <Stack direction="row" alignItems="center" gap={2} sx={{ mb: 4 }}>
              <PersonAddIcon sx={{ fontSize: 48, color: '#d61f2c' }} />
              <Typography variant="h5" fontWeight={900} color="primary.main">
                New Instructor
              </Typography>
            </Stack>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            {success && (
              <Alert severity="success" sx={{ mb: 3 }}>
                {success}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="First name"
                    value={formData.firstName}
                    onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                    required
                    autoFocus
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="Last name"
                    value={formData.lastName}
                    onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                    required
                  />
                </Grid>
                <Grid size={12}>
                  <TextField
                    fullWidth
                    label="Email"
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="Password"
                    type="password"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    required
                    helperText="Minimum 10 characters"
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="Confirm password"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                  />
                </Grid>
                <Grid size={12}>
                  <Stack direction="row" gap={2} sx={{ mt: 2 }}>
                    <Button
                      type="submit"
                      variant="contained"
                      color="secondary"
                      size="large"
                      disabled={loading}
                      sx={{ flex: 1 }}
                    >
                      {loading ? 'Creating account...' : 'Create Instructor Account'}
                    </Button>
                    <Button
                      type="button"
                      variant="outlined"
                      component={Link}
                      to="/admin/"
                    >
                      Cancel
                    </Button>
                  </Stack>
                </Grid>
              </Grid>
            </form>
          </CardContent>
        </Card>

        <Paper sx={{ p: 4, mt: 4, borderRadius: 3 }}>
          <Typography variant="h6" fontWeight={900} gutterBottom>
            Instructor Permissions
          </Typography>
          <Typography color="text.secondary">
            Instructors can access the instructor dashboard to view and evaluate student assessments. They cannot access content management, score management, or enrollment features.
          </Typography>
        </Paper>
      </Container>
    </Box>
  )
}
