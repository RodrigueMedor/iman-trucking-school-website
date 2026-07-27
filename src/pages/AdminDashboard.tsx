import { Box, Button, Chip, Container, Grid, Paper, Stack, Typography } from '@mui/material'
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded'
import ImageRoundedIcon from '@mui/icons-material/ImageRounded'
import PublicRoundedIcon from '@mui/icons-material/PublicRounded'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import { Link } from 'react-router-dom'
import { contentPages } from '../config/contentPages'
import { useContent } from '../contexts/ContentContext'

export function AdminDashboard() {
  const { entries } = useContent()
  const stats = [
    [ArticleRoundedIcon, entries.length, 'Content sections'],
    [VisibilityRoundedIcon, entries.filter(x => x.published).length, 'Published'],
    [PublicRoundedIcon, new Set(entries.map(x => x.page)).size, 'Managed pages'],
    [ImageRoundedIcon, entries.filter(x => x.image_url).length, 'Media assets'],
  ] as const
  return <><Box sx={{ bgcolor: 'primary.main', color: 'white', py: 7 }}><Container><Chip label="SUPER ADMIN" color="secondary" sx={{ mb: 2, fontWeight: 900 }} /><Typography variant="h2" fontWeight={950}>Content dashboard</Typography><Typography color="rgba(255,255,255,.72)" mt={1}>Manage all {contentPages.length} public pages from one secure back office.</Typography></Container></Box><Container sx={{ py: 5 }}><Grid container spacing={2.5}>{stats.map(([Icon, value, label]) => <Grid size={{ xs: 12, sm: 6, lg: 3 }} key={label}><Paper sx={{ p: 3, borderRadius: 3 }}><Icon color="secondary" /><Typography variant="h3" fontWeight={950} mt={2}>{value}</Typography><Typography color="text.secondary">{label}</Typography></Paper></Grid>)}</Grid><Paper sx={{ mt: 3, p: 4, borderRadius: 3 }}><Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={2}><Box><Typography variant="h4" fontWeight={950}>All website pages</Typography><Typography color="text.secondary" mt={1}>Edit hero text, page sections, bullet lists, images, buttons, ordering, and publishing.</Typography></Box><Button component={Link} to="/admin/content/" variant="contained" color="secondary" size="large">Open content library</Button></Stack></Paper></Container></>
}
