// Application-level encryption for identity evidence (document images,
// selfie, date of birth, document number) before it reaches storage.
// AES-256-GCM; the key is IDENTITY_ENCRYPTION_KEY (32 bytes, base64) and
// never leaves the API server.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const VERSION = 1

export function identityKey(base64) {
  const key = Buffer.from(String(base64 || ''), 'base64')
  if (key.length !== 32) throw new Error('IDENTITY_ENCRYPTION_KEY must be 32 bytes, base64-encoded')
  return key
}

/** Encrypts a Buffer: [version | iv(12) | tag(16) | ciphertext]. */
export function encryptBytes(key, plain) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const body = Buffer.concat([cipher.update(plain), cipher.final()])
  return Buffer.concat([Buffer.from([VERSION]), iv, cipher.getAuthTag(), body])
}

export function decryptBytes(key, sealed) {
  const data = Buffer.from(sealed)
  if (data[0] !== VERSION || data.length < 29) throw new Error('Unsupported identity evidence format')
  const decipher = createDecipheriv('aes-256-gcm', key, data.subarray(1, 13))
  decipher.setAuthTag(data.subarray(13, 29))
  return Buffer.concat([decipher.update(data.subarray(29)), decipher.final()])
}

export const encryptText = (key, text) => encryptBytes(key, Buffer.from(String(text), 'utf8')).toString('base64')
export const decryptText = (key, sealed) => decryptBytes(key, Buffer.from(sealed, 'base64')).toString('utf8')

// Evidence is deleted this many days after the verification is decided.
export const EVIDENCE_RETENTION_DAYS = 30
export function evidenceDue(decidedAt, now = new Date()) {
  return !!decidedAt && now.getTime() - new Date(decidedAt).getTime() >= EVIDENCE_RETENTION_DAYS * 86400000
}
