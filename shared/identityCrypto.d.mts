export function identityKey(base64: string | undefined): Buffer
export function encryptBytes(key: Buffer, plain: Buffer): Buffer
export function decryptBytes(key: Buffer, sealed: Buffer | Uint8Array): Buffer
export function encryptText(key: Buffer, text: string): string
export function decryptText(key: Buffer, sealed: string): string
export const EVIDENCE_RETENTION_DAYS: number
export function evidenceDue(decidedAt: string | null | undefined, now?: Date): boolean
