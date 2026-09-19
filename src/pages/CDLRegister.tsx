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
  CircularProgress,
} from '@mui/material'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { createRegistrationCheckout } from '../lib/stripe'
import { PaymentPolicyAgreement } from '../components/PaymentPolicyAgreement'
import { isPaymentPolicySigned } from '../lib/paymentPolicy'

export function CDLRegister() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [paymentRequired, setPaymentRequired] = useState(false)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [paymentPolicyAccepted, setPaymentPolicyAccepted] = useState(false)
  const [paymentPolicySignature, setPaymentPolicySignature] = useState('')
  const [registeredStudent, setRegisteredStudent] = useState<any>(null)
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
            first_name: formData.firstName,
            last_name: formData.lastName,
            full_name: `${formData.firstName} ${formData.lastName}`,
            role: 'student',
          },
        },
      })

      if (signUpError) throw signUpError

      if (!data.user) throw new Error('Supabase did not return the new student account.')

      // Get the student record created by auth trigger
      const { data: studentData, error: studentError } = await supabase
        .from('cdl_students')
        .select('id')
        .eq('user_id', data.user.id)
        .single()

      if (studentError || !studentData) {
        console.error('Error fetching student record:', studentError)
        throw new Error('Failed to retrieve student record')
      }

      setRegisteredStudent(studentData)
      setLoading(false)
      setPaymentRequired(true)
    } catch (err: any) {
      setError(err.message || 'Failed to create account')
      setLoading(false)
    }
  }

  async function handlePayment() {
    if (!registeredStudent) return
    if (!isPaymentPolicySigned(paymentPolicyAccepted, paymentPolicySignature, formData.firstName, formData.lastName)) {
      setPaymentError('Read the payment policy, check the box, and type your full legal name to sign before paying.')
      return
    }

    setPaymentLoading(true)
    setPaymentError('')

    try {
      await createRegistrationCheckout(
        registeredStudent.id,
        formData.email,
        formData.firstName,
        formData.lastName,
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
    navigate('/cdl-readiness')
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

            {!paymentRequired ? (
              <>
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
              </>
            ) : (
              <>
                <CheckCircleIcon sx={{ fontSize: 64, color: '#4caf50', mb: 3 }} />
                <Typography variant="h3" fontWeight={900} gutterBottom>
                  Account Created Successfully!
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 4 }}>
                  Welcome, {formData.firstName}! Your account has been created. You can now complete your registration by paying the registration fee or proceed directly to the assessment.
                </Typography>

                {paymentError && (
                  <Alert severity="error" sx={{ mb: 3 }}>
                    {paymentError}
                  </Alert>
                )}

                <Stack spacing={2} sx={{ mb: 4, textAlign: 'left' }}>
                  <Alert severity="info">
                    <Typography fontWeight="bold">Registration Fee: $50.00</Typography>
                    <Typography variant="body2">Complete your registration with a secure payment after signing the policy below.</Typography>
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
                    {paymentLoading ? 'Processing...' : 'Pay Registration Fee ($50.00)'}
                  </Button>
                  <Button
                    variant="outlined"
                    size="large"
                    fullWidth
                    onClick={skipPayment}
                    sx={{ py: 2 }}
                  >
                    Skip Payment & Start Assessment
                  </Button>
                </Stack>
              </>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  )
}
