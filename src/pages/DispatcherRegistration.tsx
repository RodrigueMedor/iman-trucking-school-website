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
  Divider,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import EditIcon from '@mui/icons-material/Edit'
import PrintIcon from '@mui/icons-material/Print'
import PolicyIcon from '@mui/icons-material/Policy'
import PersonIcon from '@mui/icons-material/Person'
import HomeIcon from '@mui/icons-material/Home'
import SchoolIcon from '@mui/icons-material/School'
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

type DispatcherClass = { id: string; name: string; description?: string; price_cents?: number }

const fallbackClasses: DispatcherClass[] = [
  {
    id: '1c13132a-6e4d-4004-9894-8ccf88bb46c6',
    name: 'Dispatcher Training — Rolling Enrollment 2026',
    description: 'Entry-level freight and fleet dispatcher certification training.',
    price_cents: 52000,
  },
]

const steps = ['Your information', 'Review & policy', 'Confirmation']

const fallbackRegistrationsKey = 'iman-mock-dispatcher-registrations'
const pendingRegistrationStorageKey = 'iman_dispatcher_pending_reg'

function makeRegistrationNo() {
  const stamp = Date.now().toString(36).toUpperCase()
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `DSP-${new Date().getFullYear()}-${stamp}${suffix}`
}

function SectionHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
      {icon}
      <Typography fontWeight={800} variant="subtitle1">
        {title}
      </Typography>
    </Stack>
  )
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
        .from('cdl_dispatcher_classes')
        .select('id, name, description, price_cents')
        .eq('open', true)
        .order('name')
        .then(({ data, error }) => {
          if (!error && data?.length) {
            setClasses(data.map(item => ({ ...item, price_cents: 52000 })) as DispatcherClass[])
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

  const activeStep = state === 'review' ? 1 : state === 'success' ? 2 : 0

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

  const header = (
    <Stack direction="row" alignItems="center" gap={2} sx={{ mb: { xs: 3, md: 4 } }}>
      <LocalShippingIcon sx={{ fontSize: { xs: 36, md: 44 }, color: '#d61f2c' }} />
      <Box>
        <Button component={Link} to="/" size="small" sx={{ mb: 0.5 }}>
          ← Back to Home
        </Button>
        <Typography variant="h4" fontWeight={900}>Dispatcher Class Registration</Typography>
      </Box>
    </Stack>
  )

  const stepper = (
    <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: { xs: 3, md: 4 } }}>
      {steps.map(label => (
        <Step key={label}>
          <StepLabel>{label}</StepLabel>
        </Step>
      ))}
    </Stepper>
  )

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

    const summaryRows: Array<[string, string]> = [
      ['Registrant', `${studentFirstName} ${studentLastName}`],
      ['Email address', studentEmail],
      ['Phone number', studentPhone],
      ['Address', studentAddress],
      ['Class enrolled', className],
    ]

    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7fb', py: { xs: 4, md: 6 } }}>
        <Container maxWidth="sm">
          {header}
          {stepper}
          <Card sx={{ boxShadow: '0 20px 45px rgba(8,8,95,.08)', borderRadius: 4 }}>
            <CardContent sx={{ p: { xs: 3, md: 5 }, textAlign: 'center' }}>
              <CheckCircleIcon sx={{ fontSize: 60, color: '#4caf50', mb: 1.5 }} />
              <Typography variant="h5" fontWeight={900} gutterBottom>
                Registration completed!
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 3 }}>
                Thank you, {studentFirstName}! Your seat in the Dispatcher Training Program is confirmed.
              </Typography>

              <Box sx={{ bgcolor: '#e8f5e9', border: '1px solid #c8e6c9', borderRadius: 3, p: 2, mb: 3 }}>
                <Typography variant="overline" fontWeight={900} color="#2e7d32">
                  Confirmed registration number
                </Typography>
                <Typography variant="h5" fontWeight={950} color="#1b5e20" sx={{ letterSpacing: '0.04em' }}>
                  {regNo}
                </Typography>
              </Box>

              <Paper variant="outlined" sx={{ p: 2.5, mb: 3, textAlign: 'left', bgcolor: '#fafbfe', borderRadius: 3 }}>
                <Typography variant="subtitle2" fontWeight={900} gutterBottom>
                  Registration & payment summary
                </Typography>
                <Divider sx={{ mb: 1 }} />
                <Stack divider={<Divider sx={{ my: 0.75 }} />}>
                  {summaryRows.map(([label, value]) => (
                    <Stack key={label} direction="row" justifyContent="space-between" gap={2} sx={{ py: 0.5 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
                        {label}
                      </Typography>
                      <Typography variant="body2" fontWeight={700} textAlign="right">
                        {value}
                      </Typography>
                    </Stack>
                  ))}
                  <Stack direction="row" justifyContent="space-between" gap={2} sx={{ py: 0.5 }}>
                    <Typography variant="body2" fontWeight={800}>
                      Amount paid
                    </Typography>
                    <Typography variant="body2" fontWeight={800} color="success.main">
                      ${total.toFixed(2)} USD (Stripe)
                    </Typography>
                  </Stack>
                </Stack>
              </Paper>

              <Alert
                severity="warning"
                icon={<PolicyIcon fontSize="small" />}
                sx={{
                  mb: 3,
                  textAlign: 'left',
                  bgcolor: '#fff9e6',
                  color: '#3e2723',
                  border: '1px solid #ffe082',
                }}
              >
                <Typography variant="subtitle2" fontWeight={800} gutterBottom>
                  Registration policy acknowledged
                </Typography>
                <Typography variant="body2">
                  {DISPATCHER_POLICY_TEXT}
                </Typography>
              </Alert>

              <Alert severity="success" sx={{ mb: 3, textAlign: 'left' }}>
                {isMock
                  ? 'This was a demo registration. In live mode, a confirmation email is dispatched via Resend and visible to staff in the admin dashboard.'
                  : 'A formal confirmation email has been sent to your inbox. Our admissions team will contact you with course access and materials prior to start.'}
              </Alert>

              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="center" gap={1.5}>
                <Button
                  variant="outlined"
                  onClick={() => window.print()}
                  startIcon={<PrintIcon />}
                >
                  Print confirmation
                </Button>
                <Button component={Link} to="/" variant="contained" color="secondary">
                  Return to home
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Container>
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7fb', py: { xs: 4, md: 6 } }}>
      <Container maxWidth="md">
        {header}
        {stepper}

        {state === 'review' ? (
          <Paper sx={{ p: { xs: 3, md: 5 }, borderRadius: 4, boxShadow: '0 12px 35px rgba(8,8,95,.06)' }}>
            <Typography variant="h5" fontWeight={900}>
              Review your registration
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              Please verify your information and accept the required policy before proceeding to payment.
            </Typography>

            {paymentError && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {paymentError}
              </Alert>
            )}

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: '100%' }}>
                  <SectionHeading icon={<SchoolIcon color="secondary" fontSize="small" />} title="Selected class" />
                  <Typography variant="body2" fontWeight={700}>{selectedClass?.name || 'Dispatcher Training'}</Typography>
                  {selectedClass?.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                      {selectedClass.description}
                    </Typography>
                  )}
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2.5, pt: 1.5, borderTop: '1px dashed', borderColor: 'divider' }}>
                    <Typography fontWeight={800} variant="body2">Tuition / total due</Typography>
                    <Typography variant="h6" fontWeight={950} color="secondary.main">${price.toFixed(2)}</Typography>
                  </Stack>
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: '100%' }}>
                  <SectionHeading icon={<PersonIcon color="secondary" fontSize="small" />} title="Registrant information" />
                  <Stack spacing={0.5}>
                    <Typography variant="body2"><strong>Name:</strong> {formData.firstName} {formData.lastName}</Typography>
                    <Typography variant="body2"><strong>Email:</strong> {formData.email}</Typography>
                    <Typography variant="body2"><strong>Phone:</strong> {formData.phone || '—'}</Typography>
                    <Typography variant="body2"><strong>Address:</strong> {formData.address1}{formData.address2 ? `, ${formData.address2}` : ''}</Typography>
                    <Typography variant="body2"><strong>City / state / ZIP:</strong> {formData.city}, {formData.state} {formData.zip}</Typography>
                  </Stack>
                </Paper>
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Stack spacing={2.5}>
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
                sx={{ py: 1.75, fontSize: '1.05rem', fontWeight: 800 }}
                startIcon={paymentLoading ? <CircularProgress size={20} color="inherit" /> : undefined}
              >
                {paymentLoading ? 'Connecting to Stripe...' : `Proceed to Stripe Payment ($${price.toFixed(2)})`}
              </Button>

              <Button
                variant="outlined"
                fullWidth
                onClick={editRegistration}
                disabled={paymentLoading}
                startIcon={<EditIcon />}
              >
                Edit registration information
              </Button>
            </Stack>
          </Paper>
        ) : (
          <Paper sx={{ p: { xs: 3, md: 5 }, borderRadius: 4, boxShadow: '0 12px 35px rgba(8,8,95,.06)' }}>
            <Typography variant="h5" fontWeight={900}>
              Register for Dispatcher Class
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2.5 }}>
              Complete the form below to register for certification training. You'll review your information and policy agreement before paying.
            </Typography>

            <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>
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
              <Stack spacing={2.5}>
                <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
                  <SectionHeading icon={<PersonIcon color="secondary" fontSize="small" />} title="Personal information" />
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        fullWidth
                        size="small"
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
                        size="small"
                        label="Last name"
                        value={formData.lastName}
                        onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                        required
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        fullWidth
                        size="small"
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
                        size="small"
                        label="Phone"
                        type="tel"
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </Grid>
                  </Grid>
                </Paper>

                <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
                  <SectionHeading icon={<HomeIcon color="secondary" fontSize="small" />} title="Mailing address" />
                  <Grid container spacing={2}>
                    <Grid size={12}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Address"
                        value={formData.address1}
                        onChange={e => setFormData({ ...formData, address1: e.target.value })}
                        required
                      />
                    </Grid>
                    <Grid size={12}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Address line 2 (optional)"
                        value={formData.address2}
                        onChange={e => setFormData({ ...formData, address2: e.target.value })}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 5 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="City"
                        value={formData.city}
                        onChange={e => setFormData({ ...formData, city: e.target.value })}
                        required
                      />
                    </Grid>
                    <Grid size={{ xs: 6, md: 3 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="State"
                        value={formData.state}
                        onChange={e => setFormData({ ...formData, state: e.target.value })}
                        required
                      />
                    </Grid>
                    <Grid size={{ xs: 6, md: 4 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="ZIP code"
                        value={formData.zip}
                        onChange={e => setFormData({ ...formData, zip: e.target.value })}
                        required
                      />
                    </Grid>
                  </Grid>
                </Paper>

                <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
                  <SectionHeading icon={<SchoolIcon color="secondary" fontSize="small" />} title="Class selection" />
                  <FormControl fullWidth required size="small">
                    <InputLabel>Dispatcher class</InputLabel>
                    <Select
                      value={formData.classId}
                      onChange={e => setFormData({ ...formData, classId: e.target.value })}
                      label="Dispatcher class"
                    >
                      {classes.map(c => (
                        <MenuItem key={c.id} value={c.id}>
                          {c.name} — ${(c.price_cents != null ? c.price_cents / 100 : 520).toFixed(2)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Paper>

                <Button
                  type="submit"
                  variant="contained"
                  color="secondary"
                  size="large"
                  fullWidth
                  disabled={state === 'saving'}
                  sx={{ py: 1.75, fontSize: '1.05rem', fontWeight: 700 }}
                >
                  {state === 'saving' ? 'Saving Registration...' : 'Continue to Review & Policy Agreement'}
                </Button>
              </Stack>
            </form>
          </Paper>
        )}
      </Container>
    </Box>
  )
}

export default DispatcherRegistration
