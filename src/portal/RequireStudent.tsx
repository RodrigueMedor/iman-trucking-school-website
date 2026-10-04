import { Alert, Box, Button, CircularProgress, Container, Paper, Stack, Typography } from '@mui/material'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { homeForRole } from '../lib/adminAuth'

export function PortalLoading() {
  return (
    <Box minHeight="60vh" display="grid" sx={{ placeItems: 'center' }} role="status" aria-label="Loading">
      <CircularProgress color="secondary" />
    </Box>
  )
}

function Blocked({ title, body, action }: { title: string; body: string; action?: { label: string; to: string } }) {
  return (
    <Container maxWidth="sm" sx={{ py: { xs: 8, md: 12 } }}>
      <Paper sx={{ p: { xs: 3, md: 5 }, borderRadius: 3 }}>
        <Typography variant="h4" fontWeight={900} gutterBottom>{title}</Typography>
        <Typography color="text.secondary">{body}</Typography>
        {action && (
          <Stack direction="row" sx={{ mt: 3 }}>
            <Button component={Link} to={action.to} variant="contained" color="secondary">{action.label}</Button>
          </Stack>
        )}
      </Paper>
    </Container>
  )
}

/**
 * Guards every /portal/ page. Signed-out visitors go to sign-in with the page
 * they asked for as `next`, so they land back on it afterwards.
 */
export function RequireStudent() {
  const { configured, loading, profileReady, session, profile } = useAuth()
  const location = useLocation()

  if (!configured) {
    return <Container sx={{ py: 12 }}><Alert severity="warning">The student portal is not available right now. Please contact admissions.</Alert></Container>
  }
  if (loading) return <PortalLoading />
  if (!session) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`)
    return <Navigate to={`/portal/sign-in?next=${next}`} replace />
  }
  if (!profileReady) return <PortalLoading />
  if (!profile) {
    return <Blocked title="Account not set up" body="We couldn't find your student profile. Please contact admissions so we can finish setting up your account." />
  }
  if (!profile.active) {
    return <Blocked title="Account inactive" body="This account has been deactivated. Please contact admissions." />
  }
  if (profile.role !== 'student') {
    return <Blocked title="Staff account" body="The student portal is for students. Staff manage applications from the admin dashboard." action={{ label: 'Go to admin dashboard', to: homeForRole(profile.role) }} />
  }
  return <Outlet />
}
