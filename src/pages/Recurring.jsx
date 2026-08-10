import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import RecurringForm from '../components/RecurringForm'
import { formatCurrency, formatDate } from '../utils/constants'

export default function Recurring() {
  const { user } = useAuth()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const loadTemplates = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('recurring_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setTemplates(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadTemplates()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleActive = async (t) => {
    await supabase.from('recurring_templates').update({ active: !t.active }).eq('id', t.id)
    loadTemplates()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this recurring item? Past generated entries stay in your ledger.')) return
    await supabase.from('recurring_templates').delete().eq('id', id)
    loadTemplates()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Recurring</h1>
          <p className="text-ink-soft text-sm mt-1">
            Rent, subscriptions, salary — set once and CashFlow logs each occurrence for you.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-ink text-paper-raised rounded-md px-4 py-2 text-sm font-medium hover:bg-ink-soft transition-colors"
        >
          + Add recurring item
        </button>
      </div>

      {loading ? (
        <p className="font-mono text-sm text-ink-soft">Loading…</p>
      ) : templates.length === 0 ? (
        <div className="bg-surface border border-dashed border-line rounded-xl p-8 text-center">
          <p className="text-sm text-ink-soft">
            Nothing set up yet. Add recurring rent, subscriptions, or your salary so you stop re-typing the same entry every month.
          </p>
        </div>
      ) : (
        <div className="bg-surface border border-line rounded-xl overflow-hidden">
          {templates.map((t) => (
            <div key={t.id} className="ledger-row flex items-center justify-between px-5 py-3.5 hover:bg-paper-raised transition-colors">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-ink">{t.label}</span>
                  <span className="text-xs uppercase tracking-wide font-mono text-ink-soft border border-line rounded-full px-2 py-0.5">
                    {t.frequency}
                  </span>
                  {!t.active && (
                    <span className="text-xs font-mono text-rust border border-rust/30 rounded-full px-2 py-0.5">paused</span>
                  )}
                </div>
                <p className="text-xs text-ink-soft mt-0.5">
                  {t.type === 'expense' ? 'Expense' : 'Income'} · started {formatDate(t.start_date)}
                  {t.last_generated ? ` · last logged ${formatDate(t.last_generated)}` : ' · not logged yet'}
                </p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className={`font-mono font-medium ${t.type === 'income' ? 'text-sage' : 'text-ink'}`}>
                  {t.type === 'income' ? '+' : ''}{formatCurrency(t.amount)}
                </span>
                <div className="flex gap-2 text-xs">
                  <button onClick={() => toggleActive(t)} className="text-ink-soft hover:text-ink">
                    {t.active ? 'Pause' : 'Resume'}
                  </button>
                  <button onClick={() => handleDelete(t.id)} className="text-ink-soft hover:text-rust">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <RecurringForm
          userId={user.id}
          onDone={() => { setShowForm(false); loadTemplates() }}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  )
}
