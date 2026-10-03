import type { ReactNode } from 'react'
import { Box, Button, Paper, Skeleton, Stack, Typography } from '@mui/material'
import { Link } from 'react-router-dom'

export const NAVY = '#08085f'
export const cardSx = { borderRadius: 3, border: 1, borderColor: 'divider', boxShadow: '0 10px 30px rgba(8,8,95,.06)' } as const

export function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'flex-end' }} sx={{ mb: { xs: 3, md: 4 } }}>
      <Box>
        <Typography component="h1" variant="h4" fontWeight={900} color={NAVY} sx={{ fontSize: { xs: 26, md: 32 } }}>{title}</Typography>
        {subtitle && <Typography color="text.secondary" sx={{ mt: 0.5 }}>{subtitle}</Typography>}
      </Box>
      {action}
    </Stack>
  )
}

export function SectionCard({ title, action, children, id }: { title?: string; action?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <Paper id={id} elevation={0} sx={{ ...cardSx, p: { xs: 2.5, md: 3 } }}>
      {(title || action) && (
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} sx={{ mb: 2 }}>
          {title && <Typography component="h2" variant="h6" fontWeight={900}>{title}</Typography>}
          {action}
        </Stack>
      )}
      {children}
    </Paper>
  )
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: { label: string; to: string } }) {
  return (
    <Stack alignItems="center" textAlign="center" spacing={1.5} sx={{ py: { xs: 4, md: 6 }, px: 2 }}>
      <Box sx={{ color: 'secondary.main', '& svg': { fontSize: 44 } }}>{icon}</Box>
      <Typography fontWeight={900} fontSize={18}>{title}</Typography>
      <Typography color="text.secondary" maxWidth={420}>{body}</Typography>
      {action && <Button component={Link} to={action.to} variant="contained" color="secondary" sx={{ mt: 1 }}>{action.label}</Button>}
    </Stack>
  )
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Stack spacing={1.5} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} variant="rounded" height={64} />)}
    </Stack>
  )
}
