import { Alert, Box, CircularProgress, Container, Paper, Typography } from '@mui/material'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export function ProtectedRoute() {
  const { configured, loading, session, profile } = useAuth()
  const location = useLocation()
  if (!configured) return <Container sx={{ py: 12 }}><Alert severity="warning">Supabase is not configured for this deployment.</Alert></Container>
  if (loading) return <Box minHeight="70vh" display="grid" sx={{ placeItems: 'center' }}><CircularProgress /></Box>
  if (!session) return <Navigate to="/admin/login/" replace state={{ from: location.pathname }} />
  if (!profile?.active || !['super_admin', 'instructor'].includes(profile.role)) return <Container sx={{ py: 12 }}><Paper sx={{ p: 5 }}><Typography variant="h4" fontWeight={900}>Access restricted</Typography><Typography mt={1}>Only authorized staff can access this area.</Typography></Paper></Container>
  if (profile.role === 'instructor' && location.pathname !== '/admin/cdl-instructor/') return <Navigate to="/admin/cdl-instructor/" replace />
  return <Outlet />
}
