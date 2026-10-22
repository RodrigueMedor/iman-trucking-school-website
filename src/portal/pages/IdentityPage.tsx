import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Box, Button, Checkbox, Chip, Collapse, FormControlLabel, LinearProgress, Paper, Radio, RadioGroup, Stack, TextField, Typography } from '@mui/material'
import BadgeRounded from '@mui/icons-material/BadgeRounded'
import CameraAltRounded from '@mui/icons-material/CameraAltRounded'
import FaceRounded from '@mui/icons-material/FaceRounded'
import VerifiedUserRounded from '@mui/icons-material/VerifiedUserRounded'
import { Link, useSearchParams } from 'react-router-dom'
import { getMyIdentity, requestAlternativeVerification, startIdentityVerification, toMessage, type IdentityDocumentType, type MyIdentity } from '../api'
import { cardSx, formatDateTime, NAVY, PageHeader } from '../ui'
import { IDENTITY_STATUS } from '../IdentityNotice'
import { CameraCheck } from '../CameraCheck'

const DOCUMENTS: { value: IdentityDocumentType; label: string; hint: string }[] = [
  { value: 'DRIVING_LICENSE', label: "Driver's License", hint: 'A US state-issued driver’s license that has not expired.' },
  { value: 'GREEN_CARD', label: 'Green Card', hint: 'Your US Permanent Resident Card that has not expired.' },
]

/** Identity verification: document front and back plus a live selfie, through Stripe Identity. */
export function IdentityPage() {
  const [params] = useSearchParams()
  const [identity, setIdentity] = useState<MyIdentity | null>(null)
  const [documentType, setDocumentType] = useState<IdentityDocumentType | ''>('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [alternativeOpen, setAlternativeOpen] = useState(false)
  const [alternativeNote, setAlternativeNote] = useState('')
  const polls = useRef(0)

  const load = useCallback(async () => {
    try {
      const result = await getMyIdentity()
      setIdentity(result)
      if (result.verification?.document_type && !documentType) setDocumentType(result.verification.document_type)
      return result
    } catch (err) {
      setError(toMessage(err))
      return null
    }
  }, [documentType])

  // Back from Stripe: results usually arrive within seconds, so check a few times.
  const returned = params.get('identity') === 'returned'
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = async () => {
      const result = await load()
      if (returned && result?.status === 'PENDING' && polls.current < 12) {
        polls.current += 1
        timer = setTimeout(() => void tick(), 5000)
      }
    }
    void tick()
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returned])

  const start = async () => {
    if (!documentType || !consent) return
    setBusy(true); setError('')
    try {
      const { url } = await startIdentityVerification(documentType)
      window.location.assign(url)
    } catch (err) {
      setError(toMessage(err)); setBusy(false)
    }
  }

  const requestAlternative = async () => {
    if (!documentType) return setError('Choose the document you will bring to the school.')
    setBusy(true); setError('')
    try {
      setIdentity(await requestAlternativeVerification(documentType, alternativeNote.trim() || undefined))
      setAlternativeOpen(false)
    } catch (err) {
      setError(toMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const status = identity?.status || 'NOT_STARTED'
  const verification = identity?.verification
  const processing = status === 'PENDING' && !identity?.canStart
  const canStart = ['NOT_STARTED', 'FAILED'].includes(status) || (status === 'PENDING' && !!identity?.canStart)

  return <>
    <PageHeader title="Identity verification" subtitle="Verify your identity once before you submit a training or assessment application. It takes about two minutes." />
    {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}
    {!identity ? <LinearProgress /> : <Stack spacing={3}>
      <Paper elevation={0} sx={{ ...cardSx, p: { xs: 2.5, md: 3.5 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2} alignItems={{ sm: 'center' }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ width: 44, height: 44, borderRadius: 2.5, display: 'grid', placeItems: 'center', bgcolor: 'rgba(8,8,95,.08)', color: NAVY }}><VerifiedUserRounded /></Box>
            <Box>
              <Typography component="h2" variant="h6" fontWeight={950} color={NAVY}>Your verification status</Typography>
              {verification && <Typography variant="body2" color="text.secondary">{verification.method === 'EXEMPT' ? 'Existing student' : DOCUMENTS.find(item => item.value === verification.document_type)?.label} · updated {formatDateTime(verification.updated_at)}</Typography>}
            </Box>
          </Stack>
          <Chip label={IDENTITY_STATUS[status].label} color={IDENTITY_STATUS[status].color} sx={{ alignSelf: { xs: 'flex-start', sm: 'center' }, fontWeight: 800 }} />
        </Stack>

        <Box mt={2.5} aria-live="polite">
          {status === 'VERIFIED' && <Alert severity="success" action={<Button component={Link} to="/portal/apply/training" color="inherit" size="small">Continue enrollment</Button>}>
            Your identity is verified. You can submit your training or assessment application.
          </Alert>}
          {processing && <Alert severity="info" action={<Button color="inherit" size="small" onClick={() => void load()}>Refresh</Button>}>
            We're checking your document and selfie. This usually takes less than a minute.
          </Alert>}
          {status === 'FAILED' && verification && <Alert severity="error">{verification.failure_reason || 'Verification did not succeed.'} You can try again below.</Alert>}
          {status === 'MANUAL_REVIEW' && verification && <Alert severity="warning">
            {verification.method === 'ALTERNATIVE'
              ? <>Bring your {DOCUMENTS.find(item => item.value === verification.document_type)?.label.toLowerCase()} to the IMAN Trucking School office. Admissions will verify it in person and update your status.</>
              : <>Admissions is reviewing your verification. We'll contact you if anything else is needed.</>}
          </Alert>}
          {status === 'NOT_STARTED' && <Typography color="text.secondary">You haven't verified your identity yet.</Typography>}
        </Box>
      </Paper>

      {canStart && <Paper elevation={0} sx={{ ...cardSx, p: { xs: 2.5, md: 3.5 } }}>
        <Typography component="h2" variant="h6" fontWeight={950} color={NAVY} mb={2}>{status === 'FAILED' ? 'Try again' : 'Verify with your camera'}</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1.5, mb: 3 }}>
          {[[<BadgeRounded key="d" />, '1. Choose your document'], [<CameraAltRounded key="c" />, '2. Photograph the front and back'], [<FaceRounded key="f" />, '3. Take a live selfie']].map(([icon, text]) =>
            <Stack key={text as string} direction="row" spacing={1} alignItems="center" sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f5f5f8', color: NAVY }}>{icon}<Typography variant="body2" fontWeight={800}>{text}</Typography></Stack>)}
        </Box>

        <Typography id="identity-document" fontWeight={900} mb={1}>Which document will you use?</Typography>
        <RadioGroup aria-labelledby="identity-document" value={documentType} onChange={event => setDocumentType(event.target.value as IdentityDocumentType)} sx={{ gap: 1, mb: 3 }}>
          {DOCUMENTS.map(item => <FormControlLabel key={item.value} value={item.value} control={<Radio />} disabled={busy}
            sx={{ m: 0, border: 2, borderColor: documentType === item.value ? 'primary.main' : 'divider', borderRadius: 2, pr: 2, py: 0.5 }}
            label={<Box><Typography fontWeight={850}>{item.label}</Typography><Typography variant="body2" color="text.secondary">{item.hint}</Typography></Box>} />)}
        </RadioGroup>

        <Box sx={{ mb: 3 }}><CameraCheck /></Box>

        <Box sx={{ p: 2, borderRadius: 2, bgcolor: '#f5f5f8', mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={900} mb={0.75}>Biometric consent</Typography>
          <Typography variant="body2" color="text.secondary" lineHeight={1.7}>
            To confirm you are the person on your document, IMAN Trucking School uses Stripe Identity. Stripe will capture images of the front and back of
            your document and a live selfie, and compare your face to the document photo using facial geometry. IMAN Trucking School keeps an encrypted copy
            of your document images, your selfie, your date of birth and your document number to verify your enrollment. Only the school director can view
            them, every view is recorded, and they are deleted 30 days after your verification is decided. IMAN does not receive or keep facial geometry.
            Stripe deletes its copy of your images 30 days after the decision and may keep the facial data it derives for up to one year to prevent fraud.
            You may instead verify in person at the school (below).
          </Typography>
        </Box>
        <FormControlLabel sx={{ mb: 2, alignItems: 'flex-start' }} control={<Checkbox checked={consent} onChange={event => setConsent(event.target.checked)} disabled={busy} sx={{ mt: -0.75 }} />}
          label={<Typography fontWeight={700}>I consent to Stripe collecting and comparing my document images and selfie, including biometric facial data, and to IMAN Trucking School keeping an encrypted copy of my images, date of birth and document number for 30 days after the decision, to verify my identity.</Typography>} />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
          <Button variant="contained" color="secondary" size="large" startIcon={<CameraAltRounded />} disabled={!documentType || !consent || busy} onClick={() => void start()} sx={{ minHeight: 48 }}>
            {busy ? 'Opening secure verification…' : status === 'FAILED' ? 'Retake verification' : 'Start verification'}
          </Button>
          <Typography variant="body2" color="text.secondary">Stripe's secure page opens your camera, scans the front and back of your card automatically, then takes a live selfie. On a computer without a camera, you'll get a code to continue on your phone.</Typography>
        </Stack>
      </Paper>}

      {(canStart || processing) && <Paper elevation={0} sx={{ ...cardSx, p: { xs: 2.5, md: 3.5 } }}>
        <Button onClick={() => setAlternativeOpen(open => !open)} aria-expanded={alternativeOpen} sx={{ px: 0, fontWeight: 900 }}>Can't use a camera or complete the selfie?</Button>
        <Collapse in={alternativeOpen}>
          <Typography color="text.secondary" mt={1} mb={2}>Request in-person verification instead. Choose your document above, then bring it to the school office; admissions will check it and update your status. No selfie or biometric data is used.</Typography>
          <TextField fullWidth multiline minRows={2} label="Anything we should know? (optional)" value={alternativeNote} onChange={event => setAlternativeNote(event.target.value)} inputProps={{ maxLength: 500 }} sx={{ mb: 2 }} />
          <Button variant="outlined" disabled={busy || !documentType} onClick={() => void requestAlternative()}>Request in-person verification</Button>
          {!documentType && <Typography variant="body2" color="text.secondary" mt={1}>Choose your document first.</Typography>}
        </Collapse>
      </Paper>}

    </Stack>}
  </>
}
