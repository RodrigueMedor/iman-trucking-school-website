import { useCallback, useEffect, useState } from 'react'
import { Alert, Box, Button, Checkbox, Chip, Container, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Drawer, FormControlLabel, IconButton, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material'
import CloseRounded from '@mui/icons-material/CloseRounded'
import DownloadRounded from '@mui/icons-material/DownloadRounded'
import { supabase } from '../../lib/supabase'
import { coursePricing, installmentSchedule, pricingTotal } from '../../../shared/tuition.mjs'
import { downloadAgreement, downloadReceipt, PAYMENT_METHOD_LABELS, type FeeItem, recordManualPayment, toMessage, voidManualPayment, waiveInstallment, type ManualPaymentInput } from '../../portal/api'
import { formatDate, formatDateTime } from '../../portal/ui'

const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((value || 0) / 100)
const label = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/^\w/, ch => ch.toUpperCase())
const toCents = (value: string) => Math.round(Number(value) * 100)

type Account = { id: string; user_id: string; student_id: string; application_id: string | null; course_id: string | null; tuition_cents: number; deposit_cents: number; financing_cents: number; paid_cents: number; remaining_cents: number; refunded_cents: number; waived_cents: number; credit_cents: number; financing_status: string | null; status: string; installments_enabled: boolean; installment_count: number; created_at: string; fee_items: FeeItem[]; housing_fee_cents: number; housing_selected: boolean; pricing_version: number | null; student?: { first_name: string; last_name: string; email: string; phone: string | null } | null; course?: { name: string } | null }
type App = { id: string; user_id: string; student_id: string; reference_no: string; first_name: string; last_name: string; email: string; course_id: string; course?: { name: string; tuition_cents: number; deposit_cents: number; installment_count: number; installments_enabled: boolean; training_cents: number; testing_fee_cents: number; administrative_fee_cents: number; materials_fee_cents: number; housing_fee_cents: number; currency: string; pricing_version: number } | null }
type Installment = { id: string; installment_no: number; label: string; amount_cents: number; due_at: string | null; status: string }
type Payment = { id: string; installment_id: string | null; payment_kind: string | null; payment_method: string; amount_cents: number; refunded_cents: number; status: string; receipt_number: string | null; succeeded_at: string | null; created_at: string; error_message: string | null; metadata: { reference?: string | null; recorded_by_email?: string } | null }
type Agreement = { id: string; signer_name: string; accepted_at: string; version: string; payment_id: string | null }
type Adjustment = { id: string; installment_id: string | null; amount_cents: number; reason: string; created_at: string }
type Notification = { id: number; payment_id: string; channel: string; audience: string; recipient: string; status: string; error: string; created_at: string }
type Detail = { installments: Installment[]; payments: Payment[]; agreements: Agreement[]; adjustments: Adjustment[]; notifications: Notification[] }

function Stat({ name, value, tone }: { name: string; value: string; tone?: string }) {
  return <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}><Typography variant="caption" color="text.secondary" fontWeight={800}>{name}</Typography><Typography variant="h5" fontWeight={950} color={tone}>{value}</Typography></Paper>
}

function Heading({ children }: { children: string }) {
  return <Typography variant="h6" fontWeight={900} mt={3} mb={1}>{children}</Typography>
}

/** One-field prompt for the audited reason a waiver or void requires. */
function ReasonDialog({ title, action, onClose, onSubmit }: { title: string; action: string; onClose: () => void; onSubmit: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async () => {
    setBusy(true); setError('')
    try { await onSubmit(reason.trim()); onClose() } catch (err) { setError(toMessage(err)) } finally { setBusy(false) }
  }
  return <Dialog open onClose={() => !busy && onClose()} fullWidth maxWidth="xs"><DialogTitle fontWeight={950}>{title}</DialogTitle><DialogContent>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <TextField autoFocus fullWidth multiline minRows={2} label="Reason (kept in the audit record)" value={reason} onChange={event => setReason(event.target.value)} inputProps={{ maxLength: 500 }} sx={{ mt: 1 }} />
  </DialogContent><DialogActions><Button onClick={onClose} disabled={busy}>Cancel</Button><Button variant="contained" color="secondary" disabled={busy || reason.trim().length < 3} onClick={() => void submit()}>{busy ? 'Saving…' : action}</Button></DialogActions></Dialog>
}

function ManualPaymentDialog({ account, installments, onClose, onSaved }: { account: Account; installments: Installment[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const due = installments.filter(item => item.status === 'DUE')
  const [installmentId, setInstallmentId] = useState('')
  const [amount, setAmount] = useState(String(account.remaining_cents / 100))
  const [method, setMethod] = useState<ManualPaymentInput['method']>('check')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const chooseInstallment = (id: string) => {
    setInstallmentId(id)
    const item = due.find(row => row.id === id)
    setAmount(String((item ? Math.min(item.amount_cents, account.remaining_cents) : account.remaining_cents) / 100))
  }
  const submit = async () => {
    const amountCents = toCents(amount)
    if (!Number.isInteger(amountCents) || amountCents <= 0 || amountCents > account.remaining_cents) return setError(`Enter an amount between $0.01 and ${money(account.remaining_cents)}.`)
    setBusy(true); setError('')
    try {
      await recordManualPayment(account.id, { amountCents, method, installmentId: installmentId || undefined, reference: reference.trim() || undefined, note: note.trim() || undefined })
      await onSaved(); onClose()
    } catch (err) { setError(toMessage(err)) } finally { setBusy(false) }
  }
  return <Dialog open onClose={() => !busy && onClose()} fullWidth maxWidth="sm"><DialogTitle fontWeight={950}>Record offline payment</DialogTitle><DialogContent><Stack spacing={2.5} mt={1}>
    {error && <Alert severity="error">{error}</Alert>}
    <Typography color="text.secondary">Use this for cash, check or money order payments received in person. The student gets the usual email and SMS confirmation and a receipt.</Typography>
    {due.length > 0 && <TextField select label="Apply to installment (optional)" value={installmentId} onChange={event => chooseInstallment(event.target.value)}><MenuItem value="">Not tied to an installment</MenuItem>{due.map(item => <MenuItem key={item.id} value={item.id}>{item.label} · {money(item.amount_cents)}</MenuItem>)}</TextField>}
    <TextField label="Amount (USD)" type="number" value={amount} onChange={event => setAmount(event.target.value)} disabled={Boolean(installmentId)} inputProps={{ min: 0, step: '.01' }} helperText={`Remaining balance: ${money(account.remaining_cents)}`} />
    <TextField select label="Method" value={method} onChange={event => setMethod(event.target.value as ManualPaymentInput['method'])}>{(['cash', 'check', 'money_order', 'other'] as const).map(value => <MenuItem key={value} value={value}>{PAYMENT_METHOD_LABELS[value]}</MenuItem>)}</TextField>
    <TextField label="Reference (check number, receipt book no.)" value={reference} onChange={event => setReference(event.target.value)} inputProps={{ maxLength: 100 }} />
    <TextField label="Internal note" value={note} onChange={event => setNote(event.target.value)} multiline minRows={2} inputProps={{ maxLength: 500 }} />
  </Stack></DialogContent><DialogActions><Button onClick={onClose} disabled={busy}>Cancel</Button><Button variant="contained" color="secondary" onClick={() => void submit()} disabled={busy}>{busy ? 'Recording…' : 'Record payment'}</Button></DialogActions></Dialog>
}

function AccountDrawer({ account, onClose, onChanged }: { account: Account; onClose: () => void; onChanged: () => Promise<void> }) {
  const [detail, setDetail] = useState<Detail | null>(null)
  const [error, setError] = useState('')
  const [recording, setRecording] = useState(false)
  const [reasonFor, setReasonFor] = useState<{ kind: 'waive'; item: Installment } | { kind: 'void'; payment: Payment } | null>(null)

  const load = useCallback(async () => {
    if (!supabase) return
    const [installments, payments, agreements, adjustments] = await Promise.all([
      supabase.from('cdl_tuition_installments').select('*').eq('tuition_account_id', account.id).order('installment_no'),
      supabase.from('cdl_payments').select('id, installment_id, payment_kind, payment_method, amount_cents, refunded_cents, status, receipt_number, succeeded_at, created_at, error_message, metadata').eq('tuition_account_id', account.id).order('created_at', { ascending: false }),
      supabase.from('cdl_payment_agreements').select('id, signer_name, accepted_at, version, payment_id').eq('tuition_account_id', account.id).order('accepted_at', { ascending: false }),
      supabase.from('cdl_tuition_adjustments').select('id, installment_id, amount_cents, reason, created_at').eq('tuition_account_id', account.id).order('created_at', { ascending: false }),
    ])
    const failed = [installments, payments, agreements, adjustments].find(result => result.error)
    if (failed?.error) return setError(toMessage(failed.error))
    const paymentIds = (payments.data || []).map(row => row.id)
    const notifications = paymentIds.length
      ? await supabase.from('cdl_notification_log').select('*').in('payment_id', paymentIds).order('created_at', { ascending: false })
      : { data: [], error: null }
    setDetail({
      installments: (installments.data || []) as Installment[], payments: (payments.data || []) as Payment[],
      agreements: (agreements.data || []) as Agreement[], adjustments: (adjustments.data || []) as Adjustment[],
      notifications: (notifications.data || []) as Notification[],
    })
  }, [account.id])
  useEffect(() => { void load() }, [load])

  const refresh = async () => { await Promise.all([load(), onChanged()]) }
  const download = (task: Promise<void>) => void task.catch(err => setError(toMessage(err)))
  const open = account.status !== 'CLOSED'

  return <Drawer anchor="right" open onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', md: 860 } } }}>
    <Box sx={{ p: { xs: 2.5, md: 4 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
        <Box>
          <Typography variant="overline" color="secondary.main" fontWeight={900}>{account.course?.name || 'CDL Training'}</Typography>
          <Typography variant="h4" fontWeight={950}>{account.student?.first_name} {account.student?.last_name}</Typography>
          <Typography color="text.secondary">{account.student?.email}{account.student?.phone ? ` · ${account.student.phone}` : ''}</Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="Close"><CloseRounded /></IconButton>
      </Stack>
      <Stack direction="row" gap={1} mt={2} flexWrap="wrap">
        <Chip label={label(account.status)} color={account.status === 'PAID' ? 'success' : 'info'} />
        {account.financing_status && <Chip variant="outlined" label={`Liberty: ${label(account.financing_status)}`} />}
      </Stack>
      {error && <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {account.credit_cents > 0 && <Alert severity="warning" sx={{ mt: 2 }}>Payments, financing and waivers exceed the tuition by <strong>{money(account.credit_cents)}</strong>. Refund the credit in Stripe or record how it was settled.</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(5, 1fr)' }, gap: 2, my: 3 }}>
        {([['Tuition', account.tuition_cents], ['Paid', account.paid_cents], ['Financing', account.financing_cents], ['Waived', account.waived_cents], ['Remaining', account.remaining_cents]] as const).map(([name, value]) => <Box key={name}><Typography variant="caption" color="text.secondary" fontWeight={800}>{name}</Typography><Typography variant="h6" fontWeight={950}>{money(value)}</Typography></Box>)}
      </Box>
      {account.fee_items?.length > 0 && <Box sx={{ mb: 3, p: 2, borderRadius: 2, bgcolor: '#f5f5f8' }}>
        <Typography fontWeight={900} mb={1}>Program costs{account.pricing_version ? ` · pricing v${account.pricing_version}` : ''}</Typography>
        {account.fee_items.map(item => <Stack key={item.code} direction="row" justifyContent="space-between"><Typography variant="body2">{item.label}</Typography><Typography variant="body2" fontWeight={800}>{money(item.amount_cents)}</Typography></Stack>)}
        <Stack direction="row" justifyContent="space-between"><Typography variant="body2">Optional housing{account.housing_fee_cents ? ` (${money(account.housing_fee_cents)})` : ''}</Typography><Typography variant="body2" fontWeight={800}>{account.housing_selected ? 'Selected' : account.housing_fee_cents ? 'Not selected' : 'Not offered'}</Typography></Stack>
      </Box>}
      {open && account.remaining_cents > 0 && <Button variant="contained" color="secondary" onClick={() => setRecording(true)} disabled={!detail}>Record offline payment</Button>}

      {!detail ? <Typography color="text.secondary" mt={3}>Loading…</Typography> : <>
        <Heading>Installment schedule</Heading>
        {detail.installments.length ? <Stack divider={<Divider flexItem />}>{detail.installments.map(item => <Stack key={item.id} direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} py={1} gap={1}>
          <Box><Typography fontWeight={850}>{item.label}</Typography><Typography variant="body2" color="text.secondary">{money(item.amount_cents)}{item.due_at ? ` · Due ${formatDate(item.due_at)}` : ''}</Typography></Box>
          <Stack direction="row" gap={1} alignItems="center">
            <Chip size="small" label={label(item.status)} color={['PAID', 'WAIVED'].includes(item.status) ? 'success' : 'default'} />
            {item.status === 'DUE' && open && account.remaining_cents > 0 && <Button size="small" onClick={() => setReasonFor({ kind: 'waive', item })}>Waive</Button>}
          </Stack>
        </Stack>)}</Stack> : <Typography color="text.secondary">No installments; the student pays in full or by deposit.</Typography>}

        <Heading>Payment history</Heading>
        {detail.payments.length ? <Box sx={{ overflowX: 'auto' }}><Table size="small" sx={{ minWidth: 680 }}><TableHead><TableRow>{['Date', 'Type', 'Method', 'Amount', 'Status', ''].map(name => <TableCell key={name} sx={{ fontWeight: 900 }}>{name}</TableCell>)}</TableRow></TableHead><TableBody>{detail.payments.map(payment => <TableRow key={payment.id}>
          <TableCell>{formatDateTime(payment.succeeded_at || payment.created_at)}</TableCell>
          <TableCell sx={{ textTransform: 'capitalize' }}>{payment.payment_kind || 'Tuition'}</TableCell>
          <TableCell>{PAYMENT_METHOD_LABELS[payment.payment_method] || payment.payment_method}{payment.metadata?.reference ? <Typography variant="caption" display="block" color="text.secondary">{payment.metadata.reference}</Typography> : null}{payment.metadata?.recorded_by_email ? <Typography variant="caption" display="block" color="text.secondary">by {payment.metadata.recorded_by_email}</Typography> : null}</TableCell>
          <TableCell>{money(payment.amount_cents)}{payment.refunded_cents > 0 && <Typography variant="caption" display="block" color="text.secondary">{money(payment.refunded_cents)} refunded</Typography>}</TableCell>
          <TableCell><Chip size="small" label={label(payment.status)} color={payment.status === 'succeeded' ? 'success' : payment.status === 'failed' ? 'error' : 'default'} />{payment.error_message && payment.status !== 'succeeded' ? <Typography variant="caption" display="block" color="text.secondary" sx={{ maxWidth: 220 }}>{payment.error_message}</Typography> : null}</TableCell>
          <TableCell><Stack direction="row" gap={0.5}>
            {['succeeded', 'refunded'].includes(payment.status) && <Button size="small" startIcon={<DownloadRounded />} onClick={() => download(downloadReceipt(payment.id, payment.receipt_number))}>Receipt</Button>}
            {payment.status === 'succeeded' && payment.payment_method !== 'stripe' && <Button size="small" color="error" onClick={() => setReasonFor({ kind: 'void', payment })}>Void</Button>}
          </Stack></TableCell>
        </TableRow>)}</TableBody></Table></Box> : <Typography color="text.secondary">No payments yet.</Typography>}
        <Typography variant="caption" color="text.secondary" display="block" mt={1}>Card payments are refunded from the Stripe Dashboard; the refund is applied here automatically.</Typography>

        {detail.adjustments.length > 0 && <><Heading>Waivers</Heading><Stack divider={<Divider flexItem />}>{detail.adjustments.map(item => <Box key={item.id} py={1}><Typography fontWeight={850}>{money(item.amount_cents)} waived · {formatDateTime(item.created_at)}</Typography><Typography variant="body2" color="text.secondary">{item.reason}</Typography></Box>)}</Stack></>}

        <Heading>Signed agreements</Heading>
        {detail.agreements.length ? <Stack divider={<Divider flexItem />}>{detail.agreements.map(item => <Stack key={item.id} direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} py={1} gap={1}>
          <Typography variant="body2"><strong>{item.signer_name}</strong> · {formatDateTime(item.accepted_at)} · {item.version}</Typography>
          <Button size="small" startIcon={<DownloadRounded />} onClick={() => download(downloadAgreement(item.id))}>Agreement</Button>
        </Stack>)}</Stack> : <Typography color="text.secondary">No agreements signed yet.</Typography>}

        <Heading>Confirmations sent</Heading>
        {detail.notifications.length ? <Box sx={{ overflowX: 'auto' }}><Table size="small"><TableHead><TableRow>{['Date', 'Channel', 'To', 'Status'].map(name => <TableCell key={name} sx={{ fontWeight: 900 }}>{name}</TableCell>)}</TableRow></TableHead><TableBody>{detail.notifications.map(item => <TableRow key={item.id}>
          <TableCell>{formatDateTime(item.created_at)}</TableCell><TableCell sx={{ textTransform: 'capitalize' }}>{item.channel} · {item.audience}</TableCell><TableCell>{item.recipient}</TableCell>
          <TableCell><Chip size="small" label={item.status} color={item.status === 'sent' ? 'success' : item.status === 'failed' ? 'error' : 'default'} />{item.error ? <Typography variant="caption" display="block" color="text.secondary">{item.error}</Typography> : null}</TableCell>
        </TableRow>)}</TableBody></Table></Box> : <Typography color="text.secondary">No email or SMS confirmations recorded. If payments exist, check that Resend and Twilio are configured on the server.</Typography>}
      </>}
    </Box>
    {recording && detail && <ManualPaymentDialog account={account} installments={detail.installments} onClose={() => setRecording(false)} onSaved={refresh} />}
    {reasonFor?.kind === 'waive' && <ReasonDialog title={`Waive ${reasonFor.item.label} (${money(Math.min(reasonFor.item.amount_cents, account.remaining_cents))})`} action="Waive installment" onClose={() => setReasonFor(null)} onSubmit={async reason => { await waiveInstallment(reasonFor.item.id, reason); await refresh() }} />}
    {reasonFor?.kind === 'void' && <ReasonDialog title={`Void ${money(reasonFor.payment.amount_cents)} ${PAYMENT_METHOD_LABELS[reasonFor.payment.payment_method] || ''} payment`} action="Void payment" onClose={() => setReasonFor(null)} onSubmit={async reason => { await voidManualPayment(reasonFor.payment.id, reason); await refresh() }} />}
  </Drawer>
}

export function TuitionAccounts() {
  const [rows, setRows] = useState<Account[]>([])
  const [apps, setApps] = useState<App[]>([])
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [applicationId, setApplicationId] = useState('')
  const [tuition, setTuition] = useState('')
  const [housing, setHousing] = useState(false)
  const [deposit, setDeposit] = useState('')
  const [count, setCount] = useState('1')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!supabase) return
    const [accountResult, appResult] = await Promise.all([
      supabase.from('cdl_tuition_account_balances').select('*, student:cdl_students(first_name,last_name,email,phone), course:cdl_courses(name)').order('created_at', { ascending: false }),
      supabase.from('cdl_class_applications').select('id,user_id,student_id,reference_no,first_name,last_name,email,course_id,course:cdl_courses(name,tuition_cents,deposit_cents,installment_count,installments_enabled,training_cents,testing_fee_cents,administrative_fee_cents,materials_fee_cents,housing_fee_cents,currency,pricing_version)').eq('application_type', 'TRAINING').in('status', ['APPROVED','SCHEDULED','COMPLETED']).order('created_at', { ascending: false }),
    ])
    if (accountResult.error) setError(toMessage(accountResult.error)); else setRows((accountResult.data || []) as unknown as Account[])
    if (!appResult.error) setApps((appResult.data || []) as unknown as App[])
  }, [])
  useEffect(() => { void load() }, [load])

  const chooseApp = (id: string) => {
    setApplicationId(id)
    const app = apps.find(item => item.id === id)
    // Course prices are stored in cents; the form takes dollars.
    setHousing(false)
    if (app?.course) {
      setTuition(app.course.tuition_cents ? String(app.course.tuition_cents / 100) : '')
      setDeposit(app.course.deposit_cents ? String(app.course.deposit_cents / 100) : '')
      setCount(String(app.course.installment_count || 1))
    }
  }

  const create = async () => {
    if (!supabase) return
    const app = apps.find(item => item.id === applicationId)
    const tuitionCents = toCents(tuition)
    const depositCents = toCents(deposit || '0')
    const installmentCount = Number(count)
    if (!app || !Number.isInteger(tuitionCents) || tuitionCents <= 0 || depositCents < 0 || depositCents > tuitionCents || !Number.isInteger(installmentCount) || installmentCount < 1 || installmentCount > 24) return setError('Enter a valid application, tuition, deposit and installment count.')
    setBusy(true); setError('')
    const { data: auth } = await supabase.auth.getUser()
    // Keep the course's fee breakdown when admissions charges the list price;
    // a custom tuition is stored without one.
    const pricing = app.course ? coursePricing(app.course) : null
    const itemized = pricing && pricingTotal(pricing.items, pricing.housingFeeCents, housing) === tuitionCents
      ? { fee_items: pricing.items, housing_fee_cents: pricing.housingFeeCents, housing_selected: housing && pricing.housingFeeCents > 0, pricing_version: pricing.version }
      : {}
    // The database links any existing Liberty referral to the new account.
    const { data: account, error: insertError } = await supabase.from('cdl_tuition_accounts').insert({
      user_id: app.user_id, student_id: app.student_id, application_id: app.id, course_id: app.course_id,
      tuition_cents: tuitionCents, deposit_cents: depositCents, installment_count: installmentCount,
      installments_enabled: installmentCount > 1, created_by: auth.user?.id, updated_by: auth.user?.id, ...itemized,
    }).select().single()
    if (insertError || !account) { setBusy(false); return setError(toMessage(insertError)) }
    const installments = installmentSchedule({ tuitionCents, depositCents, installmentCount }).map(item => ({ ...item, tuition_account_id: account.id }))
    if (installments.length) {
      const { error: scheduleError } = await supabase.from('cdl_tuition_installments').insert(installments)
      if (scheduleError) setError(`Account created, but the installment schedule failed: ${toMessage(scheduleError)}`)
    }
    setBusy(false); setOpen(false); setApplicationId(''); setTuition(''); setHousing(false); setDeposit(''); setCount('1'); await load()
  }

  // A student may already have paid by card before applying for that course.
  const available = apps.filter(app => !rows.some(row => row.application_id === app.id
    || (!row.application_id && row.user_id === app.user_id && row.course_id === app.course_id && row.status !== 'CLOSED')))
  const chosenCourse = apps.find(item => item.id === applicationId)?.course || null
  const active = rows.filter(row => row.status !== 'CLOSED')
  const sum = (key: 'paid_cents' | 'remaining_cents' | 'financing_cents') => active.reduce((total, row) => total + row[key], 0)
  const financingPending = active.filter(row => row.status === 'FINANCING_PENDING').length
  const credits = active.filter(row => row.credit_cents > 0).length
  const selected = rows.find(row => row.id === selectedId) || null

  return <Box sx={{ py: { xs: 3, md: 6 } }}><Container maxWidth="xl">
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2} mb={3}>
      <Box><Typography variant="overline" color="secondary.main" fontWeight={900}>Student billing</Typography><Typography variant="h3" fontWeight={950}>Tuition Accounts</Typography><Typography color="text.secondary">Create tuition ledgers for approved students, record offline payments and review balances from confirmed payments.</Typography></Box>
      <Button variant="contained" color="secondary" onClick={() => setOpen(true)} sx={{ alignSelf: { sm: 'flex-start' } }}>Create tuition account</Button>
    </Stack>
    {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}
    {credits > 0 && <Alert severity="warning" sx={{ mb: 3 }}>{credits} account{credits === 1 ? ' has' : 's have'} a credit (paid more than the tuition). Open the account to review it.</Alert>}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
      <Stat name="Collected" value={money(sum('paid_cents'))} />
      <Stat name="Outstanding" value={money(sum('remaining_cents'))} tone="secondary.main" />
      <Stat name="Funded financing" value={money(sum('financing_cents'))} />
      <Stat name="Awaiting financing" value={`${financingPending} student${financingPending === 1 ? '' : 's'}`} />
    </Box>
    <Paper sx={{ overflowX: 'auto' }}><Table sx={{ minWidth: 980 }}><TableHead><TableRow>{['Student','Program','Tuition','Housing','Paid','Financing','Remaining','Status','Created'].map(name => <TableCell key={name} sx={{ fontWeight: 900 }}>{name}</TableCell>)}</TableRow></TableHead><TableBody>
      {rows.length ? rows.map(row => <TableRow key={row.id} hover onClick={() => setSelectedId(row.id)} sx={{ cursor: 'pointer' }} tabIndex={0} onKeyDown={event => { if (event.key === 'Enter') setSelectedId(row.id) }}>
        <TableCell><Typography fontWeight={900}>{row.student?.first_name} {row.student?.last_name}</Typography><Typography variant="body2" color="text.secondary">{row.student?.email}</Typography></TableCell>
        <TableCell>{row.course?.name || 'CDL Training'}</TableCell><TableCell>{money(row.tuition_cents)}</TableCell><TableCell>{row.housing_selected ? 'Yes' : row.housing_fee_cents ? 'No' : '—'}</TableCell><TableCell>{money(row.paid_cents)}</TableCell><TableCell>{money(row.financing_cents)}</TableCell>
        <TableCell sx={{ fontWeight: 900 }}>{money(row.remaining_cents)}{row.credit_cents > 0 && <Typography variant="caption" display="block" color="warning.main" fontWeight={800}>{money(row.credit_cents)} credit</Typography>}</TableCell>
        <TableCell><Chip size="small" label={label(row.status)} color={row.status === 'PAID' ? 'success' : 'info'} /></TableCell><TableCell>{formatDateTime(row.created_at)}</TableCell>
      </TableRow>) : <TableRow><TableCell colSpan={9} align="center">No tuition accounts yet.</TableCell></TableRow>}
    </TableBody></Table></Paper>
    <Dialog open={open} onClose={() => !busy && setOpen(false)} fullWidth maxWidth="sm"><DialogTitle fontWeight={950}>Create tuition account</DialogTitle><DialogContent><Stack spacing={2.5} mt={1}>
      <TextField select label="Approved training application" value={applicationId} onChange={event => chooseApp(event.target.value)}>{available.map(app => <MenuItem key={app.id} value={app.id}>{app.first_name} {app.last_name} · {app.reference_no}</MenuItem>)}</TextField>
      {!!chosenCourse?.housing_fee_cents && <FormControlLabel control={<Checkbox checked={housing} onChange={event => {
        setHousing(event.target.checked)
        setTuition(String((chosenCourse.tuition_cents + (event.target.checked ? chosenCourse.housing_fee_cents : 0)) / 100))
      }} />} label={`Student chose optional housing (+${money(chosenCourse.housing_fee_cents)})`} />}
      <TextField label="Tuition (USD)" type="number" value={tuition} onChange={event => setTuition(event.target.value)} inputProps={{ min: 0, step: '.01' }}
        helperText={chosenCourse && toCents(tuition || '0') !== chosenCourse.tuition_cents + (housing ? chosenCourse.housing_fee_cents : 0) ? 'Custom tuition: the student will see one tuition line instead of the fee breakdown.' : 'Course price with its itemized fees.'} />
      <TextField label="Deposit (USD)" type="number" value={deposit} onChange={event => setDeposit(event.target.value)} inputProps={{ min: 0, step: '.01' }} />
      <TextField label="Number of installments" type="number" value={count} onChange={event => setCount(event.target.value)} inputProps={{ min: 1, max: 24 }} helperText="Use 1 to disable installments. The deposit is separate from the installment balance." />
    </Stack></DialogContent><DialogActions><Button onClick={() => setOpen(false)} disabled={busy}>Cancel</Button><Button variant="contained" color="secondary" onClick={() => void create()} disabled={busy}>{busy ? 'Creating…' : 'Create account'}</Button></DialogActions></Dialog>
    {selected && <AccountDrawer account={selected} onClose={() => setSelectedId(null)} onChanged={load} />}
  </Container></Box>
}
