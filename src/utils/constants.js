export const EXPENSE_CATEGORIES = [
  'Food',
  'Transport',
  'Housing',
  'Utilities',
  'Health',
  'Entertainment',
  'Shopping',
  'Education',
  'Subscriptions',
  'Other',
]

export const CATEGORY_COLORS = {
  Food: '#A9812C',
  Transport: '#4C6B57',
  Housing: '#9A4430',
  Utilities: '#6B7A8F',
  Health: '#7A5C8A',
  Entertainment: '#B0673E',
  Shopping: '#5C7A9A',
  Education: '#4C7A6B',
  Subscriptions: '#8A6E4C',
  Other: '#7A7264',
}

export function colorForCategory(category) {
  return CATEGORY_COLORS[category] || '#7A7264'
}

export const FREQUENCIES = ['weekly', 'monthly', 'yearly']

export function formatCurrency(amount, currency = 'INR') {
  const value = Number(amount || 0)
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function monthLabel(year, monthIndex) {
  return new Date(year, monthIndex, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}

/** Returns [{key: 'YYYY-MM', label, year, month}] for the last n months, oldest first */
export function lastNMonths(n = 6) {
  const out = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: monthLabel(d.getFullYear(), d.getMonth()),
      year: d.getFullYear(),
      month: d.getMonth(),
    })
  }
  return out
}

export function monthKeyFromDate(dateStr) {
  return dateStr.slice(0, 7)
}
