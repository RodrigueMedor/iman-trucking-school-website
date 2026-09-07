import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  Alert,
  Paper,
  Stack,
} from '@mui/material'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type Option = { id: string; name: string }

const fallbackOptions = {
  courses: [
    { id: 'demo-course-1', name: 'CDL Class A Training' },
    { id: 'demo-course-2', name: 'CDL Class B Training' },
  ],
  sessions: [
    { id: 'demo-session-1', name: 'Fall 2026' },
  ],
}

export function ClassApplication() {
  const navigate = useNavigate()
  const isMock = !supabase
  const [options, setOptions] = useState(fallbackOptions)
  const [state, setState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    courseId: '',
    sessionId: '',
    statement: '',
  })

  useEffect(() => {
    if (!isMock) {
      // In production, fetch from Supabase
      // For now, use fallback
    }
  }, [isMock])

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState('saving')

    try {
      if (isMock) {
        localStorage.setItem(
          'iman-mock-application',
          JSON.stringify({
            ...formData,
            id: `APP-${Date.now()}`,
            status: 'SUBMITTED',
            createdAt: new Date().toISOString(),
          })
        )
        setState('success')
      } else {
        const { error } = await supabase!.from('cdl_class_applications').insert({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone || null,
          courseId: formData.courseId,
          sessionId: formData.sessionId,
          statement: formData.statement || null,
          status: 'SUBMITTED',
        })

        if (error) throw error
        setState('success')
      }
    } catch {
      setState('error')
    }
  }

  if (state === 'success') {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: '#f5f7fb' }}>
        <Container maxWidth="md">
          <Card sx={{ boxShadow: '0 25px 50px rgba(8,8,95,.15)', borderRadius: 4 }}>
            <CardContent sx={{ p: { xs: 4, md: 6 }, textAlign: 'center' }}>
              <CheckCircleIcon sx={{ fontSize: 64, color: '#4caf50', mb: 3 }} />
              <Typography variant="h3" fontWeight={900} gutterBottom>
                Application submitted
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 4 }}>
                Iman Trucking School received your application. Staff will review it and contact you by email.
              </Typography>
              <Button component={Link} to="/" variant="contained" color="secondary" size="large">
                Return home
              </Button>
            </CardContent>
          </Card>
        </Container>
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7fb', py: 8 }}>
      <Container maxWidth="lg">
        <Stack direction="row" alignItems="center" gap={2} sx={{ mb: 4 }}>
          <LocalShippingIcon sx={{ fontSize: 48, color: '#d61f2c' }} />
          <Box>
            <Button component={Link} to="/" sx={{ mb: 1 }}>
              ← Back to Home
            </Button>
            <Typography variant="h3" fontWeight={900}>Class Application</Typography>
          </Box>
        </Stack>

        <Paper sx={{ p: { xs: 4, md: 6 }, borderRadius: 4, boxShadow: '0 12px 35px rgba(8,8,95,.06)' }}>
          <Typography variant="overline" fontWeight={900} letterSpacing=".12em" textTransform="uppercase" color="#8a5700">
            Apply for a training class
          </Typography>
          <Typography variant="h4" fontWeight={900} sx={{ mt: 1 }}>
            Apply for a training class
          </Typography>

          <form onSubmit={submit}>
            <Grid container spacing={3} sx={{ mt: 3 }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="First name"
                  value={formData.firstName}
                  onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                  required
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
              <Grid size={{ xs: 12, md: 6 }}>
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
                  label="Phone"
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth required>
                  <InputLabel>Program</InputLabel>
                  <Select
                    value={formData.courseId}
                    onChange={e => setFormData({ ...formData, courseId: e.target.value })}
                    label="Program"
                  >
                    {options.courses.map(course => (
                      <MenuItem key={course.id} value={course.id}>
                        {course.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth required>
                  <InputLabel>Academic session</InputLabel>
                  <Select
                    value={formData.sessionId}
                    onChange={e => setFormData({ ...formData, sessionId: e.target.value })}
                    label="Academic session"
                  >
                    {options.sessions.map(session => (
                      <MenuItem key={session.id} value={session.id}>
                        {session.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Why are you applying?"
                  value={formData.statement}
                  onChange={e => setFormData({ ...formData, statement: e.target.value })}
                  inputProps={{ maxLength: 1500 }}
                  helperText={`${formData.statement.length}/1500 characters`}
                />
              </Grid>
              <Grid size={12}>
                {state === 'error' && (
                  <Alert severity="error" sx={{ mb: 3 }}>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <ErrorIcon fontSize="small" />
                      Unable to submit. Check the information and try again.
                    </Stack>
                  </Alert>
                )}
                <Button
                  type="submit"
                  variant="contained"
                  color="secondary"
                  size="large"
                  fullWidth
                  disabled={state === 'saving'}
                  sx={{ py: 2 }}
                >
                  {state === 'saving' ? 'Submitting...' : 'Submit Application'}
                </Button>
              </Grid>
            </Grid>
          </form>
        </Paper>
      </Container>
    </Box>
  )
}
