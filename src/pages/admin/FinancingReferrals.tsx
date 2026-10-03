import { useCallback, useEffect, useState } from 'react'
import {
  Alert, Box, Button, Chip, Container, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, InputLabel, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../portal/api'
import { formatDate, formatDateTime } from '../../portal/ui'

const STATUSES = ['REFERRED', 'STUDENT_REPORTED_SUBMITTED', 'FOLLOW_UP_NEEDED', 'CLOSED'] as const
type ReferralStatus = (typeof STATUSES)[number]

const STATUS_META: Record<ReferralStatus, { label: string; color: 'info' | 'success' | 'warning' | 'default' }> = {
  REFERRED: { label: 'Sent to Liberty', color: 'info' },
  STUDENT_REPORTED_SUBMITTED: { label: 'Student reports submitted', color: 'success' },
  FOLLOW_UP_NEEDED: { label: 'Follow-up needed', color: 'warning' },
  CLOSED: { label: 'Closed', color: 'default' },
}

type Student = {
  first_name: string; last_name: string; email: string | null; phone: string | null; date_of_birth: string | null
  address_line1: string | null; address_line2: string | null; city: string | null; state: string | null; zip_code: string | null
  license_type: string | null; license_number: string | null; license_state: string | null; created_at: string
}

type Referral = {
  id: string; status: ReferralStatus; referral_count: number; first_referred_at: string; last_referred_at: string
  staff_notes: string; student: Student | null
  application: { id: string; reference_no: string; status: string; created_at: string } | null
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return <Box><Typography variant="caption" color="text.secondary" fontWeight={800}>{label}</Typography><Typography sx={{ wordBreak: 'break-word' }}>{value || '—'}</Typography></Box>
}

export function FinancingReferrals() {
  const [rows, setRows] = useState<Referral[]>([])
  const [selected, setSelected] = useState<Referral | null>(null)
  const [status, setStatus] = useState<ReferralStatus>('REFERRED')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    const { data, error: queryError } = await supabase
      .from('cdl_financing_referrals')
      .select('*, student:cdl_students!student_id(*), application:cdl_class_applications!application_id(id, reference_no, status, created_at)')
      .order('last_referred_at', { ascending: false })
    if (queryError) setError(toMessage(queryError))
    else setRows((data ?? []) as unknown as Referral[])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const open = (row: Referral) => {
    setSelected(row)
    setStatus(row.status)
    setNotes(row.staff_notes)
    setError('')
  }

  const save = async () => {
    if (!supabase || !selected) return
    setSaving(true)
    const { data: auth } = await supabase.auth.getUser()
    const { error: updateError } = await supabase.from('cdl_financing_referrals').update({
      status, staff_notes: notes.trim(), updated_by: auth.user?.id ?? null,
    }).eq('id', selected.id)
    setSaving(false)
    if (updateError) return setError(toMessage(updateError))
    setSelected(null)
    await load()
  }

  if (!supabase) return <Container sx={{ py: 8 }}><Alert severity="warning">Supabase is not configured.</Alert></Container>

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7fb', py: { xs: 3, md: 6 } }}>
      <Container maxWidth="xl">
        <Typography variant="overline" color="secondary.main" fontWeight={900} letterSpacing=".12em">Student financing</Typography>
        <Typography variant="h3" fontWeight={950}>Financing Referrals</Typography>
        <Typography color="text.secondary" sx={{ mt: 1, mb: 3, maxWidth: 850 }}>
          Students who opened Liberty Career Finance from their IMAN account. Liberty does not provide application-status data; statuses beyond “Sent to Liberty” are staff-entered or student-reported.
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}
        <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <TableContainer>
            <Table sx={{ minWidth: 900 }}>
              <TableHead><TableRow>
                {['Student', 'IMAN account', 'Training application', 'Referral status', 'Last opened', ''].map(label => <TableCell key={label} sx={{ fontWeight: 900 }}>{label}</TableCell>)}
              </TableRow></TableHead>
              <TableBody>
                {loading ? <TableRow><TableCell colSpan={6} align="center">Loading…</TableCell></TableRow>
                  : rows.length === 0 ? <TableRow><TableCell colSpan={6} align="center">No financing referrals yet.</TableCell></TableRow>
                  : rows.map(row => <TableRow key={row.id} hover>
                    <TableCell><Typography fontWeight={900}>{row.student?.first_name} {row.student?.last_name}</Typography><Typography variant="body2" color="text.secondary">{row.student?.email || 'No email'}</Typography><Typography variant="body2" color="text.secondary">{row.student?.phone}</Typography></TableCell>
                    <TableCell>{formatDate(row.student?.created_at)}</TableCell>
                    <TableCell>{row.application ? <><Typography fontWeight={800}>{row.application.reference_no}</Typography><Typography variant="body2" color="text.secondary">{row.application.status}</Typography></> : 'Not started'}</TableCell>
                    <TableCell><Chip size="small" label={STATUS_META[row.status].label} color={STATUS_META[row.status].color} /><Typography variant="caption" display="block" color="text.secondary" mt={0.5}>Opened {row.referral_count}×</Typography></TableCell>
                    <TableCell>{formatDateTime(row.last_referred_at)}</TableCell>
                    <TableCell><Button onClick={() => open(row)}>View</Button></TableCell>
                  </TableRow>)}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Container>

      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} fullWidth maxWidth="md">
        <DialogTitle fontWeight={950}>Student financing referral</DialogTitle>
        <DialogContent dividers>
          {selected && <Stack spacing={3}>
            <Alert severity="info">This is an IMAN referral record—not a Liberty approval, denial, or lender application status.</Alert>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2 }}>
              <Detail label="Student" value={`${selected.student?.first_name ?? ''} ${selected.student?.last_name ?? ''}`.trim()} />
              <Detail label="Email" value={selected.student?.email} />
              <Detail label="Phone" value={selected.student?.phone} />
              <Detail label="Date of birth" value={formatDate(selected.student?.date_of_birth)} />
              <Detail label="Address" value={[selected.student?.address_line1, selected.student?.address_line2, selected.student?.city, selected.student?.state, selected.student?.zip_code].filter(Boolean).join(', ')} />
              <Detail label="License" value={[selected.student?.license_type, selected.student?.license_number, selected.student?.license_state].filter(Boolean).join(' · ')} />
              <Detail label="IMAN account created" value={formatDateTime(selected.student?.created_at)} />
              <Detail label="First sent to Liberty" value={formatDateTime(selected.first_referred_at)} />
              <Detail label="Last opened Liberty" value={formatDateTime(selected.last_referred_at)} />
              <Detail label="Training application" value={selected.application ? `${selected.application.reference_no} · ${selected.application.status}` : 'Not started'} />
            </Box>
            <FormControl fullWidth><InputLabel>Referral status</InputLabel><Select value={status} label="Referral status" onChange={event => setStatus(event.target.value as ReferralStatus)}>{STATUSES.map(value => <MenuItem key={value} value={value}>{STATUS_META[value].label}</MenuItem>)}</Select></FormControl>
            <TextField label="Staff follow-up notes" multiline minRows={4} value={notes} onChange={event => setNotes(event.target.value)} inputProps={{ maxLength: 4000 }} />
          </Stack>}
        </DialogContent>
        <DialogActions><Button onClick={() => setSelected(null)}>Cancel</Button><Button variant="contained" color="secondary" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button></DialogActions>
      </Dialog>
    </Box>
  )
}
