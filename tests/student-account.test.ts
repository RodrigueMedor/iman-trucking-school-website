import { describe, expect, it } from 'vitest'
import { studentAccountDecision } from '../shared/studentAccount.mjs'

describe('studentAccountDecision', () => {
  it.each(['student', 'super_admin', 'instructor'])('leaves a %s account as it is', role => {
    expect(studentAccountDecision({ role, createdByLogistics: true })).toBe('already-set-up')
  })

  it('converts an account with no profile', () => {
    expect(studentAccountDecision({ role: null, createdByLogistics: false })).toBe('convert')
  })

  it('converts an employee account that Logistics did not create (a school sign-up)', () => {
    expect(studentAccountDecision({ role: 'employee', createdByLogistics: false })).toBe('convert')
  })

  it('never converts an employee account the Logistics back office created', () => {
    expect(studentAccountDecision({ role: 'employee', createdByLogistics: true })).toBe('refuse')
  })

  it.each(['admin', 'unknown'])('never converts an %s account', role => {
    expect(studentAccountDecision({ role, createdByLogistics: false })).toBe('refuse')
  })
})
