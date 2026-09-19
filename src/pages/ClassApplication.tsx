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
  CircularProgress,
} from '@mui/material'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { createApplicationCheckout } from '../lib/stripe'
import { getApiUrl } from '../lib/api'
import { PaymentStatus } from '../components/PaymentStatus'
import { PaymentPolicyAgreement } from '../components/PaymentPolicyAgreement'
import { isPaymentPolicySigned } from '../lib/paymentPolicy'

type Option = { id: string; name: string; application_fee_cents?: number }

const fallbackOptions = {
  courses: [
    { id: 'demo-course-1', name: 'CDL Class A Training', application_fee_cents: 2500 },
    { id: 'demo-course-2', name: 'CDL Class B Training', application_fee_cents: 2500 },
  ],
  sessions: [
    { id: 'demo-session-1', name: 'Fall 2026' },
  ],
}

export function ClassApplication() {
  const navigate = useNavigate()
  const location = useLocation()
  const isMock = !supabase
  const paymentSessionId = new URLSearchParams(location.search).get('session_id')
  const [options, setOptions] = useState(fallbackOptions)
  const [state, setState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [emailWarning, setEmailWarning] = useState('')
  const [paymentRequired, setPaymentRequired] = useState(false)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [paymentPolicyAccepted, setPaymentPolicyAccepted] = useState(false)
  const [paymentPolicySignature, setPaymentPolicySignature] = useState('')
  const [submittedApplication, setSubmittedApplication] = useState<any>(null)
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
      Promise.all([
        supabase!.from('cdl_courses').select('id, name, application_fee_cents').eq('active', true).order('name'),
        supabase!.from('cdl_academic_sessions').select('id, name').eq('open', true).order('starts_at'),
      ]).then(([coursesResult, sessionsResult]) => {
        if (!coursesResult.error && coursesResult.data?.length) {
          setOptions(current => ({ ...current, courses: coursesResult.data }))
        }
        if (!sessionsResult.error && sessionsResult.data?.length) {
          setOptions(current => ({ ...current, sessions: sessionsResult.data }))
        }
      })
    }
  }, [isMock])

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState('saving')
    setEmailWarning('')

    try {
      if (isMock) {
        const mockApp = {
          ...formData,
          id: `APP-${Date.now()}`,
          status: 'SUBMITTED',
          createdAt: new Date().toISOString(),
        }
        localStorage.setItem('iman-mock-application', JSON.stringify(mockApp))
        setSubmittedApplication(mockApp)
        setState('success')
        setPaymentRequired(false)
      } else {
        const { data, error } = await supabase!.from('cdl_class_applications').insert({
          first_name: formData.firstName,
          last_name: formData.lastName,
          email: formData.email,
          phone: formData.phone || null,
          course_id: formData.courseId,
          session_id: formData.sessionId,
          statement: formData.statement || null,
          status: 'SUBMITTED',
        }).select().single()

        if (error) throw error

        const course = options.courses.find(option => option.id === formData.courseId)
        const session = options.sessions.find(option => option.id === formData.sessionId)
        try {
          const response = await fetch(getApiUrl('/api/send-class-application.php'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...formData,
              courseName: course?.name || 'Not specified',
              sessionName: session?.name || 'Not specified',
            }),
          })
          if (!response.ok) throw new Error('Notification email failed')
        } catch {
          setEmailWarning('Your application was saved, but the email notification could not be sent. Staff can still see it in the admin portal.')
        }

        setSubmittedApplication(data)
        setState('idle')
        setPaymentRequired(true)
      }
    } catch {
      setState('error')
    }
  }

  async function handlePayment() {
    if (!submittedApplication) return
    if (!isPaymentPolicySigned(paymentPolicyAccepted, paymentPolicySignature, formData.firstName, formData.lastName)) {
      setPaymentError('Read the payment policy, check the box, and type your full legal name to sign before paying.')
      return
    }

    setPaymentLoading(true)
    setPaymentError('')

    try {
      await createApplicationCheckout(
        submittedApplication.id,
        formData.email,
        formData.firstName,
        formData.lastName,
        formData.courseId,
        paymentPolicyAccepted,
        paymentPolicySignature
      )
    } catch (err: any) {
      setPaymentError(err.message || 'Failed to initiate payment')
      setPaymentLoading(false)
    }
  }

  function skipPayment() {
    // Allow user to proceed without payment
    setState('success')
  }

  if (paymentSessionId) {
    return (
      <PaymentStatus
        onContinue={() => setState('success')}
        continueLabel="Continue"
      />
    )
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
              {emailWarning && <Alert severity="warning" sx={{ mb: 4, textAlign: 'left' }}>{emailWarning}</Alert>}
              <Button component={Link} to="/" variant="contained" color="secondary" size="large">
                Return home
              </Button>
            </CardContent>
          </Card>
        </Container>
      </Box>
    )
  }

  if (paymentRequired) {
    const course = options.courses.find(option => option.id === formData.courseId)
    const applicationFee = course?.application_fee_cents ? course.application_fee_cents / 100 : 25

    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: '#f5f7fb' }}>
        <Container maxWidth="md">
          <Card sx={{ boxShadow: '0 25px 50px rgba(8,8,95,.15)', borderRadius: 4 }}>
            <CardContent sx={{ p: { xs: 4, md: 6 }, textAlign: 'center' }}>
              <CheckCircleIcon sx={{ fontSize: 64, color: '#4caf50', mb: 3 }} />
              <Typography variant="h3" fontWeight={900} gutterBottom>
                Application Submitted Successfully!
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 4 }}>
                Thank you, {formData.firstName}! Your application has been received. Complete your application by paying the application fee or submit without payment.
              </Typography>

              {paymentError && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {paymentError}
                </Alert>
              )}

              <Stack spacing={2} sx={{ mb: 4, textAlign: 'left' }}>
                <Alert severity="info">
                  <Typography fontWeight="bold">Application Fee: ${applicationFee.toFixed(2)}</Typography>
                  <Typography variant="body2">Complete your application with a secure payment after signing the policy below.</Typography>
                </Alert>
                <PaymentPolicyAgreement
                  firstName={formData.firstName}
                  lastName={formData.lastName}
                  accepted={paymentPolicyAccepted}
                  signature={paymentPolicySignature}
                  onAcceptedChange={setPaymentPolicyAccepted}
                  onSignatureChange={setPaymentPolicySignature}
                />
              </Stack>

              <Stack spacing={2}>
                <Button
                  variant="contained"
                  color="secondary"
                  size="large"
                  fullWidth
                  onClick={handlePayment}
                  disabled={
                    paymentLoading ||
                    !isPaymentPolicySigned(
                      paymentPolicyAccepted,
                      paymentPolicySignature,
                      formData.firstName,
                      formData.lastName
                    )
                  }
                  sx={{ py: 2 }}
                  startIcon={paymentLoading ? <CircularProgress size={20} color="inherit" /> : undefined}
                >
                  {paymentLoading ? 'Processing...' : `Pay Application Fee ($${applicationFee.toFixed(2)})`}
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  fullWidth
                  onClick={skipPayment}
                  sx={{ py: 2 }}
                >
                  Submit Without Payment
                </Button>
              </Stack>
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
