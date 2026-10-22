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
export type TuitionAccount = {
  id: string; currency: string; tuition_cents: number; deposit_cents: number; financing_cents: number
  paid_cents: number; remaining_cents: number; refunded_cents: number; waived_cents: number; credit_cents: number
  financing_status: string | null; status: string
  installments_enabled: boolean; installment_count: number; first_due_at: string | null; created_at: string
  fee_items: FeeItem[]; housing_fee_cents: number; housing_selected: boolean; pricing_version: number | null
  course?: { name: string; code: string } | null; application?: { reference_no: string } | null
}
export type FeeItem = { code: string; label: string; amount_cents: number }
/** Server-computed itemized price of a course (see shared/tuition.mjs coursePricing). */
export type CoursePrice = { currency: string; version: number; items: FeeItem[]; housingFeeCents: number; totalWithoutHousingCents: number; totalWithHousingCents: number }
export type TuitionInstallment = { id: string; tuition_account_id: string; installment_no: number; label: string; amount_cents: number; due_at: string | null; status: string }
export type TuitionPayment = { id: string; tuition_account_id: string; installment_id: string | null; payment_kind: string | null; payment_method: string; amount_cents: number; refunded_cents: number; currency: string; status: string; receipt_number: string | null; succeeded_at: string | null; refunded_at: string | null; created_at: string }
export type TuitionAdjustment = { id: string; tuition_account_id: string; installment_id: string | null; kind: string; amount_cents: number; reason: string; created_at: string }
export type TuitionAgreement = { id: string; tuition_account_id: string; payment_id: string | null; version: string; signer_name: string; accepted_at: string; created_at: string }
export type FinancingStatus = { id: string; tuition_account_id: string | null; status: string; approved_amount_cents: number | null; funded_amount_cents: number | null; last_referred_at: string; updated_at: string } | null
export type SelfPayOption = { courseId: string; course: { name: string; code: string; tuition_cents: number; deposit_cents: number; installment_count: number; installments_enabled: boolean }; pricing: CoursePrice; application: { id: string; reference_no: string } | null }
export type BillingSummary = { accounts: TuitionAccount[]; installments: TuitionInstallment[]; payments: TuitionPayment[]; agreements: TuitionAgreement[]; adjustments: TuitionAdjustment[]; financing: FinancingStatus; payable?: SelfPayOption[] }

export type IdentityDocumentType = 'DRIVING_LICENSE' | 'GREEN_CARD'
export type IdentityStatus = 'NOT_STARTED' | 'PENDING' | 'VERIFIED' | 'FAILED' | 'MANUAL_REVIEW'
export type IdentityVerification = {
  id: string; method: 'PROVIDER' | 'ALTERNATIVE' | 'EXEMPT'; document_type: IdentityDocumentType | null; status: Exclude<IdentityStatus, 'NOT_STARTED'>
  failure_code: string; failure_reason: string; document_expires_on: string | null; decided_at: string | null; decision_note: string; created_at: string; updated_at: string
}
export type MyIdentity = { status: IdentityStatus; canStart: boolean; verification: IdentityVerification | null }
export type AdminIdentityVerification = IdentityVerification & {
  user_id: string; provider: string; provider_session_id: string | null; provider_status: string; provider_document_type: string | null
  document_issuing_country: string | null; name_matches: boolean | null; consent_version: string; consent_at: string; decided_by: string | null; redacted_at: string | null
  /** Stripe Dashboard page with the document and selfie images (staff sign in to Stripe). */
  stripe_dashboard_url: string | null
  evidence?: { copied_at: string; purged_at: string | null } | null
  student?: { first_name: string; last_name: string; email: string; phone: string | null } | null
}
export type IdentityEvent = { id: number; action: string; from_status: string | null; to_status: string | null; detail: string; actor_name: string; created_at: string }

/** Must match IDENTITY_CONSENT_VERSION in shared/identity.mjs. */
export const IDENTITY_CONSENT_VERSION = 'identity-v2-2026-10'

export function getMyIdentity() {
  return authedFetch<MyIdentity>('/api/me/identity')
}

/** Starts or resumes verification; returns Stripe's hosted verification URL. */
export function startIdentityVerification(documentType: IdentityDocumentType) {
  return authedFetch<{ url: string }>('/api/me/identity/sessions', { method: 'POST', body: JSON.stringify({ documentType, biometricConsent: true, consentVersion: IDENTITY_CONSENT_VERSION }) })
}

export function requestAlternativeVerification(documentType: IdentityDocumentType, reason?: string) {
  return authedFetch<MyIdentity>('/api/me/identity/alternative', { method: 'POST', body: JSON.stringify({ documentType, ...(reason ? { reason } : {}) }) })
}

export function listIdentityVerifications() {
  return authedFetch<{ verifications: AdminIdentityVerification[] }>('/api/admin/identity-verifications').then(result => result.verifications)
}

export function getIdentityEvents(verificationId: string) {
  return authedFetch<{ events: IdentityEvent[] }>(`/api/admin/identity-verifications/${encodeURIComponent(verificationId)}/events`).then(result => result.events)
}

export type IdentityEvidence = { copied_at: string; purged_at: string | null; date_of_birth?: string | null; document_number?: string | null; files: { kind: 'document_front' | 'document_back' | 'selfie' }[] }

/** Super administrator only; the server records each view in the audit trail. */
export function getIdentityEvidence(verificationId: string) {
  return authedFetch<IdentityEvidence>(`/api/admin/identity-verifications/${encodeURIComponent(verificationId)}/evidence`)
}

/** Decrypted image as an object URL; revoke it when no longer shown. */
export async function getIdentityEvidenceImage(verificationId: string, kind: string) {
  const { data } = await client().auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new ApiError('Your session has expired. Sign in again.', 401)
  const response = await fetch(getApiUrl(`/api/admin/identity-verifications/${encodeURIComponent(verificationId)}/evidence/${encodeURIComponent(kind)}`), { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  if (!response.ok) throw new ApiError('The image could not be loaded.', response.status)
  return URL.createObjectURL(await response.blob())
}

export function decideIdentity(verificationId: string, action: 'APPROVE' | 'REJECT' | 'REQUEST_RESUBMISSION', reason: string) {
  return authedFetch(`/api/admin/identity-verifications/${encodeURIComponent(verificationId)}/decision`, { method: 'POST', body: JSON.stringify({ action, reason }) })
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = { stripe: 'Card (Stripe)', cash: 'Cash', check: 'Check', money_order: 'Money order', other: 'Other' }

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

/**
 * Asks the API server to turn an account with a legacy role (or no profile)
 * into a student account. Staff and student accounts are left unchanged.
 */
export function setUpStudentAccount() {
  return authedFetch<{ role: string; repaired: boolean }>('/api/me/student-account', { method: 'POST', body: '{}' })
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

export function getMyBilling() {
  return authedFetch<BillingSummary>('/api/me/billing')
}

export type CoursePricing = {
  id: string; code: string; name: string; active: boolean; tuition_cents: number; deposit_cents: number; installment_count: number; installments_enabled: boolean; updated_at: string
  training_cents: number; testing_fee_cents: number; administrative_fee_cents: number; materials_fee_cents: number; housing_fee_cents: number
  currency: string; pricing_version: number; pricing_effective_at: string
}
export type CoursePricingInput = { trainingCents: number; testingFeeCents: number; administrativeFeeCents: number; materialsFeeCents: number; housingFeeCents: number; depositCents: number; installmentCount: number }
export type CoursePricingVersion = {
  id: string; version: number; training_cents: number; testing_fee_cents: number; administrative_fee_cents: number; materials_fee_cents: number
  housing_fee_cents: number; tuition_cents: number; deposit_cents: number; installment_count: number; effective_at: string; created_by_name: string | null
}

export function listCoursePricing() {
  return authedFetch<{ courses: CoursePricing[] }>('/api/admin/courses').then(result => result.courses)
}

export function getCoursePricingHistory(courseId: string) {
  return authedFetch<{ versions: CoursePricingVersion[] }>(`/api/admin/courses/${courseId}/pricing-history`).then(result => result.versions)
}

export function updateCoursePricing(courseId: string, input: CoursePricingInput) {
  return authedFetch<{ course: CoursePricing }>(`/api/admin/courses/${courseId}/pricing`, { method: 'PATCH', body: JSON.stringify(input) }).then(result => result.course)
}

/** Opens a tuition account at the course price so the student can pay by card. */
export function openTuitionAccount(courseId: string, housingSelected: boolean) {
  return authedFetch<{ tuitionAccountId: string }>('/api/me/tuition-accounts', { method: 'POST', body: JSON.stringify({ courseId, housingSelected }) })
}

/** Adds or removes optional housing; the server recalculates the total. */
export function setTuitionHousing(tuitionAccountId: string, housingSelected: boolean) {
  return authedFetch(`/api/me/tuition-accounts/${encodeURIComponent(tuitionAccountId)}/housing`, { method: 'PATCH', body: JSON.stringify({ housingSelected }) })
}

export function startTuitionCheckout(tuitionAccountId: string, kind: 'full' | 'deposit' | 'installment', installmentId: string | undefined, paymentPolicyAccepted: boolean, paymentPolicySignature: string) {
  return startCheckout('/api/create-tuition-checkout', { tuitionAccountId, kind, installmentId, paymentPolicyAccepted, paymentPolicySignature })
}

async function downloadPdf(path: string, filename: string, failure: string) {
  const { data } = await client().auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new ApiError('Your session has expired. Sign in again.', 401)
  const response = await fetch(getApiUrl(path), { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) throw new ApiError(failure, response.status)
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function downloadReceipt(paymentId: string, receiptNumber?: string | null) {
  return downloadPdf(`/api/payments/${encodeURIComponent(paymentId)}/receipt`, `${receiptNumber || 'IMAN-receipt'}.pdf`, 'The receipt could not be downloaded.')
}

export function downloadAgreement(agreementId: string) {
  return downloadPdf(`/api/agreements/${encodeURIComponent(agreementId)}/pdf`, `IMAN-agreement-${agreementId.slice(0, 8)}.pdf`, 'The agreement could not be downloaded.')
}

// Admin tuition actions (admin or super admin). The server validates and
// audits each one; clients never write payments or waivers directly.
export type ManualPaymentInput = { amountCents: number; method: 'cash' | 'check' | 'money_order' | 'other'; installmentId?: string; reference?: string; note?: string }

export function recordManualPayment(accountId: string, input: ManualPaymentInput) {
  return authedFetch(`/api/admin/tuition-accounts/${encodeURIComponent(accountId)}/payments`, { method: 'POST', body: JSON.stringify(input) })
}

export function voidManualPayment(paymentId: string, reason: string) {
  return authedFetch(`/api/admin/tuition-payments/${encodeURIComponent(paymentId)}/void`, { method: 'POST', body: JSON.stringify({ reason }) })
}

export function waiveInstallment(installmentId: string, reason: string) {
  return authedFetch(`/api/admin/tuition-installments/${encodeURIComponent(installmentId)}/waive`, { method: 'POST', body: JSON.stringify({ reason }) })
}
