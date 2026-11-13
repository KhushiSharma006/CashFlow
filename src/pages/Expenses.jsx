import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useHouseholds } from '../hooks/useHouseholds'
import ExpenseForm from '../components/ExpenseForm'
import { EXPENSE_CATEGORIES, formatCurrency, formatDate } from '../utils/constants'
import { exportExpensesToCSV } from '../utils/csvExport'

export default function Expenses() {
  const { user } = useAuth()
  const { households } = useHouseholds(user)
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)

  const [categoryFilter, setCategoryFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const householdName = (id) => households.find((h) => h.id === id)?.name

  const loadExpenses = async () => {
    setLoading(true)
    const householdIds = households.map((h) => h.id)

    let query = supabase.from('expenses').select('*')
    query = householdIds.length > 0
      ? query.or(`user_id.eq.${user.id},household_id.in.(${householdIds.join(',')})`)
      : query.eq('user_id', user.id)

    const { data } = await query.order('expense_date', { ascending: false })
    setExpenses(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadExpenses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [households.length])

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false
      if (fromDate && e.expense_date < fromDate) return false
      if (toDate && e.expense_date > toDate) return false
      return true
    })
  }, [expenses, categoryFilter, fromDate, toDate])

  const total = filtered.reduce((sum, e) => sum + Number(e.amount), 0)

  const handleDelete = async (id) => {
    if (!confirm('Delete this expense?')) return
    await supabase.from('expenses').delete().eq('id', id)
    loadExpenses()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Expenses</h1>
          <p className="text-ink-soft text-sm mt-1">{filtered.length} entries · {formatCurrency(total)} total</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportExpensesToCSV(filtered)}
            disabled={filtered.length === 0}
            className="border border-line rounded-md px-4 py-2 text-sm font-medium text-ink-soft hover:bg-paper-raised transition-colors disabled:opacity-50"
          >
            Export CSV
          </button>
          <button
            onClick={() => { setEditing(null); setShowForm(true) }}
            className="bg-ink text-paper-raised rounded-md px-4 py-2 text-sm font-medium hover:bg-ink-soft transition-colors"
          >
            + Add expense
          </button>
        </div>
      </div>

      <div className="bg-surface border border-line rounded-xl p-4 mb-5 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-ink-soft mb-1">Category</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-md border border-line px-3 py-1.5 text-sm bg-surface"
          >
            <option value="all">All categories</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-soft mb-1">From</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-md border border-line px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-soft mb-1">To</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-md border border-line px-3 py-1.5 text-sm" />
        </div>
        {(categoryFilter !== 'all' || fromDate || toDate) && (
          <button
            onClick={() => { setCategoryFilter('all'); setFromDate(''); setToDate('') }}
            className="text-sm text-brass font-medium hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <p className="font-mono text-sm text-ink-soft">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-surface border border-dashed border-line rounded-xl p-8 text-center">
          <p className="text-sm text-ink-soft">No expenses match. Try clearing filters, or add your first entry.</p>
        </div>
      ) : (
        <div className="bg-surface border border-line rounded-xl overflow-hidden">
          {filtered.map((e) => (
            <div key={e.id} className="ledger-row flex items-center justify-between px-5 py-3.5 hover:bg-paper-raised transition-colors">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-ink">{e.category}</span>
                  <span className="text-xs text-ink-soft font-mono">{formatDate(e.expense_date)}</span>
                  {e.household_id && (
                    <span className="text-[10px] font-mono uppercase tracking-wide text-ink-soft border border-line rounded-full px-1.5 py-0.5">
                      {householdName(e.household_id) || 'shared'}
                    </span>
                  )}
                  {e.household_id && e.user_id !== user.id && (
                    <span className="text-xs text-ink-soft">by a household member</span>
                  )}
                </div>
                {e.description && <p className="text-sm text-ink-soft truncate">{e.description}</p>}
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className="font-mono text-ink font-medium">{formatCurrency(e.amount)}</span>
                <div className="flex gap-2 text-xs">
                  <button onClick={() => { setEditing(e); setShowForm(true) }} className="text-ink-soft hover:text-ink">Edit</button>
                  <button onClick={() => handleDelete(e.id)} className="text-ink-soft hover:text-rust">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ExpenseForm
          userId={user.id}
          existing={editing}
          households={households}
          onDone={() => { setShowForm(false); loadExpenses() }}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  )
}
