import { useEffect, useState } from 'react'
import { Alert, Box, Paper, Stack, Typography } from '@mui/material'
import EventRounded from '@mui/icons-material/EventRounded'
import { Link } from 'react-router-dom'
import { listMyApplications, toMessage, type Application } from '../api'
import { TYPE_LABEL } from '../model'
import { StatusChip } from '../StatusChip'
import { cardSx, EmptyState, ListSkeleton, NAVY, PageHeader, SectionCard } from '../ui'

function DateBadge({ value }: { value: string }) {
  const d = new Date(value)
  return (
    <Box sx={{ width: 64, flexShrink: 0, textAlign: 'center', borderRadius: 2, overflow: 'hidden', border: 1, borderColor: 'divider' }}>
      <Box sx={{ bgcolor: 'secondary.main', color: 'white', fontSize: 12, fontWeight: 800, py: 0.25 }}>
        {d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
      </Box>
      <Typography fontWeight={900} fontSize={24} lineHeight={1.4} color={NAVY}>{d.getDate()}</Typography>
    </Box>
  )
}

function Item({ app }: { app: Application }) {
  const d = new Date(app.scheduled_at!)
  return (
    <Paper elevation={0} component={Link} to={`/portal/applications/${app.id}`}
      sx={{ ...cardSx, p: 2, display: 'block', textDecoration: 'none', color: 'inherit', '&:hover': { borderColor: 'secondary.main' } }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <DateBadge value={app.scheduled_at!} />
        <Box flex={1} minWidth={0}>
          <Typography fontWeight={900}>{TYPE_LABEL[app.application_type]}{app.course?.name ? ` — ${app.course.name}` : ''}</Typography>
          <Typography color="text.secondary">
            {d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at {d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </Typography>
          {app.scheduled_location && <Typography color="text.secondary">{app.scheduled_location}</Typography>}
        </Box>
        <Box sx={{ display: { xs: 'none', sm: 'block' } }}><StatusChip status={app.status} /></Box>
      </Stack>
    </Paper>
  )
}

export function SchedulePage() {
  const [apps, setApps] = useState<Application[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    listMyApplications().then(setApps).catch(err => setError(toMessage(err)))
  }, [])

  const scheduled = (apps ?? []).filter(a => a.scheduled_at).sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!))
  const cutoff = Date.now() - 86_400_000
  const upcoming = scheduled.filter(a => new Date(a.scheduled_at!).getTime() >= cutoff && a.status === 'SCHEDULED')
  const past = scheduled.filter(a => !upcoming.includes(a)).reverse()
  const awaiting = (apps ?? []).filter(a => a.status === 'APPROVED')

  return (
    <>
      <PageHeader title="Schedule" subtitle="Your confirmed training and assessment dates." />
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {apps === null ? <ListSkeleton /> : (
        <Stack spacing={3}>
          {awaiting.length > 0 && (
            <Alert severity="success">
              {awaiting.length === 1 ? 'One application is approved' : `${awaiting.length} applications are approved`} and waiting for a date. Admissions will add it here.
            </Alert>
          )}
          <SectionCard title="Upcoming">
            {upcoming.length ? <Stack spacing={1.5}>{upcoming.map(a => <Item key={a.id} app={a} />)}</Stack> : (
              <EmptyState icon={<EventRounded />} title="Nothing scheduled yet"
                body="When admissions approves an application and sets a date, it appears here with the time and location." />
            )}
          </SectionCard>
          {past.length > 0 && (
            <SectionCard title="Past">
              <Stack spacing={1.5}>{past.map(a => <Item key={a.id} app={a} />)}</Stack>
            </SectionCard>
          )}
        </Stack>
      )}
    </>
  )
}
