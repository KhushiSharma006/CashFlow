import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { EXPENSE_CATEGORIES } from '../utils/constants'

export default function BudgetForm({ userId, existing, takenCategories, onDone, onCancel }) {
  const availableCategories = existing
    ? EXPENSE_CATEGORIES
    : EXPENSE_CATEGORIES.filter((c) => !takenCategories.includes(c))

  const [category, setCategory] = useState(existing?.category ?? availableCategories[0] ?? '')
  const [limit, setLimit] = useState(existing?.monthly_limit ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!limit || Number(limit) <= 0) {
      setError('Enter a monthly limit greater than zero.')
      return
    }
    if (!category) {
      setError('Choose a category.')
      return
    }
    setSaving(true)

    const payload = { user_id: userId, category, monthly_limit: Number(limit) }

    const { error } = existing
      ? await supabase.from('budgets').update(payload).eq('id', existing.id)
      : await supabase.from('budgets').insert(payload)

    setSaving(false)
    if (error) {
      setError(error.message.includes('duplicate') ? 'You already have a budget for this category.' : error.message)
      return
    }
    onDone()
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-30 px-4">
      <div className="bg-surface rounded-xl border border-line w-full max-w-md p-6">
        <h2 className="font-display text-xl font-semibold text-ink mb-4">
          {existing ? 'Edit budget' : 'Set a budget'}
        </h2>

        {availableCategories.length === 0 && !existing ? (
          <p className="text-sm text-ink-soft">
            You've set a budget for every category already. Edit an existing one instead.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="block text-sm font-medium text-ink mb-1.5">Category</label>
              <select
                value={category}
                disabled={!!existing}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brass outline-none bg-surface disabled:opacity-60"
              >
                {availableCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="mb-2">
              <label className="block text-sm font-medium text-ink mb-1.5">Monthly limit (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                className="w-full rounded-md border border-line px-3 py-2 text-sm font-mono focus:border-brass outline-none"
                placeholder="0.00"
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
                className="flex-1 bg-brass text-paper-raised rounded-md py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {saving ? 'Saving…' : existing ? 'Save changes' : 'Set budget'}
              </button>
            </div>
          </form>
        )}

        {availableCategories.length === 0 && !existing && (
          <button
            onClick={onCancel}
            className="mt-4 w-full border border-line rounded-md py-2.5 text-sm font-medium text-ink-soft hover:bg-paper-raised transition-colors"
          >
            Close
          </button>
        )}
      </div>
    </div>
  )
}
