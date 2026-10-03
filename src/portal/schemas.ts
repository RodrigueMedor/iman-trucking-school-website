import { z } from 'zod'

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
export const ALLOWED_MIME: Record<string, string[]> = {
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
}

export const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO',
  'MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
] as const

const required = (label: string, max = 100) => z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`)

function ageOn(dob: Date, today = new Date()) {
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  return age
}

export const profileSchema = z.object({
  firstName: required('First name'),
  lastName: required('Last name'),
  email: z.string().trim().email('Enter a valid email address'),
  phone: z.string().trim().refine(v => /^\d{10,15}$/.test(v.replace(/\D/g, '')), 'Enter a valid phone number'),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter your date of birth')
    .refine(v => !Number.isNaN(Date.parse(v)) && ageOn(new Date(`${v}T00:00:00`)) >= 18, 'You must be at least 18 years old')
    .refine(v => ageOn(new Date(`${v}T00:00:00`)) < 100, 'Enter a valid date of birth'),
  addressLine1: required('Street address', 200),
  addressLine2: z.string().trim().max(200).optional().default(''),
  city: required('City'),
  state: z.string().trim().toUpperCase().refine(v => (US_STATES as readonly string[]).includes(v), 'Choose a state'),
  zipCode: z.string().trim().regex(/^\d{5}(-\d{4})?$/, 'Enter a 5-digit ZIP code'),
})
export type ProfileInput = z.infer<typeof profileSchema>

export const licenseSchema = z.object({
  licenseType: z.enum(['NONE', 'REGULAR', 'CLP', 'CDL'], { errorMap: () => ({ message: 'Choose your current license' }) }),
  licenseNumber: z.string().trim().max(30).optional().default(''),
  licenseState: z.string().trim().toUpperCase().optional().default(''),
}).superRefine((value, ctx) => {
  if (value.licenseType === 'NONE') return
  if (!/^[A-Z0-9-]{4,30}$/i.test(value.licenseNumber)) ctx.addIssue({ code: 'custom', path: ['licenseNumber'], message: 'Enter your license number' })
  if (!(US_STATES as readonly string[]).includes(value.licenseState)) ctx.addIssue({ code: 'custom', path: ['licenseState'], message: 'Choose the issuing state' })
})
export type LicenseInput = z.infer<typeof licenseSchema>

export const trainingChoiceSchema = z.object({
  courseId: z.string().uuid('Choose a program'),
  sessionId: z.string().uuid('Choose a start session'),
  statement: z.string().trim().max(1500, 'Keep this under 1500 characters').optional().default(''),
})
export type TrainingChoiceInput = z.infer<typeof trainingChoiceSchema>

export const assessmentChoiceSchema = z.object({
  preferredDates: z.string().trim().min(3, 'Tell us which days and times work for you').max(500),
  statement: z.string().trim().max(1500).optional().default(''),
})
export type AssessmentChoiceInput = z.infer<typeof assessmentChoiceSchema>

/** Returns an error message, or null when the file is acceptable. */
export function validateUploadFile(file: { name: string; type: string; size: number }): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const allowedExt = ALLOWED_MIME[file.type]
  if (!allowedExt || !allowedExt.includes(ext)) return 'Upload a PDF, JPG or PNG file.'
  if (file.size <= 0) return 'This file is empty.'
  if (file.size > MAX_UPLOAD_BYTES) return 'Files must be 10 MB or smaller.'
  return null
}

/** Flattens a zod error into { field: message } for inline form errors. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.')
    if (key && !out[key]) out[key] = issue.message
  }
  return out
}
