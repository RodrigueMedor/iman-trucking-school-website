import { Box, Button, Container, Divider, Grid, Stack, Typography } from '@mui/material'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import { Link as RouterLink } from 'react-router-dom'
import { programLinks, resourceLinks } from '../navigation'

const logo = '/images/iman-logo.png'

export function Footer() {
  return <Box component="footer" sx={{ bgcolor: '#061426', color: 'white', pt: 8 }}>
    <Container><Grid container spacing={5}>
      <Grid size={{ xs: 12, md: 5 }}><Box component="img" src={logo} alt="Iman Trucking School" sx={{ width: 150, height: 110, objectFit: 'contain', filter: 'drop-shadow(0 5px 20px rgba(255,255,255,.12))' }} /><Typography color="rgba(255,255,255,.68)" maxWidth={430}>Hands-on Class A CDL training designed to help students build the knowledge, skill, and confidence to begin a professional driving career.</Typography><Button component={RouterLink} to="/contact-form/" variant="contained" color="secondary" endIcon={<ArrowForwardRoundedIcon />} sx={{ mt: 3 }}>Start your application</Button></Grid>
      <Grid size={{ xs: 6, md: 3 }}><Typography fontWeight={900} mb={2}>Programs</Typography><Stack spacing={1.2}>{programLinks.slice(0, 4).map(([label, path]) => <Typography key={path} component={RouterLink} to={path} color="rgba(255,255,255,.68)" sx={{ textDecoration: 'none', '&:hover': { color: 'white' } }}>{label}</Typography>)}</Stack></Grid>
      <Grid size={{ xs: 6, md: 2 }}><Typography fontWeight={900} mb={2}>Resources</Typography><Stack spacing={1.2}>{resourceLinks.slice(0, 4).map(([label, path]) => <Typography key={path} component={RouterLink} to={path} color="rgba(255,255,255,.68)" sx={{ textDecoration: 'none', '&:hover': { color: 'white' } }}>{label}</Typography>)}</Stack></Grid>
      <Grid size={{ xs: 12, md: 2 }}><Typography fontWeight={900} mb={2}>Contact</Typography><Typography color="rgba(255,255,255,.68)">5104 N Orange Blossom Trail, Suite 205<br />Orlando, FL 32810</Typography><Typography component="a" href="tel:8889914776" color="white" fontWeight={900} display="block" mt={2}>(888) 991-4776</Typography></Grid>
    </Grid><Divider sx={{ borderColor: 'rgba(255,255,255,.12)', mt: 6 }} /><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5} py={3}><Typography variant="body2" color="rgba(255,255,255,.55)">© 2026 Iman Trucking School. All rights reserved.</Typography><Stack direction="row" spacing={2}><Typography component={RouterLink} to="/privacy-policy/" color="rgba(255,255,255,.55)" variant="body2">Privacy</Typography><Typography component={RouterLink} to="/terms-of-use-page/" color="rgba(255,255,255,.55)" variant="body2">Terms</Typography></Stack></Stack></Container>
  </Box>
}
