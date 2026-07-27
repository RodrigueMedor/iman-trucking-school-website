import { useEffect, useState } from 'react'
import { Box, Button, Container, IconButton, Stack, Tooltip, Typography, useMediaQuery } from '@mui/material'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import { Link as RouterLink } from 'react-router-dom'
import { useContent } from '../contexts/ContentContext'

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

export function HomeHero() {
  const { content } = useContent()
  const hero = content('home', 'hero', {
    section_label: 'Orlando’s career-focused CDL school',
    title: 'Your road to a professional driving career.',
    body: 'Build real-world driving skills with experienced instructors, hands-on Class A CDL training, and support from enrollment through graduation.',
    button_text: 'Start your application',
    button_url: '/contact-form/',
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
        position: 'relative',
        minHeight: { xs: 620, md: 700 },
        display: 'grid',
        alignItems: 'center',
        overflow: 'hidden',
        color: 'white',
        bgcolor: '#041226',
        backgroundImage: 'url(/images/home-hero.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: { xs: '62% center', md: 'center 45%' },
      }}
    >
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
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
            animation: 'imanVideoReveal .9s ease both',
            '@keyframes imanVideoReveal': {
              from: { opacity: 0, transform: 'scale(1.025)' },
              to: { opacity: 1, transform: 'scale(1)' },
            },
          }}
        />
      )}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: {
            xs: 'linear-gradient(90deg, rgba(4,18,38,.94) 0%, rgba(4,18,38,.79) 72%, rgba(4,18,38,.48) 100%)',
            md: 'linear-gradient(90deg, rgba(4,18,38,.96) 0%, rgba(4,18,38,.8) 43%, rgba(4,18,38,.2) 78%), linear-gradient(180deg, transparent 62%, rgba(4,18,38,.78))',
          },
        }}
      />
      <Container sx={{ position: 'relative', py: { xs: 9, md: 12 } }}>
        <Box maxWidth={700}>
          <Typography component="p" sx={{ display: 'inline-flex', px: 1.5, py: .75, mb: 2.5, border: '1px solid rgba(255,255,255,.28)', borderRadius: 20, bgcolor: 'rgba(255,255,255,.08)', backdropFilter: 'blur(8px)', fontSize: '.78rem', fontWeight: 900, letterSpacing: '.11em', textTransform: 'uppercase' }}>
            {hero.section_label}
          </Typography>
          <Typography component="h1" variant="h1" sx={{ color: 'white', fontSize: { xs: '3rem', sm: '4rem', md: '5.2rem' }, lineHeight: .98, maxWidth: 680 }}>
            {hero.title}
          </Typography>
          <Typography sx={{ mt: 3, mb: 3.5, maxWidth: 610, color: 'rgba(255,255,255,.82)', fontSize: { xs: '1.05rem', md: '1.2rem' }, lineHeight: 1.7 }}>
            {hero.body}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button component={RouterLink} to={hero.button_url || '/contact-form/'} variant="contained" color="secondary" size="large" endIcon={<ArrowForwardRoundedIcon />} sx={{ minHeight: 54, px: 3, boxShadow: '0 15px 35px rgba(214,31,44,.3)' }}>
              {hero.button_text}
            </Button>
            <Button component={RouterLink} to="/our-program/" variant="outlined" size="large" sx={{ minHeight: 54, px: 3, color: 'white', borderColor: 'rgba(255,255,255,.5)', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,.08)' } }}>
              Explore the program
            </Button>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1, sm: 3 }} mt={4}>
            {['Hands-on training', 'Flexible schedules', 'Financing available'].map(item => (
              <Stack key={item} direction="row" spacing={.8} alignItems="center">
                <CheckCircleRoundedIcon sx={{ color: '#ff5964', fontSize: 20 }} />
                <Typography fontWeight={800} fontSize=".88rem">{item}</Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
        <Stack
          className="notranslate"
          translate="no"
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ position: 'absolute', right: { xs: 24, md: 40 }, bottom: { xs: 24, md: 34 } }}
          aria-label="Select homepage training video"
        >
          <Typography
            variant="caption"
            sx={{ display: { xs: 'none', sm: 'block' }, mr: .5, color: 'rgba(255,255,255,.72)', fontWeight: 800 }}
          >
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
                  width: activeVideo === index ? 42 : 34,
                  height: 34,
                  color: 'white',
                  bgcolor: activeVideo === index ? 'secondary.main' : 'rgba(255,255,255,.16)',
                  border: '1px solid rgba(255,255,255,.38)',
                  backdropFilter: 'blur(10px)',
                  transition: 'all .25s ease',
                  '&:hover': { bgcolor: activeVideo === index ? 'secondary.dark' : 'rgba(255,255,255,.27)' },
                }}
              >
                <PlayArrowRoundedIcon sx={{ fontSize: 19 }} />
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
