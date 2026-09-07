import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Paper,
  Stack,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Alert,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextareaAutosize,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import PendingIcon from '@mui/icons-material/Pending'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

type Application = {
  id: string
  studentId?: string
  courseId: string
  sessionId: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  statement?: string
  status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED'
  staffNotes?: string
  submittedAt: string
  reviewedAt?: string
  reviewedBy?: string
  createdAt: string
  updatedAt: string
  course: { id: string; name: string }
  session: { id: string; name: string }
}

const demoCourses = [{ id: 'demo-course-1', name: 'CDL Class A Training' }]
const demoSessions = [{ id: 'demo-session-1', name: 'Fall 2026' }]

export function CDLApplications() {
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [applications, setApplications] = useState<Application[]>([])
  const [courses, setCourses] = useState(demoCourses)
  const [sessions, setSessions] = useState(demoSessions)
  const [reviewDialog, setReviewDialog] = useState(false)
  const [selectedApp, setSelectedApp] = useState<Application | null>(null)
  const [reviewForm, setReviewForm] = useState({ status: '', staffNotes: '' })

  const isMock = !supabase

  useEffect(() => {
    if (isMock) {
      const saved = localStorage.getItem('iman-mock-applications')
      if (saved) setApplications(JSON.parse(saved))
    } else {
      loadData()
    }
  }, [isMock, statusFilter, searchQuery])

  async function loadData() {
    setLoading(true)
    try {
      let query = supabase!
        .from('cdl_class_applications')
        .select(`
          *,
          course:cdl_courses(id, name),
          session:cdl_academic_sessions(id, name)
        `)
        .order('createdAt', { ascending: false })

      if (statusFilter) query = query.eq('status', statusFilter)
      if (searchQuery) {
        query = query.or(`firstName.ilike.%${searchQuery}%,lastName.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
      }

      const { data, error } = await query
      if (!error && data) setApplications(data as any[])
    } catch {}
    setLoading(false)
  }

  async function updateStatus() {
    if (!selectedApp) return
    setLoading(true)
    try {
      if (isMock) {
        const updated = applications.map(app =>
          app.id === selectedApp.id
            ? { ...app, status: reviewForm.status as any, staffNotes: reviewForm.staffNotes, reviewedAt: new Date().toISOString() }
            : app
        )
        setApplications(updated)
        localStorage.setItem('iman-mock-applications', JSON.stringify(updated))
        setNotice('Application status updated successfully.')
      } else {
        const { error } = await supabase!
          .from('cdl_class_applications')
          .update({
            status: reviewForm.status as any,
            staffNotes: reviewForm.staffNotes,
            reviewedAt: new Date().toISOString(),
            reviewedBy: (await supabase!.auth.getUser()).data.user?.id,
          })
          .eq('id', selectedApp.id)

        if (error) throw error
        await loadData()
        setNotice('Application status updated successfully.')
      }
      setReviewDialog(false)
      setSelectedApp(null)
      setReviewForm({ status: '', staffNotes: '' })
    } catch {
      setNotice('An error occurred. Please try again.')
    }
    setLoading(false)
  }

  function openReview(app: Application) {
    setSelectedApp(app)
    setReviewForm({ status: app.status, staffNotes: app.staffNotes || '' })
    setReviewDialog(true)
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'APPROVED': return 'success'
      case 'REJECTED': return 'error'
      case 'UNDER_REVIEW': return 'info'
      case 'SUBMITTED': return 'warning'
      default: return 'default'
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'APPROVED': return <CheckCircleIcon />
      case 'REJECTED': return <CancelIcon />
      default: return <PendingIcon />
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7fb', py: 6 }}>
      <Container maxWidth="xl">
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
          <Box>
            <Button component={Link} to="/admin/" sx={{ mb: 2 }}>
              ← Dashboard
            </Button>
            <Typography variant="h3" fontWeight={900}>Class Applications</Typography>
          </Box>
        </Stack>

        <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} gap={2}>
            <TextField
              fullWidth
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Status Filter</InputLabel>
              <Select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                label="Status Filter"
              >
                <MenuItem value="">All Statuses</MenuItem>
                <MenuItem value="SUBMITTED">Submitted</MenuItem>
                <MenuItem value="UNDER_REVIEW">Under Review</MenuItem>
                <MenuItem value="APPROVED">Approved</MenuItem>
                <MenuItem value="REJECTED">Rejected</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </Paper>

        {notice && <Alert severity="info" sx={{ mb: 3 }}>{notice}</Alert>}

        <Paper sx={{ borderRadius: 3 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 900 }}>Applicant</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Course</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Session</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Submitted</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">Loading...</TableCell>
                  </TableRow>
                ) : applications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">No applications found.</TableCell>
                  </TableRow>
                ) : (
                  applications.map(app => (
                    <TableRow key={app.id}>
                      <TableCell>
                        <Typography fontWeight="bold">{app.firstName} {app.lastName}</Typography>
                        <Typography variant="body2" color="text.secondary">{app.email}</Typography>
                        {app.phone && <Typography variant="body2" color="text.secondary">{app.phone}</Typography>}
                      </TableCell>
                      <TableCell>{app.course.name}</TableCell>
                      <TableCell>{app.session.name}</TableCell>
                      <TableCell>
                        <Chip
                          icon={getStatusIcon(app.status)}
                          label={app.status}
                          color={getStatusColor(app.status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{new Date(app.submittedAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => openReview(app)}
                        >
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Dialog open={reviewDialog} onClose={() => setReviewDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>Review Application</DialogTitle>
          <DialogContent>
            {selectedApp && (
              <Stack spacing={2} sx={{ mt: 2 }}>
                <Typography><strong>Applicant:</strong> {selectedApp.firstName} {selectedApp.lastName}</Typography>
                <Typography><strong>Email:</strong> {selectedApp.email}</Typography>
                <Typography><strong>Course:</strong> {selectedApp.course.name}</Typography>
                <Typography><strong>Session:</strong> {selectedApp.session.name}</Typography>
                {selectedApp.statement && (
                  <Box>
                    <Typography fontWeight="bold" gutterBottom>Statement:</Typography>
                    <Typography variant="body2" sx={{ bgcolor: 'background.paper', p: 2, borderRadius: 1 }}>
                      {selectedApp.statement}
                    </Typography>
                  </Box>
                )}
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={reviewForm.status}
                    onChange={e => setReviewForm({ ...reviewForm, status: e.target.value })}
                    label="Status"
                  >
                    <MenuItem value="SUBMITTED">Submitted</MenuItem>
                    <MenuItem value="UNDER_REVIEW">Under Review</MenuItem>
                    <MenuItem value="APPROVED">Approved</MenuItem>
                    <MenuItem value="REJECTED">Rejected</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Staff Notes"
                  value={reviewForm.staffNotes}
                  onChange={e => setReviewForm({ ...reviewForm, staffNotes: e.target.value })}
                />
              </Stack>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setReviewDialog(false)}>Cancel</Button>
            <Button variant="contained" color="secondary" onClick={updateStatus} disabled={loading}>
              {loading ? 'Updating...' : 'Update Status'}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  )
}
