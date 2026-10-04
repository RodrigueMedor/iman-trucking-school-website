import { useEffect, useState } from 'react'
import { Alert, Box, Button, CircularProgress, Container, Paper, Stack, Typography } from '@mui/material'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { homeForRole, isStaffRole } from '../lib/adminAuth'
import { setUpStudentAccount } from './api'

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

const notSetUp = { title: 'Account not set up', body: 'Your account is not set up as a student account yet. Please contact admissions so we can finish setting it up.' }

/**
 * Accounts with no profile or a legacy role are converted into student
 * accounts by the API server, then the profile is reloaded. Only if that
 * fails does the student see the "not set up" message.
 */
function SetUpStudentAccount() {
  const { refreshProfile } = useAuth()
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let cancelled = false
    setUpStudentAccount()
      .then(result => (result.repaired ? refreshProfile() : Promise.reject(new Error('Account was not changed'))))
      // A fixed account re-renders the portal instead of this component, so
      // reaching this point with it still shown means the fix did not take.
      .then(() => { if (!cancelled) setFailed(true) })
      .catch(error => {
        console.error('Failed to set up student account:', error)
        if (!cancelled) setFailed(true)
      })
    return () => { cancelled = true }
  }, [])
  return failed ? <Blocked {...notSetUp} /> : <PortalLoading />
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
  if (!profile) return <SetUpStudentAccount />
  if (profile.role !== 'student' && !isStaffRole(profile.role)) return <SetUpStudentAccount />
  if (!profile.active) {
    return <Blocked title="Account inactive" body="This account has been deactivated. Please contact admissions." />
  }
  if (profile.role !== 'student') {
    return <Blocked title="Staff account" body="The student portal is for students. Staff manage applications from the admin dashboard." action={{ label: 'Go to admin dashboard', to: homeForRole(profile.role) }} />
  }
  return <Outlet />
}
