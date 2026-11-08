import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert, Box, Button, Chip, Container, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../portal/api'
import { formatDateTime } from '../../portal/ui'
import {
  describeRequestDetails,
  REQUEST_STATUSES,
  REQUEST_STATUS_LABELS,
  REQUEST_TYPES,
  REQUEST_TYPE_LABELS,
  type RequestStatus,
  type RequestType,
} from '../../../shared/websiteRequests.mjs'

type WebsiteRequest = {
  id: string; reference_no: string; request_type: RequestType; status: RequestStatus
  full_name: string; email: string; phone: string | null; message: string; details: Record<string, unknown>
  source_page: string | null; staff_notes: string | null; resolved_at: string | null; created_at: string; updated_at: string
}

const STATUS_COLOR: Record<RequestStatus, 'error' | 'warning' | 'success' | 'default'> = {
  NEW: 'error', IN_PROGRESS: 'warning', RESOLVED: 'success', CLOSED: 'default',
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return <Box><Typography variant="caption" color="text.secondary" fontWeight={800}>{label}</Typography><Typography sx={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{value || '—'}</Typography></Box>
}

/** Back office for requests sent from public pages (see shared/websiteRequests.mjs). */
export function WebsiteRequests() {
  const [rows, setRows] = useState<WebsiteRequest[]>([])
  const [typeFilter, setTypeFilter] = useState<'ALL' | RequestType>('ALL')
  const [statusFilter, setStatusFilter] = useState<'OPEN' | 'ALL' | RequestStatus>('OPEN')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<WebsiteRequest | null>(null)
  const [status, setStatus] = useState<RequestStatus>('NEW')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    const { data, error: queryError } = await supabase.from('cdl_website_requests').select('*').order('created_at', { ascending: false }).limit(500)
    if (queryError) setError(toMessage(queryError))
    else setRows((data ?? []) as WebsiteRequest[])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.filter(row =>
      (typeFilter === 'ALL' || row.request_type === typeFilter)
      && (statusFilter === 'ALL' || (statusFilter === 'OPEN' ? ['NEW', 'IN_PROGRESS'].includes(row.status) : row.status === statusFilter))
      && (!query || [row.reference_no, row.full_name, row.email, row.message].some(value => value?.toLowerCase().includes(query))))
  }, [rows, typeFilter, statusFilter, search])
  const newCount = rows.filter(row => row.status === 'NEW').length

  const open = (row: WebsiteRequest) => {
    setSelected(row)
    setStatus(row.status)
    setNotes(row.staff_notes ?? '')
    setError('')
  }

  const save = async () => {
    if (!supabase || !selected) return
    setSaving(true)
    // Only status and notes are writable; the database stamps who and when.
    const { error: updateError } = await supabase.from('cdl_website_requests').update({ status, staff_notes: notes.trim() || null }).eq('id', selected.id)
    setSaving(false)
    if (updateError) return setError(toMessage(updateError))
    setSelected(null)
    await load()
  }

  if (!supabase) return <Container sx={{ py: 8 }}><Alert severity="warning">Supabase is not configured.</Alert></Container>

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7fb', py: { xs: 3, md: 6 } }}>
      <Container maxWidth="xl">
        <Typography variant="overline" color="secondary.main" fontWeight={900} letterSpacing=".12em">Public website</Typography>
        <Typography variant="h3" fontWeight={950}>Website Requests</Typography>
        <Typography color="text.secondary" sx={{ mt: 1, mb: 3, maxWidth: 850 }}>
          Graduate verifications, student complaints, career inquiries and prior-training questions sent from the website. Admissions is emailed when a request arrives; track each one here until it is resolved.
        </Typography>
        {error && !selected && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} mb={2.5} alignItems={{ md: 'center' }}>
          <TextField select size="small" label="Type" value={typeFilter} onChange={event => setTypeFilter(event.target.value as typeof typeFilter)} sx={{ minWidth: 220 }}>
            <MenuItem value="ALL">All types</MenuItem>
            {REQUEST_TYPES.map(type => <MenuItem key={type} value={type}>{REQUEST_TYPE_LABELS[type]}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Status" value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)} sx={{ minWidth: 200 }}>
            <MenuItem value="OPEN">Open (new + in progress)</MenuItem>
            <MenuItem value="ALL">All statuses</MenuItem>
            {REQUEST_STATUSES.map(value => <MenuItem key={value} value={value}>{REQUEST_STATUS_LABELS[value]}</MenuItem>)}
          </TextField>
          <TextField size="small" label="Search name, email, reference or message" value={search} onChange={event => setSearch(event.target.value)} sx={{ flex: 1, maxWidth: 420 }} />
          {newCount > 0 && <Chip color="error" label={`${newCount} new`} />}
        </Stack>
        <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <TableContainer>
            <Table sx={{ minWidth: 900 }}>
              <TableHead><TableRow>
                {['Reference', 'Received', 'Type', 'From', 'Status', ''].map(label => <TableCell key={label} sx={{ fontWeight: 900 }}>{label}</TableCell>)}
              </TableRow></TableHead>
              <TableBody>
                {loading ? <TableRow><TableCell colSpan={6} align="center">Loading…</TableCell></TableRow>
                  : visible.length === 0 ? <TableRow><TableCell colSpan={6} align="center">No requests match these filters.</TableCell></TableRow>
                  : visible.map(row => <TableRow key={row.id} hover>
                    <TableCell><Typography fontWeight={900}>{row.reference_no}</Typography></TableCell>
                    <TableCell>{formatDateTime(row.created_at)}</TableCell>
                    <TableCell>{REQUEST_TYPE_LABELS[row.request_type]}</TableCell>
                    <TableCell><Typography fontWeight={800}>{row.full_name}</Typography><Typography variant="body2" color="text.secondary">{row.email}</Typography></TableCell>
                    <TableCell><Chip size="small" label={REQUEST_STATUS_LABELS[row.status]} color={STATUS_COLOR[row.status]} /></TableCell>
                    <TableCell><Button onClick={() => open(row)}>View</Button></TableCell>
                  </TableRow>)}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Container>

      <Dialog open={Boolean(selected)} onClose={() => !saving && setSelected(null)} fullWidth maxWidth="md">
        <DialogTitle fontWeight={950}>{selected ? `${REQUEST_TYPE_LABELS[selected.request_type]} · ${selected.reference_no}` : ''}</DialogTitle>
        <DialogContent dividers>
          {selected && <Stack spacing={3}>
            {selected.request_type === 'GRADUATE_VERIFICATION' && !selected.details?.hasGraduateRelease && (
              <Alert severity="warning">The requester did not confirm they have the graduate’s permission. Get written consent before sharing training records.</Alert>
            )}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2 }}>
              <Detail label="Name" value={selected.full_name} />
              <Detail label="Email" value={selected.email} />
              <Detail label="Phone" value={selected.phone} />
              <Detail label="Received" value={formatDateTime(selected.created_at)} />
              {describeRequestDetails(selected.request_type, selected.details).map(([label, value]) => <Detail key={label} label={label} value={value} />)}
              <Detail label="Sent from page" value={selected.source_page} />
              {selected.resolved_at && <Detail label="Resolved" value={formatDateTime(selected.resolved_at)} />}
            </Box>
            <Detail label="Message" value={selected.message} />
            <Button component="a" href={`mailto:${selected.email}?subject=${encodeURIComponent(`Your request ${selected.reference_no}`)}`} variant="outlined" sx={{ alignSelf: 'flex-start' }}>Reply by email</Button>
            <TextField select label="Status" value={status} onChange={event => setStatus(event.target.value as RequestStatus)}>
              {REQUEST_STATUSES.map(value => <MenuItem key={value} value={value}>{REQUEST_STATUS_LABELS[value]}</MenuItem>)}
            </TextField>
            <TextField label="Staff notes (internal)" multiline minRows={4} value={notes} onChange={event => setNotes(event.target.value)} inputProps={{ maxLength: 8000 }} />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelected(null)} disabled={saving}>Cancel</Button>
          <Button variant="contained" color="secondary" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
