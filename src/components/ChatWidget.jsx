import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { parseQuickEntry } from '../utils/quickEntryParser'
import { EXPENSE_CATEGORIES, todayISO } from '../utils/constants'
import { fileToResizedBase64 } from '../utils/imageResize'

const HINTS = ['spent 450 on lunch yesterday', 'received salary 50000', 'How much did I spend on food this month?']

let nextId = 1
const newId = () => nextId++

async function errorMessage(error, feature = 'chat assistant') {
  // supabase-js wraps non-2xx responses; the useful text is in the body.
  try {
    const body = await error.context?.json?.()
    if (body?.error) return body.error
  } catch { /* fall through */ }
  if (error?.name === 'FunctionsFetchError' || /not found|failed to send/i.test(error?.message || '')) {
    return `The ${feature} is not deployed yet. Quick-add (e.g. "spent 450 on lunch") still works.`
  }
  return 'The assistant is unavailable right now. Please try again.'
}

export default function ChatWidget({ onSaved }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [items, setItems] = useState([])
  const endRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' })
  }, [items, open])

  const push = (item) => setItems((prev) => [...prev, { id: newId(), ...item }])
  const patch = (id, changes) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...changes } : i)))

  const askAssistant = async (text) => {
    const history = [...items.filter((i) => i.type === 'user' || i.type === 'bot'), { type: 'user', text }]
      .map((i) => ({ role: i.type === 'user' ? 'user' : 'assistant', content: i.text }))
    const { data, error } = await supabase.functions.invoke('finance-chat', {
      body: { messages: history, today: todayISO() },
    })
    if (error) push({ type: 'error', text: await errorMessage(error) })
    else push({ type: 'bot', text: data.reply })
  }

  const submit = async (e) => {
    e?.preventDefault()
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    push({ type: 'user', text })
    const parsed = parseQuickEntry(text)

    if (parsed.kind === 'expense' || parsed.kind === 'income') {
      push({ type: 'confirm', entry: parsed, state: 'pending' })
      return
    }
    setBusy(true)
    await askAssistant(text)
    setBusy(false)
  }

  const scanReceipt = async (file) => {
    if (!file || busy) return
    push({ type: 'user', text: `📎 ${file.name || 'Receipt photo'}` })
    setBusy(true)
    try {
      const { image, mediaType } = await fileToResizedBase64(file)
      const { data, error } = await supabase.functions.invoke('scan-receipt', {
        body: { image, mediaType, categories: EXPENSE_CATEGORIES, today: todayISO() },
      })
      if (error) push({ type: 'error', text: await errorMessage(error, 'receipt scanning') })
      else push({ type: 'confirm', entry: { kind: 'expense', ...data.entry }, state: 'pending', scanned: true })
    } catch {
      push({ type: 'error', text: "Couldn't read that image file. Try a JPEG or PNG photo." })
    }
    setBusy(false)
  }

  const edit = (item, field, value) => patch(item.id, { entry: { ...item.entry, [field]: value }, error: '' })

  const save = async (item) => {
    const { entry } = item
    const amount = Number(entry.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      patch(item.id, { error: 'Enter an amount greater than zero.' })
      return
    }
    patch(item.id, { state: 'saving' })
    const { error } =
      entry.kind === 'expense'
        ? await supabase.from('expenses').insert({
            user_id: user.id,
            amount,
            category: entry.category,
            description: entry.description || null,
            expense_date: entry.date,
          })
        : await supabase.from('income').insert({
            user_id: user.id,
            amount,
            source: entry.source,
            income_date: entry.date,
          })
    if (error) {
      patch(item.id, { state: 'pending', error: error.message })
      return
    }
    patch(item.id, { state: 'saved', error: '' })
    onSaved?.()
  }

  return (
    <div className="fixed bottom-5 right-5 z-30 flex flex-col items-end gap-3">
      {open && (
        <section
          aria-label="CashFlow assistant"
          className="w-[min(92vw,380px)] h-[min(70vh,520px)] bg-surface border border-line rounded-xl shadow-xl flex flex-col overflow-hidden"
        >
          <header className="px-4 py-3 border-b border-line flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold text-ink">Assistant</h2>
              <p className="text-xs text-ink-soft">Add entries or ask about your money</p>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close assistant" className="text-ink-soft hover:text-ink text-xl leading-none">×</button>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-sm">
            {items.length === 0 && (
              <div className="text-ink-soft">
                <p className="mb-2">Try one of these, or tap the camera to scan a receipt:</p>
                <div className="flex flex-col gap-1.5">
                  {HINTS.map((h) => (
                    <button key={h} onClick={() => setInput(h)} className="text-left font-mono text-xs border border-line rounded-md px-2.5 py-1.5 hover:bg-paper-raised text-ink">
                      {h}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {items.map((i) => {
              if (i.type === 'user') {
                return <div key={i.id} className="ml-auto max-w-[85%] bg-ink text-paper-raised rounded-lg px-3 py-2 w-fit">{i.text}</div>
              }
              if (i.type === 'bot') {
                return <div key={i.id} className="max-w-[90%] bg-paper-raised text-ink rounded-lg px-3 py-2 whitespace-pre-wrap">{i.text}</div>
              }
              if (i.type === 'error') {
                return <div key={i.id} className="max-w-[90%] bg-rust-soft text-rust rounded-lg px-3 py-2">{i.text}</div>
              }
              const { entry } = i
              const isExpense = entry.kind === 'expense'
              const locked = i.state === 'saved' || i.state === 'cancelled' || i.state === 'saving'
              const field = 'w-full bg-paper border border-line rounded-md px-2 py-1 text-sm text-ink focus:outline-none focus:border-brass disabled:opacity-60'
              return (
                <div key={i.id} className="border border-line rounded-lg p-3 bg-paper-raised">
                  <p className="font-mono text-[11px] uppercase tracking-widest text-ink-soft mb-2">
                    {isExpense ? 'New expense' : 'New income'}
                    {i.scanned ? ' · from receipt, please check' : ''}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-ink-soft">Amount (₹)
                      <input type="number" min="0" step="0.01" aria-label="Amount" disabled={locked} className={field}
                        value={entry.amount} onChange={(e) => edit(i, 'amount', e.target.value)} />
                    </label>
                    <label className="text-xs text-ink-soft">Date
                      <input type="date" aria-label="Date" disabled={locked} className={field}
                        value={entry.date} onChange={(e) => edit(i, 'date', e.target.value)} />
                    </label>
                    {isExpense ? (
                      <>
                        <label className="text-xs text-ink-soft">Category
                          <select aria-label="Category" disabled={locked} className={field}
                            value={entry.category} onChange={(e) => edit(i, 'category', e.target.value)}>
                            {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                          </select>
                        </label>
                        <label className="text-xs text-ink-soft">Note
                          <input aria-label="Note" disabled={locked} className={field} maxLength={120}
                            value={entry.description} onChange={(e) => edit(i, 'description', e.target.value)} />
                        </label>
                      </>
                    ) : (
                      <label className="text-xs text-ink-soft col-span-2">Source
                        <input aria-label="Source" disabled={locked} className={field} maxLength={80}
                          value={entry.source} onChange={(e) => edit(i, 'source', e.target.value)} />
                      </label>
                    )}
                  </div>
                  {i.scanned && !entry.dateFromReceipt && (
                    <p className="text-xs text-ink-soft mt-2">No date found on the receipt, so today's date is used.</p>
                  )}
                  {i.error && <p className="text-rust text-xs mt-2">{i.error}</p>}
                  {i.state === 'saved' ? (
                    <p className="text-sage text-sm font-medium mt-2">Saved ✓</p>
                  ) : i.state === 'cancelled' ? (
                    <p className="text-ink-soft text-sm mt-2">Discarded</p>
                  ) : (
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => save(i)} disabled={i.state === 'saving'} className="px-3 py-1.5 rounded-md bg-ink text-paper-raised text-sm font-medium disabled:opacity-60">
                        {i.state === 'saving' ? 'Saving…' : 'Save'}
                      </button>
                      <button onClick={() => patch(i.id, { state: 'cancelled' })} className="px-3 py-1.5 rounded-md text-sm text-ink-soft hover:text-ink">
                        Discard
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
            {busy && <p className="text-ink-soft font-mono text-xs">Thinking…</p>}
            <div ref={endRef} />
          </div>

          <form onSubmit={submit} className="border-t border-line p-3 flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              data-testid="receipt-input"
              onChange={(e) => {
                scanReceipt(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} aria-label="Scan a receipt"
              title="Scan a receipt" className="px-2.5 rounded-md border border-line text-ink-soft hover:text-ink hover:bg-paper-raised disabled:opacity-50">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 8h3l1.5-2h7L17 8h3v11H4V8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='e.g. "spent 450 on lunch"'
              aria-label="Message the assistant"
              maxLength={500}
              className="flex-1 min-w-0 bg-paper border border-line rounded-md px-3 py-2 text-sm text-ink focus:outline-none focus:border-brass"
            />
            <button type="submit" disabled={busy || !input.trim()} className="px-3 py-2 rounded-md bg-brass text-paper-raised text-sm font-medium disabled:opacity-50">
              Send
            </button>
          </form>
        </section>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close assistant' : 'Open assistant'}
        aria-expanded={open}
        className="w-12 h-12 rounded-full bg-ink text-paper-raised shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5v-8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}
