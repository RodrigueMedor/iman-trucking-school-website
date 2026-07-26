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
  Tooltip,
  Typography,
} from '@mui/material'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import FacebookRoundedIcon from '@mui/icons-material/FacebookRounded'
import InstagramIcon from '@mui/icons-material/Instagram'
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded'
import MailRoundedIcon from '@mui/icons-material/MailRounded'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded'
import XIcon from '@mui/icons-material/X'
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

const socialLinks = [
  ['Facebook', 'https://www.facebook.com/imantruckingschool', FacebookRoundedIcon],
  ['X', 'https://twitter.com/ImanTrucking', XIcon],
  ['Instagram', 'https://www.instagram.com/imantruckingschool/', InstagramIcon],
] as const

type MenuLinks = typeof truckDrivingLinks | typeof programMenuLinks

function DesktopMenu({ label, links }: { label: string; links: MenuLinks }) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null)
  const { pathname } = useLocation()
  const active = links.some(([, path]) => pathname === path)
  const closeMenu = () => setAnchor(null)

  return (
    <Box
      onMouseLeave={closeMenu}
      sx={{ display: 'flex', alignSelf: 'stretch', alignItems: 'center' }}
    >
      <Button
        color="inherit"
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        onClick={(event) => setAnchor(event.currentTarget)}
        onMouseEnter={(event) => setAnchor(event.currentTarget)}
        endIcon={<KeyboardArrowDownRoundedIcon sx={{ fontSize: '16px !important' }} />}
        sx={{
          alignSelf: 'stretch',
          borderRadius: 0,
          color: active ? 'secondary.main' : '#09095e',
          px: 1.55,
          position: 'relative',
          '&::after': {
            content: '""',
            position: 'absolute',
            right: 12,
            bottom: 0,
            left: 12,
            height: 3,
            bgcolor: active ? 'secondary.main' : 'transparent',
            transform: active ? 'scaleX(1)' : 'scaleX(0)',
            transition: 'transform .2s ease',
          },
          '&:hover': { color: 'secondary.main', bgcolor: 'transparent' },
          '&:hover::after': { bgcolor: 'secondary.main', transform: 'scaleX(1)' },
        }}
      >
        {label}
      </Button>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={closeMenu}
        MenuListProps={{ onMouseLeave: closeMenu, sx: { py: 0.75 } }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.25,
              minWidth: 270,
              border: '1px solid',
              borderColor: 'divider',
              borderTop: '3px solid',
              borderTopColor: 'secondary.main',
              borderRadius: '0 0 10px 10px',
              boxShadow: '0 18px 45px rgba(8,8,87,.16)',
            },
          },
        }}
      >
        {links.map(([itemLabel, path]) => (
          <MenuItem
            key={path}
            component={RouterLink}
            to={path}
            selected={pathname === path}
            onClick={closeMenu}
            sx={{
              py: 1.2,
              px: 2.25,
              color: '#09095e',
              fontSize: '.875rem',
              fontWeight: 700,
              '&:hover, &.Mui-selected': {
                color: 'secondary.main',
                bgcolor: 'rgba(239,48,38,.06)',
              },
            }}
          >
            {itemLabel}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  )
}

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { pathname } = useLocation()

  return (
    <>
      <Box
        component="header"
        sx={{
          bgcolor: '#08085f',
          color: 'white',
          display: { xs: 'none', lg: 'block' },
        }}
      >
        <Container>
          <Stack direction="row" alignItems="center" justifyContent="space-between" minHeight={124}>
            <Box
              component={RouterLink}
              to="/"
              aria-label="Iman Trucking School home"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                transition: 'transform .2s ease',
                '&:hover': { transform: 'translateY(-2px)' },
              }}
            >
              <Box
                component="img"
                src="/images/iman-logo.png"
                alt="Iman Trucking School"
                sx={{ width: 102, height: 90, objectFit: 'contain' }}
              />
            </Box>

            <Stack alignItems="flex-end" spacing={1}>
              <Stack direction="row" alignItems="center" spacing={2.5}>
                <Stack
                  component="a"
                  href="tel:8889914776"
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  color="rgba(255,255,255,.78)"
                  sx={{ textDecoration: 'none', '&:hover': { color: 'white' } }}
                >
                  <PhoneRoundedIcon sx={{ color: 'secondary.main', fontSize: 18 }} />
                  <Typography variant="body2">(888) 991-4776</Typography>
                </Stack>
                <Stack
                  component="a"
                  href="mailto:info@imanlogistics.com"
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  color="rgba(255,255,255,.78)"
                  sx={{ textDecoration: 'none', '&:hover': { color: 'white' } }}
                >
                  <MailRoundedIcon sx={{ color: 'secondary.main', fontSize: 18 }} />
                  <Typography variant="body2">info@imanlogistics.com</Typography>
                </Stack>
              </Stack>
              <Stack direction="row" spacing={0.7}>
                {socialLinks.map(([label, href, Icon]) => (
                  <Tooltip key={label} title={label}>
                    <IconButton
                      component="a"
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={label}
                      size="small"
                      sx={{
                        width: 28,
                        height: 28,
                        color: 'secondary.main',
                        border: '1px solid',
                        borderColor: 'secondary.main',
                        transition: 'all .2s ease',
                        '&:hover': { color: 'white', bgcolor: 'secondary.main', transform: 'translateY(-2px)' },
                      }}
                    >
                      <Icon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                ))}
              </Stack>
            </Stack>
          </Stack>
        </Container>
      </Box>

      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{
          borderBottom: '1px solid',
          borderColor: 'rgba(8,8,95,.1)',
          bgcolor: 'rgba(255,255,255,.98)',
          backdropFilter: 'blur(14px)',
          boxShadow: '0 5px 18px rgba(8,8,95,.05)',
        }}
      >
        <Container>
          <Toolbar disableGutters sx={{ minHeight: { xs: 76, lg: 90 } }}>
            <Box
              component={RouterLink}
              to="/"
              aria-label="Iman Trucking School home"
              sx={{ display: { xs: 'flex', lg: 'none' }, alignItems: 'center', mr: 'auto' }}
            >
              <Box
                component="img"
                src="/images/iman-logo.png"
                alt="Iman Trucking School"
                sx={{
                  width: 82,
                  height: 64,
                  objectFit: 'contain',
                  bgcolor: '#08085f',
                  borderRadius: 1.5,
                  px: 0.5,
                }}
              />
            </Box>

            <Stack
              component="nav"
              aria-label="Main navigation"
              direction="row"
              alignItems="center"
              spacing={0.25}
              sx={{ display: { xs: 'none', lg: 'flex' }, alignSelf: 'stretch' }}
            >
              <DesktopMenu label="Truck Driving School" links={truckDrivingLinks} />
              <DesktopMenu label="Our Program" links={programMenuLinks} />
              {directLinks.map(([label, path]) => {
                const active = pathname === path
                return (
                  <Button
                    key={path}
                    component={RouterLink}
                    to={path}
                    color="inherit"
                    aria-current={active ? 'page' : undefined}
                    sx={{
                      alignSelf: 'stretch',
                      borderRadius: 0,
                      color: active ? 'secondary.main' : '#09095e',
                      px: 1.55,
                      position: 'relative',
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        right: 12,
                        bottom: 0,
                        left: 12,
                        height: 3,
                        bgcolor: 'secondary.main',
                        transform: active ? 'scaleX(1)' : 'scaleX(0)',
                        transition: 'transform .2s ease',
                      },
                      '&:hover': { color: 'secondary.main', bgcolor: 'transparent' },
                      '&:hover::after': { transform: 'scaleX(1)' },
                    }}
                  >
                    {label}
                  </Button>
                )
              })}
            </Stack>

            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ display: { xs: 'flex', lg: 'none' } }}>
              <IconButton component="a" href="tel:8889914776" aria-label="Call Iman Trucking School" sx={{ color: 'secondary.main' }}>
                <PhoneRoundedIcon />
              </IconButton>
              <IconButton aria-label="Open navigation menu" onClick={() => setMobileOpen(true)} sx={{ color: '#08085f' }}>
                <MenuRoundedIcon />
              </IconButton>
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>

      <Drawer
        anchor="right"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        PaperProps={{ sx: { width: 'min(92vw, 390px)' } }}
      >
        <Stack height="100%">
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            px={2.5}
            py={1.4}
            bgcolor="#08085f"
          >
            <Box
              component="img"
              src="/images/iman-logo.png"
              alt="Iman Trucking School"
              sx={{ display: 'block', width: 82, height: 66, objectFit: 'contain' }}
            />
            <IconButton aria-label="Close navigation menu" onClick={() => setMobileOpen(false)} sx={{ color: 'white' }}>
              <CloseRoundedIcon />
            </IconButton>
          </Stack>
          <Box component="nav" aria-label="Mobile navigation" px={2} py={2} sx={{ overflowY: 'auto' }}>
            <Button
              component={RouterLink}
              to="/"
              onClick={() => setMobileOpen(false)}
              fullWidth
              sx={{ justifyContent: 'flex-start', py: 1.25, color: pathname === '/' ? 'secondary.main' : '#08085f' }}
            >
              Home
            </Button>
            {[
              ['Truck Driving School', truckDrivingLinks],
              ['Our Program', programMenuLinks],
            ].map(([label, links]) => (
              <Accordion key={label as string} disableGutters elevation={0} sx={{ '&::before': { display: 'none' } }}>
                <AccordionSummary
                  expandIcon={<ExpandMoreRoundedIcon />}
                  sx={{ px: 1, color: '#08085f', fontWeight: 800 }}
                >
                  {label as string}
                </AccordionSummary>
                <AccordionDetails sx={{ p: '0 0 8px 12px' }}>
                  {(links as MenuLinks).map(([itemLabel, path]) => (
                    <Button
                      key={path}
                      component={RouterLink}
                      to={path}
                      onClick={() => setMobileOpen(false)}
                      fullWidth
                      sx={{
                        justifyContent: 'flex-start',
                        py: 1,
                        color: pathname === path ? 'secondary.main' : 'text.secondary',
                        fontSize: '.875rem',
                      }}
                    >
                      {itemLabel}
                    </Button>
                  ))}
                </AccordionDetails>
              </Accordion>
            ))}
            {directLinks.map(([label, path]) => (
              <Button
                key={path}
                component={RouterLink}
                to={path}
                onClick={() => setMobileOpen(false)}
                fullWidth
                sx={{
                  justifyContent: 'flex-start',
                  py: 1.25,
                  px: 1,
                  color: pathname === path ? 'secondary.main' : '#08085f',
                }}
              >
                {label}
              </Button>
            ))}
          </Box>
          <Stack spacing={1.25} p={2.5} mt="auto" bgcolor="#f6f7fb">
            <Button component="a" href="tel:8889914776" variant="outlined" startIcon={<PhoneRoundedIcon />}>
              (888) 991-4776
            </Button>
            <Typography variant="caption" color="text.secondary" textAlign="center">
              info@imanlogistics.com
            </Typography>
          </Stack>
        </Stack>
      </Drawer>
    </>
  )
}
