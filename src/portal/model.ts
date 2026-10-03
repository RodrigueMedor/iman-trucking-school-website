export const APPLICATION_STATUSES = [
  'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUIRED', 'APPROVED', 'SCHEDULED', 'COMPLETED', 'REJECTED',
] as const
export type ApplicationStatus = typeof APPLICATION_STATUSES[number]

export const APPLICATION_TYPES = ['TRAINING', 'ASSESSMENT'] as const
export type ApplicationType = typeof APPLICATION_TYPES[number]

export const DOC_TYPES = ['LICENSE_CLP', 'OTHER'] as const
export type DocType = typeof DOC_TYPES[number]

type ChipColor = 'default' | 'info' | 'warning' | 'success' | 'error' | 'primary' | 'secondary'

export const STATUS_META: Record<ApplicationStatus, { label: string; color: ChipColor; description: string }> = {
  DRAFT: { label: 'Draft', color: 'default', description: 'Not submitted yet. You can keep editing.' },
  SUBMITTED: { label: 'Submitted', color: 'info', description: 'Received. Admissions will review it shortly.' },
  UNDER_REVIEW: { label: 'Under Review', color: 'primary', description: 'Admissions is reviewing your application.' },
  INFO_REQUIRED: { label: 'Additional Information Required', color: 'warning', description: 'Admissions needs more information. Update and resubmit.' },
  APPROVED: { label: 'Approved', color: 'success', description: 'Approved. Scheduling details will follow.' },
  SCHEDULED: { label: 'Scheduled', color: 'secondary', description: 'Your date and location are confirmed.' },
  COMPLETED: { label: 'Completed', color: 'success', description: 'Completed. Congratulations!' },
  REJECTED: { label: 'Not Approved', color: 'error', description: 'This application was not approved. Contact admissions with questions.' },
}

/** Transitions staff may make. Mirrors set_application_status() in the database. */
export const STAFF_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  DRAFT: [],
  SUBMITTED: ['UNDER_REVIEW', 'INFO_REQUIRED', 'REJECTED'],
  UNDER_REVIEW: ['INFO_REQUIRED', 'APPROVED', 'REJECTED'],
  INFO_REQUIRED: [],
  APPROVED: ['SCHEDULED'],
  SCHEDULED: ['COMPLETED', 'SCHEDULED'],
  COMPLETED: [],
  REJECTED: [],
}

export function isEditableByStudent(status: ApplicationStatus) {
  return status === 'DRAFT' || status === 'INFO_REQUIRED'
}

export const TYPE_LABEL: Record<ApplicationType, string> = {
  TRAINING: 'CDL Training',
  ASSESSMENT: 'CDL Assessment',
}

export const DOC_LABEL: Record<DocType, string> = {
  LICENSE_CLP: "Driver's license / CLP",
  OTHER: 'Other document',
}
