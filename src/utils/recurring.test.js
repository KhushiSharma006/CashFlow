import { describe, it, expect } from 'vitest'
import { addInterval, computeDueDates } from './recurring'

describe('addInterval', () => {
  it('adds 7 days for weekly', () => {
    expect(addInterval('2026-01-01', 'weekly')).toBe('2026-01-08')
  })

  it('adds 1 month for monthly', () => {
    expect(addInterval('2026-01-15', 'monthly')).toBe('2026-02-15')
  })

  it('adds 1 year for yearly', () => {
    expect(addInterval('2026-03-10', 'yearly')).toBe('2027-03-10')
  })

  it('rolls over correctly across a year boundary', () => {
    expect(addInterval('2026-12-20', 'weekly')).toBe('2026-12-27')
    expect(addInterval('2026-12-20', 'monthly')).toBe('2027-01-20')
  })
})

describe('computeDueDates', () => {
  it('generates nothing when the first occurrence is still in the future', () => {
    const { dueDates } = computeDueDates(
      { lastGenerated: null, startDate: '2026-12-01', frequency: 'monthly' },
      '2026-06-01'
    )
    expect(dueDates).toEqual([])
  })

  it('generates the first occurrence on its start date', () => {
    const { dueDates, newLastGenerated } = computeDueDates(
      { lastGenerated: null, startDate: '2026-06-01', frequency: 'monthly' },
      '2026-06-01'
    )
    expect(dueDates).toEqual(['2026-06-01'])
    expect(newLastGenerated).toBe('2026-06-01')
  })

  it('catches up on multiple missed monthly occurrences', () => {
    const { dueDates, newLastGenerated } = computeDueDates(
      { lastGenerated: '2026-01-01', startDate: '2026-01-01', frequency: 'monthly' },
      '2026-04-15'
    )
    // Should generate Feb, Mar, Apr — not skip the gap
    expect(dueDates).toEqual(['2026-02-01', '2026-03-01', '2026-04-01'])
    expect(newLastGenerated).toBe('2026-04-01')
  })

  it('does not duplicate an occurrence already generated', () => {
    const { dueDates } = computeDueDates(
      { lastGenerated: '2026-04-01', startDate: '2026-01-01', frequency: 'monthly' },
      '2026-04-01'
    )
    expect(dueDates).toEqual([])
  })

  it('leaves last_generated unchanged when nothing is due', () => {
    const { newLastGenerated } = computeDueDates(
      { lastGenerated: '2026-04-01', startDate: '2026-01-01', frequency: 'monthly' },
      '2026-04-10'
    )
    expect(newLastGenerated).toBe('2026-04-01')
  })

  it('caps iterations so a very old template cannot loop unboundedly', () => {
    const { dueDates } = computeDueDates(
      { lastGenerated: null, startDate: '2000-01-01', frequency: 'weekly' },
      '2026-01-01'
    )
    expect(dueDates.length).toBeLessThanOrEqual(36)
  })
})
