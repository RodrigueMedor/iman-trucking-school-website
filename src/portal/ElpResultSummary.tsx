import { useState } from 'react'
import { Alert, Box, Button, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import type { ElpEvaluation } from '../../shared/elpScoring.mjs'
import { emailElpReport, toMessage } from './api'

/** Score, decision and per-section breakdown of an online ELP test. */
export function ElpResultSummary({ resultId, evaluation }: { resultId: string; evaluation: ElpEvaluation }) {
  const [emailState, setEmailState] = useState<'' | 'sending' | 'sent'>('')
  const [error, setError] = useState('')
  const passed = evaluation.decision === 'PASS'

  const email = async () => {
    setError('')
    setEmailState('sending')
    try {
      await emailElpReport(resultId)
      setEmailState('sent')
    } catch (err) {
      setError(toMessage(err))
      setEmailState('')
    }
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
        <Typography fontSize={36} fontWeight={900}>{evaluation.score}<Typography component="span" color="text.secondary" fontSize={18}>/100</Typography></Typography>
        <Chip label={passed ? 'Preliminary pass' : 'Not yet qualified'} color={passed ? 'success' : 'warning'} sx={{ fontWeight: 800 }} />
      </Stack>
      <Typography color="text.secondary">
        {passed
          ? 'Admissions will confirm this result when they review your request.'
          : 'Admissions will contact you about practice resources and a retest.'}
      </Typography>
      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small" aria-label="Section scores">
          <TableHead>
            <TableRow><TableCell>Section</TableCell><TableCell align="right">Score</TableCell><TableCell align="right">Minimum</TableCell><TableCell align="right">Result</TableCell></TableRow>
          </TableHead>
          <TableBody>
            {evaluation.sections.map(s => (
              <TableRow key={s.section}>
                <TableCell>{s.section}</TableCell>
                <TableCell align="right">{s.score}/{s.max}</TableCell>
                <TableCell align="right">{s.minimum}</TableCell>
                <TableCell align="right">{s.passed ? 'Met' : 'Not met'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      {error && <Alert severity="error">{error}</Alert>}
      <Box>
        <Button variant="outlined" size="small" onClick={() => void email()} disabled={emailState !== ''}>
          {emailState === 'sent' ? 'Report emailed to you' : emailState === 'sending' ? 'Sending…' : 'Email me this report'}
        </Button>
      </Box>
    </Stack>
  )
}
