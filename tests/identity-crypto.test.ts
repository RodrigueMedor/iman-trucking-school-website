import { describe, expect, it } from 'vitest'
import { randomBytes } from 'node:crypto'
import { decryptBytes, decryptText, encryptBytes, encryptText, evidenceDue, identityKey } from '../shared/identityCrypto.mjs'

const key = identityKey(randomBytes(32).toString('base64'))

describe('identity evidence encryption', () => {
  it('round-trips images and text', () => {
    const image = randomBytes(2048)
    expect(decryptBytes(key, encryptBytes(key, image)).equals(image)).toBe(true)
    expect(decryptText(key, encryptText(key, 'D1234567'))).toBe('D1234567')
  })
  it('never stores the plain value and uses a fresh IV each time', () => {
    const a = encryptText(key, '1990-01-31')
    expect(a).not.toContain('1990')
    expect(encryptText(key, '1990-01-31')).not.toBe(a)
  })
  it('rejects tampered data and the wrong key', () => {
    const sealed = encryptBytes(key, Buffer.from('license'))
    sealed[sealed.length - 1] ^= 1
    expect(() => decryptBytes(key, sealed)).toThrow()
    const other = identityKey(randomBytes(32).toString('base64'))
    expect(() => decryptText(other, encryptText(key, 'x'))).toThrow()
  })
  it('refuses a missing or short key', () => {
    expect(() => identityKey(undefined)).toThrow(/32 bytes/)
    expect(() => identityKey(Buffer.from('short').toString('base64'))).toThrow(/32 bytes/)
  })
  it('deletes evidence 30 days after a decision, never before', () => {
    const days = (n: number) => new Date(Date.now() - n * 86400000).toISOString()
    expect(evidenceDue(days(31))).toBe(true)
    expect(evidenceDue(days(29))).toBe(false)
    expect(evidenceDue(null)).toBe(false)
  })
})
