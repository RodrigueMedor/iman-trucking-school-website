import { useEffect, useState } from 'react'
import { Alert, Box, Button, Paper, Stack, Step, StepContent, StepLabel, Stepper, Typography } from '@mui/material'
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded'
import { Link, Navigate, useParams } from 'react-router-dom'
import { getApplication, startApplicationCheckout, toMessage, type Application } from '../api'
import { TYPE_LABEL } from '../model'
import { PayFeeDialog } from '../PayFeeDialog'
import { PortalLoading } from '../RequireStudent'
import { cardSx, NAVY } from '../ui'

const DEFAULT_FEE_CENTS = 2500

export function Confirmation() {
  const { id = '' } = useParams()
  const [app, setApp] = useState<Application | null | undefined>(undefined)
  const [error, setError] = useState('')
  const [payOpen, setPayOpen] = useState(false)

  useEffect(() => {
    getApplication(id).then(setApp).catch(err => setError(toMessage(err)))
  }, [id])

  if (error) return <Alert severity="error">{error}</Alert>
  if (app === undefined) return <PortalLoading />
  if (app === null) return <Alert severity="error">We couldn't find that application.</Alert>
  if (app.status === 'DRAFT') {
    return <Navigate to={`/portal/apply/${app.application_type === 'TRAINING' ? 'training' : 'assessment'}`} replace />
  }

  const feeCents = Number(app.course?.application_fee_cents) > 0 ? Number(app.course!.application_fee_cents) : DEFAULT_FEE_CENTS
  const fee = `$${(feeCents / 100).toFixed(2)}`
  const paid = app.payment_status === 'paid'
  const nextSteps = app.application_type === 'TRAINING'
    ? [
        ['Admissions reviews your application', 'Usually within 1–2 business days. We may contact you by phone or email.'],
        ['We confirm your start date', 'Once approved, your class schedule and location appear in your portal.'],
        ['Start training', 'Bring your license or CLP on your first day.'],
      ]
    : [
        ['Admissions reviews your request and test', 'Usually within 1–2 business days.'],
        ['We schedule your assessment', 'Your date, time and location appear in your portal.'],
        ['Attend your assessment', 'Bring your license or CLP to the training yard.'],
      ]

  return (
    <Stack spacing={3} sx={{ maxWidth: 760, mx: 'auto' }}>
      <Paper elevation={0} sx={{ ...cardSx, p: { xs: 3, md: 5 }, textAlign: 'center' }}>
        <CheckCircleRounded sx={{ fontSize: 64, color: 'success.main' }} />
        <Typography component="h1" variant="h4" fontWeight={900} color={NAVY} sx={{ mt: 1 }}>
          Application submitted
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Thank you, {app.first_name}. We received your {TYPE_LABEL[app.application_type]} application.
        </Typography>
        <Box sx={{ display: 'inline-block', mt: 3, px: 3, py: 1.5, borderRadius: 2, bgcolor: '#f3f6fa', border: 1, borderColor: 'divider' }}>
          <Typography variant="overline" color="text.secondary" fontWeight={800}>Reference number</Typography>
          <Typography fontSize={26} fontWeight={900} letterSpacing=".04em" color={NAVY}>{app.reference_no}</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          A copy is saved in your portal. Use this number if you contact admissions.
        </Typography>
      </Paper>

      <Paper elevation={0} sx={{ ...cardSx, p: { xs: 3, md: 4 } }}>
        <Typography component="h2" variant="h6" fontWeight={900} sx={{ mb: 2 }}>What happens next</Typography>
        <Stepper orientation="vertical" activeStep={0}>
          {nextSteps.map(([title, body]) => (
            <Step key={title} expanded>
              <StepLabel><Typography fontWeight={800}>{title}</Typography></StepLabel>
              <StepContent><Typography color="text.secondary">{body}</Typography></StepContent>
            </Step>
          ))}
        </Stepper>
      </Paper>

      {!paid && (
        <Paper elevation={0} sx={{ ...cardSx, p: { xs: 3, md: 4 } }}>
          <Typography component="h2" variant="h6" fontWeight={900}>Application fee (optional now)</Typography>
          <Typography color="text.secondary" sx={{ mt: 1, mb: 2 }}>
            You can pay the {fee} application fee now to speed things up, or later from your application page.
          </Typography>
          <Button variant="outlined" color="secondary" onClick={() => setPayOpen(true)}
            disabled={app.payment_status === 'processing'}>
            {app.payment_status === 'processing' ? 'Payment processing' : `Pay ${fee} now`}
          </Button>
        </Paper>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center">
        <Button component={Link} to="/portal/" variant="contained" color="secondary" size="large">Go to my dashboard</Button>
        <Button component={Link} to={`/portal/applications/${app.id}`} variant="outlined" size="large">Track this application</Button>
      </Stack>

      <PayFeeDialog
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title={`Pay the ${fee} application fee`}
        description="You'll be taken to Stripe's secure checkout and brought back to your application afterwards."
        firstName={app.first_name}
        lastName={app.last_name}
        onPay={(accepted, signature) => startApplicationCheckout(app.id, accepted, signature)}
      />
    </Stack>
  )
}
