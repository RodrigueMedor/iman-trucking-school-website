import { useState } from 'react'
import { AppBar, Avatar, Box, Button, Divider, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Toolbar, Typography } from '@mui/material'
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded'
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded'
import HomeRoundedIcon from '@mui/icons-material/HomeRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

const width = 276
const links = [
  ['Dashboard', '/admin/', <DashboardRoundedIcon />],
  ['All page content', '/admin/content/', <ArticleRoundedIcon />],
] as const

export function AdminLayout() {
  const { pathname } = useLocation()
  const { profile, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const drawer = <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#071a33', color: 'white' }}>
    <Box sx={{ p: 3 }}><Typography fontWeight={950} fontSize={20}>IMAN TRUCKING SCHOOL</Typography><Typography color="rgba(255,255,255,.55)" fontSize={11} letterSpacing=".13em" fontWeight={900}>WEBSITE STUDIO</Typography></Box>
    <Divider sx={{ borderColor: 'rgba(255,255,255,.1)' }} />
    <List sx={{ p: 1.5 }}>{links.map(([label, path, icon]) => <ListItemButton key={path} component={Link} to={path} selected={path === '/admin/' ? pathname === path : pathname.startsWith(path)} onClick={() => setOpen(false)} sx={{ color: 'rgba(255,255,255,.74)', borderRadius: 2.5, mb: .75, '&.Mui-selected': { bgcolor: 'rgba(214,31,44,.2)', color: '#ff7379' } }}><ListItemIcon sx={{ color: 'inherit', minWidth: 42 }}>{icon}</ListItemIcon><ListItemText primary={label} primaryTypographyProps={{ fontWeight: 850 }} /></ListItemButton>)}</List>
    <Box sx={{ mt: 'auto', p: 2 }}><Button component={Link} to="/" target="_blank" fullWidth startIcon={<HomeRoundedIcon />} sx={{ color: 'rgba(255,255,255,.72)', justifyContent: 'flex-start' }}>View public website</Button></Box>
  </Box>
  return <Box sx={{ minHeight: '100vh', bgcolor: '#f3f6fa' }}>
    <AppBar elevation={0} sx={{ bgcolor: 'white', color: 'text.primary', width: { md: `calc(100% - ${width}px)` }, ml: { md: `${width}px` }, borderBottom: 1, borderColor: 'divider' }}><Toolbar sx={{ minHeight: 72 }}><IconButton onClick={() => setOpen(true)} sx={{ display: { md: 'none' } }}><MenuRoundedIcon /></IconButton><Box flex={1}><Typography fontWeight={900}>Website administration</Typography><Typography variant="caption" color="text.secondary">Manage every public page</Typography></Box><Avatar sx={{ bgcolor: 'primary.main', mr: 1.5 }}>{profile?.full_name?.charAt(0) || 'A'}</Avatar><IconButton onClick={() => void signOut()} aria-label="Sign out"><LogoutRoundedIcon /></IconButton></Toolbar></AppBar>
    <Drawer open={open} onClose={() => setOpen(false)} sx={{ display: { md: 'none' }, '& .MuiDrawer-paper': { width } }}>{drawer}</Drawer>
    <Drawer variant="permanent" sx={{ display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': { width, border: 0 } }}>{drawer}</Drawer>
    <Box component="main" sx={{ ml: { md: `${width}px` }, pt: '72px' }}><Outlet /></Box>
  </Box>
}
