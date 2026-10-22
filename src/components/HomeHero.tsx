import { useEffect, useState, type ReactNode } from 'react'
import { Box, Button, Container, IconButton, Stack, Tooltip, Typography, useMediaQuery } from '@mui/material'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import { Link as RouterLink } from 'react-router-dom'
import { useContent } from '../contexts/ContentContext'
import { FinancingBar, FinancingBenefits, RED, ROYAL } from './financing/HomeFinancing'

const trainingVideos = [
  {
    src: 'https://imantruckingschool.com/wp-content/uploads/2025/02/TPAUL-IMAN.mp4',
    label: 'Student driver training',
  },
  {
    src: 'https://imantruckingschool.com/wp-content/uploads/2025/02/WEB-IMAN.mp4',
    label: 'CDL training experience',
  },
] as const

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
  const [activeVideo, setActiveVideo] = useState(0)
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  useEffect(() => {
    if (reduceMotion) return
    const rotation = window.setInterval(() => {
      setActiveVideo((current) => (current + 1) % trainingVideos.length)
    }, 12_000)
    return () => window.clearInterval(rotation)
  }, [reduceMotion])

  return <>
    <Box
      component="section"
      sx={{
        position: 'relative', overflow: 'hidden',
        bgcolor: '#f5f6fb',
      }}
    >
      <Box sx={{ position: 'relative', isolation: 'isolate', bgcolor: '#041226' }}>
      {/* Truck training videos behind the headline, rotating; a still photo when motion is reduced. */}
      <Box aria-hidden sx={{ position: 'absolute', inset: 0, zIndex: -1, overflow: 'hidden', backgroundImage: 'url(/images/home-hero.jpg)', backgroundSize: 'cover', backgroundPosition: { xs: '62% center', md: 'center 45%' } }}>
        {!reduceMotion && (
          <Box
            component="video"
            key={trainingVideos[activeVideo].src}
            src={trainingVideos[activeVideo].src}
            poster="/images/home-hero.jpg"
            autoPlay
            muted
            playsInline
            preload="metadata"
            aria-hidden="true"
            onEnded={() => setActiveVideo((current) => (current + 1) % trainingVideos.length)}
            sx={{
              position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center',
              animation: 'imanVideoReveal .9s ease both',
              '@keyframes imanVideoReveal': { from: { opacity: 0, transform: 'scale(1.025)' }, to: { opacity: 1, transform: 'scale(1)' } },
            }}
          />
        )}
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
        {!reduceMotion && (
          <Stack
            className="notranslate"
            translate="no"
            direction="row"
            spacing={1}
            alignItems="center"
            justifyContent="flex-end"
            sx={{ display: { xs: 'none', md: 'flex' }, mt: 1.5 }}
            aria-label="Select homepage training video"
          >
            <Typography variant="caption" sx={{ mr: .5, color: 'text.secondary', fontWeight: 800 }}>
              Training view {activeVideo + 1} of {trainingVideos.length}
            </Typography>
            {trainingVideos.map((video, index) => (
              <Tooltip key={video.src} title={video.label}>
                <IconButton
                  aria-label={`Play ${video.label}`}
                  aria-pressed={activeVideo === index}
                  onClick={() => setActiveVideo(index)}
                  size="small"
                  sx={{
                    width: activeVideo === index ? 40 : 32, height: 32,
                    color: activeVideo === index ? 'white' : ROYAL,
                    bgcolor: activeVideo === index ? 'secondary.main' : 'rgba(8,8,95,.08)',
                    transition: 'all .25s ease',
                    '&:hover': { bgcolor: activeVideo === index ? 'secondary.dark' : 'rgba(8,8,95,.14)' },
                  }}
                >
                  <PlayArrowRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            ))}
          </Stack>
        )}
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
