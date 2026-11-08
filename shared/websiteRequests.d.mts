import type { SafeParseReturnType } from 'zod'

export type RequestType = 'GRADUATE_VERIFICATION' | 'STUDENT_COMPLAINT' | 'CAREERS' | 'ELDT_TRANSFER'
export type RequestStatus = 'NEW' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'

export declare const REQUEST_TYPES: RequestType[]
export declare const REQUEST_STATUSES: RequestStatus[]
export declare const REQUEST_TYPE_LABELS: Record<RequestType, string>
export declare const REQUEST_STATUS_LABELS: Record<RequestStatus, string>
export declare const COMPLAINANT_STATUSES: Record<string, string>
export declare const CAREER_POSITIONS: Record<string, string>
export declare const ELDT_PARTS: Record<string, string>

export type WebsiteRequestInput = {
  requestType: RequestType
  fullName: string
  email: string
  phone: string
  message: string
  website: string
  sourcePage: string
  details: Record<string, string | boolean>
}

export declare function parseWebsiteRequest(input: unknown): SafeParseReturnType<unknown, WebsiteRequestInput>
export declare function describeRequestDetails(requestType: string, details?: Record<string, unknown>): Array<[string, string]>
