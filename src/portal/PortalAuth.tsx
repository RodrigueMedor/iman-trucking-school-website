import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import {
  Alert, Box, Button, Card, CardContent, Container, Divider, IconButton, InputAdornment, Link as MuiLink,
  Stack, Tab, Tabs, TextField, Typography,
} from '@mui/material'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import ArrowBack from '@mui/icons-material/ArrowBack'
import MarkEmailRead from '@mui/icons-material/MarkEmailRead'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { homeForRole } from '../lib/adminAuth'
import { safeNextPath } from './safeNextPath'
import { fieldErrors, MIN_PASSWORD_LENGTH, newPasswordSchema, signInSchema, signUpSchema, verificationCodeSchema } from './schemas'
import { PortalLoading } from './RequireStudent'

export type PortalAuthMode = 'sign-in' | 'register' | 'verify' | 'forgot' | 'reset'

const pendingEmailKey = 'iman-pending-verification-email'
const resendCooldownSeconds = 60

/** Explains why the visitor is being asked to sign in, based on where they were going. */
function intentFor(next: string) {
  if (next.startsWith('/portal/apply/training') && next.includes('from=financing')) {
    return 'Create or sign in to your IMAN student account first. Begin your CDL Training application, then continue securely to Liberty Career Finance from the program step.'
  }
  if (next.startsWith('/portal/apply/training')) return 'Sign in or create a free account to apply for CDL Training. You can save your application and finish it later.'
  if (next.startsWith('/portal/apply/assessment')) return 'Sign in or create a free account to request a CDL Assessment. You can save your request and finish it later.'
  if (next.startsWith('/portal/documents')) return 'Sign in to upload and view your documents.'
  if (next.startsWith('/portal/applications')) return 'Sign in to track your applications.'
  return null
}

function PasswordField(props: {
  label: string; value: string; onChange: (value: string) => void; error?: string; helperText?: string
  autoComplete: string; name: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <TextField
      fullWidth
      name={props.name}
      label={props.label}
      type={visible ? 'text' : 'password'}
      value={props.value}
      onChange={e => props.onChange(e.target.value)}
      error={Boolean(props.error)}
      helperText={props.error || props.helperText}
      autoComplete={props.autoComplete}
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible(v => !v)} edge="end">
                {visible ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  )
}

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7fb', py: { xs: 3, md: 8 }, px: 2 }}>
      <Container maxWidth="sm" disableGutters>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
          <MuiLink component={Link} to="/" underline="none" aria-label="Iman Trucking School home">
            <Box component="img" src="/images/iman-logo.png" alt="Iman Trucking School" sx={{ height: { xs: 48, md: 56 }, display: 'block', bgcolor: '#08085f', borderRadius: 1.5, p: 0.5 }} />
          </MuiLink>
          <Button component={Link} to="/" startIcon={<ArrowBack />} color="primary" size="small">Back to website</Button>
        </Stack>
        <Card sx={{ boxShadow: '0 25px 50px rgba(8,8,95,.15)', borderRadius: 4 }}>
          <CardContent sx={{ p: { xs: 3, sm: 5 } }}>{children}</CardContent>
        </Card>
      </Container>
    </Box>
  )
}

export function PortalAuth({ mode }: { mode: PortalAuthMode }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNextPath(params.get('next'))
  const { configured, loading, profileReady, session, profile, signIn, signUp, verifyEmail, resendVerification, resetPassword, updatePassword, signOut } = useAuth()

  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<'' | 'confirm-email' | 'reset-sent'>('')
  const [code, setCode] = useState('')
  const [resendIn, setResendIn] = useState(0)
  const [notice, setNotice] = useState('')
  // Staff are sent to the admin dashboard only after signing in on this form,
  // never because an earlier staff session is still open in this browser.
  const [signedInHere, setSignedInHere] = useState(false)

  useEffect(() => {
    if (mode !== 'verify') return
    const pendingEmail = window.sessionStorage.getItem(pendingEmailKey)
    if (pendingEmail) setForm(current => ({ ...current, email: pendingEmail }))
  }, [mode])

  useEffect(() => {
    if (resendIn <= 0) return
    const timer = window.setInterval(() => setResendIn(value => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [resendIn > 0])

  const set = (key: keyof typeof form) => (value: string) => {
    setForm(f => ({ ...f, [key]: value }))
    setErrors(e => ({ ...e, [key]: '' }))
  }

  // Once signed in (here, via an email link, or already), send the visitor on.
  useEffect(() => {
    if (mode === 'reset' || mode === 'verify' || !session || !profileReady || !profile) return
    if (!profile.active) return
    if (profile.role === 'student') navigate(next, { replace: true })
    else if (signedInHere) navigate(homeForRole(profile.role), { replace: true })
  }, [mode, session, profileReady, profile, next, navigate, signedInHere])

  useEffect(() => {
    setErrors({})
    setFormError('')
    setDone('')
  }, [mode])

  if (loading) return <PortalLoading />

  const withNext = (path: string) => `${path}?next=${encodeURIComponent(next)}`
  const intent = intentFor(next)

  async function run(action: () => Promise<void>) {
    setFormError('')
    setBusy(true)
    try {
      await action()
    } finally {
      setBusy(false)
    }
  }

  const onSignIn = (e: FormEvent) => {
    e.preventDefault()
    const parsed = signInSchema.safeParse(form)
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    void run(async () => {
      const message = await signIn(parsed.data.email, parsed.data.password)
      if (!message) setSignedInHere(true)
      if (message) {
        setFormError(message)
        if (/verification code/i.test(message)) {
          window.sessionStorage.setItem(pendingEmailKey, parsed.data.email)
          navigate(withNext('/portal/verify-email'))
        }
      }
    })
  }

  const onRegister = (e: FormEvent) => {
    e.preventDefault()
    const parsed = signUpSchema.safeParse(form)
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    void run(async () => {
      const result = await signUp({
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email: parsed.data.email,
        password: parsed.data.password,
        redirectTo: `${window.location.origin}${withNext('/portal/verify-email')}`,
      })
      if (result.error) setFormError(result.error)
      else if (result.needsConfirmation) {
        window.sessionStorage.setItem(pendingEmailKey, parsed.data.email)
        navigate(withNext('/portal/verify-email'))
      }
    })
  }

  const onVerify = (e: FormEvent) => {
    e.preventDefault()
    const email = signInSchema.shape.email.safeParse(form.email)
    const parsedCode = verificationCodeSchema.safeParse(code)
    const nextErrors: Record<string, string> = {}
    if (!email.success) nextErrors.email = email.error.issues[0]?.message || 'Enter your email address'
    if (!parsedCode.success) nextErrors.code = parsedCode.error.issues[0]?.message || 'Enter the 6-digit code'
    if (!email.success || !parsedCode.success) return setErrors(nextErrors)
    void run(async () => {
      const result = await verifyEmail(email.data, parsedCode.data)
      if (result.error) return setFormError(result.error)
      window.sessionStorage.removeItem(pendingEmailKey)
      navigate(`${withNext('/portal/sign-in')}&verified=1`, { replace: true })
    })
  }

  const onResend = () => {
    const email = signInSchema.shape.email.safeParse(form.email)
    if (!email.success) return setErrors({ email: email.error.issues[0]?.message || 'Enter your email address' })
    void run(async () => {
      const message = await resendVerification(email.data)
      if (message) return setFormError(message)
      window.sessionStorage.setItem(pendingEmailKey, email.data)
      setNotice('A new verification code was sent. It expires in about 10 minutes.')
      setResendIn(resendCooldownSeconds)
    })
  }

  const onForgot = (e: FormEvent) => {
    e.preventDefault()
    const parsed = signInSchema.pick({ email: true }).safeParse(form)
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    void run(async () => {
      const message = await resetPassword(parsed.data.email, `${window.location.origin}/portal/reset-password`)
      if (message) setFormError(message)
      else setDone('reset-sent')
    })
  }

  const onReset = (e: FormEvent) => {
    e.preventDefault()
    const parsed = newPasswordSchema.safeParse(form)
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    void run(async () => {
      const message = await updatePassword(parsed.data.password)
      if (message) setFormError(message)
      else navigate('/portal/', { replace: true })
    })
  }

  if (!configured) {
    return <AuthShell><Alert severity="warning">Student accounts are not available right now. Please contact admissions.</Alert></AuthShell>
  }

  if (mode === 'verify') {
    return (
      <AuthShell>
        <Typography variant="h4" fontWeight={900} gutterBottom>Verify your email</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>Enter the 6-digit code we sent to your email. The code expires in about 10 minutes.</Typography>
        {formError && <Alert severity="error" sx={{ mb: 3 }} role="alert">{formError}</Alert>}
        {notice && <Alert severity="success" sx={{ mb: 3 }}>{notice}</Alert>}
        <Box component="form" noValidate onSubmit={onVerify}>
          <Stack spacing={2.5}>
            <TextField fullWidth required name="email" label="Email" type="email" autoComplete="email" value={form.email}
              onChange={e => set('email')(e.target.value)} error={Boolean(errors.email)} helperText={errors.email} />
            <TextField fullWidth required name="code" label="Verification code" value={code} autoComplete="one-time-code"
              onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setErrors(current => ({ ...current, code: '' })) }}
              error={Boolean(errors.code)} helperText={errors.code} inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 6 }} />
            <Button type="submit" variant="contained" color="secondary" size="large" disabled={busy}>Verify email</Button>
            <Button type="button" variant="outlined" disabled={busy || resendIn > 0} onClick={onResend}>
              {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
            </Button>
            <Button component={Link} to={withNext('/portal/sign-in')}>Back to sign in</Button>
          </Stack>
        </Box>
      </AuthShell>
    )
  }

  if (done) {
    return (
      <AuthShell>
        <Stack spacing={2} alignItems="center" textAlign="center">
          <MarkEmailRead sx={{ fontSize: 56, color: 'secondary.main' }} />
          <Typography variant="h4" fontWeight={900}>Check your email</Typography>
          <Typography color="text.secondary">
            {done === 'confirm-email'
              ? <>We sent a confirmation link to <strong>{form.email}</strong>. Open it to activate your account. You'll come right back here to continue.</>
              : <>If an account exists for <strong>{form.email}</strong>, we sent a link to reset your password.</>}
          </Typography>
          <Button component={Link} to={withNext('/portal/sign-in')} variant="outlined">Back to sign in</Button>
        </Stack>
      </AuthShell>
    )
  }

  if (mode === 'forgot' || mode === 'reset') {
    const resetting = mode === 'reset'
    return (
      <AuthShell>
        <Typography variant="h4" fontWeight={900} gutterBottom>{resetting ? 'Choose a new password' : 'Reset your password'}</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {resetting ? `Use at least ${MIN_PASSWORD_LENGTH} characters.` : "Enter your account email and we'll send you a reset link."}
        </Typography>
        {resetting && !session && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            This reset link has expired or was already used. <MuiLink component={Link} to="/portal/forgot-password">Request a new one</MuiLink>.
          </Alert>
        )}
        {formError && <Alert severity="error" sx={{ mb: 3 }} role="alert">{formError}</Alert>}
        <Box component="form" noValidate onSubmit={resetting ? onReset : onForgot}>
          <Stack spacing={2.5}>
            {resetting ? (
              <>
                <PasswordField name="password" label="New password" value={form.password} onChange={set('password')} error={errors.password} autoComplete="new-password" />
                <PasswordField name="confirmPassword" label="Confirm new password" value={form.confirmPassword} onChange={set('confirmPassword')} error={errors.confirmPassword} autoComplete="new-password" />
              </>
            ) : (
              <TextField fullWidth required name="email" label="Email" type="email" autoComplete="email" value={form.email}
                slotProps={{ htmlInput: { inputMode: 'email', spellCheck: false, maxLength: 254 } }}
                onChange={e => set('email')(e.target.value)} error={Boolean(errors.email)} helperText={errors.email} />
            )}
            <Button type="submit" variant="contained" color="secondary" size="large" disabled={busy || (resetting && !session)} sx={{ py: 1.5 }}>
              {busy ? 'Please wait…' : resetting ? 'Save new password' : 'Send reset link'}
            </Button>
            <Button component={Link} to={withNext('/portal/sign-in')} color="primary">Back to sign in</Button>
          </Stack>
        </Box>
      </AuthShell>
    )
  }

  const registering = mode === 'register'
  if (session && profileReady && profile && profile.active && profile.role !== 'student' && !signedInHere) {
    return (
      <AuthShell>
        <Typography variant="h4" fontWeight={900} gutterBottom>You're signed in as staff</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          This browser is signed in to a staff account{session.user.email ? <> (<strong>{session.user.email}</strong>)</> : null}.
          Sign out to {registering ? 'create a student account' : 'sign in as a student'}.
        </Typography>
        <Stack spacing={2}>
          <Button variant="contained" color="secondary" size="large" disabled={busy} onClick={() => void run(signOut)}>Sign out</Button>
          <Button component={Link} to={homeForRole(profile.role)} variant="outlined">Go to admin dashboard</Button>
        </Stack>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <Typography variant="overline" fontWeight={900} letterSpacing=".12em" color="secondary.main" display="block">
        Student portal
      </Typography>
      <Typography variant="h4" fontWeight={900} gutterBottom>
        {registering ? 'Create your account' : 'Welcome back'}
      </Typography>
      {intent && <Alert severity="info" sx={{ mb: 3 }}>{intent}</Alert>}

      <Tabs
        value={mode}
        onChange={(_, value: PortalAuthMode) => navigate(withNext(value === 'register' ? '/portal/register' : '/portal/sign-in'), { replace: true })}
        variant="fullWidth"
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
        textColor="secondary"
        indicatorColor="secondary"
      >
        <Tab value="sign-in" label="Sign in" />
        <Tab value="register" label="Create account" />
      </Tabs>

      {formError && <Alert severity="error" sx={{ mb: 3 }} role="alert">{formError}</Alert>}
      {mode === 'sign-in' && params.get('verified') === '1' && <Alert severity="success" sx={{ mb: 3 }}>Email verified. Sign in to continue.</Alert>}

      <Box component="form" noValidate onSubmit={registering ? onRegister : onSignIn}>
        <Stack spacing={2.5}>
          {registering && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField fullWidth name="firstName" label="First name" autoComplete="given-name" value={form.firstName}
                onChange={e => set('firstName')(e.target.value)} error={Boolean(errors.firstName)} helperText={errors.firstName} />
              <TextField fullWidth name="lastName" label="Last name" autoComplete="family-name" value={form.lastName}
                onChange={e => set('lastName')(e.target.value)} error={Boolean(errors.lastName)} helperText={errors.lastName} />
            </Stack>
          )}
          <TextField fullWidth required name="email" label="Email" type="email" autoComplete="email" value={form.email}
            slotProps={{ htmlInput: { inputMode: 'email', spellCheck: false, maxLength: 254 } }}
            onChange={e => set('email')(e.target.value)} error={Boolean(errors.email)} helperText={errors.email} />
          <PasswordField name="password" label="Password" value={form.password} onChange={set('password')} error={errors.password}
            helperText={registering ? `At least ${MIN_PASSWORD_LENGTH} characters` : undefined}
            autoComplete={registering ? 'new-password' : 'current-password'} />
          {registering && (
            <PasswordField name="confirmPassword" label="Confirm password" value={form.confirmPassword} onChange={set('confirmPassword')}
              error={errors.confirmPassword} autoComplete="new-password" />
          )}
          {!registering && (
            <MuiLink component={Link} to={withNext('/portal/forgot-password')} alignSelf="flex-end" fontWeight={700} color="primary.light">
              Forgot password?
            </MuiLink>
          )}
          <Button type="submit" variant="contained" color="secondary" size="large" disabled={busy} sx={{ py: 1.5 }}>
            {busy ? 'Please wait…' : registering ? 'Create account' : 'Sign in'}
          </Button>
        </Stack>
      </Box>

      <Divider sx={{ my: 3 }} />
      <Typography textAlign="center" color="text.secondary" variant="body2">
        Just looking? <MuiLink component={Link} to="/cdl-training/" fontWeight={700} color="secondary.main">Explore CDL Training</MuiLink>
        {' · '}
        <MuiLink component={Link} to="/cdl-assessment/" fontWeight={700} color="secondary.main">CDL Assessment</MuiLink>
      </Typography>
    </AuthShell>
  )
}
