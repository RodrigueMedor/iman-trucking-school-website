import { useEffect, useState } from 'react'
import { Alert, Button } from '@mui/material'
import { Link } from 'react-router-dom'
import { getMyIdentity, type IdentityStatus } from './api'

/** Label and chip color for each identity status. */
export const IDENTITY_STATUS: Record<IdentityStatus, { label: string; color: 'default' | 'info' | 'success' | 'error' | 'warning' }> = {
  NOT_STARTED: { label: 'Not started', color: 'default' },
  PENDING: { label: 'Pending', color: 'info' },
  VERIFIED: { label: 'Verified', color: 'success' },
  FAILED: { label: 'Failed', color: 'error' },
  MANUAL_REVIEW: { label: 'Manual review', color: 'warning' },
}

/** The student's identity status, or null while loading or if it failed to load. */
export function useIdentityStatus() {
  const [status, setStatus] = useState<IdentityStatus | null>(null)
  useEffect(() => {
    let alive = true
    getMyIdentity().then(result => { if (alive) setStatus(result.status) }).catch(() => { if (alive) setStatus(null) })
    return () => { alive = false }
  }, [])
  return status
}

const MESSAGES: Partial<Record<IdentityStatus, (action: string) => string>> = {
  NOT_STARTED: action => `Verify your identity with your Driver’s License or Green Card and a live selfie before you ${action}.`,
  PENDING: action => `Your identity verification is in progress. You can ${action} once it is verified.`,
  FAILED: action => `Your identity verification did not succeed. Verify again before you ${action}.`,
  MANUAL_REVIEW: action => `Admissions is reviewing your identity verification. You can ${action} once it is approved.`,
}

/** Explains that a step is locked until identity is verified. Renders nothing once verified. */
export function IdentityNotice({ status, action }: { status: IdentityStatus | null; action: string }) {
  if (!status || status === 'VERIFIED') return null
  return <Alert severity={status === 'FAILED' ? 'error' : status === 'NOT_STARTED' ? 'warning' : 'info'} sx={{ mb: 3 }}
    action={status === 'MANUAL_REVIEW' ? undefined : <Button component={Link} to="/portal/identity" color="inherit" size="small">{status === 'PENDING' ? 'View status' : 'Verify now'}</Button>}>
    {MESSAGES[status]?.(action)}
  </Alert>
}
