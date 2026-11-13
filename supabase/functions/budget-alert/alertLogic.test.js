import { describe, it, expect } from 'vitest'
import { evaluateBudgetCrossing, buildAlertEmail } from './alertLogic'

describe('evaluateBudgetCrossing', () => {
  it('fires "over" the moment spend crosses 100% of the limit', () => {
    expect(evaluateBudgetCrossing(4800, 5200, 5000)).toBe('over')
  })

  it('does not re-fire "over" on a later expense once already over', () => {
    // previousSpend is already past the limit before this expense
    expect(evaluateBudgetCrossing(5200, 5600, 5000)).toBeNull()
  })

  it('fires "near" the moment spend crosses 80% of the limit', () => {
    expect(evaluateBudgetCrossing(3900, 4100, 5000)).toBe('near')
  })

  it('does not re-fire "near" on a later expense once already near', () => {
    expect(evaluateBudgetCrossing(4100, 4300, 5000)).toBeNull()
  })

  it('jumping straight past both thresholds in one expense fires "over", not "near"', () => {
    // e.g. a single ₹2000 expense takes you from 70% to 110% in one go —
    // the person needs the urgent alert, not the early-warning one.
    expect(evaluateBudgetCrossing(3500, 5500, 5000)).toBe('over')
  })

  it('returns null when nowhere near a threshold', () => {
    expect(evaluateBudgetCrossing(1000, 1500, 5000)).toBeNull()
  })

  it('returns null for a zero or negative limit instead of dividing by zero', () => {
    expect(evaluateBudgetCrossing(0, 100, 0)).toBeNull()
    expect(evaluateBudgetCrossing(0, 100, -500)).toBeNull()
  })

  it('treats landing exactly on the threshold as crossing it', () => {
    expect(evaluateBudgetCrossing(4000, 5000, 5000)).toBe('over')
    expect(evaluateBudgetCrossing(3000, 4000, 5000)).toBe('near')
  })
})

describe('buildAlertEmail', () => {
  it('builds an "over budget" email with the category and amounts', () => {
    const { subject, body } = buildAlertEmail({
      level: 'over',
      category: 'Food',
      scopeName: null,
      spent: 5600,
      limit: 5000,
    })
    expect(subject).toBe('Over budget: Food')
    expect(body).toContain('₹5,600')
    expect(body).toContain('₹5,000')
  })

  it('builds a "near limit" email showing how much is left', () => {
    const { subject, body } = buildAlertEmail({
      level: 'near',
      category: 'Transport',
      scopeName: null,
      spent: 4100,
      limit: 5000,
    })
    expect(subject).toBe('Approaching your Transport budget')
    expect(body).toContain('₹900') // remaining
  })

  it('includes the household name in the subject and body when shared', () => {
    const { subject, body } = buildAlertEmail({
      level: 'over',
      category: 'Groceries',
      scopeName: 'Sharma Household',
      spent: 13000,
      limit: 12000,
    })
    expect(subject).toContain('Sharma Household')
    expect(body).toContain('Sharma Household')
  })

  it('never shows a negative "remaining" amount even if already over', () => {
    const { body } = buildAlertEmail({
      level: 'near',
      category: 'Shopping',
      scopeName: null,
      spent: 6000,
      limit: 5000,
    })
    expect(body).toContain('₹0')
    expect(body).not.toContain('-₹')
  })
})
