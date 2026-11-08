import { useCallback, useEffect, useState } from 'react'
import { Alert, Box, Button, Chip, Container, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, InputAdornment, Paper, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material'
import AddRounded from '@mui/icons-material/AddRounded'
import TuneRounded from '@mui/icons-material/TuneRounded'
import EditRounded from '@mui/icons-material/EditRounded'
import HistoryRounded from '@mui/icons-material/HistoryRounded'
import { createCourse, getCoursePricingHistory, listCoursePricing, listSessions, saveSession, toMessage, updateCourseDetails, updateCoursePricing, type AdminSession, type CoursePricing as Course, type CoursePricingVersion } from '../../portal/api'
import { formatDateTime } from '../../portal/ui'

const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((value || 0) / 100)
const toCents = (value: string) => Math.round(Number(value) * 100)
const dollars = (cents: number) => cents ? String(cents / 100) : ''

const FEE_FIELDS = [
  ['training_cents', 'trainingCents', 'CDL Training - Sale Price'],
  ['testing_fee_cents', 'testingFeeCents', 'Testing Fee'],
  ['administrative_fee_cents', 'administrativeFeeCents', 'Administrative Fee'],
  ['materials_fee_cents', 'materialsFeeCents', 'Materials Fee'],
] as const

function PricingDialog({ course, onClose, onSaved }: { course: Course; onClose: () => void; onSaved: (course: Course) => void }) {
  const [fees, setFees] = useState<Record<string, string>>(() => Object.fromEntries(FEE_FIELDS.map(([column]) => [column, dollars(course[column])])))
  const [housing, setHousing] = useState(dollars(course.housing_fee_cents))
  const [deposit, setDeposit] = useState(dollars(course.deposit_cents))
  const [count, setCount] = useState(String(course.installment_count || 1))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const feeCents = FEE_FIELDS.map(([column]) => toCents(fees[column] || '0'))
  const totalCents = feeCents.reduce((sum, value) => sum + (Number.isInteger(value) ? value : 0), 0)
  const housingCents = toCents(housing || '0')
  const depositCents = toCents(deposit || '0')
  const installmentCount = Number(count) || 1
  const each = installmentCount > 1 ? Math.floor(Math.max(totalCents - depositCents, 0) / installmentCount) : 0

  const save = async () => {
    if (feeCents.some(value => !Number.isInteger(value) || value < 0) || !Number.isInteger(housingCents) || housingCents < 0) return setError('Enter each fee as a dollar amount of $0 or more.')
    if (!Number.isInteger(depositCents) || depositCents < 0 || depositCents > totalCents) return setError('The deposit must be between $0 and the total without housing.')
    if (!Number.isInteger(installmentCount) || installmentCount < 1 || installmentCount > 24) return setError('Installments must be a whole number from 1 to 24.')
    setBusy(true); setError('')
    try {
      const [trainingCents, testingFeeCents, administrativeFeeCents, materialsFeeCents] = feeCents
      onSaved(await updateCoursePricing(course.id, { trainingCents, testingFeeCents, administrativeFeeCents, materialsFeeCents, housingFeeCents: housingCents, depositCents, installmentCount }))
    } catch (err) {
      setError(toMessage(err)); setBusy(false)
    }
  }

  const dollarField = (label: string, value: string, onChange: (value: string) => void, helperText?: string) => <TextField label={label} type="number" value={value} onChange={event => onChange(event.target.value)}
    inputProps={{ min: 0, step: '.01' }} InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} helperText={helperText} />

  return <Dialog open onClose={() => !busy && onClose()} fullWidth maxWidth="sm">
    <DialogTitle fontWeight={950}>Edit pricing · {course.name}</DialogTitle>
    <DialogContent><Stack spacing={2.5} mt={1}>
      {error && <Alert severity="error">{error}</Alert>}
      {FEE_FIELDS.map(([column, , label]) => <Box key={column}>{dollarField(column === 'training_cents' && course.training_fee_label ? course.training_fee_label : label, fees[column], value => setFees(current => ({ ...current, [column]: value })))}</Box>)}
      <Box sx={{ bgcolor: '#f5f5f8', borderRadius: 2, px: 2, py: 1.5 }}>
        <Typography fontWeight={900}>Total without housing: {money(totalCents)}</Typography>
        <Typography variant="body2" color="text.secondary">Total with housing: {money(totalCents + (housingCents || 0))}. Set the training price to 0 to hide card payment for this course.</Typography>
      </Box>
      {dollarField('Optional housing', housing, setHousing, 'Students can add this at checkout. Leave empty if housing is not offered.')}
      {dollarField('Deposit (optional)', deposit, setDeposit, 'Leave empty for full payment only.')}
      <TextField label="Number of installments" type="number" value={count} onChange={event => setCount(event.target.value)} inputProps={{ min: 1, max: 24 }}
        helperText={installmentCount > 1 ? `About ${money(each)} each after the deposit (more with housing).` : 'Use 1 for no installment plan.'} />
      <Alert severity="info">Students see the new price right away. Tuition accounts that are already open, signed agreements and receipts keep the price the student agreed to. Every change is saved in the pricing history.</Alert>
    </Stack></DialogContent>
    <DialogActions><Button onClick={onClose} disabled={busy}>Cancel</Button><Button variant="contained" color="secondary" onClick={() => void save()} disabled={busy}>{busy ? 'Saving…' : 'Save pricing'}</Button></DialogActions>
  </Dialog>
}

/** Create a course or edit its name, description, fee label and availability. */
function CourseDialog({ course, onClose, onSaved }: { course: Course | null; onClose: () => void; onSaved: (course: Course, created: boolean) => void }) {
  const [code, setCode] = useState('')
  const [name, setName] = useState(course?.name ?? '')
  const [description, setDescription] = useState(course?.description ?? '')
  const [feeLabel, setFeeLabel] = useState(course?.training_fee_label ?? '')
  const [active, setActive] = useState(course?.active ?? false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true); setError('')
    try {
      const input = { name, description, trainingFeeLabel: feeLabel, active }
      onSaved(course ? await updateCourseDetails(course.id, input) : await createCourse({ ...input, code }), !course)
    } catch (err) {
      setError(toMessage(err)); setBusy(false)
    }
  }

  return <Dialog open onClose={() => !busy && onClose()} fullWidth maxWidth="sm">
    <DialogTitle fontWeight={950}>{course ? `Course details · ${course.name}` : 'Add a course'}</DialogTitle>
    <DialogContent><Stack spacing={2.5} mt={1}>
      {error && <Alert severity="error">{error}</Alert>}
      {!course && <TextField label="Course code" value={code} onChange={event => setCode(event.target.value.toUpperCase())} helperText="Short unique code, for example FORKLIFT. It cannot be changed later." inputProps={{ maxLength: 30 }} />}
      <TextField label="Course name" value={name} onChange={event => setName(event.target.value)} helperText="Shown to students in the application, billing and receipts." inputProps={{ maxLength: 120 }} />
      <TextField label="Short description" value={description} onChange={event => setDescription(event.target.value)} multiline minRows={2} helperText="Shown under the course name when students choose a program." inputProps={{ maxLength: 500 }} />
      <TextField label="Training fee label" value={feeLabel} onChange={event => setFeeLabel(event.target.value)} placeholder="CDL Training - Sale Price" helperText="Name of the training line on the price sheet and receipts. Leave empty for “CDL Training - Sale Price”." inputProps={{ maxLength: 80 }} />
      <FormControlLabel control={<Switch checked={active} onChange={event => setActive(event.target.checked)} color="secondary" />} label={<Box><Typography fontWeight={800}>Offer this course</Typography><Typography variant="body2" color="text.secondary">Shows it on the website price sheets and in the training application. Students can pay by card once its price is above $0.</Typography></Box>} />
      {!course && <Alert severity="info">New courses start at $0. After saving, use Edit pricing to set the fees.</Alert>}
    </Stack></DialogContent>
    <DialogActions><Button onClick={onClose} disabled={busy}>Cancel</Button><Button variant="contained" color="secondary" onClick={() => void save()} disabled={busy}>{busy ? 'Saving…' : course ? 'Save details' : 'Add course'}</Button></DialogActions>
  </Dialog>
}

const toDateInput = (value: string) => value.slice(0, 10)

/** Create or edit a start session offered in the training application. */
function SessionDialog({ session, onClose, onSaved }: { session: AdminSession | null; onClose: () => void; onSaved: (session: AdminSession) => void }) {
  const [name, setName] = useState(session?.name ?? '')
  const [startsOn, setStartsOn] = useState(session ? toDateInput(session.starts_at) : '')
  const [endsOn, setEndsOn] = useState(session ? toDateInput(session.ends_at) : '')
  const [open, setOpen] = useState(session?.open ?? true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true); setError('')
    try { onSaved(await saveSession(session?.id ?? null, { name, startsOn, endsOn, open })) } catch (err) { setError(toMessage(err)); setBusy(false) }
  }
  return <Dialog open onClose={() => !busy && onClose()} fullWidth maxWidth="sm">
    <DialogTitle fontWeight={950}>{session ? `Edit session · ${session.name}` : 'Add a start session'}</DialogTitle>
    <DialogContent><Stack spacing={2.5} mt={1}>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField label="Session name" value={name} onChange={event => setName(event.target.value)} helperText="For example: January 2027 Weekday Class" inputProps={{ maxLength: 120 }} />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField label="Start date" type="date" value={startsOn} onChange={event => setStartsOn(event.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
        <TextField label="End date" type="date" value={endsOn} onChange={event => setEndsOn(event.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
      </Stack>
      <FormControlLabel control={<Switch checked={open} onChange={event => setOpen(event.target.checked)} color="secondary" />} label={<Box><Typography fontWeight={800}>Open for applications</Typography><Typography variant="body2" color="text.secondary">Students can pick open sessions in the training application. Close a session instead of deleting it; existing applications keep it.</Typography></Box>} />
    </Stack></DialogContent>
    <DialogActions><Button onClick={onClose} disabled={busy}>Cancel</Button><Button variant="contained" color="secondary" onClick={() => void save()} disabled={busy}>{busy ? 'Saving…' : 'Save session'}</Button></DialogActions>
  </Dialog>
}

function HistoryDialog({ course, onClose }: { course: Course; onClose: () => void }) {
  const [versions, setVersions] = useState<CoursePricingVersion[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { getCoursePricingHistory(course.id).then(setVersions).catch(err => { setError(toMessage(err)); setVersions([]) }) }, [course.id])

  return <Dialog open onClose={onClose} fullWidth maxWidth="md">
    <DialogTitle fontWeight={950}>Pricing history · {course.name}</DialogTitle>
    <DialogContent>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box sx={{ overflowX: 'auto' }}><Table size="small" sx={{ minWidth: 760 }}><TableHead><TableRow>{['Version', 'Training', 'Testing', 'Admin', 'Materials', 'Total', 'Housing', 'Effective', 'Changed by'].map(name => <TableCell key={name} sx={{ fontWeight: 900 }}>{name}</TableCell>)}</TableRow></TableHead><TableBody>
        {versions === null ? <TableRow><TableCell colSpan={9} align="center">Loading…</TableCell></TableRow>
          : versions.map(row => <TableRow key={row.id}>
            <TableCell>v{row.version}</TableCell><TableCell>{money(row.training_cents)}</TableCell><TableCell>{money(row.testing_fee_cents)}</TableCell>
            <TableCell>{money(row.administrative_fee_cents)}</TableCell><TableCell>{money(row.materials_fee_cents)}</TableCell>
            <TableCell sx={{ fontWeight: 900 }}>{money(row.tuition_cents)}</TableCell><TableCell>{row.housing_fee_cents ? money(row.housing_fee_cents) : '—'}</TableCell>
            <TableCell>{formatDateTime(row.effective_at)}</TableCell><TableCell>{row.created_by_name || 'System'}</TableCell>
          </TableRow>)}
      </TableBody></Table></Box>
    </DialogContent>
    <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
  </Dialog>
}

export function CoursePricing() {
  const [courses, setCourses] = useState<Course[] | null>(null)
  const [editing, setEditing] = useState<Course | null>(null)
  const [history, setHistory] = useState<Course | null>(null)
  const [details, setDetails] = useState<Course | 'new' | null>(null)
  const [sessions, setSessions] = useState<AdminSession[] | null>(null)
  const [editingSession, setEditingSession] = useState<AdminSession | 'new' | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    try { setCourses(await listCoursePricing()) } catch (err) { setError(toMessage(err)); setCourses([]) }
    try { setSessions(await listSessions()) } catch (err) { setError(toMessage(err)); setSessions([]) }
  }, [])

  const detailsSaved = (course: Course, created: boolean) => {
    setCourses(rows => created ? [...(rows || []), course].sort((a, b) => a.name.localeCompare(b.name)) : (rows || []).map(row => row.id === course.id ? course : row))
    setDetails(null)
    setNotice(created ? `${course.name} was added. Set its price with Edit pricing${course.active ? '' : ', then turn on Offer this course'}.` : `${course.name} was updated${course.active ? '' : ' and is not offered to students'}.`)
  }
  const sessionSaved = (session: AdminSession) => {
    setSessions(rows => {
      const list = rows || []
      return list.some(row => row.id === session.id) ? list.map(row => row.id === session.id ? session : row) : [session, ...list]
    })
    setEditingSession(null)
    setNotice(`Session “${session.name}” saved${session.open ? ' and open for applications' : ' (closed)'}.`)
  }
  useEffect(() => { void load() }, [load])

  const saved = (course: Course) => {
    setCourses(rows => (rows || []).map(row => row.id === course.id ? course : row))
    setEditing(null)
    setNotice(`${course.name} now costs ${money(course.tuition_cents)}${course.housing_fee_cents ? `, or ${money(course.tuition_cents + course.housing_fee_cents)} with housing` : ''} (pricing v${course.pricing_version}).`)
  }

  return <Box sx={{ py: { xs: 3, md: 6 } }}><Container maxWidth="xl">
    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-end' }} spacing={2} mb={3}>
      <Box><Typography variant="overline" color="secondary.main" fontWeight={900}>Student billing</Typography><Typography variant="h3" fontWeight={950}>Courses & Pricing</Typography><Typography color="text.secondary">Add training programs, choose which ones students can apply and pay for, and set their fees. Price changes apply to new tuition accounts immediately; existing accounts keep their price.</Typography></Box>
      <Button variant="contained" color="secondary" startIcon={<AddRounded />} onClick={() => setDetails('new')} sx={{ flex: '0 0 auto' }}>Add course</Button>
    </Stack>
    {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setNotice('')}>{notice}</Alert>}
    <Paper sx={{ overflowX: 'auto' }}><Table sx={{ minWidth: 980 }}><TableHead><TableRow>{['Course', 'Fees', 'Total', 'Housing', 'Deposit', 'Installments', 'Card payment', 'Version', ''].map(name => <TableCell key={name} sx={{ fontWeight: 900 }}>{name}</TableCell>)}</TableRow></TableHead><TableBody>
      {courses === null ? <TableRow><TableCell colSpan={9} align="center">Loading…</TableCell></TableRow>
        : courses.length ? courses.map(course => <TableRow key={course.id} hover>
          <TableCell><Typography fontWeight={900}>{course.name}</Typography><Typography variant="body2" color="text.secondary">{course.code}{course.active ? '' : ' · inactive'}</Typography></TableCell>
          <TableCell><Typography variant="body2" color="text.secondary" whiteSpace="nowrap">{money(course.training_cents)} training<br />{money(course.testing_fee_cents + course.administrative_fee_cents + course.materials_fee_cents)} fees</Typography></TableCell>
          <TableCell sx={{ fontWeight: 900 }}>{money(course.tuition_cents)}</TableCell>
          <TableCell>{course.housing_fee_cents ? `+ ${money(course.housing_fee_cents)}` : '—'}</TableCell>
          <TableCell>{course.deposit_cents ? money(course.deposit_cents) : '—'}</TableCell>
          <TableCell>{course.installments_enabled ? course.installment_count : '—'}</TableCell>
          <TableCell><Chip size="small" label={course.active && course.tuition_cents > 0 ? 'Offered' : 'Hidden'} color={course.active && course.tuition_cents > 0 ? 'success' : 'default'} /></TableCell>
          <TableCell>v{course.pricing_version}<Typography variant="body2" color="text.secondary">{formatDateTime(course.pricing_effective_at)}</Typography></TableCell>
          <TableCell align="right"><Stack direction="row" justifyContent="flex-end"><Button size="small" startIcon={<TuneRounded />} onClick={() => setDetails(course)}>Details</Button><Button size="small" startIcon={<HistoryRounded />} onClick={() => setHistory(course)}>History</Button><Button size="small" startIcon={<EditRounded />} onClick={() => setEditing(course)}>Edit pricing</Button></Stack></TableCell>
        </TableRow>) : <TableRow><TableCell colSpan={9} align="center">No courses yet.</TableCell></TableRow>}
    </TableBody></Table></Paper>

    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-end' }} spacing={2} mt={6} mb={2}>
      <Box><Typography variant="h5" fontWeight={950}>Start sessions</Typography><Typography color="text.secondary">Students choose an open session when they apply for training. Sessions apply to every course.</Typography></Box>
      <Button variant="outlined" startIcon={<AddRounded />} onClick={() => setEditingSession('new')} sx={{ flex: '0 0 auto' }}>Add session</Button>
    </Stack>
    <Paper sx={{ overflowX: 'auto' }}><Table sx={{ minWidth: 700 }}><TableHead><TableRow>{['Session', 'Starts', 'Ends', 'Applications', ''].map(name => <TableCell key={name} sx={{ fontWeight: 900 }}>{name}</TableCell>)}</TableRow></TableHead><TableBody>
      {sessions === null ? <TableRow><TableCell colSpan={5} align="center">Loading…</TableCell></TableRow>
        : sessions.length ? sessions.map(session => <TableRow key={session.id} hover>
          <TableCell><Typography fontWeight={900}>{session.name}</Typography></TableCell>
          <TableCell>{toDateInput(session.starts_at)}</TableCell>
          <TableCell>{toDateInput(session.ends_at)}</TableCell>
          <TableCell><Chip size="small" label={session.open ? 'Open' : 'Closed'} color={session.open ? 'success' : 'default'} /></TableCell>
          <TableCell align="right"><Button size="small" startIcon={<EditRounded />} onClick={() => setEditingSession(session)}>Edit</Button></TableCell>
        </TableRow>) : <TableRow><TableCell colSpan={5} align="center">No sessions yet. Students cannot apply for training until a session is open.</TableCell></TableRow>}
    </TableBody></Table></Paper>
    {editing && <PricingDialog course={editing} onClose={() => setEditing(null)} onSaved={saved} />}
    {details && <CourseDialog course={details === 'new' ? null : details} onClose={() => setDetails(null)} onSaved={detailsSaved} />}
    {editingSession && <SessionDialog session={editingSession === 'new' ? null : editingSession} onClose={() => setEditingSession(null)} onSaved={sessionSaved} />}
    {history && <HistoryDialog course={history} onClose={() => setHistory(null)} />}
  </Container></Box>
}
