import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { EXPENSE_CATEGORIES } from '../utils/constants'

export default function BudgetForm({ userId, existing, allBudgets, households = [], onDone, onCancel }) {
  const [scope, setScope] = useState(existing?.household_id ?? '')
  const [category, setCategory] = useState(existing?.category ?? '')
  const [limit, setLimit] = useState(existing?.monthly_limit ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Which categories already have a budget *in the currently selected scope*
  // (personal, or a specific household) — uniqueness is scoped, not global.
  const takenCategories = useMemo(() => {
    return allBudgets
      .filter((b) => (scope ? b.household_id === scope : !b.household_id))
      .filter((b) => b.id !== existing?.id)
      .map((b) => b.category)
  }, [allBudgets, scope, existing])

  const availableCategories = EXPENSE_CATEGORIES.filter((c) => !takenCategories.includes(c))

  const handleScopeChange = (newScope) => {
    setScope(newScope)
    const stillAvailable = EXPENSE_CATEGORIES.filter(
      (c) => !allBudgets.some((b) => (newScope ? b.household_id === newScope : !b.household_id) && b.category === c && b.id !== existing?.id)
    )
    if (!stillAvailable.includes(category)) {
      setCategory(stillAvailable[0] ?? '')
    }
  }

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

    const payload = {
      user_id: userId,
      category,
      monthly_limit: Number(limit),
      household_id: scope || null,
    }

    const { error } = existing
      ? await supabase.from('budgets').update(payload).eq('id', existing.id)
      : await supabase.from('budgets').insert(payload)

    setSaving(false)
    if (error) {
      setError(error.message.includes('duplicate') ? 'That category already has a budget in this scope.' : error.message)
      return
    }
    onDone()
  }

  const effectiveCategory = category || availableCategories[0] || ''

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-30 px-4">
      <div className="bg-surface rounded-xl border border-line w-full max-w-md p-6">
        <h2 className="font-display text-xl font-semibold text-ink mb-4">
          {existing ? 'Edit budget' : 'Set a budget'}
        </h2>

        {availableCategories.length === 0 && !existing ? (
          <p className="text-sm text-ink-soft">
            Every category already has a budget in this scope. Choose a different household above, or edit an existing budget instead.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            {households.length > 0 && (
              <div className="mb-3">
                <label className="block text-sm font-medium text-ink mb-1.5">Scope</label>
                <select
                  value={scope}
                  disabled={!!existing}
                  onChange={(e) => handleScopeChange(e.target.value)}
                  className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brass outline-none bg-surface disabled:opacity-60"
                >
                  <option value="">Personal</option>
                  {households.map((h) => (
                    <option key={h.id} value={h.id}>{h.name} (shared)</option>
                  ))}
                </select>
              </div>
            )}

            <div className="mb-3">
              <label className="block text-sm font-medium text-ink mb-1.5">Category</label>
              <select
                value={effectiveCategory}
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
