import { useCallback, useEffect, useState } from 'react'
import {
  Alert, Box, Button, Chip, Container, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControl, Grid, InputLabel,
  MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  APPLICATION_STATUSES, STAFF_TRANSITIONS, STATUS_META, TYPE_LABEL, type ApplicationStatus, type ApplicationType,
} from '../../portal/model'
import { StatusChip } from '../../portal/StatusChip'
import { DocumentList } from '../../portal/DocumentUploader'
import { toMessage, type Application, type ApplicationDocument } from '../../portal/api'
import { formatDate, formatDateTime } from '../../portal/ui'

type AdminApplication = Application & { elp?: { evaluation: { score: number; decision: string } | null } | null }

const PAYMENT_COLOR: Record<string, 'success' | 'error' | 'info' | 'warning' | 'default'> = {
  paid: 'success', failed: 'error', canceled: 'default', processing: 'info', pending: 'warning', refunded: 'default',
}

/** Strips characters that have meaning inside a PostgREST `or=(...)` filter. */
function searchTerm(value: string) {
  return value.replace(/[,()%*\\:"']/g, ' ').trim()
}

function toLocalInput(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export function CDLApplications() {
  const [notice, setNotice] = useState<{ severity: 'success' | 'error'; text: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [typeFilter, setTypeFilter] = useState<'' | ApplicationType>('')
  const [statusFilter, setStatusFilter] = useState<'' | 'OPEN' | ApplicationStatus>('OPEN')
  const [searchQuery, setSearchQuery] = useState('')
  const [applications, setApplications] = useState<AdminApplication[]>([])

  const [selected, setSelected] = useState<AdminApplication | null>(null)
  const [documents, setDocuments] = useState<ApplicationDocument[]>([])
  const [form, setForm] = useState({ status: '', message: '', scheduledAt: '', location: '', notes: '' })
  const [dialogError, setDialogError] = useState('')
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    let query = supabase
      .from('cdl_class_applications')
      .select('*, course:cdl_courses(name, code, application_fee_cents), session:cdl_academic_sessions(name, starts_at, ends_at), elp:elp_submissions(evaluation)')
      .order('submitted_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
    if (typeFilter) query = query.eq('application_type', typeFilter)
    if (statusFilter === 'OPEN') query = query.neq('status', 'DRAFT')
    else if (statusFilter) query = query.eq('status', statusFilter)
    const term = searchTerm(searchQuery)
    if (term) query = query.or(`first_name.ilike.*${term}*,last_name.ilike.*${term}*,email.ilike.*${term}*,reference_no.ilike.*${term}*`)
    const { data, error } = await query
    if (error) setNotice({ severity: 'error', text: toMessage(error) })
    else setApplications((data ?? []) as AdminApplication[])
    setLoading(false)
  }, [typeFilter, statusFilter, searchQuery])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), searchQuery ? 300 : 0)
    return () => window.clearTimeout(timer)
  }, [loadData, searchQuery])

  async function openReview(app: AdminApplication) {
    setSelected(app)
    setDialogError('')
    setForm({ status: '', message: '', scheduledAt: toLocalInput(app.scheduled_at), location: app.scheduled_location ?? '', notes: '' })
    setDocuments([])
    if (!supabase) return
    const [docs, notes] = await Promise.all([
      supabase.from('cdl_application_documents').select('*').eq('application_id', app.id).order('created_at', { ascending: false }),
      supabase.from('cdl_application_staff_notes').select('notes').eq('application_id', app.id).maybeSingle(),
    ])
    setDocuments((docs.data ?? []) as ApplicationDocument[])
    setForm(f => ({ ...f, notes: (notes.data?.notes as string | undefined) ?? '' }))
  }

  async function reviewDocument(doc: ApplicationDocument, status: ApplicationDocument['status']) {
    if (!supabase) return
    const { error } = await supabase.from('cdl_application_documents').update({ status }).eq('id', doc.id)
    if (error) return setDialogError(toMessage(error))
    setDocuments(list => list.map(d => (d.id === doc.id ? { ...d, status } : d)))
  }

  async function save() {
    if (!supabase || !selected) return
    setDialogError('')
    if (form.status === 'INFO_REQUIRED' && !form.message.trim()) return setDialogError('Tell the student what information is needed.')
    if (form.status === 'SCHEDULED' && !form.scheduledAt) return setDialogError('Choose the scheduled date and time.')
    setSaving(true)
    try {
      const { data: auth } = await supabase.auth.getUser()
      const { error: notesError } = await supabase.from('cdl_application_staff_notes').upsert({
        application_id: selected.id, notes: form.notes, updated_by: auth.user?.id ?? null, updated_at: new Date().toISOString(),
      })
      if (notesError) throw notesError
      if (form.status) {
        const { error } = await supabase.rpc('set_application_status', {
          p_id: selected.id,
          p_status: form.status,
          p_message: form.message.trim() || null,
          p_scheduled_at: form.status === 'SCHEDULED' ? new Date(form.scheduledAt).toISOString() : null,
          p_location: form.status === 'SCHEDULED' ? form.location.trim() || null : null,
        })
        if (error) throw error
      }
      setNotice({ severity: 'success', text: form.status ? `${selected.reference_no} is now ${STATUS_META[form.status as ApplicationStatus].label}.` : 'Notes saved.' })
      setSelected(null)
      await loadData()
    } catch (err) {
      setDialogError(toMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (!supabase) {
    return <Container sx={{ py: 8 }}><Alert severity="warning">Supabase is not configured for this deployment.</Alert></Container>
  }

  const transitions = selected ? STAFF_TRANSITIONS[selected.status] : []
  const profile = selected?.form_data.profile ?? {}
  const license = selected?.form_data.license ?? {}

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7fb', py: { xs: 3, md: 6 } }}>
      <Container maxWidth="xl">
        <Button component={Link} to="/admin/" sx={{ mb: 2 }}>← Dashboard</Button>
        <Typography variant="h3" fontWeight={900} sx={{ mb: 3, fontSize: { xs: 30, md: 44 } }}>Applications</Typography>

        <Paper sx={{ p: 2.5, mb: 3, borderRadius: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} gap={2}>
            <TextField fullWidth placeholder="Search name, email or reference…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            <FormControl sx={{ minWidth: 190 }}>
              <InputLabel>Type</InputLabel>
              <Select value={typeFilter} label="Type" onChange={e => setTypeFilter(e.target.value as '' | ApplicationType)}>
                <MenuItem value="">All types</MenuItem>
                <MenuItem value="TRAINING">{TYPE_LABEL.TRAINING}</MenuItem>
                <MenuItem value="ASSESSMENT">{TYPE_LABEL.ASSESSMENT}</MenuItem>
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 240 }}>
              <InputLabel>Status</InputLabel>
              <Select value={statusFilter} label="Status" onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}>
                <MenuItem value="OPEN">All submitted</MenuItem>
                {APPLICATION_STATUSES.map(s => <MenuItem key={s} value={s}>{STATUS_META[s].label}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>
        </Paper>

        {notice && <Alert severity={notice.severity} sx={{ mb: 3 }} onClose={() => setNotice(null)}>{notice.text}</Alert>}

        <Paper sx={{ borderRadius: 3 }}>
          <TableContainer>
            <Table sx={{ minWidth: 900 }}>
              <TableHead>
                <TableRow>
                  {['Applicant', 'Application', 'Program / dates', 'Status', 'Payment', 'Submitted', ''].map(h => <TableCell key={h} sx={{ fontWeight: 900 }}>{h}</TableCell>)}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} align="center">Loading…</TableCell></TableRow>
                ) : applications.length === 0 ? (
                  <TableRow><TableCell colSpan={7} align="center">No applications found.</TableCell></TableRow>
                ) : applications.map(app => (
                  <TableRow key={app.id} hover>
                    <TableCell>
                      <Typography fontWeight={800}>{app.first_name} {app.last_name}</Typography>
                      <Typography variant="body2" color="text.secondary">{app.email}</Typography>
                      {app.phone && <Typography variant="body2" color="text.secondary">{app.phone}</Typography>}
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={700}>{TYPE_LABEL[app.application_type]}</Typography>
                      <Typography variant="body2" color="text.secondary">{app.reference_no}</Typography>
                    </TableCell>
                    <TableCell>
                      {app.application_type === 'TRAINING'
                        ? <>{app.course?.name ?? '—'}<Typography variant="body2" color="text.secondary">{app.session?.name}</Typography></>
                        : <Typography variant="body2">{app.preferred_dates ?? '—'}</Typography>}
                    </TableCell>
                    <TableCell>
                      <StatusChip status={app.status} />
                      {app.scheduled_at && <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>{formatDateTime(app.scheduled_at)}</Typography>}
                    </TableCell>
                    <TableCell>
                      {app.payment_status && app.payment_status !== 'not_required'
                        ? <Chip size="small" label={app.payment_status} color={PAYMENT_COLOR[app.payment_status] ?? 'default'} />
                        : <Typography variant="body2" color="text.secondary">—</Typography>}
                    </TableCell>
                    <TableCell>{formatDate(app.submitted_at)}</TableCell>
                    <TableCell><Button size="small" variant="outlined" onClick={() => void openReview(app)}>Review</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Dialog open={Boolean(selected)} onClose={() => !saving && setSelected(null)} maxWidth="md" fullWidth scroll="paper">
          {selected && (
            <>
              <DialogTitle sx={{ fontWeight: 900 }}>
                {TYPE_LABEL[selected.application_type]} · {selected.reference_no} <StatusChip status={selected.status} sx={{ ml: 1 }} />
              </DialogTitle>
              <DialogContent dividers>
                <Grid container spacing={2}>
                  {([
                    ['Applicant', `${selected.first_name} ${selected.last_name}`],
                    ['Email', selected.email],
                    ['Phone', selected.phone ?? '—'],
                    ['Date of birth', formatDate(profile.dateOfBirth)],
                    ['Address', [profile.addressLine1, profile.addressLine2, profile.city, profile.state, profile.zipCode].filter(Boolean).join(', ') || '—'],
                    ['License', [license.licenseType, license.licenseNumber, license.licenseState].filter(Boolean).join(' · ') || '—'],
                    ...(selected.application_type === 'TRAINING'
                      ? [['Program', selected.course?.name ?? '—'], ['Start session', selected.session?.name ?? '—']]
                      : [['Preferred dates', selected.preferred_dates ?? '—'], ['Online ELP test', selected.elp?.evaluation ? `${selected.elp.evaluation.score}/100 · ${selected.elp.evaluation.decision}` : 'Not taken']]),
                    ['Submitted', formatDateTime(selected.submitted_at)],
                    ['Payment', selected.payment_status ?? '—'],
                  ] as Array<[string, string]>).map(([label, value]) => (
                    <Grid key={label} size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={800}>{label}</Typography>
                      <Typography sx={{ wordBreak: 'break-word' }}>{value}</Typography>
                    </Grid>
                  ))}
                </Grid>
                {selected.statement && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={800}>Applicant notes</Typography>
                    <Typography sx={{ whiteSpace: 'pre-wrap' }}>{selected.statement}</Typography>
                  </Box>
                )}

                <Divider sx={{ my: 3 }} />
                <Typography fontWeight={900} sx={{ mb: 1 }}>Documents</Typography>
                {documents.length === 0 ? <Typography color="text.secondary">No documents.</Typography> : (
                  <>
                    <DocumentList documents={documents} editable={false} />
                    <Stack spacing={1} sx={{ mt: 1 }}>
                      {documents.map(doc => (
                        <Stack key={doc.id} direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                          <Typography variant="body2" sx={{ minWidth: 0, flex: 1, wordBreak: 'break-all' }}>{doc.file_name}</Typography>
                          <Button size="small" color="success" disabled={doc.status === 'ACCEPTED'} onClick={() => void reviewDocument(doc, 'ACCEPTED')}>Accept</Button>
                          <Button size="small" color="error" disabled={doc.status === 'REJECTED'} onClick={() => void reviewDocument(doc, 'REJECTED')}>Needs replacement</Button>
                        </Stack>
                      ))}
                    </Stack>
                  </>
                )}

                <Divider sx={{ my: 3 }} />
                <Typography fontWeight={900} sx={{ mb: 2 }}>Update status</Typography>
                {transitions.length === 0 ? (
                  <Typography color="text.secondary" sx={{ mb: 2 }}>
                    {selected.status === 'DRAFT' || selected.status === 'INFO_REQUIRED'
                      ? 'Waiting for the student to submit.'
                      : 'No further status changes are available.'}
                  </Typography>
                ) : (
                  <Stack spacing={2} sx={{ mb: 2 }}>
                    <FormControl fullWidth>
                      <InputLabel>New status</InputLabel>
                      <Select value={form.status} label="New status" onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                        <MenuItem value="">Keep {STATUS_META[selected.status].label}</MenuItem>
                        {transitions.map(s => <MenuItem key={s} value={s}>{s === selected.status ? `Reschedule (${STATUS_META[s].label})` : STATUS_META[s].label}</MenuItem>)}
                      </Select>
                    </FormControl>
                    {form.status === 'SCHEDULED' && (
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                        <TextField type="datetime-local" label="Date and time" value={form.scheduledAt} fullWidth
                          onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} slotProps={{ inputLabel: { shrink: true } }} />
                        <TextField label="Location" value={form.location} fullWidth onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
                      </Stack>
                    )}
                    {form.status && (
                      <TextField multiline minRows={2} fullWidth label={form.status === 'INFO_REQUIRED' ? 'What does the student need to provide? (required)' : 'Message to the student (optional)'}
                        helperText="The student sees this message in their portal." value={form.message}
                        onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
                    )}
                  </Stack>
                )}
                <TextField multiline minRows={2} fullWidth label="Internal staff notes" helperText="Only staff can see these notes."
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                {dialogError && <Alert severity="error" sx={{ mt: 2 }}>{dialogError}</Alert>}
              </DialogContent>
              <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={() => setSelected(null)} disabled={saving}>Cancel</Button>
                <Button variant="contained" color="secondary" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
              </DialogActions>
            </>
          )}
        </Dialog>
      </Container>
    </Box>
  )
}
