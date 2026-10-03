import { describe, expect, it } from 'vitest'
import { safeNextPath } from '../src/portal/safeNextPath'
import { MAX_UPLOAD_BYTES, fieldErrors, profileSchema, signInSchema, signUpSchema, validateUploadFile } from '../src/portal/schemas'
import { STAFF_TRANSITIONS, isEditableByStudent } from '../src/portal/model'

describe('safeNextPath', () => {
  it('keeps portal paths including query strings', () => {
    expect(safeNextPath('/portal/apply/training?x=1')).toBe('/portal/apply/training?x=1')
  })
  it.each(['//evil.com', 'https://evil.com', '/\\evil', '/portal\\..\\admin', '/admin/', '', null, undefined, '/portal//evil.com'])(
    'falls back for unsafe target %s',
    value => expect(safeNextPath(value as string | null | undefined)).toBe('/portal/'),
  )
})

describe('validateUploadFile', () => {
  const mb = 1024 * 1024
  it('accepts a PDF with an upper-case extension', () => {
    expect(validateUploadFile({ name: 'license.PDF', type: 'application/pdf', size: mb })).toBeNull()
  })
  it('accepts a jpeg photo', () => {
    expect(validateUploadFile({ name: 'front.jpeg', type: 'image/jpeg', size: mb })).toBeNull()
  })
  it('rejects an executable disguised with a pdf mime type', () => {
    expect(validateUploadFile({ name: 'virus.exe', type: 'application/pdf', size: mb })).toMatch(/PDF, JPG or PNG/)
  })
  it('rejects a pdf name with a non-allowed mime type', () => {
    expect(validateUploadFile({ name: 'a.pdf', type: 'application/x-msdownload', size: mb })).toMatch(/PDF, JPG or PNG/)
  })
  it('rejects a jpg name carrying a png mime type mismatch', () => {
    expect(validateUploadFile({ name: 'a.jpg', type: 'application/pdf', size: mb })).toMatch(/PDF, JPG or PNG/)
  })
  it('rejects empty files', () => {
    expect(validateUploadFile({ name: 'a.pdf', type: 'application/pdf', size: 0 })).toMatch(/empty/)
  })
  it('rejects files over 10 MB', () => {
    expect(validateUploadFile({ name: 'a.pdf', type: 'application/pdf', size: MAX_UPLOAD_BYTES + 1 })).toMatch(/10 MB/)
  })
})

describe('profileSchema', () => {
  const adultDob = `${new Date().getFullYear() - 30}-01-15`
  const valid = {
    firstName: 'Jean', lastName: 'Pierre', email: 'jean@example.com', phone: '(407) 555-0123',
    dateOfBirth: adultDob, addressLine1: '1 Main St', addressLine2: '', city: 'Orlando', state: 'FL', zipCode: '32801',
  }
  it('accepts a valid profile', () => {
    expect(profileSchema.safeParse(valid).success).toBe(true)
  })
  it('rejects applicants younger than 18', () => {
    const dob = new Date(); dob.setFullYear(dob.getFullYear() - 17)
    expect(profileSchema.safeParse({ ...valid, dateOfBirth: dob.toISOString().slice(0, 10) }).success).toBe(false)
  })
  it.each([
    ['zipCode', '1234'], ['state', 'Florida'], ['phone', '12'], ['email', 'nope'], ['firstName', ' '],
  ])('rejects invalid %s', (field, value) => {
    expect(profileSchema.safeParse({ ...valid, [field]: value }).success).toBe(false)
  })
})

describe('status model', () => {
  it('only allows scheduling after approval', () => {
    expect(STAFF_TRANSITIONS.APPROVED).toEqual(['SCHEDULED'])
  })
  it('allows rescheduling or completing a scheduled application', () => {
    expect(STAFF_TRANSITIONS.SCHEDULED).toEqual(['COMPLETED', 'SCHEDULED'])
  })
  it('lets students edit drafts and info-required applications only', () => {
    expect(isEditableByStudent('DRAFT')).toBe(true)
    expect(isEditableByStudent('INFO_REQUIRED')).toBe(true)
    expect(isEditableByStudent('SUBMITTED')).toBe(false)
    expect(isEditableByStudent('APPROVED')).toBe(false)
  })
})

describe('signUpSchema', () => {
  const valid = { firstName: 'Ann', lastName: 'Able', email: 'ann@example.com', password: 'correct-horse', confirmPassword: 'correct-horse' }
  it('accepts a valid account', () => {
    expect(signUpSchema.safeParse(valid).success).toBe(true)
  })
  it('requires at least 10 password characters', () => {
    const result = signUpSchema.safeParse({ ...valid, password: 'short-pw1', confirmPassword: 'short-pw1' })
    expect(result.success).toBe(false)
    if (!result.success) expect(fieldErrors(result.error).password).toMatch(/10 characters/)
  })
  it('requires matching passwords', () => {
    const result = signUpSchema.safeParse({ ...valid, confirmPassword: 'something-else' })
    expect(result.success).toBe(false)
    if (!result.success) expect(fieldErrors(result.error).confirmPassword).toMatch(/match/)
  })
  it('rejects an invalid email', () => {
    expect(signUpSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false)
  })
})

describe('signInSchema', () => {
  it('requires email and password', () => {
    const result = signInSchema.safeParse({ email: '', password: '' })
    expect(result.success).toBe(false)
    if (!result.success) expect(Object.keys(fieldErrors(result.error)).sort()).toEqual(['email', 'password'])
  })
})
