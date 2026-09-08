import { useState } from 'react'
import { Box, Button, Card, CardContent, Chip, Container, Grid, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded'
import AssignmentIcon from '@mui/icons-material/Assignment'
import DownloadIcon from '@mui/icons-material/Download'
import ImageRoundedIcon from '@mui/icons-material/ImageRounded'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import PeopleIcon from '@mui/icons-material/People'
import PublicRoundedIcon from '@mui/icons-material/PublicRounded'
import SchoolIcon from '@mui/icons-material/School'
import SearchIcon from '@mui/icons-material/Search'
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import { Link } from 'react-router-dom'
import { contentPages } from '../config/contentPages'
import { useContent } from '../contexts/ContentContext'

const demoStudents = [
  { name: 'Marie Joseph', email: 'marie@example.com', score: 86, status: 'Ready', date: 'Sep 3, 2026' },
  { name: 'Jean Baptiste', email: 'jean@example.com', score: 72, status: 'Support', date: 'Sep 2, 2026' },
  { name: 'Nadia Pierre', email: 'nadia@example.com', score: 58, status: 'Preparation', date: 'Sep 1, 2026' },
]

export function AdminDashboard() {
  const { entries } = useContent()
  const [query, setQuery] = useState('')
  const stats = [
    [ArticleRoundedIcon, entries.length, 'Content sections'],
    [VisibilityRoundedIcon, entries.filter(x => x.published).length, 'Published'],
    [PublicRoundedIcon, new Set(entries.map(x => x.page)).size, 'Managed pages'],
    [ImageRoundedIcon, entries.filter(x => x.image_url).length, 'Media assets'],
  ] as const

  const cdlMetrics = [
    [PeopleIcon, 'Students', '128'],
    [SchoolIcon, 'Completed', '94'],
    [VerifiedUserIcon, 'Ready or supported', '78%'],
  ] as const

  const cdlTools = [
    [SchoolIcon, 'Score Management', 'Enter and publish student scores', '/admin/cdl-scores/'],
    [AssignmentIcon, 'Applications', 'Review class applications', '/admin/cdl-applications/'],
    [PersonAddIcon, 'Enrollments', 'Manage student enrollments', '/admin/cdl-enrollments/'],
    [PeopleIcon, 'Instructor View', 'View all student submissions', '/admin/cdl-instructor/'],
    [PersonAddIcon, 'Create Instructor', 'Create new instructor accounts', '/admin/create-instructor/'],
  ] as const

  const filteredStudents = demoStudents.filter(s =>
    `${s.name} ${s.email}`.toLowerCase().includes(query.toLowerCase())
  )

  function exportCSV() {
    const data = ['Name,Email,Score,Status,Date', ...demoStudents.map(s => `${s.name},${s.email},${s.score},${s.status},${s.date}`)].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([data], { type: 'text/csv' }))
    a.download = 'iman-results.csv'
    a.click()
  }

  return (
    <>
      <Box sx={{ bgcolor: 'primary.main', color: 'white', py: 7 }}>
        <Container>
          <Chip label="SUPER ADMIN" color="secondary" sx={{ mb: 2, fontWeight: 900 }} />
          <Typography variant="h2" fontWeight={950}>Content dashboard</Typography>
          <Typography color="rgba(255,255,255,.72)" mt={1}>Manage all {contentPages.length} public pages from one secure back office.</Typography>
        </Container>
      </Box>
      <Container sx={{ py: 5 }}>
        <Grid container spacing={2.5}>
          {stats.map(([Icon, value, label]) => (
            <Grid size={{ xs: 12, sm: 6, lg: 3 }} key={label}>
              <Paper sx={{ p: 3, borderRadius: 3 }}>
                <Icon color="secondary" />
                <Typography variant="h3" fontWeight={950} mt={2}>{value}</Typography>
                <Typography color="text.secondary">{label}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Typography variant="h5" fontWeight={900} sx={{ mt: 5, mb: 3 }}>CDL Readiness Overview</Typography>
        <Grid container spacing={2.5} sx={{ mb: 5 }}>
          {cdlMetrics.map(([Icon, label, value]) => (
            <Grid size={{ xs: 12, sm: 4 }} key={label}>
              <Paper sx={{ p: 3, borderRadius: 3 }}>
                <Icon sx={{ color: '#8a5700' }} />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{label}</Typography>
                <Typography variant="h3" fontWeight={950}>{value}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={2.5} sx={{ mb: 5 }}>
          {cdlTools.map(([Icon, title, description, link]) => (
            <Grid size={{ xs: 12, md: 4 }} key={title}>
              <Card
                component={Link}
                to={link}
                sx={{
                  height: '100%',
                  textDecoration: 'none',
                  transition: 'transform .2s ease, box-shadow .2s ease',
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 28px rgba(8,8,95,.12)' },
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Icon color="secondary" sx={{ fontSize: 32 }} />
                  <Typography variant="h6" fontWeight={900} mt={2} color="primary.main">{title}</Typography>
                  <Typography variant="body2" color="text.secondary" mt={1}>{description}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Paper sx={{ p: 4, borderRadius: 3, mb: 5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
            <Typography variant="h5" fontWeight={900}>Student Assessment Results</Typography>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCSV}>
              Export CSV
            </Button>
          </Stack>
          <TextField
            fullWidth
            placeholder="Search students..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} /> }}
            sx={{ mb: 3 }}
          />
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 900 }}>Student</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Score</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Classification</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Completed</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredStudents.map(s => (
                  <TableRow key={s.email}>
                    <TableCell>
                      <Typography fontWeight="bold">{s.name}</Typography>
                      <Typography variant="body2" color="text.secondary">{s.email}</Typography>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>{s.score}%</TableCell>
                    <TableCell>
                      <Chip
                        label={s.status}
                        color={s.status === 'Ready' ? 'success' : s.status === 'Support' ? 'warning' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{s.date}</TableCell>
                    <TableCell>
                      <Button
                        component={Link}
                        to={`/admin/cdl-scores`}
                        size="small"
                        sx={{ fontWeight: 'bold', color: '#a66a00' }}
                      >
                        View scores
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Paper sx={{ p: 4, borderRadius: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={2}>
            <Box>
              <Typography variant="h4" fontWeight={950}>All website pages</Typography>
              <Typography color="text.secondary" mt={1}>Edit hero text, page sections, bullet lists, images, buttons, ordering, and publishing.</Typography>
            </Box>
            <Button component={Link} to="/admin/content/" variant="contained" color="secondary" size="large">Open content library</Button>
          </Stack>
        </Paper>
      </Container>
    </>
  )
}
