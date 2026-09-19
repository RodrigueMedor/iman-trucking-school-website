import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Container,
  Paper,
  Stack,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import PendingIcon from '@mui/icons-material/Pending'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

type DispatcherRegistration = {
  id: string
  registrationNo: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  address1: string
  address2?: string
  city: string
  state: string
  zip: string
  status: 'SUBMITTED' | 'CONFIRMED' | 'CANCELED'
  paymentStatus?: 'not_required' | 'pending' | 'processing' | 'paid' | 'failed' | 'canceled' | 'refunded'
  paymentId?: string
  staffNotes?: string
  submittedAt: string
  className: string
  paymentPolicySignature?: string
  paymentPolicyAcceptedAt?: string
}

const mockKey = 'iman-mock-dispatcher-registrations'

export function DispatcherRegistrations() {
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [rows, setRows] = useState<DispatcherRegistration[]>([])
  const [reviewDialog, setReviewDialog] = useState(false)
  const [selected, setSelected] = useState<DispatcherRegistration | null>(null)
  const [reviewForm, setReviewForm] = useState({ status: '', staffNotes: '' })

  const isMock = !supabase

  useEffect(() => {
    if (isMock) {
      const saved = localStorage.getItem(mockKey)
      if (saved) {
        setRows(
          (JSON.parse(saved) as any[]).map(r => ({
            id: r.id,
            registrationNo: r.registration_no || r.registrationNo,
            firstName: r.first_name || r.firstName,
            lastName: r.last_name || r.lastName,
            email: r.email,
            phone: r.phone,
            address1: r.address_line1 || r.address1,
            address2: r.address_line2 || r.address2,
            city: r.city,
            state: r.state,
            zip: r.zip_code || r.zip,
            status: r.status,
            paymentStatus: r.payment_status,
            paymentId: r.payment_id,
            staffNotes: r.staff_notes,
            submittedAt: r.submitted_at || r.submittedAt,
            className: r.className || '',
            paymentPolicySignature: r.payment_policy_signature || r.paymentPolicySignature,
            paymentPolicyAcceptedAt: r.payment_policy_accepted_at || r.paymentPolicyAcceptedAt,
          }))
        )
      }
    } else {
      loadData()
    }
  }, [isMock, statusFilter, searchQuery])

  async function loadData() {
    setLoading(true)
    try {
      let query = supabase!
        .from('cdl_dispatcher_registrations')
        .select(`
          *,
          class:cdl_dispatcher_classes(id, name)
        `)
        .order('created_at', { ascending: false })

      if (statusFilter) query = query.eq('status', statusFilter)
      if (searchQuery) {
        query = query.or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,registration_no.ilike.%${searchQuery}%`)
      }

      const { data, error } = await query
      if (!error && data) {
        setRows(data.map(row => ({
          id: row.id,
          registrationNo: row.registration_no,
          firstName: row.first_name,
          lastName: row.last_name,
          email: row.email,
          phone: row.phone,
          address1: row.address_line1,
          address2: row.address_line2,
          city: row.city,
          state: row.state,
          zip: row.zip_code,
          status: row.status,
          paymentStatus: row.payment_status,
          paymentId: row.payment_id,
          staffNotes: row.staff_notes,
          submittedAt: row.submitted_at,
          className: row.class?.name || '—',
          paymentPolicySignature: row.payment_policy_signature,
          paymentPolicyAcceptedAt: row.payment_policy_accepted_at,
        })))
      }
    } catch {}
    setLoading(false)
  }

  async function updateStatus() {
    if (!selected) return
    setLoading(true)
    try {
      if (isMock) {
        const updated = rows.map(r =>
          r.id === selected.id
            ? { ...r, status: reviewForm.status as any, staffNotes: reviewForm.staffNotes }
            : r
        )
        setRows(updated)
        setNotice('Registration status updated successfully.')
      } else {
        const { error } = await supabase!
          .from('cdl_dispatcher_registrations')
          .update({
            status: reviewForm.status as any,
            staff_notes: reviewForm.staffNotes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selected.id)

        if (error) throw error
        await loadData()
        setNotice('Registration status updated successfully.')
      }
      setReviewDialog(false)
      setSelected(null)
      setReviewForm({ status: '', staffNotes: '' })
    } catch {
      setNotice('An error occurred. Please try again.')
    }
    setLoading(false)
  }

  function openReview(row: DispatcherRegistration) {
    setSelected(row)
    setReviewForm({ status: row.status, staffNotes: row.staffNotes || '' })
    setReviewDialog(true)
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'CONFIRMED': return 'success'
      case 'CANCELED': return 'error'
      case 'SUBMITTED': return 'warning'
      default: return 'default'
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'CONFIRMED': return <CheckCircleIcon />
      case 'CANCELED': return <CancelIcon />
      default: return <PendingIcon />
    }
  }

  function getPaymentStatusColor(status?: string) {
    switch (status) {
      case 'paid': return 'success'
      case 'failed': return 'error'
      case 'canceled': return 'error'
      case 'processing': return 'info'
      case 'pending': return 'warning'
      default: return 'default'
    }
  }

  function getPaymentStatusIcon(status?: string) {
    switch (status) {
      case 'paid': return <CheckCircleIcon />
      case 'failed': return <CancelIcon />
      case 'canceled': return <CancelIcon />
      case 'processing': return <PendingIcon />
      case 'pending': return <PendingIcon />
      default: return undefined
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7fb', py: 6 }}>
      <Container maxWidth="xl">
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
          <Box>
            <Button component={Link} to="/admin/" sx={{ mb: 2 }}>
              ← Dashboard
            </Button>
            <Typography variant="h3" fontWeight={900}>Dispatcher Registrations</Typography>
          </Box>
        </Stack>

        <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} gap={2}>
            <TextField
              fullWidth
              placeholder="Search by name, email, or registration number..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Status Filter</InputLabel>
              <Select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                label="Status Filter"
              >
                <MenuItem value="">All Statuses</MenuItem>
                <MenuItem value="SUBMITTED">Submitted</MenuItem>
                <MenuItem value="CONFIRMED">Confirmed</MenuItem>
                <MenuItem value="CANCELED">Canceled</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </Paper>

        {notice && <Alert severity="info" sx={{ mb: 3 }}>{notice}</Alert>}

        <Paper sx={{ borderRadius: 3 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 900 }}>Registration #</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Registrant</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Class</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Payment</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Submitted</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">Loading...</TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">No dispatcher registrations found.</TableCell>
                  </TableRow>
                ) : (
                  rows.map(row => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Typography fontWeight="bold">{row.registrationNo}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography fontWeight="bold">{row.firstName} {row.lastName}</Typography>
                        <Typography variant="body2" color="text.secondary">{row.email}</Typography>
                        {row.phone && <Typography variant="body2" color="text.secondary">{row.phone}</Typography>}
                      </TableCell>
                      <TableCell>{row.className}</TableCell>
                      <TableCell>
                        <Chip
                          icon={getStatusIcon(row.status)}
                          label={row.status}
                          color={getStatusColor(row.status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {row.paymentStatus && row.paymentStatus !== 'not_required' ? (
                          <Chip
                            icon={getPaymentStatusIcon(row.paymentStatus)}
                            label={row.paymentStatus}
                            color={getPaymentStatusColor(row.paymentStatus) as any}
                            size="small"
                          />
                        ) : (
                          <Typography variant="body2" color="text.secondary">—</Typography>
                        )}
                      </TableCell>
                      <TableCell>{new Date(row.submittedAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button size="small" variant="outlined" onClick={() => openReview(row)}>
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Dialog open={reviewDialog} onClose={() => setReviewDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>Review Dispatcher Registration</DialogTitle>
          <DialogContent>
            {selected && (
              <Stack spacing={2} sx={{ mt: 2 }}>
                <Typography><strong>Registration #:</strong> {selected.registrationNo}</Typography>
                <Typography><strong>Registrant:</strong> {selected.firstName} {selected.lastName}</Typography>
                <Typography><strong>Email:</strong> {selected.email}</Typography>
                {selected.phone && <Typography><strong>Phone:</strong> {selected.phone}</Typography>}
                <Typography>
                  <strong>Address:</strong> {selected.address1}
                  {selected.address2 ? `, ${selected.address2}` : ''}, {selected.city}, {selected.state} {selected.zip}
                </Typography>
                <Typography><strong>Class:</strong> {selected.className}</Typography>
                {selected.paymentPolicySignature && (
                  <Typography>
                    <strong>Payment policy signature:</strong> {selected.paymentPolicySignature}
                    {selected.paymentPolicyAcceptedAt
                      ? ` (${new Date(selected.paymentPolicyAcceptedAt).toLocaleString()})`
                      : ''}
                  </Typography>
                )}
                {selected.paymentStatus && selected.paymentStatus !== 'not_required' && (
                  <Box>
                    <Typography fontWeight="bold" gutterBottom>Payment Status:</Typography>
                    <Chip
                      icon={getPaymentStatusIcon(selected.paymentStatus)}
                      label={selected.paymentStatus}
                      color={getPaymentStatusColor(selected.paymentStatus) as any}
                      size="small"
                    />
                  </Box>
                )}
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={reviewForm.status}
                    onChange={e => setReviewForm({ ...reviewForm, status: e.target.value })}
                    label="Status"
                  >
                    <MenuItem value="SUBMITTED">Submitted</MenuItem>
                    <MenuItem value="CONFIRMED">Confirmed</MenuItem>
                    <MenuItem value="CANCELED">Canceled</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Staff Notes"
                  value={reviewForm.staffNotes}
                  onChange={e => setReviewForm({ ...reviewForm, staffNotes: e.target.value })}
                />
              </Stack>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setReviewDialog(false)}>Cancel</Button>
            <Button variant="contained" color="secondary" onClick={updateStatus} disabled={loading}>
              {loading ? 'Updating...' : 'Update Status'}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  )
}

export default DispatcherRegistrations