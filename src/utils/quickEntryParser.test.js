import { describe, it, expect } from 'vitest'
import {
  parseQuickEntry,
  extractDate,
  extractAmount,
  guessCategory,
  isQuestion,
  CATEGORY_KEYWORDS,
} from './quickEntryParser'
import { EXPENSE_CATEGORIES } from './constants'

// Thursday, 22 October 2026. Built from local components so every expected
// date below is identical in every timezone.
const TODAY = new Date(2026, 9, 22)
const parse = (text) => parseQuickEntry(text, TODAY)

describe('expense parsing: the basics', () => {
  it('parses amount, category, description and defaults the date to today', () => {
    expect(parse('spent 450 on lunch')).toEqual({
      kind: 'expense', amount: 450, category: 'Food', description: 'Lunch', date: '2026-10-22',
    })
  })

  it('parses a rupee symbol, thousands separators and "yesterday"', () => {
    expect(parse('₹1,200 uber yesterday')).toEqual({
      kind: 'expense', amount: 1200, category: 'Transport', description: 'Uber', date: '2026-10-21',
    })
  })

  it('keeps the original casing of the description text', () => {
    expect(parse('paid 320 for DMart groceries').description).toBe('DMart groceries')
  })

  it('falls back to category Other when nothing matches', () => {
    expect(parse('spent 80 on xyzzy').category).toBe('Other')
  })
})

describe('amount formats', () => {
  it('reads "k" suffixes', () => {
    expect(parse('1.5k groceries').amount).toBe(1500)
    expect(parse('spent 2k on shoes').amount).toBe(2000)
  })

  it('reads lakh suffixes', () => {
    expect(parse('paid 2 lakh tuition').amount).toBe(200000)
    expect(parse('paid 1.5 lakh for fees').amount).toBe(150000)
  })

  it('reads "450/-" and "450 rupees" and "rs. 450"', () => {
    expect(parse('lunch 450/-').amount).toBe(450)
    expect(parse('lunch 450 rupees').amount).toBe(450)
    expect(parse('lunch rs. 450').amount).toBe(450)
    expect(parse('lunch inr 450').amount).toBe(450)
  })

  it('reads decimals', () => {
    expect(parse('coffee 149.50').amount).toBe(149.5)
  })

  it('prefers the currency-marked number over a quantity', () => {
    const r = parse('3 sandwiches for rs 450')
    expect(r.amount).toBe(450)
    expect(r.description).toBe('3 sandwiches')
  })

  it('takes the larger bare number so quantities do not win', () => {
    const r = parse('spent 450 on 3 sandwiches')
    expect(r.amount).toBe(450)
    expect(r.description).toBe('3 sandwiches')
  })

  it('does not treat a weight like "5 kg" as 5 thousand', () => {
    expect(parse('bought 5 kg rice for 300').amount).toBe(300)
  })

  it('rejects zero and absurd amounts', () => {
    expect(extractAmount('spent 0 on nothing')).toBeNull()
    expect(extractAmount('no numbers here')).toBeNull()
  })
})

describe('date parsing (relative to Thursday 22 Oct 2026)', () => {
  it('today', () => {
    expect(parse('coffee 80 today').date).toBe('2026-10-22')
  })

  it('day before yesterday', () => {
    expect(parse('coffee 80 day before yesterday').date).toBe('2026-10-20')
  })

  it('N days ago, without confusing the number with the amount', () => {
    const r = parse('coffee 120 3 days ago')
    expect(r.date).toBe('2026-10-19')
    expect(r.amount).toBe(120)
  })

  it('a week ago / two weeks ago', () => {
    expect(parse('rent 500 a week ago').date).toBe('2026-10-15')
    expect(parse('rent 500 two weeks ago').date).toBe('2026-10-08')
  })

  it('last friday and on monday', () => {
    expect(parse('movie tickets 600 last friday').date).toBe('2026-10-16')
    expect(parse('dinner 800 on monday').date).toBe('2026-10-19')
  })

  it('"on thursday" on a Thursday is today, but "last thursday" is a week ago', () => {
    expect(parse('lunch 100 on thursday').date).toBe('2026-10-22')
    expect(parse('lunch 100 last thursday').date).toBe('2026-10-15')
  })

  it('only treats a weekday abbreviation as a date when prefixed', () => {
    expect(extractDate('bought sat nav 500', TODAY).date).toBeNull()
    expect(extractDate('lunch 200 on sat', TODAY).date).toEqual(new Date(2026, 9, 17))
  })

  it('an ordinal in the current month', () => {
    const r = parse('paid 12000 rent on 1st')
    expect(r.date).toBe('2026-10-01')
    expect(r.category).toBe('Housing')
  })

  it('an ordinal later than today means last month', () => {
    const r = parse('paid 500 on 25th for electricity')
    expect(r.date).toBe('2026-09-25')
    expect(r.category).toBe('Utilities')
  })

  it('an ordinal in January looking back crosses into the previous year', () => {
    const jan10 = new Date(2027, 0, 10)
    expect(parseQuickEntry('paid 500 on 25th for rent', jan10).date).toBe('2026-12-25')
  })

  it('day + month name', () => {
    const r = parse('bought shoes for rs 2,499 on 3 march')
    expect(r.date).toBe('2026-03-03')
    expect(r.amount).toBe(2499)
    expect(r.category).toBe('Shopping')
  })

  it('month name + day, with ordinal', () => {
    expect(parse('lunch 200 on march 3rd').date).toBe('2026-03-03')
  })

  it('a month/day still in the future this year means last year', () => {
    expect(parse('gift 1000 on 10 nov').date).toBe('2025-11-10')
  })

  it('an explicit year is respected', () => {
    expect(parse('gift 1000 on 10 nov 2024').date).toBe('2024-11-10')
  })

  it('dd/mm is day-first, with or without a year', () => {
    expect(parse('15/10 petrol 2000').date).toBe('2026-10-15')
    expect(parse('petrol 2000 15/10/2026').date).toBe('2026-10-15')
    expect(parse('petrol 2000 05-03-25').date).toBe('2025-03-05')
  })

  it('ISO dates', () => {
    expect(parse('2026-09-30 rent 15000').date).toBe('2026-09-30')
  })

  it('an impossible date is ignored rather than guessed', () => {
    const r = parse('lunch 100 on 31 feb')
    expect(r.date).toBe('2026-10-22')
    expect(r.amount).toBe(100)
  })

  it('"450/-" is not mistaken for a date', () => {
    const r = parse('lunch 450/-')
    expect(r.amount).toBe(450)
    expect(r.date).toBe('2026-10-22')
  })

  it('"on 450" is not mistaken for an ordinal date', () => {
    const r = parse('spent on 450 lunch')
    expect(r.amount).toBe(450)
    expect(r.date).toBe('2026-10-22')
  })
})

describe('categories', () => {
  it.each([
    ['netflix 649', 'Subscriptions'],
    ['medicine 250 at pharmacy', 'Health'],
    ['uber 300', 'Transport'],
    ['zomato 540', 'Food'],
    ['wifi bill 999', 'Utilities'],
    ['amazon headphones 1999', 'Shopping'],
    ['udemy course 499', 'Education'],
    ['movie 300', 'Entertainment'],
  ])('"%s" -> %s', (text, expected) => {
    expect(parse(text).category).toBe(expected)
  })

  it('matches whole words only', () => {
    // "taxing" must not match "tax"/"taxi"; "autonomy" must not match "auto"
    expect(guessCategory('autonomy')).toBe('Other')
    expect(guessCategory('taxing day')).toBe('Other')
  })

  it('handles plurals', () => {
    expect(guessCategory('3 taxis')).toBe('Transport')
  })

  it('every category the parser can return exists in the app', () => {
    for (const category of Object.keys(CATEGORY_KEYWORDS)) {
      expect(EXPENSE_CATEGORIES).toContain(category)
    }
  })
})

describe('income vs expense', () => {
  it('"received salary 50000" is income with a Salary source', () => {
    expect(parse('received salary 50000')).toMatchObject({ kind: 'income', amount: 50000, source: 'Salary' })
  })

  it('a bare income noun is income', () => {
    expect(parse('stipend 12000').kind).toBe('income')
  })

  it('"got paid" is income', () => {
    expect(parse('got paid 8000 for freelance work yesterday')).toMatchObject({
      kind: 'income', amount: 8000, source: 'Freelance', date: '2026-10-21',
    })
  })

  it('"paid salary to the maid" is an expense, not income', () => {
    expect(parse('paid salary to the maid 5000').kind).toBe('expense')
  })

  it('"paid income tax" is an expense', () => {
    expect(parse('paid income tax 20000').kind).toBe('expense')
  })

  it('falls back to a generic source when none is named', () => {
    expect(parse('received 700')).toMatchObject({ kind: 'income', source: 'Other income' })
  })

  it('"got <amount> from <someone>" is income', () => {
    expect(parse('got 500 from dad')).toMatchObject({ kind: 'income', amount: 500, source: 'From dad' })
  })

  it('"got" followed by something other than an amount-then-from is still an expense', () => {
    expect(parse('got coffee 50').kind).toBe('expense')
    expect(parse('got 2 coffees for 100').kind).toBe('expense')
    expect(parse('got 2 coffees for 100').amount).toBe(100)
  })
})

describe('descriptions', () => {
  it('keeps meaningful connecting words like "with" and "to"', () => {
    expect(parse('lunch with friends 450 yesterday').description).toBe('Lunch with friends')
    expect(parse('uber 250 to office on friday').description).toBe('Uber to office')
  })

  it('is empty when nothing but an amount was given', () => {
    expect(parse('spent ₹300')).toMatchObject({ kind: 'expense', amount: 300, description: '', category: 'Other' })
  })

  it('does not treat a time like 8pm as an amount', () => {
    const r = parse('dinner at 8pm 700')
    expect(r.amount).toBe(700)
  })

  it('reads Indian digit grouping', () => {
    expect(parse('spent 1,50,000 on laptop')).toMatchObject({ amount: 150000, category: 'Shopping' })
  })
})

describe('questions and non-entries', () => {
  it.each([
    'how much did I spend on food?',
    "What's my biggest expense",
    'show me last month spending',
    'am i over budget',
    'which category is growing fastest',
    'paid 500 for dinner?',
  ])('"%s" is a question', (text) => {
    expect(parse(text).kind).toBe('question')
    expect(isQuestion(text)).toBe(true)
  })

  it('"spent 450 on food" is not a question', () => {
    expect(isQuestion('spent 450 on food')).toBe(false)
  })

  it('text with no amount is unknown, so it can go to the chat', () => {
    expect(parse('hello there').kind).toBe('unknown')
    expect(parse('bought groceries').kind).toBe('unknown')
  })

  it('empty or missing input is empty', () => {
    expect(parse('').kind).toBe('empty')
    expect(parse('   ').kind).toBe('empty')
    expect(parseQuickEntry(undefined, TODAY).kind).toBe('empty')
  })
})
