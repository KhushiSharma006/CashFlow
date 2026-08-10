import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { todayISO } from '../utils/constants'

export default function IncomeForm({ userId, existing, onDone, onCancel }) {
  const [amount, setAmount] = useState(existing?.amount ?? '')
  const [source, setSource] = useState(existing?.source ?? '')
  const [date, setDate] = useState(existing?.income_date ?? todayISO())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!amount || Number(amount) <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }
    if (!source.trim()) {
      setError('Enter a source, e.g. Salary or Freelance.')
      return
    }
    setSaving(true)

    const payload = {
      user_id: userId,
      amount: Number(amount),
      source: source.trim(),
      income_date: date,
    }

    const { error } = existing
      ? await supabase.from('income').update(payload).eq('id', existing.id)
      : await supabase.from('income').insert(payload)

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
        <h2 className="font-display text-xl font-semibold text-ink mb-4">
          {existing ? 'Edit income' : 'Add income'}
        </h2>
        <form onSubmit={handleSubmit}>
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
              <label className="block text-sm font-medium text-ink mb-1.5">Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brass outline-none"
              />
            </div>
          </div>

          <div className="mb-2">
            <label className="block text-sm font-medium text-ink mb-1.5">Source</label>
            <input
              type="text"
              required
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brass outline-none"
              placeholder="e.g. Salary, Freelance, Scholarship"
            />
          </div>

          {error && (
            <p className="text-rust text-sm mt-2 bg-rust-soft rounded-md px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 mt-5">
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
              className="flex-1 bg-sage text-paper-raised rounded-md py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {saving ? 'Saving…' : existing ? 'Save changes' : 'Add income'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
