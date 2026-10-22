import { useCallback, useEffect, useState } from 'react'
import { Alert, Box, Button, Chip, Container, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Drawer, IconButton, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material'
import CloseRounded from '@mui/icons-material/CloseRounded'
import { decideIdentity, getIdentityEvents, listIdentityVerifications, toMessage, type AdminIdentityVerification, type IdentityEvent } from '../../portal/api'
import { IDENTITY_STATUS } from '../../portal/IdentityNotice'
import { formatDate, formatDateTime } from '../../portal/ui'

const DOCUMENT_LABELS: Record<string, string> = { DRIVING_LICENSE: "Driver's License", GREEN_CARD: 'Green Card' }
const METHOD_LABELS: Record<string, string> = {
  PROVIDER: 'Stripe Identity (document + live selfie)', ALTERNATIVE: 'In person (no biometrics)', EXEMPT: 'Exempt (existing student)',
}
const ACTION_LABELS: Record<string, string> = {
  EXEMPTED: 'Exempted as an existing student',
  STARTED: 'Verification started', PROVIDER_UPDATE: 'Stripe result', ALTERNATIVE_REQUESTED: 'In-person verification requested',
  APPROVED: 'Approved by staff', REJECTED: 'Rejected by staff', RESUBMISSION_REQUESTED: 'Resubmission requested', REDACTED: 'Images and biometrics redacted at Stripe',
}
type Decision = 'APPROVE' | 'REJECT' | 'REQUEST_RESUBMISSION'
const DECISIONS: Record<Decision, { title: string; button: string; help: string }> = {
  APPROVE: { title: 'Approve identity', button: 'Approve', help: 'Clears identity so the student can submit applications. Use after checking the document in person or reviewing the Stripe result. Record what you checked.' },
  REQUEST_RESUBMISSION: { title: 'Ask the student to verify again', button: 'Request resubmission', help: 'The student sees your reason and can start a new verification.' },
  REJECT: { title: 'Reject verification', button: 'Reject', help: 'The student sees your reason. They can still start a new verification later.' },
}

function DecisionDialog({ decision, onClose, onSubmit }: { decision: Decision; onClose: () => void; onSubmit: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const config = DECISIONS[decision]
  const submit = async () => {
    if (reason.trim().length < 3) return setError('Enter a reason of at least 3 characters.')
    setBusy(true); setError('')
    try { await onSubmit(reason.trim()); onClose() } catch (err) { setError(toMessage(err)); setBusy(false) }
  }
  return <Dialog open onClose={() => !busy && onClose()} fullWidth maxWidth="sm">
    <DialogTitle fontWeight={950}>{config.title}</DialogTitle>
    <DialogContent><Stack spacing={2} mt={1}>
      {error && <Alert severity="error">{error}</Alert>}
      <Typography color="text.secondary">{config.help}</Typography>
      <TextField label="Reason (kept in the audit trail)" multiline minRows={3} value={reason} onChange={event => setReason(event.target.value)} inputProps={{ maxLength: 500 }} autoFocus />
    </Stack></DialogContent>
    <DialogActions><Button onClick={onClose} disabled={busy}>Cancel</Button><Button variant="contained" color={decision === 'APPROVE' ? 'secondary' : 'error'} onClick={() => void submit()} disabled={busy}>{busy ? 'Saving…' : config.button}</Button></DialogActions>
  </Dialog>
}

function Detail({ row, latest, onClose, onChanged }: { row: AdminIdentityVerification; latest: boolean; onClose: () => void; onChanged: () => Promise<void> }) {
  const [events, setEvents] = useState<IdentityEvent[] | null>(null)
  const [decision, setDecision] = useState<Decision | null>(null)
  const load = useCallback(() => getIdentityEvents(row.id).then(setEvents).catch(() => setEvents([])), [row.id])
  useEffect(() => { void load() }, [load])
  const fields: [string, string][] = [
    ['Document', row.document_type ? DOCUMENT_LABELS[row.document_type] || row.document_type : '—'],
    ['Method', METHOD_LABELS[row.method] || row.method],
    ['Stripe result', row.provider_status || '—'],
    ['Document type read by Stripe', row.provider_document_type || '—'],
    ['Issuing country', row.document_issuing_country || '—'],
    ['Document expires', row.document_expires_on ? formatDate(row.document_expires_on) : '—'],
    ['Name matches account', row.name_matches === null ? '—' : row.name_matches ? 'Yes' : 'No'],
    ['Failure', row.failure_code ? `${row.failure_code}: ${row.failure_reason}` : '—'],
    ['Consent', row.method === 'PROVIDER' ? `${row.consent_version} · ${formatDateTime(row.consent_at)}` : 'Not required (no biometrics)'],
    ['Decided', row.decided_at ? formatDateTime(row.decided_at) : '—'],
    ['Stripe session', row.provider_session_id || '—'],
    ['Biometrics redacted', row.redacted_at ? formatDateTime(row.redacted_at) : 'Not yet (30 days after decision)'],
  ]

  return <Drawer anchor="right" open onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', md: 640 } } }}>
    <Box sx={{ p: { xs: 2.5, md: 4 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
        <Box>
          <Typography variant="overline" color="secondary.main" fontWeight={900}>Identity verification</Typography>
          <Typography variant="h4" fontWeight={950}>{row.student?.first_name} {row.student?.last_name}</Typography>
          <Typography color="text.secondary">{row.student?.email}{row.student?.phone ? ` · ${row.student.phone}` : ''}</Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="Close"><CloseRounded /></IconButton>
      </Stack>
      <Chip sx={{ mt: 2 }} label={IDENTITY_STATUS[row.status].label} color={IDENTITY_STATUS[row.status].color} />
      {!latest && <Alert severity="info" sx={{ mt: 2 }}>The student has a newer verification; decisions apply to that one.</Alert>}
      <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '200px 1fr' }, gap: 1, my: 3, '& dt': { fontWeight: 800, color: 'text.secondary' }, '& dd': { m: 0 } }}>
        {fields.map(([name, value]) => <Box key={name} sx={{ display: 'contents' }}><dt>{name}</dt><dd>{value}</dd></Box>)}
      </Box>
      {row.decision_note && <Alert severity="info" sx={{ mb: 3 }}>Note: {row.decision_note}</Alert>}
      {latest && <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} mb={3}>
        {row.status !== 'VERIFIED' && <Button variant="contained" color="secondary" onClick={() => setDecision('APPROVE')}>Approve</Button>}
        <Button variant="outlined" onClick={() => setDecision('REQUEST_RESUBMISSION')}>Request resubmission</Button>
        {row.status !== 'FAILED' && <Button color="error" onClick={() => setDecision('REJECT')}>Reject</Button>}
      </Stack>}
      <Alert severity="warning" sx={{ mb: 3 }}>A verified document shows the ID is genuine and belongs to the student. It does not confirm current DMV license status or USCIS immigration status.</Alert>
      <Typography variant="h6" fontWeight={900} mb={1}>Audit trail</Typography>
      {events === null ? <Typography color="text.secondary">Loading…</Typography> : <Stack divider={<Divider flexItem />}>
        {events.map(event => <Box key={event.id} py={1}>
          <Typography fontWeight={850}>{ACTION_LABELS[event.action] || event.action}{event.to_status ? ` → ${IDENTITY_STATUS[event.to_status as keyof typeof IDENTITY_STATUS]?.label || event.to_status}` : ''}</Typography>
          <Typography variant="body2" color="text.secondary">{formatDateTime(event.created_at)} · {event.actor_name}{event.detail ? ` · ${event.detail}` : ''}</Typography>
        </Box>)}
      </Stack>}
    </Box>
    {decision && <DecisionDialog decision={decision} onClose={() => setDecision(null)} onSubmit={async reason => { await decideIdentity(row.id, decision, reason); await Promise.all([onChanged(), load()]) }} />}
  </Drawer>
}

export function IdentityVerifications() {
  const [rows, setRows] = useState<AdminIdentityVerification[] | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('ATTENTION')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const load = useCallback(async () => {
    try { setRows(await listIdentityVerifications()) } catch (err) { setError(toMessage(err)); setRows([]) }
  }, [])
  useEffect(() => { void load() }, [load])

  // Each student's newest attempt; older ones stay in the audit history.
  const latestIds = new Set<string>()
  const seen = new Set<string>()
  for (const row of rows || []) if (!seen.has(row.user_id)) { seen.add(row.user_id); latestIds.add(row.id) }
  const latest = (rows || []).filter(row => latestIds.has(row.id))
  const count = (status: string) => latest.filter(row => row.status === status).length
  const shown = filter === 'ALL' ? rows || [] : filter === 'ATTENTION' ? latest.filter(row => row.status === 'MANUAL_REVIEW') : latest.filter(row => row.status === filter)
  const selected = (rows || []).find(row => row.id === selectedId) || null

  return <Box sx={{ py: { xs: 3, md: 6 } }}><Container maxWidth="xl">
    <Box mb={3}><Typography variant="overline" color="secondary.main" fontWeight={900}>Admissions</Typography><Typography variant="h3" fontWeight={950}>Identity verification</Typography>
      <Typography color="text.secondary">Students verify with a Driver's License or Green Card and a live selfie through Stripe Identity. Review flagged and in-person requests here.</Typography></Box>
    {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
      {(['MANUAL_REVIEW', 'PENDING', 'FAILED', 'VERIFIED'] as const).map(status => <Paper key={status} variant="outlined" sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={800}>{IDENTITY_STATUS[status].label}</Typography>
        <Typography variant="h5" fontWeight={950}>{count(status)}</Typography>
      </Paper>)}
    </Box>
    <TextField select size="small" label="Show" value={filter} onChange={event => setFilter(event.target.value)} sx={{ mb: 2, minWidth: 260 }}>
      <MenuItem value="ATTENTION">Needs manual review</MenuItem>
      <MenuItem value="PENDING">Pending</MenuItem>
      <MenuItem value="FAILED">Failed</MenuItem>
      <MenuItem value="VERIFIED">Verified</MenuItem>
      <MenuItem value="ALL">All attempts (history)</MenuItem>
    </TextField>
    <Paper sx={{ overflowX: 'auto' }}><Table sx={{ minWidth: 900 }}><TableHead><TableRow>{['Student', 'Document', 'Method', 'Status', 'Reason', 'Updated'].map(name => <TableCell key={name} sx={{ fontWeight: 900 }}>{name}</TableCell>)}</TableRow></TableHead><TableBody>
      {rows === null ? <TableRow><TableCell colSpan={6} align="center">Loading…</TableCell></TableRow>
        : shown.length ? shown.map(row => <TableRow key={row.id} hover onClick={() => setSelectedId(row.id)} sx={{ cursor: 'pointer' }} tabIndex={0} onKeyDown={event => { if (event.key === 'Enter') setSelectedId(row.id) }}>
          <TableCell><Typography fontWeight={900}>{row.student?.first_name} {row.student?.last_name}</Typography><Typography variant="body2" color="text.secondary">{row.student?.email}</Typography></TableCell>
          <TableCell>{row.document_type ? DOCUMENT_LABELS[row.document_type] || row.document_type : '—'}</TableCell>
          <TableCell>{METHOD_LABELS[row.method] || row.method}</TableCell>
          <TableCell><Chip size="small" label={IDENTITY_STATUS[row.status].label} color={IDENTITY_STATUS[row.status].color} /></TableCell>
          <TableCell sx={{ maxWidth: 320 }}><Typography variant="body2" noWrap>{row.failure_code || row.decision_note || '—'}</Typography></TableCell>
          <TableCell>{formatDateTime(row.updated_at)}</TableCell>
        </TableRow>) : <TableRow><TableCell colSpan={6} align="center">Nothing to show.</TableCell></TableRow>}
    </TableBody></Table></Paper>
    {selected && <Detail row={selected} latest={latestIds.has(selected.id)} onClose={() => setSelectedId(null)} onChanged={load} />}
  </Container></Box>
}
