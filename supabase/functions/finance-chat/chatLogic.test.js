import { describe, it, expect } from 'vitest'
import {
  validateChatRequest, buildFinanceContext, buildSystemPrompt,
  MAX_MESSAGES, MAX_MESSAGE_CHARS, MAX_RECENT_EXPENSES,
} from './chatLogic'

const TODAY = '2026-10-22'
const user = (content) => ({ role: 'user', content })

describe('validateChatRequest', () => {
  it('accepts a normal request', () => {
    const r = validateChatRequest({ messages: [user('hi')], today: TODAY })
    expect(r).toEqual({ ok: true, messages: [user('hi')], today: TODAY })
  })
  it.each([null, 'x', {}, { messages: [], today: TODAY }, { messages: [user('a')] }, { messages: [user('a')], today: '22/10/2026' }])(
    'rejects %j', (body) => expect(validateChatRequest(body).ok).toBe(false))
  it('rejects bad roles and non-string content', () => {
    expect(validateChatRequest({ messages: [{ role: 'system', content: 'x' }], today: TODAY }).ok).toBe(false)
    expect(validateChatRequest({ messages: [{ role: 'user', content: 5 }], today: TODAY }).ok).toBe(false)
  })
  it('requires the last message to be from the user', () => {
    expect(validateChatRequest({ messages: [user('a'), { role: 'assistant', content: 'b' }], today: TODAY }).ok).toBe(false)
  })
  it('keeps only the most recent messages and starts on a user turn', () => {
    const msgs = []
    for (let i = 0; i < 20; i++) msgs.push(i % 2 === 0 ? user(`u${i}`) : { role: 'assistant', content: `a${i}` })
    msgs.push(user('last'))
    const r = validateChatRequest({ messages: msgs, today: TODAY })
    expect(r.ok).toBe(true)
    expect(r.messages.length).toBeLessThanOrEqual(MAX_MESSAGES)
    expect(r.messages[0].role).toBe('user')
    expect(r.messages.at(-1).content).toBe('last')
  })
  it('truncates overlong messages and drops blank ones', () => {
    const r = validateChatRequest({ messages: [user('   '), user('x'.repeat(5000))], today: TODAY })
    expect(r.messages).toHaveLength(1)
    expect(r.messages[0].content).toHaveLength(MAX_MESSAGE_CHARS)
  })
})

describe('buildFinanceContext', () => {
  const expenses = [
    { amount: '450', category: 'Food', description: 'Lunch', expense_date: '2026-10-21' },
    { amount: 200, category: 'Food', description: null, expense_date: '2026-10-02' },
    { amount: 1000, category: 'Transport', description: 'Uber', expense_date: '2026-09-15' },
    { amount: 300, category: 'Food', description: 'Dinner', expense_date: '2026-09-10' },
    { amount: 999, category: 'Shopping', description: 'Old', expense_date: '2026-07-01' },
  ]
  const income = [
    { amount: 50000, source: 'Salary', income_date: '2026-10-01' },
    { amount: 40000, source: 'Salary', income_date: '2026-09-01' },
  ]
  const budgets = [
    { category: 'Food', monthly_limit: '1000', household_id: null },
    { category: 'Rent', monthly_limit: 0, household_id: null },
    { category: 'Food', monthly_limit: 5000, household_id: 'h1' },
  ]
  const ctx = buildFinanceContext({ expenses, income, budgets, today: TODAY })

  it('totals this and last month', () => {
    expect(ctx.thisMonth).toMatchObject({ month: '2026-10', spent: 650, income: 50000 })
    expect(ctx.thisMonth.spentByCategory).toEqual({ Food: 650 })
    expect(ctx.lastMonth).toMatchObject({ month: '2026-09', spent: 1300 })
    expect(ctx.lastMonth.spentByCategory).toEqual({ Transport: 1000, Food: 300 })
  })
  it('lists monthly totals chronologically', () => {
    expect(Object.keys(ctx.monthlyExpenseTotals)).toEqual(['2026-07', '2026-09', '2026-10'])
  })
  it('reports personal budget usage only and tolerates a zero limit', () => {
    expect(ctx.budgets).toEqual([
      { category: 'Food', limit: 1000, spent: 650, percentUsed: 65 },
      { category: 'Rent', limit: 0, spent: 0, percentUsed: null },
    ])
  })
  it('wraps the previous month across a year boundary', () => {
    expect(buildFinanceContext({ today: '2027-01-05' }).lastMonth.month).toBe('2026-12')
  })
  it('sends recent expenses newest-first and bounded', () => {
    expect(ctx.recentExpenses[0]).toEqual({ date: '2026-10-21', amount: 450, category: 'Food', description: 'Lunch' })
    const many = Array.from({ length: 100 }, (_, i) => ({ amount: 1, category: 'Food', expense_date: `2026-10-${String(1 + (i % 28)).padStart(2, '0')}` }))
    expect(buildFinanceContext({ expenses: many, today: TODAY }).recentExpenses).toHaveLength(MAX_RECENT_EXPENSES)
  })
  it('handles an empty account', () => {
    const e = buildFinanceContext({ today: TODAY })
    expect(e.thisMonth.spent).toBe(0)
    expect(e.recentExpenses).toEqual([])
  })
})

describe('buildSystemPrompt', () => {
  it('embeds the data and the grounding rules', () => {
    const p = buildSystemPrompt({ today: TODAY, marker: 'abc123' })
    expect(p).toContain('abc123')
    expect(p).toContain('ONLY from the JSON data')
  })
})
