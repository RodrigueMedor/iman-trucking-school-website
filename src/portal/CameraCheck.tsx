import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material'
import CameraAltRounded from '@mui/icons-material/CameraAltRounded'
import CameraswitchRounded from '@mui/icons-material/CameraswitchRounded'
import VideocamOffRounded from '@mui/icons-material/VideocamOffRounded'
import { cameraErrorMessage, cameraSupported, type CameraFacing } from './cameraErrors'
import { NAVY } from './ui'

/**
 * Live camera preview so students can confirm their camera works before
 * Stripe's secure capture. The video is shown only on this device; no frame
 * is captured, stored or sent anywhere.
 */
export function CameraCheck({ onReady }: { onReady?: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const [facing, setFacing] = useState<CameraFacing>('environment')
  const [state, setState] = useState<'idle' | 'starting' | 'live' | 'error'>('idle')
  const [error, setError] = useState('')
  const [worked, setWorked] = useState(false)

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach(track => track.stop())
    stream.current = null
    if (video.current) video.current.srcObject = null
  }, [])
  useEffect(() => stop, [stop])

  const start = async (mode: CameraFacing) => {
    stop()
    setFacing(mode); setState('starting'); setError('')
    if (!cameraSupported()) {
      setState('error')
      return setError('This browser cannot use the camera. Open this page in Chrome, Safari or Edge, or continue on your phone.')
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      stream.current = media
      if (video.current) {
        video.current.srcObject = media
        // Muted inline video autoplays; play() is a nudge for older browsers
        // and is not awaited because it can stay pending until frames arrive.
        void video.current.play().catch(() => undefined)
      }
      setState('live')
      if (!worked) { setWorked(true); onReady?.() }
    } catch (err) {
      setState('error')
      setError(cameraErrorMessage(err))
    }
  }

  const live = state === 'live'
  const selfie = facing === 'user'

  return <Box>
    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} mb={1.5}>
      <Typography fontWeight={900} color={NAVY}>Check your camera (preview only)</Typography>
      {worked && <Chip size="small" color="success" label="Camera works — continue below" />}
    </Stack>
    <Typography variant="body2" color="text.secondary" mb={2}>
      This only checks that your camera works. It does not scan your card — nothing is recorded or sent. When you click Start verification, Stripe's secure page scans your card and takes your selfie automatically.
    </Typography>

    <Box sx={{ position: 'relative', width: '100%', maxWidth: 560, aspectRatio: '16 / 10', borderRadius: 3, overflow: 'hidden', bgcolor: '#0b1033', display: live || state === 'starting' ? 'block' : 'none', mb: 2 }}>
      <Box component="video" ref={video} muted playsInline autoPlay aria-label={selfie ? 'Front camera preview' : 'Back camera preview'}
        sx={{ width: '100%', height: '100%', objectFit: 'cover', transform: selfie ? 'scaleX(-1)' : 'none' }} />
      {/* Framing guide: an ID card outline, or an oval for the selfie. */}
      <Box aria-hidden sx={{
        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', border: '3px solid rgba(255,255,255,.9)',
        boxShadow: '0 0 0 9999px rgba(0,0,0,.35)',
        ...(selfie ? { width: '38%', height: '78%', borderRadius: '50%' } : { width: '78%', aspectRatio: '1.586', borderRadius: 2 }),
      }} />
      <Typography sx={{ position: 'absolute', left: 0, right: 0, bottom: 10, textAlign: 'center', color: 'white', fontWeight: 800, textShadow: '0 1px 3px rgba(0,0,0,.8)', fontSize: { xs: 13, sm: 15 } }}>
        {state === 'starting' ? 'Starting camera…' : selfie ? 'Preview only — Stripe takes your selfie in the next step' : 'Preview only — Stripe scans your card in the next step'}
      </Typography>
    </Box>

    {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
      {!live
        ? <Button variant="outlined" startIcon={<CameraAltRounded />} onClick={() => void start('environment')} disabled={state === 'starting'} sx={{ minHeight: 44 }}>
          {state === 'error' ? 'Try the camera again' : 'Test my camera'}
        </Button>
        : <>
          <Button variant="outlined" startIcon={<CameraswitchRounded />} onClick={() => void start(selfie ? 'environment' : 'user')} sx={{ minHeight: 44 }}>
            {selfie ? 'Switch to back camera (document)' : 'Switch to front camera (selfie)'}
          </Button>
          <Button startIcon={<VideocamOffRounded />} onClick={() => { stop(); setState('idle') }} sx={{ minHeight: 44 }}>Turn camera off</Button>
        </>}
    </Stack>
  </Box>
}
