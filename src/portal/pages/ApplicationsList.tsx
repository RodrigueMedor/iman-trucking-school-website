import { useEffect, useMemo, useState } from 'react'
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, Tab, Tabs, Typography,
} from '@mui/material'
import AssignmentRounded from '@mui/icons-material/AssignmentRounded'
import { Link } from 'react-router-dom'
import { deleteDraft, listMyApplications, toMessage, type Application } from '../api'
import { isEditableByStudent, TYPE_LABEL } from '../model'
import { StatusChip } from '../StatusChip'
import { cardSx, EmptyState, formatDate, ListSkeleton, NAVY, PageHeader } from '../ui'

type Filter = 'all' | 'active' | 'drafts' | 'closed'
const CLOSED = new Set(['COMPLETED', 'REJECTED'])

export function editPath(app: Application) {
  const type = app.application_type === 'TRAINING' ? 'training' : 'assessment'
  return app.status === 'DRAFT' ? `/portal/apply/${type}` : `/portal/apply/${type}?id=${app.id}`
}

export function ApplicationsList() {
  const [apps, setApps] = useState<Application[] | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [discarding, setDiscarding] = useState<Application | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    listMyApplications().then(setApps).catch(err => setError(toMessage(err)))
  }, [])

  const shown = useMemo(() => (apps ?? []).filter(a =>
    filter === 'all' ? true
      : filter === 'drafts' ? a.status === 'DRAFT'
      : filter === 'closed' ? CLOSED.has(a.status)
      : a.status !== 'DRAFT' && !CLOSED.has(a.status)), [apps, filter])

  const discard = async () => {
    if (!discarding) return
    setBusy(true)
    try {
      await deleteDraft(discarding)
      setApps(list => (list ?? []).filter(a => a.id !== discarding.id))
      setDiscarding(null)
    } catch (err) {
      setError(toMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="My applications"
        subtitle="Track every CDL Training and CDL Assessment application."
        action={
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button component={Link} to="/portal/apply/training" variant="contained" color="secondary">Apply for training</Button>
            <Button component={Link} to="/portal/apply/assessment" variant="outlined" color="secondary">Request assessment</Button>
          </Stack>
        }
      />
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Tabs value={filter} onChange={(_, v: Filter) => setFilter(v)} variant="scrollable" allowScrollButtonsMobile sx={{ mb: 2 }}
        textColor="secondary" indicatorColor="secondary">
        <Tab value="all" label="All" />
        <Tab value="active" label="In progress" />
        <Tab value="drafts" label="Drafts" />
        <Tab value="closed" label="Closed" />
      </Tabs>

      {apps === null ? <ListSkeleton rows={4} /> : shown.length === 0 ? (
        <Paper elevation={0} sx={cardSx}>
          <EmptyState icon={<AssignmentRounded />} title={apps.length ? 'Nothing here' : 'No applications yet'}
            body={apps.length ? 'No applications match this filter.' : 'Start an application for CDL Training or a CDL Assessment. You can save it as a draft and finish later.'}
            action={apps.length ? undefined : { label: 'Apply for CDL Training', to: '/portal/apply/training' }} />
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {shown.map(app => (
            <Paper key={app.id} elevation={0} sx={{ ...cardSx, p: { xs: 2, md: 2.5 } }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
                <Box flex={1} minWidth={0}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography fontWeight={900} color={NAVY}>{TYPE_LABEL[app.application_type]}</Typography>
                    <StatusChip status={app.status} />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {app.reference_no}
                    {app.course?.name ? ` · ${app.course.name}` : ''}
                    {' · '}
                    {app.status === 'DRAFT' ? `Last saved ${formatDate(app.updated_at)}` : `Submitted ${formatDate(app.submitted_at)}`}
                  </Typography>
                  {app.status === 'INFO_REQUIRED' && app.staff_message && (
                    <Typography variant="body2" sx={{ mt: 1, color: 'warning.dark' }}>Admissions: “{app.staff_message}”</Typography>
                  )}
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {isEditableByStudent(app.status) && (
                    <Button component={Link} to={editPath(app)} variant="contained" color="secondary" size="small">
                      {app.status === 'DRAFT' ? 'Continue draft' : 'Update & resubmit'}
                    </Button>
                  )}
                  {app.status !== 'DRAFT' && <Button component={Link} to={`/portal/applications/${app.id}`} variant="outlined" size="small">View details</Button>}
                  {app.status === 'DRAFT' && <Button color="inherit" size="small" onClick={() => setDiscarding(app)}>Discard</Button>}
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      <Dialog open={Boolean(discarding)} onClose={() => !busy && setDiscarding(null)}>
        <DialogTitle fontWeight={900}>Discard this draft?</DialogTitle>
        <DialogContent>
          <Typography>The draft {discarding?.reference_no} and any documents you uploaded to it will be deleted. This can't be undone.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDiscarding(null)} disabled={busy}>Keep draft</Button>
          <Button color="error" variant="contained" onClick={() => void discard()} disabled={busy}>{busy ? 'Discarding…' : 'Discard draft'}</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
