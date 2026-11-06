import { useEffect, useState } from 'react'
import { Box, Button, Card, Container, Grid, Stack, Typography } from '@mui/material'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import { Link as RouterLink } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { coursePricing } from '../../shared/tuition.mjs'
import { CdlPricingSheet, sheetTitle } from '../portal/CdlPricingSheet'
import { APPLY_PATH } from '../navigation'
import { floridaPay, nationalMedianPay, orlandoPay, PAY_SOURCE } from '../config/truckDriverPay'

type CourseRow = Record<string, unknown> & { id: string; name: string; code: string; tuition_cents?: number }
type PriceGroup = { key: string; names: string[]; codes: string[]; pricing: ReturnType<typeof coursePricing> }

/** Active courses grouped by identical fees, so programs priced the same share one sheet. */
export function groupCoursePricing(courses: CourseRow[]): PriceGroup[] {
  const groups = new Map<string, PriceGroup>()
  for (const course of courses) {
    const pricing = coursePricing(course)
    if (pricing.totalWithoutHousingCents <= 0) continue
    const key = JSON.stringify([pricing.currency, pricing.items, pricing.housingFeeCents])
    const group = groups.get(key) ?? { key, names: [], codes: [], pricing }
    group.names.push(course.name)
    group.codes.push(course.code)
    groups.set(key, group)
  }
  return [...groups.values()]
}

// Active courses as the public can see them (RLS hides inactive ones). One
// request per page load, shared by every price sheet and call to action.
let activeCourses: Promise<CourseRow[]> | null = null
function loadActiveCourses() {
  if (!supabase) return Promise.resolve([])
  activeCourses ??= Promise.resolve(supabase.from('cdl_courses').select('*').eq('active', true).order('code'))
    .then(({ data, error }) => (error || !data ? [] : (data as CourseRow[])))
    .catch(() => [])
  return activeCourses
}

export function useActiveCourses() {
  const [courses, setCourses] = useState<CourseRow[] | null>(null)
  useEffect(() => {
    let alive = true
    void loadActiveCourses().then(rows => { if (alive) setCourses(rows) })
    return () => { alive = false }
  }, [])
  return courses
}

/** True when at least one of these courses is offered and priced, so students can apply and pay online. */
export function useCanEnrollOnline(codes: readonly string[]) {
  const courses = useActiveCourses()
  return Boolean(courses?.some(course => codes.includes(course.code) && Number(course.tuition_cents) > 0))
}

/**
 * Live tuition from the same course records the student portal charges, so
 * the public price can never drift from checkout. Optionally limited to some
 * course codes. Renders nothing until a matching course is offered and priced.
 */
export function TuitionPricing({ codes, heading = 'What training costs' }: { codes?: readonly string[]; heading?: string }) {
  const courses = useActiveCourses()
  const groups = groupCoursePricing((courses ?? []).filter(course => !codes || codes.includes(course.code)))
  if (!groups.length) return null
  return (
    <Box component="section" aria-label="Current tuition" sx={{ py: { xs: 6, md: 9 }, bgcolor: '#f5f7fa' }}>
      <Container>
        <Typography variant="overline" color="secondary.main" fontWeight={900} letterSpacing=".12em">Current tuition</Typography>
        <Typography component="h2" variant="h3" color="primary.main" fontWeight={950} letterSpacing="-.035em" mt={0.5}>{heading}</Typography>
        <Stack spacing={4} mt={3}>
          {groups.map(group => (
            <Box key={group.key}>
              <Typography color="text.secondary" fontWeight={700} mb={1.5}>Applies to: {group.names.join(', ')}.{group.pricing.housingFeeCents > 0 ? ' Housing is optional.' : ''}</Typography>
              <CdlPricingSheet title={sheetTitle({ code: group.codes[0], name: group.names[0] })} items={group.pricing.items} housingFeeCents={group.pricing.housingFeeCents} currency={group.pricing.currency} />
            </Box>
          ))}
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} mt={3}>
          <Button component={RouterLink} to={APPLY_PATH} variant="contained" color="secondary" endIcon={<ArrowForwardRoundedIcon />}>Apply Now</Button>
          <Button component={RouterLink} to="/contact-us/" variant="outlined">Ask admissions about costs</Button>
        </Stack>
        <Typography variant="body2" color="text.secondary" mt={2}>Prices shown are current list prices. Your student portal shows the exact amount before you pay, and a price change never alters an account you have already opened.</Typography>
      </Container>
    </Box>
  )
}

const money = (value: number) => `$${value.toLocaleString('en-US')}`

/** BLS wage figures for the Truck Driver Pay page. */
export function TruckDriverPayData() {
  const stats = [
    { label: 'Florida median', value: money(floridaPay.median), note: 'Half of Florida drivers earn more, half earn less' },
    { label: 'Orlando-area median', value: money(orlandoPay.median), note: `Average ${money(orlandoPay.mean)}` },
    { label: 'Florida average', value: money(floridaPay.mean), note: `${floridaPay.employment.toLocaleString('en-US')} drivers employed` },
    { label: 'U.S. median', value: money(nationalMedianPay), note: 'All states' },
  ]
  const range = [
    ['Lowest 10%', floridaPay.percentile10],
    ['25th percentile', floridaPay.percentile25],
    ['Median', floridaPay.median],
    ['75th percentile', floridaPay.percentile75],
    ['Top 10%', floridaPay.percentile90],
  ] as const
  return (
    <Box component="section" aria-labelledby="pay-data-title" sx={{ py: { xs: 6, md: 9 }, bgcolor: '#f5f7fa' }}>
      <Container>
        <Typography variant="overline" color="secondary.main" fontWeight={900} letterSpacing=".12em">{PAY_SOURCE.period} wage survey</Typography>
        <Typography id="pay-data-title" component="h2" variant="h3" color="primary.main" fontWeight={950} letterSpacing="-.035em" mt={0.5} mb={3}>Annual pay for heavy and tractor-trailer truck drivers</Typography>
        <Grid container spacing={2.25}>
          {stats.map(stat => (
            <Grid key={stat.label} size={{ xs: 12, sm: 6, lg: 3 }}>
              <Card sx={{ height: '100%', p: 3, border: '1px solid', borderColor: 'divider', boxShadow: '0 14px 40px rgba(7,26,51,.06)' }}>
                <Typography variant="overline" color="secondary.main" fontWeight={900}>{stat.label}</Typography>
                <Typography fontWeight={950} color="primary.main" fontSize="2.1rem" lineHeight={1.1}>{stat.value}</Typography>
                <Typography variant="body2" color="text.secondary" mt={1}>{stat.note}</Typography>
              </Card>
            </Grid>
          ))}
        </Grid>
        <Card sx={{ mt: 3, p: { xs: 2.5, md: 3.5 }, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
          <Typography component="h3" variant="h6" color="primary.main" fontWeight={900} mb={1.5}>Florida pay range</Typography>
          <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', '& td, & th': { py: 1.25, borderBottom: '1px solid #e7eaf0', textAlign: 'left' }, '& tr:last-of-type td': { borderBottom: 0 } }}>
            <Box component="caption" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Florida annual wage percentiles for heavy and tractor-trailer truck drivers</Box>
            <thead><tr><th scope="col">Percentile</th><Box component="th" scope="col" sx={{ textAlign: 'right !important' }}>Annual wage</Box></tr></thead>
            <tbody>{range.map(([label, value]) => (
              <tr key={label}><td>{label}</td><Box component="td" sx={{ textAlign: 'right !important', fontWeight: 900, color: 'primary.main' }}>{money(value)}</Box></tr>
            ))}</tbody>
          </Box>
        </Card>
        <Typography variant="body2" color="text.secondary" mt={2}>
          Source: <Typography component="a" href={PAY_SOURCE.url} target="_blank" rel="noreferrer" variant="body2" color="inherit">{PAY_SOURCE.label}</Typography>, occupation 53-3032. Survey estimates, not a promise of earnings.
        </Typography>
      </Container>
    </Box>
  )
}
