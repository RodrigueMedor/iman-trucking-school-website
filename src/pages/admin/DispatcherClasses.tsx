import { useEffect, useState } from 'react'
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
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

type DispatcherClassRow = {
  id: string
  name: string
  description: string | null
  price_cents: number
  starts_at: string
  ends_at: string
  location: string | null
  schedule_notes: string | null
  seat_capacity: number | null
  open: boolean
  seats_taken: number
  seats_remaining: number | null
}

type ClassFormState = {
  id: string | null
  name: string
  description: string
  priceDollars: string
  startsAt: string
  endsAt: string
  location: string
  scheduleNotes: string
  seatCapacity: string
  open: boolean
}

const emptyForm: ClassFormState = {
  id: null,
  name: '',
  description: '',
  priceDollars: '520',
  startsAt: '',
  endsAt: '',
  location: '',
  scheduleNotes: '',
  seatCapacity: '',
  open: true,
}

function toDatetimeLocalValue(iso: string) {
  if (!iso) return ''
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function DispatcherClasses() {
  const [rows, setRows] = useState<DispatcherClassRow[]>([])
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<ClassFormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  const isMock = !supabase

  useEffect(() => {
    if (!isMock) loadData()
  }, [isMock])

  async function loadData() {
    setLoading(true)
    try {
      const { data, error: loadError } = await supabase!
        .from('cdl_dispatcher_classes_admin')
        .select('*')
        .order('starts_at', { ascending: false })

      if (loadError) throw loadError
      setRows((data || []) as DispatcherClassRow[])
    } catch (err: any) {
      setError(err?.message || 'Unable to load dispatcher classes.')
    }
    setLoading(false)
  }

  function openCreate() {
    setForm(emptyForm)
    setError('')
    setDialogOpen(true)
  }

  function openEdit(row: DispatcherClassRow) {
    setForm({
      id: row.id,
      name: row.name,
      description: row.description || '',
      priceDollars: (row.price_cents / 100).toFixed(2),
      startsAt: toDatetimeLocalValue(row.starts_at),
      endsAt: toDatetimeLocalValue(row.ends_at),
      location: row.location || '',
      scheduleNotes: row.schedule_notes || '',
      seatCapacity: row.seat_capacity != null ? String(row.seat_capacity) : '',
      open: row.open,
    })
    setError('')
    setDialogOpen(true)
  }

  async function save() {
    if (!form.name.trim() || !form.startsAt || !form.endsAt) {
      setError('Class name, start date, and end date are required.')
      return
    }

    const priceCents = Math.round(Number(form.priceDollars) * 100)
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      setError('Enter a valid price.')
      return
    }

    let seatCapacity: number | null = null
    if (form.seatCapacity.trim() !== '') {
      const parsed = Number(form.seatCapacity)
      if (!Number.isInteger(parsed) || parsed < 0) {
        setError('Seat capacity must be a whole number, or left blank for unlimited seats.')
        return
      }
      seatCapacity = parsed
    }

    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price_cents: priceCents,
        starts_at: new Date(form.startsAt).toISOString(),
        ends_at: new Date(form.endsAt).toISOString(),
        location: form.location.trim() || null,
        schedule_notes: form.scheduleNotes.trim() || null,
        seat_capacity: seatCapacity,
        open: form.open,
        updated_at: new Date().toISOString(),
      }

      if (form.id) {
        const { error: updateError } = await supabase!
          .from('cdl_dispatcher_classes')
          .update(payload)
          .eq('id', form.id)
        if (updateError) throw updateError
        setNotice('Class session updated.')
      } else {
        const { error: insertError } = await supabase!
          .from('cdl_dispatcher_classes')
          .insert(payload)
        if (insertError) throw insertError
        setNotice('Class session created.')
      }

      setDialogOpen(false)
      await loadData()
    } catch (err: any) {
      setError(err?.message || 'Unable to save this class session.')
    }
    setSaving(false)
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7fb', py: 6 }}>
      <Container maxWidth="xl">
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 4 }}>
          <Box>
            <Button component={Link} to="/admin/" sx={{ mb: 2 }}>
              ← Dashboard
            </Button>
            <Typography variant="h3" fontWeight={900}>Dispatcher Class Sessions</Typography>
          </Box>
          <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={openCreate}>
            New class session
          </Button>
        </Stack>

        {notice && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setNotice('')}>{notice}</Alert>}

        <Paper sx={{ borderRadius: 3 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 900 }}>Class</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Dates</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Location</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Price</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Seats</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Status</TableCell>
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
                    <TableCell colSpan={7} align="center">No dispatcher class sessions yet.</TableCell>
                  </TableRow>
                ) : (
                  rows.map(row => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Typography fontWeight="bold">{row.name}</Typography>
                        {row.schedule_notes && (
                          <Typography variant="body2" color="text.secondary">{row.schedule_notes}</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(row.starts_at).toLocaleDateString()} – {new Date(row.ends_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{row.location || '—'}</TableCell>
                      <TableCell>${(row.price_cents / 100).toFixed(2)}</TableCell>
                      <TableCell>
                        {row.seat_capacity == null
                          ? 'Unlimited'
                          : `${row.seats_remaining ?? 0} of ${row.seat_capacity} left`}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={row.open ? 'Open' : 'Closed'}
                          color={row.open ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => openEdit(row)}>
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{form.id ? 'Edit class session' : 'New class session'}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField
                label="Class name"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                required
                fullWidth
              />
              <TextField
                label="Description"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                multiline
                rows={2}
                fullWidth
              />
              <TextField
                label="Price (USD)"
                type="number"
                value={form.priceDollars}
                onChange={e => setForm({ ...form, priceDollars: e.target.value })}
                required
                fullWidth
              />
              <TextField
                label="Starts at"
                type="datetime-local"
                value={form.startsAt}
                onChange={e => setForm({ ...form, startsAt: e.target.value })}
                required
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="Ends at"
                type="datetime-local"
                value={form.endsAt}
                onChange={e => setForm({ ...form, endsAt: e.target.value })}
                required
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="Location"
                value={form.location}
                onChange={e => setForm({ ...form, location: e.target.value })}
                placeholder="e.g. Iman Trucking School — Orlando, FL Campus"
                fullWidth
              />
              <TextField
                label="Schedule notes"
                value={form.scheduleNotes}
                onChange={e => setForm({ ...form, scheduleNotes: e.target.value })}
                placeholder="e.g. Mon–Fri, 9am–3pm"
                fullWidth
              />
              <TextField
                label="Seat capacity (blank = unlimited)"
                type="number"
                value={form.seatCapacity}
                onChange={e => setForm({ ...form, seatCapacity: e.target.value })}
                fullWidth
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.open}
                    onChange={e => setForm({ ...form, open: e.target.checked })}
                  />
                }
                label="Open for registration"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" color="secondary" onClick={save} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  )
}

export default DispatcherClasses
