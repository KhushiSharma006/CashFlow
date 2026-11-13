import { describe, it, expect } from 'vitest'
import { formatCurrency, lastNMonths, monthKeyFromDate, colorForCategory, toLocalISODate } from './constants'

describe('toLocalISODate', () => {
  it('formats the local calendar date, not the UTC one', () => {
    // Constructed from local components, so the expected string is the same
    // in every timezone. The old toISOString() approach returns the
    // previous day here in any zone ahead of UTC (e.g. India).
    expect(toLocalISODate(new Date(2026, 0, 1, 0, 0, 0))).toBe('2026-01-01')
    expect(toLocalISODate(new Date(2026, 0, 1, 2, 30, 0))).toBe('2026-01-01')
  })

  it('does not roll late-evening times forward into the next day', () => {
    expect(toLocalISODate(new Date(2026, 5, 15, 23, 59, 0))).toBe('2026-06-15')
  })

  it('zero-pads month and day', () => {
    expect(toLocalISODate(new Date(2026, 2, 5))).toBe('2026-03-05')
  })

  it('handles month and year boundaries', () => {
    expect(toLocalISODate(new Date(2026, 11, 31))).toBe('2026-12-31')
    expect(toLocalISODate(new Date(2027, 0, 1))).toBe('2027-01-01')
  })
})

describe('formatCurrency', () => {
  it('formats a whole number as INR', () => {
    expect(formatCurrency(1000)).toBe('₹1,000.00')
  })

  it('formats a decimal amount', () => {
    expect(formatCurrency(450.5)).toBe('₹450.50')
  })

  it('treats a missing amount as zero', () => {
    expect(formatCurrency(undefined)).toBe('₹0.00')
  })

  it('uses Indian digit grouping for large numbers', () => {
    expect(formatCurrency(1234567)).toBe('₹12,34,567.00')
  })
})

describe('lastNMonths', () => {
  it('returns the requested number of months', () => {
    expect(lastNMonths(6)).toHaveLength(6)
  })

  it('returns months oldest-first, ending with the current month', () => {
    const months = lastNMonths(3)
    const now = new Date()
    const expectedCurrentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    expect(months[months.length - 1].key).toBe(expectedCurrentKey)
  })

  it('produces strictly increasing month keys', () => {
    const months = lastNMonths(4)
    const keys = months.map((m) => m.key)
    const sorted = [...keys].sort()
    expect(keys).toEqual(sorted)
  })
})

describe('monthKeyFromDate', () => {
  it('extracts a YYYY-MM key from a date string', () => {
    expect(monthKeyFromDate('2026-06-15')).toBe('2026-06')
  })
})

describe('colorForCategory', () => {
  it('returns a consistent color for a known category', () => {
    expect(colorForCategory('Food')).toBe(colorForCategory('Food'))
  })

  it('falls back to a default color for an unknown category', () => {
    expect(colorForCategory('NotARealCategory')).toBeTruthy()
  })
})
