import { useCallback, useEffect, useState } from 'react'
import { Alert, Box, Button, Chip, Container, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material'
import EditRounded from '@mui/icons-material/EditRounded'
import HistoryRounded from '@mui/icons-material/HistoryRounded'
import { getCoursePricingHistory, listCoursePricing, toMessage, updateCoursePricing, type CoursePricing as Course, type CoursePricingVersion } from '../../portal/api'
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
      {FEE_FIELDS.map(([column, , label]) => <Box key={column}>{dollarField(label, fees[column], value => setFees(current => ({ ...current, [column]: value })))}</Box>)}
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
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    try { setCourses(await listCoursePricing()) } catch (err) { setError(toMessage(err)); setCourses([]) }
  }, [])
  useEffect(() => { void load() }, [load])

  const saved = (course: Course) => {
    setCourses(rows => (rows || []).map(row => row.id === course.id ? course : row))
    setEditing(null)
    setNotice(`${course.name} now costs ${money(course.tuition_cents)}${course.housing_fee_cents ? `, or ${money(course.tuition_cents + course.housing_fee_cents)} with housing` : ''} (pricing v${course.pricing_version}).`)
  }

  return <Box sx={{ py: { xs: 3, md: 6 } }}><Container maxWidth="xl">
    <Box mb={3}><Typography variant="overline" color="secondary.main" fontWeight={900}>Student billing</Typography><Typography variant="h3" fontWeight={950}>Course Pricing</Typography><Typography color="text.secondary">Set the fees students pay by card in their portal. Changes apply to new tuition accounts immediately; existing accounts keep their price.</Typography></Box>
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
          <TableCell align="right"><Stack direction="row" justifyContent="flex-end"><Button size="small" startIcon={<HistoryRounded />} onClick={() => setHistory(course)}>History</Button><Button size="small" startIcon={<EditRounded />} onClick={() => setEditing(course)}>Edit</Button></Stack></TableCell>
        </TableRow>) : <TableRow><TableCell colSpan={9} align="center">No courses yet.</TableCell></TableRow>}
    </TableBody></Table></Paper>
    {editing && <PricingDialog course={editing} onClose={() => setEditing(null)} onSaved={saved} />}
    {history && <HistoryDialog course={history} onClose={() => setHistory(null)} />}
  </Container></Box>
}
