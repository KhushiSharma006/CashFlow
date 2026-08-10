import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { EXPENSE_CATEGORIES, FREQUENCIES, todayISO } from '../utils/constants'

export default function RecurringForm({ userId, onDone, onCancel }) {
  const [type, setType] = useState('expense')
  const [amount, setAmount] = useState('')
  const [label, setLabel] = useState(EXPENSE_CATEGORIES[0])
  const [description, setDescription] = useState('')
  const [frequency, setFrequency] = useState('monthly')
  const [startDate, setStartDate] = useState(todayISO())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!amount || Number(amount) <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }
    if (type === 'income' && !label.trim()) {
      setError('Enter an income source, e.g. Salary.')
      return
    }
    setSaving(true)

    const { error } = await supabase.from('recurring_templates').insert({
      user_id: userId,
      type,
      amount: Number(amount),
      label: type === 'expense' ? label : label.trim(),
      description: description || null,
      frequency,
      start_date: startDate,
    })

    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    onDone()
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-30 px-4">
      <div className="bg-surface rounded-xl border border-line w-full max-w-md p-6">
        <h2 className="font-display text-xl font-semibold text-ink mb-4">Add recurring item</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="block text-sm font-medium text-ink mb-1.5">Type</label>
            <div className="flex rounded-md border border-line overflow-hidden">
              <button
                type="button"
                onClick={() => { setType('expense'); setLabel(EXPENSE_CATEGORIES[0]) }}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${type === 'expense' ? 'bg-ink text-paper-raised' : 'bg-surface text-ink-soft'}`}
              >
                Expense
              </button>
              <button
                type="button"
                onClick={() => { setType('income'); setLabel('') }}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${type === 'income' ? 'bg-sage text-paper-raised' : 'bg-surface text-ink-soft'}`}
              >
                Income
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-md border border-line px-3 py-2 text-sm font-mono focus:border-brass outline-none"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Frequency</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brass outline-none bg-surface capitalize"
              >
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-sm font-medium text-ink mb-1.5">
              {type === 'expense' ? 'Category' : 'Source'}
            </label>
            {type === 'expense' ? (
              <select
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brass outline-none bg-surface"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                required
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brass outline-none"
                placeholder="e.g. Salary"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-2">
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Note (optional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brass outline-none"
                placeholder="e.g. Netflix"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Starts on</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brass outline-none"
              />
            </div>
          </div>

          {error && (
            <p className="text-rust text-sm mt-2 bg-rust-soft rounded-md px-3 py-2">{error}</p>
          )}

          <p className="text-xs text-ink-soft mt-3">
            Tallybook auto-generates each occurrence as a real entry once its date arrives — no manual re-entry needed.
          </p>

          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 border border-line rounded-md py-2.5 text-sm font-medium text-ink-soft hover:bg-paper-raised transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-ink text-paper-raised rounded-md py-2.5 text-sm font-medium hover:bg-ink-soft transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Add recurring item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
