import { useEffect, useState } from 'react'
import {
  Alert, Box, Button, Card, CardContent, Checkbox, FormControlLabel, Grid, LinearProgress, Paper, Radio, RadioGroup, Stack, Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import {
  emptyResponses, oralQuestions, oralResponseChoices, readingPassage, readingQuestions, trafficSigns, writtenChoices,
  type ElpResponses,
} from '../../shared/elpScoring.mjs'
import { toMessage } from './api'

const STEPS = ['Instructions', 'A — Oral interview', 'B — Traffic signs', 'C — Reading', 'D — Written records', 'Attestation & submit']
const SIGN_DISTRACTORS = ['Continue without changing speed', 'Stop in the travel lane and abandon the vehicle', 'The sign applies only to passenger cars']
const LOG_FIELDS = {
  driverName: 'Driver name', date: 'Date', startLocation: 'Start location', destination: 'Destination', startTime: 'Start time', onDutyTime: 'Total on-duty time',
} as const

function ChoiceQuestion({ value, choices, onChange, name }: { value: string; choices: string[]; onChange: (value: string) => void; name: string }) {
  return (
    <RadioGroup name={name} value={value} onChange={e => onChange(e.target.value)}>
      {choices.map(choice => (
        <FormControlLabel key={choice} value={choice} control={<Radio />} label={choice} sx={{ alignItems: 'flex-start', mb: 0.5, '& .MuiRadio-root': { mt: -0.75 } }} />
      ))}
    </RadioGroup>
  )
}

type Draft = { responses: ElpResponses; consent: boolean; step: number }

function readDraft(key: string): Draft | null {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as Draft) : null
  } catch {
    return null
  }
}

/**
 * The online English Language Proficiency test. Answers are kept in a draft
 * scoped to `draftKey` (one per student and application) until submitted; the
 * server scores them.
 */
export function ElpTestForm({ draftKey, onSubmit }: { draftKey: string; onSubmit: (responses: ElpResponses, startedAt?: string) => Promise<void> }) {
  const startKey = `${draftKey}:start`
  const saved = readDraft(draftKey)
  const [step, setStep] = useState(saved?.step ?? 0)
  const [responses, setResponses] = useState<ElpResponses>(saved?.responses ?? emptyResponses)
  const [consent, setConsent] = useState(saved?.consent ?? false)
  const [attested, setAttested] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    try {
      window.localStorage.setItem(draftKey, JSON.stringify({ responses, consent, step }))
    } catch {
      // Storage full or blocked: the test still works, it just won't survive a reload.
    }
  }, [draftKey, responses, consent, step])

  const setAnswer = (key: 'oral' | 'signs' | 'reading', i: number, value: string) =>
    setResponses(r => ({ ...r, [key]: r[key].map((x, n) => (n === i ? value : x)) }))

  const complete = step === 0 ? consent
    : step === 1 ? responses.oral.every(Boolean)
    : step === 2 ? responses.signs.every(Boolean)
    : step === 3 ? responses.reading.every(Boolean)
    : step === 4 ? Object.values(responses.log).every(Boolean) && !!responses.defects && !!responses.licenseExpiry
    : attested

  const move = (delta: number) => {
    setError('')
    setStep(s => s + delta)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const next = () => {
    if (!complete) return setError('Answer every question before continuing.')
    if (step === 0 && !window.localStorage.getItem(startKey)) window.localStorage.setItem(startKey, new Date().toISOString())
    move(1)
  }

  const submit = async () => {
    if (!attested) return
    setBusy(true)
    setError('')
    try {
      await onSubmit(responses, window.localStorage.getItem(startKey) ?? undefined)
      window.localStorage.removeItem(draftKey)
      window.localStorage.removeItem(startKey)
    } catch (err) {
      setError(toMessage(err))
      setBusy(false)
    }
  }

  const section = (title: string, intro: string | null, body: React.ReactNode) => (
    <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
      <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
        <Typography component="h2" variant="h5" fontWeight={900}>{title}</Typography>
        {intro && <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>{intro}</Typography>}
        {body}
      </CardContent>
    </Card>
  )

  return (
    <Box>
      <Typography color="text.secondary">
        School-administered screening under 49 CFR §391.11(b)(2). This is not a CDL test or certification.
      </Typography>
      <LinearProgress variant="determinate" value={((step + 1) / STEPS.length) * 100} color="secondary" sx={{ my: 3, height: 8, borderRadius: 4 }} />
      <Typography fontWeight={800} sx={{ mb: 2 }}>Step {step + 1} of {STEPS.length}: {STEPS[step]}</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }} role="alert">{error}</Alert>}

      {step === 0 && section('Before you begin', null, (
        <>
          <Alert severity="info" sx={{ my: 2 }}>
            Allow 35–45 minutes. Your answers are saved on this device as you go. Questions may not be translated, simplified or answered with coaching.
          </Alert>
          <Typography sx={{ mb: 2 }}>
            Complete every scored section independently in English. Accent alone is not a reason to fail. This school screening does not guarantee a state CDL or roadside English-proficiency determination.
          </Typography>
          <FormControlLabel control={<Checkbox checked={consent} onChange={e => setConsent(e.target.checked)} />} label="I understand the rules and am ready to begin." />
        </>
      ))}

      {step === 1 && section('Part A — Oral Interview (30 points; minimum 21)',
        'Answer each prompt aloud in English, then select the option that matches your answer. Question 10 must communicate all four actions.',
        oralQuestions.map((q, i) => (
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }} key={q}>
            <Typography fontWeight={900}>{i + 1}. {q}</Typography>
            <ChoiceQuestion name={`oral-${i}`} value={responses.oral[i]} choices={oralResponseChoices} onChange={v => setAnswer('oral', i, v)} />
          </Paper>
        )))}

      {step === 2 && section('Part B — Traffic Signs (30 points; minimum 24)',
        'Select the correct meaning and safe driver action. Critical signs are marked.',
        <Grid container spacing={2}>
          {trafficSigns.map((s, i) => (
            <Grid size={{ xs: 12, md: 6 }} key={s.name}>
              <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} alignItems={{ xs: 'center', sm: 'flex-start' }}>
                  <Box component="img" src={s.image} alt={s.name} sx={{ width: 120, height: 100, objectFit: 'contain', flexShrink: 0 }} />
                  <Box flex={1}>
                    <Typography fontWeight={900}>{i + 1}. {s.name}{s.critical ? ' — CRITICAL' : ''}</Typography>
                    <ChoiceQuestion name={`sign-${i}`} value={responses.signs[i]} choices={[s.expected, ...SIGN_DISTRACTORS]} onChange={v => setAnswer('signs', i, v)} />
                  </Box>
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>)}

      {step === 3 && section('Part C — Reading (20 points; minimum 14)', null, (
        <>
          <Paper variant="outlined" sx={{ p: 3, my: 3, bgcolor: '#fffbea' }}><Typography fontWeight={800}>{readingPassage}</Typography></Paper>
          {readingQuestions.map((q, i) => (
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }} key={q.prompt}>
              <Typography fontWeight={900}>{i + 1}. {q.prompt} ({q.max} points)</Typography>
              <ChoiceQuestion name={`reading-${i}`} value={responses.reading[i]} choices={q.choices} onChange={v => setAnswer('reading', i, v)} />
            </Paper>
          ))}
        </>
      ))}

      {step === 4 && section('Part D — Records and Reports (20 points; minimum 14)', null, (
        <>
          <Typography fontWeight={800} sx={{ mt: 3, mb: 2 }}>D1. Select the correct information for each driver log field (8 points)</Typography>
          <Grid container spacing={2}>
            {Object.entries(LOG_FIELDS).map(([key, label]) => (
              <Grid size={{ xs: 12, md: 6 }} key={key}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography fontWeight={900}>{label}</Typography>
                  <ChoiceQuestion name={`log-${key}`} value={responses.log[key]} choices={writtenChoices[key as keyof typeof LOG_FIELDS]}
                    onChange={v => setResponses(r => ({ ...r, log: { ...r.log, [key]: v } }))} />
                </Paper>
              </Grid>
            ))}
          </Grid>
          <Typography fontWeight={800} sx={{ mt: 4 }}>D2. Vehicle defect report (8 points)</Typography>
          <Typography color="text.secondary">The right rear brake light does not work, and the trailer’s left rear tire has a deep cut. Select the complete, safe report.</Typography>
          <ChoiceQuestion name="defects" value={responses.defects} choices={writtenChoices.defects} onChange={v => setResponses(r => ({ ...r, defects: v }))} />
          <Typography fontWeight={800} sx={{ mt: 4 }}>D3. Document information (4 points)</Typography>
          <Typography color="text.secondary">Sample license D123-456-81-001-0 expires 11/07/2030. Select its expiration date.</Typography>
          <ChoiceQuestion name="license-expiry" value={responses.licenseExpiry} choices={writtenChoices.licenseExpiry} onChange={v => setResponses(r => ({ ...r, licenseExpiry: v }))} />
        </>
      ))}

      {step === 5 && section('Applicant attestation', null, (
        <>
          <Typography sx={{ my: 2 }}>
            I completed this assessment independently; my responses are accurate; a passing school result does not guarantee a state CDL or roadside ELP determination; and I may be assigned remediation and a retest.
          </Typography>
          <FormControlLabel control={<Checkbox checked={attested} onChange={e => setAttested(e.target.checked)} />} label="I agree and sign electronically." />
          <Alert severity="info" sx={{ mt: 3 }}>
            Your answers are scored as soon as you submit. PASS requires at least 80/100, every section minimum, and all four critical signs. An authorized evaluator may review the result.
          </Alert>
        </>
      ))}

      <Stack direction="row" justifyContent="space-between" sx={{ mt: 3 }}>
        <Button disabled={!step || busy} startIcon={<ArrowBackIcon />} onClick={() => move(-1)}>Previous</Button>
        {step < STEPS.length - 1
          ? <Button variant="contained" endIcon={<ArrowForwardIcon />} onClick={next}>Continue</Button>
          : <Button variant="contained" color="secondary" disabled={!attested || busy} onClick={() => void submit()}>{busy ? 'Scoring…' : 'Submit and view score'}</Button>}
      </Stack>
    </Box>
  )
}
