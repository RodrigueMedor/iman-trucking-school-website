import { describe, expect, it } from 'vitest'
import { cameraErrorMessage } from '../src/portal/cameraErrors'

describe('camera check messages', () => {
  it('explains a blocked camera permission', () => {
    expect(cameraErrorMessage({ name: 'NotAllowedError' })).toMatch(/blocked/)
  })
  it('points to the phone when there is no camera', () => {
    expect(cameraErrorMessage({ name: 'NotFoundError' })).toMatch(/phone/)
  })
  it('explains a camera used by another app', () => {
    expect(cameraErrorMessage({ name: 'NotReadableError' })).toMatch(/another app/)
  })
  it('falls back for anything else', () => {
    expect(cameraErrorMessage(new Error('boom'))).toMatch(/in-person/)
  })
})
