import { FormEvent, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Collapse,
  Fab,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined'
import HeadsetMicRoundedIcon from '@mui/icons-material/HeadsetMicRounded'
import SendRoundedIcon from '@mui/icons-material/SendRounded'

type Role = 'user' | 'assistant'
type Message = { role: Role; content: string }

const welcome: Message = {
  role: 'assistant',
  content: "Hi! I’m Iman’s virtual admissions assistant. I can help with the Class A CDL program, schedules, enrollment, financing, and your next step. What would you like to know?",
}

const prompts = ['How long is the program?', 'What schedules are available?', 'How do I enroll?']

function newSessionId() {
  const stored = sessionStorage.getItem('iman-chat-session')
  if (stored) return stored
  const id = crypto.randomUUID()
  sessionStorage.setItem('iman-chat-session', id)
  return id
}

export function AdmissionsChat() {
  const [open, setOpen] = useState(false)
  const [greetingVisible, setGreetingVisible] = useState(true)
  const [messages, setMessages] = useState<Message[]>([welcome])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [handoff, setHandoff] = useState(false)
  const [handoffSent, setHandoffSent] = useState(false)
  const sessionId = useMemo(newSessionId, [])
  const listRef = useRef<HTMLDivElement>(null)

  const scrollToLatest = () => requestAnimationFrame(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  })

  async function sendMessage(text: string) {
    const clean = text.trim()
    if (!clean || busy) return
    const next = [...messages, { role: 'user' as const, content: clean }]
    setMessages(next)
    setInput('')
    setBusy(true)
    setError('')
    scrollToLatest()

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'chat', sessionId, messages: next.slice(-12) }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'The assistant is temporarily unavailable.')
      setMessages(current => [...current, { role: 'assistant', content: data.reply }])
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The assistant is temporarily unavailable.')
    } finally {
      setBusy(false)
      scrollToLatest()
    }
  }

  async function submitHandoff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'handoff',
          sessionId,
          contact: {
            name: form.get('name'),
            phone: form.get('phone'),
            email: form.get('email'),
            question: form.get('question'),
          },
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'We could not send your request.')
      setHandoffSent(true)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'We could not send your request.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box className="notranslate" translate="no" sx={{ position: 'fixed', right: { xs: 14, sm: 20 }, bottom: { xs: 14, sm: 20 }, zIndex: 1400 }}>
      <Collapse in={open} unmountOnExit>
        <Paper
          role="dialog"
          aria-label="Iman virtual admissions assistant"
          elevation={24}
          sx={{
            mb: 1.5,
            width: { xs: 'calc(100vw - 32px)', sm: 390 },
            height: { xs: 'min(650px, calc(100vh - 100px))', sm: 620 },
            maxHeight: 'calc(100vh - 100px)',
            borderRadius: 2.5,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid rgba(15,23,42,.1)',
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1.4} sx={{ bgcolor: '#2196f3', color: 'white', px: 2, py: 1.6 }}>
            <Box component="img" src="https://widgets.leadconnectorhq.com/chat-widget/assets/defaultAvatar.png" alt="" sx={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', bgcolor: 'white' }} />
            <Box sx={{ flex: 1 }}>
              <Typography fontWeight={800}>Iman Trucking School</Typography>
              <Typography variant="caption" color="rgba(255,255,255,.85)">Typically replies instantly</Typography>
            </Box>
            <IconButton aria-label="Close chat" onClick={() => setOpen(false)} sx={{ color: 'white' }}><CloseRoundedIcon /></IconButton>
          </Stack>

          {!handoff && (
            <>
              <Box ref={listRef} aria-live="polite" sx={{ flex: 1, overflowY: 'auto', p: 2, bgcolor: '#f6f7fb' }}>
                <Stack spacing={1.4}>
                  {messages.map((message, index) => (
                    <Box
                      key={`${message.role}-${index}`}
                      sx={{
                        alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '86%',
                        bgcolor: message.role === 'user' ? '#2196f3' : 'white',
                        color: message.role === 'user' ? 'white' : 'text.primary',
                        px: 1.6,
                        py: 1.2,
                        borderRadius: message.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        boxShadow: message.role === 'assistant' ? '0 4px 16px rgba(8,8,95,.08)' : 'none',
                      }}
                    >
                      <Typography variant="body2" lineHeight={1.55} sx={{ whiteSpace: 'pre-wrap' }}>{message.content}</Typography>
                    </Box>
                  ))}
                  {messages.length === 1 && (
                    <Stack direction="row" flexWrap="wrap" gap={0.8}>
                      {prompts.map(prompt => <Button key={prompt} size="small" variant="outlined" onClick={() => sendMessage(prompt)} sx={{ color: '#1976d2', borderColor: 'rgba(25,118,210,.45)' }}>{prompt}</Button>)}
                    </Stack>
                  )}
                  {busy && <CircularProgress size={20} sx={{ ml: 1 }} />}
                  {error && <Alert severity="warning">{error} You can call <a href="tel:8889914776">(888) 991-4776</a>.</Alert>}
                </Stack>
              </Box>
              <Box component="form" onSubmit={(event) => { event.preventDefault(); void sendMessage(input) }} sx={{ p: 1.4, borderTop: '1px solid rgba(8,8,95,.1)' }}>
                <Stack direction="row" spacing={1}>
                  <TextField
                    value={input}
                    onChange={event => setInput(event.target.value)}
                    placeholder="Ask about CDL training…"
                    size="small"
                    fullWidth
                    inputProps={{ maxLength: 800, 'aria-label': 'Chat message' }}
                  />
                  <IconButton type="submit" disabled={!input.trim() || busy} aria-label="Send message" sx={{ color: '#2196f3' }}><SendRoundedIcon /></IconButton>
                </Stack>
                <Button size="small" startIcon={<HeadsetMicRoundedIcon />} onClick={() => setHandoff(true)} sx={{ mt: 0.8 }}>
                  Connect with admissions
                </Button>
              </Box>
            </>
          )}

          {handoff && (
            <Box sx={{ p: 2.5, overflowY: 'auto' }}>
              <Button size="small" onClick={() => setHandoff(false)} sx={{ mb: 1 }}>← Back to chat</Button>
              <Typography variant="h6" fontWeight={900}>Talk with a real person</Typography>
              <Typography variant="body2" color="text.secondary" mt={0.5} mb={2}>Send your details securely to the Iman admissions team through GoHighLevel.</Typography>
              {handoffSent ? (
                <Alert severity="success">Thank you! Admissions received your request and will follow up. For immediate help, call <a href="tel:8889914776">(888) 991-4776</a>.</Alert>
              ) : (
                <Stack component="form" onSubmit={submitHandoff} spacing={1.5}>
                  <TextField name="name" label="Full name" required size="small" inputProps={{ maxLength: 100 }} />
                  <TextField name="phone" label="Phone number" required size="small" inputProps={{ maxLength: 30 }} />
                  <TextField name="email" label="Email (optional)" type="email" size="small" inputProps={{ maxLength: 150 }} />
                  <TextField name="question" label="How can we help?" multiline rows={3} inputProps={{ maxLength: 800 }} />
                  {error && <Alert severity="warning">{error}</Alert>}
                  <Typography variant="caption" color="text.secondary">By submitting, you agree that Iman Trucking School may contact you about your request.</Typography>
                  <Button type="submit" variant="contained" disabled={busy} sx={{ bgcolor: '#2196f3', '&:hover': { bgcolor: '#1976d2' } }}>{busy ? 'Sending…' : 'Request a callback'}</Button>
                </Stack>
              )}
            </Box>
          )}
        </Paper>
      </Collapse>

      {!open && greetingVisible && (
        <Paper
          elevation={8}
          sx={{
            position: 'absolute',
            right: 0,
            bottom: 78,
            width: { xs: 'min(302px, calc(100vw - 28px))', sm: 302 },
            minHeight: 73,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            p: '12px 42px 12px 12px',
            border: '1px solid rgba(15,23,42,.08)',
            borderRadius: '10px',
            color: '#344054',
            '&::after': {
              content: '""',
              position: 'absolute',
              right: 20,
              bottom: -8,
              width: 16,
              height: 16,
              bgcolor: 'white',
              transform: 'rotate(45deg)',
              boxShadow: '3px 3px 5px rgba(15,23,42,.06)',
            },
          }}
        >
          <Box component="img" src="https://widgets.leadconnectorhq.com/chat-widget/assets/defaultAvatar.png" alt="" sx={{ flex: '0 0 auto', width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
          <Button
            aria-label="Open chat: Hi there! Have a question? Chat with us."
            onClick={() => { setOpen(true); setGreetingVisible(false) }}
            sx={{ p: 0, minWidth: 0, color: 'inherit', textAlign: 'left', textTransform: 'none', fontSize: 17, fontWeight: 400, lineHeight: 1.38, justifyContent: 'flex-start', zIndex: 1 }}
          >
            Hi there! Have a question?<br />Chat with us.
          </Button>
          <IconButton aria-label="Close chat greeting" onClick={() => setGreetingVisible(false)} size="small" sx={{ position: 'absolute', top: 11, right: 10, width: 24, height: 24, zIndex: 2, color: '#111827' }}>
            <CloseRoundedIcon sx={{ fontSize: 22, fontWeight: 300 }} />
          </IconButton>
        </Paper>
      )}

      <Fab
        aria-label={open ? 'Close admissions chat' : 'Chat with Iman admissions'}
        onClick={() => { setOpen(value => !value); setGreetingVisible(false) }}
        sx={{ float: 'right', width: 58, height: 58, minHeight: 58, color: 'white', bgcolor: '#2196f3', boxShadow: 'none', '&:hover': { bgcolor: '#1687e8' } }}
      >
        {open ? <CloseRoundedIcon /> : <ForumOutlinedIcon sx={{ fontSize: 31, stroke: 'white', strokeWidth: .35 }} />}
      </Fab>
    </Box>
  )
}
