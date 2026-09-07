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
  IconButton,
  Alert,
  Grid,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import MailIcon from '@mui/icons-material/Mail'
import SearchIcon from '@mui/icons-material/Search'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

type Student = { id: string; firstName: string; lastName: string; user: { email: string } }
type Course = { id: string; name: string }
type Session = { id: string; name: string }
type Score = {
  id: string
  studentId: string
  courseId: string
  sessionId: string
  assessment: string
  assessmentAt: string
  score: string
  totalPossible: string
  grade?: string
  comments?: string
  status: 'DRAFT' | 'PUBLISHED'
  createdAt: string
  updatedAt: string
  student: Student
  course: Course
  session: Session
  notifications: Array<{ status: string; sentAt?: string; errorMessage?: string }>
}

const demoStudents: Student[] = [
  { id: 'demo-student-1', firstName: 'Marie', lastName: 'Joseph', user: { email: 'marie@example.com' } },
]
const demoCourses: Course[] = [{ id: 'demo-course-1', name: 'CDL Class A Training' }]
const demoSessions: Session[] = [{ id: 'demo-session-1', name: 'Fall 2026' }]

export function CDLScoreManagement() {
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [studentQuery, setStudentQuery] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [students, setStudents] = useState<Student[]>(demoStudents)
  const [courses, setCourses] = useState<Course[]>(demoCourses)
  const [sessions, setSessions] = useState<Session[]>(demoSessions)
  const [records, setRecords] = useState<Score[]>([])
  const [formData, setFormData] = useState({
    studentId: '',
    courseId: '',
    sessionId: '',
    assessment: '',
    assessmentAt: '',
    score: '',
    totalPossible: '',
    grade: '',
    comments: '',
  })

  const isMock = !supabase

  useEffect(() => {
    if (isMock) {
      const saved = localStorage.getItem('iman-mock-score')
      if (saved) setRecords([JSON.parse(saved)])
    } else {
      loadData()
    }
  }, [isMock])

  async function loadData() {
    try {
      const studentId = selectedStudentId || undefined
      let query = supabase!.from('cdl_student_scores').select(`
        *,
        student:cdl_students(id, firstName, lastName, user:cdl_users(email)),
        course:cdl_courses(id, name),
        session:cdl_academic_sessions(id, name),
        notifications:cdl_score_notifications(status, sentAt, errorMessage)
      `).order('assessmentAt', { ascending: false })
      
      if (studentId) query = query.eq('studentId', studentId)
      
      const { data, error } = await query
      if (!error && data) setRecords(data as any[])
    } catch {}
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const body = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    
    if (Number(body.score) > Number(body.totalPossible)) {
      setNotice('Score cannot exceed total possible score.')
      setLoading(false)
      return
    }

    try {
      if (isMock) {
        const row: Score = {
          ...body,
          id: `SCORE-${Date.now()}`,
          status: 'DRAFT' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          student: demoStudents[0],
          course: demoCourses[0],
          session: demoSessions[0],
          notifications: [],
          studentId: body.studentId || demoStudents[0].id,
          courseId: body.courseId || demoCourses[0].id,
          sessionId: body.sessionId || demoSessions[0].id,
          assessment: body.assessment,
          assessmentAt: body.assessmentAt,
          score: body.score,
          totalPossible: body.totalPossible,
          grade: body.grade,
          comments: body.comments,
        }
        localStorage.setItem('iman-mock-score', JSON.stringify(row))
        setRecords([row])
        setNotice('Draft score saved to mock storage.')
      } else {
        const { data, error } = await supabase!.from('cdl_student_scores').insert({
          ...body,
          score: Number(body.score),
          totalPossible: Number(body.totalPossible),
          assessmentAt: new Date(body.assessmentAt).toISOString(),
          createdBy: (await supabase!.auth.getUser()).data.user?.id,
        }).select().single()
        
        if (error) throw error
        setRecords([data as any, ...records])
        setNotice('Draft score saved to the database.')
      }
      resetForm()
    } catch {
      setNotice('An error occurred. Please try again.')
    }
    setLoading(false)
  }

  async function publish(scoreId: string) {
    setLoading(true)
    try {
      if (isMock) {
        const published = records.map(x => x.id === scoreId ? { ...x, status: 'PUBLISHED' as const } : x)
        setRecords(published)
        localStorage.setItem('iman-mock-score', JSON.stringify(published.find(x => x.id === scoreId)))
        setNotice('Score published. Mock email notification recorded.')
      } else {
        const { data, error } = await supabase!
          .from('cdl_student_scores')
          .update({ status: 'PUBLISHED', publishedAt: new Date().toISOString() })
          .eq('id', scoreId)
          .select()
          .single()
        
        if (error) throw error
        setRecords(records.map(r => r.id === scoreId ? data as any : r))
        setNotice('Score published successfully.')
      }
    } catch {
      setNotice('An error occurred while publishing.')
    }
    setLoading(false)
  }

  async function deleteScore(scoreId: string) {
    if (!confirm('Are you sure you want to delete this draft score?')) return
    setLoading(true)
    try {
      if (isMock) {
        setRecords(records.filter(r => r.id !== scoreId))
        localStorage.removeItem('iman-mock-score')
        setNotice('Score deleted from mock storage.')
      } else {
        const { error } = await supabase!.from('cdl_student_scores').delete().eq('id', scoreId)
        if (error) throw error
        setRecords(records.filter(r => r.id !== scoreId))
        setNotice('Score deleted successfully.')
      }
    } catch {
      setNotice('An error occurred while deleting.')
    }
    setLoading(false)
  }

  function editScore(score: Score) {
    setEditingId(score.id)
    setFormData({
      studentId: score.studentId,
      courseId: score.courseId,
      sessionId: score.sessionId,
      assessment: score.assessment,
      assessmentAt: score.assessmentAt,
      score: score.score,
      totalPossible: score.totalPossible,
      grade: score.grade || '',
      comments: score.comments || '',
    })
  }

  function resetForm() {
    setFormData({
      studentId: '',
      courseId: '',
      sessionId: '',
      assessment: '',
      assessmentAt: '',
      score: '',
      totalPossible: '',
      grade: '',
      comments: '',
    })
    setEditingId(null)
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7fb', py: 6 }}>
      <Container maxWidth="xl">
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
          <Box>
            <Button component={Link} to="/admin/" sx={{ mb: 2 }}>
              ← Dashboard
            </Button>
            <Typography variant="h3" fontWeight={900}>Student Score Management</Typography>
          </Box>
        </Stack>

        {!isMock && (
          <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
            <Stack direction="row" gap={2} alignItems="center">
              <TextField
                fullWidth
                placeholder="Search students by name or email..."
                value={studentQuery}
                onChange={e => setStudentQuery(e.target.value)}
                InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} /> }}
              />
              {selectedStudentId && (
                <Button variant="outlined" onClick={() => { setSelectedStudentId(''); setStudentQuery(''); loadData(); }}>
                  Show all scores
                </Button>
              )}
            </Stack>
          </Paper>
        )}

        <Paper sx={{ p: 4, mb: 3, borderRadius: 3 }}>
          <Typography variant="h6" fontWeight={900} gutterBottom>
            {editingId ? 'Update Score' : 'Save Draft Score'}
          </Typography>
          <form onSubmit={submit}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Student</InputLabel>
                  <Select
                    name="studentId"
                    value={formData.studentId}
                    onChange={e => setFormData({ ...formData, studentId: e.target.value })}
                    label="Student"
                    required
                  >
                    {students.map(s => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.firstName} {s.lastName} ({s.user.email})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Class / Course</InputLabel>
                  <Select
                    name="courseId"
                    value={formData.courseId}
                    onChange={e => setFormData({ ...formData, courseId: e.target.value })}
                    label="Class / Course"
                    required
                  >
                    {courses.map(c => (
                      <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Academic Session</InputLabel>
                  <Select
                    name="sessionId"
                    value={formData.sessionId}
                    onChange={e => setFormData({ ...formData, sessionId: e.target.value })}
                    label="Academic Session"
                    required
                  >
                    {sessions.map(s => (
                      <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Assessment Name"
                  name="assessment"
                  value={formData.assessment}
                  onChange={e => setFormData({ ...formData, assessment: e.target.value })}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  type="date"
                  label="Assessment Date"
                  name="assessmentAt"
                  value={formData.assessmentAt}
                  onChange={e => setFormData({ ...formData, assessmentAt: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Score"
                  name="score"
                  value={formData.score}
                  onChange={e => setFormData({ ...formData, score: e.target.value })}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Total Possible"
                  name="totalPossible"
                  value={formData.totalPossible}
                  onChange={e => setFormData({ ...formData, totalPossible: e.target.value })}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Grade"
                  name="grade"
                  value={formData.grade}
                  onChange={e => setFormData({ ...formData, grade: e.target.value })}
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Comments"
                  name="comments"
                  value={formData.comments}
                  onChange={e => setFormData({ ...formData, comments: e.target.value })}
                />
              </Grid>
              <Grid size={12}>
                <Stack direction="row" gap={2}>
                  <Button type="submit" variant="contained" color="secondary" disabled={loading} sx={{ flex: 1 }}>
                    {loading ? 'Saving...' : editingId ? 'Update Score' : 'Save Draft Score'}
                  </Button>
                  {editingId && (
                    <Button type="button" variant="outlined" onClick={resetForm}>
                      Cancel
                    </Button>
                  )}
                </Stack>
              </Grid>
            </Grid>
          </form>
        </Paper>

        {notice && <Alert severity="info" sx={{ mb: 3 }}>{notice}</Alert>}

        {records.length > 0 && (
          <Paper sx={{ p: 4, borderRadius: 3 }}>
            <Typography variant="h6" fontWeight={900} gutterBottom>Academic History</Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 900 }}>Student</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>Assessment</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>Score</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>Email</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {records.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Typography fontWeight="bold">{r.student.firstName} {r.student.lastName}</Typography>
                        <Typography variant="body2" color="text.secondary">{r.student.user.email}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography>{r.assessment}</Typography>
                        <Typography variant="body2" color="text.secondary">{r.course.name} · {r.session.name}</Typography>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>{r.score}/{r.totalPossible}</TableCell>
                      <TableCell>
                        <Chip
                          icon={r.status === 'PUBLISHED' ? <CheckCircleIcon /> : <CancelIcon />}
                          label={r.status}
                          color={r.status === 'PUBLISHED' ? 'success' : 'warning'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {r.notifications.length > 0 ? (
                          <Chip
                            icon={<MailIcon />}
                            label={r.notifications[0].status === 'SENT' ? 'Sent' : 'Failed'}
                            color={r.notifications[0].status === 'SENT' ? 'success' : 'error'}
                            size="small"
                          />
                        ) : (
                          <Typography variant="body2" color="text.secondary">Not sent</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" gap={1}>
                          {r.status === 'DRAFT' && (
                            <>
                              <IconButton size="small" onClick={() => editScore(r)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton size="small" color="error" onClick={() => deleteScore(r.id)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                              <Button size="small" variant="contained" color="secondary" onClick={() => publish(r.id)}>
                                Publish
                              </Button>
                            </>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}
      </Container>
    </Box>
  )
}
