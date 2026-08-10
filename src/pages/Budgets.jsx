import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import BudgetForm from '../components/BudgetForm'
import BudgetProgress from '../components/BudgetProgress'
import { todayISO } from '../utils/constants'

export default function Budgets() {
  const { user } = useAuth()
  const [budgets, setBudgets] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)

  const monthStart = todayISO().slice(0, 7) + '-01'

  const loadData = async () => {
    setLoading(true)
    const [budgetsRes, expensesRes] = await Promise.all([
      supabase.from('budgets').select('*').eq('user_id', user.id).order('category'),
      supabase.from('expenses').select('*').eq('user_id', user.id).gte('expense_date', monthStart),
    ])
    setBudgets(budgetsRes.data || [])
    setExpenses(expensesRes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const budgetsWithSpend = useMemo(
    () =>
      budgets.map((b) => ({
        ...b,
        spent: expenses.filter((e) => e.category === b.category).reduce((s, e) => s + Number(e.amount), 0),
      })),
    [budgets, expenses]
  )

  const takenCategories = budgets.map((b) => b.category)

  const handleDelete = async (id) => {
    if (!confirm('Remove this budget?')) return
    await supabase.from('budgets').delete().eq('id', id)
    loadData()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Budgets</h1>
          <p className="text-ink-soft text-sm mt-1">Monthly caps by category, reset automatically each month.</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="bg-brass text-paper-raised rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + Set budget
        </button>
      </div>

      {loading ? (
        <p className="font-mono text-sm text-ink-soft">Loading…</p>
      ) : budgetsWithSpend.length === 0 ? (
        <div className="bg-surface border border-dashed border-line rounded-xl p-8 text-center">
          <p className="text-sm text-ink-soft">No budgets yet. Set a monthly cap per category to get early warnings before you overspend.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgetsWithSpend.map((b) => (
            <BudgetProgress
              key={b.id}
              category={b.category}
              spent={b.spent}
              limit={Number(b.monthly_limit)}
              onEdit={() => { setEditing(b); setShowForm(true) }}
              onDelete={() => handleDelete(b.id)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <BudgetForm
          userId={user.id}
          existing={editing}
          takenCategories={takenCategories}
          onDone={() => { setShowForm(false); loadData() }}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  )
}
