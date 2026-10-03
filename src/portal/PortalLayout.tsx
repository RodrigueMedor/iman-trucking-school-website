import { useState } from 'react'
import {
  AppBar, Avatar, Box, Button, Divider, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Toolbar, Typography,
} from '@mui/material'
import DashboardRounded from '@mui/icons-material/DashboardRounded'
import LocalShippingRounded from '@mui/icons-material/LocalShippingRounded'
import FactCheckRounded from '@mui/icons-material/FactCheckRounded'
import AssignmentRounded from '@mui/icons-material/AssignmentRounded'
import FolderRounded from '@mui/icons-material/FolderRounded'
import EventRounded from '@mui/icons-material/EventRounded'
import PersonRounded from '@mui/icons-material/PersonRounded'
import LogoutRounded from '@mui/icons-material/LogoutRounded'
import MenuRounded from '@mui/icons-material/MenuRounded'
import HomeRounded from '@mui/icons-material/HomeRounded'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { NAVY } from './ui'

const WIDTH = 272

const NAV = [
  { label: 'Dashboard', to: '/portal/', icon: <DashboardRounded />, exact: true },
  { label: 'Apply for CDL Training', to: '/portal/apply/training', icon: <LocalShippingRounded /> },
  { label: 'Apply for CDL Assessment', to: '/portal/apply/assessment', icon: <FactCheckRounded /> },
  { label: 'My Applications', to: '/portal/applications/', icon: <AssignmentRounded /> },
  { label: 'Documents', to: '/portal/documents/', icon: <FolderRounded /> },
  { label: 'Schedule', to: '/portal/schedule/', icon: <EventRounded /> },
  { label: 'Profile & Account', to: '/portal/profile/', icon: <PersonRounded /> },
]

export function PortalLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const [open, setOpen] = useState(false)

  const isActive = (item: (typeof NAV)[number]) =>
    item.exact ? pathname === item.to : pathname.startsWith(item.to.replace(/\/$/, ''))

  const logout = async () => {
    setOpen(false)
    await signOut()
    navigate('/portal/sign-in', { replace: true })
  }

  const drawer = (
    <Box component="nav" aria-label="Student portal" sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: NAVY, color: 'white' }}>
      <Box component={Link} to="/portal/" onClick={() => setOpen(false)} sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5, textDecoration: 'none', color: 'inherit' }}>
        <Box sx={{ bgcolor: 'white', borderRadius: 2, p: 0.75, display: 'grid', placeItems: 'center' }}>
          <Box component="img" src="/images/iman-logo.png" alt="" sx={{ height: 34, display: 'block' }} />
        </Box>
        <Box>
          <Typography fontWeight={950} fontSize={15} lineHeight={1.2}>IMAN TRUCKING SCHOOL</Typography>
          <Typography color="rgba(255,255,255,.6)" fontSize={11} letterSpacing=".13em" fontWeight={900}>STUDENT PORTAL</Typography>
        </Box>
      </Box>
      <Divider sx={{ borderColor: 'rgba(255,255,255,.12)' }} />
      <List sx={{ p: 1.5, flex: 1, overflowY: 'auto' }}>
        {NAV.map(item => (
          <ListItemButton
            key={item.to}
            component={Link}
            to={item.to}
            selected={isActive(item)}
            aria-current={isActive(item) ? 'page' : undefined}
            onClick={() => setOpen(false)}
            sx={{
              color: 'rgba(255,255,255,.78)', borderRadius: 2.5, mb: 0.5, minHeight: 46,
              '&:hover': { bgcolor: 'rgba(255,255,255,.08)' },
              '&.Mui-selected, &.Mui-selected:hover': { bgcolor: 'rgba(214,31,44,.22)', color: '#ff8a8f' },
            }}
          >
            <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 800, fontSize: 14.5 }} />
          </ListItemButton>
        ))}
      </List>
      <Box sx={{ p: 1.5 }}>
        <Button component={Link} to="/" fullWidth startIcon={<HomeRounded />} sx={{ color: 'rgba(255,255,255,.75)', justifyContent: 'flex-start' }}>
          Public website
        </Button>
        <Button onClick={() => void logout()} fullWidth startIcon={<LogoutRounded />} sx={{ color: 'rgba(255,255,255,.75)', justifyContent: 'flex-start' }}>
          Log out
        </Button>
      </Box>
    </Box>
  )

  const name = profile?.full_name || 'Student'
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f3f6fa' }}>
      <AppBar elevation={0} sx={{ bgcolor: 'white', color: 'text.primary', width: { md: `calc(100% - ${WIDTH}px)` }, ml: { md: `${WIDTH}px` }, borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar sx={{ minHeight: { xs: 64, md: 72 }, gap: 1 }}>
          <IconButton onClick={() => setOpen(true)} sx={{ display: { md: 'none' } }} aria-label="Open menu" edge="start">
            <MenuRounded />
          </IconButton>
          <Box component={Link} to="/portal/" sx={{ display: { xs: 'block', md: 'none' } }}>
            <Box component="img" src="/images/iman-logo.png" alt="Iman Trucking School" sx={{ height: 36, display: 'block' }} />
          </Box>
          <Box flex={1} sx={{ display: { xs: 'none', md: 'block' } }}>
            <Typography fontWeight={900} color={NAVY}>Student Portal</Typography>
            <Typography variant="caption" color="text.secondary">Applications, documents and schedule</Typography>
          </Box>
          <Box flex={1} sx={{ display: { xs: 'block', md: 'none' } }} />
          <Typography sx={{ display: { xs: 'none', sm: 'block' }, fontWeight: 700, mr: 1 }}>{name}</Typography>
          <Avatar component={Link} to="/portal/profile/" sx={{ bgcolor: NAVY, width: 38, height: 38, textDecoration: 'none' }} aria-label="Profile">
            {name.charAt(0).toUpperCase()}
          </Avatar>
          <IconButton onClick={() => void logout()} aria-label="Log out" sx={{ display: { xs: 'none', md: 'inline-flex' } }}>
            <LogoutRounded />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Drawer open={open} onClose={() => setOpen(false)} sx={{ display: { md: 'none' }, '& .MuiDrawer-paper': { width: WIDTH, maxWidth: '85vw' } }}>
        {drawer}
      </Drawer>
      <Drawer variant="permanent" sx={{ display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': { width: WIDTH, border: 0 } }}>
        {drawer}
      </Drawer>
      <Box component="main" sx={{ ml: { md: `${WIDTH}px` }, pt: { xs: '64px', md: '72px' } }}>
        <Box sx={{ maxWidth: 1180, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 5 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
