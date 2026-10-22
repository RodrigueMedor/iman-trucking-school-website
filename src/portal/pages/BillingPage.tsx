import { useEffect, useState } from 'react'
import { Alert, Box, Button, Chip, Divider, Grid, LinearProgress, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import CreditCardRounded from '@mui/icons-material/CreditCardRounded'
import DownloadRounded from '@mui/icons-material/DownloadRounded'
import { useSearchParams } from 'react-router-dom'
import { FinancingCallout } from '../../components/financing/FinancingCallout'
import { getPaymentStatus } from '../../lib/stripe'
import { downloadAgreement, downloadReceipt, getMyBilling, getMyStudent, openTuitionAccount, PAYMENT_METHOD_LABELS, setTuitionHousing, startTuitionCheckout, toMessage, type BillingSummary, type FeeItem, type SelfPayOption, type TuitionAccount } from '../api'
import { CdlPricingSheet, sheetMoney } from '../CdlPricingSheet'
import { PayFeeDialog } from '../PayFeeDialog'
import { formatDate, formatDateTime, PageHeader, SectionCard } from '../ui'

const money = (cents: number, currency = 'usd') => new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format((cents || 0) / 100)
const label = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/^\w/, ch => ch.toUpperCase())

const FINANCING_LABELS: Record<string, string> = {
  REFERRED: 'Sent to Liberty', STUDENT_REPORTED_SUBMITTED: 'Application submitted', UNDER_REVIEW: 'Under lender review',
  APPROVED: 'Approved', PARTIALLY_APPROVED: 'Partially approved', DECLINED: 'Declined', FUNDED: 'Funded',
  FOLLOW_UP_NEEDED: 'Follow-up needed', CLOSED: 'Closed',
}

type Choice = { account: TuitionAccount; kind: 'full' | 'deposit' | 'installment'; installmentId?: string; label: string } | null

/** How the course can be paid once its tuition account is open. */
function payPlan(course: SelfPayOption['course']) {
  const parts = []
  if (course.deposit_cents > 0) parts.push(`${money(course.deposit_cents)} deposit option`)
  if (course.installments_enabled && course.installment_count > 1) parts.push(`${course.installment_count} installments`)
  return parts.length ? parts.join(' · ') : 'Paid in full'
}

/** Fee lines of an account; older accounts without a breakdown show one tuition line. */
function accountItems(account: TuitionAccount): FeeItem[] {
  if (account.fee_items?.length) return account.fee_items
  return [{ code: 'tuition', label: 'Tuition', amount_cents: account.tuition_cents - (account.housing_selected ? account.housing_fee_cents : 0) }]
}

export function BillingPage() {
  const [params, setParams] = useSearchParams()
  const [billing, setBilling] = useState<BillingSummary | null>(null)
  const [student, setStudent] = useState<{ first_name: string; last_name: string } | null>(null)
  const [choice, setChoice] = useState<Choice>(null)
  const [error, setError] = useState('')
  const [opening, setOpening] = useState(false)
  const [courseId, setCourseId] = useState('')
  // Housing choice before a tuition account exists; afterwards it is stored on the account.
  const [housing, setHousing] = useState(false)
  const [savingHousing, setSavingHousing] = useState(false)

  const load = async () => {
    const sessionId = params.get('session_id')
    if (sessionId) await getPaymentStatus(sessionId).catch(() => null)
    const [summary, profile] = await Promise.all([getMyBilling(), getMyStudent()])
    setBilling(summary)
    setStudent(profile)
    return summary
  }
  useEffect(() => { void load().catch(err => setError(toMessage(err))) }, [])

  const download = (task: Promise<void>) => void task.catch(err => setError(toMessage(err)))

  // Opens the tuition account at the course price. A full-payment-only course
  // goes straight to the agreement and Stripe checkout; otherwise the account
  // card below offers full, deposit and installment choices.
  const payByCard = async (option: SelfPayOption) => {
    setOpening(true); setError('')
    try {
      const { tuitionAccountId } = await openTuitionAccount(option.courseId, housing)
      const summary = await load()
      const account = summary.accounts.find(item => item.id === tuitionAccountId)
      const flexible = account && (account.deposit_cents > 0 || account.installments_enabled)
      if (account && !flexible && account.remaining_cents > 0) setChoice({ account, kind: 'full', label: `Pay ${money(account.remaining_cents, account.currency)} in full` })
    } catch (err) {
      setError(toMessage(err))
    } finally {
      setOpening(false)
    }
  }

  // The account the student is paying now, else the course they can open one for.
  const current = billing?.accounts.find(account => account.status !== 'CLOSED') || null
  const selectedOption = billing?.payable?.length
    ? billing.payable.find(item => item.courseId === courseId) || billing.payable.find(item => item.application) || billing.payable[0]
    : null

  const changeHousing = async (account: TuitionAccount, selected: boolean) => {
    setSavingHousing(true); setError('')
    try {
      await setTuitionHousing(account.id, selected)
      await load()
    } catch (err) {
      setError(toMessage(err))
    } finally {
      setSavingHousing(false)
    }
  }

  const sheet = () => {
    if (!billing) return null
    if (current) {
      const payments = billing.payments.filter(item => item.tuition_account_id === current.id)
      const applied = payments.some(item => ['succeeded', 'refunded'].includes(item.status)) || current.financing_cents > 0 || current.waived_cents > 0
      const remaining = current.remaining_cents
      const next = billing.installments.filter(item => item.tuition_account_id === current.id && ['DUE', 'PENDING'].includes(item.status))
        .sort((a, b) => a.installment_no - b.installment_no)[0]
      const onInstallmentPlan = current.installments_enabled && !!next && (current.deposit_cents === 0 || current.paid_cents > 0)
      const totalLabel = applied ? 'Remaining balance' : current.housing_selected ? 'Total with housing' : 'Total without housing'
      const due = remaining === 0 ? { label: 'Paid in full', amountCents: 0, caption: `Total program cost ${money(current.tuition_cents, current.currency)}` }
        : onInstallmentPlan ? { label: `${next.label}${next.due_at ? ` · due ${formatDate(next.due_at)}` : ''}`, amountCents: Math.min(next.amount_cents, remaining), caption: `Remaining balance ${money(remaining, current.currency)}` }
          : { label: totalLabel, amountCents: remaining, caption: applied ? `Total program cost ${money(current.tuition_cents, current.currency)} · Paid ${money(current.paid_cents, current.currency)}` : undefined }
      const action = remaining === 0 ? null : onInstallmentPlan
        ? <Button variant="contained" color="secondary" size="large" disabled={!student || savingHousing} onClick={() => setChoice({ account: current, kind: 'installment', installmentId: next.id, label: `Pay ${next.label}` })}>{next.status === 'PENDING' ? 'Resume payment' : `Pay ${sheetMoney(due.amountCents, current.currency)}`}</Button>
        : <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="flex-end">
          {current.deposit_cents > 0 && current.paid_cents === 0 && <Button variant="outlined" size="large" disabled={!student || savingHousing} onClick={() => setChoice({ account: current, kind: 'deposit', label: `Pay ${money(Math.min(current.deposit_cents, remaining), current.currency)} deposit` })}>Pay {money(Math.min(current.deposit_cents, remaining), current.currency)} deposit</Button>}
          <Button variant="contained" color="secondary" size="large" startIcon={<CreditCardRounded />} disabled={!student || savingHousing} onClick={() => setChoice({ account: current, kind: 'full', label: `Pay ${money(remaining, current.currency)}${applied ? '' : ' in full'}` })}>Pay {sheetMoney(remaining, current.currency)}</Button>
        </Stack>
      return <CdlPricingSheet items={accountItems(current)} housingFeeCents={current.fee_items?.length ? current.housing_fee_cents : 0} currency={current.currency}
        housingSelected={current.housing_selected} onHousingChange={selected => void changeHousing(current, selected)} busy={savingHousing}
        housingLockedReason={applied || remaining === 0 ? `Housing ${current.housing_selected ? 'is included' : 'is not included'}. A payment has been applied, so contact admissions to change it.` : undefined}
        due={due} action={action} />
    }
    if (!selectedOption) return null
    const { pricing } = selectedOption
    const total = pricing.totalWithoutHousingCents + (housing ? pricing.housingFeeCents : 0)
    const flexible = selectedOption.course.deposit_cents > 0 || (selectedOption.course.installments_enabled && selectedOption.course.installment_count > 1)
    return <CdlPricingSheet items={pricing.items} housingFeeCents={pricing.housingFeeCents} currency={pricing.currency}
      housingSelected={housing} onHousingChange={setHousing} busy={opening}
      courses={billing.payable!.map(item => ({ id: item.courseId, name: item.course.name, detail: `${item.application ? `Application ${item.application.reference_no} · ` : ''}${payPlan(item.course)}`, totalCents: item.pricing.totalWithoutHousingCents }))}
      courseId={selectedOption.courseId} onCourse={setCourseId}
      due={{ label: housing ? 'Total with housing' : 'Total without housing', amountCents: total, caption: flexible ? 'You can choose full payment, a deposit or installments on the next step.' : undefined }}
      action={<Button variant="contained" color="secondary" size="large" startIcon={<CreditCardRounded />} disabled={opening || !student} onClick={() => void payByCard(selectedOption)}>
        {opening ? 'Preparing secure checkout…' : flexible ? 'Continue to payment options' : `Pay ${sheetMoney(total, pricing.currency)}`}
      </Button>} />
  }

  return <>
    <PageHeader title="Tuition & payments" subtitle="Review your balance, then pay securely with Stripe or apply for financing with Liberty Career Finance." />
    {params.get('payment') === 'success' && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setParams({}, { replace: true })}>Payment received. Your balance and receipt are now being updated.</Alert>}
    {params.get('payment') === 'canceled' && <Alert severity="info" sx={{ mb: 3 }} onClose={() => setParams({}, { replace: true })}>Checkout was canceled. No payment was recorded.</Alert>}
    {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}
    {!billing ? <LinearProgress /> : billing.accounts.length === 0 && !billing.payable?.length ? <>
      <Alert severity="info" sx={{ mb: 3 }}>No tuition account has been assigned yet. Admissions will add one after your training application is reviewed.</Alert>
      <FinancingCallout variant="card" />
    </> : <Stack spacing={3}>
      {sheet()}
      {!current && !!billing.payable?.length && <FinancingCallout variant="card" title="Prefer to finance?" showLearnMore={false} />}
      {billing.accounts.map(account => {
        const installments = billing.installments.filter(item => item.tuition_account_id === account.id)
        const payments = billing.payments.filter(item => item.tuition_account_id === account.id)
        const agreements = billing.agreements.filter(item => item.tuition_account_id === account.id)
        const covered = account.paid_cents + account.financing_cents + account.waived_cents
        const paidPercent = account.tuition_cents ? Math.min(100, (covered / account.tuition_cents) * 100) : 100
        const due = account.remaining_cents > 0
        const financingStatus = account.financing_status || billing.financing?.status || null
        const summary: [string, number][] = [[account.housing_selected ? 'Total (with housing)' : 'Total', account.tuition_cents], ['Paid', account.paid_cents], ['Financing', account.financing_cents]]
        if (account.waived_cents > 0) summary.push(['Waived', account.waived_cents])
        summary.push(['Remaining', account.remaining_cents])

        return <Paper key={account.id} variant="outlined" sx={{ p: { xs: 2.5, md: 3.5 }, borderRadius: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
            <Box><Typography variant="h5" fontWeight={950}>{account.course?.name || 'CDL Training'}</Typography><Typography color="text.secondary">{account.application?.reference_no ? `Application ${account.application.reference_no}` : 'Student tuition account'}</Typography></Box>
            <Chip label={label(account.status)} color={account.status === 'PAID' ? 'success' : 'info'} sx={{ alignSelf: 'flex-start' }} />
          </Stack>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: `repeat(${summary.length}, 1fr)` }, gap: 2, my: 3 }}>
            {summary.map(([name, value]) => <Box key={name}><Typography variant="caption" color="text.secondary" fontWeight={800}>{name}</Typography><Typography variant="h6" fontWeight={950}>{money(value, account.currency)}</Typography></Box>)}
          </Box>
          <LinearProgress variant="determinate" value={paidPercent} sx={{ height: 9, borderRadius: 9, mb: 3 }} aria-label={`${Math.round(paidPercent)}% of tuition covered`} />
          {account.credit_cents > 0 && <Alert severity="info" sx={{ mb: 3 }}>Your payments and financing exceed your tuition by {money(account.credit_cents, account.currency)}. Admissions will contact you about this credit.</Alert>}

          {/* The pricing sheet above holds the payment actions for the current account. */}
          {due && account.id === current?.id && <Box sx={{ mb: 3 }}><FinancingCallout variant="card" title="Apply for financing" showLearnMore={false} /></Box>}
          {due && account.id !== current?.id && <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper elevation={0} sx={{ p: { xs: 2.5, md: 3 }, height: '100%', borderRadius: 3, border: 1, borderColor: 'divider' }}>
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box sx={{ width: 40, height: 40, borderRadius: 2.5, display: 'grid', placeItems: 'center', bgcolor: 'rgba(8,8,95,.08)', color: 'primary.main' }}><CreditCardRounded /></Box>
                    <Typography component="h2" variant="h6" color="primary.main" fontWeight={950}>Pay with Stripe</Typography>
                  </Stack>
                  <Typography color="text.secondary" lineHeight={1.7}>Pay by card through Stripe's secure checkout. IMAN never receives your card details, and your receipt is ready as soon as the payment clears.</Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    <Button variant="contained" color="secondary" onClick={() => setChoice({ account, kind: 'full', label: `Pay ${money(account.remaining_cents, account.currency)} in full` })}>Pay {money(account.remaining_cents, account.currency)}</Button>
                    {account.deposit_cents > 0 && account.paid_cents === 0 && <Button variant="outlined" onClick={() => setChoice({ account, kind: 'deposit', label: `Pay ${money(Math.min(account.deposit_cents, account.remaining_cents), account.currency)} deposit` })}>Pay {money(Math.min(account.deposit_cents, account.remaining_cents), account.currency)} deposit</Button>}
                  </Stack>
                  {installments.some(item => item.status === 'DUE') && <Typography variant="body2" color="text.secondary">Prefer smaller payments? Choose an installment from your schedule below.</Typography>}
                </Stack>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FinancingCallout variant="card" title="Apply for financing" showLearnMore={false} />
            </Grid>
          </Grid>}
          {financingStatus && <Alert severity={financingStatus === 'DECLINED' ? 'warning' : 'info'} sx={{ mb: 3 }}>Liberty financing: <strong>{FINANCING_LABELS[financingStatus] || label(financingStatus)}</strong>. Admissions records lender decisions after Liberty confirms them; only funded amounts reduce your balance.</Alert>}

          {installments.length > 0 && <SectionCard title="Installment schedule"><Stack divider={<Divider flexItem />}>
            {installments.map(item => {
              // A cleared balance covers any installment that was never billed.
              const status = item.status === 'DUE' && !due ? 'COVERED' : item.status
              return <Stack key={item.id} direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} py={1.25} gap={1}>
                <Box><Typography fontWeight={850}>{item.label}</Typography><Typography variant="body2" color="text.secondary">{money(item.amount_cents, account.currency)}{item.due_at ? ` · Due ${formatDate(item.due_at)}` : ''}</Typography></Box>
                {status === 'DUE' || status === 'PENDING'
                  // The server reopens an unfinished checkout for the same installment.
                  ? <Button size="small" variant="outlined" onClick={() => setChoice({ account, kind: 'installment', installmentId: item.id, label: `Pay ${item.label}` })}>{status === 'PENDING' ? 'Resume payment' : 'Pay installment'}</Button>
                  : <Chip size="small" label={label(status)} color={['PAID', 'COVERED', 'WAIVED'].includes(status) ? 'success' : 'default'} />}
              </Stack>
            })}
          </Stack></SectionCard>}

          <Typography variant="h6" fontWeight={900} mt={3} mb={1}>Payment history</Typography>
          {payments.length ? <Box sx={{ overflowX: 'auto' }}><Table size="small"><TableHead><TableRow><TableCell>Date</TableCell><TableCell>Type</TableCell><TableCell>Method</TableCell><TableCell>Amount</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead><TableBody>{payments.map(payment => <TableRow key={payment.id}>
            <TableCell>{formatDateTime(payment.succeeded_at || payment.created_at)}</TableCell>
            <TableCell sx={{ textTransform: 'capitalize' }}>{payment.payment_kind || 'Tuition'}</TableCell>
            <TableCell>{PAYMENT_METHOD_LABELS[payment.payment_method] || payment.payment_method}</TableCell>
            <TableCell>{money(payment.amount_cents, payment.currency)}{payment.refunded_cents > 0 && payment.status !== 'refunded' && <Typography variant="caption" display="block" color="text.secondary">{money(payment.refunded_cents, payment.currency)} refunded</Typography>}</TableCell>
            <TableCell><Chip size="small" label={label(payment.status)} color={payment.status === 'succeeded' ? 'success' : payment.status === 'failed' ? 'error' : 'default'} /></TableCell>
            <TableCell>{['succeeded', 'refunded'].includes(payment.status) && <Button size="small" startIcon={<DownloadRounded />} onClick={() => download(downloadReceipt(payment.id, payment.receipt_number))}>Receipt</Button>}</TableCell>
          </TableRow>)}</TableBody></Table></Box> : <Typography color="text.secondary">No tuition payments yet.</Typography>}

          {agreements.length > 0 && <>
            <Typography variant="h6" fontWeight={900} mt={3} mb={1}>Signed agreements</Typography>
            <Stack divider={<Divider flexItem />}>{agreements.map(agreement => <Stack key={agreement.id} direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} py={1} gap={1}>
              <Typography variant="body2">Signed by <strong>{agreement.signer_name}</strong> on {formatDateTime(agreement.accepted_at)}</Typography>
              <Button size="small" startIcon={<DownloadRounded />} onClick={() => download(downloadAgreement(agreement.id))}>Agreement</Button>
            </Stack>)}</Stack>
          </>}
        </Paper>
      })}
    </Stack>}
    {choice && student && <PayFeeDialog open onClose={() => setChoice(null)} title={choice.label} description="Your amount is calculated by the school server. Stripe securely collects your card details; IMAN never receives them." firstName={student.first_name} lastName={student.last_name} onPay={(accepted, signature) => startTuitionCheckout(choice.account.id, choice.kind, choice.installmentId, accepted, signature)} />}
  </>
}

