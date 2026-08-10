import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { EXPENSE_CATEGORIES, todayISO } from '../utils/constants'

export default function ExpenseForm({ userId, existing, onDone, onCancel }) {
  const [amount, setAmount] = useState(existing?.amount ?? '')
  const [category, setCategory] = useState(existing?.category ?? EXPENSE_CATEGORIES[0])
  const [description, setDescription] = useState(existing?.description ?? '')
  const [date, setDate] = useState(existing?.expense_date ?? todayISO())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!amount || Number(amount) <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }
    setSaving(true)

    const payload = {
      user_id: userId,
      amount: Number(amount),
      category,
      description: description || null,
      expense_date: date,
    }

    const { error } = existing
      ? await supabase.from('expenses').update(payload).eq('id', existing.id)
      : await supabase.from('expenses').insert(payload)

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
          {existing ? 'Edit expense' : 'Add expense'}
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

          <div className="mb-3">
            <label className="block text-sm font-medium text-ink mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brass outline-none bg-surface"
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="mb-2">
            <label className="block text-sm font-medium text-ink mb-1.5">Note (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brass outline-none"
              placeholder="e.g. Groceries at DMart"
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
              className="flex-1 bg-ink text-paper-raised rounded-md py-2.5 text-sm font-medium hover:bg-ink-soft transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving…' : existing ? 'Save changes' : 'Add expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
