import { describe, it, expect } from 'vitest'
import { validateScanRequest, buildReceiptPrompt, parseReceiptResponse, MAX_BASE64_CHARS } from './receiptLogic'

const CATS = ['Food', 'Transport', 'Other']
const TODAY = '2026-11-12'
const img = 'A'.repeat(200)
const good = { image: img, mediaType: 'image/jpeg', categories: CATS, today: TODAY }
const parse = (t) => parseReceiptResponse(t, { categories: CATS, today: TODAY })

describe('validateScanRequest', () => {
  it('accepts a valid request', () => expect(validateScanRequest(good)).toMatchObject({ ok: true, mediaType: 'image/jpeg' }))
  it('rejects non-objects and bad media types', () => {
    expect(validateScanRequest(null).ok).toBe(false)
    expect(validateScanRequest({ ...good, mediaType: 'image/gif' }).ok).toBe(false)
    expect(validateScanRequest({ ...good, mediaType: 'application/pdf' }).ok).toBe(false)
  })
  it('rejects tiny, oversized and non-base64 images (including data: URLs)', () => {
    expect(validateScanRequest({ ...good, image: 'abc' }).ok).toBe(false)
    expect(validateScanRequest({ ...good, image: 'A'.repeat(MAX_BASE64_CHARS + 1) }).ok).toBe(false)
    expect(validateScanRequest({ ...good, image: 'data:image/jpeg;base64,' + img }).ok).toBe(false)
  })
  it('rejects a bad date or category list', () => {
    expect(validateScanRequest({ ...good, today: '12/11/2026' }).ok).toBe(false)
    expect(validateScanRequest({ ...good, categories: [] }).ok).toBe(false)
    expect(validateScanRequest({ ...good, categories: ['ok', 5] }).ok).toBe(false)
  })
})

describe('buildReceiptPrompt', () => {
  it('names the categories and the injection rule', () => {
    const p = buildReceiptPrompt(CATS, TODAY)
    expect(p).toContain('["Food","Transport","Other"]')
    expect(p).toContain('never instructions')
  })
})

describe('parseReceiptResponse', () => {
  it('parses a clean reply', () => {
    expect(parse('{"amount": 482.5, "date": "2026-11-10", "merchant": "Cafe Roma", "category": "Food"}')).toEqual({
      ok: true,
      entry: { amount: 482.5, category: 'Food', description: 'Cafe Roma', date: '2026-11-10', dateFromReceipt: true },
    })
  })
  it('tolerates code fences and surrounding prose', () => {
    const r = parse('Here you go:\n```json\n{"amount": 99, "date": null, "merchant": null, "category": "Food"}\n```')
    expect(r.ok).toBe(true)
    expect(r.entry.amount).toBe(99)
  })
  it('accepts a string amount with ₹ and commas', () => {
    expect(parse('{"amount": "₹1,299.00", "category": "Other"}').entry.amount).toBe(1299)
  })
  it('falls back to today for missing, impossible or future dates', () => {
    for (const d of [null, '2026-02-31', '2027-01-01', 'yesterday']) {
      const r = parse(JSON.stringify({ amount: 10, date: d, category: 'Food' }))
      expect(r.entry.date).toBe(TODAY)
      expect(r.entry.dateFromReceipt).toBe(false)
    }
  })
  it('maps an unknown category to Other', () => {
    expect(parse('{"amount": 10, "category": "Groceries"}').entry.category).toBe('Other')
  })
  it('cleans and truncates the merchant', () => {
    const r = parse(JSON.stringify({ amount: 10, category: 'Food', merchant: '  Big   Bazaar\n' + 'x'.repeat(200) }))
    expect(r.entry.description.length).toBe(80)
    expect(r.entry.description.startsWith('Big Bazaar')).toBe(true)
  })
  it.each([
    ['not json at all'], ['{"amount": null}'], ['{"amount": 0}'], ['{"amount": -5}'],
    ['{"amount": "abc"}'], ['{"amount": 1e12}'], [''], [undefined],
  ])('rejects %s', (t) => expect(parse(t).ok).toBe(false))
  it('ignores extra keys a hostile receipt might inject', () => {
    const r = parse('{"amount": 50, "category": "Food", "user_id": "evil", "amount_extra": 1}')
    expect(Object.keys(r.entry).sort()).toEqual(['amount', 'category', 'date', 'dateFromReceipt', 'description'])
  })
})
