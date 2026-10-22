import { useCallback, useEffect, useState } from 'react'
import { Alert, Box, Button, Chip, Container, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material'
import EditRounded from '@mui/icons-material/EditRounded'
import { listCoursePricing, toMessage, updateCoursePricing, type CoursePricing as Course } from '../../portal/api'
import { formatDateTime } from '../../portal/ui'

const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((value || 0) / 100)
const toCents = (value: string) => Math.round(Number(value) * 100)
const dollars = (cents: number) => cents ? String(cents / 100) : ''

function PricingDialog({ course, onClose, onSaved }: { course: Course; onClose: () => void; onSaved: (course: Course) => void }) {
  const [tuition, setTuition] = useState(dollars(course.tuition_cents))
  const [deposit, setDeposit] = useState(dollars(course.deposit_cents))
  const [count, setCount] = useState(String(course.installment_count || 1))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    const tuitionCents = toCents(tuition || '0')
    const depositCents = toCents(deposit || '0')
    const installmentCount = Number(count)
    if (!Number.isInteger(tuitionCents) || tuitionCents < 0) return setError('Enter a valid tuition amount.')
    if (!Number.isInteger(depositCents) || depositCents < 0 || depositCents > tuitionCents) return setError('The deposit must be between $0 and the tuition.')
    if (!Number.isInteger(installmentCount) || installmentCount < 1 || installmentCount > 24) return setError('Installments must be a whole number from 1 to 24.')
    setBusy(true); setError('')
    try {
      onSaved(await updateCoursePricing(course.id, { tuitionCents, depositCents, installmentCount }))
    } catch (err) {
      setError(toMessage(err)); setBusy(false)
    }
  }

  const tuitionCents = toCents(tuition || '0')
  const depositCents = toCents(deposit || '0')
  const installmentCount = Number(count) || 1
  const each = installmentCount > 1 ? Math.floor(Math.max(tuitionCents - depositCents, 0) / installmentCount) : 0

  return <Dialog open onClose={() => !busy && onClose()} fullWidth maxWidth="sm">
    <DialogTitle fontWeight={950}>Edit pricing · {course.name}</DialogTitle>
    <DialogContent><Stack spacing={2.5} mt={1}>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField label="Tuition" type="number" value={tuition} onChange={event => setTuition(event.target.value)} inputProps={{ min: 0, step: '.01' }}
        InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} helperText="Set to 0 to hide card payment for this course." />
      <TextField label="Deposit (optional)" type="number" value={deposit} onChange={event => setDeposit(event.target.value)} inputProps={{ min: 0, step: '.01' }}
        InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} helperText="Leave empty for full payment only." />
      <TextField label="Number of installments" type="number" value={count} onChange={event => setCount(event.target.value)} inputProps={{ min: 1, max: 24 }}
        helperText={installmentCount > 1 ? `About ${money(each)} each after the deposit.` : 'Use 1 for no installment plan.'} />
      <Alert severity="info">Students see the new price right away. Tuition accounts that are already open keep the price the student agreed to.</Alert>
    </Stack></DialogContent>
    <DialogActions><Button onClick={onClose} disabled={busy}>Cancel</Button><Button variant="contained" color="secondary" onClick={() => void save()} disabled={busy}>{busy ? 'Saving…' : 'Save pricing'}</Button></DialogActions>
  </Dialog>
}

export function CoursePricing() {
  const [courses, setCourses] = useState<Course[] | null>(null)
  const [editing, setEditing] = useState<Course | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    try { setCourses(await listCoursePricing()) } catch (err) { setError(toMessage(err)); setCourses([]) }
  }, [])
  useEffect(() => { void load() }, [load])

  const saved = (course: Course) => {
    setCourses(rows => (rows || []).map(row => row.id === course.id ? course : row))
    setEditing(null)
    setNotice(`${course.name} now costs ${money(course.tuition_cents)}.`)
  }

  return <Box sx={{ py: { xs: 3, md: 6 } }}><Container maxWidth="xl">
    <Box mb={3}><Typography variant="overline" color="secondary.main" fontWeight={900}>Student billing</Typography><Typography variant="h3" fontWeight={950}>Course Pricing</Typography><Typography color="text.secondary">Set the tuition students pay by card in their portal. Changes apply to new tuition accounts immediately.</Typography></Box>
    {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setNotice('')}>{notice}</Alert>}
    <Paper sx={{ overflowX: 'auto' }}><Table sx={{ minWidth: 800 }}><TableHead><TableRow>{['Course', 'Tuition', 'Deposit', 'Installments', 'Card payment', 'Last updated', ''].map(name => <TableCell key={name} sx={{ fontWeight: 900 }}>{name}</TableCell>)}</TableRow></TableHead><TableBody>
      {courses === null ? <TableRow><TableCell colSpan={7} align="center">Loading…</TableCell></TableRow>
        : courses.length ? courses.map(course => <TableRow key={course.id} hover>
          <TableCell><Typography fontWeight={900}>{course.name}</Typography><Typography variant="body2" color="text.secondary">{course.code}{course.active ? '' : ' · inactive'}</Typography></TableCell>
          <TableCell sx={{ fontWeight: 900 }}>{money(course.tuition_cents)}</TableCell>
          <TableCell>{course.deposit_cents ? money(course.deposit_cents) : '—'}</TableCell>
          <TableCell>{course.installments_enabled ? course.installment_count : '—'}</TableCell>
          <TableCell><Chip size="small" label={course.active && course.tuition_cents > 0 ? 'Offered' : 'Hidden'} color={course.active && course.tuition_cents > 0 ? 'success' : 'default'} /></TableCell>
          <TableCell>{formatDateTime(course.updated_at)}</TableCell>
          <TableCell align="right"><Button size="small" startIcon={<EditRounded />} onClick={() => setEditing(course)}>Edit</Button></TableCell>
        </TableRow>) : <TableRow><TableCell colSpan={7} align="center">No courses yet.</TableCell></TableRow>}
    </TableBody></Table></Paper>
    {editing && <PricingDialog course={editing} onClose={() => setEditing(null)} onSaved={saved} />}
  </Container></Box>
}
