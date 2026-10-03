import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, Button, Link, Skeleton, Stack, Typography } from '@mui/material'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import { ADMISSIONS_PHONE, ADMISSIONS_PHONE_HREF, FINANCING_PARTNER, LIBERTY, libertyFrameDocument, parseLibertyMessage, type LibertyStatus } from '../../config/financing'

// After the frame finishes loading, Liberty's button should already be there.
const READY_GRACE_MS = 2000
// Upper bound for slow networks before falling back to the direct link.
const LOAD_TIMEOUT_MS = 12000
const FRAME_HEIGHT = 64

/**
 * Liberty's own "Apply for Liberty Financing" button, rendered by Liberty's
 * script exactly as provided inside a sandboxed frame. The frame cannot read
 * the IMAN page (no allow-same-origin), so the script never sees the student's
 * session; it may only open Liberty's application in a new window.
 */
export function LibertyFinancingButton({ onApply }: { onApply?: () => void } = {}) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [status, setStatus] = useState<'loading' | LibertyStatus>('loading')
  const srcDoc = useMemo(() => libertyFrameDocument(), [])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return
      const next = parseLibertyMessage(event.data)
      if (next === 'clicked') return onApply?.()
      if (next) setStatus(current => (current === 'loading' ? next : current))
    }
    window.addEventListener('message', onMessage)
    const timeout = window.setTimeout(() => setStatus(current => (current === 'loading' ? 'failed' : current)), LOAD_TIMEOUT_MS)
    return () => {
      window.removeEventListener('message', onMessage)
      window.clearTimeout(timeout)
    }
  }, [onApply])

  const onFrameLoad = () => {
    window.setTimeout(() => setStatus(current => (current === 'loading' ? 'failed' : current)), READY_GRACE_MS)
  }

  if (status === 'failed') {
    return (
      <Stack spacing={1} alignItems="flex-start">
        <Button
          component="a"
          href={LIBERTY.l}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onApply}
          variant="contained"
          color="secondary"
          endIcon={<OpenInNewRoundedIcon />}
        >
          Open Liberty's financing application
        </Button>
        <Typography variant="body2" color="text.secondary">
          Or call admissions at <Link href={ADMISSIONS_PHONE_HREF} fontWeight={700}>{ADMISSIONS_PHONE}</Link> for help.
        </Typography>
      </Stack>
    )
  }

  return (
    <Box sx={{ position: 'relative', width: '100%', maxWidth: 340, height: FRAME_HEIGHT }}>
      {status === 'loading' && (
        <Skeleton variant="rounded" width={300} height={50} sx={{ position: 'absolute', top: 4, left: 0, maxWidth: '100%' }} aria-label="Loading financing application button" />
      )}
      <Box
        component="iframe"
        ref={frame}
        title={`Apply for financing with ${FINANCING_PARTNER} (opens a new window)`}
        srcDoc={srcDoc}
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
        onLoad={onFrameLoad}
        sx={{
          display: 'block',
          width: '100%',
          height: FRAME_HEIGHT,
          border: 0,
          background: 'transparent',
          colorScheme: 'normal',
          visibility: status === 'ready' ? 'visible' : 'hidden',
        }}
      />
    </Box>
  )
}
