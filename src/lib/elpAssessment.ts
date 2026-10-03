export const ELP_DRAFT_KEY = 'iman-elp-draft'
export const ELP_RESULT_KEY = 'iman-cdl-result'
export const ELP_SUBMISSIONS_KEY = 'iman-elp-submissions'

import type { ElpEvaluation, ElpResponses } from '../../shared/elpScoring.mjs'
export { automaticallyEvaluate, calculateEvaluation, emptyResponses, oralQuestions, oralResponseChoices, readingPassage, readingQuestions, trafficSigns, writtenChoices } from '../../shared/elpScoring.mjs'
export type { ElpEvaluation, ElpResponses } from '../../shared/elpScoring.mjs'

export type ApplicantInfo = { fullName: string; address: string; cityStateZip: string; phone: string; email: string; licenseNumber: string; licenseState: string; program: string; evaluatorName: string; evaluatorTitle: string; assessmentDate: string; assessmentTime: string }
export type ElpSubmission = { id: string; applicant: ApplicantInfo; responses: ElpResponses; attested: boolean; submittedAt: string; duration: string; status: 'PENDING_REVIEW' | 'EVALUATED'; evaluation?: ElpEvaluation }

export const emptyApplicant: ApplicantInfo = { fullName: '', address: '', cityStateZip: '', phone: '', email: '', licenseNumber: '', licenseState: '', program: '', evaluatorName: '', evaluatorTitle: '', assessmentDate: '', assessmentTime: '' }


export async function saveSubmission(submission: ElpSubmission) {
  const list: ElpSubmission[] = JSON.parse(localStorage.getItem(ELP_SUBMISSIONS_KEY) || '[]')
  const next = [submission, ...list.filter(item => item.id !== submission.id)]
  localStorage.setItem(ELP_SUBMISSIONS_KEY, JSON.stringify(next))
  localStorage.setItem(ELP_RESULT_KEY, JSON.stringify(submission))
  if (import.meta.env.DEV) {
    await fetch(getApiUrl('/api/dev/elp-submissions'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submission) })
  } else if (supabase) {
    // Submissions are created by the API (which scores them); staff only
    // record their evaluation on an existing row.
    const { data, error } = await supabase
      .from('elp_submissions')
      .update({ evaluation: submission.evaluation ?? null, status: submission.status, updated_at: new Date().toISOString() })
      .eq('id', submission.id)
      .select('id')
    if (error) throw error
    if (!data?.length) throw new Error('This assessment could not be updated. Refresh and try again.')
  }
}

export async function loadSubmissions(): Promise<ElpSubmission[]> {
  const local: ElpSubmission[] = JSON.parse(localStorage.getItem(ELP_SUBMISSIONS_KEY) || '[]')
  try {
    if (import.meta.env.DEV) {
      const response = await fetch(getApiUrl('/api/dev/elp-submissions'))
      if (response.ok) return await response.json()
    } else if (supabase) {
      const { data, error } = await supabase.from('elp_submissions').select('*').order('submitted_at', { ascending: false })
      if (!error && data) return data.map(row => ({ id: row.id, applicant: row.applicant, responses: row.responses, evaluation: row.evaluation ?? undefined, status: row.status, submittedAt: row.submitted_at, duration: row.duration, attested: true })) as ElpSubmission[]
    }
  } catch {}
  return local
}
import { supabase } from './supabase'
import { getApiUrl } from './api'
