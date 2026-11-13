import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useHouseholds } from '../hooks/useHouseholds'
import BudgetForm from '../components/BudgetForm'
import BudgetProgress from '../components/BudgetProgress'
import { todayISO } from '../utils/constants'

export default function Budgets() {
  const { user } = useAuth()
  const { households } = useHouseholds(user)
  const [budgets, setBudgets] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)

  const monthStart = todayISO().slice(0, 7) + '-01'

  const loadData = async () => {
    setLoading(true)
    const householdIds = households.map((h) => h.id)

    // Budgets: personal ones, plus any budget belonging to a household I'm
    // a member of. RLS would enforce this anyway, but filtering explicitly
    // keeps the query intent clear and avoids over-fetching.
    let budgetsQuery = supabase.from('budgets').select('*')
    budgetsQuery = householdIds.length > 0
      ? budgetsQuery.or(`user_id.eq.${user.id},household_id.in.(${householdIds.join(',')})`)
      : budgetsQuery.eq('user_id', user.id)

    let expensesQuery = supabase.from('expenses').select('*').gte('expense_date', monthStart)
    expensesQuery = householdIds.length > 0
      ? expensesQuery.or(`user_id.eq.${user.id},household_id.in.(${householdIds.join(',')})`)
      : expensesQuery.eq('user_id', user.id)

    const [budgetsRes, expensesRes] = await Promise.all([
      budgetsQuery.order('category'),
      expensesQuery,
    ])
    setBudgets(budgetsRes.data || [])
    setExpenses(expensesRes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [households.length])

  const householdName = (id) => households.find((h) => h.id === id)?.name

  const budgetsWithSpend = useMemo(
    () =>
      budgets.map((b) => ({
        ...b,
        spent: expenses
          .filter((e) => e.category === b.category)
          .filter((e) => (b.household_id ? e.household_id === b.household_id : !e.household_id && e.user_id === user.id))
          .reduce((s, e) => s + Number(e.amount), 0),
      })),
    [budgets, expenses, user.id]
  )

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
              householdName={b.household_id ? householdName(b.household_id) : null}
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
          allBudgets={budgets}
          households={households}
          onDone={() => { setShowForm(false); loadData() }}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  )
}
