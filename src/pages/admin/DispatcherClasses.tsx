import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

type DispatcherClassRow = {
  id: string
  name: string
  description: string
  price_cents: number
  starts_at: string
  ends_at: string
  registration_deadline: string | null
  days_of_week: string
  class_time: string
  delivery_mode: 'online' | 'in_person' | ''
  location: string
  instructor_id: string | null
  instructor_name?: string | null
  seat_capacity: number | null
  status: 'OPEN' | 'FULL' | 'CLOSED' | 'COMPLETED'
  seats_taken?: number
  seats_remaining?: number | null
}

type Instructor = { id: string; display_name: string }

const mockKey = 'iman-mock-dispatcher-classes'

const emptyForm = {
  id: '',
  name: '',
  description: '',
  price: '',
  starts_at: '',
  ends_at: '',
  registration_deadline: '',
  days_of_week: '',
  class_time: '',
  delivery_mode: 'in_person' as 'online' | 'in_person',
  location: '',
  instructor_id: '',
  seat_capacity: '',
  status: 'OPEN' as DispatcherClassRow['status'],
}

// Local datetime-local inputs have no timezone; treat the value as the
// browser's local time and convert to/from ISO for storage, matching how
// the rest of the app stores timestamptz columns.
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocal(value: string): string | null {
  if (!value) return null
  return new Date(value).toISOString()
}

function statusColor(status: string) {
  switch (status) {
    case 'OPEN': return 'success'
    case 'FULL': return 'warning'
    case 'CLOSED': return 'default'
    case 'COMPLETED': return 'info'
    default: return 'default'
  }
}

export function DispatcherClasses() {
  const isMock = !supabase
  const [rows, setRows] = useState<DispatcherClassRow[]>([])
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    void loadData()
  }, [isMock])

  async function loadData() {
    setLoading(true)
    try {
      if (isMock) {
        const saved = JSON.parse(localStorage.getItem(mockKey) || '[]')
        setRows(saved)
      } else {
        const [{ data: classData, error: classError }, { data: instructorData }] = await Promise.all([
          supabase!
            .from('cdl_dispatcher_classes_admin')
            .select('*')
            .order('starts_at', { ascending: true }),
          supabase!
            .from('cdl_instructors')
            .select('id, display_name')
            .eq('active', true)
            .order('display_name'),
        ])
        if (classError) throw classError
        setRows((classData || []) as DispatcherClassRow[])
        setInstructors((instructorData || []) as Instructor[])
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load dispatcher class sessions')
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
      price: row.price_cents != null ? (row.price_cents / 100).toString() : '',
      starts_at: toDatetimeLocal(row.starts_at),
      ends_at: toDatetimeLocal(row.ends_at),
      registration_deadline: toDatetimeLocal(row.registration_deadline),
      days_of_week: row.days_of_week || '',
      class_time: row.class_time || '',
      delivery_mode: (row.delivery_mode || 'in_person') as 'online' | 'in_person',
      location: row.location || '',
      instructor_id: row.instructor_id || '',
      seat_capacity: row.seat_capacity != null ? String(row.seat_capacity) : '',
      status: row.status || 'OPEN',
    })
    setError('')
    setDialogOpen(true)
  }

  async function save() {
    if (!form.name.trim()) {
      setError('Session name is required.')
      return
    }
    if (!form.starts_at || !form.ends_at) {
      setError('Start and end dates are required.')
      return
    }
    const priceCents = Math.round(Number(form.price || 0) * 100)
    if (!Number.isInteger(priceCents) || priceCents < 0) {
      setError('Enter a valid price.')
      return
    }
    const seatCapacity = form.seat_capacity.trim() === '' ? null : Number(form.seat_capacity)
    if (seatCapacity != null && (!Number.isInteger(seatCapacity) || seatCapacity < 0)) {
      setError('Seat capacity must be a whole number, or blank for unlimited.')
      return
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price_cents: priceCents,
      starts_at: fromDatetimeLocal(form.starts_at),
      ends_at: fromDatetimeLocal(form.ends_at),
      registration_deadline: fromDatetimeLocal(form.registration_deadline),
      days_of_week: form.days_of_week.trim() || null,
      class_time: form.class_time.trim() || null,
      delivery_mode: form.delivery_mode,
      location: form.location.trim() || null,
      instructor_id: form.instructor_id || null,
      seat_capacity: seatCapacity,
      status: form.status,
      open: form.status === 'OPEN',
    }

    setLoading(true)
    setError('')
    try {
      if (isMock) {
        const saved: DispatcherClassRow[] = JSON.parse(localStorage.getItem(mockKey) || '[]')
        const instructorName = instructors.find(i => i.id === form.instructor_id)?.display_name || null
        if (form.id) {
          const updated = saved.map(r => (r.id === form.id ? { ...r, ...payload, id: form.id, instructor_name: instructorName } as DispatcherClassRow : r))
          localStorage.setItem(mockKey, JSON.stringify(updated))
          setRows(updated)
        } else {
          const newRow = { ...payload, id: `mock-${Date.now()}`, instructor_name: instructorName } as DispatcherClassRow
          const updated = [newRow, ...saved]
          localStorage.setItem(mockKey, JSON.stringify(updated))
          setRows(updated)
        }
        setNotice('Session saved (demo mode — not persisted to a database).')
      } else if (form.id) {
        const { error: updateError } = await supabase!
          .from('cdl_dispatcher_classes')
          .update(payload)
          .eq('id', form.id)
        if (updateError) throw updateError
        setNotice('Session updated successfully.')
        await loadData()
      } else {
        const { error: insertError } = await supabase!
          .from('cdl_dispatcher_classes')
          .insert(payload)
        if (insertError) throw insertError
        setNotice('Session created successfully.')
        await loadData()
      }
      setDialogOpen(false)
    } catch (err: any) {
      setError(err.message || 'Failed to save session')
    }
    setLoading(false)
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7fb', py: 6 }}>
      <Container maxWidth="xl">
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
          <Box>
            <Button component={Link} to="/admin/" sx={{ mb: 2 }}>
              ← Dashboard
            </Button>
            <Typography variant="h3" fontWeight={900}>Dispatcher Class Sessions</Typography>
            <Typography color="text.secondary">Manage upcoming dispatcher class sessions shown on the public registration page.</Typography>
          </Box>
          <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={openCreate}>
            Add session
          </Button>
        </Stack>

        {notice && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setNotice('')}>{notice}</Alert>}

        <Paper sx={{ borderRadius: 3 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 900 }}>Session</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Dates</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Instructor</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Price</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Seats</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} align="center">Loading...</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={7} align="center">No dispatcher class sessions yet.</TableCell></TableRow>
                ) : (
                  rows.map(row => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Typography fontWeight="bold">{row.name}</Typography>
                        {row.location && <Typography variant="body2" color="text.secondary">{row.location}</Typography>}
                      </TableCell>
                      <TableCell>
                        {row.starts_at ? new Date(row.starts_at).toLocaleDateString() : '—'}
                        {row.ends_at ? ` – ${new Date(row.ends_at).toLocaleDateString()}` : ''}
                      </TableCell>
                      <TableCell>{row.instructor_name || '—'}</TableCell>
                      <TableCell>${(row.price_cents / 100).toFixed(2)}</TableCell>
                      <TableCell>
                        {row.seat_capacity == null
                          ? 'Unlimited'
                          : `${row.seats_remaining ?? row.seat_capacity} / ${row.seat_capacity} left`}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={row.status} color={statusColor(row.status) as any} />
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

        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>{form.id ? 'Edit session' : 'Add session'}</DialogTitle>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2, mt: 1 }}>{error}</Alert>}
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid size={12}>
                <TextField
                  fullWidth
                  label="Session name"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  fullWidth
                  label="Description"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  multiline
                  rows={2}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  type="datetime-local"
                  label="Start date/time"
                  InputLabelProps={{ shrink: true }}
                  value={form.starts_at}
                  onChange={e => setForm({ ...form, starts_at: e.target.value })}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  type="datetime-local"
                  label="End date/time"
                  InputLabelProps={{ shrink: true }}
                  value={form.ends_at}
                  onChange={e => setForm({ ...form, ends_at: e.target.value })}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  type="datetime-local"
                  label="Registration deadline (optional)"
                  InputLabelProps={{ shrink: true }}
                  value={form.registration_deadline}
                  onChange={e => setForm({ ...form, registration_deadline: e.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Price (USD)"
                  type="number"
                  inputProps={{ min: 0, step: '0.01' }}
                  value={form.price}
                  onChange={e => setForm({ ...form, price: e.target.value })}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Days of week"
                  placeholder="e.g. Mon, Wed, Fri"
                  value={form.days_of_week}
                  onChange={e => setForm({ ...form, days_of_week: e.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Class time"
                  placeholder="e.g. 6:00 PM – 9:00 PM"
                  value={form.class_time}
                  onChange={e => setForm({ ...form, class_time: e.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Delivery mode</InputLabel>
                  <Select
                    label="Delivery mode"
                    value={form.delivery_mode}
                    onChange={e => setForm({ ...form, delivery_mode: e.target.value as 'online' | 'in_person' })}
                  >
                    <MenuItem value="in_person">In-person</MenuItem>
                    <MenuItem value="online">Online</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={12}>
                <TextField
                  fullWidth
                  label="Location"
                  placeholder={form.delivery_mode === 'online' ? 'e.g. Zoom link sent after registration' : 'e.g. Iman Trucking School — Orlando, FL Campus'}
                  value={form.location}
                  onChange={e => setForm({ ...form, location: e.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Instructor</InputLabel>
                  <Select
                    label="Instructor"
                    value={form.instructor_id}
                    onChange={e => setForm({ ...form, instructor_id: e.target.value })}
                  >
                    <MenuItem value="">Unassigned</MenuItem>
                    {instructors.map(i => (
                      <MenuItem key={i.id} value={i.id}>{i.display_name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <TextField
                  fullWidth
                  label="Seat capacity"
                  type="number"
                  inputProps={{ min: 0, step: 1 }}
                  placeholder="Unlimited"
                  value={form.seat_capacity}
                  onChange={e => setForm({ ...form, seat_capacity: e.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    label="Status"
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value as DispatcherClassRow['status'] })}
                  >
                    <MenuItem value="OPEN">Open</MenuItem>
                    <MenuItem value="FULL">Full</MenuItem>
                    <MenuItem value="CLOSED">Closed</MenuItem>
                    <MenuItem value="COMPLETED">Completed</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" color="secondary" onClick={save} disabled={loading}>
              {loading ? 'Saving...' : 'Save session'}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  )
}

export default DispatcherClasses
