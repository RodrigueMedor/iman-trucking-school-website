export const ELP_DRAFT_KEY = 'iman-elp-draft'
export const ELP_RESULT_KEY = 'iman-cdl-result'
export const ELP_SUBMISSIONS_KEY = 'iman-elp-submissions'

export const oralQuestions = [
  'State your full name and current address.',
  'Where did your trip start, and what is your destination?',
  'What time did you start work, and how many hours have you been on duty?',
  'Describe your driver license or learner permit information.',
  'What are you carrying or planning to carry, and who is the shipper or receiver?',
  'If an officer asks for your license, medical certificate, registration, and logbook, what will you provide?',
  'How would you tell an officer that a brake light is not working?',
  'What would you do if you did not understand an officer’s instruction?',
  'How would you ask for help if your truck broke down on the highway?',
  'Repeat in your own words: “Pull forward, turn off the engine, set the parking brake, and remain in the cab.”',
]

export const oralResponseChoices = [
  'Clear, complete spoken answer in English',
  'Generally understandable; needed one repetition',
  'Fragmented or incomplete spoken answer',
  'Unable to answer understandably in English',
]

export const trafficSigns = [
  { name: 'STOP', image: '/images/elp-signs/stop.png', critical: true, expected: 'Come to a complete stop and yield before proceeding safely.' },
  { name: 'YIELD', image: '/images/elp-signs/yield.png', critical: false, expected: 'Slow down, give right-of-way, and stop if needed.' },
  { name: 'DO NOT ENTER', image: '/images/elp-signs/do-not-enter.png', critical: true, expected: 'Do not enter in this direction.' },
  { name: 'SPEED LIMIT 55', image: '/images/elp-signs/speed-limit-55.png', critical: false, expected: 'Maximum lawful speed is 55 mph unless conditions require slower travel.' },
  { name: 'LOW CLEARANCE 12 FT 6 IN', image: '/images/elp-signs/low-clearance.png', critical: true, expected: 'Do not proceed if the vehicle exceeds or cannot safely clear 12 ft 6 in.' },
  { name: 'LANE ENDS / MERGE', image: '/images/elp-signs/lane-ends.png', critical: false, expected: 'Prepare to merge safely.' },
  { name: 'ROAD CLOSED', image: '/images/elp-signs/road-closed.png', critical: true, expected: 'Do not proceed; follow detour or official instructions.' },
  { name: 'TRUCK ROUTE', image: '/images/elp-signs/truck-route.png', critical: false, expected: 'Follow the designated truck route.' },
  { name: 'WEIGH STATION 1 MILE', image: '/images/elp-signs/weigh-station.png', critical: false, expected: 'Prepare to enter the weigh station in one mile when required.' },
  { name: 'WRONG WAY', image: '/images/elp-signs/wrong-way.png', critical: false, expected: 'You are traveling against permitted traffic; stop and safely correct direction.' },
]

export const readingPassage = 'DISPATCH MESSAGE — Pickup appointment: 8:30 a.m. at Central Distribution, Door 12. Check in at the security gate with your driver license and pickup number 45821. The load weighs 38,500 pounds and is going to Jacksonville, Florida. Before leaving, confirm that the trailer doors are locked and the seal number matches the bill of lading. If the seal number does not match, do not leave the facility; call dispatch immediately.'

export const readingQuestions = [
  { prompt: 'What time is the pickup appointment?', max: 2, choices: ['8:30 a.m.', '12:00 p.m.', '4:58 p.m.', '10:30 a.m.'] },
  { prompt: 'Where must you check in?', max: 2, choices: ['Security gate', 'Fuel island', 'Repair shop', 'Weigh station'] },
  { prompt: 'What two items must you present?', max: 2, choices: ['Driver license and pickup number 45821', 'Medical card and fuel receipt', 'Passport and toll ticket', 'Registration and cash'] },
  { prompt: 'What is the destination?', max: 2, choices: ['Jacksonville, Florida', 'Orlando, Florida', 'Atlanta, Georgia', 'Tampa, Florida'] },
  { prompt: 'What is the load weight?', max: 2, choices: ['38,500 pounds', '48,500 pounds', '35,800 pounds', '40,000 pounds'] },
  { prompt: 'What must you check before leaving?', max: 3, choices: ['Trailer doors are locked and seal matches the bill of lading', 'Fuel tank is full', 'Radio is turned off', 'Receiver has called'] },
  { prompt: 'What must you do if the seal number does not match?', max: 3, choices: ['Do not leave; call dispatch immediately', 'Leave and report it later', 'Replace the bill of lading', 'Break the seal and continue'] },
  { prompt: 'Which statement gives the main safety instruction?', max: 4, choices: ['Verify the locked doors and matching seal before leaving; stop and call dispatch for a mismatch', 'Always arrive before 8:30 a.m.', 'Drive directly to Jacksonville without stopping', 'Only show the pickup number at the gate'] },
]

export const writtenChoices = {
  driverName: ['Applicant’s full legal name', 'Evaluator’s name', 'Company name', 'Leave blank'],
  date: ['Current assessment date', 'Birth date', 'License issue date', 'Leave blank'],
  startLocation: ['Actual trip start location', 'Final destination', 'Home address only', 'Leave blank'],
  destination: ['Actual trip destination', 'Trip start location', 'Nearest fuel stop', 'Leave blank'],
  startTime: ['Actual on-duty start time', 'Appointment time only', 'Current clock time regardless of trip', 'Leave blank'],
  onDutyTime: ['Actual total on-duty time', 'Driving time only in every case', 'A guessed number', 'Leave blank'],
  defects: ['Right rear brake light inoperative; left rear trailer tire has a deep cut; report and do not operate until inspected/repaired', 'Only report the brake light and continue driving', 'Only report the tire and continue driving', 'No defect needs to be reported'],
  licenseExpiry: ['11/07/2030', '07/11/2020', '01/10/2037', 'D123-456-81-001-0'],
}

export type ApplicantInfo = { fullName: string; address: string; cityStateZip: string; phone: string; email: string; licenseNumber: string; licenseState: string; program: string; evaluatorName: string; evaluatorTitle: string; assessmentDate: string; assessmentTime: string }
export type ElpResponses = { oral: string[]; signs: string[]; reading: string[]; log: Record<string, string>; defects: string; licenseExpiry: string }
export type ElpEvaluation = { oralScores: number[]; signScores: number[]; readingScores: number[]; logScore: number; defectScore: number; licenseScore: number; criticalPassed: boolean[]; prohibitedAssistance: boolean; evaluatorName: string; evaluatorTitle: string; notes: string; evaluatedAt: string; sections: Array<{ section: string; score: number; max: number; minimum: number; passed: boolean }>; score: number; decision: 'PASS' | 'NOT YET QUALIFIED' }
export type ElpSubmission = { id: string; applicant: ApplicantInfo; responses: ElpResponses; attested: boolean; submittedAt: string; duration: string; status: 'PENDING_REVIEW' | 'EVALUATED'; evaluation?: ElpEvaluation }

export const emptyApplicant: ApplicantInfo = { fullName: '', address: '', cityStateZip: '', phone: '', email: '', licenseNumber: '', licenseState: '', program: '', evaluatorName: '', evaluatorTitle: '', assessmentDate: '', assessmentTime: '' }
export const emptyResponses: ElpResponses = { oral: Array(10).fill(''), signs: Array(10).fill(''), reading: Array(8).fill(''), log: { driverName: '', date: '', startLocation: '', destination: '', startTime: '', onDutyTime: '' }, defects: '', licenseExpiry: '' }

export function calculateEvaluation(input: Omit<ElpEvaluation, 'sections' | 'score' | 'decision' | 'evaluatedAt'>): ElpEvaluation {
  const oral = input.oralScores.reduce((a, b) => a + b, 0)
  const signs = input.signScores.reduce((a, b) => a + b, 0)
  const reading = input.readingScores.reduce((a, b) => a + b, 0)
  const written = input.logScore + input.defectScore + input.licenseScore
  const sections = [
    { section: 'A — Oral Interview', score: oral, max: 30, minimum: 21, passed: oral >= 21 },
    { section: 'B — Traffic Signs', score: signs, max: 30, minimum: 24, passed: signs >= 24 },
    { section: 'C — Reading', score: reading, max: 20, minimum: 14, passed: reading >= 14 },
    { section: 'D — Written Records', score: written, max: 20, minimum: 14, passed: written >= 14 },
  ]
  const score = oral + signs + reading + written
  const criticalOK = input.criticalPassed.length === 4 && input.criticalPassed.every(Boolean)
  const decision = score >= 80 && sections.every(s => s.passed) && criticalOK && !input.prohibitedAssistance ? 'PASS' : 'NOT YET QUALIFIED'
  return { ...input, sections, score, decision, evaluatedAt: new Date().toISOString() }
}

export function automaticallyEvaluate(responses: ElpResponses, evaluatorName: string, evaluatorTitle: string): ElpEvaluation {
  const oralScores = responses.oral.map(answer => {
    const index = oralResponseChoices.indexOf(answer)
    return index < 0 ? 0 : 3 - index
  })
  const signScores = responses.signs.map((answer, index) => answer === trafficSigns[index].expected ? 3 : 0)
  const readingScores = responses.reading.map((answer, index) => answer === readingQuestions[index].choices[0] ? readingQuestions[index].max : 0)
  const logKeys = ['driverName', 'date', 'startLocation', 'destination', 'startTime', 'onDutyTime'] as const
  const correctLogEntries = logKeys.filter(key => responses.log[key] === writtenChoices[key][0]).length
  const logScore = correctLogEntries + (correctLogEntries === logKeys.length ? 2 : 0)
  const defectScore = responses.defects === writtenChoices.defects[0] ? 8 : 0
  const licenseScore = responses.licenseExpiry === writtenChoices.licenseExpiry[0] ? 4 : 0
  const criticalPassed = trafficSigns.filter(sign => sign.critical).map(sign => responses.signs[trafficSigns.indexOf(sign)] === sign.expected)
  return calculateEvaluation({
    oralScores, signScores, readingScores, logScore, defectScore, licenseScore, criticalPassed,
    prohibitedAssistance: false,
    evaluatorName: evaluatorName || 'Automated preliminary scoring',
    evaluatorTitle: evaluatorTitle || 'System assessment',
    notes: 'Automatically scored from selected responses. An authorized evaluator may review and revise this result.',
  })
}

export async function saveSubmission(submission: ElpSubmission) {
  const list: ElpSubmission[] = JSON.parse(localStorage.getItem(ELP_SUBMISSIONS_KEY) || '[]')
  const next = [submission, ...list.filter(item => item.id !== submission.id)]
  localStorage.setItem(ELP_SUBMISSIONS_KEY, JSON.stringify(next))
  localStorage.setItem(ELP_RESULT_KEY, JSON.stringify(submission))
  if (import.meta.env.DEV) {
    await fetch('/api/dev/elp-submissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submission) })
  } else if (supabase) {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { error } = await supabase.from('elp_submissions').upsert({ id: submission.id, student_id: user.id, applicant: submission.applicant, responses: submission.responses, evaluation: submission.evaluation ?? null, status: submission.status, submitted_at: submission.submittedAt, duration: submission.duration, updated_at: new Date().toISOString() })
      if (error) throw error
    }
  }
}

export async function loadSubmissions(): Promise<ElpSubmission[]> {
  const local: ElpSubmission[] = JSON.parse(localStorage.getItem(ELP_SUBMISSIONS_KEY) || '[]')
  try {
    if (import.meta.env.DEV) {
      const response = await fetch('/api/dev/elp-submissions')
      if (response.ok) return await response.json()
    } else if (supabase) {
      const { data, error } = await supabase.from('elp_submissions').select('*').order('submitted_at', { ascending: false })
      if (!error && data) return data.map(row => ({ id: row.id, applicant: row.applicant, responses: row.responses, evaluation: row.evaluation ?? undefined, status: row.status, submittedAt: row.submitted_at, duration: row.duration, attested: true })) as ElpSubmission[]
    }
  } catch {}
  return local
}
import { supabase } from './supabase'
