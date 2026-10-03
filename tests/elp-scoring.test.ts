import { describe, expect, it } from 'vitest'
import {
  automaticallyEvaluate, emptyResponses, oralResponseChoices, readingQuestions, trafficSigns, validateResponsesShape, writtenChoices,
} from '../shared/elpScoring.mjs'

function perfect() {
  return {
    oral: Array(10).fill(oralResponseChoices[0]),
    signs: trafficSigns.map(sign => sign.expected),
    reading: readingQuestions.map(q => q.choices[0]),
    log: Object.fromEntries(['driverName', 'date', 'startLocation', 'destination', 'startTime', 'onDutyTime'].map(k => [k, (writtenChoices as any)[k][0]])),
    defects: writtenChoices.defects[0],
    licenseExpiry: writtenChoices.licenseExpiry[0],
  }
}

describe('ELP scoring', () => {
  it('scores perfect answers as PASS with 100 points', () => {
    const result = automaticallyEvaluate(perfect(), '', '')
    expect(result.score).toBe(100)
    expect(result.decision).toBe('PASS')
  })
  it('scores blank answers as not qualified with 0 points', () => {
    const result = automaticallyEvaluate(emptyResponses, '', '')
    expect(result.score).toBe(0)
    expect(result.decision).toBe('NOT YET QUALIFIED')
  })
  it('fails an otherwise perfect test when a critical sign is missed', () => {
    const answers = perfect()
    answers.signs[0] = 'Continue without changing speed'
    const result = automaticallyEvaluate(answers, '', '')
    expect(result.score).toBe(97)
    expect(result.decision).toBe('NOT YET QUALIFIED')
  })
})

describe('validateResponsesShape', () => {
  it('accepts a complete response object', () => {
    expect(validateResponsesShape(perfect())).toBe(true)
  })
  it.each([
    ['short oral array', { ...perfect(), oral: ['x'] }],
    ['non-string answer', { ...perfect(), defects: 5 }],
    ['missing log', { ...perfect(), log: undefined }],
    ['null', null],
  ])('rejects %s', (_label, value) => {
    expect(validateResponsesShape(value)).toBe(false)
  })
})
