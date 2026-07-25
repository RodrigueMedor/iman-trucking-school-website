import { useEffect, useState } from 'react'
import {
  Box,
  Dialog,
  DialogContent,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'

const formUrl = 'https://api.leadconnectorhq.com/widget/form/RmDjUNgSA8rKuhQFsrUU'

export function EnrollmentModal() {
  const [open, setOpen] = useState(false)
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.data?.type === 'iman-open-enrollment') setOpen(true)
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [])

  return <Dialog
    open={open}
    onClose={() => setOpen(false)}
    fullScreen={fullScreen}
    fullWidth
    maxWidth="md"
    aria-labelledby="enrollment-modal-title"
    PaperProps={{ sx: { overflow: 'hidden', borderRadius: { xs: 0, sm: 3 }, boxShadow: '0 30px 100px rgba(7,26,51,.35)' } }}
  >
    <Stack direction="row" alignItems="flex-start" spacing={2} px={{ xs: 2, sm: 3 }} py={2.25} bgcolor="primary.main" color="white">
      <Box flex={1}>
        <Stack direction="row" spacing={.8} alignItems="center" mb={.5}>
          <CheckCircleRoundedIcon sx={{ color: '#ff626c', fontSize: 18 }} />
          <Typography variant="overline" fontWeight={900} letterSpacing=".1em">Request enrollment information</Typography>
        </Stack>
        <Typography id="enrollment-modal-title" variant="h5" fontWeight={900}>Start Your CDL Journey</Typography>
        <Typography variant="body2" color="rgba(255,255,255,.7)" mt={.5}>Complete the secure form and our admissions team will contact you.</Typography>
      </Box>
      <IconButton aria-label="Close enrollment form" onClick={() => setOpen(false)} sx={{ color: 'white', bgcolor: 'rgba(255,255,255,.08)', '&:hover': { bgcolor: 'rgba(255,255,255,.15)' } }}>
        <CloseRoundedIcon />
      </IconButton>
    </Stack>
    <DialogContent sx={{ p: 0, bgcolor: '#f4f6f9', overflowY: 'auto' }}>
      <Box
        component="iframe"
        src={formUrl}
        title="Iman Trucking School enrollment form"
        sx={{ display: 'block', width: '100%', minHeight: 1306, border: 0, bgcolor: 'white' }}
      />
    </DialogContent>
  </Dialog>
}
