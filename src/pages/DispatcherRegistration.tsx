import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  TextField,
  Typography,
  Alert,
  Paper,
  Stack,
  CircularProgress,
  Divider,
  Chip,
} from '@mui/material'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import EditIcon from '@mui/icons-material/Edit'
import PrintIcon from '@mui/icons-material/Print'
import PolicyIcon from '@mui/icons-material/Policy'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  createDispatcherCheckout,
  createDispatcherRegistration,
  type PaymentRegistrationDetails,
} from '../lib/stripe'
import { PaymentStatus } from '../components/PaymentStatus'
import {
  DispatcherPolicyAgreement,
  DISPATCHER_POLICY_TEXT,
} from '../components/DispatcherPolicyAgreement'
import { isPaymentPolicySigned } from '../lib/paymentPolicy'

type DispatcherClass = {
  id: string
  name: string
  description?: string
  price_cents?: number
  starts_at?: string
  ends_at?: string
  location?: string
  schedule_notes?: string
  seat_capacity?: number | null
  seats_remaining?: number | null
}

const fallbackClasses: DispatcherClass[] = [
  {
    id: '1c13132a-6e4d-4004-9894-8ccf88bb46c6',
    name: 'Dispatcher Training — Rolling Enrollment 2026',
    description: 'Entry-level freight and fleet dispatcher certification training.',
    price_cents: 52000,
    starts_at: '2026-01-01T00:00:00Z',
    ends_at: '2026-12-31T23:59:59Z',
    location: 'Iman Trucking School — Orlando, FL Campus',
    schedule_notes: 'Rolling enrollment — contact admissions for the next start date.',
    seat_capacity: null,
    seats_remaining: null,
  },
]

const fallbackRegistrationsKey = 'iman-mock-dispatcher-registrations'
const pendingRegistrationStorageKey = 'iman_dispatcher_pending_reg'

function makeRegistrationNo() {
  const stamp = Date.now().toString(36).toUpperCase()
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `DSP-${new Date().getFullYear()}-${stamp}${suffix}`
}

export function DispatcherRegistration() {
  const location = useLocation()
  const isMock = !supabase
  const searchParams = new URLSearchParams(location.search)
  const paymentSessionId = searchParams.get('session_id')
  const paymentState = searchParams.get('payment')

  const [classes, setClasses] = useState<DispatcherClass[]>(fallbackClasses)
  const [state, setState] = useState<'idle' | 'saving' | 'review' | 'success' | 'error'>('idle')
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [paymentPolicyAccepted, setPaymentPolicyAccepted] = useState(false)
  const [paymentPolicySignature, setPaymentPolicySignature] = useState('')
  const [registration, setRegistration] = useState<{
    id: string
    registration_no: string
    class_id: string
  } | null>(null)
  const [confirmedRegistration, setConfirmedRegistration] = useState<PaymentRegistrationDetails | null>(null)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    zip: '',
    classId: '',
  })

  // Restore draft/pending registration from sessionStorage if user returns or cancelled checkout
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(pendingRegistrationStorageKey)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed.formData) {
          setFormData(prev => ({ ...prev, ...parsed.formData }))
        }
        if (parsed.registration) {
          setRegistration(parsed.registration)
          if (!paymentSessionId && state === 'idle' && paymentState === 'canceled') {
            setState('review')
          }
        }
        if (parsed.paymentPolicyAccepted) {
          setPaymentPolicyAccepted(Boolean(parsed.paymentPolicyAccepted))
        }
        if (parsed.paymentPolicySignature) {
          setPaymentPolicySignature(parsed.paymentPolicySignature)
        }
      }
    } catch {}
  }, [paymentSessionId, paymentState])

  useEffect(() => {
    if (!isMock) {
      supabase!
        .from('cdl_dispatcher_classes_public')
        .select('id, name, description, price_cents, starts_at, ends_at, location, schedule_notes, seat_capacity, seats_remaining')
        .order('starts_at')
        .then(({ data, error }) => {
          if (!error && data?.length) {
            setClasses(data as DispatcherClass[])
          }
        })
    }
  }, [isMock])

  // Automatically select the default open class if none is selected yet
  useEffect(() => {
    if (classes.length > 0 && !formData.classId) {
      setFormData(prev => ({ ...prev, classId: prev.classId || classes[0].id }))
    }
  }, [classes, formData.classId])

  const effectiveClassId = formData.classId || (classes.length > 0 ? classes[0].id : '')
  const selectedClass = classes.find(c => c.id === (effectiveClassId || registration?.class_id)) || classes[0]
  const price = selectedClass?.price_cents != null ? selectedClass.price_cents / 100 : 520

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const targetClassId = formData.classId || (classes.length > 0 ? classes[0].id : '')
    if (!targetClassId) {
      setPaymentError('Please select a dispatcher class to continue.')
      return
    }
    const submissionData = { ...formData, classId: targetClassId }
    setPaymentError('')
    setState('saving')

    const registrationNo = makeRegistrationNo()
    try {
      if (isMock) {
        const mock = {
          ...formData,
          id: `DSP-REG-${Date.now()}`,
          registration_no: registrationNo,
          className: selectedClass?.name || 'Dispatcher Training',
          status: 'SUBMITTED',
          payment_status: isMock ? 'paid' : 'pending',
          submittedAt: new Date().toISOString(),
        }
        const saved = JSON.parse(localStorage.getItem(fallbackRegistrationsKey) || '[]')
        localStorage.setItem(fallbackRegistrationsKey, JSON.stringify([mock, ...saved]))
        const regData = { id: mock.id, registration_no: registrationNo, class_id: targetClassId }
        setFormData(submissionData)
        setRegistration(regData)
        try {
          sessionStorage.setItem(
            pendingRegistrationStorageKey,
            JSON.stringify({ formData: submissionData, registration: regData, classId: targetClassId })
          )
        } catch {}
        setState('review')
      } else {
        // Registration is created by the server with the service-role key.
        const data = await createDispatcherRegistration(submissionData)
        setFormData(submissionData)
        setRegistration(data)
        try {
          sessionStorage.setItem(
            pendingRegistrationStorageKey,
            JSON.stringify({ formData: submissionData, registration: data, classId: targetClassId })
          )
        } catch {}
        setState('review')
      }
    } catch (err: any) {
      console.error('Dispatcher registration failed:', err)
      setPaymentError(err?.message || 'Unable to save registration')
      setState('error')
    }
  }

  async function handlePayment() {
    if (!registration) return
    if (!paymentPolicyAccepted) {
      setPaymentError('You must check the box agreeing to the non-refundable registration policy before paying.')
      return
    }

    if (!paymentPolicySignature.trim()) {
      setPaymentError('Please type your full legal name to electronically sign the policy.')
      return
    }

    if (!isPaymentPolicySigned(paymentPolicyAccepted, paymentPolicySignature, formData.firstName, formData.lastName)) {
      setPaymentError(`Type your full legal name ("${formData.firstName} ${formData.lastName}".trim()) to sign before paying.`)
      return
    }

    // Persist pending registration state so returning from Stripe has complete details
    try {
      sessionStorage.setItem(
        pendingRegistrationStorageKey,
        JSON.stringify({
          formData,
          registration,
          classId: registration.class_id,
          paymentPolicyAccepted,
          paymentPolicySignature,
        })
      )
    } catch {}

    if (isMock) {
      sessionStorage.removeItem(pendingRegistrationStorageKey)
      setState('success')
      return
    }

    setPaymentLoading(true)
    setPaymentError('')

    try {
      await createDispatcherCheckout(
        registration.id,
        formData.email,
        formData.firstName,
        formData.lastName,
        registration.class_id,
        paymentPolicyAccepted,
        paymentPolicySignature
      )
    } catch (err: any) {
      setPaymentError(err.message || 'Failed to initiate payment')
      setPaymentLoading(false)
    }
  }

  function editRegistration() {
    setState('idle')
    window.scrollTo(0, 0)
  }

  if (paymentSessionId) {
    return (
      <PaymentStatus
        continueLabel="View Completed Registration"
        onContinue={result => {
          if (result?.registration) {
            setConfirmedRegistration(result.registration)
          }
          sessionStorage.removeItem(pendingRegistrationStorageKey)
          setState('success')
        }}
        onRetry={() => {
          setState('review')
        }}
      />
    )
  }

  if (state === 'success') {
    const regNo = confirmedRegistration?.registrationNo || registration?.registration_no || 'DSP-CONFIRMED'
    const studentFirstName = confirmedRegistration?.firstName || formData.firstName || 'Student'
    const studentLastName = confirmedRegistration?.lastName || formData.lastName || ''
    const studentEmail = confirmedRegistration?.email || formData.email || '—'
    const studentPhone = confirmedRegistration?.phone || formData.phone || '—'
    const studentAddress =
      confirmedRegistration?.address ||
      (formData.address1
        ? `${formData.address1}${formData.address2 ? `, ${formData.address2}` : ''}, ${formData.city}, ${formData.state} ${formData.zip}`
        : '—')
    const className = confirmedRegistration?.className || selectedClass?.name || 'Dispatcher Training'
    const total = price || 520

    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: '#f5f7fb', py: 6 }}>
        <Container maxWidth="md">
          <Card sx={{ boxShadow: '0 25px 50px rgba(8,8,95,.15)', borderRadius: 4 }}>
            <CardContent sx={{ p: { xs: 4, md: 6 }, textAlign: 'center' }}>
              <CheckCircleIcon sx={{ fontSize: 72, color: '#4caf50', mb: 2 }} />
              <Typography variant="h3" fontWeight={900} gutterBottom>
                Registration Completed!
              </Typography>
              <Typography variant="h6" color="text.secondary" sx={{ mb: 4 }}>
                Thank you, {studentFirstName}! Your seat in the Dispatcher Training Program is confirmed.
              </Typography>

              <Box sx={{ bgcolor: '#e8f5e9', border: '1px solid #c8e6c9', borderRadius: 3, p: 2.5, mb: 4 }}>
                <Typography variant="overline" fontWeight={900} color="#2e7d32">
                  Confirmed Registration Number
                </Typography>
                <Typography variant="h4" fontWeight={950} color="#1b5e20" sx={{ letterSpacing: '0.05em' }}>
                  {regNo}
                </Typography>
              </Box>

              <Paper variant="outlined" sx={{ p: 3, mb: 4, textAlign: 'left', bgcolor: '#fafbfe', borderRadius: 3 }}>
                <Typography variant="subtitle1" fontWeight={900} gutterBottom>
                  Registration & Payment Summary
                </Typography>
                <Divider sx={{ my: 1.5 }} />
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="caption" color="text.secondary">Registrant</Typography>
                    <Typography variant="body2" fontWeight={700}>{studentFirstName} {studentLastName}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="caption" color="text.secondary">Email Address</Typography>
                    <Typography variant="body2" fontWeight={700}>{studentEmail}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="caption" color="text.secondary">Phone Number</Typography>
                    <Typography variant="body2" fontWeight={700}>{studentPhone}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="caption" color="text.secondary">Address</Typography>
                    <Typography variant="body2" fontWeight={700}>{studentAddress}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="caption" color="text.secondary">Class Enrolled</Typography>
                    <Typography variant="body2" fontWeight={700}>{className}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="caption" color="text.secondary">Amount Paid</Typography>
                    <Typography variant="body2" fontWeight={800} color="success.main">
                      ${total.toFixed(2)} USD (Paid via Stripe)
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>

              <Alert
                severity="warning"
                icon={<PolicyIcon />}
                sx={{
                  mb: 4,
                  textAlign: 'left',
                  bgcolor: '#fff9e6',
                  color: '#3e2723',
                  border: '1px solid #ffe082',
                }}
              >
                <Typography variant="subtitle2" fontWeight={800} gutterBottom>
                  Registration Policy Acknowledged
                </Typography>
                <Typography variant="body2">
                  {DISPATCHER_POLICY_TEXT}
                </Typography>
              </Alert>

              <Alert severity="success" sx={{ mb: 4, textAlign: 'left' }}>
                {isMock
                  ? 'This was a demo registration. In live mode, a confirmation email is dispatched via Resend and visible to staff in the admin dashboard.'
                  : 'A formal confirmation email has been sent to your inbox. Our admissions team will contact you with course access and materials prior to start.'}
              </Alert>

              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="center" gap={2}>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => window.print()}
                  startIcon={<PrintIcon />}
                >
                  Print Confirmation
                </Button>
                <Button component={Link} to="/" variant="contained" color="secondary" size="large">
                  Return to Home
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
            <Typography variant="h3" fontWeight={900}>Dispatcher Class Registration</Typography>
          </Box>
        </Stack>

        {state === 'review' ? (
          <Paper sx={{ p: { xs: 4, md: 6 }, borderRadius: 4, boxShadow: '0 12px 35px rgba(8,8,95,.06)' }}>
            <Typography variant="overline" fontWeight={900} letterSpacing=".12em" textTransform="uppercase" color="#8a5700">
              Step 2 of 2
            </Typography>
            <Typography variant="h4" fontWeight={900} sx={{ mt: 1 }}>
              Review your registration
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 4 }}>
              Please verify your information and accept the required policy before proceeding to payment.
            </Typography>

            {paymentError && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {paymentError}
              </Alert>
            )}

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, height: '100%' }}>
                  <Typography fontWeight={900} gutterBottom>Selected class</Typography>
                  <Typography variant="body2"><strong>{selectedClass?.name || 'Dispatcher Training'}</strong></Typography>
                  {selectedClass?.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {selectedClass.description}
                    </Typography>
                  )}
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 3, pt: 2, borderTop: '1px dashed', borderColor: 'divider' }}>
                    <Typography fontWeight={900}>Tuition / Total due</Typography>
                    <Typography variant="h4" fontWeight={950} color="secondary.main">${price.toFixed(2)}</Typography>
                  </Stack>
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, height: '100%' }}>
                  <Typography fontWeight={900} gutterBottom>Registrant information</Typography>
                  <Stack spacing={0.75}>
                    <Typography variant="body2"><strong>Name:</strong> {formData.firstName} {formData.lastName}</Typography>
                    <Typography variant="body2"><strong>Email:</strong> {formData.email}</Typography>
                    <Typography variant="body2"><strong>Phone:</strong> {formData.phone || '—'}</Typography>
                    <Typography variant="body2"><strong>Address:</strong> {formData.address1}{formData.address2 ? `, ${formData.address2}` : ''}</Typography>
                    <Typography variant="body2"><strong>City / State / ZIP:</strong> {formData.city}, {formData.state} {formData.zip}</Typography>
                  </Stack>
                </Paper>
              </Grid>
            </Grid>

            <Divider sx={{ my: 4 }} />

            <Stack spacing={3}>
              <DispatcherPolicyAgreement
                firstName={formData.firstName}
                lastName={formData.lastName}
                accepted={paymentPolicyAccepted}
                signature={paymentPolicySignature}
                onAcceptedChange={setPaymentPolicyAccepted}
                onSignatureChange={setPaymentPolicySignature}
              />

              <Button
                variant="contained"
                color="secondary"
                size="large"
                fullWidth
                onClick={handlePayment}
                disabled={
                  paymentLoading ||
                  !paymentPolicyAccepted ||
                  !isPaymentPolicySigned(
                    paymentPolicyAccepted,
                    paymentPolicySignature,
                    formData.firstName,
                    formData.lastName
                  )
                }
                sx={{ py: 2, fontSize: '1.1rem', fontWeight: 800 }}
                startIcon={paymentLoading ? <CircularProgress size={20} color="inherit" /> : undefined}
              >
                {paymentLoading ? 'Connecting to Stripe...' : `Proceed to Stripe Payment ($${price.toFixed(2)})`}
              </Button>

              <Button
                variant="outlined"
                size="large"
                fullWidth
                onClick={editRegistration}
                disabled={paymentLoading}
                sx={{ py: 1.5 }}
                startIcon={<EditIcon />}
              >
                Edit registration information
              </Button>
            </Stack>
          </Paper>
        ) : (
          <Paper sx={{ p: { xs: 4, md: 6 }, borderRadius: 4, boxShadow: '0 12px 35px rgba(8,8,95,.06)' }}>
            <Typography variant="overline" fontWeight={900} letterSpacing=".12em" textTransform="uppercase" color="#8a5700">
              Step 1 of 2
            </Typography>
            <Typography variant="h4" fontWeight={900} sx={{ mt: 1 }}>
              Register for Dispatcher Class
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Complete the form below to register for certification training. You will review your information and policy agreement before paying.
            </Typography>

            <Alert severity="info" sx={{ mb: 4, textAlign: 'left' }}>
              Learn the fundamentals of freight and fleet dispatching, load planning, routing, and
              driver communications. Tuition is $520.00.
            </Alert>

            {state === 'error' && (
              <Alert severity="error" sx={{ mb: 3 }}>
                <Stack direction="row" alignItems="center" gap={1}>
                  <ErrorIcon fontSize="small" />
                  {paymentError || 'Unable to submit. Check the information and try again.'}
                </Stack>
              </Alert>
            )}

            <form onSubmit={submit}>
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
                <Grid size={12}>
                  <TextField
                    fullWidth
                    label="Address"
                    value={formData.address1}
                    onChange={e => setFormData({ ...formData, address1: e.target.value })}
                    required
                  />
                </Grid>
                <Grid size={12}>
                  <TextField
                    fullWidth
                    label="Address line 2 (optional)"
                    value={formData.address2}
                    onChange={e => setFormData({ ...formData, address2: e.target.value })}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 5 }}>
                  <TextField
                    fullWidth
                    label="City"
                    value={formData.city}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                    required
                  />
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                  <TextField
                    fullWidth
                    label="State"
                    value={formData.state}
                    onChange={e => setFormData({ ...formData, state: e.target.value })}
                    required
                  />
                </Grid>
                <Grid size={{ xs: 6, md: 4 }}>
                  <TextField
                    fullWidth
                    label="ZIP code"
                    value={formData.zip}
                    onChange={e => setFormData({ ...formData, zip: e.target.value })}
                    required
                  />
                </Grid>
                <Grid size={12}>
                  <Typography fontWeight={900} sx={{ mb: 1.5 }}>Select a class session</Typography>
                  <Stack spacing={2}>
                    {classes.map(c => {
                      const classPrice = c.price_cents != null ? c.price_cents / 100 : 520
                      const isFull = c.seat_capacity != null && (c.seats_remaining ?? 0) <= 0
                      const isSelected = formData.classId === c.id
                      const startLabel = c.starts_at
                        ? new Date(c.starts_at).toLocaleDateString('en-US', { dateStyle: 'medium' })
                        : 'Rolling enrollment'
                      const endLabel = c.ends_at
                        ? new Date(c.ends_at).toLocaleDateString('en-US', { dateStyle: 'medium' })
                        : null
                      return (
                        <Paper
                          key={c.id}
                          variant="outlined"
                          onClick={() => !isFull && setFormData({ ...formData, classId: c.id })}
                          sx={{
                            p: 2.5,
                            borderRadius: 3,
                            cursor: isFull ? 'not-allowed' : 'pointer',
                            opacity: isFull ? 0.55 : 1,
                            borderColor: isSelected ? 'secondary.main' : 'divider',
                            borderWidth: isSelected ? 2 : 1,
                            bgcolor: isSelected ? '#fff5f5' : 'transparent',
                          }}
                        >
                          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1.5}>
                            <Box>
                              <Typography fontWeight={900}>{c.name}</Typography>
                              {c.description && (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                  {c.description}
                                </Typography>
                              )}
                              <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1 }}>
                                <Chip size="small" label={endLabel ? `${startLabel} – ${endLabel}` : startLabel} />
                                {c.location && <Chip size="small" label={c.location} />}
                                {c.schedule_notes && <Chip size="small" label={c.schedule_notes} />}
                                {c.seat_capacity != null && (
                                  <Chip
                                    size="small"
                                    color={isFull ? 'error' : 'success'}
                                    label={isFull ? 'Class full' : `${c.seats_remaining} seat${c.seats_remaining === 1 ? '' : 's'} left`}
                                  />
                                )}
                              </Stack>
                            </Box>
                            <Typography variant="h6" fontWeight={950} color="secondary.main" whiteSpace="nowrap">
                              ${classPrice.toFixed(2)}
                            </Typography>
                          </Stack>
                        </Paper>
                      )
                    })}
                  </Stack>
                </Grid>
                <Grid size={12}>
                  <Button
                    type="submit"
                    variant="contained"
                    color="secondary"
                    size="large"
                    fullWidth
                    disabled={state === 'saving'}
                    sx={{ py: 2, fontSize: '1.05rem', fontWeight: 700 }}
                  >
                    {state === 'saving' ? 'Saving Registration...' : 'Continue to Review & Policy Agreement'}
                  </Button>
                </Grid>
              </Grid>
            </form>
          </Paper>
        )}
      </Container>
    </Box>
  )
}

export default DispatcherRegistration
