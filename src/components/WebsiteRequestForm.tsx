import { useState, type FormEvent } from 'react'
import { Alert, Box, Button, Card, Checkbox, Container, FormControlLabel, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import { useLocation } from 'react-router-dom'
import { getApiUrl } from '../lib/api'
import {
  CAREER_POSITIONS,
  COMPLAINANT_STATUSES,
  ELDT_PARTS,
  parseWebsiteRequest,
  type RequestType,
} from '../../shared/websiteRequests.mjs'

const copy: Record<RequestType, { title: string; intro: string; message: string }> = {
  GRADUATE_VERIFICATION: {
    title: 'Request a verification online',
    intro: 'Send the details below and admissions will follow up by email. We may ask for the graduate’s written permission before sharing training records.',
    message: 'What do you need verified?',
  },
  STUDENT_COMPLAINT: {
    title: 'Submit a concern',
    intro: 'Tell us what happened. Admissions reviews every submission and contacts you about next steps.',
    message: 'Describe the issue, including dates and who was involved',
  },
  CAREERS: {
    title: 'Ask about working at Iman',
    intro: 'Tell us about yourself and the role you are interested in. We will contact you if there is a fit.',
    message: 'Tell us about your experience',
  },
  ELDT_TRANSFER: {
    title: 'Ask about prior training',
    intro: 'Tell us about the training you completed. Admissions will explain how it affects your training plan at Iman.',
    message: 'Anything else we should know?',
  },
}

const emptyDetails: Record<RequestType, Record<string, string | boolean>> = {
  GRADUATE_VERIFICATION: { organization: '', graduateName: '', trainingDates: '', hasGraduateRelease: false },
  STUDENT_COMPLAINT: { complainantStatus: '', incidentDate: '', desiredOutcome: '' },
  CAREERS: { position: '', cdlClass: '', yearsExperience: '' },
  ELDT_TRANSFER: { providerName: '', completedParts: '', completionDate: '' },
}

/** Online form for a website request. Saved by the API and triaged in Admin → Website requests. */
export function WebsiteRequestForm({ type }: { type: RequestType }) {
  const { pathname } = useLocation()
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', message: '', website: '' })
  const [details, setDetails] = useState(emptyDetails[type])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [reference, setReference] = useState<string | null | undefined>(undefined)

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (event: { target: { value: string } }) => setForm(current => ({ ...current, [key]: event.target.value })),
    error: Boolean(errors[key]),
    helperText: errors[key],
  })
  const detail = (key: string) => ({
    value: String(details[key] ?? ''),
    onChange: (event: { target: { value: string } }) => setDetails(current => ({ ...current, [key]: event.target.value })),
    error: Boolean(errors[`details.${key}`]),
    helperText: errors[`details.${key}`],
  })

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setFailure('')
    const payload = { requestType: type, ...form, details, sourcePage: pathname }
    const parsed = parseWebsiteRequest(payload)
    if (!parsed.success) {
      const next: Record<string, string> = {}
      for (const issue of parsed.error.issues) next[issue.path.join('.')] ||= issue.message
      setErrors(next)
      return
    }
    setErrors({})
    setBusy(true)
    try {
      const response = await fetch(getApiUrl('/api/website-requests'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'We could not send your request.')
      setReference(body.referenceNo ?? null)
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'We could not send your request.')
    } finally {
      setBusy(false)
    }
  }

  const text = copy[type]
  return (
    <Box component="section" id="request-form" aria-labelledby="request-form-title" sx={{ py: { xs: 7, md: 9 }, bgcolor: '#f5f7fa', scrollMarginTop: 110 }}>
      <Container maxWidth="md">
        <Card sx={{ p: { xs: 3, md: 4.5 }, border: '1px solid #e5e8ef', borderRadius: 3, boxShadow: '0 20px 55px rgba(7,26,51,.09)' }}>
          {reference !== undefined ? (
            <Stack spacing={1.5} alignItems="flex-start" role="status">
              <CheckCircleRoundedIcon color="success" sx={{ fontSize: 44 }} />
              <Typography id="request-form-title" component="h2" variant="h4" color="primary.main" fontWeight={950}>Thank you. We received your request.</Typography>
              {reference && <Typography color="text.secondary">Your reference number is <strong>{reference}</strong>. Keep it in case you contact us about this request.</Typography>}
              <Typography color="text.secondary">Admissions will reply by email. For anything urgent, call (888) 991-4776.</Typography>
            </Stack>
          ) : (
            <Box component="form" noValidate onSubmit={submit}>
              <Typography variant="overline" color="secondary.main" fontWeight={900} letterSpacing=".12em">Online request</Typography>
              <Typography id="request-form-title" component="h2" variant="h4" color="primary.main" fontWeight={950} mt={0.5}>{text.title}</Typography>
              <Typography color="text.secondary" mt={1} mb={3}>{text.intro}</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth required label="Your full name" autoComplete="name" {...field('fullName')} /></Grid>
                <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth required type="email" label="Email" autoComplete="email" {...field('email')} /></Grid>
                <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth type="tel" label="Phone (optional)" autoComplete="tel" {...field('phone')} /></Grid>
                {type === 'GRADUATE_VERIFICATION' && <>
                  <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth required label="Your organization" autoComplete="organization" {...detail('organization')} /></Grid>
                  <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth required label="Graduate’s full name" {...detail('graduateName')} /></Grid>
                  <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Approximate training dates (optional)" {...detail('trainingDates')} /></Grid>
                  <Grid size={12}><FormControlLabel control={<Checkbox checked={Boolean(details.hasGraduateRelease)} onChange={event => setDetails(current => ({ ...current, hasGraduateRelease: event.target.checked }))} />} label="I have the graduate’s signed permission to request this information" /></Grid>
                </>}
                {type === 'STUDENT_COMPLAINT' && <>
                  <Grid size={{ xs: 12, sm: 6 }}><TextField select fullWidth required label="I am a" {...detail('complainantStatus')}>{Object.entries(COMPLAINANT_STATUSES).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField></Grid>
                  <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="When did this happen? (optional)" {...detail('incidentDate')} /></Grid>
                </>}
                {type === 'CAREERS' && <>
                  <Grid size={{ xs: 12, sm: 6 }}><TextField select fullWidth required label="Position" {...detail('position')}>{Object.entries(CAREER_POSITIONS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField></Grid>
                  <Grid size={{ xs: 12, sm: 6 }}><TextField select fullWidth label="CDL class you hold (optional)" {...detail('cdlClass')}><MenuItem value="">None</MenuItem>{['A', 'B', 'C'].map(value => <MenuItem key={value} value={value}>Class {value}</MenuItem>)}</TextField></Grid>
                  <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Years of driving or teaching experience (optional)" {...detail('yearsExperience')} /></Grid>
                </>}
                {type === 'ELDT_TRANSFER' && <>
                  <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth required label="Training provider’s name" {...detail('providerName')} /></Grid>
                  <Grid size={{ xs: 12, sm: 6 }}><TextField select fullWidth required label="What did you complete?" {...detail('completedParts')}>{Object.entries(ELDT_PARTS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField></Grid>
                  <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Completion date (optional)" {...detail('completionDate')} /></Grid>
                </>}
                <Grid size={12}><TextField fullWidth required multiline minRows={4} label={text.message} {...field('message')} /></Grid>
                {type === 'STUDENT_COMPLAINT' && <Grid size={12}><TextField fullWidth multiline minRows={2} label="What outcome would resolve this for you? (optional)" {...detail('desiredOutcome')} /></Grid>}
              </Grid>
              {/* Honeypot for bots; hidden from people and assistive technology. */}
              <Box aria-hidden sx={{ position: 'absolute', left: -10000, width: 1, height: 1, overflow: 'hidden' }}>
                <label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={event => setForm(current => ({ ...current, website: event.target.value }))} /></label>
              </Box>
              {failure && <Alert severity="error" sx={{ mt: 2.5 }}>{failure}</Alert>}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} mt={3}>
                <Button type="submit" variant="contained" color="secondary" size="large" disabled={busy} endIcon={<SendRoundedIcon />}>{busy ? 'Sending…' : 'Send request'}</Button>
                <Typography variant="body2" color="text.secondary">We use these details only to respond to this request. See our privacy policy.</Typography>
              </Stack>
            </Box>
          )}
        </Card>
      </Container>
    </Box>
  )
}
