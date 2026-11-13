/**
 * Natural-language quick-add parser.
 *
 *   "spent 450 on lunch yesterday"   -> expense, 450, Food, yesterday
 *   "paid 12000 rent on 1st"         -> expense, 12000, Housing, the 1st
 *   "received salary 50000"          -> income,  50000, Salary
 *   "how much did I spend on food?"  -> question (goes to the chat)
 *
 * Pure and rule-based: no network, no API key, no cost, and fully
 * unit-testable. Every result is shown to the person in a confirm card
 * before anything is saved, so a wrong guess costs one tap, not bad data.
 *
 * Amounts are INR-style: ₹/rs/inr prefixes, "450/-", and k / lakh suffixes.
 * Dates are day-first (15/10 is 15 October), matching how people in India
 * write them.
 */

import { EXPENSE_CATEGORIES, toLocalISODate } from './constants'

// ---------------------------------------------------------------- categories

// Order matters only for ties: the category with the most keyword hits wins,
// and on equal hits the earlier one in this object wins.
export const CATEGORY_KEYWORDS = {
  Food: [
    'lunch', 'dinner', 'breakfast', 'brunch', 'snack', 'snacks', 'meal', 'food',
    'grocery', 'groceries', 'vegetables', 'fruits', 'milk', 'coffee', 'tea', 'chai',
    'pizza', 'burger', 'sandwich', 'biryani', 'restaurant', 'cafe', 'swiggy', 'zomato',
    'dominos', 'mcdonalds', 'kfc', 'dmart', 'bigbasket', 'blinkit', 'zepto', 'juice',
    'icecream', 'ice cream', 'dessert', 'takeaway', 'canteen', 'mess',
  ],
  Transport: [
    'uber', 'ola', 'rapido', 'auto', 'cab', 'taxi', 'bus', 'metro', 'train', 'petrol',
    'diesel', 'fuel', 'parking', 'toll', 'flight', 'airfare', 'ticket fare', 'bike',
    'commute', 'irctc', 'rickshaw',
  ],
  Housing: ['rent', 'maintenance', 'society', 'deposit', 'mortgage', 'furniture', 'plumber', 'electrician'],
  Utilities: [
    'electricity', 'electric', 'water bill', 'wifi', 'internet', 'broadband', 'recharge',
    'mobile bill', 'phone bill', 'gas', 'cylinder', 'bill', 'postpaid', 'prepaid', 'dth',
  ],
  Health: [
    'medicine', 'medicines', 'doctor', 'pharmacy', 'hospital', 'clinic', 'dentist',
    'checkup', 'medical', 'lab test', 'vitamins', 'gym', 'physio',
  ],
  Entertainment: [
    'movie', 'movies', 'cinema', 'concert', 'game', 'games', 'gaming', 'party', 'outing',
    'bowling', 'club', 'pub', 'show tickets', 'amusement', 'trip',
  ],
  Shopping: [
    'clothes', 'shirt', 'tshirt', 't-shirt', 'jeans', 'shoes', 'sneakers', 'dress', 'amazon',
    'flipkart', 'myntra', 'shopping', 'bag', 'watch', 'gift', 'headphones', 'earphones',
    'charger', 'cosmetics', 'makeup', 'salon', 'haircut', 'laptop', 'tablet',
  ],
  Education: [
    'book', 'books', 'course', 'tuition', 'fees', 'fee', 'exam', 'udemy', 'coursera',
    'stationery', 'notebook', 'college', 'school', 'coaching', 'workshop', 'printout',
  ],
  Subscriptions: [
    'netflix', 'spotify', 'prime', 'hotstar', 'youtube premium', 'subscription', 'icloud',
    'chatgpt', 'membership', 'sonyliv', 'zee5', 'audible',
  ],
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const CATEGORY_MATCHERS = Object.entries(CATEGORY_KEYWORDS).map(([category, words]) => ({
  category,
  patterns: words.map((w) => new RegExp(`(?<![a-z])${escapeRegex(w)}(?:s|es)?(?![a-z])`, 'i')),
}))

export function guessCategory(text) {
  let best = { category: 'Other', hits: 0 }
  for (const { category, patterns } of CATEGORY_MATCHERS) {
    const hits = patterns.reduce((n, re) => n + (re.test(text) ? 1 : 0), 0)
    if (hits > best.hits && EXPENSE_CATEGORIES.includes(category)) best = { category, hits }
  }
  return best.category
}

// -------------------------------------------------------- question detection

const QUESTION_START =
  /^\s*(how|what|what's|whats|why|when|where|which|who|show|list|compare|tell|give|summari[sz]e|explain|analy[sz]e|am i|are my|is my|are we|can i|should i|do i|did i|have i|help)\b/i

export function isQuestion(text) {
  return /\?\s*$/.test(text) || QUESTION_START.test(text)
}

// -------------------------------------------------------------------- dates

const MONTHS = {
  january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3, may: 4,
  june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7, september: 8, sept: 8, sep: 8,
  october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11,
}
const WEEKDAYS = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2, wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4, friday: 5, fri: 5, saturday: 6, sat: 6,
}
const MONTH_ALT = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|')
const WEEKDAY_ALT = Object.keys(WEEKDAYS).sort((a, b) => b.length - a.length).join('|')
const NUMBER_WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5 }

const SKIP = Symbol('skip')

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function daysBefore(today, n) {
  const t = startOfDay(today)
  return new Date(t.getFullYear(), t.getMonth(), t.getDate() - n)
}

/** Returns a Date only if the components are a real calendar date (no Feb 30). */
function makeDate(year, month, day) {
  const d = new Date(year, month, day)
  return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day ? d : null
}

/** A day+month with no year means the most recent such date that isn't in the future. */
function resolveDayMonth(day, month, explicitYear, today) {
  const t = startOfDay(today)
  if (explicitYear) return makeDate(explicitYear, month, day)
  let d = makeDate(t.getFullYear(), month, day)
  if (d && d > t) d = makeDate(t.getFullYear() - 1, month, day)
  return d
}

const DATE_PATTERNS = [
  {
    // 2026-10-15
    re: /(?<![\d-])(\d{4})-(\d{2})-(\d{2})(?![\d-])/,
    build: (m) => makeDate(+m[1], +m[2] - 1, +m[3]),
  },
  {
    // 15/10, 15-10, 15/10/2026 (day first)
    re: /(?<![\d/.-])(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?(?![\d/-])/,
    build: (m, today) => {
      const year = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : null
      return resolveDayMonth(+m[1], +m[2] - 1, year, today)
    },
  },
  { re: /\bday before yesterday\b/i, build: (_m, today) => daysBefore(today, 2) },
  { re: /\byesterday\b/i, build: (_m, today) => daysBefore(today, 1) },
  { re: /\b(?:today|tonight|this (?:morning|afternoon|evening))\b/i, build: (_m, today) => startOfDay(today) },
  {
    // 3 days ago, a week ago
    re: /\b(\d+|a|an|one|two|three|four|five)\s+(day|days|week|weeks)\s+ago\b/i,
    build: (m, today) => {
      const n = /^\d+$/.test(m[1]) ? +m[1] : NUMBER_WORDS[m[1].toLowerCase()]
      return daysBefore(today, /^week/i.test(m[2]) ? n * 7 : n)
    },
  },
  {
    // last friday, on monday, this tue
    re: new RegExp(`\\b(?:(last|this|on)\\s+)?(${WEEKDAY_ALT})\\b`, 'i'),
    build: (m, today) => {
      const prefix = m[1]?.toLowerCase()
      const name = m[2].toLowerCase()
      // Full names ("monday") count on their own. Abbreviations ("mon", "sat",
      // "sun") only count with a prefix ("on sat"), since they double as words.
      if (!prefix && name.length < 6) return SKIP
      const delta = (startOfDay(today).getDay() - WEEKDAYS[name] + 7) % 7
      return daysBefore(today, prefix === 'last' && delta === 0 ? 7 : delta)
    },
  },
  {
    // 3 march, 3rd of march 2026
    re: new RegExp(`(?<![\\d,.])(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_ALT})\\b(?:\\s*,?\\s*(\\d{4}))?`, 'i'),
    build: (m, today) => resolveDayMonth(+m[1], MONTHS[m[2].toLowerCase()], m[3] ? +m[3] : null, today),
  },
  {
    // march 3, march 3rd 2026
    re: new RegExp(`\\b(${MONTH_ALT})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?!\\d)(?:\\s*,?\\s*(\\d{4}))?`, 'i'),
    build: (m, today) => resolveDayMonth(+m[2], MONTHS[m[1].toLowerCase()], m[3] ? +m[3] : null, today),
  },
  {
    // on the 5th, 5th  (the ordinal suffix is required so "on 450" is never a date)
    re: /(?<![\d,.])(\d{1,2})(?:st|nd|rd|th)\b/i,
    build: (m, today) => {
      const t = startOfDay(today)
      const day = +m[1]
      const thisMonth = makeDate(t.getFullYear(), t.getMonth(), day)
      if (thisMonth && thisMonth <= t) return thisMonth
      const prevMonth = t.getMonth() === 0 ? 11 : t.getMonth() - 1
      const prevYear = t.getMonth() === 0 ? t.getFullYear() - 1 : t.getFullYear()
      return makeDate(prevYear, prevMonth, day)
    },
  },
]

function cut(str, index, length) {
  return `${str.slice(0, index)} ${str.slice(index + length)}`
}

/** Finds a date phrase, returns the Date (or null if none/invalid) and the text with it removed. */
export function extractDate(text, today = new Date()) {
  for (const { re, build } of DATE_PATTERNS) {
    const m = re.exec(text)
    if (!m) continue
    const built = build(m, today)
    if (built === SKIP) continue
    return { date: built, rest: cut(text, m.index, m[0].length) }
  }
  return { date: null, rest: text }
}

// ------------------------------------------------------------------ amounts

const NUM = '(\\d[\\d,]*(?:\\.\\d+)?)'
const MULT = '(k|lakhs?|lacs?)?'
const PREFIXED = new RegExp(`(?:₹|\\brs\\b\\.?|\\binr\\b|\\brupees?\\b)\\s*${NUM}\\s*${MULT}(?![a-z])`, 'i')
const SUFFIXED = new RegExp(`${NUM}\\s*${MULT}\\s*(?:/-|\\brs\\b\\.?|\\brupees?\\b|\\binr\\b|₹)`, 'i')
const BARE = new RegExp(`(?<![\\d.,])${NUM}\\s*${MULT}(?![a-z\\d])`, 'gi')

function toAmount(numStr, mult) {
  const base = parseFloat(numStr.replace(/,/g, ''))
  const m = mult?.toLowerCase()
  const factor = m === 'k' ? 1000 : m && /^la[ck]/.test(m) ? 100000 : 1
  const value = Math.round(base * factor * 100) / 100
  return Number.isFinite(value) && value > 0 && value < 1e9 ? value : null
}

/**
 * Currency-marked numbers win (₹450, rs 450, 450/-, 450 rupees). Otherwise
 * take the largest bare number, since quantities ("3 sandwiches") are almost
 * always smaller than prices.
 */
export function extractAmount(text) {
  for (const re of [PREFIXED, SUFFIXED]) {
    const m = re.exec(text)
    if (m) {
      const amount = toAmount(m[1], m[2])
      if (amount) return { amount, rest: cut(text, m.index, m[0].length) }
    }
  }

  let best = null
  for (const m of text.matchAll(BARE)) {
    const amount = toAmount(m[1], m[2])
    if (amount && (!best || amount > best.amount)) best = { amount, index: m.index, length: m[0].length }
  }
  return best ? { amount: best.amount, rest: cut(text, best.index, best.length) } : null
}

// ------------------------------------------------------------- description

const FILLER = new RegExp(
  `\\b(?:i|spent|spend|paid|pay|bought|buy|purchased|got|on|for|at|in|the|a|an|of|my|was|were|` +
    `cost|costs|rs|inr|rupees?|today|yesterday|tonight|last|this|ago|add|log|expense|new|me|just|about|` +
    `around|approx|only|received|earned|credited|payment)\\b`,
  'gi'
)

function cleanDescription(text) {
  const cleaned = text
    .replace(/[₹"'`]/g, ' ')
    .replace(FILLER, ' ')
    .replace(/\s+[-/.,:;!?]+(?=\s|$)/g, ' ')
    .replace(/^[\s\-/.,:;!?]+|[\s\-/.,:;!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : ''
}

// ------------------------------------------------------------------- income

// "got 500 from dad" is income, but "got coffee 50" and "got 2 coffees for 100"
// are not, so "got" only counts when it is followed by an amount and then "from".
const INCOME_VERBS =
  /\b(?:received|earned|credited|got paid)\b|\bgot\s+(?:₹|rs\.?\s*|inr\s*)?\d[\d,.]*\s*(?:k|lakhs?|lacs?)?\s+from\b/i
const INCOME_NOUNS = /\b(salary|stipend|scholarship|bonus|freelance|pocket money|income)\b/i
const EXPENSE_VERBS = /\b(spent|spend|paid|pay|bought|buy|purchased|purchase|cost)\b/i

const INCOME_SOURCE_LABELS = {
  salary: 'Salary', stipend: 'Stipend', scholarship: 'Scholarship', bonus: 'Bonus',
  freelance: 'Freelance', 'pocket money': 'Pocket money',
}

function looksLikeIncome(text) {
  if (INCOME_VERBS.test(text)) return true
  // "paid salary to the maid" is an expense; "salary 50000" is income.
  return INCOME_NOUNS.test(text) && !EXPENSE_VERBS.test(text)
}

function incomeSource(text, description) {
  const m = INCOME_NOUNS.exec(text)
  if (m && INCOME_SOURCE_LABELS[m[1].toLowerCase()]) return INCOME_SOURCE_LABELS[m[1].toLowerCase()]
  return description || 'Other income'
}

// --------------------------------------------------------------------- main

/**
 * @returns one of
 *   { kind: 'empty' }
 *   { kind: 'question' }                       -> hand to the chat
 *   { kind: 'unknown' }                        -> no amount found; hand to the chat
 *   { kind: 'expense', amount, category, description, date }
 *   { kind: 'income',  amount, source,   description, date }
 */
export function parseQuickEntry(input, today = new Date()) {
  const text = (input ?? '').trim()
  if (!text) return { kind: 'empty' }
  if (isQuestion(text)) return { kind: 'question' }

  const dated = extractDate(text, today)
  const priced = extractAmount(dated.rest)
  if (!priced) return { kind: 'unknown' }

  const date = toLocalISODate(dated.date ?? today)
  const description = cleanDescription(priced.rest)

  if (looksLikeIncome(text)) {
    return { kind: 'income', amount: priced.amount, source: incomeSource(text, description), description, date }
  }

  return {
    kind: 'expense',
    amount: priced.amount,
    category: guessCategory(priced.rest),
    description,
    date,
  }
}
