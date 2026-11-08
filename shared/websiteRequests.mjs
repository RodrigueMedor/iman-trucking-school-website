// Requests submitted from public pages and triaged in Admin → Website
// requests. Shared by the API server (authoritative validation) and the
// browser form (inline errors), so both always agree.
import { z } from 'zod'

export const REQUEST_TYPES = ['GRADUATE_VERIFICATION', 'STUDENT_COMPLAINT', 'CAREERS', 'ELDT_TRANSFER']
export const REQUEST_STATUSES = ['NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']

export const REQUEST_TYPE_LABELS = {
  GRADUATE_VERIFICATION: 'Graduate verification',
  STUDENT_COMPLAINT: 'Student complaint',
  CAREERS: 'Careers',
  ELDT_TRANSFER: 'Prior ELDT training',
}

export const REQUEST_STATUS_LABELS = {
  NEW: 'New',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
}

export const COMPLAINANT_STATUSES = { CURRENT: 'Current student', FORMER: 'Former student or graduate', APPLICANT: 'Applicant', OTHER: 'Other' }
export const CAREER_POSITIONS = { CDL_INSTRUCTOR: 'CDL instructor', ADMISSIONS: 'Admissions or office staff', OTHER: 'Other role' }
export const ELDT_PARTS = { THEORY: 'Theory only', BEHIND_THE_WHEEL: 'Behind-the-wheel only', BOTH: 'Theory and behind-the-wheel', NOT_SURE: 'Not sure' }

const text = (label, max, min = 1) => z.string().trim().min(min, `${label} is required`).max(max, `${label} is too long`)
const optionalText = max => z.string().trim().max(max, 'This is too long').optional().default('')
const oneOf = (values, message) => z.enum(Object.keys(values), { errorMap: () => ({ message }) })

const base = {
  fullName: text('Your name', 200),
  email: z.string().trim().min(1, 'Enter your email address').max(254, 'Email address is too long').email('Enter a valid email address').transform(v => v.toLowerCase()),
  phone: z.string().trim().max(40).optional().default('')
    .refine(v => !v || /^\d{10,15}$/.test(v.replace(/\D/g, '')), 'Enter a valid phone number'),
  message: text('A description', 4000),
  // Honeypot: real visitors never see or fill this field.
  website: z.string().max(0).optional().default(''),
}

const detailSchemas = {
  GRADUATE_VERIFICATION: z.object({
    organization: text('Your organization', 200),
    graduateName: text('The graduate’s name', 200),
    trainingDates: optionalText(120),
    hasGraduateRelease: z.boolean().optional().default(false),
  }),
  STUDENT_COMPLAINT: z.object({
    complainantStatus: oneOf(COMPLAINANT_STATUSES, 'Choose the option that describes you'),
    incidentDate: optionalText(40),
    desiredOutcome: optionalText(1000),
  }),
  CAREERS: z.object({
    position: oneOf(CAREER_POSITIONS, 'Choose a position'),
    cdlClass: z.enum(['', 'A', 'B', 'C']).optional().default(''),
    yearsExperience: optionalText(20),
  }),
  ELDT_TRANSFER: z.object({
    providerName: text('The training provider’s name', 200),
    completedParts: oneOf(ELDT_PARTS, 'Choose what you completed'),
    completionDate: optionalText(40),
  }),
}

/** Validates a submission. Returns zod's safeParse result with { requestType, ...base, details }. */
export function parseWebsiteRequest(input) {
  const typeResult = z.enum(REQUEST_TYPES).safeParse(input?.requestType)
  if (!typeResult.success) return { success: false, error: new z.ZodError([{ code: 'custom', path: ['requestType'], message: 'Unknown request type' }]) }
  const requestType = typeResult.data
  return z.object({
    requestType: z.literal(requestType),
    ...base,
    details: detailSchemas[requestType],
    sourcePage: z.string().trim().max(200).optional().default(''),
  }).strict().safeParse(input)
}

/** Human-readable label/value rows for a request's type-specific details. */
export function describeRequestDetails(requestType, details = {}) {
  const rows = {
    GRADUATE_VERIFICATION: [
      ['Organization', details.organization],
      ['Graduate', details.graduateName],
      ['Training dates', details.trainingDates],
      ['Graduate release on file', details.hasGraduateRelease ? 'Yes' : 'No'],
    ],
    STUDENT_COMPLAINT: [
      ['Submitted by', COMPLAINANT_STATUSES[details.complainantStatus]],
      ['Date of the issue', details.incidentDate],
      ['Outcome requested', details.desiredOutcome],
    ],
    CAREERS: [
      ['Position', CAREER_POSITIONS[details.position]],
      ['CDL class held', details.cdlClass ? `Class ${details.cdlClass}` : ''],
      ['Years of experience', details.yearsExperience],
    ],
    ELDT_TRANSFER: [
      ['Training provider', details.providerName],
      ['Completed', ELDT_PARTS[details.completedParts]],
      ['Completion date', details.completionDate],
    ],
  }[requestType] || []
  return rows.filter(([, value]) => value)
}
