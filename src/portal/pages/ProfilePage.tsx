import { useEffect, useState } from 'react'
import { Alert, Button, Grid, MenuItem, Snackbar, Stack, TextField, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getMyStudent, toMessage, updateMyDisplayName, updateMyStudent, type StudentProfile } from '../api'
import { fieldErrors, licenseSchema, newPasswordSchema, profileSchema, US_STATES } from '../schemas'
import { PortalLoading } from '../RequireStudent'
import { PageHeader, SectionCard } from '../ui'

type ProfileForm = {
  firstName: string; lastName: string; email: string; phone: string; dateOfBirth: string
  addressLine1: string; addressLine2: string; city: string; state: string; zipCode: string
  licenseType: string; licenseNumber: string; licenseState: string
}

function toForm(s: StudentProfile, fallbackEmail: string): ProfileForm {
  return {
    firstName: s.first_name ?? '', lastName: s.last_name ?? '', email: s.email || fallbackEmail, phone: s.phone ?? '',
    dateOfBirth: s.date_of_birth ?? '', addressLine1: s.address_line1 ?? '', addressLine2: s.address_line2 ?? '',
    city: s.city ?? '', state: s.state ?? '', zipCode: s.zip_code ?? '',
    licenseType: s.license_type ?? '', licenseNumber: s.license_number ?? '', licenseState: s.license_state ?? '',
  }
}

export function ProfilePage() {
  const navigate = useNavigate()
  const { session, refreshProfile, updatePassword, signOut } = useAuth()
  const [form, setForm] = useState<ProfileForm | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [pw, setPw] = useState({ password: '', confirmPassword: '' })
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({})
  const [pwError, setPwError] = useState('')
  const [pwSaving, setPwSaving] = useState(false)

  useEffect(() => {
    getMyStudent()
      .then(s => s ? setForm(toForm(s, session?.user.email ?? '')) : setError('We couldn\'t find your student profile. Please contact admissions.'))
      .catch(err => setError(toMessage(err)))
  }, [session?.user.email])

  if (error && !form) return <Alert severity="error">{error}</Alert>
  if (!form) return <PortalLoading />

  const set = (key: keyof ProfileForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setForm(f => f && ({ ...f, [key]: value }))
    setErrors(er => ({ ...er, [key]: '' }))
  }
  const err = (key: string) => ({ error: Boolean(errors[key]), helperText: errors[key] || undefined })

  const save = async () => {
    setError('')
    const profile = profileSchema.safeParse(form)
    const license = licenseSchema.safeParse(form)
    const found = { ...(profile.success ? {} : fieldErrors(profile.error)), ...(license.success ? {} : fieldErrors(license.error)) }
    if (!profile.success || !license.success) {
      setErrors(found)
      setError('Please fix the highlighted fields.')
      return
    }
    setSaving(true)
    try {
      const p = profile.data
      const l = license.data
      await updateMyStudent({
        first_name: p.firstName, last_name: p.lastName, email: p.email, phone: p.phone, date_of_birth: p.dateOfBirth,
        address_line1: p.addressLine1, address_line2: p.addressLine2 || null, city: p.city, state: p.state, zip_code: p.zipCode,
        license_type: l.licenseType, license_number: l.licenseNumber || null, license_state: l.licenseState || null,
      })
      await updateMyDisplayName(`${p.firstName} ${p.lastName}`)
      await refreshProfile()
      setToast('Profile saved. New applications will use these details.')
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async () => {
    setPwError('')
    const parsed = newPasswordSchema.safeParse(pw)
    if (!parsed.success) return setPwErrors(fieldErrors(parsed.error))
    setPwSaving(true)
    const message = await updatePassword(parsed.data.password)
    setPwSaving(false)
    if (message) return setPwError(message)
    setPw({ password: '', confirmPassword: '' })
    setToast('Password updated.')
  }

  const stateField = (key: 'state' | 'licenseState', label: string) => (
    <TextField select fullWidth label={label} value={form[key]} onChange={set(key)} {...err(key)}>
      {US_STATES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
    </TextField>
  )

  return (
    <>
      <PageHeader title="Profile & account" subtitle="Saved once, filled into every application for you." />
      <Stack spacing={3}>
        <SectionCard title="Personal information">
          {error && <Alert severity="error" sx={{ mb: 2 }} role="alert">{error}</Alert>}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="First name" value={form.firstName} onChange={set('firstName')} autoComplete="given-name" {...err('firstName')} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Last name" value={form.lastName} onChange={set('lastName')} autoComplete="family-name" {...err('lastName')} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth type="email" label="Contact email" value={form.email} onChange={set('email')} autoComplete="email" {...err('email')} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth type="tel" label="Phone" value={form.phone} onChange={set('phone')} autoComplete="tel" {...err('phone')} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth type="date" label="Date of birth" value={form.dateOfBirth} onChange={set('dateOfBirth')}
                slotProps={{ inputLabel: { shrink: true } }} {...err('dateOfBirth')} />
            </Grid>
            <Grid size={12}><TextField fullWidth label="Street address" value={form.addressLine1} onChange={set('addressLine1')} autoComplete="address-line1" {...err('addressLine1')} /></Grid>
            <Grid size={12}><TextField fullWidth label="Apartment, suite, etc. (optional)" value={form.addressLine2} onChange={set('addressLine2')} autoComplete="address-line2" /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="City" value={form.city} onChange={set('city')} autoComplete="address-level2" {...err('city')} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}>{stateField('state', 'State')}</Grid>
            <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth label="ZIP code" value={form.zipCode} onChange={set('zipCode')} autoComplete="postal-code" {...err('zipCode')} /></Grid>
          </Grid>

          <Typography fontWeight={900} sx={{ mt: 4, mb: 2 }}>Current license</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField select fullWidth label="License type" value={form.licenseType} onChange={set('licenseType')} {...err('licenseType')}>
                <MenuItem value="REGULAR">Regular driver's license</MenuItem>
                <MenuItem value="CLP">CLP</MenuItem>
                <MenuItem value="CDL">CDL</MenuItem>
                <MenuItem value="NONE">No license yet</MenuItem>
              </TextField>
            </Grid>
            {form.licenseType && form.licenseType !== 'NONE' && (
              <>
                <Grid size={{ xs: 12, sm: 5 }}><TextField fullWidth label="License number" value={form.licenseNumber} onChange={set('licenseNumber')} {...err('licenseNumber')} /></Grid>
                <Grid size={{ xs: 12, sm: 3 }}>{stateField('licenseState', 'Issuing state')}</Grid>
              </>
            )}
          </Grid>
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 3 }}>
            <Button variant="contained" color="secondary" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</Button>
          </Stack>
        </SectionCard>

        <SectionCard title="Account">
          <Typography color="text.secondary">Sign-in email</Typography>
          <Typography fontWeight={800} sx={{ mb: 3, wordBreak: 'break-all' }}>{session?.user.email}</Typography>
          <Typography fontWeight={900} sx={{ mb: 2 }}>Change password</Typography>
          {pwError && <Alert severity="error" sx={{ mb: 2 }}>{pwError}</Alert>}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth type="password" label="New password" autoComplete="new-password" value={pw.password}
                onChange={e => { setPw(p => ({ ...p, password: e.target.value })); setPwErrors({}) }}
                error={Boolean(pwErrors.password)} helperText={pwErrors.password || 'At least 10 characters'} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth type="password" label="Confirm new password" autoComplete="new-password" value={pw.confirmPassword}
                onChange={e => { setPw(p => ({ ...p, confirmPassword: e.target.value })); setPwErrors({}) }}
                error={Boolean(pwErrors.confirmPassword)} helperText={pwErrors.confirmPassword} />
            </Grid>
          </Grid>
          <Stack direction={{ xs: 'column-reverse', sm: 'row' }} justifyContent="space-between" spacing={1.5} sx={{ mt: 3 }}>
            <Button color="inherit" onClick={() => void signOut().then(() => navigate('/portal/sign-in', { replace: true }))}>Log out</Button>
            <Button variant="outlined" onClick={() => void changePassword()} disabled={pwSaving}>{pwSaving ? 'Updating…' : 'Update password'}</Button>
          </Stack>
        </SectionCard>
      </Stack>
      <Snackbar open={Boolean(toast)} autoHideDuration={4000} onClose={() => setToast('')} message={toast} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </>
  )
}
