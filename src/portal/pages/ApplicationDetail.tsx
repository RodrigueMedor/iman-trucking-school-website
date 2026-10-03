import { useEffect, useState } from 'react'
import {
  Alert, Box, Button, Grid, Paper, Stack, Step, StepLabel, Stepper, Typography,
} from '@mui/material'
import EventAvailableRounded from '@mui/icons-material/EventAvailableRounded'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  getApplication, getElpResult, listDocuments, listEvents, startApplicationCheckout, toMessage,
  type Application, type ApplicationDocument, type ApplicationEvent, type ElpResult,
} from '../api'
import { getPaymentStatus } from '../../lib/stripe'
import { isEditableByStudent, STATUS_META, TYPE_LABEL, type ApplicationStatus } from '../model'
import { StatusChip } from '../StatusChip'
import { DocumentList } from '../DocumentUploader'
import { ElpResultSummary } from '../ElpResultSummary'
import { PayFeeDialog } from '../PayFeeDialog'
import { PortalLoading } from '../RequireStudent'
import { cardSx, formatDate, formatDateTime, NAVY, PageHeader, SectionCard } from '../ui'
import { editPath } from './ApplicationsList'

const TRACK: ApplicationStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'SCHEDULED', 'COMPLETED']
const TRACK_INDEX: Record<ApplicationStatus, number> = {
  DRAFT: -1, SUBMITTED: 0, UNDER_REVIEW: 1, INFO_REQUIRED: 1, REJECTED: 1, APPROVED: 2, SCHEDULED: 3, COMPLETED: 5,
}
const PAYMENT_LABEL: Record<string, string> = {
  paid: 'Paid', processing: 'Processing', pending: 'Awaiting payment', failed: 'Payment failed', canceled: 'Not paid', refunded: 'Refunded', not_required: 'Not paid',
}

function ProgressTracker({ status }: { status: ApplicationStatus }) {
  const active = TRACK_INDEX[status]
  return (
    <Box sx={{ overflowX: 'auto', pb: 1 }}>
      <Stepper activeStep={active} alternativeLabel sx={{ minWidth: 520 }}>
        {TRACK.map((s, i) => {
          const problem = i === 1 && (status === 'INFO_REQUIRED' || status === 'REJECTED')
          return (
            <Step key={s} completed={i < active}>
              <StepLabel error={status === 'REJECTED' && i === 1}
                optional={problem ? <Typography variant="caption" color={status === 'REJECTED' ? 'error' : 'warning.dark'}>{STATUS_META[status].label}</Typography> : undefined}>
                {STATUS_META[s].label}
              </StepLabel>
            </Step>
          )
        })}
      </Stepper>
    </Box>
  )
}

export function ApplicationDetail() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const [app, setApp] = useState<Application | null | undefined>(undefined)
  const [events, setEvents] = useState<ApplicationEvent[]>([])
  const [documents, setDocuments] = useState<ApplicationDocument[]>([])
  const [elp, setElp] = useState<ElpResult | null>(null)
  const [error, setError] = useState('')
  const [payOpen, setPayOpen] = useState(false)
  const payment = params.get('payment')

  useEffect(() => {
    let alive = true
    const checkoutSession = params.get('session_id')
    ;(async () => {
      // Returning from Stripe: let the API reconcile the payment before loading.
      if (checkoutSession) await getPaymentStatus(checkoutSession).catch(() => null)
      const application = await getApplication(id)
      if (!application) return alive && setApp(null)
      const [ev, docs, result] = await Promise.all([
        listEvents(id),
        listDocuments(id),
        application.elp_submission_id ? getElpResult(application.elp_submission_id) : Promise.resolve(null),
      ])
      if (!alive) return
      setApp(application)
      setEvents(ev)
      setDocuments(docs)
      setElp(result)
    })().catch(err => alive && setError(toMessage(err)))
    return () => { alive = false }
  }, [id])

  if (error) return <Alert severity="error">{error}</Alert>
  if (app === undefined) return <PortalLoading />
  if (app === null) {
    return (
      <Alert severity="error" action={<Button component={Link} to="/portal/applications/" color="inherit">My applications</Button>}>
        We couldn't find that application.
      </Alert>
    )
  }

  const editable = isEditableByStudent(app.status)
  const meta = STATUS_META[app.status]
  const canPay = app.status !== 'DRAFT' && app.status !== 'REJECTED' && app.payment_status !== 'paid' && app.payment_status !== 'processing'

  return (
    <>
      <PageHeader
        title={TYPE_LABEL[app.application_type]}
        subtitle={<Stack direction="row" spacing={1} alignItems="center" component="span" flexWrap="wrap" useFlexGap>
          <span>Reference <strong>{app.reference_no}</strong></span><StatusChip status={app.status} />
        </Stack>}
        action={editable ? (
          <Button component={Link} to={editPath(app)} variant="contained" color="secondary">
            {app.status === 'DRAFT' ? 'Continue draft' : 'Update & resubmit'}
          </Button>
        ) : undefined}
      />

      {payment === 'success' && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setParams({}, { replace: true })}>Payment received. Thank you!</Alert>}
      {payment === 'canceled' && <Alert severity="info" sx={{ mb: 3 }} onClose={() => setParams({}, { replace: true })}>Payment was canceled. You can pay any time from this page.</Alert>}

      {app.staff_message && (
        <Alert severity={app.status === 'INFO_REQUIRED' ? 'warning' : app.status === 'REJECTED' ? 'error' : 'info'} sx={{ mb: 3 }}>
          <strong>Message from admissions:</strong> {app.staff_message}
        </Alert>
      )}

      <Paper elevation={0} sx={{ ...cardSx, p: { xs: 2.5, md: 3 }, mb: 3 }}>
        <Typography fontWeight={900} color={NAVY}>{meta.label}</Typography>
        <Typography color="text.secondary" sx={{ mb: app.status === 'DRAFT' ? 0 : 3 }}>{meta.description}</Typography>
        {app.status !== 'DRAFT' && <ProgressTracker status={app.status} />}
      </Paper>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Stack spacing={3}>
            {app.scheduled_at && (
              <SectionCard title="Your schedule">
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <EventAvailableRounded sx={{ color: 'secondary.main', mt: 0.5 }} />
                  <Box>
                    <Typography fontWeight={900}>{formatDateTime(app.scheduled_at)}</Typography>
                    {app.scheduled_location && <Typography color="text.secondary">{app.scheduled_location}</Typography>}
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Bring your driver's license or CLP.</Typography>
                  </Box>
                </Stack>
              </SectionCard>
            )}

            <SectionCard title="Application details">
              <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '170px 1fr' }, columnGap: 2, rowGap: { xs: 0.25, sm: 1 } }}>
                {([
                  ['Name', `${app.first_name} ${app.last_name}`],
                  ['Email', app.email],
                  ['Phone', app.phone ?? '—'],
                  ...(app.application_type === 'TRAINING'
                    ? [['Program', app.course?.name ?? '—'], ['Start session', app.session ? `${app.session.name} (${formatDate(app.session.starts_at)})` : '—']]
                    : [['Preferred dates', app.preferred_dates ?? '—']]),
                  ['Started', formatDate(app.created_at)],
                  ['Submitted', formatDate(app.submitted_at)],
                ] as Array<[string, string]>).map(([label, value]) => (
                  <Box key={label} sx={{ display: 'contents' }}>
                    <Typography component="dt" variant="body2" color="text.secondary" sx={{ mt: { xs: 1, sm: 0 } }}>{label}</Typography>
                    <Typography component="dd" sx={{ m: 0, wordBreak: 'break-word' }}>{value}</Typography>
                  </Box>
                ))}
              </Box>
            </SectionCard>

            <SectionCard title="Documents" action={editable ? <Button component={Link} to={`${editPath(app)}${app.status === 'DRAFT' ? '?' : '&'}step=documents`} size="small">Add documents</Button> : undefined}>
              {documents.length
                ? <DocumentList documents={documents} editable={false} />
                : <Typography color="text.secondary">No documents uploaded.</Typography>}
            </SectionCard>

            {app.application_type === 'ASSESSMENT' && (
              <SectionCard title="Online English test">
                {elp?.evaluation
                  ? <ElpResultSummary resultId={elp.id} evaluation={elp.evaluation} />
                  : <Typography color="text.secondary">Not taken yet.</Typography>}
              </SectionCard>
            )}
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <Stack spacing={3}>
            <SectionCard title="Application fee">
              <Typography color="text.secondary" sx={{ mb: canPay ? 2 : 0 }}>
                Status: <strong>{PAYMENT_LABEL[app.payment_status ?? 'not_required'] ?? app.payment_status}</strong>
              </Typography>
              {canPay && <Button variant="outlined" color="secondary" onClick={() => setPayOpen(true)}>Pay application fee</Button>}
              {app.status === 'DRAFT' && <Typography variant="body2" color="text.secondary">You can pay after you submit.</Typography>}
            </SectionCard>

            <SectionCard title="History">
              {events.length === 0 ? (
                <Typography color="text.secondary">Started {formatDate(app.created_at)}. Nothing submitted yet.</Typography>
              ) : (
                <Stack component="ol" spacing={2} sx={{ listStyle: 'none', p: 0, m: 0 }}>
                  {[...events].reverse().map(ev => (
                    <Box component="li" key={ev.id} sx={{ borderLeft: 3, borderColor: 'divider', pl: 2 }}>
                      <StatusChip status={ev.to_status} />
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{formatDateTime(ev.created_at)}</Typography>
                      {ev.message && <Typography variant="body2" sx={{ mt: 0.5 }}>{ev.message}</Typography>}
                    </Box>
                  ))}
                </Stack>
              )}
            </SectionCard>
          </Stack>
        </Grid>
      </Grid>

      <PayFeeDialog
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="Pay the application fee"
        description="You'll be taken to Stripe's secure checkout and brought back here afterwards."
        firstName={app.first_name}
        lastName={app.last_name}
        onPay={(accepted, signature) => startApplicationCheckout(app.id, accepted, signature)}
      />
    </>
  )
}
