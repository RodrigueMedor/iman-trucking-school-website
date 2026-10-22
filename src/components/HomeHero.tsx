import { useEffect, useState, type ReactNode } from 'react'
import { Box, Button, Container, IconButton, Stack, Tooltip, Typography, useMediaQuery } from '@mui/material'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import { Link as RouterLink } from 'react-router-dom'
import { useContent } from '../contexts/ContentContext'
import { FinancingBar, FinancingBenefits, RED, ROYAL } from './financing/HomeFinancing'

// Background slideshow: the school's own truck photos.
const heroSlides = [
  { src: '/images/home-hero.jpg', position: 'center 45%', label: 'IMAN training trucks' },
  { src: '/images/gallery/gallery-26.jpg', position: 'center 55%', label: 'IMAN Trucking School truck' },
  { src: '/images/home-hero-2.jpg', position: 'center 50%', label: 'Training yard' },
  { src: '/images/gallery/gallery-10.jpg', position: 'center 55%', label: 'Students with the training fleet' },
  { src: '/images/gallery/gallery-25.jpg', position: 'center 55%', label: 'Class A truck and trailer' },
  { src: '/images/gallery/gallery-30.jpg', position: 'center 50%', label: 'CDL Class A graduates' },
] as const
const SLIDE_MS = 6000

// Media at one edge of the hero, fading toward the centre, on a navy wave
// with a red stripe. Desktop only; phones get a single photo strip.
function EdgeMedia({ side, children }: { side: 'left' | 'right'; children: ReactNode }) {
  const left = side === 'left'
  const fade = `linear-gradient(${left ? '90deg' : '270deg'}, #000 50%, transparent 100%)`
  return (
    <Box sx={{ display: { xs: 'none', md: 'block' }, position: 'absolute', top: 0, bottom: 0, [side]: 0, width: { md: '21%', xl: '22%' }, overflow: 'hidden' }}>
      <Box sx={{ position: 'absolute', inset: 0, maskImage: fade, WebkitMaskImage: fade }}>{children}</Box>
      <Box
        component="svg"
        aria-hidden
        viewBox="0 0 400 160"
        preserveAspectRatio="none"
        sx={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: 120, transform: left ? 'none' : 'scaleX(-1)', pointerEvents: 'none' }}
      >
        <path d="M0 40 C 120 70, 250 130, 400 160 L 0 160 Z" fill={ROYAL} />
        <path d="M0 22 C 130 55, 260 118, 400 150" fill="none" stroke={RED} strokeWidth="7" strokeLinecap="round" />
      </Box>
    </Box>
  )
}

export function HomeHero() {
  const { content } = useContent()
  const hero = content('home', 'hero', {
    section_label: 'Orlando’s career-focused CDL school',
    title: 'Your road to a professional driving career.',
    body: 'Build real-world driving skills with experienced instructors, hands-on Class A CDL training, and support from enrollment through graduation.',
    button_text: 'Check your CDL readiness',
    button_url: '/cdl-assessment/',
  })
  const [activeSlide, setActiveSlide] = useState(0)
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  // Restarts after a manual pick so the chosen photo gets a full turn.
  useEffect(() => {
    if (reduceMotion) return
    const rotation = window.setTimeout(() => {
      setActiveSlide((current) => (current + 1) % heroSlides.length)
    }, SLIDE_MS)
    return () => window.clearTimeout(rotation)
  }, [reduceMotion, activeSlide])

  return <>
    <Box
      component="section"
      sx={{
        position: 'relative', overflow: 'hidden',
        bgcolor: '#f5f6fb',
      }}
    >
      <Box sx={{ position: 'relative', isolation: 'isolate', bgcolor: '#041226' }}>
      {/* Truck photo slideshow behind the headline, crossfading with a slow zoom. */}
      <Box aria-hidden sx={{ position: 'absolute', inset: 0, zIndex: -1, overflow: 'hidden' }}>
        {heroSlides.map((slide, index) => (
          <Box
            key={slide.src}
            sx={{
              position: 'absolute', inset: 0, backgroundImage: `url(${slide.src})`, backgroundSize: 'cover', backgroundPosition: slide.position,
              opacity: index === activeSlide ? 1 : 0, transition: 'opacity 1.2s ease',
              animation: index === activeSlide && !reduceMotion ? `imanSlideZoom ${SLIDE_MS + 1200}ms ease-out both` : 'none',
              '@keyframes imanSlideZoom': { from: { transform: 'scale(1)' }, to: { transform: 'scale(1.07)' } },
            }}
          />
        ))}
        {/* Navy tint, a little deeper behind the text so it stays readable. */}
        <Box sx={{ position: 'absolute', inset: 0, background: 'radial-gradient(60% 70% at 50% 38%, rgba(4,18,38,.72) 0%, rgba(4,18,38,.5) 70%, rgba(4,18,38,.38) 100%), linear-gradient(180deg, rgba(8,8,95,.25) 0%, rgba(4,18,38,.15) 60%, rgba(4,18,38,.55) 100%)' }} />
      </Box>
      <EdgeMedia side="left">
        <Box aria-hidden sx={{ position: 'absolute', inset: 0, backgroundImage: 'url(/images/gallery/gallery-23.jpg)', backgroundSize: 'cover', backgroundPosition: '70% 40%' }} />
      </EdgeMedia>
      <EdgeMedia side="right">{null}</EdgeMedia>

      <Container sx={{ position: 'relative', pt: { xs: 6, md: 9 }, pb: { xs: 5, md: 10 }, px: { md: '22%', xl: '24%' }, maxWidth: { md: 'none' }, textAlign: 'center' }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ display: 'inline-flex', px: { xs: 1.5, sm: 2 }, py: 0.85, borderRadius: 20, bgcolor: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.28)', backdropFilter: 'blur(8px)' }}>
          <SchoolRoundedIcon sx={{ fontSize: 19, color: '#ff5964' }} />
          <Typography component="p" sx={{ color: 'white', fontSize: { xs: '.66rem', sm: '.76rem' }, fontWeight: 900, letterSpacing: { xs: '.06em', sm: '.1em' }, textTransform: 'uppercase' }}>
            {hero.section_label}
          </Typography>
        </Stack>

        <Typography component="h1" variant="h1" sx={{ mt: 2.5, mx: 'auto', maxWidth: 820, color: 'white', textShadow: '0 2px 24px rgba(0,0,0,.35)', fontSize: { xs: '2.4rem', sm: '3.2rem', md: '3.3rem', lg: '4rem' }, lineHeight: 1.02 }}>
          {hero.title}
        </Typography>
        <Typography component="p" sx={{ mt: 1.75, color: 'white', fontWeight: 900, letterSpacing: '-.02em', fontSize: { xs: '1.25rem', sm: '1.5rem', lg: '1.75rem' }, lineHeight: 1.2 }}>
          Your CDL Dream. <Box component="span" sx={{ color: '#ff5964' }}>Your Future.</Box> Your Payment Plan.
        </Typography>
        <Typography sx={{ mt: 2, mx: 'auto', maxWidth: 640, color: 'rgba(255,255,255,.86)', fontSize: { xs: '1rem', md: '1.08rem' }, lineHeight: 1.7 }}>
          {hero.body}
        </Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center" sx={{ mt: 3.5 }}>
          <Button component={RouterLink} to="/cdl-assessment/" variant="contained" color="secondary" size="large" endIcon={<ArrowForwardRoundedIcon />} sx={{ minHeight: 54, px: 3, boxShadow: '0 15px 35px -10px rgba(214,31,44,.55)' }}>
            Check your CDL readiness
          </Button>
          <Button component={RouterLink} to="/our-program/" variant="outlined" size="large" sx={{ minHeight: 54, px: 3, color: 'white', borderWidth: 1.5, borderColor: 'rgba(255,255,255,.6)', bgcolor: 'rgba(255,255,255,.06)', backdropFilter: 'blur(6px)', '&:hover': { borderWidth: 1.5, borderColor: 'white', bgcolor: 'rgba(255,255,255,.14)' } }}>
            Explore the program
          </Button>
        </Stack>

        <Box sx={{ mt: { xs: 4, md: 5 } }}>
          <FinancingBenefits />
        </Box>
      </Container>
      </Box>

      <Container sx={{ position: 'relative', mt: { md: -6 }, pb: { xs: 4, md: 5 } }}>
        <FinancingBar />
        <Stack
          className="notranslate"
          translate="no"
          direction="row"
          spacing={0.75}
          alignItems="center"
          justifyContent="flex-end"
          sx={{ mt: 1.5 }}
          aria-label="Choose a background photo"
        >
          <Typography variant="caption" sx={{ mr: .5, color: 'text.secondary', fontWeight: 800 }}>
            Photo {activeSlide + 1} of {heroSlides.length}
          </Typography>
          {heroSlides.map((slide, index) => (
            <Tooltip key={slide.src} title={slide.label}>
              <IconButton
                aria-label={`Show ${slide.label}`}
                aria-pressed={activeSlide === index}
                onClick={() => setActiveSlide(index)}
                size="small"
                sx={{ p: 0.75 }}
              >
                <Box sx={{ width: activeSlide === index ? 26 : 10, height: 10, borderRadius: 5, bgcolor: activeSlide === index ? 'secondary.main' : 'rgba(8,8,95,.22)', transition: 'all .3s ease' }} />
              </IconButton>
            </Tooltip>
          ))}
        </Stack>
      </Container>
    </Box>
    <Box sx={{ bgcolor: 'white', borderBottom: '1px solid', borderColor: 'divider' }}>
      <Container>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" gap={2} py={2.5}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Stack direction="row" spacing={-.4}>{[1, 2, 3, 4, 5].map(star => <StarRoundedIcon key={star} sx={{ color: '#f5a623' }} />)}</Stack>
            <Box><Typography fontWeight={900} color="primary.main">Trusted by aspiring drivers</Typography><Typography variant="body2" color="text.secondary">Practical training. Personal support. Career confidence.</Typography></Box>
          </Stack>
          <Stack direction="row" spacing={{ xs: 2.5, sm: 5 }}>
            <Box><Typography fontWeight={900} fontSize="1.45rem" color="primary.main">4 weeks</Typography><Typography variant="caption" color="text.secondary">Focused CDL training</Typography></Box>
            <Box><Typography fontWeight={900} fontSize="1.45rem" color="primary.main">Class A</Typography><Typography variant="caption" color="text.secondary">Career-ready program</Typography></Box>
            <Box><Typography fontWeight={900} fontSize="1.45rem" color="primary.main">Orlando</Typography><Typography variant="caption" color="text.secondary">Convenient location</Typography></Box>
          </Stack>
        </Stack>
      </Container>
    </Box>
  </>
}
