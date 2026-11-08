export declare const PORTAL_ROLES: Set<string>
export declare function studentAccountDecision(account: {
  role: string | null
  createdByLogistics: boolean
}): 'already-set-up' | 'convert' | 'refuse'
