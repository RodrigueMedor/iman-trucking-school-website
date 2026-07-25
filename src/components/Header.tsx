import { useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  AppBar,
  Box,
  Button,
  Container,
  Divider,
  Drawer,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material'
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded'
import MailOutlineRoundedIcon from '@mui/icons-material/MailOutlineRounded'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import PhoneInTalkRoundedIcon from '@mui/icons-material/PhoneInTalkRounded'
import { Link as RouterLink, useLocation } from 'react-router-dom'

const truckDrivingLinks = [
  ['Truck Driving School', '/truck-driving-school/'],
  ['Orlando Truck Driving School', '/truck-driving-school-orlando-florida/'],
  ['CDL License Information', '/cdl-license-information/'],
  ['CDL Permit Tests', '/cdl-permit-tests/'],
  ['How to Become a Truck Driver', '/how-to-become-a-truck-driver/'],
] as const

const programMenuLinks = [
  ['Our Program', '/our-program/'],
  ['CDL Training', '/cdl-training/'],
  ['CDL Training School', '/advantages-of-attending-a-cdl-training-school/'],
  ['Class A CDL', '/class-a-cdl/'],
  ['Amazon Career Choice', '/amazon-career-choice/'],
] as const

const directLinks = [
  ['Contact Us', '/contact-us/'],
  ['Kreyòl', '/kreyol/'],
  ['Gallery', '/gallery/'],
] as const

type MenuLinks = typeof truckDrivingLinks | typeof programMenuLinks

function DesktopMenu({ label, links }: { label: string; links: MenuLinks }) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null)
  const { pathname } = useLocation()
  const active = links.some(([, path]) => pathname === path)

  return <>
    <Button
      color="inherit"
      aria-haspopup="menu"
      aria-expanded={Boolean(anchor)}
      onClick={(event) => setAnchor(event.currentTarget)}
      endIcon={<KeyboardArrowDownRoundedIcon />}
      sx={{
        color: active ? 'secondary.main' : 'primary.main',
        px: 1.5,
        '&::after': {
          content: '""',
          position: 'absolute',
          inset: 'auto 12px 5px',
          height: 2,
          borderRadius: 2,
          bgcolor: active ? 'secondary.main' : 'transparent',
        },
      }}
    >
      {label}
    </Button>
    <Menu
      anchorEl={anchor}
      open={Boolean(anchor)}
      onClose={() => setAnchor(null)}
      slotProps={{ paper: { sx: { mt: 1, minWidth: 255, border: '1px solid', borderColor: 'divider', boxShadow: '0 20px 55px rgba(7,26,51,.15)' } } }}
    >
      {links.map(([itemLabel, path]) => (
        <MenuItem
          key={path}
          component={RouterLink}
          to={path}
          selected={pathname === path}
          onClick={() => setAnchor(null)}
          sx={{ py: 1.25, fontWeight: 700, fontSize: '.9rem' }}
        >
          {itemLabel}
        </MenuItem>
      ))}
    </Menu>
  </>
}

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { pathname } = useLocation()

  return <>
    <Box sx={{ bgcolor: '#071a33', color: 'rgba(255,255,255,.82)', display: { xs: 'none', md: 'block' } }}>
      <Container>
        <Stack direction="row" alignItems="center" justifyContent="space-between" minHeight={38}>
          <Stack direction="row" spacing={3}>
            <Stack direction="row" spacing={1} alignItems="center">
              <AccessTimeRoundedIcon sx={{ fontSize: 16, color: '#ff5b66' }} />
              <Typography variant="caption" fontWeight={700}>Day, evening & weekend training</Typography>
            </Stack>
            <Stack component="a" href="mailto:info@imanlogistics.com" direction="row" spacing={1} alignItems="center" color="inherit" sx={{ textDecoration: 'none' }}>
              <MailOutlineRoundedIcon sx={{ fontSize: 16, color: '#ff5b66' }} />
              <Typography variant="caption" fontWeight={700}>info@imanlogistics.com</Typography>
            </Stack>
          </Stack>
          <Typography component="a" href="tel:8889914776" color="white" variant="caption" fontWeight={900} sx={{ textDecoration: 'none' }}>
            Call admissions: (888) 991-4776
          </Typography>
        </Stack>
      </Container>
    </Box>

    <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'rgba(255,255,255,.96)', backdropFilter: 'blur(14px)' }}>
      <Container>
        <Toolbar disableGutters sx={{ minHeight: { xs: 76, md: 88 } }}>
          <Box component={RouterLink} to="/" aria-label="Iman Trucking School home" sx={{ display: 'flex', alignItems: 'center', mr: 'auto', px: 1, bgcolor: 'primary.main', borderRadius: 2 }}>
            <Box component="img" src="/images/iman-logo.png" alt="Iman Trucking School" sx={{ width: { xs: 75, md: 90 }, height: { xs: 61, md: 72 }, objectFit: 'contain' }} />
          </Box>

          <Stack component="nav" aria-label="Main navigation" direction="row" alignItems="center" spacing={0.25} sx={{ display: { xs: 'none', lg: 'flex' } }}>
            <DesktopMenu label="Truck Driving School" links={truckDrivingLinks} />
            <DesktopMenu label="Our Program" links={programMenuLinks} />
            {directLinks.map(([label, path]) => (
              <Button
                key={path}
                component={RouterLink}
                to={path}
                color="inherit"
                sx={{
                  color: pathname === path ? 'white' : 'primary.main',
                  bgcolor: pathname === path ? 'secondary.main' : 'transparent',
                  px: 1.4,
                  '&:hover': {
                    color: pathname === path ? 'white' : 'secondary.main',
                    bgcolor: pathname === path ? 'secondary.dark' : 'rgba(214,31,44,.06)',
                  },
                }}
              >
                {label}
              </Button>
            ))}
          </Stack>

          <Button
            component="a"
            href="https://coach.lending.online/iman-trucking-school"
            target="_blank"
            rel="noreferrer"
            variant="contained"
            color="secondary"
            sx={{ ml: { xs: 0, lg: 2 }, display: { xs: 'none', sm: 'inline-flex' }, boxShadow: '0 10px 24px rgba(214,31,44,.24)' }}
          >
            Financing
          </Button>
          <IconButton aria-label="Open navigation menu" onClick={() => setMobileOpen(true)} sx={{ ml: 1, display: { lg: 'none' }, color: 'primary.main' }}>
            <MenuRoundedIcon />
          </IconButton>
        </Toolbar>
      </Container>
    </AppBar>

    <Drawer anchor="right" open={mobileOpen} onClose={() => setMobileOpen(false)} PaperProps={{ sx: { width: 'min(90vw, 390px)' } }}>
      <Stack height="100%">
        <Stack direction="row" alignItems="center" justifyContent="space-between" px={2.5} py={1.5}>
          <Box sx={{ px: 1, bgcolor: 'primary.main', borderRadius: 2 }}>
            <Box component="img" src="/images/iman-logo.png" alt="Iman Trucking School" sx={{ display: 'block', width: 76, height: 64, objectFit: 'contain' }} />
          </Box>
          <IconButton aria-label="Close navigation menu" onClick={() => setMobileOpen(false)}><CloseRoundedIcon /></IconButton>
        </Stack>
        <Divider />
        <Box component="nav" aria-label="Mobile navigation" px={2} py={2} sx={{ overflowY: 'auto' }}>
          <Button component={RouterLink} to="/" onClick={() => setMobileOpen(false)} fullWidth sx={{ justifyContent: 'flex-start', py: 1.25, color: pathname === '/' ? 'secondary.main' : 'primary.main' }}>Home</Button>
          {[
            ['Truck Driving School', truckDrivingLinks],
            ['Our Program', programMenuLinks],
          ].map(([label, links]) => (
            <Accordion key={label as string} disableGutters elevation={0} sx={{ '&::before': { display: 'none' } }}>
              <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />} sx={{ px: 1, color: 'primary.main', fontWeight: 800 }}>{label as string}</AccordionSummary>
              <AccordionDetails sx={{ p: '0 0 8px 12px' }}>
                {(links as MenuLinks).map(([itemLabel, path]) => (
                  <Button key={path} component={RouterLink} to={path} onClick={() => setMobileOpen(false)} fullWidth sx={{ justifyContent: 'flex-start', py: 1, color: pathname === path ? 'secondary.main' : 'text.secondary', fontSize: '.875rem' }}>{itemLabel}</Button>
                ))}
              </AccordionDetails>
            </Accordion>
          ))}
          {directLinks.map(([label, path]) => (
            <Button key={path} component={RouterLink} to={path} onClick={() => setMobileOpen(false)} fullWidth sx={{ justifyContent: 'flex-start', py: 1.25, px: 1.5, color: pathname === path ? 'white' : 'primary.main', bgcolor: pathname === path ? 'secondary.main' : 'transparent', '&:hover': { bgcolor: pathname === path ? 'secondary.dark' : 'rgba(214,31,44,.06)' } }}>{label}</Button>
          ))}
        </Box>
        <Stack spacing={1.25} p={2.5} mt="auto" bgcolor="#f6f8fb">
          <Button component="a" href="tel:8889914776" variant="outlined" startIcon={<PhoneInTalkRoundedIcon />}>(888) 991-4776</Button>
          <Button component="a" href="https://coach.lending.online/iman-trucking-school" target="_blank" rel="noreferrer" variant="contained" color="secondary">Financing available</Button>
        </Stack>
      </Stack>
    </Drawer>
  </>
}
