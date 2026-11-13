import { describe, it, expect } from 'vitest'
import { buildExpensesCSV } from './csvExport'

describe('buildExpensesCSV', () => {
  it('includes a header row', () => {
    const csv = buildExpensesCSV([])
    expect(csv).toBe('"Date","Category","Description","Amount"')
  })

  it('formats a single expense row correctly', () => {
    const csv = buildExpensesCSV([
      { expense_date: '2026-06-01', category: 'Food', description: 'Groceries', amount: 450 },
    ])
    const lines = csv.split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[1]).toBe('"2026-06-01","Food","Groceries","450"')
  })

  it('escapes double quotes inside a description', () => {
    const csv = buildExpensesCSV([
      { expense_date: '2026-06-01', category: 'Shopping', description: 'New "running" shoes', amount: 2000 },
    ])
    expect(csv).toContain('"New ""running"" shoes"')
  })

  it('handles a missing description gracefully', () => {
    const csv = buildExpensesCSV([
      { expense_date: '2026-06-01', category: 'Other', description: null, amount: 100 },
    ])
    expect(csv).toContain('"2026-06-01","Other","","100"')
  })

  it('preserves row order', () => {
    const csv = buildExpensesCSV([
      { expense_date: '2026-06-01', category: 'A', description: '', amount: 1 },
      { expense_date: '2026-06-02', category: 'B', description: '', amount: 2 },
    ])
    const lines = csv.split('\n')
    expect(lines[1]).toContain('"A"')
    expect(lines[2]).toContain('"B"')
  })
})
