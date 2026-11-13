/**
 * Lightweight statistical modeling for the Insights page — no external
 * ML library needed, just the underlying math, computed client-side from
 * data already fetched from Supabase.
 *
 * Two techniques are used:
 *  1. Ordinary least squares linear regression, to forecast next month's
 *     total spend from the trend in recent months.
 *  2. Z-score anomaly detection, to flag categories where this month's
 *     (run-rate projected) spend is unusually high relative to that
 *     category's own historical mean/std deviation.
 */

/** Ordinary least squares fit for y = slope*x + intercept. */
export function linearRegression(xs, ys) {
  const n = xs.length
  if (n === 0) return { slope: 0, intercept: 0, predict: () => 0, r2: 0 }

  const sumX = xs.reduce((a, b) => a + b, 0)
  const sumY = ys.reduce((a, b) => a + b, 0)
  const sumXY = xs.reduce((sum, x, i) => sum + x * ys[i], 0)
  const sumXX = xs.reduce((sum, x) => sum + x * x, 0)

  const denom = n * sumXX - sumX * sumX
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n

  const predict = (x) => slope * x + intercept

  const yMean = sumY / n
  const ssTot = ys.reduce((sum, y) => sum + (y - yMean) ** 2, 0)
  const ssRes = ys.reduce((sum, y, i) => sum + (y - predict(xs[i])) ** 2, 0)
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot)

  return { slope, intercept, predict, r2 }
}

/**
 * Forecasts next month's total spend from a trailing series of monthly
 * totals (oldest first). Needs at least 2 months of data to fit a line.
 */
export function forecastNextMonth(monthlyTotals) {
  if (monthlyTotals.length < 2) return { forecast: null, r2: 0, trend: 'flat' }

  const xs = monthlyTotals.map((_, i) => i)
  const ys = monthlyTotals
  const { slope, predict, r2 } = linearRegression(xs, ys)
  const forecast = Math.max(0, predict(monthlyTotals.length))

  let trend = 'flat'
  const avg = ys.reduce((a, b) => a + b, 0) / ys.length
  if (avg > 0) {
    const relSlope = slope / avg
    if (relSlope > 0.05) trend = 'up'
    else if (relSlope < -0.05) trend = 'down'
  }

  return { forecast, r2, trend }
}

/**
 * Projects a full-month total from partial-month spend using a simple
 * run-rate: (spent so far / days elapsed) * days in month. This is the
 * same logic analysts use for "pace" projections.
 */
export function projectMonthEnd(spentSoFar, referenceDate = new Date()) {
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth()
  const dayOfMonth = Math.max(1, referenceDate.getDate())
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  return (spentSoFar / dayOfMonth) * daysInMonth
}

/**
 * Flags categories whose projected spend this month is a statistical
 * outlier relative to that category's own trailing history.
 *
 * history: { [category]: number[] }  — past months' totals, oldest first
 * currentProjected: { [category]: number } — this month's run-rate projection
 */
export function detectCategoryAnomalies(history, currentProjected, {
  minHistoryMonths = 2,
  zThreshold = 1.3,
  minRupeeGap = 200,
} = {}) {
  const results = []

  for (const category of Object.keys(currentProjected)) {
    const past = history[category] || []
    if (past.length < minHistoryMonths) continue

    const mean = past.reduce((a, b) => a + b, 0) / past.length
    const variance = past.reduce((sum, v) => sum + (v - mean) ** 2, 0) / past.length
    const std = Math.sqrt(variance)

    const current = currentProjected[category] || 0
    const gap = current - mean

    if (gap <= minRupeeGap) continue

    const zScore = std === 0 ? (gap > 0 ? 99 : 0) : gap / std
    if (zScore < zThreshold) continue

    const pctAboveAvg = mean > 0 ? (gap / mean) * 100 : 100

    results.push({ category, mean, current, zScore, pctAboveAvg })
  }

  return results.sort((a, b) => b.zScore - a.zScore)
}
