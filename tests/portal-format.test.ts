import { beforeAll, describe, expect, it } from 'vitest'
import { formatDate, formatSessionDate } from '../src/portal/format'

beforeAll(() => {
  // A US timezone, where UTC midnight falls on the previous calendar day.
  process.env.TZ = 'America/New_York'
})

describe('formatSessionDate', () => {
  it('shows the calendar day a session was entered for, not the previous local day', () => {
    expect(formatSessionDate('2026-01-01T00:00:00+00:00')).toBe('Jan 1, 2026')
    expect(formatSessionDate('2026-12-31T23:59:59+00:00')).toBe('Dec 31, 2026')
  })
  it('handles empty and invalid input', () => {
    expect(formatSessionDate(null)).toBe('—')
    expect(formatSessionDate('nope')).toBe('—')
  })
})

describe('formatDate', () => {
  it('treats a plain YYYY-MM-DD (date of birth) as a local calendar day', () => {
    expect(formatDate('1990-01-15')).toBe('Jan 15, 1990')
  })
})
