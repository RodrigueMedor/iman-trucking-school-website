import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert, Box, Button, Checkbox, Chip, Divider, FormControlLabel, Grid, LinearProgress, MenuItem, Paper, Radio, RadioGroup,
  Stack, Step, StepButton, Stepper, TextField, Typography,
} from '@mui/material'
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded'
import SaveRounded from '@mui/icons-material/SaveRounded'
import QuizRounded from '@mui/icons-material/QuizRounded'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  getApplication, getElpResult, getOrCreateDraft, getMyStudent, listCourses, listDocuments, listOpenSessions, notifyAdmissions,
  profileToFormData, saveDraft, submitApplication, toMessage, updateMyStudent,
  type AcademicSession, type Application, type ApplicationDocument, type ApplicationPatch, type Course, type ElpResult, type StudentProfile,
} from '../api'
import { DOC_LABEL, isEditableByStudent, STATUS_META, TYPE_LABEL, type ApplicationType } from '../model'
import {
  assessmentChoiceSchema, fieldErrors, licenseSchema, profileSchema, trainingChoiceSchema, US_STATES,
  type LicenseInput, type ProfileInput,
} from '../schemas'
import { DocumentUploader } from '../DocumentUploader'
import { PortalLoading } from '../RequireStudent'
import { cardSx, formatDate, formatDateTime, formatSessionDate, NAVY, PageHeader } from '../ui'

type StepKey = 'personal' | 'license' | 'program' | 'dates' | 'documents' | 'test' | 'review'
const STEP_LABEL: Record<StepKey, string> = {
  personal: 'Personal info',
  license: 'License',
  program: 'Program & start date',
  dates: 'Preferred dates',
  documents: 'Documents',
  test: 'English test',
  review: 'Review & submit',
}
const STEPS: Record<ApplicationType, StepKey[]> = {
  TRAINING: ['personal', 'license', 'program', 'documents', 'review'],
  ASSESSMENT: ['personal', 'license', 'dates', 'documents', 'test', 'review'],
}

type Form = {
  personal: Record<keyof ProfileInput, string>
  license: Record<keyof LicenseInput, string>
  courseId: string
  sessionId: string
  preferredDates: string
  statement: string
}

const DATE_SUGGESTIONS = ['Weekday mornings', 'Weekday afternoons', 'Saturdays', 'As soon as possible']

function formFrom(app: Application, student: StudentProfile | null): Form {
  const fallback = profileToFormData(student)
  const p = { ...fallback.profile, ...Object.fromEntries(Object.entries(app.form_data.profile ?? {}).filter(([, v]) => v)) }
  const l = { ...fallback.license, ...Object.fromEntries(Object.entries(app.form_data.license ?? {}).filter(([, v]) => v)) }
  return {
    personal: {
      firstName: app.first_name || student?.first_name || '',
      lastName: app.last_name || student?.last_name || '',
      email: app.email || student?.email || '',
      phone: app.phone || student?.phone || '',
      dateOfBirth: p.dateOfBirth ?? '',
      addressLine1: p.addressLine1 ?? '',
      addressLine2: p.addressLine2 ?? '',
      city: p.city ?? '',
      state: p.state ?? '',
      zipCode: p.zipCode ?? '',
    },
    license: { licenseType: l.licenseType ?? '', licenseNumber: l.licenseNumber ?? '', licenseState: l.licenseState ?? '' },
    courseId: app.course_id ?? '',
    sessionId: app.session_id ?? '',
    preferredDates: app.preferred_dates ?? '',
    statement: app.statement ?? '',
  }
}

function latestAdultBirthday() {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 18)
  return d.toISOString().slice(0, 10)
}

export function ApplicationWizard({ type }: { type: ApplicationType }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const steps = STEPS[type]
  const requestedId = params.get('id')
  const requestedStep = params.get('step') as StepKey | null
  const stepIndex = Math.max(0, requestedStep ? steps.indexOf(requestedStep) : 0)
  const step = steps[stepIndex]

  const [app, setApp] = useState<Application | null>(null)
  const [student, setStudent] = useState<StudentProfile | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [documents, setDocuments] = useState<ApplicationDocument[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [sessions, setSessions] = useState<AcademicSession[]>([])
  const [elp, setElp] = useState<ElpResult | null>(null)
  const [loadError, setLoadError] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [stepError, setStepError] = useState('')
  const [saveWarning, setSaveWarning] = useState('')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [busy, setBusy] = useState(false)
  const [saveToProfile, setSaveToProfile] = useState(true)
  const [confirmed, setConfirmed] = useState(false)
  const topRef = useRef<HTMLDivElement>(null)

  // ------------------------------------------------------------------ load
  useEffect(() => {
    let alive = true
    setLoadError('')
    ;(async () => {
      const [s, application] = await Promise.all([
        getMyStudent(),
        requestedId ? getApplication(requestedId) : getOrCreateDraft(type),
      ])
      if (!application) throw new Error('not_found')
      const [docs, courseList, sessionList, elpResult] = await Promise.all([
        listDocuments(application.id),
        type === 'TRAINING' ? listCourses() : Promise.resolve([]),
        type === 'TRAINING' ? listOpenSessions() : Promise.resolve([]),
        application.elp_submission_id ? getElpResult(application.elp_submission_id) : Promise.resolve(null),
      ])
      if (!alive) return
      setStudent(s)
      setApp(application)
      setForm(formFrom(application, s))
      setDocuments(docs)
      setCourses(courseList)
      setSessions(sessionList)
      setElp(elpResult)
    })().catch(err => alive && setLoadError(err instanceof Error && err.message === 'not_found' ? 'We couldn\'t find that application.' : toMessage(err)))
    return () => { alive = false }
  }, [type, requestedId])

  const editable = app ? isEditableByStudent(app.status) : false

  const goTo = useCallback((key: StepKey) => {
    setErrors({})
    setStepError('')
    const next = new URLSearchParams(params)
    next.set('step', key)
    setParams(next, { replace: true })
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [params, setParams])

  // ------------------------------------------------------------- validation
  const validate = useCallback((key: StepKey): Record<string, string> => {
    if (!form) return {}
    if (key === 'personal') {
      const r = profileSchema.safeParse(form.personal)
      return r.success ? {} : fieldErrors(r.error)
    }
    if (key === 'license') {
      const r = licenseSchema.safeParse(form.license)
      return r.success ? {} : fieldErrors(r.error)
    }
    if (key === 'program') {
      const r = trainingChoiceSchema.safeParse({ courseId: form.courseId, sessionId: form.sessionId, statement: form.statement })
      return r.success ? {} : fieldErrors(r.error)
    }
    if (key === 'dates') {
      const r = assessmentChoiceSchema.safeParse({ preferredDates: form.preferredDates, statement: form.statement })
      return r.success ? {} : fieldErrors(r.error)
    }
    if (key === 'documents') {
      return documents.some(d => d.doc_type === 'LICENSE_CLP' && d.status !== 'REJECTED')
        ? {}
        : { _step: 'Upload your driver\'s license or CLP to continue.' }
    }
    if (key === 'test') {
      return app?.elp_submission_id ? {} : { _step: 'Complete the online English test to continue.' }
    }
    return {}
  }, [form, documents, app])

  // ------------------------------------------------------------------- save
  const buildPatch = useCallback((): ApplicationPatch => {
    if (!form || !app) return {}
    const personal = profileSchema.safeParse(form.personal)
    const license = licenseSchema.safeParse(form.license)
    const p = personal.success ? personal.data : form.personal
    const l = license.success ? license.data : form.license
    return {
      first_name: p.firstName.trim(),
      last_name: p.lastName.trim(),
      email: p.email.trim(),
      phone: p.phone.trim() || null,
      statement: form.statement.trim() || null,
      ...(type === 'TRAINING'
        ? { course_id: form.courseId || null, session_id: form.sessionId || null }
        : { preferred_dates: form.preferredDates.trim() || null }),
      form_data: {
        ...app.form_data,
        profile: {
          dateOfBirth: p.dateOfBirth, addressLine1: p.addressLine1.trim(), addressLine2: (p.addressLine2 ?? '').trim(),
          city: p.city.trim(), state: p.state.toUpperCase(), zipCode: p.zipCode.trim(),
        },
        license: { licenseType: l.licenseType, licenseNumber: (l.licenseNumber ?? '').trim(), licenseState: (l.licenseState ?? '').toUpperCase() },
      },
    }
  }, [form, app, type])

  const save = useCallback(async (): Promise<boolean> => {
    if (!app || !editable) return true
    try {
      const updated = await saveDraft(app.id, buildPatch())
      setApp(updated)
      setSavedAt(new Date())
      setSaveWarning('')
      return true
    } catch (err) {
      setSaveWarning(`Your latest changes weren't saved: ${toMessage(err)}`)
      return false
    }
  }, [app, editable, buildPatch])

  const syncProfile = useCallback(async () => {
    if (!saveToProfile || !form) return
    const personal = profileSchema.safeParse(form.personal)
    const license = licenseSchema.safeParse(form.license)
    const patch = {
      ...(personal.success ? {
        first_name: personal.data.firstName, last_name: personal.data.lastName, email: personal.data.email,
        phone: personal.data.phone, date_of_birth: personal.data.dateOfBirth, address_line1: personal.data.addressLine1,
        address_line2: personal.data.addressLine2 || null, city: personal.data.city, state: personal.data.state, zip_code: personal.data.zipCode,
      } : {}),
      ...(license.success ? {
        license_type: license.data.licenseType, license_number: license.data.licenseNumber || null, license_state: license.data.licenseState || null,
      } : {}),
    }
    if (!Object.keys(patch).length) return
    try {
      setStudent(await updateMyStudent(patch))
    } catch (err) {
      console.error('Profile sync failed:', err)
    }
  }, [saveToProfile, form])

  const showErrors = (found: Record<string, string>) => {
    setErrors(found)
    setStepError(found._step || 'Please fix the highlighted fields.')
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const next = async () => {
    const found = validate(step)
    if (Object.keys(found).length) return showErrors(found)
    setBusy(true)
    await save()
    if (step === 'personal' || step === 'license') await syncProfile()
    setBusy(false)
    goTo(steps[stepIndex + 1])
  }

  const back = async () => {
    setBusy(true)
    await save()
    setBusy(false)
    goTo(steps[stepIndex - 1])
  }

  const jump = async (key: StepKey) => {
    if (steps.indexOf(key) > stepIndex) {
      // Moving forward requires every step before the target to be complete.
      for (const k of steps.slice(0, steps.indexOf(key))) {
        const found = validate(k)
        if (Object.keys(found).length) {
          goTo(k)
          return showErrors(found)
        }
      }
    }
    setBusy(true)
    await save()
    setBusy(false)
    goTo(key)
  }

  const saveAndExit = async () => {
    setBusy(true)
    const ok = await save()
    setBusy(false)
    if (ok) navigate('/portal/')
  }

  const submit = async () => {
    for (const key of steps.filter(k => k !== 'review')) {
      const found = validate(key)
      if (Object.keys(found).length) {
        goTo(key)
        return showErrors(found)
      }
    }
    if (!app) return
    setBusy(true)
    setStepError('')
    const saved = await save()
    if (!saved) return setBusy(false)
    try {
      await submitApplication(app.id)
      // Admissions email is best-effort; the submission itself already succeeded.
      notifyAdmissions(app.id).catch(err => console.error('Admissions notification failed:', err))
      navigate(`/portal/applications/${app.id}/confirmation`, { replace: true })
    } catch (err) {
      setStepError(toMessage(err))
      setBusy(false)
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const startTest = async () => {
    if (!app) return
    setBusy(true)
    await save()
    setBusy(false)
    navigate(`/portal/assessment/test/${app.id}`)
  }

  // ---------------------------------------------------------------- render
  const selectedCourse = useMemo(() => courses.find(c => c.id === form?.courseId), [courses, form?.courseId])
  const selectedSession = useMemo(() => sessions.find(s => s.id === form?.sessionId), [sessions, form?.sessionId])

  if (loadError) {
    return (
      <Alert severity="error" action={<Button component={Link} to="/portal/" color="inherit">Dashboard</Button>}>{loadError}</Alert>
    )
  }
  if (!app || !form) return <PortalLoading />

  if (app.application_type !== type || !editable) {
    return (
      <Paper elevation={0} sx={{ ...cardSx, p: { xs: 3, md: 5 } }}>
        <Typography variant="h5" fontWeight={900} gutterBottom>This application can't be edited</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {TYPE_LABEL[app.application_type]} {app.reference_no} is {STATUS_META[app.status].label.toLowerCase()}. You can follow its progress from the application page.
        </Typography>
        <Button component={Link} to={`/portal/applications/${app.id}`} variant="contained" color="secondary">View application</Button>
      </Paper>
    )
  }

  const setPersonal = (key: keyof Form['personal']) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setForm(f => f && ({ ...f, personal: { ...f.personal, [key]: value } }))
    setErrors(er => ({ ...er, [key]: '' }))
  }
  const setLicense = (key: keyof Form['license']) => (value: string) => {
    setForm(f => f && ({ ...f, license: { ...f.license, [key]: value } }))
    setErrors(er => ({ ...er, [key]: '' }))
  }
  const setField = (key: 'courseId' | 'sessionId' | 'preferredDates' | 'statement') => (value: string) => {
    setForm(f => f && ({ ...f, [key]: value }))
    setErrors(er => ({ ...er, [key]: '' }))
  }
  const err = (key: string) => ({ error: Boolean(errors[key]), helperText: errors[key] || undefined })
  const isLast = stepIndex === steps.length - 1

  const stateSelect = (label: string, value: string, onChange: (v: string) => void, errorKey: string, autoComplete?: string) => (
    <TextField select fullWidth label={label} value={value} onChange={e => onChange(e.target.value)} {...err(errorKey)}
      slotProps={{ htmlInput: { autoComplete } }}>
      {US_STATES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
    </TextField>
  )

  return (
    <Box ref={topRef} sx={{ scrollMarginTop: 96 }}>
      <PageHeader
        title={type === 'TRAINING' ? 'Apply for CDL Training' : 'Apply for a CDL Assessment'}
        subtitle={<>Reference <strong>{app.reference_no}</strong>{savedAt ? ` · Saved ${savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : app.status === 'DRAFT' ? ` · Draft saved ${formatDate(app.updated_at)}` : ''}</>}
        action={<Button variant="outlined" startIcon={<SaveRounded />} onClick={() => void saveAndExit()} disabled={busy}>Save & finish later</Button>}
      />

      {app.status === 'INFO_REQUIRED' && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <strong>Admissions asked for more information.</strong> {app.staff_message}
          <br />Update your application, then resubmit it from the last step.
        </Alert>
      )}

      {/* Progress: full stepper on larger screens, compact bar on phones */}
      <Paper elevation={0} sx={{ ...cardSx, p: { xs: 2, md: 3 }, mb: 3 }}>
        <Box sx={{ display: { xs: 'block', md: 'none' } }}>
          <Typography fontWeight={800} color={NAVY}>Step {stepIndex + 1} of {steps.length}: {STEP_LABEL[step]}</Typography>
          <LinearProgress variant="determinate" value={((stepIndex + 1) / steps.length) * 100} color="secondary" sx={{ mt: 1, height: 8, borderRadius: 4 }} />
        </Box>
        <Stepper nonLinear activeStep={stepIndex} alternativeLabel sx={{ display: { xs: 'none', md: 'flex' } }}>
          {steps.map((key, i) => (
            <Step key={key} completed={i < stepIndex}>
              <StepButton onClick={() => void jump(key)} disabled={busy}>{STEP_LABEL[key]}</StepButton>
            </Step>
          ))}
        </Stepper>
      </Paper>

      {stepError && <Alert severity="error" sx={{ mb: 3 }} role="alert">{stepError}</Alert>}
      {saveWarning && <Alert severity="warning" sx={{ mb: 3 }} onClose={() => setSaveWarning('')}>{saveWarning}</Alert>}

      <Paper elevation={0} sx={{ ...cardSx, p: { xs: 2.5, md: 4 } }}>
        <Typography component="h2" variant="h5" fontWeight={900} sx={{ mb: 0.5 }}>{STEP_LABEL[step]}</Typography>

        {step === 'personal' && (
          <>
            <Typography color="text.secondary" sx={{ mb: 3 }}>We filled in what we already know from your profile. Check that it's correct.</Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="First name" value={form.personal.firstName} onChange={setPersonal('firstName')} autoComplete="given-name" {...err('firstName')} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Last name" value={form.personal.lastName} onChange={setPersonal('lastName')} autoComplete="family-name" {...err('lastName')} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth type="email" label="Email" value={form.personal.email} onChange={setPersonal('email')} autoComplete="email" {...err('email')} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth type="tel" label="Phone" value={form.personal.phone} onChange={setPersonal('phone')} autoComplete="tel" {...err('phone')} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth type="date" label="Date of birth" value={form.personal.dateOfBirth} onChange={setPersonal('dateOfBirth')}
                  slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: latestAdultBirthday(), autoComplete: 'bday' } }} {...err('dateOfBirth')} />
              </Grid>
              <Grid size={12}><TextField fullWidth label="Street address" value={form.personal.addressLine1} onChange={setPersonal('addressLine1')} autoComplete="address-line1" {...err('addressLine1')} /></Grid>
              <Grid size={12}><TextField fullWidth label="Apartment, suite, etc. (optional)" value={form.personal.addressLine2} onChange={setPersonal('addressLine2')} autoComplete="address-line2" {...err('addressLine2')} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="City" value={form.personal.city} onChange={setPersonal('city')} autoComplete="address-level2" {...err('city')} /></Grid>
              <Grid size={{ xs: 6, sm: 3 }}>{stateSelect('State', form.personal.state, v => setPersonal('state')({ target: { value: v } } as React.ChangeEvent<HTMLInputElement>), 'state', 'address-level1')}</Grid>
              <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth label="ZIP code" value={form.personal.zipCode} onChange={setPersonal('zipCode')} autoComplete="postal-code" slotProps={{ htmlInput: { inputMode: 'numeric' } }} {...err('zipCode')} /></Grid>
            </Grid>
            <FormControlLabel sx={{ mt: 2 }} control={<Checkbox checked={saveToProfile} onChange={e => setSaveToProfile(e.target.checked)} />}
              label="Save these details to my profile for future applications" />
          </>
        )}

        {step === 'license' && (
          <>
            <Typography color="text.secondary" sx={{ mb: 3 }}>Tell us which license you hold today.</Typography>
            <RadioGroup value={form.license.licenseType} onChange={e => setLicense('licenseType')(e.target.value)} sx={{ gap: 1, mb: 3 }}>
              {[
                ['REGULAR', "Regular driver's license (Class E / Class D)"],
                ['CLP', 'Commercial Learner\'s Permit (CLP)'],
                ['CDL', 'Commercial Driver\'s License (CDL)'],
                ['NONE', 'No license yet'],
              ].map(([value, label]) => (
                <Paper key={value} variant="outlined" sx={{ px: 2, borderRadius: 2, borderColor: form.license.licenseType === value ? 'secondary.main' : 'divider' }}>
                  <FormControlLabel value={value} control={<Radio color="secondary" />} label={label} sx={{ width: '100%', py: 0.5 }} />
                </Paper>
              ))}
            </RadioGroup>
            {errors.licenseType && <Typography color="error" variant="body2" sx={{ mt: -2, mb: 2 }}>{errors.licenseType}</Typography>}
            {form.license.licenseType && form.license.licenseType !== 'NONE' && (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 8 }}><TextField fullWidth label="License number" value={form.license.licenseNumber} onChange={e => setLicense('licenseNumber')(e.target.value)} {...err('licenseNumber')} /></Grid>
                <Grid size={{ xs: 12, sm: 4 }}>{stateSelect('Issuing state', form.license.licenseState, setLicense('licenseState'), 'licenseState')}</Grid>
              </Grid>
            )}
          </>
        )}

        {step === 'program' && (
          <>
            <Typography color="text.secondary" sx={{ mb: 3 }}>Choose your program and when you'd like to start.</Typography>
            <RadioGroup value={form.courseId} onChange={e => setField('courseId')(e.target.value)} sx={{ gap: 1.5, mb: 1 }}>
              {courses.map(course => (
                <Paper key={course.id} variant="outlined" sx={{ p: 2, borderRadius: 2, borderColor: form.courseId === course.id ? 'secondary.main' : 'divider', borderWidth: form.courseId === course.id ? 2 : 1 }}>
                  <FormControlLabel value={course.id} control={<Radio color="secondary" />} sx={{ width: '100%', alignItems: 'flex-start', m: 0 }}
                    label={<Box sx={{ pt: 0.75 }}><Typography fontWeight={900}>{course.name}</Typography>{course.description && <Typography variant="body2" color="text.secondary">{course.description}</Typography>}</Box>} />
                </Paper>
              ))}
            </RadioGroup>
            {errors.courseId && <Typography color="error" variant="body2" sx={{ mb: 2 }}>{errors.courseId}</Typography>}
            <TextField select fullWidth label="Start session" value={form.sessionId} onChange={e => setField('sessionId')(e.target.value)} sx={{ mt: 2 }} {...err('sessionId')}>
              {sessions.length === 0 && <MenuItem value="" disabled>No sessions are open right now. Contact admissions.</MenuItem>}
              {sessions.map(s => <MenuItem key={s.id} value={s.id}>{s.name} ({formatSessionDate(s.starts_at)} – {formatSessionDate(s.ends_at)})</MenuItem>)}
            </TextField>
            <TextField fullWidth multiline minRows={3} label="Anything you'd like admissions to know? (optional)" value={form.statement}
              onChange={e => setField('statement')(e.target.value)} sx={{ mt: 3 }} {...err('statement')} />
          </>
        )}

        {step === 'dates' && (
          <>
            <Typography color="text.secondary" sx={{ mb: 3 }}>Assessments are held in person at our training yard. Tell us when you're available and admissions will confirm a date.</Typography>
            <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
              {DATE_SUGGESTIONS.map(s => (
                <Chip key={s} label={s} variant="outlined" clickable
                  onClick={() => setField('preferredDates')(form.preferredDates.includes(s) ? form.preferredDates : [form.preferredDates.trim(), s].filter(Boolean).join(', '))} />
              ))}
            </Stack>
            <TextField fullWidth multiline minRows={3} label="Preferred days and times" placeholder="e.g. Weekday mornings after Oct 15"
              value={form.preferredDates} onChange={e => setField('preferredDates')(e.target.value)} {...err('preferredDates')} />
            <TextField fullWidth multiline minRows={3} label="Anything you'd like admissions to know? (optional)" value={form.statement}
              onChange={e => setField('statement')(e.target.value)} sx={{ mt: 3 }} {...err('statement')} />
          </>
        )}

        {step === 'documents' && (
          <>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              Upload a clear copy of your <strong>driver's license or CLP</strong> (required). Add any other documents admissions asked for.
            </Typography>
            <DocumentUploader applicationId={app.id} documents={documents} onChange={docs => { setDocuments(docs); setStepError('') }} />
          </>
        )}

        {step === 'test' && (
          <>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              The online English Language Proficiency test takes about 30–45 minutes. Find a quiet place; you can't pause once you begin.
            </Typography>
            {app.elp_submission_id ? (
              <Alert severity="success" icon={<CheckCircleRounded />} sx={{ mb: 2 }}>
                Test completed{elp?.evaluation ? ` — preliminary score ${elp.evaluation.score}/100 (${elp.evaluation.decision === 'PASS' ? 'pass' : 'not yet qualified'})` : ''}.
                {elp?.submitted_at && ` Taken ${formatDateTime(elp.submitted_at)}.`}
              </Alert>
            ) : (
              <Alert severity="info" sx={{ mb: 2 }}>You haven't taken the test for this request yet.</Alert>
            )}
            <Button variant={app.elp_submission_id ? 'outlined' : 'contained'} color="secondary" startIcon={<QuizRounded />} onClick={() => void startTest()} disabled={busy}>
              {app.elp_submission_id ? 'Retake the test' : 'Start the online test'}
            </Button>
          </>
        )}

        {step === 'review' && (
          <>
            <Typography color="text.secondary" sx={{ mb: 3 }}>Check everything below, then submit. You can't edit after submitting unless admissions asks for changes.</Typography>
            <Stack spacing={2} divider={<Divider />}>
              <ReviewBlock title="Personal info" onEdit={() => void jump('personal')} rows={[
                ['Name', `${form.personal.firstName} ${form.personal.lastName}`],
                ['Email', form.personal.email], ['Phone', form.personal.phone],
                ['Date of birth', formatDate(form.personal.dateOfBirth)],
                ['Address', [form.personal.addressLine1, form.personal.addressLine2, `${form.personal.city}, ${form.personal.state} ${form.personal.zipCode}`].filter(Boolean).join(', ')],
              ]} />
              <ReviewBlock title="License" onEdit={() => void jump('license')} rows={[
                ['Current license', { REGULAR: 'Regular driver\'s license', CLP: 'CLP', CDL: 'CDL', NONE: 'No license yet' }[form.license.licenseType] ?? '—'],
                ...(form.license.licenseType !== 'NONE' ? [['Number / state', `${form.license.licenseNumber} · ${form.license.licenseState}`] as [string, string]] : []),
              ]} />
              {type === 'TRAINING' ? (
                <ReviewBlock title="Program" onEdit={() => void jump('program')} rows={[
                  ['Program', selectedCourse?.name ?? '—'],
                  ['Start session', selectedSession ? `${selectedSession.name} (${formatSessionDate(selectedSession.starts_at)})` : '—'],
                  ...(form.statement ? [['Notes', form.statement] as [string, string]] : []),
                ]} />
              ) : (
                <ReviewBlock title="Preferred dates" onEdit={() => void jump('dates')} rows={[
                  ['Availability', form.preferredDates || '—'],
                  ...(form.statement ? [['Notes', form.statement] as [string, string]] : []),
                ]} />
              )}
              <ReviewBlock title="Documents" onEdit={() => void jump('documents')} rows={
                documents.length ? documents.map(d => [DOC_LABEL[d.doc_type], d.file_name] as [string, string]) : [['Documents', 'None uploaded']]
              } />
              {type === 'ASSESSMENT' && (
                <ReviewBlock title="English test" onEdit={() => void jump('test')} rows={[
                  ['Status', app.elp_submission_id ? `Completed${elp?.evaluation ? ` · ${elp.evaluation.score}/100` : ''}` : 'Not taken'],
                ]} />
              )}
            </Stack>
            <FormControlLabel sx={{ mt: 3, alignItems: 'flex-start' }}
              control={<Checkbox checked={confirmed} onChange={e => setConfirmed(e.target.checked)} sx={{ mt: -0.75 }} />}
              label="I confirm the information in this application is true and complete." />
          </>
        )}

        <Divider sx={{ my: 3 }} />
        <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1.5} justifyContent="space-between">
          <Button onClick={() => void back()} disabled={busy || stepIndex === 0} variant="text">Back</Button>
          {isLast ? (
            <Button variant="contained" color="secondary" size="large" onClick={() => void submit()} disabled={busy || !confirmed}>
              {busy ? 'Submitting…' : app.status === 'INFO_REQUIRED' ? 'Resubmit application' : 'Submit application'}
            </Button>
          ) : (
            <Button variant="contained" color="secondary" size="large" onClick={() => void next()} disabled={busy}>
              {busy ? 'Saving…' : `Continue to ${STEP_LABEL[steps[stepIndex + 1]].toLowerCase()}`}
            </Button>
          )}
        </Stack>
      </Paper>
    </Box>
  )
}

function ReviewBlock({ title, rows, onEdit }: { title: string; rows: Array<[string, string]>; onEdit: () => void }) {
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography fontWeight={900} color={NAVY}>{title}</Typography>
        <Button size="small" onClick={onEdit}>Edit</Button>
      </Stack>
      <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '180px 1fr' }, columnGap: 2, rowGap: { xs: 0.25, sm: 1 } }}>
        {rows.map(([label, value]) => (
          <Box key={`${label}-${value}`} sx={{ display: 'contents' }}>
            <Typography component="dt" color="text.secondary" variant="body2" sx={{ mt: { xs: 1, sm: 0 } }}>{label}</Typography>
            <Typography component="dd" sx={{ m: 0, wordBreak: 'break-word' }}>{value || '—'}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
