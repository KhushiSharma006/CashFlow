/**
 * Pure logic for the budget-alert Edge Function — deliberately has no
 * Deno, Supabase, or network imports so it can be unit-tested with Vitest
 * exactly like any other module in this project, and reused unchanged
 * inside the actual edge function (Deno can import plain ES modules).
 */

/**
 * Decides whether this expense just pushed spend across an alert
 * threshold for the first time this month — not on every expense after
 * you're already over, only on the crossing itself, so one expense
 * produces at most one email.
 *
 * Returns 'over' | 'near' | null
 */
export function evaluateBudgetCrossing(previousSpend, newSpend, limit) {
  if (!(limit > 0)) return null

  const prevPct = previousSpend / limit
  const newPct = newSpend / limit

  if (prevPct < 1 && newPct >= 1) return 'over'
  if (prevPct < 0.8 && newPct >= 0.8) return 'near'
  return null
}

function formatCurrency(amount, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

/** Builds the subject/body for an alert email. Pure — no sending here. */
export function buildAlertEmail({ level, category, scopeName, spent, limit, currency = 'INR' }) {
  const scopeSuffix = scopeName ? ` (${scopeName})` : ''
  const spentFmt = formatCurrency(spent, currency)
  const limitFmt = formatCurrency(limit, currency)

  if (level === 'over') {
    return {
      subject: `Over budget: ${category}${scopeSuffix}`,
      body: `You've spent ${spentFmt} on ${category} this month — over your ${limitFmt} budget${scopeSuffix}.`,
    }
  }

  const remaining = formatCurrency(Math.max(0, limit - spent), currency)
  return {
    subject: `Approaching your ${category} budget${scopeSuffix}`,
    body: `You've spent ${spentFmt} on ${category} this month — ${remaining} left before you hit your ${limitFmt} budget${scopeSuffix}.`,
  }
}
