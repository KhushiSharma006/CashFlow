import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import IncomeForm from '../components/IncomeForm'
import { formatCurrency, formatDate } from '../utils/constants'

export default function Income() {
  const { user } = useAuth()
  const [income, setIncome] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)

  const loadIncome = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('income')
      .select('*')
      .eq('user_id', user.id)
      .order('income_date', { ascending: false })
    setIncome(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadIncome()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const total = income.reduce((sum, i) => sum + Number(i.amount), 0)

  const handleDelete = async (id) => {
    if (!confirm('Delete this income entry?')) return
    await supabase.from('income').delete().eq('id', id)
    loadIncome()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Income</h1>
          <p className="text-ink-soft text-sm mt-1">{income.length} entries · {formatCurrency(total)} total</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="bg-sage text-paper-raised rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + Add income
        </button>
      </div>

      {loading ? (
        <p className="font-mono text-sm text-ink-soft">Loading…</p>
      ) : income.length === 0 ? (
        <div className="bg-surface border border-dashed border-line rounded-xl p-8 text-center">
          <p className="text-sm text-ink-soft">No income logged yet. Add your salary, freelance work, or any other source.</p>
        </div>
      ) : (
        <div className="bg-surface border border-line rounded-xl overflow-hidden">
          {income.map((i) => (
            <div key={i.id} className="ledger-row flex items-center justify-between px-5 py-3.5 hover:bg-paper-raised transition-colors">
              <div>
                <span className="font-medium text-ink">{i.source}</span>{' '}
                <span className="text-xs text-ink-soft font-mono">{formatDate(i.income_date)}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-mono text-sage font-medium">+{formatCurrency(i.amount)}</span>
                <div className="flex gap-2 text-xs">
                  <button onClick={() => { setEditing(i); setShowForm(true) }} className="text-ink-soft hover:text-ink">Edit</button>
                  <button onClick={() => handleDelete(i.id)} className="text-ink-soft hover:text-rust">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <IncomeForm
          userId={user.id}
          existing={editing}
          onDone={() => { setShowForm(false); loadIncome() }}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  )
}
