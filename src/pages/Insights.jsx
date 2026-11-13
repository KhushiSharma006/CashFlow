import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import StatCard from '../components/StatCard'
import AnomalyCard from '../components/AnomalyCard'
import ForecastChart from '../components/ForecastChart'
import { formatCurrency, lastNMonths, monthKeyFromDate, todayISO, toLocalISODate } from '../utils/constants'
import { forecastNextMonth, projectMonthEnd, detectCategoryAnomalies } from '../utils/insights'

const HISTORY_MONTHS = 6

export default function Insights() {
  const { user } = useAuth()
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)

  const windowStart = useMemo(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - (HISTORY_MONTHS - 1))
    d.setDate(1)
    return toLocalISODate(d)
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .gte('expense_date', windowStart)
      setExpenses(data || [])
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const months = useMemo(() => lastNMonths(HISTORY_MONTHS), [])
  const currentMonthKey = todayISO().slice(0, 7)
  const pastMonths = months.filter((m) => m.key !== currentMonthKey)

  // Monthly totals (full history including current, for the chart)
  const monthlyTotals = useMemo(
    () =>
      months.map((m) => ({
        key: m.key,
        label: m.label,
        total: expenses
          .filter((e) => monthKeyFromDate(e.expense_date) === m.key)
          .reduce((s, e) => s + Number(e.amount), 0),
      })),
    [expenses, months]
  )

  // Forecast next month from the trend in past (completed) months only
  const completedTotals = monthlyTotals.filter((m) => m.key !== currentMonthKey).map((m) => m.total)
  const { forecast, r2, trend } = forecastNextMonth(completedTotals)

  // This month's run-rate projection
  const spentSoFar = expenses
    .filter((e) => monthKeyFromDate(e.expense_date) === currentMonthKey)
    .reduce((s, e) => s + Number(e.amount), 0)
  const projectedThisMonth = projectMonthEnd(spentSoFar)

  // Category history (past months only) + this month's projected spend per category
  const { categoryHistory, categoryProjectedThisMonth } = useMemo(() => {
    const categories = [...new Set(expenses.map((e) => e.category))]
    const history = {}
    for (const cat of categories) {
      history[cat] = pastMonths.map((m) =>
        expenses
          .filter((e) => e.category === cat && monthKeyFromDate(e.expense_date) === m.key)
          .reduce((s, e) => s + Number(e.amount), 0)
      )
    }

    const projected = {}
    for (const cat of categories) {
      const spent = expenses
        .filter((e) => e.category === cat && monthKeyFromDate(e.expense_date) === currentMonthKey)
        .reduce((s, e) => s + Number(e.amount), 0)
      projected[cat] = projectMonthEnd(spent)
    }

    return { categoryHistory: history, categoryProjectedThisMonth: projected }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses])

  const anomalies = useMemo(
    () => detectCategoryAnomalies(categoryHistory, categoryProjectedThisMonth),
    [categoryHistory, categoryProjectedThisMonth]
  )

  const chartData = useMemo(() => {
    const base = monthlyTotals.map((m) => ({ label: m.label, total: m.total, isForecast: false }))
    if (forecast !== null) {
      const nextLabel = new Date(
        new Date().getFullYear(),
        new Date().getMonth() + 1,
        1
      ).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
      base.push({ label: nextLabel, total: Math.round(forecast), isForecast: true })
    }
    return base
  }, [monthlyTotals, forecast])

  if (loading) {
    return <p className="font-mono text-sm text-ink-soft">Crunching the numbers…</p>
  }

  const hasEnoughData = completedTotals.filter((t) => t > 0).length >= 2

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Insights</h1>
        <p className="text-ink-soft text-sm mt-1">
          A statistical read on where your spending is heading — trend forecast and category outliers.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Projected this month"
          value={formatCurrency(projectedThisMonth)}
          accent="brass"
          sub="Based on your spending pace so far"
        />
        <StatCard
          label="Forecast next month"
          value={forecast !== null ? formatCurrency(forecast) : '—'}
          accent={trend === 'up' ? 'rust' : trend === 'down' ? 'sage' : 'ink'}
          sub={
            forecast === null
              ? 'Need 2+ months of history'
              : trend === 'up'
              ? 'Trending upward'
              : trend === 'down'
              ? 'Trending downward'
              : 'Roughly steady'
          }
        />
        <StatCard
          label="Unusual categories"
          value={String(anomalies.length)}
          accent={anomalies.length > 0 ? 'rust' : 'sage'}
          sub={anomalies.length > 0 ? 'Running above their usual pace' : 'Nothing out of the ordinary'}
        />
      </div>

      <div className="bg-surface border border-line rounded-xl p-5 mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-semibold text-ink">Monthly spend &amp; forecast</h2>
          {forecast !== null && (
            <span className="font-mono text-xs text-ink-soft">
              fit confidence R² {r2.toFixed(2)}
            </span>
          )}
        </div>
        {hasEnoughData ? (
          <>
            <ForecastChart data={chartData} />
            <p className="text-xs text-ink-soft mt-3">
              The gold bar is a linear-regression forecast from your last {completedTotals.length} completed months. Lower R² means the trend is noisier and the forecast less certain.
            </p>
          </>
        ) : (
          <p className="text-sm text-ink-soft py-8 text-center">
            Log at least two full months of expenses to unlock a forecast.
          </p>
        )}
      </div>

      <h2 className="font-display text-lg font-semibold text-ink mb-3">Category anomalies</h2>
      {anomalies.length === 0 ? (
        <div className="bg-surface border border-dashed border-line rounded-xl p-6 text-center">
          <p className="text-sm text-ink-soft">
            No category is running significantly above its historical average right now.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {anomalies.map((a) => (
            <AnomalyCard key={a.category} {...a} />
          ))}
        </div>
      )}

      <p className="text-xs text-ink-soft mt-6">
        How this works: each category's historical mean and standard deviation are computed from your completed months, then this month's pace-projected spend is compared against that baseline (a z-score). Categories more than 1.3 standard deviations above their own average are flagged.
      </p>
    </div>
  )
}
