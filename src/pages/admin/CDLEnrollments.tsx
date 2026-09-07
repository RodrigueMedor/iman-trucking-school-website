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
  IconButton,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import DeleteIcon from '@mui/icons-material/Delete'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

type Student = { id: string; firstName: string; lastName: string; user: { email: string } }
type Course = { id: string; name: string }
type Session = { id: string; name: string }
type Enrollment = {
  id: string
  studentId: string
  courseId: string
  sessionId: string
  active: boolean
  createdAt: string
  updatedAt: string
  student: Student
  course: Course
  session: Session
}

const demoStudents: Student[] = [
  { id: 'demo-student-1', firstName: 'Marie', lastName: 'Joseph', user: { email: 'marie@example.com' } },
]
const demoCourses: Course[] = [{ id: 'demo-course-1', name: 'CDL Class A Training' }]
const demoSessions: Session[] = [{ id: 'demo-session-1', name: 'Fall 2026' }]
const demoEnrollments: Enrollment[] = [
  {
    id: 'demo-enrollment-1',
    studentId: 'demo-student-1',
    courseId: 'demo-course-1',
    sessionId: 'demo-session-1',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    student: demoStudents[0],
    course: demoCourses[0],
    session: demoSessions[0],
  },
]

export function CDLEnrollments() {
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [studentQuery, setStudentQuery] = useState('')
  const [students, setStudents] = useState<Student[]>(demoStudents)
  const [courses, setCourses] = useState<Course[]>(demoCourses)
  const [sessions, setSessions] = useState<Session[]>(demoSessions)
  const [enrollments, setEnrollments] = useState<Enrollment[]>(demoEnrollments)
  const [formData, setFormData] = useState({
    studentId: '',
    courseId: '',
    sessionId: '',
  })

  const isMock = !supabase

  useEffect(() => {
    if (isMock) {
      const saved = localStorage.getItem('iman-mock-enrollments')
      if (saved) setEnrollments(JSON.parse(saved))
    } else {
      loadData()
    }
  }, [isMock])

  async function loadData() {
    setLoading(true)
    try {
      const { data, error } = await supabase!
        .from('cdl_enrollments')
        .select(`
          *,
          student:cdl_students(id, firstName, lastName, user:cdl_users(email)),
          course:cdl_courses(id, name),
          session:cdl_academic_sessions(id, name)
        `)
        .order('createdAt', { ascending: false })

      if (!error && data) setEnrollments(data as any[])
    } catch {}
    setLoading(false)
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const body = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>

    try {
      if (isMock) {
        const student = students.find(s => s.id === body.studentId)
        const course = courses.find(c => c.id === body.courseId)
        const session = sessions.find(s => s.id === body.sessionId)
        if (!student || !course || !session) {
          setNotice('Invalid selection.')
          setLoading(false)
          return
        }
        const newEnrollment: Enrollment = {
          ...body,
          id: `ENROLL-${Date.now()}`,
          studentId: body.studentId,
          courseId: body.courseId,
          sessionId: body.sessionId,
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          student,
          course,
          session,
        }
        const updated = [...enrollments, newEnrollment]
        setEnrollments(updated)
        localStorage.setItem('iman-mock-enrollments', JSON.stringify(updated))
        setNotice('Enrollment created successfully.')
        setShowForm(false)
        resetForm()
      } else {
        const { data, error } = await supabase!
          .from('cdl_enrollments')
          .insert({
            studentId: body.studentId,
            courseId: body.courseId,
            sessionId: body.sessionId,
            active: true,
          })
          .select(`
            *,
            student:cdl_students(id, firstName, lastName, user:cdl_users(email)),
            course:cdl_courses(id, name),
            session:cdl_academic_sessions(id, name)
          `)
          .single()

        if (error) throw error
        setEnrollments([data as any, ...enrollments])
        setNotice('Enrollment created successfully.')
        setShowForm(false)
        resetForm()
      }
    } catch {
      setNotice('An error occurred. Please try again.')
    }
    setLoading(false)
  }

  async function toggleActive(enrollmentId: string, currentActive: boolean) {
    setLoading(true)
    try {
      if (isMock) {
        const updated = enrollments.map(e => e.id === enrollmentId ? { ...e, active: !currentActive } : e)
        setEnrollments(updated)
        localStorage.setItem('iman-mock-enrollments', JSON.stringify(updated))
        setNotice(`Enrollment ${!currentActive ? 'activated' : 'deactivated'}.`)
      } else {
        const { error } = await supabase!
          .from('cdl_enrollments')
          .update({ active: !currentActive })
          .eq('id', enrollmentId)

        if (error) throw error
        await loadData()
        setNotice(`Enrollment ${!currentActive ? 'activated' : 'deactivated'}.`)
      }
    } catch {
      setNotice('An error occurred.')
    }
    setLoading(false)
  }

  async function deleteEnrollment(enrollmentId: string) {
    if (!confirm('Are you sure you want to remove this enrollment?')) return
    setLoading(true)
    try {
      if (isMock) {
        const updated = enrollments.filter(e => e.id !== enrollmentId)
        setEnrollments(updated)
        localStorage.setItem('iman-mock-enrollments', JSON.stringify(updated))
        setNotice('Enrollment removed.')
      } else {
        const { error } = await supabase!.from('cdl_enrollments').delete().eq('id', enrollmentId)
        if (error) throw error
        await loadData()
        setNotice('Enrollment removed.')
      }
    } catch {
      setNotice('An error occurred.')
    }
    setLoading(false)
  }

  function resetForm() {
    setFormData({ studentId: '', courseId: '', sessionId: '' })
    setStudentQuery('')
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7fb', py: 6 }}>
      <Container maxWidth="xl">
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
          <Box>
            <Button component={Link} to="/admin/" sx={{ mb: 2 }}>
              ← Dashboard
            </Button>
            <Typography variant="h3" fontWeight={900}>Student Enrollments</Typography>
          </Box>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<PersonAddIcon />}
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? 'Cancel' : 'New Enrollment'}
          </Button>
        </Stack>

        {notice && <Alert severity="info" sx={{ mb: 3 }}>{notice}</Alert>}

        {showForm && (
          <Paper sx={{ p: 4, mb: 3, borderRadius: 3 }}>
            <Typography variant="h6" fontWeight={900} gutterBottom>Create New Enrollment</Typography>
            <form onSubmit={submit}>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 4 }}>
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
                <Grid size={{ xs: 12, md: 4 }}>
                  <FormControl fullWidth>
                    <InputLabel>Course</InputLabel>
                    <Select
                      name="courseId"
                      value={formData.courseId}
                      onChange={e => setFormData({ ...formData, courseId: e.target.value })}
                      label="Course"
                      required
                    >
                      {courses.map(c => (
                        <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <FormControl fullWidth>
                    <InputLabel>Session</InputLabel>
                    <Select
                      name="sessionId"
                      value={formData.sessionId}
                      onChange={e => setFormData({ ...formData, sessionId: e.target.value })}
                      label="Session"
                      required
                    >
                      {sessions.map(s => (
                        <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={12}>
                  <Stack direction="row" gap={2}>
                    <Button type="submit" variant="contained" color="secondary" disabled={loading} sx={{ flex: 1 }}>
                      {loading ? 'Creating...' : 'Create Enrollment'}
                    </Button>
                    <Button type="button" variant="outlined" onClick={() => { setShowForm(false); resetForm(); }}>
                      Cancel
                    </Button>
                  </Stack>
                </Grid>
              </Grid>
            </form>
          </Paper>
        )}

        <Paper sx={{ borderRadius: 3 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 900 }}>Student</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Course</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Session</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Enrolled</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && enrollments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">Loading...</TableCell>
                  </TableRow>
                ) : enrollments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">No enrollments found.</TableCell>
                  </TableRow>
                ) : (
                  enrollments.map(e => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <Typography fontWeight="bold">{e.student.firstName} {e.student.lastName}</Typography>
                        <Typography variant="body2" color="text.secondary">{e.student.user.email}</Typography>
                      </TableCell>
                      <TableCell>{e.course.name}</TableCell>
                      <TableCell>{e.session.name}</TableCell>
                      <TableCell>
                        <Chip
                          icon={e.active ? <CheckCircleIcon /> : <CancelIcon />}
                          label={e.active ? 'Active' : 'Inactive'}
                          color={e.active ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{new Date(e.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Stack direction="row" gap={1}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => toggleActive(e.id, e.active)}
                          >
                            {e.active ? 'Deactivate' : 'Activate'}
                          </Button>
                          <IconButton size="small" color="error" onClick={() => deleteEnrollment(e.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Container>
    </Box>
  )
}
