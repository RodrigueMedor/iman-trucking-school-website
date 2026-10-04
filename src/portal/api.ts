import { supabase } from '../lib/supabase'
import { getApiUrl } from '../lib/api'
import type { ElpEvaluation, ElpResponses } from '../../shared/elpScoring.mjs'
import type { ApplicationStatus, ApplicationType, DocType } from './model'
import { ApiError, toMessage } from './errors'
import { ALLOWED_MIME, validateUploadFile } from './schemas'

export { ApiError, toMessage }

export type StudentProfile = {
  id: string
  user_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  date_of_birth: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  license_type: 'NONE' | 'REGULAR' | 'CLP' | 'CDL' | null
  license_number: string | null
  license_state: string | null
  registration_payment_status: string | null
}

export type StudentProfilePatch = Partial<Omit<StudentProfile, 'id' | 'user_id' | 'registration_payment_status'>>

export type ApplicationFormData = {
  profile?: {
    dateOfBirth?: string
    addressLine1?: string
    addressLine2?: string
    city?: string
    state?: string
    zipCode?: string
  }
  license?: { licenseType?: string; licenseNumber?: string; licenseState?: string }
  [key: string]: unknown
}

export type Application = {
  id: string
  user_id: string
  application_type: ApplicationType
  reference_no: string
  status: ApplicationStatus
  first_name: string
  last_name: string
  email: string
  phone: string | null
  statement: string | null
  course_id: string | null
  session_id: string | null
  preferred_dates: string | null
  form_data: ApplicationFormData
  staff_message: string | null
  scheduled_at: string | null
  scheduled_location: string | null
  elp_submission_id: string | null
  payment_status: string | null
  submitted_at: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
  course?: { name: string; code: string; application_fee_cents: number | null } | null
  session?: { name: string; starts_at: string; ends_at: string } | null
}

export type ApplicationPatch = Partial<Pick<Application,
  'first_name' | 'last_name' | 'email' | 'phone' | 'statement' | 'course_id' | 'session_id' | 'preferred_dates' | 'form_data'>>

export type ApplicationEvent = {
  id: number
  application_id: string
  from_status: ApplicationStatus | null
  to_status: ApplicationStatus
  message: string | null
  created_at: string
}

export type ApplicationDocument = {
  id: string
  application_id: string
  user_id: string
  doc_type: DocType
  storage_path: string
  file_name: string
  mime_type: string
  size_bytes: number
  status: 'UPLOADED' | 'ACCEPTED' | 'REJECTED'
  created_at: string
}

export type Course = { id: string; code: string; name: string; description: string | null; application_fee_cents: number | null }
export type AcademicSession = { id: string; name: string; starts_at: string; ends_at: string }
export type ElpResult = { id: string; evaluation: ElpEvaluation | null; submitted_at: string; duration: string }

const BUCKET = 'student-documents'
const APPLICATION_COLUMNS = '*, course:cdl_courses(name, code, application_fee_cents), session:cdl_academic_sessions(name, starts_at, ends_at)'

function client() {
  if (!supabase) throw new ApiError('The student portal is not available right now. Please contact admissions.', 503)
  return supabase
}

async function currentUser() {
  const { data } = await client().auth.getSession()
  const user = data.session?.user
  if (!user) throw new ApiError('Your session has expired. Sign in again.', 401)
  return user
}

function check<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw result.error
  return result.data
}

// ------------------------------------------------------------------ profile

// The student row is read and written through the API server, which owns the
// field allow-list, instead of relying on cdl_students RLS from the browser.
export async function getMyStudent(): Promise<StudentProfile | null> {
  const { student } = await authedFetch<{ student: StudentProfile | null }>('/api/me/student')
  return student
}

export async function updateMyStudent(patch: StudentProfilePatch): Promise<StudentProfile> {
  const { student } = await authedFetch<{ student: StudentProfile }>('/api/me/student', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  return student
}

/** Keeps the account display name (shown in the portal header) in sync. */
export async function updateMyDisplayName(fullName: string): Promise<void> {
  const user = await currentUser()
  check(await client().from('profiles').update({ full_name: fullName }).eq('id', user.id))
}

/** Records only that the student opened Liberty; no lender data is collected. */
export async function recordFinancingReferral(): Promise<void> {
  await currentUser()
  check(await client().rpc('record_financing_referral'))
}

// ------------------------------------------------------------- applications

export async function listMyApplications(): Promise<Application[]> {
  const user = await currentUser()
  return check(await client()
    .from('cdl_class_applications')
    .select(APPLICATION_COLUMNS)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })) as Application[]
}

export async function getApplication(id: string): Promise<Application | null> {
  const user = await currentUser()
  return check(await client()
    .from('cdl_class_applications')
    .select(APPLICATION_COLUMNS)
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()) as Application | null
}

async function findDraft(userId: string, type: ApplicationType) {
  return check(await client()
    .from('cdl_class_applications')
    .select(APPLICATION_COLUMNS)
    .eq('user_id', userId)
    .eq('application_type', type)
    .eq('status', 'DRAFT')
    .maybeSingle()) as Application | null
}

/** Returns the open draft of this type, creating one prefilled from the profile. */
export async function getOrCreateDraft(type: ApplicationType): Promise<Application> {
  const user = await currentUser()
  const existing = await findDraft(user.id, type)
  if (existing) return existing

  const student = await getMyStudent()
  const metadata = user.user_metadata ?? {}
  const { data, error } = await client()
    .from('cdl_class_applications')
    .insert({
      user_id: user.id,
      application_type: type,
      status: 'DRAFT',
      first_name: student?.first_name || metadata.first_name || '',
      last_name: student?.last_name || metadata.last_name || '',
      email: student?.email || user.email || '',
      phone: student?.phone || null,
      form_data: profileToFormData(student),
    })
    .select(APPLICATION_COLUMNS)
    .single()
  if (error) {
    // Another tab created the draft first.
    if ((error as { code?: string }).code === '23505') {
      const raced = await findDraft(user.id, type)
      if (raced) return raced
    }
    throw error
  }
  return data as Application
}

export function profileToFormData(student: StudentProfile | null): ApplicationFormData {
  if (!student) return {}
  return {
    profile: {
      dateOfBirth: student.date_of_birth ?? '',
      addressLine1: student.address_line1 ?? '',
      addressLine2: student.address_line2 ?? '',
      city: student.city ?? '',
      state: student.state ?? '',
      zipCode: student.zip_code ?? '',
    },
    license: {
      licenseType: student.license_type ?? '',
      licenseNumber: student.license_number ?? '',
      licenseState: student.license_state ?? '',
    },
  }
}

export async function saveDraft(id: string, patch: ApplicationPatch): Promise<Application> {
  const user = await currentUser()
  const data = check(await client()
    .from('cdl_class_applications')
    .update(patch)
    .eq('id', id)
    .eq('user_id', user.id)
    .select(APPLICATION_COLUMNS)) as Application[]
  if (!data.length) throw new ApiError('This application can no longer be edited. Refresh to see its latest status.', 409)
  return data[0]
}

export async function submitApplication(id: string): Promise<Application> {
  return check(await client().rpc('submit_application', { p_id: id })) as Application
}

export async function deleteDraft(application: Application): Promise<void> {
  const documents = await listDocuments(application.id)
  for (const doc of documents) await deleteDocument(doc)
  check(await client().from('cdl_class_applications').delete().eq('id', application.id).eq('status', 'DRAFT'))
}

export async function listEvents(applicationId: string): Promise<ApplicationEvent[]> {
  return check(await client()
    .from('cdl_application_events')
    .select('id, application_id, from_status, to_status, message, created_at')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: true })) as ApplicationEvent[]
}

export async function listCourses(): Promise<Course[]> {
  return check(await client()
    .from('cdl_courses')
    .select('id, code, name, description, application_fee_cents')
    .eq('active', true)
    .order('code')) as Course[]
}

export async function listOpenSessions(): Promise<AcademicSession[]> {
  return check(await client()
    .from('cdl_academic_sessions')
    .select('id, name, starts_at, ends_at')
    .eq('open', true)
    .order('starts_at')) as AcademicSession[]
}

// ---------------------------------------------------------------- documents

export async function listDocuments(applicationId?: string): Promise<ApplicationDocument[]> {
  const user = await currentUser()
  let query = client().from('cdl_application_documents').select('*').eq('user_id', user.id)
  if (applicationId) query = query.eq('application_id', applicationId)
  return check(await query.order('created_at', { ascending: false })) as ApplicationDocument[]
}

export async function uploadDocument(applicationId: string, docType: DocType, file: File): Promise<ApplicationDocument> {
  const invalid = validateUploadFile(file)
  if (invalid) throw new ApiError(invalid, 400)

  const user = await currentUser()
  const ext = ALLOWED_MIME[file.type].includes(file.name.split('.').pop()?.toLowerCase() ?? '')
    ? file.name.split('.').pop()!.toLowerCase()
    : ALLOWED_MIME[file.type][0]
  const path = `${user.id}/${applicationId}/${crypto.randomUUID()}.${ext}`
  const storage = client().storage.from(BUCKET)

  const { error: uploadError } = await storage.upload(path, file, { contentType: file.type, upsert: false })
  if (uploadError) throw uploadError

  const { data, error } = await client()
    .from('cdl_application_documents')
    .insert({
      application_id: applicationId,
      user_id: user.id,
      doc_type: docType,
      storage_path: path,
      file_name: file.name.slice(0, 255),
      mime_type: file.type,
      size_bytes: file.size,
    })
    .select('*')
    .single()
  if (error) {
    await storage.remove([path])
    throw error
  }
  return data as ApplicationDocument
}

export async function deleteDocument(doc: ApplicationDocument): Promise<void> {
  const deleted = check(await client().from('cdl_application_documents').delete().eq('id', doc.id).select('id')) as { id: string }[]
  if (!deleted.length) throw new ApiError('This document is locked because the application was submitted.', 409)
  const { error } = await client().storage.from(BUCKET).remove([doc.storage_path])
  if (error) console.error('Document row removed but file cleanup failed:', error)
}

/** Short-lived link for viewing a private document. */
export async function documentUrl(doc: ApplicationDocument): Promise<string> {
  const { data, error } = await client().storage.from(BUCKET).createSignedUrl(doc.storage_path, 60)
  if (error || !data?.signedUrl) throw error ?? new ApiError('The document could not be opened.', 500)
  return data.signedUrl
}

// --------------------------------------------------------------- API server

/** fetch() against our Express API with the student's access token. */
export async function authedFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await client().auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new ApiError('Your session has expired. Sign in again.', 401)

  const response = await fetch(getApiUrl(path), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers, Authorization: `Bearer ${token}` },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ApiError(typeof body?.error === 'string' ? body.error : 'Something went wrong. Please try again.', response.status)
  }
  return body as T
}

export function notifyAdmissions(applicationId: string) {
  return authedFetch<{ sent: boolean }>(`/api/applications/${applicationId}/notify`, { method: 'POST', body: '{}' })
}

export function submitElpTest(applicationId: string, responses: ElpResponses, startedAt?: string) {
  return authedFetch<{ id: string; evaluation: ElpEvaluation }>('/api/elp-submissions', {
    method: 'POST',
    body: JSON.stringify({ applicationId, responses, startedAt }),
  })
}

export async function getElpResult(id: string): Promise<ElpResult | null> {
  return check(await client()
    .from('elp_submissions')
    .select('id, evaluation, submitted_at, duration')
    .eq('id', id)
    .maybeSingle()) as ElpResult | null
}

export async function emailElpReport(resultId: string): Promise<void> {
  const { data } = await client().auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new ApiError('Your session has expired. Sign in again.', 401)
  const response = await fetch('/api/send-assessment-report.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ resultId }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(body?.error || 'The report could not be emailed.', response.status)
}

// ----------------------------------------------------------------- payments

async function startCheckout(path: string, body: Record<string, unknown>) {
  const { url } = await authedFetch<{ url?: string }>(path, { method: 'POST', body: JSON.stringify(body) })
  if (!url) throw new ApiError('Checkout could not be started. Please try again.', 500)
  window.location.assign(url)
}

/** Optional application fee, available once the application is submitted. */
export function startApplicationCheckout(applicationId: string, paymentPolicyAccepted: boolean, paymentPolicySignature: string) {
  return startCheckout('/api/create-application-checkout', { applicationId, paymentPolicyAccepted, paymentPolicySignature })
}

export function startRegistrationCheckout(paymentPolicyAccepted: boolean, paymentPolicySignature: string) {
  return startCheckout('/api/create-registration-checkout', { paymentPolicyAccepted, paymentPolicySignature })
}
