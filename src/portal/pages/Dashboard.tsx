import { useEffect, useState, type ReactElement } from 'react'
import { Alert, Box, Button, Grid, List, ListItemButton, ListItemText, Paper, Stack, Typography } from '@mui/material'
import LocalShippingRounded from '@mui/icons-material/LocalShippingRounded'
import FactCheckRounded from '@mui/icons-material/FactCheckRounded'
import EventAvailableRounded from '@mui/icons-material/EventAvailableRounded'
import AssignmentRounded from '@mui/icons-material/AssignmentRounded'
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded'
import ReceiptLongRounded from '@mui/icons-material/ReceiptLongRounded'
import { Link, useSearchParams } from 'react-router-dom'
import {
  listMyApplications, getMyStudent, startRegistrationCheckout, toMessage,
  type Application, type StudentProfile,
} from '../api'
import { getPaymentStatus } from '../../lib/stripe'
import { TYPE_LABEL, type ApplicationType } from '../model'
import { StatusChip } from '../StatusChip'
import { PayFeeDialog } from '../PayFeeDialog'
import { cardSx, EmptyState, formatDate, formatDateTime, ListSkeleton, NAVY, PageHeader, SectionCard } from '../ui'

const ACTIONS: Record<ApplicationType, { icon: ReactElement; blurb: string; to: string }> = {
  TRAINING: { icon: <LocalShippingRounded />, blurb: 'Enroll in Class A or Class B CDL training.', to: '/portal/apply/training' },
  ASSESSMENT: { icon: <FactCheckRounded />, blurb: 'Request a CDL skills and English proficiency assessment.', to: '/portal/apply/assessment' },
}

function ActionCard({ type, draft, open }: { type: ApplicationType; draft?: Application; open?: Application }) {
  const action = ACTIONS[type]
  return (
    <Paper elevation={0} sx={{ ...cardSx, p: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ width: 48, height: 48, borderRadius: 2.5, bgcolor: 'rgba(214,31,44,.1)', color: 'secondary.main', display: 'grid', placeItems: 'center' }}>
        {action.icon}
      </Box>
      <Typography component="h2" variant="h6" fontWeight={900}>{TYPE_LABEL[type]}</Typography>
      <Typography color="text.secondary" flex={1}>
        {draft
          ? `You have a draft saved ${formatDate(draft.updated_at)}. Pick up where you left off.`
          : open
            ? <>Your application <strong>{open.reference_no}</strong> is in progress.</>
            : action.blurb}
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        {draft ? (
          <Button component={Link} to={action.to} variant="contained" color="secondary">Continue draft</Button>
        ) : open ? (
          <Button component={Link} to={`/portal/applications/${open.id}`} variant="contained" color="primary">View status</Button>
        ) : (
          <Button component={Link} to={action.to} variant="contained" color="secondary">
            {type === 'TRAINING' ? 'Apply for training' : 'Request an assessment'}
          </Button>
        )}
      </Stack>
    </Paper>
  )
}

const OPEN_STATUSES = new Set(['SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUIRED', 'APPROVED', 'SCHEDULED'])

export function Dashboard() {
  const [params, setParams] = useSearchParams()
  const [student, setStudent] = useState<StudentProfile | null>(null)
  const [applications, setApplications] = useState<Application[] | null>(null)
  const [error, setError] = useState('')
  const [payOpen, setPayOpen] = useState(false)
  const payment = params.get('payment')

  useEffect(() => {
    let alive = true
    const checkoutSession = params.get('session_id')
    // Returning from Stripe: let the API reconcile the payment before loading.
    ;(checkoutSession ? getPaymentStatus(checkoutSession).catch(() => null) : Promise.resolve(null))
      .then(() => Promise.all([getMyStudent(), listMyApplications()]))
      .then(([s, apps]) => {
        if (!alive) return
        setStudent(s)
        setApplications(apps)
      })
      .catch(err => {
        if (!alive) return
        setError(toMessage(err))
        setApplications([])
      })
    return () => { alive = false }
    // Load once; the payment params are only read on arrival.
  }, [])

  const apps = applications ?? []
  const draftOf = (type: ApplicationType) => apps.find(a => a.application_type === type && a.status === 'DRAFT')
  const openOf = (type: ApplicationType) => apps.find(a => a.application_type === type && OPEN_STATUSES.has(a.status))
  const attention = apps.filter(a => a.status === 'INFO_REQUIRED')
  const upcoming = apps
    .filter(a => a.status === 'SCHEDULED' && a.scheduled_at && new Date(a.scheduled_at).getTime() >= Date.now() - 86_400_000)
    .sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!))[0]
  const profileIncomplete = student && (!student.date_of_birth || !student.address_line1 || !student.phone)
  const registrationPaid = student?.registration_payment_status === 'paid'

  return (
    <>
      <PageHeader
        title={`Welcome${student?.first_name ? `, ${student.first_name}` : ''}`}
        subtitle="Apply, track your applications and manage your documents in one place."
      />

      {payment === 'success' && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setParams({}, { replace: true })}>
          Payment received. Thank you! A confirmation email is on its way.
        </Alert>
      )}
      {payment === 'canceled' && (
        <Alert severity="info" sx={{ mb: 3 }} onClose={() => setParams({}, { replace: true })}>
          Payment was canceled. You can pay any time from this page.
        </Alert>
      )}
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {attention.map(app => (
        <Alert
          key={app.id}
          severity="warning"
          sx={{ mb: 2 }}
          action={<Button component={Link} to={`/portal/apply/${app.application_type === 'TRAINING' ? 'training' : 'assessment'}?id=${app.id}`} color="inherit" size="small">Update</Button>}
        >
          <strong>Admissions needs more information</strong> for {TYPE_LABEL[app.application_type]} {app.reference_no}
          {app.staff_message ? `: “${app.staff_message}”` : '.'}
        </Alert>
      ))}
      {profileIncomplete && (
        <Alert severity="info" sx={{ mb: 3 }} action={<Button component={Link} to="/portal/profile/" color="inherit" size="small">Complete profile</Button>}>
          Complete your profile once and we'll fill it into every application for you.
        </Alert>
      )}

      <Grid container spacing={{ xs: 2, md: 3 }} sx={{ mb: { xs: 2, md: 3 } }}>
        {(['TRAINING', 'ASSESSMENT'] as const).map(type => (
          <Grid key={type} size={{ xs: 12, md: 6 }}>
            {applications === null ? <ListSkeleton rows={1} /> : <ActionCard type={type} draft={draftOf(type)} open={openOf(type)} />}
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={{ xs: 2, md: 3 }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <SectionCard
            title="My applications"
            action={apps.length > 0 ? <Button component={Link} to="/portal/applications/" endIcon={<ChevronRightRounded />}>View all</Button> : undefined}
          >
            {applications === null ? <ListSkeleton /> : apps.length === 0 ? (
              <EmptyState icon={<AssignmentRounded />} title="No applications yet" body="Start with CDL Training or a CDL Assessment. You can save a draft and finish later." />
            ) : (
              <List disablePadding>
                {apps.slice(0, 5).map(app => (
                  <ListItemButton
                    key={app.id}
                    component={Link}
                    to={`/portal/applications/${app.id}`}
                    sx={{ borderRadius: 2, px: { xs: 1, sm: 2 }, py: 1.5, gap: 2, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}
                    divider
                  >
                    <ListItemText
                      primary={TYPE_LABEL[app.application_type]}
                      secondary={`${app.reference_no} · ${app.status === 'DRAFT' ? `Saved ${formatDate(app.updated_at)}` : `Submitted ${formatDate(app.submitted_at)}`}`}
                      primaryTypographyProps={{ fontWeight: 800 }}
                    />
                    <StatusChip status={app.status} />
                  </ListItemButton>
                ))}
              </List>
            )}
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={{ xs: 2, md: 3 }}>
            <SectionCard title="Next on your schedule">
              {upcoming ? (
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <EventAvailableRounded sx={{ color: 'secondary.main', mt: 0.5 }} />
                  <Box>
                    <Typography fontWeight={900} color={NAVY}>{TYPE_LABEL[upcoming.application_type]}</Typography>
                    <Typography>{formatDateTime(upcoming.scheduled_at)}</Typography>
                    {upcoming.scheduled_location && <Typography color="text.secondary">{upcoming.scheduled_location}</Typography>}
                    <Button component={Link} to="/portal/schedule/" size="small" sx={{ mt: 1, px: 0 }}>Full schedule</Button>
                  </Box>
                </Stack>
              ) : (
                <Typography color="text.secondary">Nothing scheduled yet. Once admissions approves an application, your date and location appear here.</Typography>
              )}
            </SectionCard>

            {student && !registrationPaid && (
              <SectionCard title="Registration fee">
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <ReceiptLongRounded sx={{ color: 'secondary.main', mt: 0.25 }} />
                    <Typography color="text.secondary">
                      {student.registration_payment_status === 'processing' || student.registration_payment_status === 'pending'
                        ? 'Your registration payment is being processed.'
                        : 'Pay your student registration fee online whenever you are ready.'}
                    </Typography>
                  </Stack>
                  <Button variant="outlined" color="secondary" onClick={() => setPayOpen(true)}
                    disabled={student.registration_payment_status === 'processing'}>
                    Pay registration fee
                  </Button>
                </Stack>
              </SectionCard>
            )}
          </Stack>
        </Grid>
      </Grid>

      {student && (
        <PayFeeDialog
          open={payOpen}
          onClose={() => setPayOpen(false)}
          title="Pay your registration fee"
          description="You'll be taken to Stripe's secure checkout and brought back here afterwards."
          firstName={student.first_name}
          lastName={student.last_name}
          onPay={startRegistrationCheckout}
        />
      )}
    </>
  )
}
