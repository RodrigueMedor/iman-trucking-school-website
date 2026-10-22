import type { ReactNode } from 'react'
import { Box, ButtonBase, Checkbox, FormControlLabel, Paper, Stack, Typography } from '@mui/material'
import LockRounded from '@mui/icons-material/LockRounded'
import RadioButtonCheckedRounded from '@mui/icons-material/RadioButtonCheckedRounded'
import RadioButtonUncheckedRounded from '@mui/icons-material/RadioButtonUncheckedRounded'
import type { FeeItem } from './api'

// Colors of the CDL Training special pricing sheet.
export const SHEET_NAVY = '#111B50'
export const SHEET_RED = '#D71938'
const SHEET_BG = '#F5F5F8'
const RULE = '#E3E4EC'

/** Whole dollars print without cents ($3,429); anything else keeps them. */
export function sheetMoney(cents: number, currency = 'usd') {
  const whole = cents % 100 === 0
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase(), minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 }).format((cents || 0) / 100)
}

export type SheetCourse = { id: string; name: string; detail: string; totalCents: number }

/**
 * The CDL Training "Special Pricing & Fee Breakdown" sheet plus the student's
 * own total due. Every amount comes from the server; this component only
 * displays them and reports the housing choice.
 */
export function CdlPricingSheet({
  items, housingFeeCents, currency = 'usd', housingSelected, onHousingChange, housingLockedReason, busy,
  courses, courseId, onCourse, due, action, note,
}: {
  items: FeeItem[]; housingFeeCents: number; currency?: string
  housingSelected: boolean; onHousingChange: (selected: boolean) => void; housingLockedReason?: string; busy?: boolean
  courses?: SheetCourse[]; courseId?: string; onCourse?: (id: string) => void
  due: { label: string; amountCents: number; caption?: string }
  action?: ReactNode; note?: ReactNode
}) {
  const base = items.reduce((sum, item) => sum + item.amount_cents, 0)
  const housingOffered = housingFeeCents > 0
  const money = (cents: number) => sheetMoney(cents, currency)

  return <Paper elevation={0} component="section" aria-labelledby="cdl-sheet-title" sx={{ borderRadius: 3, overflow: 'hidden', bgcolor: SHEET_BG, border: 1, borderColor: RULE }}>
    <Box sx={{ bgcolor: SHEET_NAVY, color: 'white', px: { xs: 2.5, md: 5 }, py: { xs: 3, md: 4 }, borderBottom: `4px solid ${SHEET_RED}` }}>
      <Stack direction="row" alignItems="center" spacing={{ xs: 2, md: 4 }}>
        <Box component="img" src="/images/iman-logo.png" alt="IMAN Trucking School" sx={{ height: { xs: 52, md: 84 }, width: 'auto', flexShrink: 0, display: 'block' }} />
        <Box minWidth={0}>
          <Typography id="cdl-sheet-title" component="h2" fontWeight={950} lineHeight={1} letterSpacing="-.01em" sx={{ fontSize: { xs: 30, sm: 40, md: 52 } }}>CDL TRAINING</Typography>
          <Typography fontWeight={600} sx={{ fontSize: { xs: 15, md: 20 }, mt: 1 }}>Special Pricing &amp; Fee Breakdown</Typography>
        </Box>
      </Stack>
    </Box>

    <Box sx={{ px: { xs: 2, md: 5 }, py: { xs: 2.5, md: 4 } }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.35fr) minmax(0, 1fr)' }, gap: { xs: 2, md: 3 } }}>
        <Paper elevation={0} sx={{ borderRadius: 3, p: { xs: 2.5, md: 4 }, bgcolor: 'white' }}>
          <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', color: SHEET_NAVY, '& td, & th': { py: { xs: 1.5, md: 2 }, borderBottom: `1px solid ${RULE}`, fontSize: { xs: 15, md: 17 } }, '& tr:last-of-type td': { borderBottom: 0 } }}>
            <Box component="caption" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Program costs</Box>
            <thead><tr>
              <Box component="th" scope="col" sx={{ textAlign: 'left', fontWeight: 950, letterSpacing: '.04em', pt: '0 !important' }}>PROGRAM COSTS</Box>
              <Box component="th" scope="col" sx={{ textAlign: 'right', fontWeight: 950, letterSpacing: '.04em', pt: '0 !important' }}>AMOUNT</Box>
            </tr></thead>
            <tbody>{items.map(item => <tr key={item.code}>
              <Box component="td" sx={{ pr: 2 }}>{item.label}</Box>
              <Box component="td" sx={{ textAlign: 'right', fontWeight: 900, whiteSpace: 'nowrap' }}>{money(item.amount_cents)}</Box>
            </tr>)}</tbody>
          </Box>
        </Paper>

        <Stack spacing={{ xs: 2, md: 3 }}>
          <Box sx={{ bgcolor: SHEET_NAVY, color: 'white', borderRadius: 3, p: { xs: 2.5, md: 3.5 } }}>
            <Typography fontWeight={900} letterSpacing=".06em" sx={{ fontSize: { xs: 14, md: 16 } }}>TOTAL WITHOUT HOUSING</Typography>
            <Typography fontWeight={950} lineHeight={1.1} sx={{ fontSize: { xs: 40, md: 52 }, mt: 0.5 }}>{money(base)}</Typography>
            {housingOffered && <Stack direction="row" justifyContent="space-between" sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,.25)' }}>
              <Typography fontWeight={700}>Optional Housing</Typography>
              <Typography fontWeight={950}>+ {money(housingFeeCents)}</Typography>
            </Stack>}
          </Box>
          {housingOffered && <Box sx={{ bgcolor: SHEET_RED, color: 'white', borderRadius: 3, p: { xs: 2.5, md: 3.5 } }}>
            <Typography fontWeight={900} letterSpacing=".06em" sx={{ fontSize: { xs: 14, md: 16 } }}>TOTAL WITH HOUSING</Typography>
            <Typography fontWeight={950} lineHeight={1.1} sx={{ fontSize: { xs: 40, md: 52 }, mt: 0.5 }}>{money(base + housingFeeCents)}</Typography>
          </Box>}
        </Stack>
      </Box>

      <Paper elevation={0} sx={{ mt: { xs: 2, md: 3 }, borderRadius: 3, p: { xs: 2.5, md: 3.5 }, bgcolor: 'white', border: `2px solid ${SHEET_NAVY}` }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr auto' }, gap: { xs: 2.5, md: 4 }, alignItems: 'center' }}>
          <Stack spacing={2} minWidth={0}>
            {courses && courses.length > 1 && <Box>
              <Typography id="cdl-sheet-program" variant="subtitle2" fontWeight={900} color={SHEET_NAVY} mb={1}>Select your program</Typography>
              <Stack spacing={1} role="radiogroup" aria-labelledby="cdl-sheet-program">
                {courses.map(course => {
                  const active = course.id === courseId
                  return <ButtonBase key={course.id} role="radio" aria-checked={active} onClick={() => onCourse?.(course.id)} disabled={busy}
                    sx={{ width: '100%', textAlign: 'left', borderRadius: 2, border: 2, borderColor: active ? SHEET_NAVY : RULE, px: 2, py: 1.25, gap: 1.5, justifyContent: 'flex-start' }}>
                    {active ? <RadioButtonCheckedRounded sx={{ color: SHEET_NAVY }} /> : <RadioButtonUncheckedRounded sx={{ color: 'text.disabled' }} />}
                    <Box flex={1} minWidth={0}><Typography fontWeight={850}>{course.name}</Typography><Typography variant="body2" color="text.secondary">{course.detail}</Typography></Box>
                    <Typography fontWeight={950} color={SHEET_NAVY} whiteSpace="nowrap">{money(course.totalCents)}</Typography>
                  </ButtonBase>
                })}
              </Stack>
            </Box>}
            {housingOffered && <Box>
              <FormControlLabel
                control={<Checkbox checked={housingSelected} onChange={event => onHousingChange(event.target.checked)} disabled={busy || !!housingLockedReason} sx={{ color: SHEET_NAVY, '&.Mui-checked': { color: SHEET_RED }, p: 1.25 }} />}
                label={<Typography fontWeight={900} color={SHEET_NAVY} sx={{ fontSize: { xs: 16, md: 18 } }}>Add Optional Housing (+{money(housingFeeCents)})</Typography>}
                sx={{ m: 0, ml: -1.25 }}
              />
              <Typography variant="body2" color="text.secondary">{housingLockedReason || 'Housing is optional. You can change this until you pay.'}</Typography>
            </Box>}
            {note}
          </Stack>
          <Box sx={{ textAlign: { md: 'right' } }}>
            <Typography fontWeight={900} letterSpacing=".06em" color={SHEET_RED} sx={{ fontSize: 14 }}>YOUR TOTAL DUE</Typography>
            <Typography aria-live="polite" fontWeight={950} color={SHEET_NAVY} lineHeight={1.1} sx={{ fontSize: { xs: 40, md: 48 } }}>{money(due.amountCents)}</Typography>
            <Typography variant="body2" color="text.secondary" fontWeight={700}>{due.label}</Typography>
            {due.caption && <Typography variant="caption" color="text.secondary" display="block">{due.caption}</Typography>}
            {action && <Box sx={{ mt: 2, '& .MuiButton-root': { width: { xs: '100%', md: 'auto' }, minHeight: 48 } }}>{action}</Box>}
          </Box>
        </Box>
        {action && <Stack direction="row" spacing={0.75} alignItems="center" mt={2} sx={{ color: 'text.secondary' }}>
          <LockRounded fontSize="small" /><Typography variant="caption" fontWeight={700}>Secure checkout by Stripe. IMAN never sees or stores your card details. You'll sign the tuition payment agreement before paying.</Typography>
        </Stack>}
      </Paper>

      <Stack direction="row" justifyContent="space-between" gap={2} mt={2.5} sx={{ color: '#6B6F80' }}>
        <Typography variant="caption" fontWeight={800} letterSpacing=".06em">IMAN TRUCKING SCHOOL</Typography>
        <Typography variant="caption">Housing is optional.</Typography>
      </Stack>
    </Box>
  </Paper>
}
