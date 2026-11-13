import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { runRecurringEngine } from '../utils/recurring'
import StatCard from '../components/StatCard'
import BudgetProgress from '../components/BudgetProgress'
import { CategoryPieChart, MonthlyTrendChart } from '../components/ChartsSection'
import { formatCurrency, lastNMonths, monthKeyFromDate, todayISO, toLocalISODate } from '../utils/constants'

export default function Dashboard() {
  const { user } = useAuth()
  const [expenses, setExpenses] = useState([])
  const [income, setIncome] = useState([])
  const [budgets, setBudgets] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncNote, setSyncNote] = useState('')

  const sixMonthsAgo = useMemo(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 5)
    d.setDate(1)
    return toLocalISODate(d)
  }, [])

  const loadData = async () => {
    setLoading(true)

    const { generated } = await runRecurringEngine(user.id)
    if (generated > 0) {
      setSyncNote(`Added ${generated} recurring ${generated === 1 ? 'entry' : 'entries'} that came due.`)
    }

    const [expensesRes, incomeRes, budgetsRes] = await Promise.all([
      supabase.from('expenses').select('*').eq('user_id', user.id).gte('expense_date', sixMonthsAgo).order('expense_date', { ascending: false }),
      supabase.from('income').select('*').eq('user_id', user.id).gte('income_date', sixMonthsAgo).order('income_date', { ascending: false }),
      supabase.from('budgets').select('*').eq('user_id', user.id).order('category'),
    ])

    setExpenses(expensesRes.data || [])
    setIncome(incomeRes.data || [])
    setBudgets(budgetsRes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const currentMonthKey = todayISO().slice(0, 7)

  const thisMonthExpenses = expenses.filter((e) => monthKeyFromDate(e.expense_date) === currentMonthKey)
  const thisMonthIncome = income.filter((i) => monthKeyFromDate(i.income_date) === currentMonthKey)

  const totalSpentThisMonth = thisMonthExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const totalIncomeThisMonth = thisMonthIncome.reduce((sum, i) => sum + Number(i.amount), 0)
  const netThisMonth = totalIncomeThisMonth - totalSpentThisMonth

  const categoryTotals = useMemo(() => {
    const map = {}
    for (const e of thisMonthExpenses) {
      map[e.category] = (map[e.category] || 0) + Number(e.amount)
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [thisMonthExpenses])

  const trendData = useMemo(() => {
    const months = lastNMonths(6)
    return months.map(({ key, label }) => {
      const exp = expenses.filter((e) => monthKeyFromDate(e.expense_date) === key).reduce((s, e) => s + Number(e.amount), 0)
      const inc = income.filter((i) => monthKeyFromDate(i.income_date) === key).reduce((s, i) => s + Number(i.amount), 0)
      return { label, expenses: exp, income: inc }
    })
  }, [expenses, income])

  const budgetsWithSpend = budgets.map((b) => ({
    ...b,
    spent: thisMonthExpenses.filter((e) => e.category === b.category).reduce((s, e) => s + Number(e.amount), 0),
  }))

  const overBudgetCount = budgetsWithSpend.filter((b) => b.spent >= b.monthly_limit).length

  if (loading) {
    return <p className="font-mono text-sm text-ink-soft">Tallying up your month…</p>
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">This month</h1>
        <p className="text-ink-soft text-sm mt-1">
          {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {syncNote && (
        <div className="bg-sage-soft text-sage text-sm rounded-md px-4 py-2.5 mb-6">
          {syncNote}
        </div>
      )}

      {overBudgetCount > 0 && (
        <div className="bg-rust-soft text-rust text-sm rounded-md px-4 py-2.5 mb-6">
          You're over budget in {overBudgetCount} {overBudgetCount === 1 ? 'category' : 'categories'} this month.{' '}
          <Link to="/budgets" className="underline font-medium">Review budgets</Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Income" value={formatCurrency(totalIncomeThisMonth)} accent="sage" />
        <StatCard label="Spent" value={formatCurrency(totalSpentThisMonth)} accent="rust" />
        <StatCard
          label="Net"
          value={formatCurrency(netThisMonth)}
          accent={netThisMonth >= 0 ? 'sage' : 'rust'}
          sub={netThisMonth >= 0 ? 'Saved this month' : 'Spent beyond income'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
        <div className="bg-surface border border-line rounded-xl p-5">
          <h2 className="font-display text-lg font-semibold text-ink mb-3">Spend by category</h2>
          <CategoryPieChart data={categoryTotals} />
          {categoryTotals.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
              {categoryTotals.map((c) => (
                <span key={c.name} className="text-xs text-ink-soft flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: 'var(--brass)' }} />
                  {c.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="bg-surface border border-line rounded-xl p-5">
          <h2 className="font-display text-lg font-semibold text-ink mb-3">6-month trend</h2>
          <MonthlyTrendChart data={trendData} />
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg font-semibold text-ink">Budgets</h2>
        <Link to="/budgets" className="text-sm text-brass font-medium hover:underline">
          Manage all
        </Link>
      </div>

      {budgetsWithSpend.length === 0 ? (
        <div className="bg-surface border border-dashed border-line rounded-xl p-6 text-center">
          <p className="text-sm text-ink-soft mb-3">No budgets set yet. Cap a category to get alerts before you overspend.</p>
          <Link to="/budgets" className="text-sm font-medium text-brass hover:underline">Set your first budget →</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgetsWithSpend.slice(0, 6).map((b) => (
            <BudgetProgress
              key={b.id}
              category={b.category}
              spent={b.spent}
              limit={Number(b.monthly_limit)}
              readOnly
            />
          ))}
        </div>
      )}
    </div>
  )
}
