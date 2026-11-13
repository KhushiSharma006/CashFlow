import { describe, it, expect } from 'vitest'
import {
  linearRegression,
  forecastNextMonth,
  projectMonthEnd,
  detectCategoryAnomalies,
} from './insights'

describe('linearRegression', () => {
  it('fits a perfect line exactly', () => {
    const xs = [0, 1, 2, 3, 4]
    const ys = [10, 20, 30, 40, 50]
    const { slope, intercept, predict, r2 } = linearRegression(xs, ys)

    expect(slope).toBeCloseTo(10)
    expect(intercept).toBeCloseTo(10)
    expect(predict(5)).toBeCloseTo(60)
    expect(r2).toBeCloseTo(1)
  })

  it('returns a flat line with zero slope for constant data', () => {
    const { slope, predict } = linearRegression([0, 1, 2], [500, 500, 500])
    expect(slope).toBeCloseTo(0)
    expect(predict(10)).toBeCloseTo(500)
  })

  it('handles an empty series without throwing', () => {
    const { slope, intercept, r2 } = linearRegression([], [])
    expect(slope).toBe(0)
    expect(intercept).toBe(0)
    expect(r2).toBe(0)
  })
})

describe('forecastNextMonth', () => {
  it('forecasts upward for a rising trend', () => {
    const { forecast, trend, r2 } = forecastNextMonth([10000, 10500, 11200, 11800, 12500])
    expect(trend).toBe('up')
    expect(forecast).toBeGreaterThan(12500)
    expect(r2).toBeGreaterThan(0.9)
  })

  it('forecasts downward for a falling trend', () => {
    const { trend, forecast } = forecastNextMonth([20000, 18000, 16000, 14000])
    expect(trend).toBe('down')
    expect(forecast).toBeLessThan(14000)
  })

  it('calls a roughly constant series "flat"', () => {
    const { trend } = forecastNextMonth([5000, 5050, 4980, 5020])
    expect(trend).toBe('flat')
  })

  it('never forecasts a negative amount', () => {
    const { forecast } = forecastNextMonth([1000, 500, 100])
    expect(forecast).toBeGreaterThanOrEqual(0)
  })

  it('returns null when there is not enough history', () => {
    const { forecast } = forecastNextMonth([5000])
    expect(forecast).toBeNull()
  })
})

describe('projectMonthEnd', () => {
  it('projects a full 30-day month from 10 days of spend', () => {
    const referenceDate = new Date(2026, 5, 10) // June 10, 2026 — 30-day month
    const projected = projectMonthEnd(5000, referenceDate)
    expect(projected).toBeCloseTo(15000)
  })

  it('returns the spend itself on the last day of the month', () => {
    const referenceDate = new Date(2026, 5, 30) // June 30 — last day, 30-day month
    const projected = projectMonthEnd(9000, referenceDate)
    expect(projected).toBeCloseTo(9000)
  })
})

describe('detectCategoryAnomalies', () => {
  it('flags a category running well above its own average', () => {
    const history = { Food: [2800, 3100, 2950, 3200] }
    const projected = { Food: 6000 }

    const result = detectCategoryAnomalies(history, projected)

    expect(result).toHaveLength(1)
    expect(result[0].category).toBe('Food')
    expect(result[0].pctAboveAvg).toBeGreaterThan(50)
  })

  it('does not flag a category spending close to its average', () => {
    const history = { Transport: [1200, 1300, 1250, 1180] }
    const projected = { Transport: 1220 }

    expect(detectCategoryAnomalies(history, projected)).toHaveLength(0)
  })

  it('skips categories with insufficient history', () => {
    const history = { NewCategory: [500] }
    const projected = { NewCategory: 5000 }

    expect(detectCategoryAnomalies(history, projected)).toHaveLength(0)
  })

  it('ignores small absolute gaps even if percentage-wise large', () => {
    const history = { Misc: [50, 60, 55, 52] }
    const projected = { Misc: 120 } // +~120% but only ~₹65 over

    expect(detectCategoryAnomalies(history, projected)).toHaveLength(0)
  })

  it('sorts multiple anomalies by severity (z-score), worst first', () => {
    // Both categories have the same variance, but Shopping's overspend is
    // many more standard deviations from its own mean than Food's.
    const history = { Food: [2900, 3000, 3100, 3000], Shopping: [1900, 2000, 2100, 2000] }
    const projected = { Food: 4000, Shopping: 8000 }

    const result = detectCategoryAnomalies(history, projected)
    expect(result[0].category).toBe('Shopping')
    expect(result[1].category).toBe('Food')
    expect(result[0].zScore).toBeGreaterThan(result[1].zScore)
  })
})
