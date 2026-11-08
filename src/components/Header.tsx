import { useEffect, useId, useRef, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  AppBar,
  Box,
  Button,
  ClickAwayListener,
  Container,
  Divider,
  Drawer,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Popper,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material'
import { keyframes } from '@mui/material/styles'
import type { SvgIconComponent } from '@mui/icons-material'
import AirportShuttleRoundedIcon from '@mui/icons-material/AirportShuttleRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded'
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded'
import PaidRoundedIcon from '@mui/icons-material/PaidRounded'
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded'
import RvHookupRoundedIcon from '@mui/icons-material/RvHookupRounded'
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import WorkRoundedIcon from '@mui/icons-material/WorkRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import FacebookRoundedIcon from '@mui/icons-material/FacebookRounded'
import InstagramIcon from '@mui/icons-material/Instagram'
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded'
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded'
import MailRoundedIcon from '@mui/icons-material/MailRounded'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded'
import AccountCircleRoundedIcon from '@mui/icons-material/AccountCircleRounded'
import XIcon from '@mui/icons-material/X'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { homeForRole, isStaffRole } from '../lib/adminAuth'
import { APPLY_PATH, mainNavigation, navDescriptions, type NavFeature, type NavGroup, type NavItem, type NavLink } from '../navigation'

/** A nav link is current when its page (ignoring any #section) is open. */
const basePath = (path: string) => path.split('#')[0]

const socialLinks = [
  ['Facebook', 'https://www.facebook.com/imantruckingschool', FacebookRoundedIcon],
  ['X', 'https://twitter.com/ImanTrucking', XIcon],
  ['Instagram', 'https://www.instagram.com/imantruckingschool/', InstagramIcon],
] as const

type SiteLanguage = 'en' | 'ht' | 'es'

const siteLanguages: Array<{ code: SiteLanguage; short: string; label: string }> = [
  { code: 'en', short: 'EN', label: 'English' },
  { code: 'ht', short: 'KR', label: 'Kreyòl' },
  { code: 'es', short: 'ES', label: 'Español' },
]

function getCurrentLanguage(): SiteLanguage {
  if (typeof window === 'undefined') return 'en'
  const saved = window.localStorage.getItem('iman-site-language')
  if (saved === 'ht' || saved === 'es' || saved === 'en') return saved
  const cookieMatch = document.cookie.match(/(?:^|;\s*)googtrans=\/en\/(en|ht|es)/)
  return (cookieMatch?.[1] as SiteLanguage | undefined) ?? 'en'
}

function selectLanguage(language: SiteLanguage) {
  window.localStorage.setItem('iman-site-language', language)
  const cookieValue = `/en/${language}`
  document.cookie = `googtrans=${cookieValue};path=/;max-age=31536000;SameSite=Lax`

  if (window.location.hostname.includes('.')) {
    document.cookie = `googtrans=${cookieValue};path=/;domain=.${window.location.hostname};max-age=31536000;SameSite=Lax`
  }

  window.location.reload()
}

function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null)
  const currentLanguage = getCurrentLanguage()
  const current = siteLanguages.find(({ code }) => code === currentLanguage) ?? siteLanguages[0]

  return (
    <Box className="notranslate" translate="no">
      <Button
        aria-label={`Select language. Current language: ${current.label}`}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        onClick={(event) => setAnchor(event.currentTarget)}
        startIcon={<LanguageRoundedIcon />}
        endIcon={compact ? undefined : <KeyboardArrowDownRoundedIcon />}
        sx={{
          minWidth: compact ? 52 : 118,
          minHeight: compact ? 40 : 42,
          px: compact ? 1 : 1.35,
          border: '1px solid rgba(8,8,95,.16)',
          borderRadius: 1.5,
          color: '#08085f',
          bgcolor: '#f7f8fc',
          fontSize: compact ? '.75rem' : '.8rem',
          letterSpacing: '.04em',
          '&:hover': { borderColor: 'secondary.main', bgcolor: 'rgba(239,48,38,.05)' },
          '& .MuiButton-startIcon': { mr: compact ? 0.5 : 0.8 },
        }}
      >
        {compact ? current.short : current.label}
      </Button>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{
          paper: {
            className: 'notranslate',
            translate: 'no',
            sx: {
              mt: 0.75,
              minWidth: 190,
              border: '1px solid rgba(8,8,95,.12)',
              borderRadius: 2,
              boxShadow: '0 18px 45px rgba(8,8,95,.16)',
            },
          },
        }}
      >
        {siteLanguages.map(({ code, short, label }) => (
          <MenuItem
            key={code}
            selected={currentLanguage === code}
            onClick={() => selectLanguage(code)}
            sx={{ gap: 1.25, py: 1.15, color: '#08085f', fontWeight: 750 }}
          >
            <Box
              component="span"
              sx={{
                display: 'grid',
                width: 30,
                height: 24,
                placeItems: 'center',
                borderRadius: 1,
                color: currentLanguage === code ? 'white' : '#08085f',
                bgcolor: currentLanguage === code ? 'secondary.main' : '#eef0f6',
                fontSize: '.68rem',
                fontWeight: 900,
              }}
            >
              {short}
            </Box>
            <Box component="span" sx={{ flex: 1 }}>{label}</Box>
            {currentLanguage === code && <CheckRoundedIcon color="secondary" fontSize="small" />}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  )
}

const NAV_ICONS: Record<string, SvgIconComponent> = {
  '/cdl-training/': LocalShippingRoundedIcon,
  '/class-b-cdl-training/': AirportShuttleRoundedIcon,
  '/box-truck-training/': Inventory2RoundedIcon,
  '/hotshot-training/': RvHookupRoundedIcon,
  '/cdl-assessment/': TranslateRoundedIcon,
  '/tuition-financing/': PaymentsRoundedIcon,
  '/cdl-jobs/': WorkRoundedIcon,
  '/truck-driver-pay-florida/': PaidRoundedIcon,
  '/truck-driving-career-benefits/': TrendingUpRoundedIcon,
}

const panelIn = keyframes`
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
`

const navInk = '#08085f'
const hoverSurface = '#f4f5fb'

type MenuItemData = Extract<NavItem, { links: readonly NavLink[] }>

function MenuColumn({ group, isCurrent, onNavigate }: { group: NavGroup; isCurrent: (path: string) => boolean; onNavigate: () => void }) {
  const rich = group.links.some(([, path]) => navDescriptions[path])
  return (
    <Box sx={{ minWidth: rich ? 288 : 216 }}>
      {group.heading && (
        <Typography
          component="p"
          sx={{ px: 1.25, pb: 1, mb: 1, borderBottom: '1px solid rgba(8,8,95,.08)', color: '#6a6d92', fontSize: '.68rem', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase' }}
        >
          {group.heading}
        </Typography>
      )}
      <Stack component="ul" spacing={rich ? 0.25 : 0} sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {group.links.map(([itemLabel, path]) => {
          const current = isCurrent(path)
          const Icon = NAV_ICONS[path]
          const description = navDescriptions[path]
          return (
            <li key={path}>
              <Box
                component={RouterLink}
                to={path}
                onClick={onNavigate}
                aria-current={current ? 'page' : undefined}
                sx={{
                  display: 'flex',
                  alignItems: rich ? 'flex-start' : 'center',
                  gap: 1.5,
                  px: 1.25,
                  py: rich ? 1.1 : 0.85,
                  borderRadius: '10px',
                  color: current ? 'secondary.main' : rich ? navInk : '#2b2d63',
                  textDecoration: 'none',
                  outline: 'none',
                  transition: 'background-color .15s ease, color .15s ease',
                  '& .nav-icon': { transition: 'background-color .15s ease, color .15s ease' },
                  '& .nav-arrow': { opacity: 0, transform: 'translateX(-4px)', transition: 'opacity .15s ease, transform .15s ease' },
                  '&:hover, &:focus-visible': {
                    bgcolor: hoverSurface,
                    color: 'secondary.main',
                    '& .nav-icon': { bgcolor: 'secondary.main', color: 'white' },
                    '& .nav-arrow': { opacity: 1, transform: 'translateX(0)' },
                  },
                  '&:focus-visible': { boxShadow: '0 0 0 2px rgba(239,48,38,.45)' },
                }}
              >
                {rich && Icon && (
                  <Box
                    className="nav-icon"
                    sx={{
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                      width: 38,
                      height: 38,
                      borderRadius: '10px',
                      bgcolor: current ? 'secondary.main' : 'rgba(239,48,38,.08)',
                      color: current ? 'white' : 'secondary.main',
                    }}
                  >
                    <Icon sx={{ fontSize: 20 }} />
                  </Box>
                )}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography component="span" sx={{ display: 'block', fontSize: rich ? '.9rem' : '.86rem', fontWeight: rich ? 750 : 650, lineHeight: 1.35, color: 'inherit' }}>
                    {itemLabel}
                  </Typography>
                  {description && (
                    <Typography component="span" sx={{ display: 'block', mt: 0.25, fontSize: '.78rem', lineHeight: 1.4, color: '#6a6d92' }}>
                      {description}
                    </Typography>
                  )}
                </Box>
                {!rich && <ChevronRightRoundedIcon className="nav-arrow" sx={{ fontSize: 18 }} />}
              </Box>
            </li>
          )
        })}
      </Stack>
    </Box>
  )
}

function MenuFeature({ feature, onNavigate }: { feature: NavFeature; onNavigate: () => void }) {
  const [actionLabel, actionPath] = feature.action
  return (
    <Stack
      sx={{
        position: 'relative',
        overflow: 'hidden',
        alignSelf: 'flex-start',
        width: 252,
        p: 2.75,
        borderRadius: '14px',
        color: 'white',
        background: 'linear-gradient(155deg, #12127a 0%, #08085f 55%, #05053f 100%)',
        '&::before': { content: '""', position: 'absolute', top: 0, left: 22, width: 36, height: 4, borderRadius: '0 0 4px 4px', bgcolor: 'secondary.main' },
        '&::after': { content: '""', position: 'absolute', right: -60, bottom: -60, width: 170, height: 170, borderRadius: '50%', border: '24px solid rgba(255,255,255,.05)' },
      }}
    >
      <Typography sx={{ color: '#ff8a83', fontSize: '.68rem', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase' }}>
        {feature.eyebrow}
      </Typography>
      <Typography sx={{ mt: 1, fontSize: '1.05rem', fontWeight: 800, lineHeight: 1.3 }}>{feature.title}</Typography>
      <Typography sx={{ mt: 1, mb: 2.25, fontSize: '.82rem', lineHeight: 1.55, color: 'rgba(255,255,255,.74)' }}>{feature.body}</Typography>
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Button
          component={RouterLink}
          to={actionPath}
          onClick={onNavigate}
          variant="contained"
          color="secondary"
          size="small"
          endIcon={<ArrowForwardRoundedIcon />}
          sx={{ minHeight: 38, px: 1.75, whiteSpace: 'nowrap' }}
        >
          {actionLabel}
        </Button>
        <Stack
          component="a"
          href="tel:8889914776"
          direction="row"
          alignItems="center"
          spacing={0.75}
          sx={{ mt: 1.75, color: 'rgba(255,255,255,.8)', fontSize: '.8rem', fontWeight: 700, textDecoration: 'none', '&:hover': { color: 'white' } }}
        >
          <PhoneRoundedIcon sx={{ fontSize: 16, color: '#ff8a83' }} />
          <span>(888) 991-4776</span>
        </Stack>
      </Box>
    </Stack>
  )
}

/**
 * A desktop dropdown laid out as a panel of grouped columns. It is a
 * disclosure (button + region of links), not a modal menu, so the page stays
 * usable, nothing is pre-highlighted, and it opens on hover, click or keyboard.
 */
function DesktopMenu({ item }: { item: MenuItemData }) {
  const { label, links, groups, feature } = item
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<number | undefined>(undefined)
  // A click on a menu the pointer just opened keeps it open; only a menu
  // opened by click (or keyboard) closes on the next click.
  const openedByHover = useRef(false)
  const panelId = useId()
  const { pathname, hash } = useLocation()
  const active = links.some(([, path]) => pathname === basePath(path))
  const isCurrent = (path: string) => `${pathname}${hash}` === path || (pathname === path && !hash)

  const cancelClose = () => window.clearTimeout(closeTimer.current)
  const show = (byHover = false) => {
    cancelClose()
    if (!open) openedByHover.current = byHover
    setOpen(true)
  }
  const hide = (delay = 150) => { cancelClose(); closeTimer.current = window.setTimeout(() => setOpen(false), delay) }
  const close = () => { cancelClose(); setOpen(false) }
  const focusFirstLink = () => window.requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>('a')?.focus())

  useEffect(() => () => window.clearTimeout(closeTimer.current), [])
  useEffect(() => { setOpen(false) }, [pathname, hash])

  return (
    <Box onMouseEnter={() => show(true)} onMouseLeave={() => hide()} sx={{ display: 'flex', alignSelf: 'stretch', alignItems: 'center' }}>
      <Button
        ref={anchorRef}
        color="inherit"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => {
          if (open && !openedByHover.current) close()
          else { openedByHover.current = false; show() }
        }}
        onKeyDown={event => {
          if (event.key === 'ArrowDown') { event.preventDefault(); show(); focusFirstLink() }
          if (event.key === 'Escape') close()
        }}
        endIcon={<KeyboardArrowDownRoundedIcon sx={{ fontSize: '16px !important', transition: 'transform .2s ease', transform: open ? 'rotate(180deg)' : 'none' }} />}
        sx={{
          alignSelf: 'stretch',
          borderRadius: 0,
          color: active || open ? 'secondary.main' : navInk,
          px: 1.55,
          position: 'relative',
          '&::after': {
            content: '""',
            position: 'absolute',
            right: 12,
            bottom: 0,
            left: 12,
            height: 3,
            borderRadius: '3px 3px 0 0',
            bgcolor: 'secondary.main',
            transform: active || open ? 'scaleX(1)' : 'scaleX(0)',
            transition: 'transform .2s ease',
          },
          '&:hover': { color: 'secondary.main', bgcolor: 'transparent' },
          '&:hover::after': { transform: 'scaleX(1)' },
        }}
      >
        {label}
      </Button>
      <Popper
        open={open}
        anchorEl={anchorRef.current}
        placement="bottom-start"
        modifiers={[
          { name: 'offset', options: { offset: [-16, 10] } },
          { name: 'preventOverflow', options: { padding: 24 } },
          { name: 'flip', enabled: false },
        ]}
        sx={{ zIndex: theme => theme.zIndex.appBar + 1 }}
      >
        <ClickAwayListener onClickAway={event => { if (!anchorRef.current?.contains(event.target as Node)) close() }}>
          <Paper
            ref={panelRef}
            id={panelId}
            role="region"
            aria-label={`${label} menu`}
            elevation={0}
            onMouseEnter={() => show(true)}
            onMouseLeave={() => hide()}
            onKeyDown={event => {
              if (event.key === 'Escape') { close(); anchorRef.current?.focus() }
            }}
            onBlur={event => {
              const next = event.relatedTarget as Node | null
              if (next && !panelRef.current?.contains(next) && !anchorRef.current?.contains(next)) close()
            }}
            sx={{
              position: 'relative',
              display: 'flex',
              gap: 3,
              p: 2.5,
              borderRadius: '18px',
              border: '1px solid rgba(8,8,95,.08)',
              boxShadow: '0 28px 70px rgba(8,8,95,.18), 0 4px 14px rgba(8,8,95,.06)',
              animation: `${panelIn} .18s ease-out`,
              // Bridges the gap under the nav so the pointer can reach the panel.
              '&::before': { content: '""', position: 'absolute', top: -12, left: 0, right: 0, height: 12 },
            }}
          >
            {(groups ?? [{ heading: '', links }]).map(group => (
              <MenuColumn key={group.heading || label} group={group} isCurrent={isCurrent} onNavigate={close} />
            ))}
            {feature && <MenuFeature feature={feature} onNavigate={close} />}
          </Paper>
        </ClickAwayListener>
      </Popper>
    </Box>
  )
}

function ApplyButton({ fullWidth = false, onClick }: { fullWidth?: boolean; onClick?: () => void }) {
  return (
    <Button component={RouterLink} to={APPLY_PATH} onClick={onClick} fullWidth={fullWidth} variant="contained" color="secondary" sx={{ whiteSpace: 'nowrap', minHeight: 42 }}>
      Apply Now
    </Button>
  )
}

/** Sign in for visitors, My Portal for signed-in students. */
function PortalButton({ fullWidth = false, onClick }: { fullWidth?: boolean; onClick?: () => void }) {
  const { session, profile } = useAuth()
  const staff = isStaffRole(profile?.role)
  const to = !session ? '/portal/sign-in' : profile ? homeForRole(profile.role) : '/portal/'
  return (
    <Button
      component={RouterLink}
      to={to}
      onClick={onClick}
      fullWidth={fullWidth}
      variant="outlined"
      color="primary"
      startIcon={<AccountCircleRoundedIcon />}
      sx={{ whiteSpace: 'nowrap', minHeight: 42 }}
    >
      {!session ? 'Sign in' : staff ? 'Admin' : 'My Portal'}
    </Button>
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
              {mainNavigation.map(item => {
                if ('links' in item) return <DesktopMenu key={item.label} item={item} />
                const active = pathname === item.path
                return (
                  <Button
                    key={item.path}
                    component={RouterLink}
                    to={item.path}
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
                    {item.label}
                  </Button>
                )
              })}
            </Stack>

            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ display: { xs: 'none', lg: 'flex' }, ml: 'auto' }}>
              <LanguageSelector />
              <PortalButton />
              <ApplyButton />
            </Stack>

            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ display: { xs: 'flex', lg: 'none' } }}>
              <LanguageSelector compact />
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
            {mainNavigation.map(item => 'links' in item ? (
              <Accordion key={item.label} disableGutters elevation={0} sx={{ '&::before': { display: 'none' } }}>
                <AccordionSummary
                  expandIcon={<ExpandMoreRoundedIcon />}
                  sx={{ px: 1, color: '#08085f', fontWeight: 800 }}
                >
                  {item.label}
                </AccordionSummary>
                <AccordionDetails sx={{ p: '0 0 8px 12px' }}>
                  {(item.groups ?? [{ heading: '', links: item.links }]).map(group => (
                    <Box key={group.heading || 'links'}>
                    {group.heading && <Typography sx={{ px: 1, pt: 1, pb: 0.5, color: 'secondary.main', fontSize: '.7rem', fontWeight: 900, letterSpacing: '.1em', textTransform: 'uppercase' }}>{group.heading}</Typography>}
                    {group.links.map(([itemLabel, path]) => (
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
                    </Box>
                  ))}
                </AccordionDetails>
              </Accordion>
            ) : (
              <Button
                key={item.path}
                component={RouterLink}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                fullWidth
                aria-current={pathname === item.path ? 'page' : undefined}
                sx={{
                  justifyContent: 'flex-start',
                  py: 1.25,
                  px: 1,
                  color: pathname === item.path ? 'secondary.main' : '#08085f',
                }}
              >
                {item.label}
              </Button>
            ))}
          </Box>
          <Stack spacing={1.25} p={2.5} mt="auto" bgcolor="#f6f7fb">
            <ApplyButton fullWidth onClick={() => setMobileOpen(false)} />
            <PortalButton fullWidth onClick={() => setMobileOpen(false)} />
            <LanguageSelector />
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
