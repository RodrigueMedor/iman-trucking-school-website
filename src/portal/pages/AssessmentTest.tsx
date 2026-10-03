import { useEffect, useState } from 'react'
import { Alert, Button, Paper, Stack, Typography } from '@mui/material'
import { Link, useParams } from 'react-router-dom'
import type { ElpEvaluation } from '../../../shared/elpScoring.mjs'
import { useAuth } from '../../contexts/AuthContext'
import { getApplication, submitElpTest, toMessage, type Application } from '../api'
import { isEditableByStudent } from '../model'
import { ElpTestForm } from '../ElpTestForm'
import { ElpResultSummary } from '../ElpResultSummary'
import { PortalLoading } from '../RequireStudent'
import { cardSx, PageHeader } from '../ui'

export function AssessmentTest() {
  const { applicationId = '' } = useParams()
  const { session } = useAuth()
  const [app, setApp] = useState<Application | null | undefined>(undefined)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ id: string; evaluation: ElpEvaluation } | null>(null)

  useEffect(() => {
    getApplication(applicationId).then(setApp).catch(err => setError(toMessage(err)))
  }, [applicationId])

  const backToApplication = `/portal/apply/assessment?id=${applicationId}&step=test`

  if (error) return <Alert severity="error">{error}</Alert>
  if (app === undefined) return <PortalLoading />
  if (!app || app.application_type !== 'ASSESSMENT' || !isEditableByStudent(app.status)) {
    return (
      <Alert severity="warning" action={<Button component={Link} to="/portal/applications/" color="inherit">My applications</Button>}>
        The online test is only available for a CDL Assessment request that hasn't been submitted yet.
      </Alert>
    )
  }

  if (result) {
    return (
      <>
        <PageHeader title="Your test is complete" subtitle={`CDL Assessment ${app.reference_no}`} />
        <Paper elevation={0} sx={{ ...cardSx, p: { xs: 2.5, md: 4 }, maxWidth: 760 }}>
          <ElpResultSummary resultId={result.id} evaluation={result.evaluation} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 3 }}>
            <Button component={Link} to={backToApplication} variant="contained" color="secondary">Continue your application</Button>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Your request isn't submitted yet. Review it and submit it from the last step.
          </Typography>
        </Paper>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="English Language Proficiency test"
        subtitle={`Part of your CDL Assessment request ${app.reference_no}`}
        action={<Button component={Link} to={backToApplication} variant="text">Back to application</Button>}
      />
      <ElpTestForm
        draftKey={`iman-elp-draft:${session?.user.id ?? 'anon'}:${app.id}`}
        onSubmit={async (responses, startedAt) => {
          setResult(await submitElpTest(app.id, responses, startedAt))
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
      />
    </>
  )
}
